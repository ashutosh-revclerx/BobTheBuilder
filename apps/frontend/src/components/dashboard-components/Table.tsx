import { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentConfig } from '../../types/template';
import { truncateTexts } from '../../hooks/useTextMeasure';
import { useEditorStore } from '../../store/editorStore';

interface TableProps {
  config: ComponentConfig;
  isEditorMode?: boolean;
}

function TruncatedCell({ 
  text, 
  colWidth, 
  isEditorMode,
  onEdit
}: { 
  text: string; 
  colWidth: number;
  isEditorMode?: boolean;
  onEdit?: (val: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const str = String(text ?? '');

  // Use pretext to compute pixel-perfect truncation
  const cellPad = 32; // 16px padding each side
  const availW = colWidth - cellPad;
  const result = availW > 0
    ? truncateTexts([str], availW)[0]
    : { display: str, full: str, isTruncated: false };

  if (isEditorMode) {
    return (
      <td
        contentEditable={true}
        suppressContentEditableWarning
        onBlur={(e) => onEdit?.(e.currentTarget.textContent ?? '')}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      >
        {str}
      </td>
    );
  }

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

export default function Table({ config, isEditorMode = true }: TableProps) {
  const { id, style, data, label } = config;
  const updateData = useEditorStore((s) => s.updateData);
  const columns = data.columns || [];
  const isBound = data._resolvedBindings?.['dbBinding'];
  
  // Bug 2: Source of truth is data.rows
  const rawData = isBound ? data.dbBinding : (data.rows || data.mockValue);
  const rows = (Array.isArray(rawData) ? rawData : []) as Record<string, unknown>[];

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

  const handleCellEdit = (rowIdx: number, colKey: string, value: string) => {
    const updatedRows = rows.map((row, i) =>
      i === rowIdx ? { ...row, [colKey]: value } : row
    );
    updateData(id, { rows: updatedRows });
  };

  const handleAddRow = () => {
    const blankRow = Object.fromEntries(columns.map(col => [col.fieldKey || col.key || (col as any), '']));
    updateData(id, { rows: [...rows, blankRow] });
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
        overflow: 'hidden'
      }}
    >
      <div className="table-component-header" style={{ flexShrink: 0 }}>
        <div className="table-component-title" style={{ color: style.textColor }}>
          {label}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'auto' }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.fieldKey}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIdx) => {
                  const cw = colWidths[colIdx] || 0;
                  return (
                    <TruncatedCell
                      key={col.fieldKey}
                      text={String(row[col.fieldKey] ?? '')}
                      colWidth={cw}
                      isEditorMode={isEditorMode}
                      onEdit={(val) => handleCellEdit(rowIndex, col.fieldKey, val)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
          {isEditorMode && (
            <tfoot>
              <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <button className="table-add-row-btn" onClick={handleAddRow}>
                    + Add Row
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
