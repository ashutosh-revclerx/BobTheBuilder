import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { ComponentType } from '../../types/template';
import { COMPONENT_REGISTRY } from '../../config/componentRegistry';

interface LeftPanelProps {
  onClose?: () => void;
}

export default function LeftPanel({ onClose }: LeftPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [width, setWidth] = useState(260);
  const isResizing = useRef(false);
  const addComponent = useEditorStore((s) => s.addComponent);
  const setDraggingType = useEditorStore((s) => s.setDraggingType);

  useEffect(() => {
    const reset = () => setDraggingType(null);
    window.addEventListener('dragend', reset);
    return () => window.removeEventListener('dragend', reset);
  }, [setDraggingType]);

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

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX;
      let newWidth = startWidth + delta;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 500) newWidth = 500;
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="left-panel" style={{ width: `${width}px` }}>
      <div 
        className="panel-resizer panel-resizer-right" 
        onMouseDown={startResize}
      />
      <div className="left-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="left-panel-title">Components</div>
        {onClose && (
          <button 
            onClick={onClose}
            className="right-panel-close"
            style={{ width: '20px', height: '20px', fontSize: '12px' }}
            title="Close panel"
          >
            ✕
          </button>
        )}
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
                    className="component-card draggable-card"
                    onClick={() => handleAdd(opt.type)}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('componentType', opt.type);
                      e.dataTransfer.effectAllowed = 'copy';
                      setDraggingType(opt.type);

                      const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
                      ghost.style.position = 'fixed';
                      ghost.style.top = '-1000px';
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 60, 20);
                      setTimeout(() => document.body.removeChild(ghost), 0);
                    }}
                    onDragEnd={() => setDraggingType(null)}
                    title={`Drag to canvas or click to add`}
                  >
                    <span className="component-card-drag-handle">⠿</span>
                    <span className="component-card-icon">
                      <opt.icon size={16} strokeWidth={2} />
                    </span>
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
