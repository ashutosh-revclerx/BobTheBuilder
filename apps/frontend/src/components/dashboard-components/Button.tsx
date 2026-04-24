import { useState } from 'react';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { evaluateBooleanExpression, parseQueryName, runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';

interface ButtonProps {
  config: ComponentConfig;
}

const VARIANT_STYLES = {
  Primary: { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#2563eb' },
  Secondary: { backgroundColor: '#f2f4f7', color: '#0f1117', borderColor: '#e3e6ec' },
  Danger: { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#dc2626' },
  Ghost: { backgroundColor: 'transparent', color: '#2563eb', borderColor: '#e3e6ec' },
};

export default function Button({ config }: ButtonProps) {
  const { style, data, label } = config;
  const queriesStore = useEditorStore((s) => s.queries);
  const [localLoading, setLocalLoading] = useState(false);
  const targetQueryName = parseQueryName(data.dbBinding);
  const isQueryLoading = targetQueryName ? queriesStore[targetQueryName]?.isLoading : false;
  const loading = (data.loadingState && (localLoading || isQueryLoading)) || false;
  const disabled = evaluateBooleanExpression(data.disabled, false) || loading;
  const variant = VARIANT_STYLES[style.variant || 'Primary'];

  const handleClick = async () => {
    if (disabled) {
      return;
    }

    if (data.confirmationDialog) {
      const confirmed = window.confirm(data.confirmationMessage || 'Are you sure?');
      if (!confirmed) {
        return;
      }
    }

    if (!targetQueryName) {
      return;
    }

    const state = useEditorStore.getState();
    const queryConfig = state.queriesConfig.find((query) => query.name === targetQueryName);
    if (!queryConfig) {
      return;
    }

    setLocalLoading(true);
    try {
      await executeQuery(queryConfig);
      runAction(data.onSuccessAction, { query: targetQueryName, status: 'success' });
    } catch (error) {
      console.error(error);
      runAction(data.onErrorAction, { query: targetQueryName, status: 'error' });
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div
      className="button-component"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: style.padding ? `${style.padding}px` : '16px',
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || 'transparent'}` : undefined,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        style={{
          backgroundColor: variant.backgroundColor,
          color: variant.color,
          fontFamily: style.fontFamily,
          borderRadius: style.borderRadius ? `${style.borderRadius}px` : '6px',
          border: `1px solid ${variant.borderColor}`,
          padding: '10px 20px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          opacity: disabled ? 0.7 : 1,
          width: style.fullWidth ? '100%' : 'auto',
          minWidth: style.fullWidth ? '100%' : 'unset',
          height: '100%',
          transition: 'all 0.2s',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {loading ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : null}
        {style.iconLeft ? <span>{style.iconLeft}</span> : null}
        <span>{loading ? 'Executing...' : label}</span>
      </button>
    </div>
  );
}
