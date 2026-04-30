import React, { useMemo } from 'react';
import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

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
};

function resolveColor(label: string, fallback: string): string {
  const lower = label.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (lower.includes(key)) {
      return color;
    }
  }
  return fallback;
}

const StatusBadge = React.memo(function StatusBadge({ config }: StatusBadgeProps) {
  const { style, data, label } = config;
  
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const statusStr = typeof rawData === 'string' ? rawData : String(rawData ?? 'Unknown');
  const mapping = data.mapping || {};
  const badgeColor = mapping[statusStr] || resolveColor(statusStr, data.defaultColor || style.textColor || '#3b82f6');
  const size = data.size || 'Medium';

  return (
    <div
      className="status-badge-card"
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', bg);
          el.style.setProperty('--comp-border', style.borderColor ?? '');
          el.style.setProperty('--comp-text', style.textColor ?? '');
        }
      }}
      style={{
        background: 'var(--comp-bg)',
        fontFamily: style.fontFamily,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: 'var(--comp-border)',
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        padding: style.padding ? `${style.padding}px` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        overflow: 'hidden',
      }}
    >
      <span
        className="status-badge"
        style={{
          backgroundColor: `${badgeColor}18`,
          color: badgeColor,
          borderRadius: style.shape === 'Square' ? '4px' : style.shape === 'Rounded' ? '10px' : '999px',
          fontSize: size === 'Small' ? '10px' : size === 'Large' ? '14px' : '12px',
          padding: size === 'Small' ? '4px 10px' : size === 'Large' ? '8px 16px' : '6px 14px',
        }}
      >
        {data.showDot !== false ? <span className="status-dot" style={{ backgroundColor: badgeColor }} /> : null}
        {statusStr}
      </span>
      <div className="status-badge-label" style={{ color: `var(--comp-text)88`, flexShrink: 0 }}>
        {label}
      </div>
    </div>
  );
});

export default StatusBadge;
