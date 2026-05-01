import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import StyleTab from './StyleTab';
import DataTab from './DataTab';
import ThemeTab from './ThemeTab';

export default function RightPanel() {
  const [width, setWidth] = useState(320);
  const isResizing = useRef(false);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const lastSelectedComponentId = useEditorStore((s) => s.lastSelectedComponentId);
  const components = useEditorStore((s) => s.components);
  const closeRightPanel = useEditorStore((s) => s.closeRightPanel);
  const rightPanelTab = useEditorStore((s) => s.rightPanelTab);
  const setRightPanelTab = useEditorStore((s) => s.setRightPanelTab);
  
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  if (!rightPanelOpen) return null;

  const component = components.find((c) => c.id === lastSelectedComponentId);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX;
      // Moving left (negative delta) increases the right panel's width
      let newWidth = startWidth - delta;
      if (newWidth < 250) newWidth = 250;
      if (newWidth > 600) newWidth = 600;
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
    <div className={`right-panel ${hasMounted.current ? 'panel-animate' : ''}`} style={{ width: `${width}px` }}>
      <div 
        className="panel-resizer panel-resizer-left" 
        onMouseDown={startResize}
      />
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
              className={`right-panel-tab ${rightPanelTab === 'style' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('style')}
            >
              Style
            </button>
            <button
              className={`right-panel-tab ${rightPanelTab === 'data' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('data')}
            >
              Data
            </button>
            <button
              className={`right-panel-tab ${rightPanelTab === 'theme' ? 'active' : ''}`}
              onClick={() => setRightPanelTab('theme')}
            >
              Theme
            </button>
          </div>

          <div className="right-panel-content">
            {rightPanelTab === 'style' ? <StyleTab /> : rightPanelTab === 'data' ? <DataTab /> : <ThemeTab />}
          </div>
        </>
      )}
    </div>
  );
}
