import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

let SecureStoreModule: any = null;

async function getSecureStore() {
  if (SecureStoreModule) return SecureStoreModule;
  try {
    SecureStoreModule = await import("expo-secure-store");
    return SecureStoreModule;
  } catch {
    console.warn("[SecureStorage] expo-secure-store not available, using memory store");
    return null;
  }
}

const KEYS = {
  AUTH_TOKEN: "apex_auth_token",
  REFRESH_TOKEN: "apex_refresh_token",
  SESSION_DATA: "apex_session_data",
  USER_PROFILE: "apex_user_profile",
  DEVICE_TOKEN: "apex_device_token",
  PUSH_SUBSCRIPTION: "apex_push_subscription",
  THEME_PREFERENCE: "apex_theme_preference",
  TENANT_CONTEXT: "apex_tenant_context",
  OFFLINE_QUEUE: "apex_offline_queue",
} as const;

type StorageKey = (typeof KEYS)[keyof typeof KEYS];

class SecureStorageService {
  private memoryStore = new Map<string, string>();
  private initPromise: Promise<any> | null = null;

  private async ensureModule(): Promise<any> {
    if (!this.initPromise) {
      this.initPromise = getSecureStore();
    }
    return this.initPromise;
  }

  async get(key: StorageKey): Promise<string | null> {
    try {
      const mod = await this.ensureModule();
      if (mod) {
        return await mod.getItemAsync(key);
      }
      return this.memoryStore.get(key) ?? null;
    } catch {
      return this.memoryStore.get(key) ?? null;
    }
  }

  async set(key: StorageKey, value: string): Promise<void> {
    try {
      const mod = await this.ensureModule();
      if (mod) {
        await mod.setItemAsync(key, value);
        return;
      }
      this.memoryStore.set(key, value);
    } catch {
      this.memoryStore.set(key, value);
    }
  }

  async delete(key: StorageKey): Promise<void> {
    try {
      const mod = await this.ensureModule();
      if (mod) {
        await mod.deleteItemAsync(key);
        return;
      }
      this.memoryStore.delete(key);
    } catch {
      this.memoryStore.delete(key);
    }
  }

  async clear(): Promise<void> {
    const keys = Object.values(KEYS);
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async getJSON<T>(key: StorageKey): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed as T;
    } catch {
      await this.delete(key).catch(() => {});
      return null;
    }
  }

  async setJSON<T>(key: StorageKey, value: T): Promise<void> {
    try {
      await this.set(key, JSON.stringify(value));
    } catch {}
  }
}

export const secureStorage = new SecureStorageService();
export const STORAGE_KEYS = KEYS;
