import React, { useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import { runAction } from '../../engine/runtimeUtils';
import type { ComponentConfig } from '../../types/template';
import { resolveBackground } from '../../utils/styleUtils';

const COLOR_SCHEMES = {
  Blue: ['#2563eb', '#3b82f6', '#60a5fa'],
  Green: ['#059669', '#10b981', '#6ee7b7'],
  Amber: ['#d97706', '#f59e0b', '#fbbf24'],
  Multi: ['#2563eb', '#059669', '#d97706', '#dc2626'],
};

const InteractivePie = Pie as unknown as React.ComponentType<any>;

function renderExpandedSlice(props: unknown) {
  const slice = props as {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
    fill: string;
  };

  return (
    <Sector
      cx={slice.cx}
      cy={slice.cy}
      innerRadius={slice.innerRadius}
      outerRadius={slice.outerRadius + 8}
      startAngle={slice.startAngle}
      endAngle={slice.endAngle}
      fill={slice.fill}
    />
  );
}

const PieChart = React.memo(function PieChart({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const chartData = Array.isArray(rawData) ? rawData : [];
  const nameKey = data.categoryKey || data.nameField || data.xField || 'label';
  const valueKey = data.valueField || data.yField || 'value';
  const palette = data.colors?.length
    ? data.colors
    : style.colors?.length
      ? style.colors
      : style.seriesColors?.length
        ? style.seriesColors
        : COLOR_SCHEMES[data.colorScheme || 'Blue'];
  const variant = data.variant || (data.donut ? 'donut' : 'default');
  const innerRadius = variant === 'donut' ? (style.innerRadius ?? 50) : 0;
  const showLegend = variant === 'minimal' ? false : data.showLegend !== false;
  const showTooltip = variant !== 'minimal';

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
            <InteractivePie
              data={chartData as Record<string, unknown>[]}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius="80%"
              innerRadius={innerRadius}
              label={data.showLabels === true}
              activeIndex={data.hoverExpand ? activeIndex : undefined}
              activeShape={data.hoverExpand ? renderExpandedSlice : undefined}
              onClick={(slice: Record<string, unknown>) => runAction(data.onSliceClickAction, slice)}
              onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={palette[index % palette.length]} />
              ))}
            </InteractivePie>
            {showTooltip ? <Tooltip /> : null}
            {showLegend ? <Legend /> : null}
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default PieChart;
