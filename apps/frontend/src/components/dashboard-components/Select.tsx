import type { ComponentConfig } from '../../types/template';
import { useEditorStore } from '../../store/editorStore';

export default function Select({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const componentState = useEditorStore((s) => s.componentState);
  
  const options = data.options || ['Option 1'];
  const val = componentState[config.id]?.value ?? data.mockValue ?? options[0];

  return (
    <div className="atomic-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {data.label && <label className="atomic-input-label" style={{ marginBottom: '4px' }}>{data.label}</label>}
      <select
        className="atomic-select-input"
        value={val}
        onChange={(e) => setComponentState(config.id, { value: e.target.value })}
        style={{
          backgroundColor: style.backgroundColor,
          color: style.textColor,
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          borderRadius: `${style.borderRadius}px`,
          borderColor: style.borderColor,
          borderWidth: `${style.borderWidth}px`,
          padding: `${style.padding}px`,
          width: '100%',
          flex: 1,
          height: '100%'
        }}
      >
        {options.map((opt, idx) => (
          <option key={idx} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
