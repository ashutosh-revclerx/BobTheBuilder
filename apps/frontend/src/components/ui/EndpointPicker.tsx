import { useEffect, useMemo, useState } from 'react';
import MethodBadge from './MethodBadge';

const API_BASE = 'http://localhost:3001';

export interface ImportedEndpoint {
  id:         string;
  method:     string;
  path:       string;
  summary:    string | null;
  parameters?: unknown[];
}

interface EndpointPickerProps {
  resourceId:    string | null;
  selectedPath:  string;
  selectedMethod: string;
  onChange: (next: { method: string; path: string; parameters?: unknown[] }) => void;
}

/**
 * Reusable endpoint chooser. Fetches imported endpoints for the given
 * resourceId and renders a searchable dropdown. If the resource has no
 * imported endpoints (or no resourceId), falls back to plain method+path
 * inputs so existing behaviour is preserved.
 */
export default function EndpointPicker({
  resourceId,
  selectedPath,
  selectedMethod,
  onChange,
}: EndpointPickerProps) {
  const [endpoints, setEndpoints] = useState<ImportedEndpoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!resourceId) {
      setEndpoints(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/resources/${resourceId}/endpoints`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ImportedEndpoint[]) => {
        if (!cancelled) setEndpoints(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setEndpoints([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [resourceId]);

  const filtered = useMemo(() => {
    if (!endpoints) return [];
    const q = search.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        (e.summary ?? '').toLowerCase().includes(q),
    );
  }, [endpoints, search]);

  const hasImported = !loading && endpoints !== null && endpoints.length > 0;

  // Fallback — plain inputs (no imported endpoints OR no resource selected)
  if (!hasImported) {
    return (
      <div className="endpoint-picker endpoint-picker-fallback">
        <select
          className="form-select"
          value={selectedMethod || 'GET'}
          onChange={(e) => onChange({ method: e.target.value, path: selectedPath })}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input"
          placeholder="/path/to/endpoint"
          value={selectedPath}
          onChange={(e) => onChange({ method: selectedMethod || 'GET', path: e.target.value })}
        />
        {loading && <span className="endpoint-picker-hint">Loading endpoints…</span>}
        {!loading && resourceId && endpoints?.length === 0 && (
          <span className="endpoint-picker-hint">No imported endpoints for this resource — type the path manually.</span>
        )}
      </div>
    );
  }

  return (
    <div className="endpoint-picker">
      <input
        type="text"
        className="form-input endpoint-picker-search"
        placeholder={`Search ${endpoints!.length} endpoints…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="endpoint-picker-list">
        {filtered.length === 0 ? (
          <div className="endpoint-picker-empty">No endpoints match your search</div>
        ) : (
          filtered.map((ep) => {
            const isSelected = ep.method.toUpperCase() === selectedMethod.toUpperCase() && ep.path === selectedPath;
            return (
              <button
                key={ep.id}
                type="button"
                className={`endpoint-picker-item${isSelected ? ' selected' : ''}`}
                onClick={() => onChange({ method: ep.method, path: ep.path, parameters: ep.parameters })}
              >
                <MethodBadge method={ep.method} />
                <span className="endpoint-picker-path">{ep.path}</span>
                {ep.summary && <span className="endpoint-picker-summary">{ep.summary}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
