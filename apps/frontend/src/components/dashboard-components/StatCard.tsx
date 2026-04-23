import type { ComponentConfig } from '../../types/template';

interface StatCardProps {
  config: ComponentConfig;
}

const STAT_ICONS: Record<string, string> = {
  budget: '💰',
  projects: '📁',
  rate: '📈',
  team: '👥',
  revenue: '💎',
  cost: '🏷️',
  default: '📊',
};

function pickIcon(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, icon] of Object.entries(STAT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return STAT_ICONS.default;
}

export default function StatCard({ config }: StatCardProps) {
  const { style, data, label } = config;
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const value = typeof rawData === 'string' ? rawData : String(rawData ?? '—');

  const trendValue = data.trend || null;
  const trendType = data.trendType || 'positive';
  const isPositive = trendType === 'positive';
  const isNeutral = trendType === 'neutral';

  return (
    <div
      className="stat-card"
      style={{
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        padding: style.padding ? `${style.padding}px` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div className="stat-card-top" style={{ flexShrink: 0 }}>
        <div className="stat-card-label" style={{ color: style.textColor ? `${style.textColor}88` : undefined }}>
          {label}
        </div>
        <div className="stat-card-icon">
          {pickIcon(label)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div className="stat-card-value">
          {value}
        </div>
      </div>
      {trendValue && (
        <span className={`stat-card-delta ${isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative')}`}>
          {isNeutral ? '—' : (isPositive ? '↑' : '↓')} {trendValue}
        </span>
      )}
    </div>
  );
}
