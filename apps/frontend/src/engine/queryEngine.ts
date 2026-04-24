import type { QueryConfig } from '@btb/shared';
import { useEditorStore } from '../store/editorStore';
import { resolve } from './bindingResolver';

const BACKEND_URL = 'http://localhost:3001/api/execute';
const inflight = new Set<string>();
const previousDependencySnapshots = new Map<string, string>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function serializeValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
}

function resolveQueryTemplate(value: string): string {
  return value.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
    const resolved = resolve(path.trim());
    return resolved == null ? '' : String(resolved);
  });
}

function resolveParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === 'string' && value.includes('{{')) {
        return [key, resolve(value)];
      }
      return [key, value];
    }),
  );
}

export async function executeQuery(query: QueryConfig, params: Record<string, unknown> = {}) {
  const store = useEditorStore.getState();

  if (inflight.has(query.name)) {
    console.warn(`Cycle detected for query ${query.name}`);
    return;
  }

  inflight.add(query.name);
  store.setQueryState(query.name, { status: 'loading', error: null });

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource: query.resource,
        endpoint: resolveQueryTemplate(query.endpoint),
        method: query.method ?? 'GET',
        params: {
          ...resolveParams(query.params),
          ...params,
        },
      }),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || response.statusText || 'Query failed');
    }

    store.setQueryState(query.name, {
      data: json.data,
      status: 'success',
      error: null,
      lastUpdated: Date.now(),
    });

    return json.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    store.setQueryState(query.name, {
      data: null,
      status: 'error',
      error: message,
      lastUpdated: Date.now(),
    });
    throw error;
  } finally {
    inflight.delete(query.name);
  }
}

export function executeOnLoadQueries(queries: QueryConfig[]) {
  queries
    .filter((query) => query.trigger === 'onLoad')
    .forEach((query) => {
      executeQuery(query).catch(() => undefined);
    });
}

export function watchDependencies(queries: QueryConfig[]) {
  queries
    .filter((query) => query.trigger === 'onDependencyChange' && Array.isArray(query.dependsOn) && query.dependsOn.length > 0)
    .forEach((query) => {
      const resolvedDependencies = (query.dependsOn ?? []).map((dependency) => resolve(dependency));
      const snapshot = serializeValue(resolvedDependencies);
      const previousSnapshot = previousDependencySnapshots.get(query.name);

      if (snapshot === previousSnapshot) {
        return;
      }

      previousDependencySnapshots.set(query.name, snapshot);

      if (!previousSnapshot) {
        return;
      }

      const hasRunnableValue = resolvedDependencies.some((value) => value !== null && value !== undefined);
      if (!hasRunnableValue) {
        return;
      }

      const existingTimer = debounceTimers.get(query.name);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      debounceTimers.set(
        query.name,
        setTimeout(() => {
          debounceTimers.delete(query.name);
          if (inflight.has(query.name)) {
            console.warn(`Cycle detected for query ${query.name}`);
            return;
          }
          executeQuery(query).catch(() => undefined);
        }, 150),
      );
    });
}

export function resetReactiveState() {
  inflight.clear();
  previousDependencySnapshots.clear();
  debounceTimers.forEach((timer) => clearTimeout(timer));
  debounceTimers.clear();
}
