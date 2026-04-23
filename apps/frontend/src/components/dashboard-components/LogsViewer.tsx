import type { ComponentConfig } from '../../types/template';
import { useRef, useEffect, useState, useMemo } from 'react';

interface LogsViewerProps {
  config: ComponentConfig;
}

export default function LogsViewer({ config }: LogsViewerProps) {
  const { style, data, label } = config;
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  
  const rawLogs = Array.isArray(rawData) ? rawData : (typeof rawData === 'string' ? [rawData] : []);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredLogs = useMemo(() => {
    let result = rawLogs;
    
    // Level filter
    if (data.levelFilter && data.levelFilter !== 'all') {
      const target = `[${data.levelFilter.toUpperCase()}]`;
      result = result.filter(log => String(log).includes(target));
    }
    
    // Search filter
    if (data.logSearchable && searchTerm) {
      result = result.filter(log => String(log).toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return result;
  }, [rawLogs, data.levelFilter, data.logSearchable, searchTerm]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs]);

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
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
          {label || 'Terminal Logs'}
        </div>
        {data.logSearchable && (
          <input 
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              backgroundColor: '#f8f9fb',
              border: '1px solid var(--border)',
              borderRadius: '4px', 
              padding: '2px 8px',
              fontSize: '11px',
              outline: 'none',
              width: '120px'
            }}
          />
        )}
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
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {rawLogs.length === 0 ? 'Waiting for output...' : 'No matches found.'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
             <div key={i} style={{ color: getLogColor(String(log)), lineHeight: 1.5, wordBreak: 'break-all' }}>{String(log)}</div>
          ))
        )}
      </div>
    </div>
  );
}
