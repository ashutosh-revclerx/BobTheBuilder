import { useState } from 'react';
import type { QueryConfig } from '@btb/shared';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { evaluateBooleanExpression, humanizeQueryError, parseQueryName, runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';

interface ButtonProps {
  config: ComponentConfig;
}

const VARIANT_STYLES = {
  Primary: { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#2563eb' },
  Secondary: { backgroundColor: '#f2f4f7', color: '#0f1117', borderColor: '#e3e6ec' },
  Danger: { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#dc2626' },
  Ghost: { backgroundColor: 'transparent', color: '#2563eb', borderColor: '#e3e6ec' },
} as const;

export default function Button({ config }: ButtonProps) {
  const { style, data, label } = config;
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const [localLoading, setLocalLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const targetQueryName = parseQueryName(data.dbBinding);
  const queryState = targetQueryName ? queryResults[targetQueryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === targetQueryName) as QueryConfig | undefined;
  const loading = localLoading || queryState?.status === 'loading';
  const disabled = evaluateBooleanExpression(data.disabled, false) || loading;
  const variant = VARIANT_STYLES[style.variant || 'Primary'];

  const runQuery = async () => {
    if (!queryConfig) {
      return;
    }

    setLocalLoading(true);
    try {
      await executeQuery(queryConfig);
      runAction(data.onSuccessAction, { query: targetQueryName, status: 'success' });
    } catch {
      runAction(data.onErrorAction, { query: targetQueryName, status: 'error' });
    } finally {
      setLocalLoading(false);
      setConfirming(false);
    }
  };

  const handleClick = async () => {
    if (disabled) {
      return;
    }

    if (data.confirmationDialog && !confirming) {
      setConfirming(true);
      return;
    }

    await runQuery();
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
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {confirming ? (
        <div className="dashboard-inline-confirm">
          <div>{data.confirmationMessage || 'Are you sure?'}</div>
          <div className="dashboard-inline-confirm-actions">
            <button className="btn-topbar primary" onClick={() => void runQuery()} disabled={loading}>
              {loading ? 'Running...' : data.confirmLabel || 'Confirm'}
            </button>
            <button className="btn-topbar" onClick={() => setConfirming(false)}>
              {data.cancelLabel || 'Cancel'}
            </button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => void handleClick()}
        disabled={disabled}
        title={queryState?.status === 'error' ? humanizeQueryError(queryState.error) : undefined}
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
          position: 'relative',
        }}
      >
        {queryState?.status === 'error' ? <span className="dashboard-button-error-dot" /> : null}
        {loading ? <span className="spinner dashboard-list-button-spinner" /> : null}
        {style.iconLeft ? <span>{style.iconLeft}</span> : null}
        <span>{loading ? 'Executing...' : label}</span>
      </button>
    </div>
  );
}
