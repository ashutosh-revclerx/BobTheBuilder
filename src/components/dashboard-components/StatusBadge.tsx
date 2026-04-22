import type { ComponentConfig } from '../../types/template';

interface StatusBadgeProps {
  config: ComponentConfig;
}

export default function StatusBadge({ config }: StatusBadgeProps) {
  const { style, data, label } = config;
  const value = typeof data.mockValue === 'string' ? data.mockValue : String(data.mockValue ?? '—');
  const badgeColor = style.textColor || '#00b894';

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
        flexDirection: 'column',
        gap: '8px',
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
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: badgeColor,
            display: 'inline-block',
          }}
        />
        {value}
      </span>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          color: `${style.textColor || '#a0a0b8'}88`,
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  );
}
