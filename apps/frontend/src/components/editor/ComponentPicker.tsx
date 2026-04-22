import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentType } from '../../types/template';

const COMPONENT_OPTIONS: { type: ComponentType; icon: string; label: string }[] = [
  { type: 'StatCard', icon: '📊', label: 'Stat Card' },
  { type: 'Table', icon: '📋', label: 'Table' },
  { type: 'BarChart', icon: '📶', label: 'Bar Chart' },
  { type: 'LineChart', icon: '📈', label: 'Line Chart' },
  { type: 'StatusBadge', icon: '🏷️', label: 'Status Badge' },
  { type: 'Button', icon: '⚡', label: 'Button' },
  { type: 'LogsViewer', icon: '🖥️', label: 'Logs Viewer' },
];

export default function ComponentPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const addComponent = useEditorStore((s) => s.addComponent);

  const handleAdd = (type: ComponentType) => {
    addComponent(type);
    setIsOpen(false);
  };

  return (
    <div className="add-component-area">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          className="add-component-btn"
          onClick={() => setIsOpen(!isOpen)}
          title="Add component"
        >
          {isOpen ? '×' : '+'}
        </button>

        {isOpen && (
          <div className="component-picker">
            {COMPONENT_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                className="picker-option"
                onClick={() => handleAdd(opt.type)}
              >
                <span className="picker-option-icon">{opt.icon}</span>
                <span className="picker-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
