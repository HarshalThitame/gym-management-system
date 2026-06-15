import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useAppStore } from "@/state/app/app-store";
import type { Theme } from "./index";
import { createTheme, darkTheme, lightTheme } from "./index";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  tenantColors?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
  } | null;
}

export function ThemeProvider({ children, tenantColors }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const themePreference = useAppStore((s) => s.theme);

  const isDark = useMemo(() => {
    if (themePreference === "system") {
      return systemColorScheme === "dark";
    }
    return themePreference === "dark";
  }, [themePreference, systemColorScheme]);

  const value = useMemo(() => {
    if (tenantColors?.primaryColor || tenantColors?.secondaryColor || tenantColors?.accentColor) {
      const base = isDark ? darkTheme : lightTheme;
      const theme = createTheme(isDark, {
        primary: tenantColors.primaryColor ?? base.colors.primary,
        secondary: tenantColors.secondaryColor ?? base.colors.secondary,
        accent: tenantColors.accentColor ?? base.colors.accent,
      });
      return { theme, isDark };
    }

    return {
      theme: isDark ? darkTheme : lightTheme,
      isDark,
    };
  }, [isDark, tenantColors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
