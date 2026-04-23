import { useEditorStore } from '../../store/editorStore';

export default function DataTab() {
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateData = useEditorStore((s) => s.updateData);

  const selectedComponent = components.find((c) => c.id === lastSelectedComponentId);
  const rows = selectedComponent?.data?.rows ?? [];
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
        handleDataField('mockValue', parsed);
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
    handleDataField('columns', columns.filter((_, i) => i !== index));
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
    handleDataField('series', series.filter((_, i) => i !== index));
  };

  const isTabbed = type === 'TabbedContainer';
  const tabs = data.tabs || [];
  const handleTabChange = (index: number, val: string) => {
    const newTabs = [...tabs];
    newTabs[index] = val;
    handleDataField('tabs', newTabs);
  };
  const handleAddTab = () => handleDataField('tabs', [...tabs, `Tab ${tabs.length + 1}`]);
  const handleDeleteTab = (index: number) => handleDataField('tabs', tabs.filter((_, i) => i !== index));

  const isSelect = type === 'Select';
  const options = data.options || [];
  const handleOptionChange = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    handleDataField('options', newOptions);
  };
  const handleAddOption = () => handleDataField('options', [...options, `Option ${options.length + 1}`]);
  const handleDeleteOption = (index: number) => handleDataField('options', options.filter((_, i) => i !== index));

  const mockValueDisplay = (isChart || isTable)
    ? JSON.stringify(data.mockValue, null, 2)
    : String(data.mockValue ?? '');

  return (
    <div>
      {/* Display Label */}
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

      {/* Mock Value */}
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

      {/* DB Field Binding */}
      <div className="form-group">
        <label className="form-label">DB Field Binding</label>
        <input
          type="text"
          className="form-input"
          value={data.dbBinding || ''}
          onChange={(e) => handleDataField('dbBinding', e.target.value)}
          placeholder="e.g. projects.budget_total"
          style={{ fontFamily: "'Fira Code', monospace", fontSize: '12px' }}
        />
      </div>

      {/* Refresh Trigger */}
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

      {/* Table: Column Editor */}
      {isTable && (
        <>
          <div className="form-group">
            <label className="form-label">Columns</label>
            <div className="mini-editor">
              {columns.map((col, i) => (
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

          {selectedComponent?.type === 'Table' && (
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
                              updatedRows[rowIdx] = { ...updatedRows[rowIdx], [col.fieldKey]: e.target.value };
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
                  const blankRow = Object.fromEntries(columns.map((col: any) => [col.fieldKey, '']));
                  handleDataField('rows', [...rows, blankRow]);
                }}
              >
                + Add Row
              </button>
            </div>
          )}
        </>
      )}

      {/* Chart: Series Editor */}
      {isChart && (
        <div className="form-group">
          <label className="form-label">Series</label>
          <div className="mini-editor">
            {series.map((s, i) => (
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
      )}

      {/* Tabs list for TabbedContainer */}
      {isTabbed && (
        <div className="form-group">
          <label className="form-label">Tabs</label>
          <div className="mini-editor">
            {tabs.map((tab, i) => (
              <div key={i} className="mini-editor-row">
                <input
                  value={tab}
                  onChange={(e) => handleTabChange(i, e.target.value)}
                  placeholder="Tab name"
                />
                <button className="mini-editor-delete" onClick={() => handleDeleteTab(i)}>×</button>
              </div>
            ))}
            <button className="mini-editor-add" onClick={handleAddTab}>+ 'New Tab'</button>
          </div>
        </div>
      )}

      {/* Options list for Select dropdowns */}
      {isSelect && (
        <div className="form-group">
          <label className="form-label">Options</label>
          <div className="mini-editor">
            {options.map((opt, i) => (
              <div key={i} className="mini-editor-row">
                <input
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder="Option name"
                />
                <button className="mini-editor-delete" onClick={() => handleDeleteOption(i)}>×</button>
              </div>
            ))}
            <button className="mini-editor-add" onClick={handleAddOption}>+ 'New Option'</button>
          </div>
        </div>
      )}
    </div>
  );
}
