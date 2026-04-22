import { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentConfig } from '../../types/template';
import { truncateTexts } from '../../hooks/useTextMeasure';

interface TableProps {
  config: ComponentConfig;
}

function TruncatedCell({ text, colWidth }: { text: string; colWidth: number }) {
  const [hover, setHover] = useState(false);
  const str = String(text ?? '');

  // Use pretext to compute pixel-perfect truncation
  const cellPad = 32; // 16px padding each side
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
  const rows = (Array.isArray(data.mockValue) ? data.mockValue : []) as Record<string, unknown>[];

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
      }}
    >
      <div className="table-component-header">
        <div className="table-component-title" style={{ color: style.textColor }}>
          {label}
        </div>
      </div>
      <table ref={tableRef}>
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
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
