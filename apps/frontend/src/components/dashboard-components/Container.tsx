import { useState } from 'react';
import type { ComponentConfig, ComponentType } from '../../types/template';
import InlinePicker from '../editor/InlinePicker';
import { useEditorStore } from '../../store/editorStore';
import { GridLayer } from '../editor/GridLayer';

interface ContainerProps {
  config: ComponentConfig;
  componentMap: Record<string, React.ComponentType<any>>;
}

export default function Container({ config, componentMap }: ContainerProps) {
  const { style } = config;
  const [showPicker, setShowPicker] = useState(false);
  const addComponent = useEditorStore((s) => s.addComponent);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  
  const handleAddInside = (type: ComponentType) => {
    selectComponent(config.id);
    addComponent(type);
    setShowPicker(false);
  };

  return (
    <div
      className="container-component"
      style={{
        backgroundColor: style.backgroundColor,
        borderRadius: `${style.borderRadius}px`,
        borderColor: style.borderColor,
        borderWidth: `${style.borderWidth}px`,
        padding: '0', // Let GridLayer handle the internal margin/padding
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="container-inner-layout" style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <GridLayer parentId={config.id} componentMap={componentMap} />
      </div>

      <button className="container-add-trigger" onClick={() => setShowPicker(true)} style={{ margin: '8px' }}>
        <span className="container-add-plus">+</span>
        <span>Add component</span>
      </button>

      {showPicker && (
        <InlinePicker 
          onClose={() => setShowPicker(false)}
          onSelect={handleAddInside}
        />
      )}
    </div>
  );
}
