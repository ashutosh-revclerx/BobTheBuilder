import type { ComponentConfig } from '../../types/template';
import { runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

function formatValue(value: number, formatter: string | undefined) {
  if (formatter === 'Currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  if (formatter === 'Percentage') {
    return `${value}%`;
  }
  if (formatter === 'Compact') {
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
  }
  return String(value);
}

export default function NumberInput({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const componentState = useEditorStore((s) => s.componentState);
  const val = Number(componentState[config.id]?.value ?? data.mockValue ?? 0);
  const outOfRange = (data.min !== undefined && val < data.min) || (data.max !== undefined && val > data.max);

  return (
    <div className="atomic-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: style.labelPosition === 'Left' ? 'row' : 'column', gap: '8px' }}>
      {data.label && style.labelPosition !== 'Hidden' ? <label className="atomic-input-label">{data.label}</label> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        {data.prefix ? <span>{data.prefix}</span> : null}
        <input
          type="number"
          className="atomic-text-input"
          value={val}
          onChange={(e) => {
            const nextValue = Number(e.target.value);
            setComponentState(config.id, 'value', nextValue);
            runAction(data.onChangeAction, nextValue);
          }}
          style={{
            background: resolveBackground(style),
            color: style.textColor,
            fontFamily: style.fontFamily,
            fontSize: `${style.fontSize}px`,
            borderRadius: `${style.borderRadius}px`,
            borderColor: outOfRange ? '#dc2626' : style.borderColor,
            borderWidth: `${style.borderWidth}px`,
            padding: `${style.padding}px`,
            flex: 1,
            height: '100%',
          }}
          min={data.min}
          max={data.max}
          step={data.step ?? 1}
          required={data.required}
        />
        {data.suffix ? <span>{data.suffix}</span> : null}
      </div>
      {style.showStepper === false ? null : <div style={{ fontSize: '11px', color: '#5c6370' }}>{formatValue(val, data.formatter)}</div>}
      {outOfRange ? <div style={{ fontSize: '11px', color: '#dc2626' }}>{data.errorMessage || 'Value out of range'}</div> : null}
    </div>
  );
}
