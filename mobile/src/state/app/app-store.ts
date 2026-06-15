import { create } from "zustand";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";

interface AppStoreState {
  isOnline: boolean;
  isSyncing: boolean;
  theme: "system" | "light" | "dark";
  currentTheme: "light" | "dark";

  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setTheme: (theme: "system" | "light" | "dark") => void;
  setCurrentTheme: (theme: "light" | "dark") => void;
  loadPreferences: () => Promise<void>;
}

export const useAppStore = create<AppStoreState>((set) => ({
  isOnline: true,
  isSyncing: false,
  theme: "system",
  currentTheme: "dark",

  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),

  setTheme: async (theme) => {
    set({ theme });
    await secureStorage.set(STORAGE_KEYS.THEME_PREFERENCE, theme);
  },

  setCurrentTheme: (currentTheme) => set({ currentTheme }),

  loadPreferences: async () => {
    const stored = await secureStorage.get(STORAGE_KEYS.THEME_PREFERENCE);
    if (stored && ["system", "light", "dark"].includes(stored)) {
      set({ theme: stored as "system" | "light" | "dark" });
    }
  },
}));
