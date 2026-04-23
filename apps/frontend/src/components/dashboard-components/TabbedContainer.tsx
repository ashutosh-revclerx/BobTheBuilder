import { useState } from 'react';
import type { ComponentConfig, ComponentType } from '../../types/template';
import { useEditorStore } from '../../store/editorStore';
import InlinePicker from '../editor/InlinePicker';
import { GridLayer } from '../editor/GridLayer';

interface TabbedContainerProps {
  config: ComponentConfig;
  componentMap: Record<string, React.ComponentType<any>>;
}

export default function TabbedContainer({ config, componentMap }: TabbedContainerProps) {
  const { style, data } = config;
  const [showPicker, setShowPicker] = useState(false);
  
  const activeTabs = useEditorStore((s) => s.activeTabs);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const addComponent = useEditorStore((s) => s.addComponent);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  
  const tabs = data.tabs || ['View 1'];
  const currentTab = activeTabs[config.id] || tabs[0];
  
  const handleAddInside = (type: ComponentType) => {
    selectComponent(config.id);
    addComponent(type);
    setShowPicker(false);
  };

  return (
    <div
      className="tabbed-container-component"
      style={{
        backgroundColor: style.backgroundColor,
        borderRadius: `${style.borderRadius}px`,
        borderColor: style.borderColor,
        borderWidth: `${style.borderWidth}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header Tabs Navigation */}
      <div className="tabbed-header">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tabbed-header-btn ${currentTab === tab ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(config.id, tab);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="tabbed-content" style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <GridLayer 
          parentId={config.id} 
          parentTab={currentTab} 
          componentMap={componentMap} 
          customGap={data.gap ?? 10}
        />
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        <button className="container-add-trigger" onClick={() => setShowPicker(true)}>
          <span className="container-add-plus">+</span>
          <span>Add component to {currentTab}</span>
        </button>
      </div>

      {showPicker && (
        <InlinePicker 
          onClose={() => setShowPicker(false)}
          onSelect={handleAddInside}
        />
      )}
    </div>
  );
}
