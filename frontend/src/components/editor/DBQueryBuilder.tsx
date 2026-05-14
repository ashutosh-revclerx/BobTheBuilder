import { useEffect, useState } from 'react';
import { resolve } from '../../engine/bindingResolver';

interface Table {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

interface FilterRow {
  column: string;
  operator: '=' | '!=' | '>' | '<' | 'LIKE' | 'IS NULL';
  value: string;
}

interface Props {
  resourceId: string;
  value: {
    path?: string;
    method?: string;
  };
  onChange: (value: { path: string; method: string; params?: Record<string, unknown> }) => void;
}

import { API_BASE_URL, apiFetch } from '../../config/api';

function DBQueryBuilder({ resourceId, onChange }: Props) {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch schema
  useEffect(() => {
    setSchemaLoading(true);
    apiFetch(`${API_BASE_URL}/resources/${resourceId}/schema`)
      .then((r) => r.json())
      .then((data: { tables: Table[] }) => {
        setTables(data.tables || []);
        setError('');
      })
      .catch((err) => {
        console.error('Schema fetch failed:', err);
        setError('Failed to load database schema');
        setTables([]);
      })
      .finally(() => setSchemaLoading(false));
  }, [resourceId]);

  const currentTable = tables.find((t) => t.name === selectedTable);
  const allColumns = currentTable?.columns || [];

  // Build SQL
  function buildSQL(): { sql: string; params: Record<string, unknown> } {
    if (!selectedTable) return { sql: '', params: {} };

    const cols = selectedColumns.size > 0
      ? Array.from(selectedColumns).join(', ')
      : '*';

    let sql = `SELECT ${cols} FROM ${selectedTable}`;
    const params: Record<string, unknown> = {};

    if (filters.length > 0) {
      const clauses = filters
        .filter((f) => f.column)
        .map((f, idx) => {
          const paramKey = String(idx + 1);

          if (f.operator === 'IS NULL') {
            return `${f.column} IS NULL`;
          }

          // Resolve any binding expressions in the filter value
          let resolvedValue = f.value;
          if (f.value.includes('{{')) {
            resolvedValue = String(resolve(f.value)) || f.value;
          }

          params[paramKey] = resolvedValue;
          return `${f.column} ${f.operator} $${paramKey}`;
        });

      if (clauses.length > 0) {
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }
    }

    return { sql, params };
  }

  // Update parent when query changes
  useEffect(() => {
    if (selectedTable) {
      const { sql } = buildSQL();
      onChange({ path: sql, method: 'POST' });
    }
  }, [selectedTable, selectedColumns, filters]);

  function toggleColumn(colName: string) {
    const next = new Set(selectedColumns);
    if (next.has(colName)) {
      next.delete(colName);
    } else {
      next.add(colName);
    }
    setSelectedColumns(next);
  }

  function addFilter() {
    setFilters([...filters, { column: '', operator: '=', value: '' }]);
  }

  function removeFilter(idx: number) {
    setFilters(filters.filter((_, i) => i !== idx));
  }

  function updateFilter(idx: number, field: keyof FilterRow, val: string) {
    const next = [...filters];
    (next[idx] as any)[field] = val;
    setFilters(next);
  }

  async function runPreview() {
    if (!selectedTable) return;
    setPreviewLoading(true);
    try {
      const { sql, params } = buildSQL();
      const res = await apiFetch(`${API_BASE_URL}/resources/${resourceId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params: Object.values(params) }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewRows(data.rows || []);
        setError('');
      } else {
        setError(data.details || data.error || 'Preview failed');
        setPreviewRows([]);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to run preview');
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (schemaLoading) {
    return (
      <div className="form-group" style={{ marginTop: '8px', opacity: 0.6 }}>
        Loading database schema…
      </div>
    );
  }

  return (
    <div className="form-group" style={{ marginTop: '8px' }}>
      <label className="form-label">Visual Query Builder</label>

      {/* Table picker */}
      <select
        className="form-select"
        value={selectedTable}
        onChange={(e) => {
          setSelectedTable(e.target.value);
          setSelectedColumns(new Set());
          setFilters([]);
          setPreviewRows([]);
        }}
        style={{ marginBottom: '8px' }}
      >
        <option value="">Select a table…</option>
        {tables.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>

      {selectedTable && (
        <>
          {/* Column picker */}
          <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Columns</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {allColumns.map((col) => (
                <label key={col.name} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(col.name)}
                    onChange={() => toggleColumn(col.name)}
                    style={{ marginRight: '4px' }}
                  />
                  <span>{col.name}</span>
                  <span style={{ opacity: 0.6, fontSize: '10px', marginLeft: '4px' }}>({col.type})</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          {filters.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Filters</div>
              {filters.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 1fr 32px',
                    gap: '4px',
                    marginBottom: '4px',
                    alignItems: 'center',
                  }}
                >
                  <select
                    className="form-select"
                    value={f.column}
                    onChange={(e) => updateFilter(idx, 'column', e.target.value)}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="">Column…</option>
                    {allColumns.map((col) => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    value={f.operator}
                    onChange={(e) => updateFilter(idx, 'operator', e.target.value as any)}
                    style={{ fontSize: '12px' }}
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">{'>'}</option>
                    <option value="<">{'<'}</option>
                    <option value="LIKE">LIKE</option>
                    <option value="IS NULL">IS NULL</option>
                  </select>

                  {f.operator !== 'IS NULL' && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 'active' or {{input1.value}}"
                      value={f.value}
                      onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                      style={{ fontSize: '12px' }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => removeFilter(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#e74c3c',
                      fontSize: '16px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add filter button */}
          <button
            type="button"
            onClick={addFilter}
            style={{
              background: '#f0f0f0',
              border: '1px solid #d0d0d0',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              marginBottom: '12px',
              width: '100%',
            }}
          >
            + Add Filter
          </button>

          {/* Preview button */}
          <button
            type="button"
            onClick={runPreview}
            disabled={previewLoading}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '12px',
              opacity: previewLoading ? 0.6 : 1,
            }}
          >
            {previewLoading ? 'Loading…' : '▶ Preview'}
          </button>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '8px',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#c33',
                marginBottom: '12px',
                wordBreak: 'break-word',
              }}
            >
              {error}
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div
              style={{
                fontSize: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                    {Object.keys(previewRows[0] || {}).map((key) => (
                      <th
                        key={key}
                        style={{
                          padding: '6px',
                          textAlign: 'left',
                          fontWeight: '500',
                          borderRight: '1px solid #ddd',
                        }}
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      {Object.values(row).map((val, colIdx) => (
                        <td
                          key={colIdx}
                          style={{
                            padding: '6px',
                            borderRight: '1px solid #eee',
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewRows.length === 0 && !previewLoading && !error && (
            <div style={{ fontSize: '12px', opacity: 0.6, padding: '8px' }}>
              Click Preview to see sample data
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DBQueryBuilder;
