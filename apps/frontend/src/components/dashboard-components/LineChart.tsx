
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ComponentConfig } from '../../types/template';

const LINE_COLORS = ['#2563eb', '#60a5fa', '#3b82f6', '#f59e0b', '#059669'];

interface LineChartProps {
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

export default function LineChart({ config }: LineChartProps) {
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
          <RechartsLineChart data={chartData as Record<string, unknown>[]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '10px', fontFamily: 'DM Sans', color: '#9ba3af' }}
              iconType="circle"
              iconSize={6}
            />
            {activeSeries.map((s, i) => (
              <Line
                key={s.fieldKey}
                type="monotone"
                dataKey={s.fieldKey}
                name={s.name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: LINE_COLORS[i % LINE_COLORS.length], r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 2, fill: '#ffffff' }}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
