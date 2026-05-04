import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { QueryConfig } from '@btb/shared';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { runAction } from '../../engine/runtimeUtils';
import QueryErrorBanner from '../ui/QueryErrorBanner';
import { resolveBackground } from '../../utils/styleUtils';

const COLOR_SCHEMES = {
  Blue: ['#2563eb', '#3b82f6', '#60a5fa'],
  Green: ['#059669', '#10b981', '#6ee7b7'],
  Amber: ['#d97706', '#f59e0b', '#fbbf24'],
  Multi: ['#2563eb', '#059669', '#d97706', '#dc2626'],
};

function useChartSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setSize((prev) => prev.width === width && prev.height === height ? prev : { width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="item">
          <span className="dot" style={{ background: entry.color }} />
          {entry.name}: {entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

const BarChart = React.memo(function BarChart({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const queryName = parseQueryName(data.dbBinding);
  const queryState = queryName ? queryResults[queryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === queryName) as QueryConfig | undefined;
  
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const chartData = Array.isArray(rawData) ? rawData : [];
  const series = data.series || [{ name: 'Value', fieldKey: 'value' }];
  const activeSeries = data.yField ? [{ name: 'Value', fieldKey: data.yField }] : series;
  const palette = style.seriesColors?.length ? style.seriesColors : COLOR_SCHEMES[data.colorScheme || 'Blue'];
  const xKey = data.xField || 'label';
  const isHorizontal = data.orientation === 'Horizontal';
  const chartRef = useRef<HTMLDivElement>(null);
  const chartSize = useChartSize(chartRef);
  const canRenderChart = chartSize.width > 0 && chartSize.height > 0;

  return (
    <div
      className="chart-component"
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
      }}
    >
      <div className="chart-component-title" style={{ color: 'var(--comp-text)' }}>{label}</div>
      <div ref={chartRef} style={{ flex: 1, minHeight: 120, width: '100%' }}>
        {queryState?.status === 'error' && queryConfig ? (
          <div className="dashboard-query-error-wrap">
            <QueryErrorBanner queryName={queryConfig.name} error={queryState.error || ''} onRetry={() => executeQuery(queryConfig)} />
          </div>
        ) : canRenderChart ? (
            <RechartsBarChart 
              width={chartSize.width}
              height={chartSize.height}
              data={chartData as Record<string, unknown>[]} 
              layout={isHorizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
            >
              {data.showGrid !== false ? (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={style.gridColor || "rgba(0,0,0,0.06)"} 
                  vertical={!isHorizontal} 
                />
              ) : null}
              <XAxis 
                dataKey={isHorizontal ? undefined : xKey} 
                type={isHorizontal ? 'number' : 'category'} 
                hide={data.showXAxis === false}
                tick={{ fontSize: style.fontSize || 12, fill: style.xAxisColor || style.axisColor || '#4b5563' }}
                stroke={style.xAxisColor || style.axisColor || '#e5e7eb'}
              >
                {data.xAxisLabel && (
                  <Label 
                    value={data.xAxisLabel} 
                    position="insideBottom" 
                    offset={-5} 
                    style={{ fontSize: style.fontSize || 12, fill: style.xAxisColor || style.axisColor || '#4b5563', fontWeight: 500 }}
                  />
                )}
              </XAxis>
              <YAxis 
                dataKey={isHorizontal ? xKey : undefined} 
                type={isHorizontal ? 'category' : 'number'} 
                hide={data.showYAxis === false}
                tick={{ fontSize: style.fontSize || 12, fill: style.yAxisColor || style.axisColor || '#4b5563' }}
                stroke={style.yAxisColor || style.axisColor || '#e5e7eb'}
              >
                {data.yAxisLabel && (
                  <Label 
                    value={data.yAxisLabel} 
                    angle={-90} 
                    position="insideLeft" 
                    style={{ fontSize: style.fontSize || 12, fill: style.yAxisColor || style.axisColor || '#4b5563', fontWeight: 500, textAnchor: 'middle' }}
                  />
                )}
              </YAxis>
              <Tooltip 
                content={<CustomTooltip />} 
                contentStyle={{ fontSize: style.fontSize || 12 }}
              />
              {data.showLegend !== false ? (
                <Legend wrapperStyle={{ fontSize: style.fontSize || 12 }} />
              ) : null}
              {activeSeries.map((seriesItem, index) => (
                <Bar
                  key={seriesItem.fieldKey}
                  dataKey={seriesItem.fieldKey}
                  name={seriesItem.name}
                  fill={palette[index % palette.length]}
                  radius={isHorizontal ? [0, style.barRadius || 4, style.barRadius || 4, 0] : [style.barRadius || 4, style.barRadius || 4, 0, 0]}
                  stackId={data.stacked ? 'stack' : undefined}
                  onClick={(entry) => runAction(data.onBarClickAction, entry)}
                >
                  {style.showDataLabels ? (
                    <LabelList 
                      dataKey={seriesItem.fieldKey} 
                      position={isHorizontal ? 'right' : 'top'} 
                      style={{ fontSize: style.fontSize || 11, fill: style.textColor || '#4b5563' }}
                    />
                  ) : null}
                  {chartData.map((_, cellIndex) => (
                    <Cell key={cellIndex} fill={palette[cellIndex % palette.length]} />
                  ))}
                </Bar>
              ))}
            </RechartsBarChart>
        ) : (
          <div style={{ height: '100%', minHeight: 120 }} />
        )}
      </div>
    </div>
  );
});

export default BarChart;
