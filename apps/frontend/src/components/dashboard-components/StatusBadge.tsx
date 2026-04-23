import type { ComponentConfig } from '../../types/template';

interface StatusBadgeProps {
  config: ComponentConfig;
}

const STATUS_COLORS: Record<string, string> = {
  success: '#059669',
  done: '#059669',
  completed: '#059669',
  active: '#059669',
  danger: '#dc2626',
  blocked: '#dc2626',
  error: '#dc2626',
  critical: '#dc2626',
  warning: '#d97706',
  'in progress': '#2563eb',
  'to do': '#9ba3af',
  pending: '#9ba3af',
  default: '#3b82f6',
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
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const statusStr = typeof rawData === 'string' ? rawData : String(rawData ?? 'Unknown');

  const mapping = data.mapping || {};
  const badgeColor = mapping[statusStr] || resolveColor(statusStr, style.textColor || '#3b82f6');

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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        overflow: 'hidden'
      }}
    >
      <span
        className="status-badge"
        style={{
          backgroundColor: `${badgeColor}18`,
          color: badgeColor,
          flexShrink: 0
        }}
      >
        <span
          className="status-dot"
          style={{ backgroundColor: badgeColor }}
        />
        {statusStr}
      </span>
      <div
        className="status-badge-label"
        style={{ color: `${style.textColor || '#9ba3af'}88`, flexShrink: 0 }}
      >
        {label}
      </div>
    </div>
  );
}
