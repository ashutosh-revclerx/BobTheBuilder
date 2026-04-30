import React, { useMemo, useState } from 'react';
import type { QueryConfig } from '@btb/shared';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { evaluateBooleanExpression, humanizeQueryError, parseQueryName, runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface ButtonProps {
  config: ComponentConfig;
}

// Styles are now managed via the editor store and passed through config.style.
// The variant property acts as a preset that updates individual style fields in the store.

const Button = React.memo(function Button({ config }: ButtonProps) {
  const { style, data, label } = config;
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const [localLoading, setLocalLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hovered, setHovered] = useState(false);
  
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  
  const targetQueryName = parseQueryName(data.dbBinding);
  const queryState = targetQueryName ? queryResults[targetQueryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === targetQueryName) as QueryConfig | undefined;
  const loading = localLoading || queryState?.status === 'loading';
  const disabled = evaluateBooleanExpression(data.disabled, false) || loading;

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
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', bg);
          el.style.setProperty('--comp-border', style.borderColor || '#2563eb');
          el.style.setProperty('--comp-text', style.textColor || '#ffffff');
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: style.padding ? `${style.padding}px` : '0',
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor:
            hovered && style.hoverBackgroundColor
              ? style.hoverBackgroundColor
              : 'var(--comp-bg)',
          color: 'var(--comp-text)',
          fontFamily: style.fontFamily,
          fontStyle: style.fontStyle || 'normal',
          letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : 'normal',
          borderRadius: style.borderRadius ? `${style.borderRadius}px` : '6px',
          border: `${style.borderWidth ?? 1}px solid var(--comp-border)`,
          padding: style.padding ? `${style.padding}px` : '10px 20px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: style.fontWeight ?? 600,
          textTransform: style.textTransform ?? 'none',
          opacity: disabled ? 0.7 : 1,
          width: style.fullWidth ? '100%' : 'auto',
          minWidth: style.fullWidth ? '100%' : 'unset',
          height: '100%',
          transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
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
});

export default Button;
