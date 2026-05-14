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

  const currentTabStyle = data.tabStyles?.[currentTab] || {};
  const currentBg = currentTabStyle.backgroundColor || bg;
  const tabDirection = style.tabPosition === 'Left' ? 'row' : style.tabPosition === 'Bottom' ? 'column-reverse' : 'column';

  return (
    <div
      className="tabbed-container-component"
      ref={el => {
        if (el) {
          el.style.setProperty('--comp-bg', currentBg);
          el.style.setProperty('--comp-border', currentTabStyle.borderColor || style.borderColor || '');
        }
      }}
      style={{
        background: 'var(--comp-bg)',
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
        borderColor: 'var(--comp-border)',
        borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
        borderStyle: 'solid',
        height: '100%',
        display: 'flex',
        flexDirection: tabDirection as 'column',
      }}
    >
      <div 
        className="tabbed-header" 
        style={{ 
          display: 'flex', 
          flexDirection: style.tabPosition === 'Left' ? 'column' : 'row',
          background: style.tabHeaderBackground || 'transparent',
          borderColor: style.tabHeaderBorderColor || style.borderColor || 'transparent',
          borderBottomWidth: style.tabPosition === 'Top' ? '1px' : '0',
          borderTopWidth: style.tabPosition === 'Bottom' ? '1px' : '0',
          borderRightWidth: style.tabPosition === 'Left' ? '1px' : '0',
          borderStyle: 'solid',
        }}
      >
        {tabs.map((tab, idx) => {
          const tabLabel = typeof tab === 'object' && tab !== null ? (tab as any).label || `Tab ${idx + 1}` : String(tab);
          const tabId = typeof tab === 'object' && tab !== null ? (tab as any).id || tabLabel : tabLabel;
          const isActive = currentTab === tabId;

          return (
            <button
              key={`${tabId}-${idx}`}
              className={`tabbed-header-btn ${isActive ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleTabChange(tabId);
              }}
              style={{
                backgroundColor: isActive 
                  ? (style.tabHeaderActiveBackground || 'transparent')
                  : 'transparent',
                color: isActive
                  ? (style.tabHeaderActiveTextColor || style.tabHeaderTextColor || 'inherit')
                  : (style.tabHeaderTextColor || 'inherit'),
                fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
                fontWeight: isActive ? 600 : (style.fontWeight || 400),
              }}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      <div className="tabbed-content" style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <GridLayer 
          parentId={config.id} 
          parentTab={currentTab} 
          componentMap={componentMap} 
          customGap={data.gap ?? 10} 
          readOnly={readOnly} 
        />
      </div>

      {!readOnly && (
        <div style={{ padding: '0 12px 12px' }}>
          <button className="container-add-trigger" onClick={() => setShowPicker(true)}>
            <span className="container-add-plus">+</span>
            <span>Add component to {typeof currentTab === 'object' && currentTab !== null ? (currentTab as any).label || 'this tab' : String(currentTab)}</span>
          </button>
        </div>
      )}

      {showPicker && <InlinePicker onClose={() => setShowPicker(false)} onSelect={handleAddInside} />}
    </div>
  );
});

export default TabbedContainer;
