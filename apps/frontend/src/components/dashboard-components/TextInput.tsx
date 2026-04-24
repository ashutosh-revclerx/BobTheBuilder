import type { ComponentConfig } from '../../types/template';
import { parseQueryName, runAction } from '../../engine/runtimeUtils';
import { executeQuery } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';

function getInputType(type: string | undefined) {
  switch (type) {
    case 'Email':
      return 'email';
    case 'Password':
      return 'password';
    case 'URL':
      return 'url';
    case 'Search':
      return 'search';
    default:
      return 'text';
  }
}

export default function TextInput({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const componentState = useEditorStore((s) => s.componentState);
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  const val = componentState[config.id]?.value ?? data.mockValue ?? '';
  const inputType = getInputType(data.type);

  const handleChange = (value: string) => {
    setComponentState(config.id, { value });
    runAction(data.onChangeAction, value);
  };

  const handleSubmit = async () => {
    const queryName = parseQueryName(data.onSubmitAction);
    if (!queryName) {
      return;
    }
    const queryConfig = queriesConfig.find((query) => query.name === queryName);
    if (queryConfig) {
      await executeQuery(queryConfig, { value: val });
    }
  };

  return (
    <div className="atomic-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: style.labelPosition === 'Left' ? 'row' : 'column', justifyContent: 'center', gap: '8px' }}>
      {data.label && style.labelPosition !== 'Hidden' ? <label className="atomic-input-label">{data.label}</label> : null}
      <input
        type={inputType}
        className="atomic-text-input"
        value={val}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void handleSubmit();
          }
        }}
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
          height: '100%',
        }}
        placeholder={data.placeholder || 'Enter text...'}
        required={data.required}
        pattern={data.regex || undefined}
        maxLength={data.maxLength ?? undefined}
        title={data.errorMessage || undefined}
      />
    </div>
  );
}
