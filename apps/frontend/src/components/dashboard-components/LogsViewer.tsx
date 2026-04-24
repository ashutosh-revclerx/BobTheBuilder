import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentConfig } from '../../types/template';

interface LogsViewerProps {
  config: ComponentConfig;
}

type LogRecord = Record<string, unknown>;

function isLogRecord(entry: unknown): entry is LogRecord {
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry);
}

export default function LogsViewer({ config }: LogsViewerProps) {
  const { style, data, label } = config;
  const isBound = data._resolvedBindings?.dbBinding;
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const [searchTerm, setSearchTerm] = useState('');

  const rawLogs = Array.isArray(rawData) ? rawData : typeof rawData === 'string' ? [rawData] : [];
  const levelColors = style.levelColors || {
    INFO: '#059669',
    WARN: '#d97706',
    ERROR: '#dc2626',
    DEBUG: '#2563eb',
  };

  const filteredLogs = useMemo(() => {
    let logs = rawLogs.slice(0, data.maxLines ?? 200);

    if (data.levelFilter && data.levelFilter !== 'all') {
      logs = logs.filter((entry) => {
        const logLevel = isLogRecord(entry) ? String(entry[data.levelField || 'level'] ?? '').toLowerCase() : String(entry).toLowerCase();
        return logLevel.includes(data.levelFilter || '');
      });
    }

    if (data.logSearchable && searchTerm) {
      logs = logs.filter((entry) => JSON.stringify(entry).toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return logs;
  }, [data.levelField, data.levelFilter, data.logSearchable, data.maxLines, rawLogs, searchTerm]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data.autoScroll !== false && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.autoScroll, filteredLogs]);

  const formatLog = (entry: unknown) => {
    if (isLogRecord(entry)) {
      const timestamp = String(entry[data.timestampField || 'timestamp'] ?? '');
      const level = String(entry[data.levelField || 'level'] ?? 'INFO').toUpperCase();
      const message = String(entry[data.messageField || 'message'] ?? '');
      return { text: `${timestamp ? `[${timestamp}] ` : ''}[${level}] ${message}`, level };
    }

    const text = String(entry);
    const match = text.match(/\[(INFO|WARN|ERROR|DEBUG)\]/i);
    return { text, level: (match?.[1] || 'INFO').toUpperCase() };
  };

  return (
    <div
      className="logs-viewer-component"
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: style.backgroundColor || '#ffffff',
        fontFamily: style.fontFamily || 'Fira Code',
        fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : '4px',
        borderColor: style.borderColor || 'var(--border)',
        borderWidth: style.borderWidth !== undefined ? `${style.borderWidth}px` : '1px',
        borderStyle: 'solid',
        padding: '0',
        height: '100%',
        overflow: 'hidden',
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
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} />
          {label || 'Terminal Logs'}
        </div>
        {data.logSearchable && (
          <input type="text" className="form-input" placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
          gap: '4px',
          minHeight: 0,
          whiteSpace: data.wrapLines ? 'pre-wrap' : 'pre',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {rawLogs.length === 0 ? 'Waiting for output...' : 'No matches found.'}
          </div>
        ) : (
          filteredLogs.map((entry, index) => {
            const formatted = formatLog(entry);
            return (
              <div key={index} style={{ color: levelColors[formatted.level as keyof typeof levelColors] || '#5c6370', lineHeight: 1.5 }}>
                {formatted.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
