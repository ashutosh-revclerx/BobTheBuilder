import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/ui/TopNav';

const API_BASE = 'http://localhost:3001';

interface Resource {
  id:        string;
  name:      string;
  type:      string;
  base_url:  string | null;
  has_secret?: boolean;
}

interface GeneratedVariant {
  name:   string;
  config: { components: unknown[]; queries: unknown[] };
}

interface GenerateResponse {
  success: boolean;
  configs: GeneratedVariant[];
  error?:  string;
}

const EXAMPLE_PROMPTS = [
  'A dashboard for tracking active scrape jobs with status counts and a recent batches table.',
  'Show me total users and a paginated list of users with their email and city.',
  'Operations dashboard: a status badge for service health, a stat card with total requests, and a table of the slowest endpoints.',
];

export default function GeneratePage() {
  const navigate = useNavigate();

  const [prompt, setPrompt]                 = useState('');
  const [resources, setResources]           = useState<Resource[]>([]);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [docsUrlInput, setDocsUrlInput]     = useState('');
  const [variantCount, setVariantCount]     = useState(4);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/resources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Resource[]) => setResources(Array.isArray(data) ? data : []))
      .catch(() => setResources([]));
  }, []);

  const toggleResource = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (prompt.trim().length < 5) {
      setError('Tell me what dashboard you want — at least a sentence.');
      return;
    }

    setSubmitting(true);
    try {
      const docsUrls = docsUrlInput
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);

      const response = await fetch(`${API_BASE}/api/dashboards/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          prompt,
          resourceIds: Array.from(selectedIds),
          docsUrls,
          variantCount,
        }),
      });

      const json = (await response.json()) as GenerateResponse;
      if (!response.ok || !json.success) {
        setError(json.error || `Generation failed (${response.status})`);
        return;
      }

      // Stash the variants for the picker page (kept out of the URL — too big).
      sessionStorage.setItem(
        'btb:lastGeneration',
        JSON.stringify({ prompt, configs: json.configs }),
      );
      navigate('/new/pick');
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="generate-page">
      <TopNav />

      <main className="generate-content">
        <div className="generate-hero">
          <h1>Describe the dashboard you want</h1>
          <p>An LLM will draft a few candidates. You'll pick one and edit it visually.</p>
        </div>

        {error && <div className="resources-banner resources-banner-error">{error}</div>}

        <section className="resources-card">
          <label className="form-group">
            <span className="form-label">What dashboard do you want?</span>
            <textarea
              className="form-textarea generate-prompt"
              rows={5}
              placeholder="e.g. A dashboard that shows active scrape jobs, their status, and lets me trigger a new scrape from a button."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="generate-examples">
              <span>Examples:</span>
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="generate-example-chip"
                  onClick={() => setPrompt(ex)}
                >
                  {ex.length > 60 ? `${ex.slice(0, 60)}…` : ex}
                </button>
              ))}
            </div>
          </label>

          <div className="form-group">
            <span className="form-label">
              Pick the resources the LLM can use ({selectedIds.size} of {resources.length})
            </span>
            {resources.length === 0 ? (
              <div className="resources-empty">
                No resources registered yet. <a href="/resources">Add one</a> first if you want live data.
              </div>
            ) : (
              <div className="generate-resource-grid">
                {resources.map((r) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`generate-resource-card${isSelected ? ' selected' : ''}`}
                      onClick={() => toggleResource(r.id)}
                    >
                      <div className="generate-resource-name">
                        {r.name}
                        <span className={`resources-type-badge type-${r.type.toLowerCase()}`}>{r.type}</span>
                      </div>
                      <div className="generate-resource-base">{r.base_url ?? '—'}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="form-group">
            <span className="form-label">Reference docs (optional)</span>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="https://api.example.com/docs (one per line or comma-separated)"
              value={docsUrlInput}
              onChange={(e) => setDocsUrlInput(e.target.value)}
            />
          </label>

          <div className="generate-actions">
            <label className="form-group generate-variant-control">
              <span className="form-label">Variants</span>
              <input
                type="number"
                min={1}
                max={4}
                className="form-input"
                value={variantCount}
                onChange={(e) => setVariantCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
              />
            </label>

            <button
              type="button"
              className="btn-topbar primary generate-submit"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <span className="spinner dashboard-list-button-spinner" /> : null}
              <span>{submitting ? 'Generating… this can take up to 3 min' : '✨ Generate'}</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
