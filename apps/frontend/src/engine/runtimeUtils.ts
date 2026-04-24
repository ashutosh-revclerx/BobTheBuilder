import { useEditorStore } from '../store/editorStore';

export function resolveStorePath(path: string): unknown {
  const store = useEditorStore.getState() as Record<string, any>;
  if (!path) {
    return undefined;
  }

  return path.split('.').reduce((acc: any, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), store);
}

function normalizeExpression(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

export function evaluateExpression(expression: string | boolean | undefined, fallback: unknown = false): unknown {
  if (typeof expression === 'boolean') {
    return expression;
  }

  if (!expression || !String(expression).trim().length) {
    return fallback;
  }

  const normalized = normalizeExpression(String(expression));

  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  const state = useEditorStore.getState() as Record<string, any>;
  try {
    const evaluator = new Function('store', `with (store) { return (${normalized}); }`);
    return evaluator(state);
  } catch {
    return fallback;
  }
}

export function evaluateBooleanExpression(expression: string | boolean | undefined, fallback = false): boolean {
  return Boolean(evaluateExpression(expression, fallback));
}

export function parseQueryName(binding: unknown): string | null {
  if (typeof binding !== 'string' || !binding.trim()) {
    return null;
  }

  return binding
    .replace('{{', '')
    .replace('}}', '')
    .replace('queries.', '')
    .replace('.data', '')
    .trim();
}

export function runAction(actionName: string | undefined, payload?: unknown) {
  if (!actionName) {
    return;
  }

  const trimmed = actionName.trim();
  if (!trimmed) {
    return;
  }

  const store = useEditorStore.getState();
  store.setComponentState(trimmed, payload);
}
