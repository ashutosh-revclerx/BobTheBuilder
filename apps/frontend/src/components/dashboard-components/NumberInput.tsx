import type { ComponentConfig } from '../../types/template';
import { useEditorStore } from '../../store/editorStore';

export default function NumberInput({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const componentState = useEditorStore((s) => s.componentState);
  const val = componentState[config.id]?.value ?? data.mockValue ?? 0;

  return (
    <div className="atomic-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {data.label && <label className="atomic-input-label" style={{ marginBottom: '4px' }}>{data.label}</label>}
      <input
        type="number"
        className="atomic-text-input"
        value={val}
        onChange={(e) => setComponentState(config.id, { value: Number(e.target.value) })}
        style={{
          backgroundColor: style.backgroundColor,
          color: style.textColor,
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          borderRadius: `${style.borderRadius}px`,
          borderColor: style.borderColor,
          borderWidth: `${style.borderWidth}px`,
          padding: `${style.padding}px`,
          width: '100%'
        }}
      />
    </div>
  );
}
