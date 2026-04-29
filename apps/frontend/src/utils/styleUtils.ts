import type { ComponentStyle } from '../types/template';

/**
 * Resolves the background CSS property from a component's style object.
 * Handles both solid colors and gradients.
 */
export function resolveBackground(style: ComponentStyle | undefined): string {
  if (!style) return 'transparent';

  const gradient = style.backgroundGradient;

  if (gradient?.enabled && gradient.stops && gradient.stops.length >= 2) {
    const direction = gradient.direction ?? 90;
    const stops = gradient.stops
      .map((stop) => `${stop.color} ${stop.position ?? 0}%`)
      .join(', ');
    return `linear-gradient(${direction}deg, ${stops})`;
  }

  return style.backgroundColor ?? 'transparent';
}

export const GRADIENT_DIRECTIONS = [
  { label: 'R', name: 'Right', deg: 90 },
  { label: 'UR', name: 'Up-Right', deg: 45 },
  { label: 'U', name: 'Up', deg: 0 },
  { label: 'UL', name: 'Up-Left', deg: 315 },
  { label: 'L', name: 'Left', deg: 270 },
  { label: 'DL', name: 'Down-Left', deg: 225 },
  { label: 'D', name: 'Down', deg: 180 },
  { label: 'DR', name: 'Down-Right', deg: 135 },
] as const;

export function getDirectionName(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const preset = GRADIENT_DIRECTIONS.find((d) => d.deg === normalized);
  return preset?.label ?? 'R';
}
