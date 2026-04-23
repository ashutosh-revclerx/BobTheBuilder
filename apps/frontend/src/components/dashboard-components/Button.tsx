import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';
import { useState } from 'react';

interface ButtonProps {
  config: ComponentConfig;
}

export default function Button({ config }: ButtonProps) {
  const { style, data, label } = config;
  const queriesStore = useEditorStore((s) => s.queries);
  const editorStore = useEditorStore;
  
  // Example dbBinding: "queries.runAgent" (the target query name)
  const targetQueryName = typeof data.dbBinding === 'string' 
    ? data.dbBinding.replace('queries.', '').replace('.data', '')
    : null;

  const [localLoading, setLocalLoading] = useState(false);
  const isQueryLoading = targetQueryName ? queriesStore[targetQueryName]?.isLoading : false;
  const loading = localLoading || isQueryLoading;

  const handleClick = async () => {
    if (!targetQueryName) {
      alert('No query bound. Set a Target Query in data dbBinding.');
      return;
    }
    
    // Actually find the query config
    const state = editorStore.getState();
    const queryConfig = state.queriesConfig.find(q => q.name === targetQueryName);

    if (!queryConfig) {
      alert(`Query "${targetQueryName}" not found in current template.`);
      return;
    }

    setLocalLoading(true);
    try {
       await executeQuery(queryConfig);
    } catch(err) {
       console.error(err);
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
        overflow: 'hidden'
      }}
    >
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          backgroundColor: style.textColor || '#2563eb', // Use textColor as button main color for UI config logic simplicity
          color: '#ffffff',
          fontFamily: style.fontFamily,
          borderRadius: style.borderRadius ? `${style.borderRadius}px` : '6px',
          border: 'none',
          padding: '10px 20px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          opacity: loading ? 0.7 : 1,
          width: '100%',
          height: '100%',
          transition: 'all 0.2s',
        }}
      >
        {loading ? 'Executing...' : label}
      </button>
    </div>
  );
}
