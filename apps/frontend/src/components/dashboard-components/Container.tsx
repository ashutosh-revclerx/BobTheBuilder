import { useState } from 'react';
import type { ComponentConfig, ComponentType } from '../../types/template';
import InlinePicker from '../editor/InlinePicker';
import { GridLayer } from '../editor/GridLayer';
import { useEditorStore } from '../../store/editorStore';

interface ContainerProps {
  config: ComponentConfig;
  componentMap: Record<string, React.ComponentType<any>>;
}

export default function Container({ config, componentMap }: ContainerProps) {
  const { style, data } = config;
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
        borderStyle: 'solid',
        padding: `${style.padding ?? 16}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="container-inner-layout"
        style={{
          flex: 1,
          position: 'relative',
          overflow: data.scrollable ? 'auto' : 'visible',
          display: 'flex',
          flexDirection: 'column',
          alignItems:
            style.alignItems === 'Start'
              ? 'flex-start'
              : style.alignItems === 'End'
                ? 'flex-end'
                : style.alignItems === 'Center'
                  ? 'center'
                  : 'stretch',
          justifyContent:
            style.justifyContent === 'Start'
              ? 'flex-start'
              : style.justifyContent === 'End'
                ? 'flex-end'
                : style.justifyContent === 'Center'
                  ? 'center'
                  : style.justifyContent === 'Space Between'
                    ? 'space-between'
                    : style.justifyContent === 'Space Around'
                      ? 'space-around'
                      : 'flex-start',
          borderTop: data.divider ? `1px solid ${style.borderColor || '#e3e6ec'}` : undefined,
        }}
      >
        <GridLayer parentId={config.id} componentMap={componentMap} customGap={data.gap ?? 10} />
      </div>

      <button className="container-add-trigger" onClick={() => setShowPicker(true)} style={{ margin: '8px 0 0 0' }}>
        <span className="container-add-plus">+</span>
        <span>Add component</span>
      </button>

      {showPicker && <InlinePicker onClose={() => setShowPicker(false)} onSelect={handleAddInside} />}
    </div>
  );
}
