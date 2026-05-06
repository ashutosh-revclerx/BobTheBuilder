import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/ui/TopNav';

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

// ── Mini component renderer ─────────────────────────────────────────────────
// Renders a tiny, non-interactive sketch of each component type so the preview
// looks like the real dashboard, not a featureless block grid. Reads style
// props from the component config so colours match what the builder will show.

function readStyle(comp: Record<string, any>, p: Palette) {
  const s = comp?.style ?? {};
  return {
    bg:     s.backgroundColor ?? p.surface,
    border: s.borderColor     ?? p.border,
    text:   s.textColor       ?? p.text,
    radius: typeof s.borderRadius === 'number' ? s.borderRadius : 4,
  };
}

function MiniButton({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  // Buttons in the real app are filled with primary by default — honour the
  // configured backgroundColor if it looks "non-default", else use primary.
  const fill = comp?.style?.backgroundColor ?? p.primary;
  const fg   = comp?.style?.textColor       ?? '#ffffff';
  return (
    <div style={{
      width: '100%', height: '100%',
      background: fill, color: fg,
      borderRadius: s.radius, border: `1px solid ${fill}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 600, padding: '0 6px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {comp?.label ?? 'Button'}
    </div>
  );
}

function MiniStatCard({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, color: s.text,
      borderRadius: s.radius, border: `1px solid ${s.border}`,
      padding: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: 8, opacity: 0.65, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {comp?.label ?? 'Metric'}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: p.primary, lineHeight: 1 }}>
        {comp?.data?.mockValue ?? '128'}
      </div>
    </div>
  );
}

function MiniTable({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  const cols = (comp?.data?.columns ?? [{}, {}, {}]).slice(0, 4);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, color: s.text,
      borderRadius: s.radius, border: `1px solid ${s.border}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        background: p.primary + '14', padding: '3px 4px', gap: 4,
        fontSize: 7, fontWeight: 700, color: s.text, opacity: 0.85,
      }}>
        {cols.map((c: any, i: number) => (
          <span key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c?.name ?? c?.fieldKey ?? `Col ${i + 1}`}
          </span>
        ))}
      </div>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
          padding: '2px 4px', gap: 4,
          borderTop: `1px solid ${s.border}`,
          fontSize: 7, opacity: 0.55,
        }}>
          {cols.map((_: any, i: number) => (
            <span key={i} style={{
              height: 5, background: p.muted, opacity: 0.35, borderRadius: 1,
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniBarChart({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  const heights = [40, 70, 55, 85, 30, 65, 50];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, borderRadius: s.radius, border: `1px solid ${s.border}`,
      padding: 4, display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: s.text, opacity: 0.7 }}>
        {comp?.label ?? 'Bars'}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {heights.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`,
            background: p.primary, opacity: 0.5 + (i % 3) * 0.15,
            borderRadius: 1,
          }} />
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, borderRadius: s.radius, border: `1px solid ${s.border}`,
      padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: s.text, opacity: 0.7 }}>
        {comp?.label ?? 'Trend'}
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ flex: 1, width: '100%' }}>
        <polyline
          fill="none"
          stroke={p.primary}
          strokeWidth="1.5"
          points="0,30 15,22 30,28 45,12 60,18 75,8 90,14 100,6"
        />
      </svg>
    </div>
  );
}

function MiniText({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, color: s.text,
      borderRadius: s.radius, border: `1px solid ${s.border}`,
      padding: 4, fontSize: 8, lineHeight: 1.3, overflow: 'hidden',
    }}>
      {comp?.data?.mockValue ?? comp?.label ?? 'Text content'}
    </div>
  );
}

function MiniInput({ comp, p, kind }: { comp: any; p: Palette; kind: 'text' | 'number' | 'select' }) {
  const s = readStyle(comp, p);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: s.text, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {comp?.label ?? kind}
      </div>
      <div style={{
        background: s.bg, color: s.text, opacity: 0.9,
        borderRadius: s.radius, border: `1px solid ${s.border}`,
        height: 14, padding: '0 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 7,
      }}>
        <span style={{ opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {comp?.data?.placeholder ?? (kind === 'select' ? 'Choose…' : 'Enter…')}
        </span>
        {kind === 'select' && <span style={{ fontSize: 8, opacity: 0.55 }}>▾</span>}
      </div>
    </div>
  );
}

function MiniBadge({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 4, padding: 3 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.primary }} />
      <span style={{ fontSize: 8, fontWeight: 600, color: s.text, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {comp?.label ?? 'Status'}
      </span>
    </div>
  );
}

function MiniContainer({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg,
      borderRadius: s.radius, border: `1px dashed ${s.border}`,
      padding: 3, display: 'flex', flexDirection: 'column',
    }}>
      <span style={{ fontSize: 7, fontWeight: 700, color: s.text, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {comp?.label ?? 'Group'}
      </span>
    </div>
  );
}

function MiniLogs({ comp, p }: { comp: any; p: Palette }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, color: s.text,
      borderRadius: s.radius, border: `1px solid ${s.border}`,
      padding: 4, display: 'flex', flexDirection: 'column', gap: 1.5,
      fontFamily: 'monospace', fontSize: 6.5, opacity: 0.7, overflow: 'hidden',
    }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ height: 4, background: p.muted, opacity: 0.3 - i * 0.05, borderRadius: 1, width: `${90 - i * 10}%` }} />
      ))}
    </div>
  );
}

function MiniMedia({ comp, p, label }: { comp: any; p: Palette; label: string }) {
  const s = readStyle(comp, p);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: s.bg, color: s.text,
      borderRadius: s.radius, border: `1px solid ${s.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 600, opacity: 0.55,
    }}>
      {comp?.label ?? label}
    </div>
  );
}

function MiniComponent({ comp, p }: { comp: any; p: Palette }) {
  switch (comp?.type) {
    case 'Button':          return <MiniButton comp={comp} p={p} />;
    case 'StatCard':        return <MiniStatCard comp={comp} p={p} />;
    case 'Table':           return <MiniTable comp={comp} p={p} />;
    case 'BarChart':        return <MiniBarChart comp={comp} p={p} />;
    case 'LineChart':       return <MiniLineChart comp={comp} p={p} />;
    case 'Text':            return <MiniText comp={comp} p={p} />;
    case 'TextInput':       return <MiniInput comp={comp} p={p} kind="text" />;
    case 'NumberInput':     return <MiniInput comp={comp} p={p} kind="number" />;
    case 'Select':          return <MiniInput comp={comp} p={p} kind="select" />;
    case 'StatusBadge':     return <MiniBadge comp={comp} p={p} />;
    case 'Container':       return <MiniContainer comp={comp} p={p} />;
    case 'TabbedContainer': return <MiniContainer comp={comp} p={p} />;
    case 'LogsViewer':      return <MiniLogs comp={comp} p={p} />;
    case 'Image':           return <MiniMedia comp={comp} p={p} label="🖼 Image" />;
    case 'Embed':           return <MiniMedia comp={comp} p={p} label="⟨/⟩ Embed" />;
    default: {
      const s = readStyle(comp, p);
      return (
        <div style={{
          width: '100%', height: '100%',
          background: s.bg, color: s.text,
          borderRadius: s.radius, border: `1px solid ${s.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, opacity: 0.7,
        }}>
          {comp?.label ?? comp?.type ?? '—'}
        </div>
      );
    }
  }
}

// Children of containers should render *inside* their parent box, not at the
// canvas root. We bucket components by parentId so containers can render their
// own children at the top level (the real GridLayer does the same).
function topLevelComponents(components: any[]): any[] {
  return components.filter((c) => !c?.parentId);
}

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
            const visible = topLevelComponents(components);
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

                {/* Realistic preview — same 12-col grid as the real canvas, with
                    type-aware mini renderers so users can see what they'll get. */}
                <div className="picker-card-canvas" style={{ background: p.background }}>
                  {visible.map((c) => {
                    const layout = c?.layout ?? { x: 0, y: 0, w: 4, h: 4 };
                    return (
                      <div
                        key={c?.id ?? Math.random()}
                        className="picker-card-block-wrapper"
                        style={{
                          gridColumn: `${(layout.x ?? 0) + 1} / span ${layout.w ?? 4}`,
                          gridRow:    `${(layout.y ?? 0) + 1} / span ${layout.h ?? 4}`,
                        }}
                        title={`${c?.type} — ${c?.label ?? c?.id}`}
                      >
                        <MiniComponent comp={c} p={p} />
                      </div>
                    );
                  })}
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
