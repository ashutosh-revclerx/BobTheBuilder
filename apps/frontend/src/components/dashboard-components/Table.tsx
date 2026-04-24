import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { truncateTexts } from '../../hooks/useTextMeasure';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName, runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentConfig, TableConditionalRowColorRule } from '../../types/template';

interface TableProps {
  config: ComponentConfig;
  isEditorMode?: boolean;
}

function TruncatedCell({
  text,
  colWidth,
  isEditorMode,
  onEdit,
  textDecoration,
}: {
  text: string;
  colWidth: number;
  isEditorMode?: boolean;
  onEdit?: (val: string) => void;
  textDecoration?: string;
}) {
  const [hover, setHover] = useState(false);
  const str = String(text ?? '');
  const cellPad = 32;
  const availW = colWidth - cellPad;
  const result = availW > 0 ? truncateTexts([str], availW)[0] : { display: str, full: str, isTruncated: false };

  if (isEditorMode) {
    return (
      <td
        contentEditable={true}
        suppressContentEditableWarning
        onBlur={(e) => onEdit?.(e.currentTarget.textContent ?? '')}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        style={{ textDecoration }}
      >
        {str}
      </td>
    );
  }

  return (
    <td
      onMouseEnter={() => result.isTruncated && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', textDecoration }}
    >
      {result.display}
      {hover && result.isTruncated && <div className="cell-tooltip">{result.full}</div>}
    </td>
  );
}

function matchesRule(row: Record<string, unknown>, rule: TableConditionalRowColorRule) {
  const candidate = row?.[rule.field];
  const value = rule.value;

  switch (rule.operator) {
    case '=':
      return String(candidate ?? '') === value;
    case '!=':
      return String(candidate ?? '') !== value;
    case '>':
      return Number(candidate) > Number(value);
    case '<':
      return Number(candidate) < Number(value);
    case 'contains':
      return String(candidate ?? '').toLowerCase().includes(value.toLowerCase());
    default:
      return false;
  }
}

export default function Table({ config, isEditorMode = true }: TableProps) {
  const { id, style, data, label } = config;
  const updateData = useEditorStore((s) => s.updateData);
  const columns = data.columns || [];
  const visibleColumns = columns.filter((column) => data.columnVisibility?.[column.fieldKey] !== false);
  const isBound = data._resolvedBindings?.dbBinding;
  const rawRows = useMemo(() => {
    if (isBound) {
      return (Array.isArray(data.dbBinding) ? data.dbBinding : []) as Record<string, unknown>[];
    }
    return (data.rows || (Array.isArray(data.mockValue) ? data.mockValue : [])) as Record<string, unknown>[];
  }, [data.dbBinding, data.mockValue, data.rows, isBound]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const pageSize = 10;

  const filteredRows = useMemo(() => {
    if (!data.searchable || !searchTerm) {
      return rawRows;
    }
    return rawRows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())));
  }, [data.searchable, rawRows, searchTerm]);

  const pagedRows = useMemo(() => {
    if (!data.pagination) {
      return filteredRows;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, data.pagination, filteredRows]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);

  const measureCols = useCallback(() => {
    if (!tableRef.current || visibleColumns.length === 0) {
      return;
    }
    const ths = tableRef.current.querySelectorAll('thead th');
    if (ths.length > 0) {
      setColWidths(Array.from(ths).map((th) => (th as HTMLElement).offsetWidth));
    }
  }, [visibleColumns.length]);

  useEffect(() => {
    measureCols();
    const observer = new ResizeObserver(measureCols);
    if (tableRef.current) {
      observer.observe(tableRef.current);
    }
    return () => observer.disconnect();
  }, [measureCols]);

  const handleCellEdit = (rowIndex: number, colKey: string, value: string) => {
    const updatedRows = rawRows.map((row, currentIndex) => (currentIndex === rowIndex ? { ...row, [colKey]: value } : row));
    updateData(id, { rows: updatedRows });
  };

  const handleAddRow = () => {
    const blankRow = Object.fromEntries(visibleColumns.map((column) => [column.fieldKey, '']));
    updateData(id, { rows: [...rawRows, blankRow] });
  };

  const handleRowClick = async (row: Record<string, unknown>, index: number) => {
    setSelectedRowIndex(index);
    runAction(data.onRowSelectAction, row);

    const targetQueryName = parseQueryName(data.dbBinding);
    if (!targetQueryName) {
      return;
    }

    const state = useEditorStore.getState();
    const queryConfig = state.queriesConfig.find((query) => query.name === targetQueryName);
    if (queryConfig) {
      await executeQuery(queryConfig);
    }
  };

  const resolveRowBackground = (row: Record<string, unknown>, rowIndex: number) => {
    const conditionalRule = (data.conditionalRowColor ?? []).find((rule) => matchesRule(row, rule));
    if (selectedRowIndex === rowIndex) {
      return '#eff6ff';
    }
    if (conditionalRule) {
      return conditionalRule.color;
    }
    if (style.rowAlternateColor && style.rowAlternateColor !== 'transparent' && rowIndex % 2 === 1) {
      return style.rowAlternateColor;
    }
    return 'transparent';
  };

  const shouldStrikeThrough = (row: Record<string, unknown>) => {
    if (!style.strikethrough || !style.strikethroughField) {
      return false;
    }
    return String(row[style.strikethroughField] ?? '') === String(style.strikethroughValue ?? '');
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
        overflow: 'hidden',
      }}
    >
      <div className="table-component-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="table-component-title" style={{ color: style.textColor }}>{label}</div>
        {data.searchable && (
          <input
            className="form-input"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'auto' }}>
        <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.fieldKey}
                  style={{
                    textAlign: 'left',
                    backgroundColor: style.headerBackgroundColor,
                  }}
                >
                  {column.name}
                </th>
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
                  backgroundColor: resolveRowBackground(row, rowIndex),
                }}
              >
                {visibleColumns.map((column, columnIndex) => (
                  <TruncatedCell
                    key={column.fieldKey}
                    text={String(row[column.fieldKey] ?? '')}
                    colWidth={colWidths[columnIndex] || 0}
                    isEditorMode={isEditorMode}
                    onEdit={(value) => handleCellEdit(rowIndex, column.fieldKey, value)}
                    textDecoration={shouldStrikeThrough(row) ? 'line-through' : undefined}
                  />
                ))}
              </tr>
            ))}
          </tbody>
          {isEditorMode && (
            <tfoot>
              <tr>
                <td colSpan={Math.max(visibleColumns.length, 1)} style={{ padding: 0 }}>
                  <button className="table-add-row-btn" onClick={handleAddRow}>
                    + Add Row
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.pagination && totalPages > 1 && (
        <div className="table-pagination" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px' }}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
