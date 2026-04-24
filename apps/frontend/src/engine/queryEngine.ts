import { useEditorStore } from '../store/editorStore';
import { resolve } from './bindingResolver';
import type { QueryConfig } from '@btb/shared';

const BACKEND_URL = 'http://localhost:3001/api/execute';

// Tracks queries that are mid-flight so a dependency change during execution
// does not re-fire the same query (prevents A→B→A style cycles).
const inflight = new Set<string>();

// Per-query snapshot of the last-seen resolved dependency values. Any change
// vs. the snapshot triggers a re-run.
const lastSeenDeps = new Map<string, unknown[]>();

// Debounce timers — if multiple deps change within 100ms we coalesce into
// a single run.
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function executeQuery(query: QueryConfig, params: Record<string, any> = {}) {
  const store = useEditorStore.getState();

  if (inflight.has(query.name)) {
    console.warn(`[queryEngine] skipping "${query.name}" — already running (possible cycle)`);
    return;
  }
  inflight.add(query.name);

  store.setQueryState(query.name, { isLoading: true, error: null });

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource: query.resource,
        endpoint: query.endpoint,
        method:   query.method ?? 'GET',
        params:   { ...(query.params ?? {}), ...params },
      }),
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || 'Query failed');
    }

    store.setQueryState(query.name, {
      isLoading:  false,
      data:       json.data,
      lastRunAt:  new Date().toISOString(),
    });

    return json.data;
  } catch (err: any) {
    store.setQueryState(query.name, {
      isLoading: false,
      error:     err.message,
    });
    throw err;
  } finally {
    inflight.delete(query.name);
  }
}

export function executeOnLoadQueries(queries: QueryConfig[]) {
  const onLoadQueries = queries.filter((q) => q.trigger === 'onLoad');
  onLoadQueries.forEach((q) => {
    executeQuery(q).catch(() => { /* error recorded in store */ });
  });
}

// ─── Reactive dependencies ───────────────────────────────────────────────────

/**
 * Walk `queries`, resolve each onDependencyChange query's dependsOn paths
 * against the current store, and re-run the query if any resolved value has
 * changed since the last snapshot. Debounced per-query at 100ms so rapid
 * bursts of store updates coalesce into one run.
 *
 * Call this from a Zustand subscription so every store change re-evaluates
 * dependencies. Cycles are blocked by the `inflight` set — a query that is
 * still running will not be re-fired by a change it caused itself.
 */
export function watchDependencies(queries: QueryConfig[]) {
  const reactive = queries.filter(
    (q) => q.trigger === 'onDependencyChange' && Array.isArray(q.dependsOn) && q.dependsOn.length > 0,
  );

  for (const query of reactive) {
    const paths = query.dependsOn ?? [];
    const current = paths.map((p) => resolve(p));
    const previous = lastSeenDeps.get(query.name);

    const changed =
      !previous ||
      previous.length !== current.length ||
      current.some((v, i) => !shallowEqual(v, previous[i]));

    if (!changed) continue;

    lastSeenDeps.set(query.name, current);

    // First observation (no previous snapshot) is not a "change" — it's just
    // recording the baseline. Only fire from the second observation onwards.
    if (!previous) continue;

    const existing = debounceTimers.get(query.name);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      query.name,
      setTimeout(() => {
        debounceTimers.delete(query.name);
        executeQuery(query).catch(() => { /* error recorded in store */ });
      }, 100),
    );
  }
}

/**
 * Reset the reactive-engine's internal state. Call when loading a new
 * dashboard so stale snapshots from the previous one don't leak through.
 */
export function resetReactiveState() {
  inflight.clear();
  lastSeenDeps.clear();
  for (const t of debounceTimers.values()) clearTimeout(t);
  debounceTimers.clear();
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
