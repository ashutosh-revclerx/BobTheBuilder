import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { templates } from '../templates';
import TopNav from '../components/ui/TopNav';

const TEMPLATE_ICONS: Record<string, string> = {
  'project-overview': '📊',
  'sprint-tracker': '🏃',
  'budget-monitor': '💰',
};

const TEMPLATE_TAGS: Record<string, string[]> = {
  'project-overview': ['StatCards', 'BarChart', 'Table'],
  'sprint-tracker': ['StatusBadge', 'LineChart', 'Table'],
  'budget-monitor': ['StatCards', 'LineChart', 'Table'],
};

export default function TemplateGallery() {
  const navigate = useNavigate();
  const savedTemplates = useEditorStore((s) => s.savedTemplates);
  const loadFromLocalStorage = useEditorStore((s) => s.loadFromLocalStorage);
  const renameSavedTemplate = useEditorStore((s) => s.renameSavedTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  const savedEntries = Object.values(savedTemplates);

  const beginRename = (templateId: string, currentName: string) => {
    setEditingTemplateId(templateId);
    setDraftName(currentName);
  };

  const commitRename = () => {
    if (!editingTemplateId) return;
    renameSavedTemplate(editingTemplateId, draftName);
    setEditingTemplateId(null);
    setDraftName('');
  };

  return (
    <div className="gallery-page">
      <TopNav />

      {/* Hero */}
      <div className="gallery-hero">
        <h1>Dashboard Templates</h1>
        <p>
          Pick a template to get started, or create a blank dashboard from scratch.
          Customise everything in the visual editor.
        </p>
      </div>

      {/* Content */}
      <div className="gallery-content">
        {/* Saved Templates */}
        {savedEntries.length > 0 && (
          <>
            <div className="gallery-section-label">
              <span>💾</span> Saved Dashboards
            </div>
            <div className="gallery-grid">
              {savedEntries.map((saved) => (
                <div
                  key={saved.templateId}
                  className="template-card"
                  onClick={() => navigate(`/builder/${saved.templateId}`)}
                >
                  <span className="saved-badge">Saved</span>
                  <div className="template-card-thumbnail">
                    <div className="template-card-thumbnail-inner">
                      <span className="template-card-thumbnail-icon">
                        {TEMPLATE_ICONS[saved.originalTemplateId] || '📄'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {saved.components.length} components
                      </span>
                    </div>
                  </div>
                  <div className="template-card-body">
                    {editingTemplateId === saved.templateId ? (
                      <input
                        className="template-name-input"
                        value={draftName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') {
                            setEditingTemplateId(null);
                            setDraftName('');
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="template-card-name-row">
                        <div className="template-card-name">{saved.dashboardName}</div>
                        <button
                          type="button"
                          className="template-rename-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginRename(saved.templateId, saved.dashboardName);
                          }}
                        >
                          Rename
                        </button>
                      </div>
                    )}
                    <div className="template-card-desc">
                      Last saved {new Date(saved.savedAt).toLocaleDateString()}
                    </div>
                    <div className="template-card-footer">
                      <button className="btn-use-template">Open Editor</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Default Templates */}
        <div className="gallery-section-label">
          <span>✨</span> Templates
        </div>
        <div className="gallery-grid">
          {templates.map((template) => (
            <div
              key={template.id}
              className="template-card"
              onClick={() => navigate(`/builder/${template.id}`)}
            >
              <div className="template-card-thumbnail">
                <div className="template-card-thumbnail-inner">
                  <span className="template-card-thumbnail-icon">
                    {TEMPLATE_ICONS[template.id] || '📄'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {template.components.length} components
                  </span>
                </div>
              </div>
              <div className="template-card-body">
                <div className="template-card-name">{template.name}</div>
                <div className="template-card-desc">{template.description}</div>
                <div className="template-card-tags">
                  {(TEMPLATE_TAGS[template.id] || []).map((tag) => (
                    <span key={tag} className="template-card-tag">{tag}</span>
                  ))}
                </div>
                <div className="template-card-footer">
                  <button className="btn-use-template">Use Template</button>
                </div>
              </div>
            </div>
          ))}

          {/* Blank Template */}
          <div
            className="template-card blank-card"
            onClick={() => navigate('/builder/blank')}
          >
            <div className="template-card-thumbnail">
              <div className="template-card-thumbnail-inner">
                <span className="template-card-thumbnail-icon">➕</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Start fresh
                </span>
              </div>
            </div>
            <div className="template-card-body">
              <div className="template-card-name">Start from Blank</div>
              <div className="template-card-desc">
                Begin with an empty canvas and add components as you go.
              </div>
              <div className="template-card-footer">
                <button className="btn-use-template" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                  Create Blank
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
