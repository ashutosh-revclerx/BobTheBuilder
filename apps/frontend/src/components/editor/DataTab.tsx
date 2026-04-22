import { useEditorStore } from '../../store/editorStore';

export default function DataTab() {
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const components = useEditorStore((s) => s.components);
  const updateData = useEditorStore((s) => s.updateData);

  const component = components.find((c) => c.id === selectedComponentId);
  if (!component) return null;

  const { data, type } = component;
  const isChart = type === 'BarChart' || type === 'LineChart';
  const isTable = type === 'Table';

  const handleDataField = (key: string, value: unknown) => {
    if (!selectedComponentId) return;
    updateData(selectedComponentId, { [key]: value });
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
  const columns = data.columns || [];
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
          value={component.label}
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
    </div>
  );
}
