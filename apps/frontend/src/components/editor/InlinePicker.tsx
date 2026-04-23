import { useState, useRef, useEffect } from 'react';
import { COMPONENT_REGISTRY } from '../../config/componentRegistry';
import type { ComponentType } from '../../types/template';

interface InlinePickerProps {
  onClose: () => void;
  onSelect: (type: ComponentType) => void;
}

export default function InlinePicker({ onClose, onSelect }: InlinePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredCategories = COMPONENT_REGISTRY.map((cat) => ({
    ...cat,
    options: cat.options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
  })).filter((cat) => cat.options.length > 0);

  return (
    <div className="inline-picker" ref={pickerRef}>
      <div className="inline-picker-header">
        <input
          type="text"
          className="inline-picker-search"
          placeholder="Search components..."
          autoFocus
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="inline-picker-close" onClick={onClose}>×</button>
      </div>

      <div className="inline-picker-content">
        {filteredCategories.length === 0 ? (
          <div className="inline-picker-empty">No components found</div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.title} className="inline-picker-category">
              <div className="inline-picker-category-title">{category.title}</div>
              <div className="inline-picker-grid">
                {category.options.map((opt) => (
                  <button
                    key={opt.type}
                    className="inline-picker-card"
                    onClick={() => {
                      onSelect(opt.type);
                      onClose();
                    }}
                  >
                    <span className="inline-picker-card-icon">{opt.icon}</span>
                    <div className="inline-picker-card-info">
                      <span className="inline-picker-card-label">{opt.label}</span>
                      {opt.description && <span className="inline-picker-card-desc">{opt.description}</span>}
                    </div>
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
