
type State = {
  queries: Record<string, any>;
  components: Record<string, any>;
  [key: string]: any;
};

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

export function resolve(path: string, state: State): unknown {
  if (!path) {
    return undefined;
  }

  const normalizedPath = stripBindingDelimiters(path);
  const parts = normalizedPath.split('.');

  return getByPath(state, parts);
}

export function resolveBindings<T>(dataObject: T, state: State): T {
  if (!dataObject || typeof dataObject !== 'object') {
    return dataObject;
  }

  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(dataObject as Record<string, unknown>)) {
    if (
      typeof value === 'string' &&
      value.trim().startsWith('{{') &&
      value.trim().endsWith('}}')
    ) {
      resolved[key] = resolve(value, state);
      continue;
    }

    if (Array.isArray(value)) {
      resolved[key] = value.map(v => typeof v === 'string' && v.includes('{{') ? resolveTemplate(v, state) : v);
      continue;
    }

    resolved[key] = value;
  }

  return resolved as T;
}

export function resolveTemplate(template: string, state: State): string {
  if (!template) return '';
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
    const resolved = resolve(path.trim(), state);
    return resolved == null ? '' : String(resolved);
  });
}
