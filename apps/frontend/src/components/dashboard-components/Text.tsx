import type { ComponentConfig } from '../../types/template';

export default function Text({ config }: { config: ComponentConfig }) {
  const { style, data } = config;

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
        flexDirection: 'column'
      }}
    >
      {String(data.mockValue || '')}
    </div>
  );
}
