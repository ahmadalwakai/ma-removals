// MA Removals — Design Tokens
// Single source of truth for all brand colors, fonts, spacing

export const colors = {
  midnight: "#0B1120",
  emerald: "#2563EB",
  amber: "#F59E0B",
  crimson: "#EF4444",
  slate: "#F1F5F9",
  surface: "#FFFFFF",
  ink: "#1E293B",
  muted: "#64748B",
  cheapGreen: "#2563EB",
  midYellow: "#D97706",
  expensiveRed: "#DC2626",
} as const;

export type ColorToken = keyof typeof colors;

export const fontFamilies = {
  heading: "'Plus Jakarta Sans', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const borderRadius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  full: "9999px",
} as const;

export const shadows = {
  card: "0 1px 3px rgba(11,17,32,0.08), 0 1px 2px rgba(11,17,32,0.04), 0 0 14px rgba(37,99,235,0.10)",
  cardHover: "0 10px 25px rgba(11,17,32,0.12), 0 4px 8px rgba(11,17,32,0.06), 0 0 22px rgba(37,99,235,0.14)",
  emerald: "0 4px 20px rgba(37,99,235,0.25)",
  amber: "0 4px 20px rgba(245,158,11,0.30)",
} as const;
