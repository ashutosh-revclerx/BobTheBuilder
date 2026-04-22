import { useEditorStore } from '../store/editorStore';

/**
 * Resolves a dot-notation path against the entire Zustand store.
 * E.g., `resolve("queries.getUsers.data")` reads `store.queries.getUsers.data`
 */
export function resolve(path: string): unknown {
  const store = useEditorStore.getState() as any;
  if (!path) return undefined;
  
  return path.split('.').reduce((obj: any, key) => {
    return obj && obj[key] !== undefined ? obj[key] : undefined;
  }, store);
}

/**
 * Loops through a ComponentData configuration object looking for string
 * values that match the patterns `queries.*` or `components.*`.
 * It returns a cloned object with those bindings securely resolved.
 */
export function resolveBindings(dataObject: any): any {
  if (!dataObject || typeof dataObject !== 'object') return dataObject;
  
  const resolved: Record<string, unknown> = {};
  resolved._resolvedBindings = {} as Record<string, boolean>;
  
  for (const [key, value] of Object.entries(dataObject)) {
    if (key === '_resolvedBindings') continue;
    
    if (typeof value === 'string' && (value.startsWith('queries.') || value.startsWith('components.'))) {
      resolved[key] = resolve(value);
      (resolved._resolvedBindings as Record<string, boolean>)[key] = true;
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}
