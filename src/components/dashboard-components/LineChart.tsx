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

const LINE_COLORS = ['#6c5ce7', '#00cec9', '#a855f7', '#fdcb6e', '#00b894'];

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
  const chartData = Array.isArray(data.mockValue) ? data.mockValue : [];
  const series = data.series || [{ name: 'Value', fieldKey: 'value' }];

  const seriesKeys = new Set(series.map((s) => s.fieldKey));
  const firstRow = chartData[0] as Record<string, unknown> | undefined;
  const xKey = firstRow
    ? Object.keys(firstRow).find((k) => !seriesKeys.has(k) && typeof firstRow[k] === 'string') || 'label'
    : 'label';

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
      }}
    >
      <div className="chart-component-title" style={{ color: style.textColor }}>{label}</div>
      <ResponsiveContainer width="100%" height={240}>
        <RechartsLineChart data={chartData as Record<string, unknown>[]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#8888a8', fontSize: 10, fontFamily: 'DM Sans' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8888a8', fontSize: 10, fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '10px', fontFamily: 'DM Sans', color: '#8888a8' }}
            iconType="circle"
            iconSize={6}
          />
          {series.map((s, i) => (
            <Line
              key={s.fieldKey}
              type="monotone"
              dataKey={s.fieldKey}
              name={s.name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ fill: LINE_COLORS[i % LINE_COLORS.length], r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 2, fill: '#0f0f14' }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
