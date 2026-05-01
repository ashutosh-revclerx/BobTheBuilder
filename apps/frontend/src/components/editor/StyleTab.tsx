import { useEditorStore } from '../../store/editorStore';
import type { ComponentStyle } from '../../types/template';

const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'DM Sans', 'Fira Code', 'system-ui'];

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <FormField label={label}>
      <div className="slider-group">
        <input
          type="range"
          className="slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="slider-value">
          {value}
          {suffix}
        </span>
      </div>
    </FormField>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value ? 'true' : 'false'}
      onChange={(nextValue) => onChange(nextValue === 'true')}
      options={['true', 'false']}
    />
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <div className="color-picker-group">
        <input type="color" className="color-swatch-input" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" className="color-hex-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="#ffffff" />
      </div>
    </FormField>
  );
}

export default function StyleTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateStyle = useEditorStore((s) => s.updateStyle);

  const component = components.find((currentComponent) => currentComponent.id === lastSelectedComponentId);
  if (!component) {
    return null;
  }

  const style = component.style;

  const handleChange = (key: keyof ComponentStyle, value: string | number | boolean | Record<any, any>) => {
    if (!lastSelectedComponentId) {
      return;
    }
    updateStyle(lastSelectedComponentId, { [key]: value });
  };

  return (
    <div>
      <ColorField label="Background Color" value={style.backgroundColor || '#ffffff'} onChange={(value) => handleChange('backgroundColor', value)} />
      <ColorField label="Text Color" value={style.textColor || '#0f1117'} onChange={(value) => handleChange('textColor', value)} />

      <SelectField
        label="Font Family"
        value={style.fontFamily || 'Inter'}
        onChange={(value) => handleChange('fontFamily', value)}
        options={FONT_OPTIONS}
      />

      <SliderField label="Font Size" value={style.fontSize || 14} min={12} max={24} onChange={(value) => handleChange('fontSize', value)} />
      <SliderField
        label="Border Radius"
        value={style.borderRadius || 0}
        min={0}
        max={16}
        onChange={(value) => handleChange('borderRadius', value)}
      />

      <ColorField label="Border Color" value={style.borderColor || '#e3e6ec'} onChange={(value) => handleChange('borderColor', value)} />
      <SliderField label="Border Width" value={style.borderWidth || 0} min={0} max={4} onChange={(value) => handleChange('borderWidth', value)} />
      <SliderField label="Padding" value={style.padding || 16} min={0} max={32} onChange={(value) => handleChange('padding', value)} />

      <div className="theme-divider" style={{ margin: '16px 0' }} />
      <p className="section-subtitle" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Typography Details</p>
      <SelectField
        label="Font Weight"
        value={String(style.fontWeight || 400)}
        onChange={(v) => handleChange('fontWeight', Number(v))}
        options={['100', '200', '300', '400', '500', '600', '700', '800', '900']}
      />
      <SelectField
        label="Font Style"
        value={style.fontStyle || 'normal'}
        onChange={(v) => handleChange('fontStyle', v)}
        options={['normal', 'italic']}
      />
      <SliderField
        label="Letter Spacing"
        value={style.letterSpacing || 0}
        min={-2}
        max={10}
        step={0.5}
        onChange={(value) => handleChange('letterSpacing', value)}
      />

      {component.type === 'Table' && (
        <>
          <ColorField
            label="Header Background Color"
            value={style.headerBackgroundColor || '#f2f4f7'}
            onChange={(value) => handleChange('headerBackgroundColor', value)}
          />
          <ColorField
            label="Alternating Row Color"
            value={style.rowAlternateColor || '#ffffff'}
            onChange={(value) => handleChange('rowAlternateColor', value)}
          />
          <ColorField
            label="Search Bar Background"
            value={style.searchBarBackground || '#ffffff'}
            onChange={(value) => handleChange('searchBarBackground', value)}
          />
          <ColorField
            label="Search Bar Text Color"
            value={style.searchBarTextColor || '#0f1117'}
            onChange={(value) => handleChange('searchBarTextColor', value)}
          />
          <BooleanField label="Strikethrough" value={style.strikethrough === true} onChange={(value) => handleChange('strikethrough', value)} />
          {style.strikethrough && (
            <>
              <FormField label="Strikethrough field">
                <input
                  type="text"
                  className="form-input"
                  value={style.strikethroughField || ''}
                  onChange={(e) => handleChange('strikethroughField', e.target.value)}
                  placeholder="Field name"
                />
              </FormField>
              <FormField label="Strikethrough value">
                <input
                  type="text"
                  className="form-input"
                  value={style.strikethroughValue || ''}
                  onChange={(e) => handleChange('strikethroughValue', e.target.value)}
                  placeholder="Match value"
                />
              </FormField>
            </>
          )}
        </>
      )}

      {component.type === 'Button' && (
        <>
          <SelectField
            label="Variant"
            value={style.variant || 'Primary'}
            onChange={(v) => {
              // Styles are now managed via the editor store and passed through config.style.
              // The variant property acts as a preset that updates individual style fields in the store.
              const BUTTON_VARIANT_DEFAULTS: Record<string, any> = {
                Primary: { backgroundColor: '#2563eb', textColor: '#ffffff', borderColor: '#2563eb', hoverBackgroundColor: '#1d4ed8' },
                Secondary: { backgroundColor: '#f2f4f7', textColor: '#0f1117', borderColor: '#e3e6ec', hoverBackgroundColor: '#e5e7eb' },
                Danger: { backgroundColor: '#dc2626', textColor: '#ffffff', borderColor: '#dc2626', hoverBackgroundColor: '#b91c1c' },
                Ghost: { backgroundColor: 'transparent', textColor: '#2563eb', borderColor: '#e3e6ec', hoverBackgroundColor: 'rgba(37, 99, 235, 0.05)' },
              };
              const defaults = BUTTON_VARIANT_DEFAULTS[v] || {};
              updateStyle(lastSelectedComponentId!, { variant: v as any, ...defaults });
            }}
            options={['Primary', 'Secondary', 'Danger', 'Ghost']}
          />
          <ColorField label="Hover Color" value={style.hoverBackgroundColor || '#1d4ed8'} onChange={(v) => handleChange('hoverBackgroundColor', v)} />
          <FormField label="Icon Left">
            <input
              type="text"
              className="form-input"
              value={style.iconLeft || ''}
              onChange={(e) => handleChange('iconLeft', e.target.value)}
              placeholder="Icon name or emoji"
            />
          </FormField>
          <BooleanField label="Full Width" value={style.fullWidth === true} onChange={(value) => handleChange('fullWidth', value)} />
        </>
      )}

      {component.type === 'Text' && (
        <>
          <SelectField
            label="Text Align"
            value={style.textAlign || 'Left'}
            onChange={(value) => handleChange('textAlign', value)}
            options={['Left', 'Center', 'Right', 'Justify']}
          />
          <SliderField
            label="Line Height"
            value={style.lineHeight || 1.5}
            min={1}
            max={2.5}
            step={0.1}
            suffix=""
            onChange={(value) => handleChange('lineHeight', value)}
          />
          <SelectField
            label="Overflow"
            value={style.overflow || 'Wrap'}
            onChange={(value) => handleChange('overflow', value)}
            options={['Wrap', 'Truncate', 'Scroll']}
          />
        </>
      )}

      {component.type === 'Container' && (
        <>
          <SelectField
            label="Align Items"
            value={style.alignItems || 'Stretch'}
            onChange={(value) => handleChange('alignItems', value)}
            options={['Start', 'Center', 'End', 'Stretch']}
          />
          <SelectField
            label="Justify Content"
            value={style.justifyContent || 'Start'}
            onChange={(value) => handleChange('justifyContent', value)}
            options={['Start', 'Center', 'End', 'Space Between', 'Space Around']}
          />
        </>
      )}

      {component.type === 'TabbedContainer' && (
        <>
          <SelectField
            label="Tab Position"
            value={style.tabPosition || 'Top'}
            onChange={(value) => handleChange('tabPosition', value)}
            options={['Top', 'Bottom', 'Left']}
          />
          <SelectField
            label="Tab Style"
            value={style.tabStyle || 'Underline'}
            onChange={(value) => handleChange('tabStyle', value)}
            options={['Underline', 'Pills', 'Boxed']}
          />
          <div className="theme-divider" style={{ margin: '12px 0' }} />
          <p className="section-subtitle">Navbar Styling</p>
          <ColorField label="Header Background" value={style.tabHeaderBackground || 'transparent'} onChange={(v) => handleChange('tabHeaderBackground', v)} />
          <ColorField label="Text Color" value={style.tabHeaderTextColor || '#64748b'} onChange={(v) => handleChange('tabHeaderTextColor', v)} />
          <ColorField label="Active Text Color" value={style.tabHeaderActiveTextColor || '#2563eb'} onChange={(v) => handleChange('tabHeaderActiveTextColor', v)} />
        </>
      )}

      {component.type === 'StatCard' && (
        <>
          <SliderField
            label="Metric Font Size"
            value={style.metricFontSize || 28}
            min={16}
            max={48}
            onChange={(value) => handleChange('metricFontSize', value)}
          />
          <SliderField
            label="Label Font Size"
            value={style.labelFontSize || 12}
            min={10}
            max={20}
            onChange={(value) => handleChange('labelFontSize', value)}
          />
          <ColorField
            label="Trend Color Override"
            value={style.trendColorOverride || '#059669'}
            onChange={(value) => handleChange('trendColorOverride', value)}
          />
        </>
      )}

      {component.type === 'StatusBadge' && (
        <SelectField
          label="Shape"
          value={style.shape || 'Pill'}
          onChange={(value) => handleChange('shape', value)}
          options={['Rounded', 'Pill', 'Square']}
        />
      )}

      {(component.type === 'TextInput' || component.type === 'Select' || component.type === 'NumberInput') && (
        <SelectField
          label="Label Position"
          value={style.labelPosition || 'Top'}
          onChange={(value) => handleChange('labelPosition', value)}
          options={['Top', 'Left', 'Hidden']}
        />
      )}

      {component.type === 'NumberInput' && (
        <BooleanField label="Show Stepper" value={style.showStepper !== false} onChange={(value) => handleChange('showStepper', value)} />
      )}

      {component.type === 'BarChart' && (
        <>
          <SliderField label="Bar Radius" value={style.barRadius || 4} min={0} max={8} onChange={(value) => handleChange('barRadius', value)} />
          <BooleanField label="Show Data Labels" value={style.showDataLabels === true} onChange={(value) => handleChange('showDataLabels', value)} />
          <ColorField label="X-Axis Color" value={style.xAxisColor || '#94a3b8'} onChange={(v) => handleChange('xAxisColor', v)} />
          <ColorField label="Y-Axis Color" value={style.yAxisColor || '#94a3b8'} onChange={(v) => handleChange('yAxisColor', v)} />
        </>
      )}

      {component.type === 'LineChart' && (
        <>
          <SliderField label="Line Width" value={style.lineWidth || 2} min={1} max={6} onChange={(value) => handleChange('lineWidth', value)} />
          <BooleanField label="Show Data Labels" value={style.showDataLabels === true} onChange={(value) => handleChange('showDataLabels', value)} />
          <ColorField label="X-Axis Color" value={style.xAxisColor || '#94a3b8'} onChange={(v) => handleChange('xAxisColor', v)} />
          <ColorField label="Y-Axis Color" value={style.yAxisColor || '#94a3b8'} onChange={(v) => handleChange('yAxisColor', v)} />
        </>
      )}

      {component.type === 'LogsViewer' && (
        <>
        </>
      )}
    </div>
  );
}
