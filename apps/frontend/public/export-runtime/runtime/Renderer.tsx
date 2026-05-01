import React, { useMemo, useState } from 'react';
import { useAppState } from './StateManager';
import { resolveBindings } from './BindingResolver';

type ComponentConfig = {
  id: string;
  type: string;
  label?: string;
  visible?: string | boolean;
  parentId?: string;
  parentTab?: string;
  layout?: { x?: number; y?: number; w?: number; h?: number };
  style?: Record<string, any>;
  data?: Record<string, any>;
};

interface RendererProps {
  config: {
    components: ComponentConfig[];
  };
}

const COLOR_SCHEMES: Record<string, string[]> = {
  Blue: ['#2563eb', '#60a5fa', '#3b82f6'],
  Green: ['#059669', '#10b981', '#6ee7b7'],
  Amber: ['#d97706', '#f59e0b', '#fbbf24'],
  Multi: ['#2563eb', '#059669', '#d97706', '#dc2626'],
};

const getBackground = (style: Record<string, any>) => {
  const gradient = style.backgroundGradient;
  if (gradient?.enabled && Array.isArray(gradient.stops) && gradient.stops.length) {
    const stops = gradient.stops
      .map((stop: any) => `${stop.color} ${stop.position}%`)
      .join(', ');
    return `linear-gradient(${gradient.direction ?? 135}deg, ${stops})`;
  }
  return style.backgroundColor || '#ffffff';
};

const cardStyle = (style: Record<string, any>): React.CSSProperties => ({
  background: getBackground(style),
  color: style.textColor || '#111827',
  fontFamily: style.fontFamily,
  fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
  borderRadius: `${style.borderRadius ?? 12}px`,
  border: `${style.borderWidth ?? 1}px solid ${style.borderColor || '#e5e7eb'}`,
  padding: `${style.padding ?? 16}px`,
  height: '100%',
  width: '100%',
  boxSizing: 'border-box',
  overflow: 'hidden',
});

const rawValue = (config: ComponentConfig) => {
  const data = config.data || {};
  return data._resolvedBindings?.dbBinding ? data.dbBinding : data.mockValue;
};

const asRows = (value: unknown) => Array.isArray(value) ? value : [];

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function StatCard({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  const value = `${data.prefix ?? ''}${formatValue(rawValue(config))}${data.suffix ?? ''}`;
  const trendType = data.trendType || 'positive';
  const trendColor = style.trendColorOverride || (trendType === 'negative' ? '#dc2626' : trendType === 'neutral' ? '#6b7280' : '#059669');

  return (
    <div className="runtime-card" style={{ ...cardStyle(style), display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="runtime-muted" style={{ color: style.mutedColor || '#6b7280', fontSize: style.labelFontSize || 13, fontWeight: 700 }}>
        {config.label}
      </div>
      <div style={{ fontSize: style.metricFontSize || 30, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </div>
      {Array.isArray(data.sparklineData) ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 30 }}>
          {data.sparklineData.map((point: number, index: number) => (
            <span key={index} style={{ width: 8, height: Math.max(4, point), borderRadius: 999, background: trendColor, opacity: 0.75 }} />
          ))}
        </div>
      ) : null}
      {data.trend ? <div style={{ color: trendColor, fontSize: 13, fontWeight: 700 }}>{trendType === 'negative' ? '↓' : trendType === 'neutral' ? '-' : '↑'} {data.trend}</div> : null}
      {data.comparisonValue ? <div style={{ color: style.mutedColor || '#6b7280', fontSize: 12 }}>{data.comparisonValue}</div> : null}
    </div>
  );
}

function Table({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  const columns = data.columns || [];
  const rows = data.rows || asRows(rawValue(config));

  return (
    <div className="runtime-card" style={{ ...cardStyle(style), padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="runtime-card-title" style={{ padding: '12px 16px', fontWeight: 800, borderBottom: `1px solid ${style.borderColor || '#e5e7eb'}` }}>{config.label}</div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="runtime-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: style.headerBackgroundColor || '#f9fafb' }}>
            <tr>
              {columns.map((col: any) => (
                <th key={col.fieldKey} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12 }}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, rowIndex: number) => (
              <tr key={rowIndex} style={{ background: style.stripeRows && rowIndex % 2 ? style.rowAlternateColor || '#f9fafb' : undefined }}>
                {columns.map((col: any) => (
                  <td key={col.fieldKey} style={{ padding: '10px 14px', borderTop: `1px solid ${style.borderColor || '#eef2f7'}`, fontSize: 13 }}>
                    {formatValue(row?.[col.fieldKey])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleChart({ config, kind }: { config: ComponentConfig; kind: 'bar' | 'line' }) {
  const style = config.style || {};
  const data = config.data || {};
  const rows = asRows(rawValue(config));
  const yKey = data.yField || data.series?.[0]?.fieldKey || 'value';
  const xKey = data.xField || 'label';
  const values = rows.map((row: any) => Number(row?.[yKey]) || 0);
  const max = Math.max(...values, 1);
  const palette = style.seriesColors?.length ? style.seriesColors : COLOR_SCHEMES[data.colorScheme || 'Blue'];
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 100 - (value / max) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="runtime-card" style={{ ...cardStyle(style), display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="runtime-card-title" style={{ fontWeight: 800 }}>{config.label}</div>
      <div style={{ flex: 1, minHeight: 120, display: 'flex', alignItems: 'end', gap: 8 }}>
        {kind === 'bar' ? rows.map((row: any, index: number) => (
          <div key={index} title={`${row?.[xKey] ?? index}: ${values[index]}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: '100%', height: `${Math.max(4, (values[index] / max) * 100)}%`, minHeight: 4, borderRadius: `${style.barRadius ?? 6}px ${style.barRadius ?? 6}px 0 0`, background: palette[index % palette.length] }} />
            <span style={{ fontSize: 10, color: style.axisColor || '#6b7280', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatValue(row?.[xKey])}</span>
          </div>
        )) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <polyline fill={data.fillArea ? `${palette[0]}22` : 'none'} stroke={palette[0]} strokeWidth={style.lineWidth || 2} points={points} />
            {data.showDots !== false && values.map((_, index) => {
              const [cx, cy] = points.split(' ')[index].split(',');
              return <circle key={index} cx={cx} cy={cy} r="1.8" fill={palette[0]} />;
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  const status = formatValue(rawValue(config));
  const color = data.mapping?.[status] || data.defaultColor || style.textColor || '#2563eb';
  return (
    <div className="runtime-card" style={{ ...cardStyle(style), display: 'grid', placeItems: 'center', gap: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${color}18`, color, borderRadius: style.shape === 'Square' ? 4 : 999, padding: '7px 14px', fontWeight: 800 }}>
        {data.showDot !== false ? <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} /> : null}
        {status}
      </span>
      <span className="runtime-muted" style={{ color: style.mutedColor || '#6b7280', fontSize: 12 }}>{config.label}</span>
    </div>
  );
}

function Button({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  return (
    <button
      disabled={String(data.disabled) === 'true'}
      onClick={() => data.linkTo ? window.location.assign(data.linkTo) : undefined}
      style={{
        ...cardStyle(style),
        cursor: 'pointer',
        background: style.backgroundColor || '#2563eb',
        color: style.textColor || '#ffffff',
        fontWeight: 800,
      }}
      className="runtime-card"
    >
      {data.label || config.label}
    </button>
  );
}

function LogsViewer({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const logs = asRows(rawValue(config));
  const data = config.data || {};
  const visibleLogs = logs.slice(0, data.maxLines ?? 200);

  return (
    <div className="runtime-card" style={{ ...cardStyle(style), fontFamily: style.fontFamily || 'Consolas, monospace', display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="runtime-card-title" style={{ padding: '10px 12px', borderBottom: `1px solid ${style.borderColor || '#e5e7eb'}`, fontWeight: 800 }}>{config.label || 'Logs'}</div>
      <div style={{ overflow: 'auto', padding: 12, whiteSpace: data.wrapLines ? 'pre-wrap' : 'pre', fontSize: style.fontSize || 12 }}>
        {visibleLogs.length ? visibleLogs.map((entry, index) => <div key={index}>{typeof entry === 'object' ? JSON.stringify(entry) : String(entry)}</div>) : 'Waiting for output...'}
      </div>
    </div>
  );
}

function Text({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  return (
    <div className="runtime-card" style={{
      ...cardStyle(style),
      textAlign: String(style.textAlign || 'Left').toLowerCase() as any,
      lineHeight: style.lineHeight || 1.5,
      whiteSpace: style.overflow === 'Wrap' ? 'pre-wrap' : 'nowrap',
      textOverflow: style.overflow === 'Truncate' ? 'ellipsis' : undefined,
    }}>
      {formatValue(rawValue(config) ?? data.label ?? config.label)}
    </div>
  );
}

function TextInput({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  return (
    <label className="runtime-card" style={{ ...cardStyle(style), display: 'flex', flexDirection: 'column', gap: 8 }}>
      {style.labelPosition !== 'Hidden' ? <span style={{ fontWeight: 700 }}>{data.label || config.label}</span> : null}
      <input className="runtime-input" placeholder={data.placeholder} defaultValue={formatValue(rawValue(config) === '-' ? '' : rawValue(config))} style={{ padding: 10, borderRadius: 8, border: `1px solid ${style.borderColor || '#d1d5db'}` }} />
    </label>
  );
}

function NumberInput({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  return (
    <label className="runtime-card" style={{ ...cardStyle(style), display: 'flex', flexDirection: 'column', gap: 8 }}>
      {style.labelPosition !== 'Hidden' ? <span style={{ fontWeight: 700 }}>{data.label || config.label}</span> : null}
      <input className="runtime-input" type="number" min={data.min} max={data.max} step={data.step} defaultValue={String(rawValue(config) ?? '')} style={{ padding: 10, borderRadius: 8, border: `1px solid ${style.borderColor || '#d1d5db'}` }} />
    </label>
  );
}

function Select({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  const options = data.optionsList || (data.options || []).map((option: string) => ({ label: option, value: option }));
  return (
    <label className="runtime-card" style={{ ...cardStyle(style), display: 'flex', flexDirection: 'column', gap: 8 }}>
      {style.labelPosition !== 'Hidden' ? <span style={{ fontWeight: 700 }}>{data.label || config.label}</span> : null}
      <select className="runtime-select" defaultValue={String(rawValue(config) ?? '')} style={{ padding: 10, borderRadius: 8, border: `1px solid ${style.borderColor || '#d1d5db'}` }}>
        {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ImageComponent({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  return (
    <div className="runtime-card" style={{ ...cardStyle(style), padding: 0 }}>
      <img src={data.uploadedSrc || data.src} alt={data.alt || config.label || ''} style={{ width: '100%', height: '100%', objectFit: data.fit || 'cover', display: 'block' }} />
    </div>
  );
}

function Embed({ config }: { config: ComponentConfig }) {
  const style = config.style || {};
  const data = config.data || {};
  const src = data.src || data.linkTo || data.mockValue;
  return (
    <div className="runtime-card" style={{ ...cardStyle(style), padding: 0 }}>
      <iframe src={src} title={config.label || 'Embed'} style={{ width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}

const COMPONENT_MAP: Record<string, React.FC<{ config: ComponentConfig; children?: React.ReactNode }>> = {
  StatCard,
  Table,
  BarChart: (props) => <SimpleChart {...props} kind="bar" />,
  LineChart: (props) => <SimpleChart {...props} kind="line" />,
  StatusBadge,
  Button,
  LogsViewer,
  Text,
  TextInput,
  NumberInput,
  Select,
  Image: ImageComponent,
  Embed,
};

function ComponentShell({ config, children }: { config: ComponentConfig; children: React.ReactNode }) {
  const layout = config.layout || { x: 0, y: 0, w: 4, h: 4 };
  return (
    <div
      className="runtime-component-shell"
      style={{
        gridColumn: `${(layout.x ?? 0) + 1} / span ${layout.w ?? 4}`,
        gridRow: `${(layout.y ?? 0) + 1} / span ${layout.h ?? 4}`,
        minHeight: Math.max(80, (layout.h ?? 4) * 30),
      }}
    >
      {children}
    </div>
  );
}

function ComponentGrid({ components, parentId = 'root', parentTab }: { components: ComponentConfig[]; parentId?: string; parentTab?: string }) {
  const filtered = components.filter((component) => {
    if (parentId === 'root') return !component.parentId;
    return component.parentId === parentId && (!parentTab || component.parentTab === parentTab);
  });

  return (
    <div
      className="runtime-canvas"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridAutoRows: '30px',
        gap: 10,
        minHeight: parentId === 'root' ? 'calc(100vh - 120px)' : '100%',
      }}
    >
      {filtered.map((component) => (
        <RenderedComponent key={component.id} component={component} components={components} />
      ))}
    </div>
  );
}

function Container({ config, components }: { config: ComponentConfig; components: ComponentConfig[] }) {
  const style = config.style || {};
  return (
    <div className="runtime-card" style={{ ...cardStyle(style), padding: style.padding ?? 12 }}>
      <ComponentGrid components={components} parentId={config.id} />
    </div>
  );
}

function TabbedContainer({ config, components }: { config: ComponentConfig; components: ComponentConfig[] }) {
  const style = config.style || {};
  const data = config.data || {};
  const tabs = data.tabs?.length ? data.tabs : ['Tab 1'];
  const [activeTab, setActiveTab] = useState(data.defaultTab || tabs[0]);

  return (
    <div className="runtime-card" style={{ ...cardStyle(style), padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: `1px solid ${style.tabHeaderBorderColor || style.borderColor || '#e5e7eb'}`, background: style.tabHeaderBackground }}>
        {tabs.map((tab: string) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            border: 0,
            borderRadius: 8,
            padding: '7px 12px',
            cursor: 'pointer',
            background: activeTab === tab ? style.tabHeaderActiveBackground || '#111827' : 'transparent',
            color: activeTab === tab ? style.tabHeaderActiveTextColor || '#ffffff' : style.tabHeaderTextColor || style.textColor || '#111827',
            fontWeight: 700,
          }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: 10 }}>
        <ComponentGrid components={components} parentId={config.id} parentTab={activeTab} />
      </div>
    </div>
  );
}

function RenderedComponent({ component, components }: { component: ComponentConfig; components: ComponentConfig[] }) {
  const visible = component.visible ?? component.data?.visible ?? true;
  if (String(visible) === 'false') return null;

  if (component.type === 'Container') {
    return <ComponentShell config={component}><Container config={component} components={components} /></ComponentShell>;
  }

  if (component.type === 'TabbedContainer') {
    return <ComponentShell config={component}><TabbedContainer config={component} components={components} /></ComponentShell>;
  }

  const Component = COMPONENT_MAP[component.type];
  if (!Component) {
    return <ComponentShell config={component}><div className="runtime-card" style={cardStyle(component.style || {})}>Unknown component: {component.type}</div></ComponentShell>;
  }

  return <ComponentShell config={component}><Component config={component} /></ComponentShell>;
}

const Renderer: React.FC<RendererProps> = ({ config }) => {
  const { getGlobalState } = useAppState();
  const state = getGlobalState();

  const components = useMemo(() => {
    return (config.components || []).map((component) => ({
      ...component,
      data: resolveBindings(component.data || {}, state),
    }));
  }, [config.components, state]);

  return (
    <main style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <ComponentGrid components={components} />
      {components.length === 0 ? (
        <div className="runtime-empty" style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>
          No components were found in this export.
        </div>
      ) : null}
    </main>
  );
};

export default Renderer;
