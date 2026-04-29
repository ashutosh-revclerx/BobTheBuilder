import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentStyle } from '../../types/template';
import { resolveBackground, GRADIENT_DIRECTIONS } from '../../utils/styleUtils';

// ─── Option lists ─────────────────────────────────────────────────────────────

const PADDING_OPTIONS     = [4, 8, 12, 16, 20, 24];
const VALUE_SIZES         = [24, 32, 40, 48];
const LABEL_SIZES         = [10, 12, 14];
const BORDER_RADIUSES     = [0, 2, 4, 6, 8, 10, 12, 16, 24];
const BORDER_WIDTHS       = [0, 1, 2, 4, 6, 8];
const LINE_HEIGHTS        = [1.2, 1.4, 1.6, 1.8];
const FONT_WEIGHT_OPTIONS = [
  { label: 'Normal', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Bold',   value: 700 },
];
const TEXT_TRANSFORM_OPTIONS = [
  { label: 'None',       value: 'none'       as const },
  { label: 'Uppercase',  value: 'uppercase'  as const },
  { label: 'Capitalize', value: 'capitalize' as const },
];
const LOG_FONT_OPTIONS = ['Fira Code', 'JetBrains Mono', 'Courier New'];
const MAX_SERIES_COLORS = 5;
const DEFAULT_GRADIENT_STOPS = [
  { color: '#3b82f6', position: 0 },
  { color: '#8b5cf6', position: 100 },
];

const THEME_PRESETS = [
  { name: 'Cobalt',   surface: '#f0f4f8', panel: '#ffffff',  primary: '#2563eb' },
  { name: 'Forest',   surface: '#f0faf4', panel: '#ffffff',  primary: '#16a34a' },
  { name: 'Graphite', surface: '#080e1a', panel: '#0d1424',  primary: '#22d3ee' },
  { name: 'Amber',    surface: '#fefce8', panel: '#fffef5',  primary: '#b45309' },
  { name: 'Obsidian', surface: '#09090b', panel: '#0f0f12',  primary: '#6366f1' },
];

// ─── Small reusable field controls ───────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label}>
      <div className="color-picker-group">
        <input
          type="color"
          className="color-swatch-input"
          value={value.startsWith('#') ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="color-hex-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
        />
      </div>
    </FormField>
  );
}


function OptionGroup<T extends number | string>({
  label,
  options,
  value,
  renderLabel,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  renderLabel?: (opt: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <FormField label={label}>
      <div className="option-group">
        {options.map((opt) => (
          <button
            key={String(opt)}
            className={`option-button ${value === opt ? 'active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {renderLabel ? renderLabel(opt) : String(opt)}
          </button>
        ))}
      </div>
    </FormField>
  );
}

// ─── Gradient sub-section ─────────────────────────────────────────────────────

function GradientEditor({
  style,
  onChange,
}: {
  style: ComponentStyle;
  onChange: (key: keyof ComponentStyle, value: unknown) => void;
}) {
  const gradient = style.backgroundGradient ?? {
    enabled: false,
    direction: 90,
    stops: DEFAULT_GRADIENT_STOPS,
  };
  const isOn = !!gradient.enabled;

  const update = (patch: Partial<typeof gradient>) => {
    onChange('backgroundGradient', { ...gradient, ...patch });
  };

  const toggleGradient = (on: boolean) => {
    update({ enabled: on });
    if (on) onChange('backgroundColor', 'transparent');
  };

  const setStop = (i: number, patch: Partial<{ color: string; position: number }>) => {
    const stops = gradient.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    update({ stops });
  };

  const addStop = () => {
    if (gradient.stops.length >= 4) return;
    update({ stops: [...gradient.stops, { color: '#94a3b8', position: 50 }] });
  };

  const removeStop = (i: number) => {
    if (gradient.stops.length <= 2) return;
    update({ stops: gradient.stops.filter((_, idx) => idx !== i) });
  };

  const previewStyle: ComponentStyle = { ...style, backgroundGradient: { ...gradient, enabled: true } };

  return (
    <div className="form-group">
      <label className="form-label">Background</label>

      {/* Solid / Gradient toggle */}
      <div className="option-group" style={{ marginBottom: '8px' }}>
        <button
          className={`option-button ${!isOn ? 'active' : ''}`}
          onClick={() => toggleGradient(false)}
        >
          Solid
        </button>
        <button
          className={`option-button ${isOn ? 'active' : ''}`}
          onClick={() => toggleGradient(true)}
        >
          Gradient
        </button>
      </div>

      {!isOn ? (
        <div className="color-picker-group">
          <input
            type="color"
            className="color-swatch-input"
            value={(style.backgroundColor ?? '#ffffff').startsWith('#') ? (style.backgroundColor ?? '#ffffff') : '#ffffff'}
            onChange={(e) => onChange('backgroundColor', e.target.value)}
          />
          <input
            type="text"
            className="color-hex-input"
            value={style.backgroundColor ?? '#ffffff'}
            onChange={(e) => onChange('backgroundColor', e.target.value)}
            placeholder="#ffffff"
          />
        </div>
      ) : (
        <div className="gradient-editor">
          {/* Live preview bar */}
          <div
            className="gradient-preview-bar"
            style={{ background: resolveBackground(previewStyle) }}
          />

          {/* Direction picker */}
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="form-label">Direction</label>
            <div className="gradient-direction-grid">
              {GRADIENT_DIRECTIONS.map((d) => (
                <button
                  key={d.deg}
                  className={`gradient-dir-btn ${gradient.direction === d.deg ? 'active' : ''}`}
                  title={d.name}
                  onClick={() => update({ direction: d.deg })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color stops */}
          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="form-label">Color Stops</label>
            {gradient.stops.map((stop, i) => (
              <div key={i} className="gradient-stop-row">
                <input
                  type="color"
                  className="color-swatch-input"
                  value={stop.color.startsWith('#') ? stop.color : '#3b82f6'}
                  onChange={(e) => setStop(i, { color: e.target.value })}
                />
                <input
                  type="range"
                  className="slider-input"
                  min={0}
                  max={100}
                  value={stop.position}
                  onChange={(e) => setStop(i, { position: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span className="slider-value" style={{ minWidth: '32px' }}>{stop.position}%</span>
                {gradient.stops.length > 2 && (
                  <button
                    className="gradient-stop-remove"
                    onClick={() => removeStop(i)}
                    title="Remove stop"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {gradient.stops.length < 4 && (
              <button className="gradient-add-stop" onClick={addStop}>
                + Add stop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ThemeTab ────────────────────────────────────────────────────────────

export default function ThemeTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components              = useEditorStore((s) => s.components);
  const updateStyle             = useEditorStore((s) => s.updateStyle);
  const applyThemeToAll         = useEditorStore((s) => s.applyThemeToAll);

  const [expandedSection, setExpandedSection] = useState<'component' | 'presets' | ''>('component');

  const component = components.find((c) => c.id === lastSelectedComponentId);
  if (!component) return null;

  const { style, data } = component;
  const ctype = component.type;

  const set = (key: keyof ComponentStyle, value: unknown) => {
    if (!lastSelectedComponentId) return;
    updateStyle(lastSelectedComponentId, { [key]: value } as Partial<ComponentStyle>);
  };

  const toggle = (section: 'component' | 'presets') =>
    setExpandedSection((s) => (s === section ? '' : section));

  const seriesCount = Math.min(
    Math.max(data.series?.length ?? 2, 1),
    MAX_SERIES_COLORS,
  );
  const currentSeriesColors = style.seriesColors ?? Array.from({ length: seriesCount }, (_, i) =>
    ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706'][i] ?? '#2563eb',
  );

  return (
    <div className="theme-tab">

      {/* ── SECTION A: Component-level overrides ── */}
      <div className="theme-section">
        <button
          className={`theme-section-header ${expandedSection === 'component' ? 'expanded' : ''}`}
          onClick={() => toggle('component')}
        >
          <span className="section-icon">🎨</span>
          <span className="section-title">Component Overrides</span>
          <span className="section-toggle">{expandedSection === 'component' ? '−' : '+'}</span>
        </button>

        {expandedSection === 'component' && (
          <div className="theme-section-content">

            {/* Background (solid + gradient) */}
            <GradientEditor style={style} onChange={set} />

            {/* Universal */}
            <ColorField
              label="Border Color"
              value={style.borderColor ?? '#e5e7eb'}
              onChange={(v) => set('borderColor', v)}
            />
            <OptionGroup
              label="Border Width (px)"
              options={BORDER_WIDTHS}
              value={style.borderWidth ?? 1}
              onChange={(v) => set('borderWidth', v)}
            />
            <OptionGroup
              label="Border Radius (px)"
              options={BORDER_RADIUSES}
              value={style.borderRadius ?? 8}
              onChange={(v) => set('borderRadius', v)}
            />
            <ColorField
              label="Text Color"
              value={style.textColor ?? '#0f1117'}
              onChange={(v) => set('textColor', v)}
            />
            <OptionGroup
              label="Padding (px)"
              options={PADDING_OPTIONS}
              value={style.padding ?? 16}
              onChange={(v) => set('padding', v)}
            />

            {/* ── StatCard ── */}
            {ctype === 'StatCard' && (
              <>
                <ColorField
                  label="Accent Color"
                  value={style.borderLeftColor ?? '#2563eb'}
                  onChange={(v) => set('borderLeftColor', v)}
                />
                <OptionGroup
                  label="Value Text Size (px)"
                  options={VALUE_SIZES}
                  value={style.metricFontSize ?? 28}
                  onChange={(v) => set('metricFontSize', v)}
                />
                <OptionGroup
                  label="Label Text Size (px)"
                  options={LABEL_SIZES}
                  value={style.labelFontSize ?? 12}
                  onChange={(v) => set('labelFontSize', v)}
                />
              </>
            )}

            {/* ── Table ── */}
            {ctype === 'Table' && (
              <>
                <ColorField
                  label="Header Background"
                  value={style.headerBackgroundColor ?? '#f2f4f7'}
                  onChange={(v) => set('headerBackgroundColor', v)}
                />
                <ColorField
                  label="Row Hover / Stripe Color"
                  value={style.rowAlternateColor ?? '#f8fafc'}
                  onChange={(v) => set('rowAlternateColor', v)}
                />
                <ColorField
                  label="Selected Row Color"
                  value={style.selectedRowColor ?? '#dbeafe'}
                  onChange={(v) => set('selectedRowColor', v)}
                />
                <FormField label="Stripe Rows">
                  <div className="option-group">
                    <button
                      className={`option-button ${style.stripeRows ? 'active' : ''}`}
                      onClick={() => set('stripeRows', !style.stripeRows)}
                    >
                      {style.stripeRows ? 'On' : 'Off'}
                    </button>
                  </div>
                </FormField>
              </>
            )}

            {/* ── Button ── */}
            {ctype === 'Button' && (
              <>
                <ColorField
                  label="Hover Background"
                  value={style.hoverBackgroundColor ?? '#1d4ed8'}
                  onChange={(v) => set('hoverBackgroundColor', v)}
                />
                <OptionGroup
                  label="Font Weight"
                  options={FONT_WEIGHT_OPTIONS.map((o) => o.value)}
                  value={style.fontWeight ?? 600}
                  renderLabel={(v) => FONT_WEIGHT_OPTIONS.find((o) => o.value === v)?.label ?? String(v)}
                  onChange={(v) => set('fontWeight', v)}
                />
                <OptionGroup
                  label="Text Transform"
                  options={TEXT_TRANSFORM_OPTIONS.map((o) => o.value)}
                  value={style.textTransform ?? 'none'}
                  renderLabel={(v) => TEXT_TRANSFORM_OPTIONS.find((o) => o.value === v)?.label ?? v}
                  onChange={(v) => set('textTransform', v)}
                />
              </>
            )}

            {/* ── Charts ── */}
            {(ctype === 'BarChart' || ctype === 'LineChart') && (
              <>
                <div className="form-group">
                  <label className="form-label">Series Colors</label>
                  {Array.from({ length: seriesCount }).map((_, i) => (
                    <div key={i} className="color-picker-group" style={{ marginBottom: '4px' }}>
                      <input
                        type="color"
                        className="color-swatch-input"
                        value={currentSeriesColors[i] ?? '#2563eb'}
                        onChange={(e) => {
                          const next = [...currentSeriesColors];
                          next[i] = e.target.value;
                          set('seriesColors', next);
                        }}
                      />
                      <input
                        type="text"
                        className="color-hex-input"
                        value={currentSeriesColors[i] ?? '#2563eb'}
                        onChange={(e) => {
                          const next = [...currentSeriesColors];
                          next[i] = e.target.value;
                          set('seriesColors', next);
                        }}
                        placeholder="#2563eb"
                      />
                      <span className="form-label" style={{ marginLeft: '6px', marginBottom: 0 }}>
                        {data.series?.[i]?.name ?? `Series ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
                <ColorField
                  label="Grid Line Color"
                  value={style.gridColor ?? '#e5e7eb'}
                  onChange={(v) => set('gridColor', v)}
                />
                <ColorField
                  label="Axis Text Color"
                  value={style.axisColor ?? '#94a3b8'}
                  onChange={(v) => set('axisColor', v)}
                />
              </>
            )}

            {/* ── LogsViewer ── */}
            {ctype === 'LogsViewer' && (
              <>
                <FormField label="Font Family">
                  <select
                    className="form-select"
                    value={style.fontFamily ?? 'Fira Code'}
                    onChange={(e) => set('fontFamily', e.target.value)}
                  >
                    {LOG_FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </FormField>
                <OptionGroup
                  label="Line Height"
                  options={LINE_HEIGHTS}
                  value={style.lineHeight ?? 1.4}
                  onChange={(v) => set('lineHeight', v)}
                />
                <ColorField
                  label="INFO Color"
                  value={style.levelColors?.INFO ?? '#0284c7'}
                  onChange={(v) => set('levelColors', { ...style.levelColors, INFO: v })}
                />
                <ColorField
                  label="WARN Color"
                  value={style.levelColors?.WARN ?? '#d97706'}
                  onChange={(v) => set('levelColors', { ...style.levelColors, WARN: v })}
                />
                <ColorField
                  label="ERROR Color"
                  value={style.levelColors?.ERROR ?? '#dc2626'}
                  onChange={(v) => set('levelColors', { ...style.levelColors, ERROR: v })}
                />
              </>
            )}

          </div>
        )}
      </div>

      {/* ── SECTION B: Dashboard-level theme presets ── */}
      <div className="theme-section">
        <button
          className={`theme-section-header ${expandedSection === 'presets' ? 'expanded' : ''}`}
          onClick={() => toggle('presets')}
        >
          <span className="section-icon">🎭</span>
          <span className="section-title">Dashboard Theme Presets</span>
          <span className="section-toggle">{expandedSection === 'presets' ? '−' : '+'}</span>
        </button>

        {expandedSection === 'presets' && (
          <div className="theme-section-content">
            <p className="theme-presets-hint">Applies selected theme to all components at once</p>
            <div className="theme-presets-grid">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  className="theme-preset-button"
                  onClick={() => applyThemeToAll(preset.name as Parameters<typeof applyThemeToAll>[0])}
                  title={`Apply ${preset.name} theme to all components`}
                >
                  <div className="preset-swatches">
                    <div className="preset-swatch" style={{ backgroundColor: preset.surface }} />
                    <div className="preset-swatch" style={{ backgroundColor: preset.panel }} />
                    <div className="preset-swatch" style={{ backgroundColor: preset.primary }} />
                  </div>
                  <div className="preset-name">{preset.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
