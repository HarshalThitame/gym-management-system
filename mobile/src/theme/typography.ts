import type { TextStyle } from "react-native";

const fontFamily = {
  sans: undefined, // Uses system default (SF Pro on iOS, Roboto on Android)
  mono: undefined,
};

const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  black: "900" as const,
};

const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 1.5,
};

const lineHeight = {
  none: 1,
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

export const typography: Record<string, TextStyle> = {
  h1: {
    fontSize: 32,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.tight,
    lineHeight: 38,
  },
  h2: {
    fontSize: 28,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.tight,
    lineHeight: 34,
  },
  h3: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.normal,
    lineHeight: 30,
  },
  h4: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.normal,
    lineHeight: 26,
  },
  h5: {
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.wide,
    lineHeight: 16,
  },
  overline: {
    fontSize: 11,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.widest,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  button: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wider,
    lineHeight: 20,
  },
  buttonSmall: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wider,
    lineHeight: 18,
  },
  stat: {
    fontSize: 36,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.tight,
    lineHeight: 42,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: fontWeight.black,
    letterSpacing: letterSpacing.wider,
    lineHeight: 16,
    textTransform: "uppercase",
  },
};

export { fontFamily, fontWeight, letterSpacing, lineHeight };
