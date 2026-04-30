import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentStyle } from '../../types/template';
import { resolveBackground, GRADIENT_DIRECTIONS } from '../../utils/styleUtils';
import { useDebouncedStyle } from '../../hooks/useDebouncedStyle';

// ─── Option lists ─────────────────────────────────────────────────────────────

const PADDING_OPTIONS     = [4, 8, 12, 16, 20, 24];
const VALUE_SIZES         = [24, 32, 40, 48];
const LABEL_SIZES         = [10, 12, 14];
const BORDER_RADIUSES     = [0, 2, 4, 6, 8, 10, 12, 16, 24];
const BORDER_WIDTHS       = [0, 1, 2, 4, 6, 8];
const BUTTON_VARIANT_DEFAULTS: Record<string, Partial<ComponentStyle>> = {
  Primary: { backgroundColor: '#2563eb', textColor: '#ffffff', borderColor: '#2563eb' },
  Secondary: { backgroundColor: '#f2f4f7', textColor: '#0f1117', borderColor: '#e3e6ec' },
  Danger: { backgroundColor: '#dc2626', textColor: '#ffffff', borderColor: '#dc2626' },
  Ghost: { backgroundColor: 'transparent', textColor: '#2563eb', borderColor: '#e3e6ec' },
};
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
const FONT_STYLE_OPTIONS = [
  { label: 'Normal', value: 'normal' as const },
  { label: 'Italic', value: 'italic' as const },
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

// ─── Optimized field controls ────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function LocalColorField({
  label,
  value,
  componentId,
  onChange,
}: {
  label: string;
  value: string;
  componentId: string;
  onChange: (v: string) => void;
}) {
  const [localColor, setLocalColor] = useState(value);

  useEffect(() => {
    setLocalColor(value);
  }, [value, componentId]);

  const commit = (v: string) => {
    if (v !== value) {
      onChange(v);
    }
  };

  return (
    <FormField label={label}>
      <div className="color-picker-group">
        <input
          type="color"
          className="color-swatch-input"
          value={localColor.startsWith('#') ? localColor : '#ffffff'}
          onChange={(e) => setLocalColor(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onMouseUp={(e) => commit((e.target as HTMLInputElement).value)}
        />
        <input
          type="text"
          className="color-hex-input"
          value={localColor}
          onChange={(e) => setLocalColor(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
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
  componentId,
  onChange,
  onToggle,
}: {
  style: ComponentStyle;
  componentId: string;
  onChange: (key: keyof ComponentStyle, value: unknown) => void;
  onToggle: (key: keyof ComponentStyle, value: unknown) => void;
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
    onToggle('backgroundGradient', { ...gradient, enabled: on });
    if (on) onToggle('backgroundColor', 'transparent');
  };

  const setStop = (i: number, patch: Partial<{ color: string; position: number }>) => {
    const stops = gradient.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    update({ stops });
  };

  const addStop = () => {
    if (gradient.stops.length >= 4) return;
    onToggle('backgroundGradient', { ...gradient, stops: [...gradient.stops, { color: '#94a3b8', position: 50 }] });
  };

  const removeStop = (i: number) => {
    if (gradient.stops.length <= 2) return;
    onToggle('backgroundGradient', { ...gradient, stops: gradient.stops.filter((_, idx) => idx !== i) });
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
        <LocalColorField
          label="Background Color"
          componentId={componentId}
          value={style.backgroundColor ?? '#ffffff'}
          onChange={(v) => onChange('backgroundColor', v)}
        />
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
                <div className="color-picker-group" style={{ width: 'auto' }}>
                   <LocalColorStopInput 
                    value={stop.color} 
                    componentId={componentId}
                    onChange={(c) => setStop(i, { color: c })}
                   />
                </div>
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

function LocalColorStopInput({ value, componentId, onChange }: { value: string; componentId: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value, componentId]);
  
  const commit = (v: string) => { if (v !== value) onChange(v); };

  return (
    <input
      type="color"
      className="color-swatch-input"
      value={local.startsWith('#') ? local : '#3b82f6'}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onMouseUp={(e) => commit((e.target as HTMLInputElement).value)}
    />
  );
}

// ─── Main ThemeTab ────────────────────────────────────────────────────────────

export default function ThemeTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components              = useEditorStore((s) => s.components);
  const updateStyle             = useEditorStore((s) => s.updateStyle);
  const updateLabel             = useEditorStore((s) => s.updateLabel);
  const applyThemeToAll         = useEditorStore((s) => s.applyThemeToAll);

  const debouncedUpdateStyle = useDebouncedStyle(lastSelectedComponentId || '', 150);

  const [expandedSection, setExpandedSection] = useState<'component' | 'presets' | ''>('component');

  const component = components.find((c) => c.id === lastSelectedComponentId);
  if (!component || !lastSelectedComponentId) return null;

  const { style, data } = component;
  const ctype = component.type;

  const set = (key: keyof ComponentStyle, value: unknown) => {
    updateStyle(lastSelectedComponentId, { [key]: value } as Partial<ComponentStyle>);
  };

  const setDebounced = (key: keyof ComponentStyle, value: unknown) => {
    debouncedUpdateStyle(key, value);
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

            {/* Item 3: Label Editor */}
            <FormField label="Component Label">
              <input
                type="text"
                className="form-input"
                value={component.label}
                onChange={(e) => updateLabel(lastSelectedComponentId, e.target.value)}
                placeholder="Enter label..."
              />
            </FormField>

            <div className="theme-divider" />

            {/* Background (solid + gradient) */}
            <GradientEditor 
              style={style} 
              componentId={lastSelectedComponentId} 
              onChange={setDebounced} 
              onToggle={set}
            />

            {/* Universal */}
            <LocalColorField
              label="Border Color"
              componentId={lastSelectedComponentId}
              value={style.borderColor ?? '#e5e7eb'}
              onChange={(v) => setDebounced('borderColor', v)}
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
            <LocalColorField
              label="Text Color"
              componentId={lastSelectedComponentId}
              value={style.textColor ?? '#0f1117'}
              onChange={(v) => setDebounced('textColor', v)}
            />
            <OptionGroup
              label="Padding (px)"
              options={PADDING_OPTIONS}
              value={style.padding ?? 16}
              onChange={(v) => set('padding', v)}
            />

            <div className="theme-divider" />
            <p className="section-subtitle">Typography</p>

            <OptionGroup
              label="Font Weight"
              options={FONT_WEIGHT_OPTIONS.map((o) => o.value)}
              value={style.fontWeight ?? 400}
              renderLabel={(v) => FONT_WEIGHT_OPTIONS.find((o) => o.value === v)?.label ?? String(v)}
              onChange={(v) => set('fontWeight', v)}
            />
            <OptionGroup
              label="Font Style"
              options={FONT_STYLE_OPTIONS.map((o) => o.value)}
              value={style.fontStyle ?? 'normal'}
              renderLabel={(v) => FONT_STYLE_OPTIONS.find((o) => o.value === v)?.label ?? v}
              onChange={(v) => set('fontStyle', v)}
            />
            <FormField label="Letter Spacing (px)">
              <input
                type="range"
                className="slider-input"
                min={-2}
                max={10}
                step={0.5}
                value={style.letterSpacing ?? 0}
                onChange={(e) => set('letterSpacing', Number(e.target.value))}
              />
              <span className="slider-value">{style.letterSpacing ?? 0}px</span>
            </FormField>
            <OptionGroup
              label="Text Transform"
              options={TEXT_TRANSFORM_OPTIONS.map((o) => o.value)}
              value={style.textTransform ?? 'none'}
              renderLabel={(v) => TEXT_TRANSFORM_OPTIONS.find((o) => o.value === v)?.label ?? v}
              onChange={(v) => set('textTransform', v)}
            />

            {/* ── StatCard ── */}
            {ctype === 'StatCard' && (
              <>
                <LocalColorField
                  label="Accent Color"
                  componentId={lastSelectedComponentId}
                  value={style.borderLeftColor ?? '#2563eb'}
                  onChange={(v) => setDebounced('borderLeftColor', v)}
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
                <LocalColorField
                  label="Header Background"
                  componentId={lastSelectedComponentId}
                  value={style.headerBackgroundColor ?? '#f2f4f7'}
                  onChange={(v) => setDebounced('headerBackgroundColor', v)}
                />
                <LocalColorField
                  label="Row Hover / Stripe Color"
                  componentId={lastSelectedComponentId}
                  value={style.rowAlternateColor ?? '#f8fafc'}
                  onChange={(v) => setDebounced('rowAlternateColor', v)}
                />
                <LocalColorField
                  label="Selected Row Color"
                  componentId={lastSelectedComponentId}
                  value={style.selectedRowColor ?? '#dbeafe'}
                  onChange={(v) => setDebounced('selectedRowColor', v)}
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
                <div className="theme-divider" />
                <LocalColorField
                  label="Search Bar Background"
                  componentId={lastSelectedComponentId}
                  value={style.searchBarBackground ?? '#ffffff'}
                  onChange={(v) => setDebounced('searchBarBackground', v)}
                />
                <LocalColorField
                  label="Search Bar Text Color"
                  componentId={lastSelectedComponentId}
                  value={style.searchBarTextColor ?? '#0f1117'}
                  onChange={(v) => setDebounced('searchBarTextColor', v)}
                />
              </>
            )}

            {/* ── Button ── */}
            {ctype === 'Button' && (
              <>
                <OptionGroup
                  label="Button Variant"
                  options={['Primary', 'Secondary', 'Danger', 'Ghost']}
                  value={style.variant ?? 'Primary'}
                  onChange={(v) => {
                    set('variant', v);
                    const defaults = BUTTON_VARIANT_DEFAULTS[v as string];
                    if (defaults) {
                      updateStyle(lastSelectedComponentId, defaults);
                    }
                  }}
                />
                <LocalColorField
                  label="Hover Background"
                  componentId={lastSelectedComponentId}
                  value={style.hoverBackgroundColor ?? '#1d4ed8'}
                  onChange={(v) => setDebounced('hoverBackgroundColor', v)}
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
                      <LocalSeriesColorInput 
                        value={currentSeriesColors[i] ?? '#2563eb'}
                        componentId={lastSelectedComponentId}
                        label={data.series?.[i]?.name ?? `Series ${i + 1}`}
                        onChange={(c) => {
                          const next = [...currentSeriesColors];
                          next[i] = c;
                          setDebounced('seriesColors', next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <LocalColorField
                  label="Grid Line Color"
                  componentId={lastSelectedComponentId}
                  value={style.gridColor ?? '#e5e7eb'}
                  onChange={(v) => setDebounced('gridColor', v)}
                />
                <LocalColorField
                  label="Axis Text Color"
                  componentId={lastSelectedComponentId}
                  value={style.axisColor ?? '#94a3b8'}
                  onChange={(v) => setDebounced('axisColor', v)}
                />
                <div className="gradient-editor-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <LocalColorField
                    label="X-Axis Color"
                    componentId={lastSelectedComponentId}
                    value={style.xAxisColor ?? style.axisColor ?? '#94a3b8'}
                    onChange={(v) => setDebounced('xAxisColor', v)}
                  />
                  <LocalColorField
                    label="Y-Axis Color"
                    componentId={lastSelectedComponentId}
                    value={style.yAxisColor ?? style.axisColor ?? '#94a3b8'}
                    onChange={(v) => setDebounced('yAxisColor', v)}
                  />
                </div>
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
                <LocalColorField
                  label="INFO Color"
                  componentId={lastSelectedComponentId}
                  value={style.levelColors?.INFO ?? '#0284c7'}
                  onChange={(v) => setDebounced('levelColors', { ...style.levelColors, INFO: v })}
                />
                <LocalColorField
                  label="WARN Color"
                  componentId={lastSelectedComponentId}
                  value={style.levelColors?.WARN ?? '#d97706'}
                  onChange={(v) => setDebounced('levelColors', { ...style.levelColors, WARN: v })}
                />
                <LocalColorField
                  label="ERROR Color"
                  componentId={lastSelectedComponentId}
                  value={style.levelColors?.ERROR ?? '#dc2626'}
                  onChange={(v) => setDebounced('levelColors', { ...style.levelColors, ERROR: v })}
                />
                <div className="theme-divider" />
                <LocalColorField
                  label="Search Bar Background"
                  componentId={lastSelectedComponentId}
                  value={style.searchBarBackground ?? '#ffffff'}
                  onChange={(v) => setDebounced('searchBarBackground', v)}
                />
              </>
            )}

            {/* ── TabbedContainer ── */}
            {ctype === 'TabbedContainer' && (
              <>
                <LocalColorField
                  label="Header Strip Background"
                  componentId={lastSelectedComponentId}
                  value={style.tabHeaderBackground ?? '#f8fafc'}
                  onChange={(v) => setDebounced('tabHeaderBackground', v)}
                />
                <div className="gradient-editor-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <LocalColorField
                    label="Tab Text Color"
                    componentId={lastSelectedComponentId}
                    value={style.tabHeaderTextColor ?? '#64748b'}
                    onChange={(v) => setDebounced('tabHeaderTextColor', v)}
                  />
                  <LocalColorField
                    label="Active Tab BG"
                    componentId={lastSelectedComponentId}
                    value={style.tabHeaderActiveBackground ?? '#ffffff'}
                    onChange={(v) => setDebounced('tabHeaderActiveBackground', v)}
                  />
                </div>
                <LocalColorField
                  label="Active Tab Text"
                  componentId={lastSelectedComponentId}
                  value={style.tabHeaderActiveTextColor ?? '#2563eb'}
                  onChange={(v) => setDebounced('tabHeaderActiveTextColor', v)}
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

function LocalSeriesColorInput({ value, componentId, label, onChange }: { value: string; componentId: string; label: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value, componentId]);
  
  const commit = (v: string) => { if (v !== value) onChange(v); };

  return (
    <>
      <input
        type="color"
        className="color-swatch-input"
        value={local ?? '#2563eb'}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onMouseUp={(e) => commit((e.target as HTMLInputElement).value)}
      />
      <input
        type="text"
        className="color-hex-input"
        value={local ?? '#2563eb'}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        placeholder="#2563eb"
      />
      <span className="form-label" style={{ marginLeft: '6px', marginBottom: 0 }}>
        {label}
      </span>
    </>
  );
}
