import React, { useEffect, useMemo, useState } from 'react';
import type { ComponentConfig, ComponentType } from '../../types/template';
import InlinePicker from '../editor/InlinePicker';
import { GridLayer } from '../editor/GridLayer';
import { runAction } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface TabbedContainerProps {
  config: ComponentConfig;
  componentMap: Record<string, React.ComponentType<any>>;
  readOnly?: boolean;
}

const TabbedContainer = React.memo(function TabbedContainer({ config, componentMap, readOnly = false }: TabbedContainerProps) {
  const { style, data } = config;
  const [showPicker, setShowPicker] = useState(false);
  const activeTabs = useEditorStore((s) => s.activeTabs);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const addComponent = useEditorStore((s) => s.addComponent);
  const selectComponent = useEditorStore((s) => s.selectComponent);

  const bg = useMemo(() => resolveBackground(style), [style.backgroundColor, style.backgroundGradient]);

  const tabs = data.tabs || ['View 1'];
  const initialTab = data.defaultTab && tabs.includes(data.defaultTab) ? data.defaultTab : tabs[0];
  const currentTab = activeTabs[config.id] || initialTab;

  useEffect(() => {
    if (!activeTabs[config.id] && initialTab) {
      setActiveTab(config.id, initialTab);
    }
  }, [activeTabs, config.id, initialTab, setActiveTab]);

  const handleAddInside = (type: ComponentType) => {
    selectComponent(config.id);
    addComponent(type);
    setShowPicker(false);
  };

  const handleTabChange = (nextTab: string) => {
    setActiveTab(config.id, nextTab);
    runAction(data.onTabChangeAction, nextTab);
  };

  const tabDirection = style.tabPosition === 'Left' ? 'row' : style.tabPosition === 'Bottom' ? 'column-reverse' : 'column';

  return (
    <div
      className="tabbed-container-component"
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
        height: '100%',
        display: 'flex',
        flexDirection: tabDirection as 'column',
      }}
    >
      <div className="tabbed-header" style={{ display: 'flex', flexDirection: style.tabPosition === 'Left' ? 'column' : 'row' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tabbed-header-btn ${currentTab === tab ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleTabChange(tab);
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tabbed-content" style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <GridLayer parentId={config.id} parentTab={currentTab} componentMap={componentMap} customGap={data.gap ?? 10} readOnly={readOnly} />
      </div>

      {!readOnly && (
        <div style={{ padding: '0 12px 12px' }}>
          <button className="container-add-trigger" onClick={() => setShowPicker(true)}>
            <span className="container-add-plus">+</span>
            <span>Add component to {currentTab}</span>
          </button>
        </div>
      )}

      {showPicker && <InlinePicker onClose={() => setShowPicker(false)} onSelect={handleAddInside} />}
    </div>
  );
});

export default TabbedContainer;
