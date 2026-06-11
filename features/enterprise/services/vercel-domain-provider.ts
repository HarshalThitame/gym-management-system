import type { Json } from "@/types/database";

export type VercelDomainProviderAction = "add" | "sync" | "verify" | "remove";

export type VercelDomainProviderConfig = {
  configured: boolean;
  missing: string[];
  projectIdOrName: string | null;
  teamId: string | null;
};

export type VercelDomainProviderResult = {
  action: VercelDomainProviderAction;
  domain: string;
  projectIdOrName: string;
  teamId: string | null;
  projectDomain: Json | null;
  domainConfiguration: Json | null;
  response: Json;
};

export class VercelDomainProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly response: Json | null
  ) {
    super(message);
    this.name = "VercelDomainProviderError";
  }
}

const vercelApiBaseUrl = "https://api.vercel.com";

export function getVercelDomainProviderConfig(): VercelDomainProviderConfig {
  const projectIdOrName = firstEnv("VERCEL_PROJECT_ID_OR_NAME", "VERCEL_PROJECT_ID", "VERCEL_PROJECT_NAME");
  const teamId = firstEnv("VERCEL_TEAM_ID", "VERCEL_ORG_ID");
  const token = getVercelApiToken();
  const missing = [
    token ? null : "VERCEL_API_TOKEN",
    projectIdOrName ? null : "VERCEL_PROJECT_ID_OR_NAME"
  ].filter(Boolean) as string[];

  return {
    configured: missing.length === 0,
    missing,
    projectIdOrName,
    teamId
  };
}

export function getVercelApiToken() {
  return firstEnv("VERCEL_API_TOKEN", "VERCEL_TOKEN");
}

export async function addVercelProjectDomain(domain: string): Promise<VercelDomainProviderResult> {
  const config = requireVercelDomainProviderConfig();
  let addResponse: Json;

  try {
    addResponse = await vercelFetch<Json>(projectDomainPath(config, "/domains"), {
      method: "POST",
      body: JSON.stringify({ name: domain })
    });
  } catch (error) {
    if (!isExistingDomainError(error)) {
      throw error;
    }
    addResponse = error.response ?? { code: error.code, status: error.status, reusedExistingDomain: true };
  }

  const [projectDomain, domainConfiguration] = await Promise.all([
    getVercelProjectDomain(domain, config),
    getVercelDomainConfiguration(domain, config)
  ]);

  return {
    action: "add",
    domain,
    projectIdOrName: config.projectIdOrName,
    teamId: config.teamId,
    projectDomain,
    domainConfiguration,
    response: addResponse
  };
}

export async function syncVercelProjectDomain(domain: string): Promise<VercelDomainProviderResult> {
  const config = requireVercelDomainProviderConfig();
  const [projectDomain, domainConfiguration] = await Promise.all([
    getVercelProjectDomain(domain, config),
    getVercelDomainConfiguration(domain, config)
  ]);

  return {
    action: "sync",
    domain,
    projectIdOrName: config.projectIdOrName,
    teamId: config.teamId,
    projectDomain,
    domainConfiguration,
    response: { projectDomain, domainConfiguration }
  };
}

export async function verifyVercelProjectDomain(domain: string): Promise<VercelDomainProviderResult> {
  const config = requireVercelDomainProviderConfig();
  const verifyResponse = await vercelFetch<Json>(projectDomainPath(config, `/domains/${encodeURIComponent(domain)}/verify`), {
    method: "POST"
  });
  const [projectDomain, domainConfiguration] = await Promise.all([
    getVercelProjectDomain(domain, config),
    getVercelDomainConfiguration(domain, config)
  ]);

  return {
    action: "verify",
    domain,
    projectIdOrName: config.projectIdOrName,
    teamId: config.teamId,
    projectDomain,
    domainConfiguration,
    response: verifyResponse
  };
}

export async function removeVercelProjectDomain(domain: string): Promise<VercelDomainProviderResult> {
  const config = requireVercelDomainProviderConfig();
  const response = await vercelFetch<Json>(projectDomainPath(config, `/domains/${encodeURIComponent(domain)}`), {
    method: "DELETE"
  });

  return {
    action: "remove",
    domain,
    projectIdOrName: config.projectIdOrName,
    teamId: config.teamId,
    projectDomain: null,
    domainConfiguration: null,
    response
  };
}

export function getVercelProviderReadinessMessage(config = getVercelDomainProviderConfig()) {
  if (config.configured) {
    return "Vercel provider automation is configured.";
  }

  return `Add ${config.missing.join(" and ")} to Vercel production environment variables to enable provider automation.`;
}

async function getVercelProjectDomain(domain: string, config: RequiredProjectConfig) {
  return vercelFetch<Json>(projectDomainPath(config, `/domains/${encodeURIComponent(domain)}`), {
    method: "GET"
  });
}

async function getVercelDomainConfiguration(domain: string, config: RequiredProjectConfig) {
  const params = new URLSearchParams({ projectIdOrName: config.projectIdOrName });
  if (config.teamId) {
    params.set("teamId", config.teamId);
  }
  return vercelFetch<Json>(`/v6/domains/${encodeURIComponent(domain)}/config?${params.toString()}`, {
    method: "GET"
  });
}

type RequiredProjectConfig = {
  projectIdOrName: string;
  teamId: string | null;
};

function requireVercelDomainProviderConfig(): RequiredProjectConfig {
  const config = getVercelDomainProviderConfig();
  if (!config.configured || !config.projectIdOrName) {
    throw new VercelDomainProviderError(getVercelProviderReadinessMessage(config), 503, "PROVIDER_NOT_CONFIGURED", {
      missing: config.missing,
      projectIdOrName: config.projectIdOrName,
      teamId: config.teamId
    });
  }

  return {
    projectIdOrName: config.projectIdOrName,
    teamId: config.teamId
  };
}

function projectDomainPath(config: RequiredProjectConfig, path: string) {
  const params = new URLSearchParams();
  if (config.teamId) {
    params.set("teamId", config.teamId);
  }

  const query = params.toString();
  return `/v10/projects/${encodeURIComponent(config.projectIdOrName)}${path}${query ? `?${query}` : ""}`;
}

async function vercelFetch<T extends Json>(path: string, init: RequestInit): Promise<T> {
  const token = getVercelApiToken();
  if (!token) {
    throw new VercelDomainProviderError("Vercel API token is not configured.", 503, "PROVIDER_NOT_CONFIGURED", null);
  }

  const response = await fetch(`${vercelApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    },
    cache: "no-store"
  });
  const body = await readJsonResponse(response);

  if (!response.ok) {
    const error = extractVercelError(body);
    throw new VercelDomainProviderError(error.message, response.status, error.code, body);
  }

  return body as T;
}

async function readJsonResponse(response: Response): Promise<Json> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Json;
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

function extractVercelError(body: Json) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const error = "error" in body && body.error && typeof body.error === "object" && !Array.isArray(body.error) ? body.error : body;
    const message = "message" in error && typeof error.message === "string" ? error.message : "Vercel domain provider request failed.";
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    return { message, code };
  }

  return {
    message: "Vercel domain provider request failed.",
    code: null
  };
}

function isExistingDomainError(error: unknown): error is VercelDomainProviderError {
  if (!(error instanceof VercelDomainProviderError)) {
    return false;
  }

  const code = (error.code ?? "").toLowerCase();
  const message = error.message.toLowerCase();
  return error.status === 409 || code.includes("already") || message.includes("already");
}

function firstEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}
