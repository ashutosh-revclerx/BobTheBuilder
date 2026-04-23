import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ComponentConfig } from '../../types/template';

const CHART_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#f59e0b', '#059669'];

interface BarChartProps {
  config: ComponentConfig;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="item">
          <span className="dot" style={{ background: entry.color }} />
          {entry.name}: {entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function BarChart({ config }: BarChartProps) {
  const { style, data, label } = config;
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const chartData = Array.isArray(rawData) ? rawData : [];
  
  const series = data.series || [{ name: 'Value', fieldKey: 'value' }];
  const activeSeries = data.yField ? [{ name: 'Value', fieldKey: data.yField }] : series;
  const seriesKeys = new Set(activeSeries.map((s) => s.fieldKey));
  
  const firstRow = chartData[0] as Record<string, unknown> | undefined;
  const xKey = data.xField || (firstRow
    ? Object.keys(firstRow).find((k) => !seriesKeys.has(k) && typeof firstRow[k] === 'string') || 'label'
    : 'label');

  return (
    <div
      className="chart-component"
      style={{
        backgroundColor: style.backgroundColor,
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
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData as Record<string, unknown>[]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: '#9ba3af', fontSize: 10, fontFamily: 'DM Sans' }}
              axisLine={{ stroke: 'rgba(0,0,0,0.06)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#9ba3af', fontSize: 10, fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
            <Legend
              wrapperStyle={{ fontSize: '10px', fontFamily: 'DM Sans', color: '#9ba3af' }}
              iconType="circle"
              iconSize={6}
            />
            {activeSeries.map((s, i) => (
              <Bar
                key={s.fieldKey}
                dataKey={s.fieldKey}
                name={s.name}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
