import React from 'react';

const Text = ({ config }: { config: any }) => {
  const { data, style } = config;

  return (
    <div
      style={{
        color: style.textColor || '#0f1117',
        fontSize: `${style.fontSize || 14}px`,
        textAlign: (style.textAlign || 'Left').toLowerCase() as any,
        lineHeight: style.lineHeight || 1.5,
        padding: `${style.padding || 8}px`,
        whiteSpace: style.overflow === 'Wrap' ? 'pre-wrap' : 'nowrap',
        overflow: 'hidden',
        textOverflow: style.overflow === 'Truncate' ? 'ellipsis' : 'initial',
      }}
    >
      {data.mockValue}
    </div>
  );
};

export default Text;
