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
      }}
    >
      {String(data.mockValue || '')}
    </div>
  );
}
