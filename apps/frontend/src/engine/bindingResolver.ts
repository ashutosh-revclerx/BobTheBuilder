import { useEditorStore } from '../store/editorStore';

function stripBindingDelimiters(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

function getByPath(source: unknown, pathParts: string[]): unknown {
  return pathParts.reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

export function resolve(path: string): unknown {
  if (!path) {
    return undefined;
  }

  const normalizedPath = stripBindingDelimiters(path);
  const parts = normalizedPath.split('.');
  const store = useEditorStore.getState();

  if (parts[0] === 'queries' || parts[0] === 'queryResults') {
    const [, queryName, ...rest] = parts;
    return getByPath(store.queryResults[queryName], rest);
  }

  if (parts[0] === 'components') {
    const [, componentId, ...rest] = parts;
    return getByPath(store.componentState[componentId], rest);
  }

  return getByPath(store as unknown, parts);
}

export function resolveBindings<T>(dataObject: T): T {
  if (!dataObject || typeof dataObject !== 'object') {
    return dataObject;
  }

  const resolved: Record<string, unknown> = {};
  resolved._resolvedBindings = {};

  for (const [key, value] of Object.entries(dataObject as Record<string, unknown>)) {
    if (key === '_resolvedBindings') {
      continue;
    }

    if (
      typeof value === 'string' &&
      value.trim().startsWith('{{') &&
      value.trim().endsWith('}}')
    ) {
      resolved[key] = resolve(value);
      (resolved._resolvedBindings as Record<string, boolean>)[key] = true;
      continue;
    }

    resolved[key] = value;
  }

  return resolved as T;
}
