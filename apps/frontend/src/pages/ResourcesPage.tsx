import { useEffect, useMemo, useState } from 'react';
import MethodBadge from '../components/ui/MethodBadge';
import TopNav from '../components/ui/TopNav';
import type { ImportedEndpoint } from '../components/ui/EndpointPicker';

const API_BASE = 'http://localhost:3001';

type AuthType = 'none' | 'bearer' | 'api_key' | 'basic';
type ResourceType = 'REST' | 'agent' | 'postgresql';

interface Resource {
  id:         string;
  name:       string;
  type:       string;
  base_url:   string | null;
  auth_type:  string | null;
  has_secret: boolean;
  created_at: string;
}

interface ImportResponse {
  success:           true;
  resource:          { id: string; name: string };
  endpointsImported: number;
}

interface Banner {
  kind: 'success' | 'error';
  text: string;
}

export default function ResourcesPage() {
  // ── Import form state ──────────────────────────────────────────────────────
  const [swaggerUrl, setSwaggerUrl]     = useState('');
  const [resourceName, setResourceName] = useState('');
  const [baseUrl, setBaseUrl]           = useState('');
  const [authType, setAuthType]         = useState<AuthType>('none');
  const [secretRef, setSecretRef]       = useState('');
  const [importing, setImporting]       = useState(false);
  const [banner, setBanner]             = useState<Banner | null>(null);

  // ── Imported endpoints (just-imported resource) ────────────────────────────
  const [importedResource, setImportedResource]  = useState<{ id: string; name: string } | null>(null);
  const [importedEndpoints, setImportedEndpoints] = useState<ImportedEndpoint[]>([]);
  const [endpointSearch, setEndpointSearch]      = useState('');

  // ── Manual "Add resource" form state ───────────────────────────────────────
  const [manualOpen, setManualOpen]               = useState(false);
  const [manualName, setManualName]               = useState('');
  const [manualType, setManualType]               = useState<ResourceType>('REST');
  const [manualBaseUrl, setManualBaseUrl]         = useState('');
  const [manualAuthType, setManualAuthType]       = useState<AuthType>('none');
  const [manualSecretRef, setManualSecretRef]     = useState('');
  const [manualSubmitting, setManualSubmitting]   = useState(false);

  // ── Existing resources list ────────────────────────────────────────────────
  const [resources, setResources]   = useState<Resource[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEndpoints, setExpandedEndpoints] = useState<ImportedEndpoint[]>([]);
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null);

  const refreshResources = () => {
    fetch(`${API_BASE}/api/resources`)
      .then((r) => r.json())
      .then((data: Resource[]) => setResources(Array.isArray(data) ? data : []))
      .catch(() => setResources([]));
  };

  useEffect(refreshResources, []);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 3500);
    return () => window.clearTimeout(t);
  }, [banner]);

  const handleImport = async () => {
    if (!swaggerUrl.trim() || !resourceName.trim() || !baseUrl.trim()) {
      setBanner({ kind: 'error', text: 'Swagger URL, resource name, and base URL are all required.' });
      return;
    }
    if (authType !== 'none' && !secretRef.trim()) {
      setBanner({ kind: 'error', text: 'Secret reference is required for the chosen auth type.' });
      return;
    }

    setImporting(true);
    setBanner(null);
    try {
      const response = await fetch(`${API_BASE}/api/resources/import-swagger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swaggerUrl,
          resourceName,
          baseUrl,
          authType,
          secretRef: authType !== 'none' ? secretRef : undefined,
        }),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setBanner({ kind: 'error', text: json.error || 'Import failed' });
        return;
      }

      const payload = json as ImportResponse;
      setBanner({ kind: 'success', text: `Imported ${payload.endpointsImported} endpoints from ${payload.resource.name}` });
      setImportedResource(payload.resource);

      // Fetch the freshly-imported endpoint list
      const endpointsRes = await fetch(`${API_BASE}/api/resources/${payload.resource.id}/endpoints`);
      setImportedEndpoints(endpointsRes.ok ? await endpointsRes.json() : []);

      refreshResources();
    } catch {
      setBanner({ kind: 'error', text: 'Network error — could not reach backend.' });
    } finally {
      setImporting(false);
    }
  };

  const filteredImportedEndpoints = useMemo(() => {
    const q = endpointSearch.trim().toLowerCase();
    if (!q) return importedEndpoints;
    return importedEndpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        (e.summary ?? '').toLowerCase().includes(q),
    );
  }, [importedEndpoints, endpointSearch]);

  const handleManualSubmit = async () => {
    if (!manualName.trim()) {
      setBanner({ kind: 'error', text: 'Resource name is required.' });
      return;
    }
    const needsBaseUrl = manualType === 'REST' || manualType === 'agent';
    if (needsBaseUrl && !manualBaseUrl.trim()) {
      setBanner({ kind: 'error', text: 'Base URL is required for REST and agent types.' });
      return;
    }
    if (manualAuthType !== 'none' && !manualSecretRef.trim()) {
      setBanner({ kind: 'error', text: 'Secret reference is required for the chosen auth type.' });
      return;
    }

    setManualSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name:      manualName.trim(),
        type:      manualType,
        auth_type: manualAuthType,
      };
      if (needsBaseUrl) body.base_url = manualBaseUrl.trim();
      if (manualAuthType !== 'none') body.secret_ref = manualSecretRef.trim();
      // For postgresql, secret_ref carries the connection string — accept it on any auth type
      if (manualType === 'postgresql' && manualSecretRef.trim()) body.secret_ref = manualSecretRef.trim();

      const response = await fetch(`${API_BASE}/api/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      if (!response.ok) {
        setBanner({ kind: 'error', text: json.error || 'Could not create resource.' });
        return;
      }

      setBanner({ kind: 'success', text: `Resource "${manualName}" created.` });
      // Reset form
      setManualName('');
      setManualBaseUrl('');
      setManualSecretRef('');
      setManualAuthType('none');
      setManualType('REST');
      setManualOpen(false);
      refreshResources();
    } catch {
      setBanner({ kind: 'error', text: 'Network error — could not reach backend.' });
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleToggleExpand = async (resource: Resource) => {
    if (expandedId === resource.id) {
      setExpandedId(null);
      setExpandedEndpoints([]);
      return;
    }
    setExpandedId(resource.id);
    setExpandedEndpoints([]);
    try {
      const r = await fetch(`${API_BASE}/api/resources/${resource.id}/endpoints`);
      setExpandedEndpoints(r.ok ? await r.json() : []);
    } catch {
      setExpandedEndpoints([]);
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/resources/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        setBanner({ kind: 'error', text: 'Could not delete resource.' });
        return;
      }
      setBanner({ kind: 'success', text: 'Resource deleted.' });
      setConfirmDeleteId(null);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedEndpoints([]);
      }
      refreshResources();
    } catch {
      setBanner({ kind: 'error', text: 'Network error while deleting.' });
    }
  };

  return (
    <div className="resources-page">
      <TopNav />

      <main className="resources-content">
        {banner && (
          <div className={`resources-banner resources-banner-${banner.kind}`}>{banner.text}</div>
        )}

        {/* SECTION A — Import */}
        <section className="resources-card">
          <div className="resources-card-head">
            <h2>Import from Swagger / OpenAPI</h2>
            <p>Point us at a docs URL and we'll register the resource and all its endpoints.</p>
          </div>

          <div className="resources-form">
            <label className="form-group">
              <span className="form-label">Swagger / OpenAPI docs URL</span>
              <input
                type="text"
                className="form-input"
                placeholder="https://api.example.com/docs/swagger.json"
                value={swaggerUrl}
                onChange={(e) => setSwaggerUrl(e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Resource name</span>
              <input
                type="text"
                className="form-input"
                placeholder="nexus-scrape"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Base URL</span>
              <input
                type="text"
                className="form-input"
                placeholder="https://api.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Auth type</span>
              <select
                className="form-select"
                value={authType}
                onChange={(e) => setAuthType(e.target.value as AuthType)}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic</option>
              </select>
            </label>

            {authType !== 'none' && (
              <label className="form-group">
                <span className="form-label">Secret reference</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="{{env.MY_API_KEY}}"
                  value={secretRef}
                  onChange={(e) => setSecretRef(e.target.value)}
                />
              </label>
            )}

            <button
              type="button"
              className="btn-topbar primary resources-import-button"
              disabled={importing}
              onClick={() => void handleImport()}
            >
              {importing ? <span className="spinner dashboard-list-button-spinner" /> : null}
              <span>{importing ? 'Importing…' : 'Import Endpoints'}</span>
            </button>
          </div>
        </section>

        {/* SECTION B — Imported endpoints from latest import */}
        {importedResource && importedEndpoints.length > 0 && (
          <section className="resources-card">
            <div className="resources-card-head">
              <h2>{importedResource.name} — {importedEndpoints.length} endpoints imported</h2>
              <input
                type="text"
                className="form-input resources-search"
                placeholder="Search endpoints…"
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
              />
            </div>
            <ul className="resources-endpoint-list">
              {filteredImportedEndpoints.map((ep) => (
                <li key={ep.id} className="resources-endpoint-row">
                  <MethodBadge method={ep.method} />
                  <span className="resources-endpoint-path">{ep.path}</span>
                  <span className="resources-endpoint-summary">{ep.summary ?? ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* SECTION C — Existing resources */}
        <section className="resources-card">
          <div className="resources-card-head">
            <h2>All resources</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <p>{resources.length} registered</p>
              <button
                className="btn-topbar primary"
                onClick={() => setManualOpen((v) => !v)}
              >
                {manualOpen ? 'Cancel' : '+ Add resource'}
              </button>
            </div>
          </div>

          {manualOpen && (
            <div className="resources-form" style={{ marginBottom: 18 }}>
              <label className="form-group">
                <span className="form-label">Resource name</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="my-internal-api"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </label>

              <label className="form-group">
                <span className="form-label">Type</span>
                <select
                  className="form-select"
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as ResourceType)}
                >
                  <option value="REST">REST</option>
                  <option value="agent">Agent (async / poll)</option>
                  <option value="postgresql">PostgreSQL (read-only)</option>
                </select>
              </label>

              {(manualType === 'REST' || manualType === 'agent') && (
                <label className="form-group">
                  <span className="form-label">Base URL</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://api.example.com"
                    value={manualBaseUrl}
                    onChange={(e) => setManualBaseUrl(e.target.value)}
                  />
                </label>
              )}

              {manualType !== 'postgresql' && (
                <label className="form-group">
                  <span className="form-label">Auth type</span>
                  <select
                    className="form-select"
                    value={manualAuthType}
                    onChange={(e) => setManualAuthType(e.target.value as AuthType)}
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key</option>
                    <option value="basic">Basic</option>
                  </select>
                </label>
              )}

              {(manualAuthType !== 'none' || manualType === 'postgresql') && (
                <label className="form-group">
                  <span className="form-label">
                    {manualType === 'postgresql' ? 'Connection string (env placeholder)' : 'Secret reference'}
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={manualType === 'postgresql' ? '{{env.READONLY_DB_URL}}' : '{{env.MY_API_KEY}}'}
                    value={manualSecretRef}
                    onChange={(e) => setManualSecretRef(e.target.value)}
                  />
                </label>
              )}

              <button
                type="button"
                className="btn-topbar primary resources-import-button"
                disabled={manualSubmitting}
                onClick={() => void handleManualSubmit()}
              >
                {manualSubmitting ? <span className="spinner dashboard-list-button-spinner" /> : null}
                <span>{manualSubmitting ? 'Creating…' : 'Create resource'}</span>
              </button>
            </div>
          )}

          {resources.length === 0 ? (
            <div className="resources-empty">No resources yet. Import one above to get started.</div>
          ) : (
            <ul className="resources-list">
              {resources.map((resource) => {
                const isExpanded = expandedId === resource.id;
                const isConfirming = confirmDeleteId === resource.id;
                return (
                  <li key={resource.id} className="resources-list-item">
                    <div className="resources-list-row">
                      <div className="resources-list-info">
                        <div className="resources-list-name">
                          <strong>{resource.name}</strong>
                          <span className={`resources-type-badge type-${resource.type.toLowerCase()}`}>{resource.type}</span>
                        </div>
                        <div className="resources-list-meta">{resource.base_url ?? '—'}</div>
                      </div>

                      <div className="resources-list-actions">
                        <button className="btn-topbar" onClick={() => void handleToggleExpand(resource)}>
                          {isExpanded ? 'Hide' : 'View Endpoints'}
                        </button>
                        {isConfirming ? (
                          <div className="dashboard-card-delete-confirm">
                            <span>Delete?</span>
                            <button className="btn-topbar" onClick={() => void handleDeleteResource(resource.id)}>Yes</button>
                            <button className="btn-topbar" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-topbar danger-text" onClick={() => setConfirmDeleteId(resource.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="resources-list-expanded">
                        {expandedEndpoints.length === 0 ? (
                          <div className="resources-empty">No endpoints imported for this resource.</div>
                        ) : (
                          <ul className="resources-endpoint-list">
                            {expandedEndpoints.map((ep) => (
                              <li key={ep.id} className="resources-endpoint-row">
                                <MethodBadge method={ep.method} />
                                <span className="resources-endpoint-path">{ep.path}</span>
                                <span className="resources-endpoint-summary">{ep.summary ?? ''}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
