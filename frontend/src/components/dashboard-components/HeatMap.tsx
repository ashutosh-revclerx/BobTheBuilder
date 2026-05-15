import React, { useMemo } from 'react';
import { runAction } from '../../engine/runtimeUtils';
import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const intValue = Number.parseInt(value, 16);
  return [(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255];
}

function interpolateColor(start: string, end: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(start);
  const [r2, g2, b2] = hexToRgb(end);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

const HeatMap = React.memo(function HeatMap({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const cells = Array.isArray(rawData) ? rawData : [];

  const xField = data.xField || 'x';
  const yField = data.yField || 'y';
  const valueField = data.valueField || 'value';

  const xBuckets = Array.from(new Set(cells.map((row) => String((row as any)?.[xField] ?? ''))));
  const yBuckets = Array.from(new Set(cells.map((row) => String((row as any)?.[yField] ?? ''))));
  const byCoord = new Map(cells.map((row) => [`${String((row as any)?.[xField] ?? '')}::${String((row as any)?.[yField] ?? '')}`, row]));

  const values = cells
    .map((row) => Number((row as any)?.[valueField]))
    .filter((value) => Number.isFinite(value));
  const minValue = data.minValue ?? (values.length ? Math.min(...values) : 0);
  const maxValue = data.maxValue ?? (values.length ? Math.max(...values) : 100);
  const valueRange = Math.max(maxValue - minValue, 1);

  const minCellColor = style.minCellColor || '#dbeafe';
  const maxCellColor = style.maxCellColor || '#1d4ed8';
  const emptyCellColor = style.emptyCellColor || '#f3f4f6';
  const gap = style.cellGap ?? 4;

  return (
    <div
      className="chart-component"
      ref={(el) => {
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
      }}
    >
      <div className="chart-component-title" style={{ color: 'var(--comp-text)' }}>{label}</div>
      <div style={{ flex: 1, minHeight: 120, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${xBuckets.length}, minmax(60px, 1fr))`,
            gap,
            alignItems: 'stretch',
          }}
        >
          <div />
          {xBuckets.map((x) => (
            <div key={`x-${x}`} style={{ fontSize: 11, color: style.textColor || '#475569', textAlign: 'center' }}>{x}</div>
          ))}
          {yBuckets.map((y) => (
            <React.Fragment key={`row-${y}`}>
              <div style={{ fontSize: 11, color: style.textColor || '#475569', alignSelf: 'center' }}>{y}</div>
              {xBuckets.map((x) => {
                const item = byCoord.get(`${x}::${y}`) as Record<string, unknown> | undefined;
                const value = Number(item?.[valueField]);
                const isValid = Number.isFinite(value);
                const ratio = isValid ? Math.max(0, Math.min(1, (value - minValue) / valueRange)) : 0;
                const color = isValid ? interpolateColor(minCellColor, maxCellColor, ratio) : emptyCellColor;
                return (
                  <button
                    key={`cell-${x}-${y}`}
                    title={`${y} · ${x}: ${isValid ? value : 'N/A'}`}
                    onClick={() => runAction(data.onCellClickAction, item || { [xField]: x, [yField]: y, [valueField]: null })}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      background: color,
                      color: ratio > 0.6 ? '#ffffff' : '#0f172a',
                      minHeight: 44,
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    {data.showCellLabels ? (isValid ? value : '-') : ''}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

export default HeatMap;
