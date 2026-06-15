import { env } from "@/lib/env";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cache?: RequestCache;
  signal?: AbortSignal;
}

interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiError | null;
}

interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout = 30000;
  private maxRetries = 2;
  private retryDelay = 1000;

  constructor() {
    this.baseUrl = env.apiUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await secureStorage.getJSON<{
      access_token: string;
      refresh_token: string;
    }>(STORAGE_KEYS.SESSION_DATA);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-platform": "mobile",
    };

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  private buildUrl(path: string, params?: ApiRequestConfig["params"]): string {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(
    path: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      body,
      params,
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      retryDelay = this.retryDelay,
      signal,
    } = config;

    const authHeaders = await this.getAuthHeaders();
    const url = this.buildUrl(path, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const combinedSignal = signal
      ? combineAbortSignals(signal, controller.signal)
      : controller.signal;

    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            ...authHeaders,
            ...config.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          return {
            ok: false,
            status: 401,
            data: null,
            error: {
              code: "UNAUTHORIZED",
              message: "Session expired. Please sign in again.",
              status: 401,
            },
          };
        }

        if (response.status === 403) {
          const errorBody = await this.parseErrorBody(response);
          return {
            ok: false,
            status: 403,
            data: null,
            error: {
              code: errorBody?.code ?? "FORBIDDEN",
              message: errorBody?.message ?? "You do not have permission.",
              status: 403,
            },
          };
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : retryDelay;

          if (attempt < retries) {
            await this.wait(delay * (attempt + 1));
            continue;
          }

          return {
            ok: false,
            status: 429,
            data: null,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please try again later.",
              status: 429,
            },
          };
        }

        if (!response.ok) {
          const errorBody = await this.parseErrorBody(response);
          return {
            ok: false,
            status: response.status,
            data: null,
            error: {
              code: errorBody?.code ?? "API_ERROR",
              message: errorBody?.message ?? `Request failed with status ${response.status}`,
              status: response.status,
              details: errorBody,
            },
          };
        }

        if (response.status === 204) {
          return {
            ok: true,
            status: 204,
            data: null,
            error: null,
          };
        }

        const data = (await response.json()) as T;
        return {
          ok: true,
          status: response.status,
          data,
          error: null,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            ok: false,
            status: 0,
            data: null,
            error: {
              code: "TIMEOUT",
              message: "Request timed out.",
              status: 0,
            },
          };
        }

        if (attempt < retries) {
          await this.wait(retryDelay * (attempt + 1));
          continue;
        }

        const networkError = error as Error;
        lastError = {
          code: "NETWORK_ERROR",
          message: networkError.message ?? "Network request failed.",
          status: 0,
        };
      }
    }

    return {
      ok: false,
      status: 0,
      data: null,
      error: lastError ?? {
        code: "UNKNOWN_ERROR",
        message: "An unexpected error occurred.",
        status: 0,
      },
    };
  }

  private async parseErrorBody(response: Response): Promise<{ code?: string; message?: string } | null> {
    try {
      const body = await response.json();
      if (body && typeof body === "object") {
        return {
          code: typeof body.code === "string" ? body.code : undefined,
          message: typeof body.message === "string" ? body.message : body.error?.message,
        };
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async get<T>(path: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...config, method: "GET" });
  }

  async post<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...config, method: "POST", body });
  }

  async put<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...config, method: "PUT", body });
  }

  async patch<T>(path: string, body?: unknown, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...config, method: "PATCH", body });
  }

  async delete<T>(path: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...config, method: "DELETE" });
  }

  async paginated<T>(
    path: string,
    config?: ApiRequestConfig & { page?: number; pageSize?: number }
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    return this.request<PaginatedResponse<T>>(path, {
      ...config,
      params: {
        ...config?.params,
        page: config?.page ?? 1,
        pageSize: config?.pageSize ?? 20,
      },
    });
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  return controller.signal;
}

export const apiClient = new ApiClient();
export type { ApiResponse, ApiError, PaginatedResponse, ApiRequestConfig };
