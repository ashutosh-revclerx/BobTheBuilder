import type { ComponentConfig } from '../../types/template';

interface StatCardProps {
  config: ComponentConfig;
}

export default function StatCard({ config }: StatCardProps) {
  const { style, data, label } = config;
  const value = typeof data.mockValue === 'string' ? data.mockValue : String(data.mockValue ?? '—');

  // Determine delta indicator (mock: randomly positive/negative based on value)
  const hasNumeric = /[\d]/.test(value);
  const deltaValue = hasNumeric ? '+12.5%' : null;
  const deltaPositive = true;

  return (
    <div
      className="stat-card"
      style={{
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        padding: style.padding ? `${style.padding}px` : undefined,
      }}
    >
      <div className="stat-card-label" style={{ color: style.textColor ? `${style.textColor}99` : undefined }}>
        {label}
      </div>
      <div className="stat-card-value" style={{ color: style.textColor }}>
        {value}
      </div>
      {deltaValue && (
        <span className={`stat-card-delta ${deltaPositive ? 'positive' : 'negative'}`}>
          {deltaPositive ? '↑' : '↓'} {deltaValue}
        </span>
      )}
    </div>
  );
}
