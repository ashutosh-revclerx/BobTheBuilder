import type { ComponentConfig } from '../../types/template';
import { evaluateExpression } from '../../engine/runtimeUtils';

export default function Text({ config }: { config: ComponentConfig }) {
  const { style, data } = config;
  const resolvedValue = data.expression ? evaluateExpression(String(data.mockValue ?? ''), '') : data.mockValue;
  const content = String(resolvedValue ?? '');

  return (
    <div
      className="atomic-text-block"
      style={{
        color: style.textColor,
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSize}px`,
        padding: `${style.padding}px`,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#000000'}` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        textAlign: style.textAlign?.toLowerCase() as any,
        lineHeight: style.lineHeight,
        overflow: style.overflow === 'Scroll' ? 'auto' : 'hidden',
        textOverflow: style.overflow === 'Truncate' ? 'ellipsis' : undefined,
        whiteSpace: style.overflow === 'Wrap' ? 'normal' : 'nowrap',
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
}
