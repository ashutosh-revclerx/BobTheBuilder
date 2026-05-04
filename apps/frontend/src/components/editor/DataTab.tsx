import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import EndpointPicker from '../ui/EndpointPicker';
import type {
  ComponentData,
  SelectOptionItem,
  TableColumn,
  TableConditionalRowColorRule,
} from '../../types/template';

const API_BASE = 'http://localhost:3001';

interface ResourceListItem {
  id:   string;
  name: string;
  type: string;
}

interface QueryBinding {
  resourceId?:   string;
  resourceName?: string;
  method?:       string;
  path?:         string;
  parameters?:   unknown[];
  trigger?:      'onLoad' | 'manual' | 'onDependencyChange';
  queryName?:    string;
}

function QueryBindingSection({
  componentId,
  binding,
  onChange,
}: {
  componentId: string;
  binding: QueryBinding;
  onChange: (next: QueryBinding) => void;
}) {
  const [resources, setResources] = useState<ResourceListItem[]>([]);
  const upsertQuery = useEditorStore((s) => s.upsertQuery);
  const updateData  = useEditorStore((s) => s.updateData);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/resources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ResourceListItem[]) => {
        if (!cancelled) setResources(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setResources([]); });
    return () => { cancelled = true; };
  }, []);

  // Stable per-component query name. We use the component id so reopening the
  // editor wires the same component back to the same query record.
  const queryName = binding.queryName ?? `${componentId}_query`;

  const syncQuery = (next: QueryBinding) => {
    onChange(next);

    // We need a resource AND a path to make a runnable query.
    if (!next.resourceName || !next.path) return;

    const trigger = next.trigger ?? (next.method === 'GET' ? 'onLoad' : 'manual');
    upsertQuery({
      name:     queryName,
      resource: next.resourceName,
      endpoint: next.path,
      method:   next.method ?? 'GET',
      trigger,
    });

    // Auto-bind the component so it reads from the query result. For Buttons
    // we use the trigger path so onClick fires the query.
    const bindingPath = trigger === 'manual'
      ? `{{queries.${queryName}.trigger}}`
      : `{{queries.${queryName}.data}}`;
    updateData(componentId, { dbBinding: bindingPath } as Partial<ComponentData>);
  };

  const selectedResource = resources.find((r) => r.id === binding.resourceId);

  return (
    <div className="form-group query-binding-section">
      <span className="form-label">Query bindings</span>

      <select
        className="form-select"
        value={binding.resourceId ?? ''}
        onChange={(e) => {
          const id = e.target.value || undefined;
          const resource = resources.find((r) => r.id === id);
          syncQuery({ ...binding, resourceId: id, resourceName: resource?.name });
        }}
      >
        <option value="">Pick a resource…</option>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
        ))}
      </select>

      {selectedResource?.type === 'postgresql' ? (
        <div className="form-group" style={{ marginTop: '8px' }}>
          <label className="form-label" style={{ fontSize: '10px', opacity: 0.7 }}>SQL Query</label>
          <textarea
            className="form-textarea"
            style={{ fontFamily: 'monospace', minHeight: '80px' }}
            placeholder="SELECT * FROM users WHERE id = {{components.input1.value}}"
            value={binding.path ?? ''}
            onChange={(e) => syncQuery({ ...binding, method: 'POST', path: e.target.value, queryName })}
          />
        </div>
      ) : (
        <EndpointPicker
          resourceId={binding.resourceId ?? null}
          selectedMethod={binding.method ?? 'GET'}
          selectedPath={binding.path ?? ''}
          onChange={(next) => syncQuery({ ...binding, ...next, queryName })}
        />
      )}

      {binding.path && (
        <select
          className="form-select"
          value={binding.trigger ?? (binding.method === 'GET' ? 'onLoad' : 'manual')}
          onChange={(e) => syncQuery({ ...binding, trigger: e.target.value as QueryBinding['trigger'] })}
        >
          <option value="onLoad">Trigger: on page load</option>
          <option value="manual">Trigger: manual (e.g. button click)</option>
          <option value="onDependencyChange">Trigger: on dependency change</option>
        </select>
      )}

      {binding.path && (
        <p className="endpoint-picker-hint">
          Wired to query <code>{queryName}</code>
        </p>
      )}
    </div>
  );
}

const ROLE_OPTIONS = ['admin', 'editor', 'viewer'] as const;
const CONDITION_OPERATORS: TableConditionalRowColorRule['operator'][] = ['=', '!=', '>', '<', 'contains'];

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <FormField label={label}>
      <select className="form-select" value={value ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </FormField>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <FormField label={label}>
      <input
        type={type}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FormField>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <FormField label={label}>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export default function DataTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateData = useEditorStore((s) => s.updateData);

  const selectedComponent = components.find((component) => component.id === lastSelectedComponentId);
  if (!selectedComponent) {
    return null;
  }

  const { data, type } = selectedComponent;
  const rows = data.rows ?? (Array.isArray(data.mockValue) ? (data.mockValue as Record<string, any>[]) : []);
  const columns = (data.columns ?? []) as TableColumn[];
  const visibleRoles = selectedComponent.visibleForRoles ?? data.visibleForRoles ?? [];
  const isTable = type === 'Table';
  const isChart = type === 'BarChart' || type === 'LineChart';
  const tabs = data.tabs ?? [];
  const optionsList = data.optionsList ?? [];

  const mockValueDisplay = useMemo(() => {
    if (isTable || isChart) {
      return JSON.stringify(isTable ? rows : data.mockValue, null, 2);
    }
    if (Array.isArray(data.mockValue) || typeof data.mockValue === 'object') {
      return JSON.stringify(data.mockValue, null, 2);
    }
    return String(data.mockValue ?? '');
  }, [data.mockValue, isChart, isTable, rows]);

  const handleDataField = (key: keyof ComponentData | 'label' | 'visible' | 'visibleForRoles', value: unknown) => {
    if (!lastSelectedComponentId) {
      return;
    }
    updateData(lastSelectedComponentId, { [key]: value } as Partial<ComponentData>);
  };

  const handleMockValueChange = (rawValue: string) => {
    if (isTable || isChart || type === 'StatCard') {
      try {
        const parsed = JSON.parse(rawValue);
        if (isTable) {
          handleDataField('rows', parsed);
        }
        handleDataField('mockValue', parsed);
        return;
      } catch {
        if (isTable || isChart) {
          return;
        }
      }
    }
    handleDataField('mockValue', rawValue);
  };

  const handleColumnChange = (index: number, field: keyof TableColumn, value: string) => {
    const next = [...columns];
    next[index] = { ...next[index], [field]: value };
    handleDataField('columns', next);
    handleDataField(
      'columnVisibility',
      next.reduce<Record<string, boolean>>((acc, column) => {
        acc[column.fieldKey] = data.columnVisibility?.[column.fieldKey] ?? true;
        return acc;
      }, {}),
    );
  };

  const handleTableRowChange = (rowIndex: number, fieldKey: string, value: string) => {
    const nextRows = [...rows];
    nextRows[rowIndex] = { ...nextRows[rowIndex], [fieldKey]: value };
    handleDataField('rows', nextRows);
    handleDataField('mockValue', nextRows);
  };

  const handleTableAddRow = () => {
    const newRow = Object.fromEntries(columns.map((col) => [col.fieldKey, '']));
    const nextRows = [...rows, newRow];
    handleDataField('rows', nextRows);
    handleDataField('mockValue', nextRows);
  };

  const handleTableDeleteRow = (rowIndex: number) => {
    const nextRows = rows.filter((_, index) => index !== rowIndex);
    handleDataField('rows', nextRows);
    handleDataField('mockValue', nextRows);
  };

  const handleConditionalRowRuleChange = (
    index: number,
    field: keyof TableConditionalRowColorRule,
    value: string,
  ) => {
    const next = [...(data.conditionalRowColor ?? [])];
    next[index] = { ...next[index], [field]: value };
    handleDataField('conditionalRowColor', next);
  };

  const handleOptionListChange = (index: number, field: keyof SelectOptionItem, value: string) => {
    const next = [...optionsList];
    next[index] = { ...next[index], [field]: value };
    handleDataField('optionsList', next);
    handleDataField('options', next.map((option) => option.label));
  };

  const renderRoleCheckboxes = (
    <div className="mini-editor">
      {ROLE_OPTIONS.map((role) => (
        <label key={role} className="mini-editor-row">
          <input
            type="checkbox"
            checked={visibleRoles.includes(role)}
            onChange={(e) =>
              handleDataField(
                'visibleForRoles',
                e.target.checked ? [...visibleRoles, role] : visibleRoles.filter((currentRole) => currentRole !== role),
              )
            }
          />
          <span className="form-label">{role}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div>
      <TextField
        label="Display Label"
        value={selectedComponent.label}
        onChange={(value) => handleDataField('label', value)}
        placeholder="Component label"
      />

      <TextField
        label="Visible"
        value={String(selectedComponent.visible ?? data.visible ?? 'true')}
        onChange={(value) => handleDataField('visible', value)}
        placeholder="{{expression}} or true"
      />

      <FormField label="Visible for roles">{renderRoleCheckboxes}</FormField>

      <FormField label="Mock Value">
        {isTable || isChart ? (
          <textarea
            className="form-textarea"
            value={mockValueDisplay}
            onChange={(e) => handleMockValueChange(e.target.value)}
            placeholder="JSON array"
            rows={5}
          />
        ) : (
          <input
            type="text"
            className="form-input"
            value={mockValueDisplay}
            onChange={(e) => handleMockValueChange(e.target.value)}
            placeholder="Display value"
          />
        )}
      </FormField>

      <TextField
        label="DB Field Binding"
        value={String(data.dbBinding ?? '')}
        onChange={(value) => handleDataField('dbBinding', value)}
        placeholder="e.g. {{queries.getData.data}}"
      />

      <QueryBindingSection
        componentId={selectedComponent.id}
        binding={(data.queryBindingConfig as QueryBinding) ?? {}}
        onChange={(next) => handleDataField('queryBindingConfig' as keyof ComponentData, next)}
      />

      <SelectField
        label="Refresh Trigger"
        value={data.refreshOn || 'manual'}
        onChange={(value) => handleDataField('refreshOn', value)}
        options={['manual', 'onLoad', 'onRowSelect']}
      />

      {type === 'StatCard' && (
        <>
          <TextField label="Trend Value" value={data.trend ?? ''} onChange={(value) => handleDataField('trend', value)} />
          <SelectField
            label="Trend Type"
            value={data.trendType || 'positive'}
            onChange={(value) => handleDataField('trendType', value)}
            options={['positive', 'negative', 'neutral']}
          />
          <TextField label="Value prefix" value={data.prefix ?? ''} onChange={(value) => handleDataField('prefix', value)} />
          <TextField label="Value suffix" value={data.suffix ?? ''} onChange={(value) => handleDataField('suffix', value)} />
          <TextField
            label="Comparison value"
            value={data.comparisonValue ?? ''}
            onChange={(value) => handleDataField('comparisonValue', value)}
          />
          <FormField label="Sparkline data">
            <textarea
              className="form-textarea"
              value={JSON.stringify(data.sparklineData ?? [], null, 2)}
              onChange={(e) => {
                try {
                  handleDataField('sparklineData', JSON.parse(e.target.value));
                } catch {
                  // Ignore invalid JSON while typing.
                }
              }}
              placeholder="[10,20,15,30,25]"
              rows={4}
            />
          </FormField>
        </>
      )}

      {isTable && (
        <>
          {/* ── Behavior ───────────────────────────────────── */}
          <div className="panel-section-divider">Behavior</div>

          <BooleanField label="Searchable" value={data.searchable !== false} onChange={(value) => handleDataField('searchable', value)} />
          <BooleanField label="Pagination" value={data.pagination !== false} onChange={(value) => handleDataField('pagination', value)} />
          <BooleanField label="Allow adding rows" value={data.allowAddRows === true} onChange={(value) => handleDataField('allowAddRows', value)} />
          <TextField
            label="On row select → variable"
            value={data.onRowSelectAction ?? ''}
            onChange={(value) => handleDataField('onRowSelectAction', value)}
            placeholder="e.g. selectedUser"
          />

          {/* ── Columns ────────────────────────────────────── */}
          <div className="panel-section-divider">Columns</div>

          <div className="mini-editor">
            {/* header hint */}
            {columns.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '4px', padding: '0 0 4px 0' }}>
                <span className="form-label" style={{ fontSize: '10px', opacity: 0.6 }}>Display Name</span>
                <span className="form-label" style={{ fontSize: '10px', opacity: 0.6 }}>Field Key</span>
                <span className="form-label" style={{ fontSize: '10px', opacity: 0.6 }}>Visible</span>
                <span />
              </div>
            )}

            {columns.map((column, index) => (
              <div key={`${column.fieldKey}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '4px', marginBottom: '6px', alignItems: 'center' }}>
                <input
                  className="form-input"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  value={column.name}
                  onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                  placeholder="Name"
                />
                <input
                  className="form-input"
                  style={{ fontSize: '11px', padding: '4px 6px', fontFamily: 'monospace', color: 'var(--blue-400)' }}
                  value={column.fieldKey}
                  onChange={(e) => handleColumnChange(index, 'fieldKey', e.target.value)}
                  placeholder="field_key"
                />
                <input
                  type="checkbox"
                  title="Visible"
                  style={{ width: '14px', height: '14px', cursor: 'pointer', margin: '0 auto' }}
                  checked={data.columnVisibility?.[column.fieldKey] !== false}
                  onChange={(e) =>
                    handleDataField('columnVisibility', {
                      ...(data.columnVisibility ?? {}),
                      [column.fieldKey]: e.target.checked,
                    })
                  }
                />
                <button
                  className="mini-editor-delete"
                  title="Remove column"
                  onClick={() => handleDataField('columns', columns.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}

            <button
              className="mini-editor-add"
              onClick={() => handleDataField('columns', [...columns, { name: '', fieldKey: '' }])}
            >
              + Add Column
            </button>
          </div>

          {/* ── Rows (Data) ────────────────────────────────────── */}
          <div className="panel-section-divider">Rows (Data)</div>

          <div className="mini-editor">
            {rows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} style={{ 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border)', 
                borderRadius: '6px', 
                padding: '8px', 
                marginBottom: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Row {rowIndex + 1}</span>
                  <button className="mini-editor-delete" title="Delete row" onClick={() => handleTableDeleteRow(rowIndex)}>×</button>
                </div>
                
                {columns.filter(c => c.fieldKey).map((column) => (
                  <div key={column.fieldKey} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '80px', fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={column.name || column.fieldKey}>
                      {column.name || column.fieldKey}
                    </span>
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 0, fontSize: '11px', padding: '4px 6px' }}
                      value={String(row[column.fieldKey] ?? '')}
                      onChange={(e) => handleTableRowChange(rowIndex, column.fieldKey, e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                ))}
              </div>
            ))}
            
            <button className="mini-editor-add" onClick={handleTableAddRow}>
              + Add Row
            </button>
          </div>

          {/* ── Conditional Row Colours ─────────────────────── */}
          <div className="panel-section-divider">Conditional Row Colors</div>

          <div className="mini-editor">
            {(data.conditionalRowColor ?? []).map((rule, index) => (
              <div
                key={`rule-${index}`}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {/* row 1: field + operator + value */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1, minWidth: 0, fontSize: '11px', padding: '4px 6px' }}
                    value={rule.field}
                    onChange={(e) => handleConditionalRowRuleChange(index, 'field', e.target.value)}
                    placeholder="Field"
                  />
                  <select
                    className="form-select"
                    style={{ flex: '0 0 56px', fontSize: '11px', padding: '4px 4px' }}
                    value={rule.operator}
                    onChange={(e) => handleConditionalRowRuleChange(index, 'operator', e.target.value)}
                  >
                    {CONDITION_OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    style={{ flex: 1, minWidth: 0, fontSize: '11px', padding: '4px 6px' }}
                    value={rule.value}
                    onChange={(e) => handleConditionalRowRuleChange(index, 'value', e.target.value)}
                    placeholder="Value"
                  />
                </div>
                {/* row 2: color label + swatch + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="form-label" style={{ flex: 1, fontSize: '10px' }}>Row color</span>
                  <input
                    type="color"
                    className="color-swatch-input"
                    value={rule.color}
                    onChange={(e) => handleConditionalRowRuleChange(index, 'color', e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{rule.color}</span>
                  <button
                    className="mini-editor-delete"
                    title="Remove rule"
                    onClick={() =>
                      handleDataField(
                        'conditionalRowColor',
                        (data.conditionalRowColor ?? []).filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <button
              className="mini-editor-add"
              onClick={() =>
                handleDataField('conditionalRowColor', [
                  ...(data.conditionalRowColor ?? []),
                  { field: '', operator: '=', value: '', color: '#eff6ff' },
                ])
              }
            >
              + Add Rule
            </button>
          </div>
        </>
      )}

      {isChart && (
        <>
          <TextField label="X Field" value={data.xField ?? ''} onChange={(value) => handleDataField('xField', value)} />
          <TextField label="Y Field" value={data.yField ?? ''} onChange={(value) => handleDataField('yField', value)} />
          <BooleanField label="Show legend" value={data.showLegend !== false} onChange={(value) => handleDataField('showLegend', value)} />
          <BooleanField label="Show grid" value={data.showGrid !== false} onChange={(value) => handleDataField('showGrid', value)} />
          <TextField label="X axis label" value={data.xAxisLabel ?? ''} onChange={(value) => handleDataField('xAxisLabel', value)} />
          <TextField label="Y axis label" value={data.yAxisLabel ?? ''} onChange={(value) => handleDataField('yAxisLabel', value)} />
          <SelectField
            label="Color scheme"
            value={data.colorScheme || 'Blue'}
            onChange={(value) => handleDataField('colorScheme', value)}
            options={['Blue', 'Green', 'Amber', 'Multi']}
          />
          <FormField label="Series">
            <div className="mini-editor">
              {(data.series ?? []).map((series, index) => (
                <div key={`${series.fieldKey}-${index}`} className="mini-editor-row">
                  <input
                    value={series.name}
                    onChange={(e) =>
                      handleDataField(
                        'series',
                        (data.series ?? []).map((current, currentIndex) =>
                          currentIndex === index ? { ...current, name: e.target.value } : current,
                        ),
                      )
                    }
                    placeholder="Series name"
                  />
                  <input
                    value={series.fieldKey}
                    onChange={(e) =>
                      handleDataField(
                        'series',
                        (data.series ?? []).map((current, currentIndex) =>
                          currentIndex === index ? { ...current, fieldKey: e.target.value } : current,
                        ),
                      )
                    }
                    placeholder="Field key"
                  />
                  <button
                    className="mini-editor-delete"
                    onClick={() => handleDataField('series', (data.series ?? []).filter((_, currentIndex) => currentIndex !== index))}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                className="mini-editor-add"
                onClick={() => handleDataField('series', [...(data.series ?? []), { name: '', fieldKey: '' }])}
              >
                + Add series
              </button>
            </div>
          </FormField>
        </>
      )}

      {type === 'BarChart' && (
        <>
          <SelectField
            label="Orientation"
            value={data.orientation || 'Vertical'}
            onChange={(value) => handleDataField('orientation', value)}
            options={['Vertical', 'Horizontal']}
          />
          <BooleanField label="Stacked" value={data.stacked === true} onChange={(value) => handleDataField('stacked', value)} />
          <TextField
            label="On bar click -> set variable"
            value={data.onBarClickAction ?? ''}
            onChange={(value) => handleDataField('onBarClickAction', value)}
          />
        </>
      )}

      {type === 'LineChart' && (
        <>
          <BooleanField label="Smooth" value={data.smooth !== false} onChange={(value) => handleDataField('smooth', value)} />
          <BooleanField label="Show dots" value={data.showDots !== false} onChange={(value) => handleDataField('showDots', value)} />
          <BooleanField label="Fill area" value={data.fillArea === true} onChange={(value) => handleDataField('fillArea', value)} />
          <TextField
            label="On point click -> set variable"
            value={data.onPointClickAction ?? ''}
            onChange={(value) => handleDataField('onPointClickAction', value)}
          />
        </>
      )}

      {type === 'StatusBadge' && (
        <>
          <FormField label="Status -> Color Mapping">
            <div className="mini-editor">
              {Object.entries(data.mapping ?? {}).map(([key, color]) => (
                <div key={key} className="mini-editor-row">
                  <input
                    value={key}
                    onChange={(e) => {
                      const next = { ...(data.mapping ?? {}) };
                      delete next[key];
                      next[e.target.value] = color;
                      handleDataField('mapping', next);
                    }}
                    placeholder="Status value"
                  />
                  <input
                    type="color"
                    className="color-swatch-input"
                    value={color}
                    onChange={(e) => handleDataField('mapping', { ...(data.mapping ?? {}), [key]: e.target.value })}
                  />
                  <button
                    className="mini-editor-delete"
                    onClick={() => {
                      const next = { ...(data.mapping ?? {}) };
                      delete next[key];
                      handleDataField('mapping', next);
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
              <button className="mini-editor-add" onClick={() => handleDataField('mapping', { ...(data.mapping ?? {}), New: '#3b82f6' })}>
                + Add mapping
              </button>
            </div>
          </FormField>
          <TextField label="Default color" value={data.defaultColor ?? '#9ba3af'} onChange={(value) => handleDataField('defaultColor', value)} />
          <BooleanField label="Show dot" value={data.showDot !== false} onChange={(value) => handleDataField('showDot', value)} />
          <SelectField
            label="Size"
            value={data.size || 'Medium'}
            onChange={(value) => handleDataField('size', value)}
            options={['Small', 'Medium', 'Large']}
          />
        </>
      )}

      {type === 'LogsViewer' && (
        <>
          <SelectField
            label="Level Filter"
            value={data.levelFilter || 'all'}
            onChange={(value) => handleDataField('levelFilter', value)}
            options={['all', 'info', 'warn', 'error']}
          />
          <BooleanField label="Searchable" value={data.logSearchable !== false} onChange={(value) => handleDataField('logSearchable', value)} />
          <TextField label="Max lines" value={String(data.maxLines ?? 200)} onChange={(value) => handleDataField('maxLines', Number(value))} type="number" />
          <BooleanField label="Auto-scroll" value={data.autoScroll !== false} onChange={(value) => handleDataField('autoScroll', value)} />
          <TextField
            label="Timestamp field"
            value={data.timestampField ?? 'timestamp'}
            onChange={(value) => handleDataField('timestampField', value)}
          />
          <TextField label="Level field" value={data.levelField ?? 'level'} onChange={(value) => handleDataField('levelField', value)} />
          <TextField
            label="Message field"
            value={data.messageField ?? 'message'}
            onChange={(value) => handleDataField('messageField', value)}
          />
          <BooleanField label="Wrap lines" value={data.wrapLines === true} onChange={(value) => handleDataField('wrapLines', value)} />
        </>
      )}

      {type === 'Container' && (
        <>
          <SelectField
            label="Layout Direction"
            value={data.containerLayout || 'vertical'}
            onChange={(value) => handleDataField('containerLayout', value)}
            options={['vertical', 'horizontal']}
          />
          <TextField label="Gap" value={String(data.gap ?? 10)} onChange={(value) => handleDataField('gap', Number(value))} type="number" />
          <BooleanField label="Scrollable" value={data.scrollable === true} onChange={(value) => handleDataField('scrollable', value)} />
          <BooleanField label="Divider" value={data.divider === true} onChange={(value) => handleDataField('divider', value)} />
        </>
      )}

      {type === 'TabbedContainer' && (
        <>
          <FormField label="Tabs">
            <div className="mini-editor">
              {tabs.map((tab, index) => (
                <div key={`${tab}-${index}`} className="mini-editor-row">
                  <input
                    value={tab}
                    onChange={(e) =>
                      handleDataField(
                        'tabs',
                        tabs.map((currentTab, currentIndex) => (currentIndex === index ? e.target.value : currentTab)),
                      )
                    }
                    placeholder="Tab name"
                  />
                  <button
                    className="mini-editor-delete"
                    onClick={() => handleDataField('tabs', tabs.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    x
                  </button>
                </div>
              ))}
              <button className="mini-editor-add" onClick={() => handleDataField('tabs', [...tabs, `Tab ${tabs.length + 1}`])}>
                + New tab
              </button>
            </div>
          </FormField>
          <SelectField
            label="Default Tab"
            value={data.defaultTab || tabs[0] || ''}
            onChange={(value) => handleDataField('defaultTab', value)}
            options={tabs.length ? tabs : ['View 1']}
          />
          <TextField
            label="On tab change -> set variable"
            value={data.onTabChangeAction ?? ''}
            onChange={(value) => handleDataField('onTabChangeAction', value)}
          />
        </>
      )}

      {type === 'Text' && (
        <>
          <BooleanField label="Dynamic expression" value={data.expression === true} onChange={(value) => handleDataField('expression', value)} />
          <TextField label="Link URL" value={data.linkTo ?? ''} onChange={(value) => handleDataField('linkTo', value)} />
        </>
      )}

      {type === 'Embed' && (
        <>
          <TextField
            label="URL to embed"
            value={data.src ?? ''}
            onChange={(value) => handleDataField('src', value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <FormField label="">
            <p className="endpoint-picker-hint" style={{ marginTop: -4 }}>
              YouTube and Vimeo "watch" URLs are auto-converted to embed URLs.
              For other sites, paste a URL that allows iframing (most public
              pages do; some block it via X-Frame-Options).
            </p>
          </FormField>
        </>
      )}

      {type === 'Image' && (
        <>
          <TextField
            label="Image URL"
            value={data.src ?? ''}
            onChange={(value) => {
              handleDataField('src', value);
              // Picking a URL clears any prior upload so they don't fight.
              if (value && data.uploadedSrc) handleDataField('uploadedSrc', '');
            }}
            placeholder="https://example.com/image.png"
          />
          <FormField label="Or upload a file (max 500 KB)">
            <div className="image-upload-row">
              <input
                type="file"
                accept="image/*"
                className="image-upload-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 500 * 1024) {
                    alert('Image is larger than 500 KB. Please pick a smaller file or use a URL instead.');
                    e.currentTarget.value = '';
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      handleDataField('uploadedSrc', reader.result);
                      // Uploads take precedence over URL — but keep the URL
                      // around so the user can revert by clearing the upload.
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {data.uploadedSrc && (
                <button
                  type="button"
                  className="mini-editor-delete"
                  onClick={() => handleDataField('uploadedSrc', '')}
                  title="Remove uploaded image"
                >
                  Clear upload
                </button>
              )}
            </div>
          </FormField>
          <TextField
            label="Alt text"
            value={data.alt ?? ''}
            onChange={(value) => handleDataField('alt', value)}
            placeholder="Describe the image (accessibility)"
          />
          <SelectField
            label="Fit"
            value={data.fit || 'contain'}
            onChange={(value) => handleDataField('fit', value)}
            options={['contain', 'cover', 'fill', 'none', 'scale-down']}
          />
          <TextField
            label="Link URL (optional)"
            value={data.linkTo ?? ''}
            onChange={(value) => handleDataField('linkTo', value)}
            placeholder="Open this URL on click"
          />
        </>
      )}

      {type === 'TextInput' && (
        <>
          <TextField label="Placeholder" value={data.placeholder ?? ''} onChange={(value) => handleDataField('placeholder', value)} />
          <SelectField
            label="Type"
            value={data.type || 'Text'}
            onChange={(value) => handleDataField('type', value)}
            options={['Text', 'Email', 'Password', 'URL', 'Search']}
          />
          <BooleanField label="Required" value={data.required === true} onChange={(value) => handleDataField('required', value)} />
          <TextField label="Validation pattern" value={data.regex ?? ''} onChange={(value) => handleDataField('regex', value)} />
          <TextField label="Error message" value={data.errorMessage ?? 'Invalid input'} onChange={(value) => handleDataField('errorMessage', value)} />
          <TextField
            label="Max length"
            value={String(data.maxLength ?? '')}
            onChange={(value) => handleDataField('maxLength', value ? Number(value) : null)}
            type="number"
          />
          <TextField
            label="On change -> set variable"
            value={data.onChangeAction ?? ''}
            onChange={(value) => handleDataField('onChangeAction', value)}
          />
          <TextField
            label="On submit -> run query"
            value={data.onSubmitAction ?? ''}
            onChange={(value) => handleDataField('onSubmitAction', value)}
          />
        </>
      )}

      {type === 'Select' && (
        <>
          <BooleanField label="Required" value={data.required === true} onChange={(value) => handleDataField('required', value)} />
          <BooleanField label="Multi-select" value={data.multiSelect === true} onChange={(value) => handleDataField('multiSelect', value)} />
          <BooleanField label="Searchable" value={data.searchable === true} onChange={(value) => handleDataField('searchable', value)} />
          <TextField
            label="On change -> set variable"
            value={data.onChangeAction ?? ''}
            onChange={(value) => handleDataField('onChangeAction', value)}
          />
          <SelectField
            label="Options Source"
            value={data.optionsSource || 'Static'}
            onChange={(value) => handleDataField('optionsSource', value)}
            options={['Static', 'From query']}
          />
          {data.optionsSource === 'From query' ? (
            <>
              <TextField label="Query name" value={data.queryBinding ?? ''} onChange={(value) => handleDataField('queryBinding', value)} />
              <TextField label="Label field" value={data.labelField ?? 'label'} onChange={(value) => handleDataField('labelField', value)} />
              <TextField label="Value field" value={data.valueField ?? 'value'} onChange={(value) => handleDataField('valueField', value)} />
            </>
          ) : (
            <FormField label="Options">
              <div className="mini-editor">
                {optionsList.map((option, index) => (
                  <div key={`${option.value}-${index}`} className="mini-editor-row">
                    <input value={option.label} onChange={(e) => handleOptionListChange(index, 'label', e.target.value)} placeholder="Label" />
                    <input value={option.value} onChange={(e) => handleOptionListChange(index, 'value', e.target.value)} placeholder="Value" />
                    <button
                      className="mini-editor-delete"
                      onClick={() => {
                        const next = optionsList.filter((_, currentIndex) => currentIndex !== index);
                        handleDataField('optionsList', next);
                        handleDataField('options', next.map((optionItem) => optionItem.label));
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  className="mini-editor-add"
                  onClick={() => handleDataField('optionsList', [...optionsList, { label: '', value: '' }])}
                >
                  + Add option
                </button>
              </div>
            </FormField>
          )}
        </>
      )}

      {type === 'NumberInput' && (
        <>
          <TextField label="Min" value={String(data.min ?? 0)} onChange={(value) => handleDataField('min', Number(value))} type="number" />
          <TextField label="Max" value={String(data.max ?? 100)} onChange={(value) => handleDataField('max', Number(value))} type="number" />
          <TextField label="Step" value={String(data.step ?? 1)} onChange={(value) => handleDataField('step', Number(value))} type="number" />
          <BooleanField label="Required" value={data.required === true} onChange={(value) => handleDataField('required', value)} />
          <TextField label="Prefix" value={data.prefix ?? ''} onChange={(value) => handleDataField('prefix', value)} />
          <TextField label="Suffix" value={data.suffix ?? ''} onChange={(value) => handleDataField('suffix', value)} />
          <TextField
            label="Error message"
            value={data.errorMessage ?? 'Value out of range'}
            onChange={(value) => handleDataField('errorMessage', value)}
          />
          <TextField
            label="On change -> set variable"
            value={data.onChangeAction ?? ''}
            onChange={(value) => handleDataField('onChangeAction', value)}
          />
          <SelectField
            label="Formatter"
            value={data.formatter || 'None'}
            onChange={(value) => handleDataField('formatter', value)}
            options={['None', 'Currency', 'Percentage', 'Compact']}
          />
        </>
      )}

      {type === 'Button' && (
        <>
          <TextField label="Target Query (onClick)" value={String(data.dbBinding ?? '')} onChange={(value) => handleDataField('dbBinding', value)} />
          <TextField label="Disabled when" value={data.disabled ?? 'false'} onChange={(value) => handleDataField('disabled', value)} />
          <BooleanField label="Show loading state" value={data.loadingState === true} onChange={(value) => handleDataField('loadingState', value)} />
          <BooleanField
            label="Require confirmation"
            value={data.confirmationDialog === true}
            onChange={(value) => handleDataField('confirmationDialog', value)}
          />
          {data.confirmationDialog && (
            <>
              <TextField
                label="Confirmation message"
                value={data.confirmationMessage ?? 'Are you sure?'}
                onChange={(value) => handleDataField('confirmationMessage', value)}
              />
              <TextField label="Confirm label" value={data.confirmLabel ?? 'Confirm'} onChange={(value) => handleDataField('confirmLabel', value)} />
              <TextField label="Cancel label" value={data.cancelLabel ?? 'Cancel'} onChange={(value) => handleDataField('cancelLabel', value)} />
            </>
          )}
          <TextField label="On success action" value={data.onSuccessAction ?? ''} onChange={(value) => handleDataField('onSuccessAction', value)} />
          <TextField label="On error action" value={data.onErrorAction ?? ''} onChange={(value) => handleDataField('onErrorAction', value)} />
        </>
      )}
    </div>
  );
}
