import React from 'react';
import { useAppState } from '../StateManager';
import { useQueryEngine } from '../QueryEngine';

const Button = ({ config }: { config: any }) => {
  const { data, style } = config;
  const { setComponentState } = useAppState();
  // Note: queries will be passed from App.tsx
  // For simplicity in this demo, we assume queries are available or handled by a hook
  
  const handleClick = () => {
    if (data.events) {
      data.events.forEach((event: any) => {
        if (event.type === 'onClick') {
          // Action handling logic would go here
          console.log('Action:', event.action, 'Target:', event.target);
        }
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={data.disabled === 'true'}
      style={{
        backgroundColor: style.backgroundColor || '#2563eb',
        color: style.textColor || '#ffffff',
        padding: `${style.padding || 8}px 16px`,
        borderRadius: `${style.borderRadius || 4}px`,
        border: 'none',
        cursor: 'pointer',
        width: style.fullWidth ? '100%' : 'auto',
        fontSize: `${style.fontSize || 14}px`,
      }}
    >
      {data.label || config.label}
    </button>
  );
};

export default Button;
