import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';

const API_BASE = 'http://localhost:3001';

export default function PublishToggle() {
  const dashboardId = useEditorStore((s) => s.activeTemplateId);
  const status = useEditorStore((s) => s.status);
  const setStatus = useEditorStore((s) => s.setStatus);
  
  const [loading, setLoading] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  if (!dashboardId || dashboardId.startsWith('blank') || dashboardId.length < 10) {
    // Only show for saved dashboards (UUIDs are long)
    return null;
  }

  const handleToggle = async () => {
    const newStatus = status === 'live' ? 'draft' : 'live';
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/dashboards/${dashboardId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const updated = await response.json();
      setStatus(updated.status, updated.published_at);
      
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    } catch (err) {
      console.error('[PublishToggle] error:', err);
      alert('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const isLive = status === 'live';

  return (
    <div className="publish-toggle">
      <div className={`status-indicator ${isLive ? 'live' : 'draft'}`}>
        <span className="status-dot" />
        <span className="status-text">{isLive ? 'Live' : 'Draft'}</span>
      </div>
      
      <div 
        className={`toggle-switch ${isLive ? 'on' : 'off'} ${loading ? 'loading' : ''}`}
        onClick={loading ? undefined : handleToggle}
        role="button"
        tabIndex={0}
        aria-label={`Switch to ${isLive ? 'draft' : 'live'}`}
      >
        <div className="toggle-handle" />
      </div>

      {saveFlash && (
        <div className="publish-success-flash">
          {isLive ? 'Dashboard is now live!' : 'Dashboard moved to draft.'}
        </div>
      )}
    </div>
  );
}
