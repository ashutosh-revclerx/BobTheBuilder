import React, { useMemo, useState } from 'react';
import type { ComponentConfig, ComponentType } from '../../types/template';
import InlinePicker from '../editor/InlinePicker';
import { GridLayer } from '../editor/GridLayer';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface ContainerProps {
  config: ComponentConfig;
  componentMap: Record<string, React.ComponentType<any>>;
  readOnly?: boolean;
}

const Container = React.memo(function Container({ config, componentMap, readOnly = false }: ContainerProps) {
  const { style, data } = config;
  const [showPicker, setShowPicker] = useState(false);
  const addComponent = useEditorStore((s) => s.addComponent);
  const selectComponent = useEditorStore((s) => s.selectComponent);

  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);

  const handleAddInside = (type: ComponentType) => {
    selectComponent(config.id);
    addComponent(type);
    setShowPicker(false);
  };

  return (
    <div
      className="container-component"
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', bg);
          el.style.setProperty('--comp-border', style.borderColor ?? '');
        }
      }}
      style={{
        background: 'var(--comp-bg)',
        borderRadius: `${style.borderRadius}px`,
        borderColor: 'var(--comp-border)',
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
          borderTop: data.divider ? `1px solid var(--comp-border)` : undefined,
        }}
      >
        <GridLayer parentId={config.id} componentMap={componentMap} customGap={data.gap ?? 10} readOnly={readOnly} />
      </div>

      {!readOnly && (
        <button className="container-add-trigger" onClick={() => setShowPicker(true)} style={{ margin: '8px 0 0 0' }}>
          <span className="container-add-plus">+</span>
          <span>Add component</span>
        </button>
      )}

      {showPicker && <InlinePicker onClose={() => setShowPicker(false)} onSelect={handleAddInside} />}
    </div>
  );
});

export default Container;
