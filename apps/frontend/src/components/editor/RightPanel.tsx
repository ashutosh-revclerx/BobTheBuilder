import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import StyleTab from './StyleTab';
import DataTab from './DataTab';

export default function RightPanel() {
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const closeRightPanel = useEditorStore((s) => s.closeRightPanel);
  const [activeTab, setActiveTab] = useState<'style' | 'data'>('style');
  
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  if (!rightPanelOpen) return null;

  const component = components.find((c) => c.id === lastSelectedComponentId);

  return (
    <div className={`right-panel ${hasMounted.current ? 'panel-animate' : ''}`}>
      <div className="right-panel-header">
        <div className="right-panel-title">
          {component ? (
            <>
              {component.label}
              <span className="right-panel-type-badge">{component.type}</span>
            </>
          ) : (
            'Configuration'
          )}
        </div>
        <button className="right-panel-close" onClick={closeRightPanel}>
          ✕
        </button>
      </div>

      {!component ? (
        <div className="right-panel-empty">
          <div className="panel-empty-icon">🎛️</div>
          <p>Select a component to configure it</p>
        </div>
      ) : (
        <>
          <div className="right-panel-tabs">
            <button
              className={`right-panel-tab ${activeTab === 'style' ? 'active' : ''}`}
              onClick={() => setActiveTab('style')}
            >
              Style
            </button>
            <button
              className={`right-panel-tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              Data
            </button>
          </div>

          <div className="right-panel-content">
            {activeTab === 'style' ? <StyleTab /> : <DataTab />}
          </div>
        </>
      )}
    </div>
  );
}
