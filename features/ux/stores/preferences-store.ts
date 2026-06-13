import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type LayoutMode = "full_width" | "split" | "dashboard" | "workspace";
export type DensityMode = "comfortable" | "compact";

export type UserPreferences = {
  theme: ThemeMode;
  layout: LayoutMode;
  density: DensityMode;
  sidebarCollapsed: boolean;
  tablePageSize: number;
  enableAnimations: boolean;
  enableKeyboardShortcuts: boolean;
  recentlyVisited: Array<{ path: string; label: string; timestamp: number }>;
};

type PreferencesStore = UserPreferences & {
  setTheme: (theme: ThemeMode) => void;
  setLayout: (layout: LayoutMode) => void;
  setDensity: (density: DensityMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTablePageSize: (size: number) => void;
  setEnableAnimations: (enabled: boolean) => void;
  setEnableKeyboardShortcuts: (enabled: boolean) => void;
  addRecentlyVisited: (path: string, label: string) => void;
  reset: () => void;
};

const defaults: UserPreferences = {
  theme: "system",
  layout: "full_width",
  density: "comfortable",
  sidebarCollapsed: false,
  tablePageSize: 25,
  enableAnimations: true,
  enableKeyboardShortcuts: true,
  recentlyVisited: []
};

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setDensity: (density) => set({ density }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTablePageSize: (tablePageSize) => set({ tablePageSize }),
      setEnableAnimations: (enableAnimations) => set({ enableAnimations }),
      setEnableKeyboardShortcuts: (enableKeyboardShortcuts) => set({ enableKeyboardShortcuts }),
      addRecentlyVisited: (path, label) => set((state) => {
        const filtered = state.recentlyVisited.filter((r) => r.path !== path);
        return {
          recentlyVisited: [{ path, label, timestamp: Date.now() }, ...filtered].slice(0, 10)
        };
      }),
      reset: () => set(defaults)
    }),
    { name: "ux-preferences" }
  )
);
