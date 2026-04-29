import {
  BarChart as RechartsBarChart,
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
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

export default function BarChart({ config }: { config: ComponentConfig }) {
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
  const isHorizontal = data.orientation === 'Horizontal';

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
            <RechartsBarChart data={chartData as Record<string, unknown>[]} layout={isHorizontal ? 'vertical' : 'horizontal'}>
              {data.showGrid !== false ? <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={!isHorizontal} /> : null}
              <XAxis dataKey={isHorizontal ? undefined : xKey} type={isHorizontal ? 'number' : 'category'} />
              <YAxis dataKey={isHorizontal ? xKey : undefined} type={isHorizontal ? 'category' : 'number'} />
              <Tooltip content={<CustomTooltip />} />
              {data.showLegend !== false ? <Legend /> : null}
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
                  {style.showDataLabels ? <LabelList dataKey={seriesItem.fieldKey} position={isHorizontal ? 'right' : 'top'} /> : null}
                  {chartData.map((_, cellIndex) => (
                    <Cell key={cellIndex} fill={palette[cellIndex % palette.length]} />
                  ))}
                </Bar>
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
