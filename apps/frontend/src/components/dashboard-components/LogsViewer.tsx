import type { ComponentConfig } from '../../types/template';
import { useRef, useEffect } from 'react';

interface LogsViewerProps {
  config: ComponentConfig;
}

export default function LogsViewer({ config }: LogsViewerProps) {
  const { style, data, label } = config;
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  
  // Expecting an array of string logs
  const logs = Array.isArray(rawData) ? rawData : (typeof rawData === 'string' ? [rawData] : []);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (log: string) => {
    if (log.includes('[ERROR]')) return '#dc2626';
    if (log.includes('[WARN]')) return '#d97706';
    if (log.includes('[INFO]')) return '#2563eb';
    return '#5c6370';
  };

  return (
    <div
      className="logs-viewer-component"
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: style.backgroundColor || '#ffffff',
        fontFamily: style.fontFamily || 'monospace',
        fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : '4px',
        borderColor: style.borderColor || 'var(--border)',
        borderWidth: style.borderWidth !== undefined ? `${style.borderWidth}px` : '1px',
        borderStyle: 'solid',
        padding: '0',
        height: '100%',
        minHeight: '200px',
      }}
    >
      <div 
        className="logs-header"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          color: style.textColor || 'var(--text-primary)',
          fontWeight: 600,
          fontFamily: 'Inter',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
        {label || 'Terminal Logs'}
      </div>
      <div 
        ref={scrollRef}
        className="logs-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Waiting for output...</div>
        ) : (
           logs.map((log, i) => (
             <div key={i} style={{ color: getLogColor(String(log)), lineHeight: 1.5, wordBreak: 'break-all' }}>{String(log)}</div>
           ))
        )}
      </div>
    </div>
  );
}
