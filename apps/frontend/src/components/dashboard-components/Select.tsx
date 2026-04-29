import type { ComponentConfig } from '../../types/template';
import { runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

export default function Select({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const componentState = useEditorStore((s) => s.componentState);

  const staticOptions = (data.optionsList?.length ? data.optionsList : (data.options || []).map((option) => ({ label: option, value: option })));
  const dynamicOptions = Array.isArray(data.dbBinding)
    ? (data.dbBinding as Record<string, unknown>[]).map((item) => ({
        label: String(item[data.labelField || 'label'] ?? ''),
        value: String(item[data.valueField || 'value'] ?? ''),
      }))
    : [];
  const options = data.optionsSource === 'From query' ? dynamicOptions : staticOptions;
  const val = String(componentState[config.id]?.value ?? data.mockValue ?? options[0]?.value ?? '');

  return (
    <div className="atomic-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: style.labelPosition === 'Left' ? 'row' : 'column', justifyContent: 'center', gap: '8px' }}>
      {data.label && style.labelPosition !== 'Hidden' ? <label className="atomic-input-label">{data.label}</label> : null}
      <select
        className="atomic-select-input"
        value={val}
        onChange={(e) => {
          setComponentState(config.id, 'value', e.target.value);
          runAction(data.onChangeAction, e.target.value);
        }}
        style={{
          background: resolveBackground(style),
          color: style.textColor,
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}px`,
          borderRadius: `${style.borderRadius}px`,
          borderColor: style.borderColor,
          borderWidth: `${style.borderWidth}px`,
          padding: `${style.padding}px`,
          width: '100%',
          flex: 1,
          height: '100%',
        }}
        multiple={data.multiSelect}
        required={data.required}
      >
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
