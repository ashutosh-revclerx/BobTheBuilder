import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/ui/TopNav';
import PreviewRenderer from '../components/preview/PreviewRenderer';

const API_BASE = 'http://localhost:3001';

interface DashboardConfig {
  components: Array<Record<string, any>>;
  queries:    Array<Record<string, any>>;
  canvasStyle?: {
    backgroundColor?: string;
  };
}

interface GeneratedVariant {
  name:   string;
  config: DashboardConfig;
}

interface StashedGeneration {
  prompt:      string;
  configs:     GeneratedVariant[];
  dashboardId?: string;
}

interface Palette {
  background: string;
  surface:    string;
  border:     string;
  primary:    string;
  text:       string;
  muted:      string;
}

function paletteFromConfig(config: DashboardConfig): Palette {
  // Read the colour palette off the first component that declares one.
  const styles = (config.components ?? []).map((c) => c?.style ?? {});
  const first  = styles.find((s) => s.backgroundColor) ?? {};
  const accent = styles.find((s) => s.borderColor && s.borderColor !== first.borderColor) ?? {};
  return {
    background: config.canvasStyle?.backgroundColor ?? '#ffffff',
    surface:    first.backgroundColor ?? '#ffffff',
    border:     first.borderColor ?? '#e5e7eb',
    primary:    accent.borderColor ?? first.borderColor ?? '#6366f1',
    text:       first.textColor ?? '#0f1117',
    muted:      '#9ba3af',
  };
}

// REMOVED: Mini* component renderers have been replaced with real component rendering.
// The PreviewRenderer now uses the actual dashboard components and renderer,
// ensuring visual parity between preview and final rendered dashboard.

export default function TemplatePicker() {
  const navigate = useNavigate();
  const [stash, setStash] = useState<StashedGeneration | null>(null);
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('btb:lastGeneration');
    if (!raw) return;
    try {
      setStash(JSON.parse(raw) as StashedGeneration);
    } catch {
      setStash(null);
    }
  }, []);

  const palettes = useMemo(
    () => (stash?.configs ?? []).map((v) => paletteFromConfig(v.config)),
    [stash],
  );

  const handlePick = async (index: number) => {
    if (!stash) return;
    setError(null);
    setCreatingFor(index);
    try {
      const variant = stash.configs[index];
      const payload = {
        name:   variant.name,
        config: variant.config,
        status: 'draft',
      };

      // If a dashboard was already created in this generation session,
      // update it instead of creating a new one. This prevents duplicates
      // when the user switches templates.
      const isUpdate = !!stash.dashboardId;
      const method = isUpdate ? 'PUT' : 'POST';
      const endpoint = isUpdate
        ? `${API_BASE}/api/dashboards/${stash.dashboardId}`
        : `${API_BASE}/api/dashboards`;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || 'Could not save dashboard');
        return;
      }

      // On first creation, store the dashboard ID in the stash so subsequent
      // picks update the same dashboard rather than creating duplicates.
      if (!isUpdate) {
        const updatedStash = { ...stash, dashboardId: json.id };
        sessionStorage.setItem('btb:lastGeneration', JSON.stringify(updatedStash));
        setStash(updatedStash);
      }

      navigate(`/builder/${json.id}`);
    } catch (err) {
      setError((err as Error).message || 'Network error');
    } finally {
      setCreatingFor(null);
    }
  };

  if (!stash) {
    return (
      <div className="generate-page">
        <TopNav />
        <main className="generate-content">
          <div className="resources-empty">
            <p>No generated variants in this session.</p>
            <button className="btn-topbar primary" onClick={() => navigate('/new')}>
              Start a new generation
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="generate-page">
      <TopNav />
      <main className="generate-content">
        <div className="generate-hero">
          <h1>Pick a template</h1>
          <p>From your prompt: <em>"{stash.prompt}"</em></p>
        </div>

        {error && <div className="resources-banner resources-banner-error">{error}</div>}

        <div className="picker-grid">
          {stash.configs.map((variant, i) => {
            const p = palettes[i];
            const components = variant.config.components ?? [];
            const isCreating = creatingFor === i;
            return (
              <article
                key={i}
                className="picker-card"
                style={{ background: p.background, borderColor: p.border, color: p.text }}
              >
                <div className="picker-card-head">
                  <h3 style={{ color: p.text }}>{variant.name}</h3>
                  <span className="picker-card-stats">
                    {components.length} component{components.length === 1 ? '' : 's'}
                    {' · '}
                    {(variant.config.queries ?? []).length} quer{(variant.config.queries ?? []).length === 1 ? 'y' : 'ies'}
                  </span>
                </div>

                {/* Real preview using actual dashboard components and renderer.
                    This ensures visual parity between preview and final rendered dashboard. */}
                <div className="picker-card-canvas" style={{ background: p.background }}>
                  <PreviewRenderer config={variant.config} height="100%" width="100%" />
                </div>

                <button
                  className="btn-topbar primary picker-card-pick"
                  disabled={isCreating}
                  onClick={() => void handlePick(i)}
                >
                  {isCreating ? 'Creating…' : 'Use this →'}
                </button>
              </article>
            );
          })}
        </div>

        <div className="picker-footer">
          <button className="btn-topbar" onClick={() => navigate('/new')}>
            ← Try a different prompt
          </button>
        </div>
      </main>
    </div>
  );
}
