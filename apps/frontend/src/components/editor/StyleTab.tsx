import { useEditorStore } from '../../store/editorStore';
import type { ComponentStyle } from '../../types/template';

const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'DM Sans', 'Fira Code', 'system-ui'];

export default function StyleTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateStyle = useEditorStore((s) => s.updateStyle);

  const component = components.find((c) => c.id === lastSelectedComponentId);
  if (!component) return null;

  const style = component.style;

  const handleChange = (key: keyof ComponentStyle, value: string | number) => {
    if (!lastSelectedComponentId) return;
    updateStyle(lastSelectedComponentId, { [key]: value });
  };

  return (
    <div>
      {/* Background Color */}
      <div className="form-group">
        <label className="form-label">Background Color</label>
        <div className="color-picker-group">
          <input
            type="color"
            className="color-swatch-input"
            value={style.backgroundColor || '#ffffff'}
            onChange={(e) => handleChange('backgroundColor', e.target.value)}
          />
          <input
            type="text"
            className="color-hex-input"
            value={style.backgroundColor || '#ffffff'}
            onChange={(e) => handleChange('backgroundColor', e.target.value)}
            placeholder="#ffffff"
          />
        </div>
      </div>

      {/* Text Color */}
      <div className="form-group">
        <label className="form-label">Text Color</label>
        <div className="color-picker-group">
          <input
            type="color"
            className="color-swatch-input"
            value={style.textColor || '#0f1117'}
            onChange={(e) => handleChange('textColor', e.target.value)}
          />
          <input
            type="text"
            className="color-hex-input"
            value={style.textColor || '#0f1117'}
            onChange={(e) => handleChange('textColor', e.target.value)}
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Font Family */}
      <div className="form-group">
        <label className="form-label">Font Family</label>
        <select
          className="form-select"
          value={style.fontFamily || 'Inter'}
          onChange={(e) => handleChange('fontFamily', e.target.value)}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div className="form-group">
        <label className="form-label">Font Size</label>
        <div className="slider-group">
          <input
            type="range"
            className="slider-input"
            min={12}
            max={24}
            value={style.fontSize || 14}
            onChange={(e) => handleChange('fontSize', Number(e.target.value))}
          />
          <span className="slider-value">{style.fontSize || 14}px</span>
        </div>
      </div>

      {/* Border Radius */}
      <div className="form-group">
        <label className="form-label">Border Radius</label>
        <div className="slider-group">
          <input
            type="range"
            className="slider-input"
            min={0}
            max={16}
            value={style.borderRadius || 0}
            onChange={(e) => handleChange('borderRadius', Number(e.target.value))}
          />
          <span className="slider-value">{style.borderRadius || 0}px</span>
        </div>
      </div>

      {/* Border Color */}
      <div className="form-group">
        <label className="form-label">Border Color</label>
        <div className="color-picker-group">
          <input
            type="color"
            className="color-swatch-input"
            value={style.borderColor || '#e3e6ec'}
            onChange={(e) => handleChange('borderColor', e.target.value)}
          />
          <input
            type="text"
            className="color-hex-input"
            value={style.borderColor || '#e3e6ec'}
            onChange={(e) => handleChange('borderColor', e.target.value)}
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Border Width */}
      <div className="form-group">
        <label className="form-label">Border Width</label>
        <div className="slider-group">
          <input
            type="range"
            className="slider-input"
            min={0}
            max={4}
            value={style.borderWidth || 0}
            onChange={(e) => handleChange('borderWidth', Number(e.target.value))}
          />
          <span className="slider-value">{style.borderWidth || 0}px</span>
        </div>
      </div>

      {/* Padding */}
      <div className="form-group">
        <label className="form-label">Padding</label>
        <div className="slider-group">
          <input
            type="range"
            className="slider-input"
            min={8}
            max={32}
            value={style.padding || 16}
            onChange={(e) => handleChange('padding', Number(e.target.value))}
          />
          <span className="slider-value">{style.padding || 16}px</span>
        </div>
      </div>
    </div>
  );
}
