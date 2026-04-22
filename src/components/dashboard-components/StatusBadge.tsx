import type { ComponentConfig } from '../../types/template';

interface StatusBadgeProps {
  config: ComponentConfig;
}

const STATUS_COLORS: Record<string, string> = {
  success: '#00b894',
  done: '#00b894',
  completed: '#00b894',
  active: '#00b894',
  danger: '#ff6b6b',
  blocked: '#ff6b6b',
  error: '#ff6b6b',
  critical: '#ff6b6b',
  warning: '#fdcb6e',
  'in progress': '#6c5ce7',
  'to do': '#8888a8',
  pending: '#8888a8',
  default: '#00cec9',
};

function resolveColor(label: string, fallback: string): string {
  const lower = label.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return fallback;
}

export default function StatusBadge({ config }: StatusBadgeProps) {
  const { style, data, label } = config;
  const value = typeof data.mockValue === 'string' ? data.mockValue : String(data.mockValue ?? '—');
  const badgeColor = resolveColor(label, style.textColor || '#00cec9');

  return (
    <div
      className="status-badge-card"
      style={{
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        padding: style.padding ? `${style.padding}px` : undefined,
      }}
    >
      <span
        className="status-badge"
        style={{
          backgroundColor: `${badgeColor}18`,
          color: badgeColor,
        }}
      >
        <span
          className="status-dot"
          style={{ backgroundColor: badgeColor }}
        />
        {value}
      </span>
      <div
        className="status-badge-label"
        style={{ color: `${style.textColor || '#8888a8'}88` }}
      >
        {label}
      </div>
    </div>
  );
}
