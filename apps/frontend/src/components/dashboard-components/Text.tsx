import React, { useMemo } from 'react';
import type { ComponentConfig } from '../../types/template';
import { evaluateExpression } from '../../engine/runtimeUtils';
import { resolveBackground } from '../../utils/styleUtils';

const Text = React.memo(function Text({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  
  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);
  
  const isBound = data._resolvedBindings?.dbBinding;
  const sourceValue = isBound && data.dbBinding != null && data.dbBinding !== ''
    ? data.dbBinding
    : data.mockValue;
  const resolvedValue = data.expression
    ? evaluateExpression(String(sourceValue ?? ''), '')
    : sourceValue;
  const content = String(resolvedValue ?? '');

  return (
    <div
      className="atomic-text-block"
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', bg);
          el.style.setProperty('--comp-border', style.borderColor ?? '');
          el.style.setProperty('--comp-text', style.textColor ?? '');
        }
      }}
      style={{
        color: 'var(--comp-text)',
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSize}px`,
        padding: `${style.padding}px`,
        background: 'var(--comp-bg)',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        border: style.borderWidth ? `${style.borderWidth}px solid var(--comp-border)` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        textAlign: style.textAlign?.toLowerCase() as any,
        lineHeight: style.lineHeight,
        overflow: style.overflow === 'Scroll' ? 'auto' : 'hidden',
        textOverflow: style.overflow === 'Truncate' ? 'ellipsis' : undefined,
        whiteSpace: style.overflow === 'Truncate' ? 'nowrap' : 'pre-wrap',
        wordBreak: 'break-word',
        cursor: data.linkTo ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (data.linkTo) {
          window.open(data.linkTo, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {content}
    </div>
  );
});

export default Text;
