import { useEffect, useRef, useCallback } from 'react';
import { useAppState } from './StateManager';
import { resolve, resolveTemplate } from './BindingResolver';

interface QueryConfig {
  name: string;
  resource: string;
  endpoint: string;
  method?: string;
  params?: Record<string, any>;
  body?: any;
  trigger?: 'onLoad' | 'manual' | 'onDependencyChange';
  dependsOn?: string[];
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/execute';

export const useQueryEngine = (queries: QueryConfig[]) => {
  const { setQueryState, getGlobalState } = useAppState();
  const inflight = useRef<Set<string>>(new Set());
  const previousDependencySnapshots = useRef<Map<string, string>>(new Map());

  const executeQuery = useCallback(async (query: QueryConfig, extraParams: Record<string, any> = {}) => {
    if (inflight.current.has(query.name)) return;

    inflight.current.add(query.name);
    setQueryState(query.name, { status: 'loading', error: null });

    const state = getGlobalState();

    try {
      const resolvedParams = Object.fromEntries(
        Object.entries(query.params || {}).map(([k, v]) => [
          k,
          typeof v === 'string' && v.includes('{{') ? resolve(v, state) : v
        ])
      );

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: query.resource,
          endpoint: resolveTemplate(query.endpoint, state),
          method: query.method || 'GET',
          params: { ...resolvedParams, ...extraParams },
          body: query.body ? resolveJsonTemplate(query.body, state) : undefined,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Query failed');
      }

      setQueryState(query.name, {
        data: json.data,
        status: 'success',
        error: null,
        lastUpdated: Date.now(),
      });

      return json.data;
    } catch (error: any) {
      setQueryState(query.name, {
        status: 'error',
        error: error.message,
        lastUpdated: Date.now(),
      });
    } finally {
      inflight.current.delete(query.name);
    }
  }, [getGlobalState, setQueryState]);

  // Initial load and dependency watching
  useEffect(() => {
    const state = getGlobalState();

    queries.forEach(query => {
      if (query.trigger === 'onLoad' && !previousDependencySnapshots.current.has(query.name)) {
        executeQuery(query);
        previousDependencySnapshots.current.set(query.name, 'loaded');
      }

      if (query.trigger === 'onDependencyChange' && query.dependsOn?.length) {
        const deps = query.dependsOn.map(d => resolve(d, state));
        const snapshot = JSON.stringify(deps);
        const prev = previousDependencySnapshots.current.get(query.name);

        if (snapshot !== prev) {
          previousDependencySnapshots.current.set(query.name, snapshot);
          if (prev !== undefined) { // Avoid running on first render if onLoad is not set
             executeQuery(query);
          }
        }
      }
    });
  }, [queries, getGlobalState, executeQuery]);

  return { executeQuery };
};

function resolveJsonTemplate(value: any, state: any): any {
  if (typeof value === 'string') {
    if (value.startsWith('{{') && value.endsWith('}}')) {
      return resolve(value, state);
    }
    return resolveTemplate(value, state);
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveJsonTemplate(v, state));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveJsonTemplate(v, state)])
    );
  }
  return value;
}
