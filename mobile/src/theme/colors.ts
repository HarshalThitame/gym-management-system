export interface ColorSet {
  bg: string;
  bgMuted: string;
  bgSurface: string;
  bgSurfaceMuted: string;
  fg: string;
  fgMuted: string;
  border: string;
  borderMuted: string;
  primary: string;
  primaryFg: string;
  primaryMuted: string;
  secondary: string;
  secondaryFg: string;
  secondaryMuted: string;
  accent: string;
  accentFg: string;
  accentMuted: string;
  danger: string;
  dangerFg: string;
  dangerMuted: string;
  warning: string;
  warningFg: string;
  warningMuted: string;
  success: string;
  successFg: string;
  successMuted: string;
  info: string;
  infoFg: string;
  infoMuted: string;
}

export const darkColors: ColorSet = {
  bg: "#070809",
  bgMuted: "#0d0e10",
  bgSurface: "#111214",
  bgSurfaceMuted: "#18191d",
  fg: "#e8e9ea",
  fgMuted: "#8b8d92",
  border: "#222429",
  borderMuted: "#18191d",
  primary: "#FF6B35",
  primaryFg: "#ffffff",
  primaryMuted: "rgba(255, 107, 53, 0.15)",
  secondary: "#222429",
  secondaryFg: "#e8e9ea",
  secondaryMuted: "#2a2c32",
  accent: "#ffffff",
  accentFg: "#070809",
  accentMuted: "rgba(255, 255, 255, 0.1)",
  danger: "#ef4444",
  dangerFg: "#ffffff",
  dangerMuted: "rgba(239, 68, 68, 0.15)",
  warning: "#f59e0b",
  warningFg: "#070809",
  warningMuted: "rgba(245, 158, 11, 0.15)",
  success: "#22c55e",
  successFg: "#070809",
  successMuted: "rgba(34, 197, 94, 0.15)",
  info: "#3b82f6",
  infoFg: "#ffffff",
  infoMuted: "rgba(59, 130, 246, 0.15)",
};

export const lightColors: ColorSet = {
  bg: "#f8f7f2",
  bgMuted: "#efeee9",
  bgSurface: "#ffffff",
  bgSurfaceMuted: "#f5f4ef",
  fg: "#1a1a1a",
  fgMuted: "#6b6b6b",
  border: "#e5e4df",
  borderMuted: "#efeee9",
  primary: "#FF6B35",
  primaryFg: "#ffffff",
  primaryMuted: "rgba(255, 107, 53, 0.1)",
  secondary: "#e5e4df",
  secondaryFg: "#1a1a1a",
  secondaryMuted: "#d8d7d2",
  accent: "#1a1a1a",
  accentFg: "#ffffff",
  accentMuted: "rgba(26, 26, 26, 0.1)",
  danger: "#dc2626",
  dangerFg: "#ffffff",
  dangerMuted: "rgba(220, 38, 38, 0.1)",
  warning: "#d97706",
  warningFg: "#ffffff",
  warningMuted: "rgba(217, 119, 6, 0.1)",
  success: "#16a34a",
  successFg: "#ffffff",
  successMuted: "rgba(22, 163, 74, 0.1)",
  info: "#2563eb",
  infoFg: "#ffffff",
  infoMuted: "rgba(37, 99, 235, 0.1)",
};
