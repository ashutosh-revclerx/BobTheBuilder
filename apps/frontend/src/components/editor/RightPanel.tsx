import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import StyleTab from './StyleTab';
import DataTab from './DataTab';

export default function RightPanel() {
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const components = useEditorStore((s) => s.components);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const [activeTab, setActiveTab] = useState<'style' | 'data'>('style');

  if (!selectedComponentId) return null;

  const component = components.find((c) => c.id === selectedComponentId);
  if (!component) return null;

  return (
    <div className="right-panel">
      <div className="right-panel-header">
        <div className="right-panel-title">
          {component.label}
          <span className="right-panel-type-badge">{component.type}</span>
        </div>
        <button className="right-panel-close" onClick={() => selectComponent(null)}>
          ✕
        </button>
      </div>

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
    </div>
  );
}
