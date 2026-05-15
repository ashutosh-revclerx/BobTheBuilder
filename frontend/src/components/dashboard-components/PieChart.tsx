import React, { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { runAction } from '../../engine/runtimeUtils';
import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

const COLOR_SCHEMES = {
  Blue: ['#2563eb', '#3b82f6', '#60a5fa'],
  Green: ['#059669', '#10b981', '#6ee7b7'],
  Amber: ['#d97706', '#f59e0b', '#fbbf24'],
  Multi: ['#2563eb', '#059669', '#d97706', '#dc2626'],
};

const PieChart = React.memo(function PieChart({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const chartData = Array.isArray(rawData) ? rawData : [];
  const nameKey = data.nameField || data.xField || 'label';
  const valueKey = data.valueField || data.yField || 'value';
  const palette = style.seriesColors?.length ? style.seriesColors : COLOR_SCHEMES[data.colorScheme || 'Blue'];
  const innerRadius = data.donut ? (style.innerRadius ?? 50) : 0;

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
      <div style={{ flex: 1, minHeight: 120, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData as Record<string, unknown>[]}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius={innerRadius}
              label={data.showLabels === true}
              onClick={(slice) => runAction(data.onSliceClickAction, slice)}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip />
            {data.showLegend !== false ? <Legend /> : null}
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default PieChart;
