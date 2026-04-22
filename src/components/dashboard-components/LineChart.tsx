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

const LINE_COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#00b894'];

interface LineChartProps {
  config: ComponentConfig;
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#252532',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f0f0f5',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#a0a0b8' }} />
          {series.map((s, i) => (
            <Line
              key={s.fieldKey}
              type="monotone"
              dataKey={s.fieldKey}
              name={s.name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ fill: LINE_COLORS[i % LINE_COLORS.length], r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
