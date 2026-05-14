/**
 * Utility to convert hex to RGBA with specific opacity.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export interface ThemePalette {
  name: string;
  surface: string;
  panel: string;
  primary: string;
  text: string;
  border: string;
}

export interface ResolvedTheme extends ThemePalette {
  card_tint: string;
  chart_tint: string;
  table_tint: string;
  input_tint: string;
  success: string;
  warning: string;
  error: string;
  primary_text: string;
}

export const THEME_REGISTRY: Record<string, ThemePalette> = {
  Cobalt: {
    name: 'Cobalt',
    surface: '#f0f4f8',
    panel: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    border: '#cbd5e1',
  },
  Forest: {
    name: 'Forest',
    surface: '#f0faf4',
    panel: '#ffffff',
    primary: '#16a34a',
    text: '#052e16',
    border: '#bbf7d0',
  },
  Graphite: {
    name: 'Graphite',
    surface: '#080e1a',
    panel: '#0d1424',
    primary: '#22d3ee',
    text: '#e2e8f0',
    border: '#1e2d42',
  },
  Amber: {
    name: 'Amber',
    surface: '#fefce8',
    panel: '#fffef5',
    primary: '#b45309',
    text: '#292524',
    border: '#fde68a',
  },
  Obsidian: {
    name: 'Obsidian',
    surface: '#09090b',
    panel: '#0f0f12',
    primary: '#6366f1',
    text: '#fafafa',
    border: '#27272a',
  },
  Aurora: {
    name: 'Aurora',
    surface: '#f5f3ff',
    panel: '#ffffff',
    primary: '#7c3aed',
    text: '#1e1b4b',
    border: '#ddd6fe',
  },
  Ocean: {
    name: 'Ocean',
    surface: '#f0f9ff',
    panel: '#ffffff',
    primary: '#0284c7',
    text: '#0c4a6e',
    border: '#bae6fd',
  },
  Rose: {
    name: 'Rose',
    surface: '#fff1f2',
    panel: '#ffffff',
    primary: '#e11d48',
    text: '#4c0519',
    border: '#fecdd3',
  },
  'Slate Light': {
    name: 'Slate Light',
    surface: '#f8fafc',
    panel: '#ffffff',
    primary: '#475569',
    text: '#0f172a',
    border: '#e2e8f0',
  },
  'Midnight Blue': {
    name: 'Midnight Blue',
    surface: '#020617',
    panel: '#0f172a',
    primary: '#3b82f6',
    text: '#e2e8f0',
    border: '#1e293b',
  },
  'Neon Dark': {
    name: 'Neon Dark',
    surface: '#020617',
    panel: '#020617',
    primary: '#22c55e',
    text: '#e5e7eb',
    border: '#16a34a',
  },
  Sand: {
    name: 'Sand',
    surface: '#fdf6ec',
    panel: '#ffffff',
    primary: '#d97706',
    text: '#292524',
    border: '#fcd9a8',
  },
  'Cyber Purple': {
    name: 'Cyber Purple',
    surface: '#0a0a1f',
    panel: '#12122b',
    primary: '#8b5cf6',
    text: '#f3f4f6',
    border: '#312e81',
  },
};

export type ThemeName = keyof typeof THEME_REGISTRY;

export function resolveTheme(name: ThemeName): ResolvedTheme | null {
  const base = THEME_REGISTRY[name];
  if (!base) return null;

  // Simple heuristic for dark themes: if the surface is very dark
  const isDark = base.surface.startsWith('#0') || base.surface.startsWith('#1');

  // Simple contrast check for primary text (white or dark)
  // Neon green, cyan, etc need dark text.
  const isPrimaryLight = ['#22c55e', '#22d3ee', '#fcd9a8', '#fde68a'].includes(base.primary.toLowerCase());

  return {
    ...base,
    card_tint: hexToRgba(base.primary, 0.08),
    chart_tint: hexToRgba(base.primary, 0.2),
    table_tint: hexToRgba(base.primary, 0.05),
    input_tint: hexToRgba(base.primary, 0.12),
    // Status colors adjusted for brightness
    success: isDark ? '#4ade80' : '#047857',
    warning: isDark ? '#fbbf24' : '#92400e',
    error:   isDark ? '#f87171' : '#b91c1c',
    primary_text: isPrimaryLight ? '#0f172a' : '#ffffff',
  };
}
