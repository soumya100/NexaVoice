export const palette = {
  // Brand Primary (Vibrant Royal Indigo / Electric Violet)
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Secondary Accent (Neon Cyan / Electric Teal for Realtime & Calling)
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  // AI Brand Accent (Ethereal Purple & Magenta Gradient Spark)
  ai: {
    purple: '#8b5cf6',
    magenta: '#d946ef',
    glow: 'rgba(168, 85, 247, 0.35)',
    glowActive: 'rgba(217, 70, 239, 0.5)',
  },
  // Success (Vibrant Emerald)
  success: {
    50: '#ecfdf5',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
  },
  // Warning (Warm Amber)
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  // Danger / Call End (Ruby Rose)
  danger: {
    50: '#fff1f2',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
  },
  // Neutral Slate
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
} as const;

export const darkTheme = {
  bg: {
    canvas: '#090d16',
    surface: '#0f172a',
    surfaceElevated: '#172033',
    surfaceGlass: 'rgba(15, 23, 42, 0.75)',
    border: '#1e293b',
    borderMuted: '#172033',
    borderFocus: '#6366f1',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#94a3b8',
    muted: '#64748b',
    inverse: '#090d16',
  },
  status: {
    online: '#10b981',
    inCall: '#06b6d4',
    busy: '#f59e0b',
    offline: '#64748b',
    aiActive: '#d946ef',
  },
} as const;

export const lightTheme = {
  bg: {
    canvas: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    surfaceGlass: 'rgba(255, 255, 255, 0.85)',
    border: '#e2e8f0',
    borderMuted: '#f1f5f9',
    borderFocus: '#4f46e5',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
    inverse: '#f8fafc',
  },
  status: {
    online: '#059669',
    inCall: '#0891b2',
    busy: '#d97706',
    offline: '#94a3b8',
    aiActive: '#9333ea',
  },
} as const;
