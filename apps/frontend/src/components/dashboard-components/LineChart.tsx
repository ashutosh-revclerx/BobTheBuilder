import { Fragment } from 'react';
import type { QueryConfig } from '@btb/shared';
import {
  Area,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName, runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import QueryErrorBanner from '../ui/QueryErrorBanner';
import { resolveBackground } from '../../utils/styleUtils';

const COLOR_SCHEMES = {
  Blue: ['#2563eb', '#60a5fa', '#3b82f6'],
  Green: ['#059669', '#10b981', '#6ee7b7'],
  Amber: ['#d97706', '#f59e0b', '#fbbf24'],
  Multi: ['#2563eb', '#059669', '#d97706', '#dc2626'],
};

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

export default function LineChart({ config }: { config: ComponentConfig }) {
  const { style, data, label } = config;
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const queryName = parseQueryName(data.dbBinding);
  const queryState = queryName ? queryResults[queryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === queryName) as QueryConfig | undefined;
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const chartData = Array.isArray(rawData) ? rawData : [];
  const series = data.series || [{ name: 'Value', fieldKey: 'value' }];
  const activeSeries = data.yField ? [{ name: 'Value', fieldKey: data.yField }] : series;
  const palette = style.seriesColors?.length ? style.seriesColors : COLOR_SCHEMES[data.colorScheme || 'Blue'];
  const xKey = data.xField || 'label';

  return (
    <div
      className="chart-component"
      style={{
        background: resolveBackground(style),
        fontFamily: style.fontFamily,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        padding: style.padding ? `${style.padding}px` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="chart-component-title" style={{ color: style.textColor }}>{label}</div>
      <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
        {queryState?.status === 'error' && queryConfig ? (
          <div className="dashboard-query-error-wrap">
            <QueryErrorBanner queryName={queryConfig.name} error={queryState.error || ''} onRetry={() => executeQuery(queryConfig)} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={chartData as Record<string, unknown>[]}>
              {data.showGrid !== false ? <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} /> : null}
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend !== false ? <Legend /> : null}
              {activeSeries.map((seriesItem, index) => (
                <Fragment key={seriesItem.fieldKey}>
                  {data.fillArea ? <Area key={`${seriesItem.fieldKey}-area`} dataKey={seriesItem.fieldKey} fill={palette[index % palette.length]} stroke="none" fillOpacity={0.12} /> : null}
                  <Line
                    type={data.smooth !== false ? 'monotone' : 'linear'}
                    dataKey={seriesItem.fieldKey}
                    name={seriesItem.name}
                    stroke={palette[index % palette.length]}
                    strokeWidth={style.lineWidth || 2}
                    dot={data.showDots !== false}
                    activeDot={{
                      r: 5,
                      stroke: palette[index % palette.length],
                      strokeWidth: 2,
                      fill: '#ffffff',
                      onClick: (event) => runAction(data.onPointClickAction, event),
                    }}
                  >
                    {style.showDataLabels ? <LabelList dataKey={seriesItem.fieldKey} position="top" /> : null}
                  </Line>
                </Fragment>
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
