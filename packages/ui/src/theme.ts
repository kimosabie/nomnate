// Shared design tokens — use these in both web (Tailwind CSS vars) and mobile (StyleSheet)

export const colors = {
  primary: "#FF6B35",      // Warm orange — appetite-stimulating
  primaryDark: "#E55A24",
  primaryLight: "#FF8C5A",

  love: "#E91E63",         // Pink — ❤️ vote
  up: "#4CAF50",           // Green — 👍 vote
  down: "#9E9E9E",         // Grey — 👎 vote

  background: "#FAFAF8",
  surface: "#FFFFFF",
  border: "#EBEBEB",

  text: {
    primary: "#1A1A1A",
    secondary: "#6B6B6B",
    muted: "#AEAEAE",
    inverse: "#FFFFFF",
  },

  status: {
    suggested: "#FF9800",
    voted: "#2196F3",
    confirmed: "#4CAF50",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
} as const;

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;
