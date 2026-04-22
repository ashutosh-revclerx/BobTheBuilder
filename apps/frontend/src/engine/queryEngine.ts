import { useEditorStore } from '../store/editorStore';
import type { QueryConfig } from '@btb/shared';

const BACKEND_URL = 'http://localhost:3001/api/v1/execute';

export async function executeQuery(query: QueryConfig, params: Record<string, any> = {}) {
  const store = useEditorStore.getState();
  
  // Set loading state
  store.setQueryState(query.name, { isLoading: true, error: null });

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceId: query.resource,
        queryName: query.name,
        endpoint: query.endpoint,
        method: query.method,
        params: { ...query.params, ...params }
      })
    });
    
    const json = await res.json();
    
    if (!json.success) {
      throw new Error(json.error || 'Query failed');
    }

    store.setQueryState(query.name, {
      isLoading: false,
      data: json.data,
      lastRunAt: new Date().toISOString()
    });
    
    return json.data;
  } catch (err: any) {
    store.setQueryState(query.name, {
      isLoading: false,
      error: err.message
    });
    throw err;
  }
}

export function executeOnLoadQueries(queries: QueryConfig[]) {
  const onLoadQueries = queries.filter(q => q.trigger === 'onLoad');
  onLoadQueries.forEach(q => {
    executeQuery(q).catch(() => { /* error recorded in store */ });
  });
}
