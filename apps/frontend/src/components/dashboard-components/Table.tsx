import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueryConfig } from '@btb/shared';
import { truncateTexts } from '../../hooks/useTextMeasure';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentConfig, TableConditionalRowColorRule } from '../../types/template';
import QueryErrorBanner from '../ui/QueryErrorBanner';
import { resolveBackground } from '../../utils/styleUtils';

interface TableProps {
  config: ComponentConfig;
  id?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  selectedRowId?: string | null;
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
  const availableWidth = colWidth - 32;
  const result = useMemo(() => {
    return availableWidth > 0 ? truncateTexts([str], availableWidth)[0] : { display: str, full: str, isTruncated: false };
  }, [availableWidth, str]);

  if (isEditorMode) {
    return (
      <td
        contentEditable={true}
        suppressContentEditableWarning
        onBlur={(event) => onEdit?.(event.currentTarget.textContent ?? '')}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
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
      {hover && result.isTruncated ? <div className="cell-tooltip">{result.full}</div> : null}
    </td>
  );
}

function matchesRule(row: Record<string, unknown>, rule: TableConditionalRowColorRule) {
  const candidate = row[rule.field];
  switch (rule.operator) {
    case '=':
      return String(candidate ?? '') === rule.value;
    case '!=':
      return String(candidate ?? '') !== rule.value;
    case '>':
      return Number(candidate) > Number(rule.value);
    case '<':
      return Number(candidate) < Number(rule.value);
    case 'contains':
      return String(candidate ?? '').toLowerCase().includes(rule.value.toLowerCase());
    default:
      return false;
  }
}

const Table = React.memo(function Table({ config, id, onRowClick, selectedRowId, isEditorMode = true }: TableProps) {
  const componentId = id || config.id;
  const { style, data, label } = config;
  const updateData = useEditorStore((state) => state.updateData);
  const setComponentState = useEditorStore((state) => state.setComponentState);
  const componentState = useEditorStore((state) => state.componentState);
  const queryResults = useEditorStore((state) => state.queryResults);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const boundQueryName = parseQueryName(data.dbBinding);
  const queryState = boundQueryName ? queryResults[boundQueryName] : undefined;
  const queryConfig = queriesConfig.find((query: QueryConfig) => query.name === boundQueryName) as QueryConfig | undefined;
  const selectedRow = componentState[componentId]?.selectedRow as Record<string, unknown> | null | undefined;

  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);

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
  const pageSize = 10;
  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);

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

  const measureCols = useCallback(() => {
    if (!tableRef.current || visibleColumns.length === 0) {
      return;
    }
    const widths = Array.from(tableRef.current.querySelectorAll('thead th')).map((cell) => (cell as HTMLElement).offsetWidth);
    setColWidths(widths);
  }, [visibleColumns.length]);

  useEffect(() => {
    measureCols();
    const observer = new ResizeObserver(measureCols);
    if (tableRef.current) {
      observer.observe(tableRef.current);
    }
    return () => observer.disconnect();
  }, [measureCols]);

  const handleCellEdit = (rowIndex: number, fieldKey: string, value: string) => {
    const updatedRows = rawRows.map((row, index) => (index === rowIndex ? { ...row, [fieldKey]: value } : row));
    updateData(componentId, { rows: updatedRows });
  };

  const handleRowClick = (row: Record<string, unknown>) => {
    const isSameRow = selectedRow && JSON.stringify(selectedRow) === JSON.stringify(row);
    setComponentState(componentId, 'selectedRow', isSameRow ? null : row);
    onRowClick?.(row);
  };

  const resolveRowBackground = (row: Record<string, unknown>, rowIndex: number) => {
    if (selectedRowId && String(row.id ?? row.key ?? rowIndex) === selectedRowId) {
      return style.selectedRowColor ?? 'var(--blue-50)';
    }

    if (selectedRow && JSON.stringify(selectedRow) === JSON.stringify(row)) {
      return style.selectedRowColor ?? 'var(--blue-50)';
    }

    const matchedRule = (data.conditionalRowColor ?? []).find((rule) => matchesRule(row, rule));
    if (matchedRule) {
      return matchedRule.color;
    }

    if (rowIndex % 2 === 1) {
      if (style.stripeRows && style.rowAlternateColor) return style.rowAlternateColor;
      if (style.stripeRows) return '#f8fafc';
      if (style.rowAlternateColor && style.rowAlternateColor !== 'transparent') return style.rowAlternateColor;
    }

    return 'transparent';
  };

  const shouldStrikeThrough = (row: Record<string, unknown>) =>
    Boolean(style.strikethrough && style.strikethroughField && String(row[style.strikethroughField] ?? '') === String(style.strikethroughValue ?? ''));

  return (
    <div
      className="table-component"
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', bg);
          el.style.setProperty('--comp-border', style.borderColor ?? '');
          el.style.setProperty('--comp-text', style.textColor ?? '');
        }
      }}
      style={{
        background: 'var(--comp-bg)',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
        borderColor: 'var(--comp-border)',
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      <div className="table-component-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="table-component-title" style={{ color: 'var(--comp-text)' }}>{label}</div>
        {data.searchable ? (
          <input 
            className="form-input table-search-input" 
            type="text" 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={(event) => setSearchTerm(event.target.value)} 
            style={{
              backgroundColor: style.searchBarBackground || 'var(--bg-primary)',
              color: style.searchBarTextColor || 'var(--text-primary)',
              borderColor: style.searchBarBorderColor || 'var(--border)',
              fontSize: style.fontSize ? `${Math.max(12, style.fontSize - 2)}px` : '12px',
            }}
          />
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'auto' }}>
        {queryState?.status === 'error' && queryConfig ? (
          <div className="dashboard-query-error-wrap">
            <QueryErrorBanner queryName={queryConfig.name} error={queryState.error || ''} onRetry={() => executeQuery(queryConfig)} />
          </div>
        ) : (
          <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.fieldKey} style={{ textAlign: 'left', backgroundColor: style.headerBackgroundColor }}>
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, rowIndex) => (
                <tr
                  key={String(row.id ?? row.key ?? rowIndex)}
                  onClick={() => handleRowClick(row)}
                  style={{
                    borderBottom: '1px solid var(--border)',
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
          </table>
        )}
      </div>

      {isEditorMode ? (
        <button className="table-add-row-btn" onClick={() => updateData(componentId, { rows: [...rawRows, Object.fromEntries(visibleColumns.map((column) => [column.fieldKey, '']))] })}>
          + Add Row
        </button>
      ) : null}

      {data.pagination && totalPages > 1 ? (
        <div className="table-pagination" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px' }}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}>
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
});

export default Table;
