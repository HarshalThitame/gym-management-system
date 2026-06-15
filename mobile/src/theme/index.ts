import type { ColorSet } from "./colors";
import { darkColors, lightColors } from "./colors";
import { spacing, radii, shadows, breakpoints } from "./spacing";
import { typography, fontFamily, fontWeight, letterSpacing, lineHeight } from "./typography";

export interface Theme {
  dark: boolean;
  colors: ColorSet;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  fontWeight: typeof fontWeight;
  letterSpacing: typeof letterSpacing;
  lineHeight: typeof lineHeight;
  breakpoints: typeof breakpoints;
}

export function createTheme(isDark: boolean, overrides?: Partial<ColorSet>): Theme {
  const colors = isDark ? { ...darkColors } : { ...lightColors };

  if (overrides) {
    Object.assign(colors, overrides);
  }

  return {
    dark: isDark,
    colors,
    spacing,
    radii,
    shadows,
    typography,
    fontFamily,
    fontWeight,
    letterSpacing,
    lineHeight,
    breakpoints,
  };
}

export const darkTheme = createTheme(true);
export const lightTheme = createTheme(false);

export {
  darkColors,
  lightColors,
  spacing,
  radii,
  shadows,
  typography,
  fontFamily,
  fontWeight,
  letterSpacing,
  lineHeight,
  breakpoints,
};

export type { ColorSet };
