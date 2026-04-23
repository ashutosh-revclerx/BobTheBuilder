import { useEditorStore } from '../../store/editorStore';

export default function DataTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateData = useEditorStore((s) => s.updateData);

  const selectedComponent = components.find((c) => c.id === lastSelectedComponentId);
  const rows = selectedComponent?.data?.rows ?? (Array.isArray(selectedComponent?.data?.mockValue) ? selectedComponent?.data?.mockValue : []);
  const columns = selectedComponent?.data?.columns ?? [];

  if (!selectedComponent) return null;

  const { data, type } = selectedComponent;
  const isChart = type === 'BarChart' || type === 'LineChart';
  const isTable = type === 'Table';

  const handleDataField = (key: string, value: unknown) => {
    if (!lastSelectedComponentId) return;
    updateData(lastSelectedComponentId, { [key]: value });
  };

  const handleMockValueChange = (rawValue: string) => {
    if (isChart || isTable) {
      try {
        const parsed = JSON.parse(rawValue);
        if (isTable) {
          handleDataField('rows', parsed);
          handleDataField('mockValue', parsed); // Sync both to be safe
        } else {
          handleDataField('mockValue', parsed);
        }
      } catch {
        // Don't update if invalid JSON
      }
    } else {
      handleDataField('mockValue', rawValue);
    }
  };

  // Column editor for Tables
  const handleColumnChange = (index: number, field: 'name' | 'fieldKey', value: string) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    handleDataField('columns', newColumns);
  };
  const handleAddColumn = () => {
    handleDataField('columns', [...columns, { name: '', fieldKey: '' }]);
  };
  const handleDeleteColumn = (index: number) => {
    handleDataField('columns', columns.filter((_: any, i: number) => i !== index));
  };

  // Series editor for Charts
  const series = data.series || [];
  const handleSeriesChange = (index: number, field: 'name' | 'fieldKey', value: string) => {
    const newSeries = [...series];
    newSeries[index] = { ...newSeries[index], [field]: value };
    handleDataField('series', newSeries);
  };
  const handleAddSeries = () => {
    handleDataField('series', [...series, { name: '', fieldKey: '' }]);
  };
  const handleDeleteSeries = (index: number) => {
    handleDataField('series', series.filter((_: any, i: number) => i !== index));
  };

  const isTabbed = type === 'TabbedContainer';
  const tabs = data.tabs || [];
  const handleTabChange = (index: number, val: string) => {
    const newTabs = [...tabs];
    newTabs[index] = val;
    handleDataField('tabs', newTabs);
  };
  const handleAddTab = () => handleDataField('tabs', [...tabs, `Tab ${tabs.length + 1}`]);
  const handleDeleteTab = (index: number) => handleDataField('tabs', tabs.filter((_: any, i: number) => i !== index));

  const isSelect = type === 'Select';
  const options = data.options || [];
  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    handleDataField('options', newOptions);
  };
  const handleAddOption = () => handleDataField('options', [...options, `Option ${options.length + 1}`]);
  const handleDeleteOption = (index: number) => handleDataField('options', options.filter((_: any, i: number) => i !== index));

  // StatusBadge mapping editor
  const mapping = data.mapping || {};
  const mappingEntries = Object.entries(mapping);
  const handleMappingChange = (oldKey: string, newKey: string, color: string) => {
    const newMapping = { ...mapping };
    if (oldKey !== newKey) delete newMapping[oldKey];
    newMapping[newKey] = color;
    handleDataField('mapping', newMapping);
  };
  const handleAddMapping = () => {
    handleDataField('mapping', { ...mapping, ['New Value']: '#3b82f6' });
  };
  const handleDeleteMapping = (key: string) => {
    const newMapping = { ...mapping };
    delete newMapping[key];
    handleDataField('mapping', newMapping);
  };

  const mockValueDisplay = (isChart || isTable)
    ? JSON.stringify(isTable ? (data.rows || data.mockValue) : data.mockValue, null, 2)
    : String(data.mockValue ?? '');

  return (
    <div>
      {/* ─── Display Label ─── */}
      <div className="form-group">
        <label className="form-label">Display Label</label>
        <input
          type="text"
          className="form-input"
          value={selectedComponent.label}
          onChange={(e) => handleDataField('label', e.target.value)}
          placeholder="Component label"
        />
      </div>

      {/* ─── Visibility (global) ─── */}
      <div className="form-group">
        <label className="form-label">Visible</label>
        <select
          className="form-select"
          value={selectedComponent.visible !== false ? 'true' : 'false'}
          onChange={(e) => handleDataField('visible', e.target.value === 'true')}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      {/* ─── Mock Value ─── */}
      <div className="form-group">
        <label className="form-label">Mock Value</label>
        {isChart || isTable ? (
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
      </div>

      {/* ─── DB Field Binding ─── */}
      <div className="form-group">
        <label className="form-label">DB Field Binding</label>
        <input
          type="text"
          className="form-input"
          value={data.dbBinding || ''}
          onChange={(e) => handleDataField('dbBinding', e.target.value)}
          placeholder="e.g. {{queries.getData.data}}"
          style={{ fontFamily: "'Fira Code', monospace", fontSize: '12px' }}
        />
      </div>

      {/* ─── Refresh Trigger ─── */}
      <div className="form-group">
        <label className="form-label">Refresh Trigger</label>
        <select
          className="form-select"
          value={data.refreshOn || 'manual'}
          onChange={(e) => handleDataField('refreshOn', e.target.value)}
        >
          <option value="manual">Manual</option>
          <option value="onLoad">On Load</option>
          <option value="onRowSelect">On Row Select</option>
        </select>
      </div>

      {/* ════════════════════════════════════════
          COMPONENT-SPECIFIC SECTIONS
         ════════════════════════════════════════ */}

      {/* ─── StatCard: Trend ─── */}
      {type === 'StatCard' && (
        <>
          <div className="form-group">
            <label className="form-label">Trend Value</label>
            <input
              type="text"
              className="form-input"
              value={data.trend ?? ''}
              onChange={(e) => handleDataField('trend', e.target.value)}
              placeholder="+12.5%"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Trend Type</label>
            <select
              className="form-select"
              value={data.trendType || 'positive'}
              onChange={(e) => handleDataField('trendType', e.target.value)}
            >
              <option value="positive">Positive ↑</option>
              <option value="negative">Negative ↓</option>
              <option value="neutral">Neutral —</option>
            </select>
          </div>
        </>
      )}

      {/* ─── Table: Columns + Features ─── */}
      {isTable && (
        <>
          <div className="form-group">
            <label className="form-label">Searchable</label>
            <select
              className="form-select"
              value={data.searchable !== false ? 'true' : 'false'}
              onChange={(e) => handleDataField('searchable', e.target.value === 'true')}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Pagination</label>
            <select
              className="form-select"
              value={data.pagination !== false ? 'true' : 'false'}
              onChange={(e) => handleDataField('pagination', e.target.value === 'true')}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Columns</label>
            <div className="mini-editor">
              {columns.map((col, i: number) => (
                <div key={i} className="mini-editor-row">
                  <input
                    value={col.name}
                    onChange={(e) => handleColumnChange(i, 'name', e.target.value)}
                    placeholder="Column name"
                  />
                  <input
                    value={col.fieldKey}
                    onChange={(e) => handleColumnChange(i, 'fieldKey', e.target.value)}
                    placeholder="Field key"
                  />
                  <button className="mini-editor-delete" onClick={() => handleDeleteColumn(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button className="mini-editor-add" onClick={handleAddColumn}>
                + Add column
              </button>
            </div>
          </div>

          <div className="panel-rows-section">
            <div className="panel-section-header">ROWS ({rows.length})</div>

            <div className="row-editor-list">
              {rows.map((row: any, rowIdx: number) => (
                <div className="row-editor-item" key={rowIdx}>
                  <span className="row-editor-num">{rowIdx + 1}</span>

                  <div className="row-editor-fields">
                    {columns.map((col: any) => (
                      <div className="row-editor-field" key={col.fieldKey}>
                        <span className="row-field-key">{col.fieldKey}</span>

                        <input
                          className="row-field-input"
                          value={row[col.fieldKey] ?? ''}
                          onChange={(e) => {
                            const updatedRows = [...rows];
                            updatedRows[rowIdx] = {
                              ...updatedRows[rowIdx],
                              [col.fieldKey]: e.target.value
                            };
                            handleDataField('rows', updatedRows);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    className="row-editor-delete"
                    onClick={() => {
                      const updatedRows = rows.filter((_: any, i: number) => i !== rowIdx);
                      handleDataField('rows', updatedRows);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              className="row-editor-add"
              onClick={() => {
                const blankRow = Object.fromEntries(
                  columns.map((col: any) => [col.fieldKey, ''])
                );
                handleDataField('rows', [...rows, blankRow]);
              }}
            >
              + Add Row
            </button>
          </div>
        </>
      )}

      {/* ─── Charts: xField, yField, Series ─── */}
      {isChart && (
        <>
          <div className="form-group">
            <label className="form-label">X Field</label>
            <input
              type="text"
              className="form-input"
              value={data.xField ?? ''}
              onChange={(e) => handleDataField('xField', e.target.value)}
              placeholder="e.g. label"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Y Field</label>
            <input
              type="text"
              className="form-input"
              value={data.yField ?? ''}
              onChange={(e) => handleDataField('yField', e.target.value)}
              placeholder="e.g. value"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Series</label>
            <div className="mini-editor">
              {series.map((s: any, i: number) => (
                <div key={i} className="mini-editor-row">
                  <input
                    value={s.name}
                    onChange={(e) => handleSeriesChange(i, 'name', e.target.value)}
                    placeholder="Series name"
                  />
                  <input
                    value={s.fieldKey}
                    onChange={(e) => handleSeriesChange(i, 'fieldKey', e.target.value)}
                    placeholder="Data field key"
                  />
                  <button className="mini-editor-delete" onClick={() => handleDeleteSeries(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button className="mini-editor-add" onClick={handleAddSeries}>
                + Add series
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── StatusBadge: Color Mapping ─── */}
      {type === 'StatusBadge' && (
        <div className="form-group">
          <label className="form-label">Status → Color Mapping</label>
          <div className="mini-editor">
            {mappingEntries.map(([key, color], i) => (
              <div key={i} className="mini-editor-row">
                <input
                  value={key}
                  onChange={(e) => handleMappingChange(key, e.target.value, color as string)}
                  placeholder="Status value"
                />
                <input
                  type="color"
                  value={color as string}
                  onChange={(e) => handleMappingChange(key, key, e.target.value)}
                  style={{ width: '32px', height: '28px', padding: 0, border: 'none', cursor: 'pointer' }}
                />
                <button className="mini-editor-delete" onClick={() => handleDeleteMapping(key)}>×</button>
              </div>
            ))}
            <button className="mini-editor-add" onClick={handleAddMapping}>+ Add mapping</button>
          </div>
        </div>
      )}

      {/* ─── LogsViewer: Level Filter + Search ─── */}
      {type === 'LogsViewer' && (
        <>
          <div className="form-group">
            <label className="form-label">Level Filter</label>
            <select
              className="form-select"
              value={data.levelFilter || 'all'}
              onChange={(e) => handleDataField('levelFilter', e.target.value)}
            >
              <option value="all">All</option>
              <option value="info">Info only</option>
              <option value="warn">Warn only</option>
              <option value="error">Error only</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Searchable</label>
            <select
              className="form-select"
              value={data.logSearchable !== false ? 'true' : 'false'}
              onChange={(e) => handleDataField('logSearchable', e.target.value === 'true')}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </>
      )}

      {/* ─── Container: Layout Direction + Gap ─── */}
      {type === 'Container' && (
        <>
          <div className="form-group">
            <label className="form-label">Layout Direction</label>
            <select
              className="form-select"
              value={data.containerLayout || 'vertical'}
              onChange={(e) => handleDataField('containerLayout', e.target.value)}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Gap</label>
            <div className="slider-group">
              <input
                type="range"
                className="slider-input"
                min={0}
                max={32}
                value={data.gap ?? 10}
                onChange={(e) => handleDataField('gap', Number(e.target.value))}
              />
              <span className="slider-value">{data.gap ?? 10}px</span>
            </div>
          </div>
        </>
      )}

      {/* ─── TabbedContainer: Tabs Editor ─── */}
      {isTabbed && (
        <div className="form-group">
          <label className="form-label">Tabs</label>
          <div className="mini-editor">
            {tabs.map((tab: string, i: number) => (
              <div key={i} className="mini-editor-row">
                <input
                  value={tab}
                  onChange={(e) => handleTabChange(i, e.target.value)}
                  placeholder="Tab name"
                />
                <button className="mini-editor-delete" onClick={() => handleDeleteTab(i)}>×</button>
              </div>
            ))}
            <button className="mini-editor-add" onClick={handleAddTab}>+ New Tab</button>
          </div>
        </div>
      )}

      {/* ─── TextInput: Placeholder ─── */}
      {type === 'TextInput' && (
        <div className="form-group">
          <label className="form-label">Placeholder</label>
          <input
            type="text"
            className="form-input"
            value={data.placeholder ?? ''}
            onChange={(e) => handleDataField('placeholder', e.target.value)}
            placeholder="Placeholder text..."
          />
        </div>
      )}

      {/* ─── NumberInput: Min / Max / Step ─── */}
      {type === 'NumberInput' && (
        <>
          <div className="form-group">
            <label className="form-label">Min</label>
            <input
              type="number"
              className="form-input"
              value={data.min ?? 0}
              onChange={(e) => handleDataField('min', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Max</label>
            <input
              type="number"
              className="form-input"
              value={data.max ?? 100}
              onChange={(e) => handleDataField('max', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Step</label>
            <input
              type="number"
              className="form-input"
              value={data.step ?? 1}
              onChange={(e) => handleDataField('step', Number(e.target.value))}
              min={0.01}
              step={0.01}
            />
          </div>
        </>
      )}

      {/* ─── Select: Options Editor ─── */}
      {isSelect && (
        <div className="form-group">
          <label className="form-label">Options</label>
          <div className="mini-editor">
            {options.map((opt: string, i: number) => (
              <div key={i} className="mini-editor-row">
                <input
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder="Option name"
                />
                <button className="mini-editor-delete" onClick={() => handleDeleteOption(i)}>×</button>
              </div>
            ))}
            <button className="mini-editor-add" onClick={handleAddOption}>+ New Option</button>
          </div>
        </div>
      )}

      {/* ─── Button: Target Query ─── */}
      {type === 'Button' && (
        <div className="form-group">
          <label className="form-label">Target Query (onClick)</label>
          <input
            type="text"
            className="form-input"
            value={data.dbBinding || ''}
            onChange={(e) => handleDataField('dbBinding', e.target.value)}
            placeholder="e.g. runAgent"
            style={{ fontFamily: "'Fira Code', monospace", fontSize: '12px' }}
          />
        </div>
      )}
    </div>
  );
}
