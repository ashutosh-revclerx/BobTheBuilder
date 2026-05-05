import React, { useMemo } from 'react';
import type { ComponentConfig } from '../../types/template';
import type { QueryConfig } from '@btb/shared';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import QueryErrorBanner from '../ui/QueryErrorBanner';
import { resolveBackground } from '../../utils/styleUtils';

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

const StatCard = React.memo(function StatCard({ config }: StatCardProps) {
  const { style, data, label } = config;
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const queryName = parseQueryName(data.dbBinding);
  const queryState = queryName ? queryResults[queryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === queryName) as QueryConfig | undefined;
  
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const value = `${data.prefix ?? ''}${typeof rawData === 'string' ? rawData : String(rawData ?? '—')}${data.suffix ?? ''}`;
  
  const trendValue = data._resolvedBindings?.trend ?? data.trend ?? null;
  const trendType = data._resolvedBindings?.trendType ?? data.trendType ?? 'positive';
  const sparklineData = (data._resolvedBindings?.sparklineData ?? data.sparklineData ?? []) as number[];

  const isPositive = trendType === 'positive';
  const isNeutral = trendType === 'neutral';
  const trendColor = style.trendColorOverride || (isNeutral ? '#4b5563' : isPositive ? '#047857' : '#b91c1c');

  return (
    <div
      className="stat-card"
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
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderColor: 'var(--comp-border)',
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        padding: style.padding ? `${style.padding}px` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="stat-card-top" style={{ flexShrink: 0 }}>
        <div className="stat-card-label" style={{ color: style.textColor ? `${style.textColor}bb` : '#4b5563' }}>
          {label}
        </div>
        <div className="stat-card-icon">{pickIcon(label)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '8px' }}>
        {queryState?.status === 'error' && queryConfig ? (
          <QueryErrorBanner compact queryName={queryConfig.name} error={queryState.error || ''} onRetry={() => executeQuery(queryConfig)} />
        ) : (
          <>
            <div className="stat-card-value" style={{ fontSize: `${style.metricFontSize || 28}px`, color: 'var(--comp-text)' }}>
              {value}
            </div>
            {sparklineData.length ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '32px' }}>
                {sparklineData.map((point, index) => (
                  <span
                    key={`${point}-${index}`}
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: `${Math.max(4, point)}px`,
                      borderRadius: '999px',
                      backgroundColor: trendColor,
                      opacity: 0.6 + (index / (sparklineData.length || 1)) * 0.4,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      {trendValue && (
        <span className={`stat-card-delta ${isNeutral ? 'neutral' : isPositive ? 'positive' : 'negative'}`} style={{ color: trendColor }}>
          {isNeutral ? '—' : isPositive ? '↑' : '↓'} {trendValue}
        </span>
      )}
      {data.comparisonValue ? <div style={{ color: '#4b5563', fontSize: '12px', marginTop: '6px' }}>{data.comparisonValue}</div> : null}
    </div>
  );
});

export default StatCard;
