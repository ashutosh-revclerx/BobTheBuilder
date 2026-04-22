import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentType } from '../../types/template';
import { COMPONENT_REGISTRY } from '../../config/componentRegistry';

export default function LeftPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const addComponent = useEditorStore((s) => s.addComponent);

  const handleAdd = (type: ComponentType) => {
    addComponent(type);
  };

  const filteredCategories = COMPONENT_REGISTRY.map((cat) => ({
    ...cat,
    options: cat.options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
  })).filter((cat) => cat.options.length > 0);

  return (
    <div className="left-panel">
      <div className="left-panel-header">
        <div className="left-panel-title">Components</div>
      </div>
      
      <div className="left-panel-search-wrapper">
        <input
          type="text"
          className="left-panel-search"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="left-panel-content">
        {filteredCategories.length === 0 ? (
          <div className="left-panel-empty">No components found</div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.title} className="component-category">
              <div className="component-category-title">{category.title}</div>
              <div className="component-grid">
                {category.options.map((opt) => (
                  <button
                    key={opt.type}
                    className="component-card"
                    onClick={() => handleAdd(opt.type)}
                    title={`Add ${opt.label}`}
                  >
                    <span className="component-card-icon">{opt.icon}</span>
                    <span className="component-card-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
