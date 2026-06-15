import { useAppStore } from "@/state/app/app-store";
import { syncEngine } from "./sync-engine";
import { DEFAULT_OFFLINE_CONFIG } from "./types";

type NetworkCallback = (isOnline: boolean) => void;

let NetInfoModule: any = null;

async function getNetInfo() {
  if (NetInfoModule) return NetInfoModule;
  try {
    NetInfoModule = await import("@react-native-community/netinfo");
    return NetInfoModule;
  } catch {
    console.warn("[NetworkMonitor] @react-native-community/netinfo not available");
    return null;
  }
}

class NetworkMonitor {
  private unsubscribe: (() => void) | null = null;
  private callbacks: Set<NetworkCallback> = new Set();
  private isOnline = true;

  async start(): Promise<void> {
    const mod = await getNetInfo();
    if (!mod) {
      this.isOnline = true;
      useAppStore.getState().setOnline(true);
      return;
    }

    const defaultExport = mod.default;
    if (defaultExport?.addEventListener) {
      this.unsubscribe = defaultExport.addEventListener(this.handleNetworkChange);
    }
    try {
      const state = await defaultExport?.fetch();
      this.isOnline = state?.isConnected ?? true;
      useAppStore.getState().setOnline(this.isOnline);
    } catch {
      this.isOnline = true;
      useAppStore.getState().setOnline(true);
    }
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  onNetworkChange(callback: NetworkCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  private handleNetworkChange = (state: any): void => {
    const isOnline = state?.isConnected ?? true;
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    useAppStore.getState().setOnline(isOnline);
    this.callbacks.forEach((cb) => cb(isOnline));

    if (wasOffline && isOnline && DEFAULT_OFFLINE_CONFIG.syncOnReconnect) {
      syncEngine.sync().catch(() => {});
    }
  };
}

export const networkMonitor = new NetworkMonitor();
