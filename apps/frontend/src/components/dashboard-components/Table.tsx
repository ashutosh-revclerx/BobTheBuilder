import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ComponentConfig } from '../../types/template';
import { truncateTexts } from '../../hooks/useTextMeasure';
import { executeQuery } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';

interface TableProps {
  config: ComponentConfig;
}

function TruncatedCell({ text, colWidth }: { text: string; colWidth: number }) {
  const [hover, setHover] = useState(false);
  const str = String(text ?? '');

  const cellPad = 32; 
  const availW = colWidth - cellPad;
  const result = availW > 0
    ? truncateTexts([str], availW)[0]
    : { display: str, full: str, isTruncated: false };

  return (
    <td
      onMouseEnter={() => result.isTruncated && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative' }}
    >
      {result.display}
      {hover && result.isTruncated && (
        <div className="cell-tooltip">{result.full}</div>
      )}
    </td>
  );
}

export default function Table({ config }: TableProps) {
  const { style, data, label } = config;
  const columns = data.columns || [];
  const isBound = data._resolvedBindings?.['dbBinding'];
  const rawData = isBound ? data.dbBinding : data.mockValue;
  const rawRows = (Array.isArray(rawData) ? rawData : []) as Record<string, unknown>[];

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    if (!data.searchable || !searchTerm) return rawRows;
    return rawRows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [rawRows, searchTerm, data.searchable]);

  const pagedRows = useMemo(() => {
    if (!data.pagination) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, data.pagination]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);

  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);

  const measureCols = useCallback(() => {
    if (!tableRef.current || columns.length === 0) return;
    const ths = tableRef.current.querySelectorAll('thead th');
    if (ths.length > 0) {
      const widths = Array.from(ths).map((th) => (th as HTMLElement).offsetWidth);
      setColWidths(widths);
    }
  }, [columns.length]);

  useEffect(() => {
    measureCols();
    const obs = new ResizeObserver(measureCols);
    if (tableRef.current) obs.observe(tableRef.current);
    return () => obs.disconnect();
  }, [measureCols]);

  const editorStore = useEditorStore;
  const queriesStore = useEditorStore((s) => s.queries);

  const handleRowClick = async (row: any, index: number) => {
    setSelectedRowIndex(index);
    // Current simple implementation: trigger the query bound in dbBinding if it's there
    // In a full implementation, we'd lookup Table-specific onRowClick event
    const targetQueryName = typeof data.dbBinding === 'string' 
      ? data.dbBinding.replace('{{queries.', '').replace('.data}}', '')
      : null;

    if (targetQueryName) {
      const state = editorStore.getState();
      const queryConfig = state.queriesConfig.find(q => q.name === targetQueryName);
      if (queryConfig) {
        // We could also set a local state for 'selectedRow' here
        // But for now just trigger action
        await executeQuery(queryConfig);
      }
    }
  };

  return (
    <div
      className="table-component"
      style={{
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="table-component-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
        <div className="table-component-title" style={{ color: style.textColor, fontWeight: 600 }}>
          {label}
        </div>
        {data.searchable && (
          <input 
            className="table-search-input"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e3e6ec', fontSize: '12px' }}
          />
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.fieldKey} style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #e3e6ec', backgroundColor: '#f8f9fb', fontSize: '12px', fontWeight: 600 }}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                onClick={() => handleRowClick(row, rowIndex)}
                style={{ 
                  borderBottom: '1px solid #f2f4f7', 
                  cursor: 'pointer',
                  backgroundColor: selectedRowIndex === rowIndex ? '#eff6ff' : 'transparent'
                }}
              >
                {columns.map((col, colIdx) => {
                  const cw = colWidths[colIdx] || 0;
                  return (
                    <TruncatedCell
                      key={col.fieldKey}
                      text={String(row[col.fieldKey] ?? '')}
                      colWidth={cw}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.pagination && totalPages > 1 && (
        <div className="table-pagination" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid #e3e6ec' }}>
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            style={{ padding: '2px 8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            Prev
          </button>
          <span style={{ fontSize: '12px', color: '#5c6370' }}>Page {currentPage} of {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            style={{ padding: '2px 8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
