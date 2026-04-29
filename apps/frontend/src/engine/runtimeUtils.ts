import { useEditorStore } from '../store/editorStore';
import { resolve } from './bindingResolver';

export function normalizeExpression(expression: string): string {
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

  if (!expression || !String(expression).trim()) {
    return fallback;
  }

  const normalized = normalizeExpression(String(expression));

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  if (!normalized.includes(' ') && normalized.includes('.')) {
    const direct = resolve(normalized);
    return direct === undefined ? fallback : direct;
  }

  const state = useEditorStore.getState() as unknown as Record<string, unknown>;
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

  return normalizeExpression(binding)
    .replace(/^queries\./, '')
    .replace(/\.(data|trigger|isLoading|error)$/, '')
    .trim();
}

export function runAction(actionName: string | undefined, payload?: unknown) {
  if (!actionName?.trim()) {
    return;
  }

  const store = useEditorStore.getState();
  store.setComponentState(actionName.trim(), 'value', payload);
}

export function humanizeQueryError(error: string | null | undefined): string {
  const message = String(error || '').trim().toLowerCase();

  if (!message) {
    return 'Something went wrong — please retry';
  }
  if (message.includes('fetch failed') || message.includes('network') || message.includes('failed to fetch')) {
    return 'Could not reach the server';
  }
  if (message.includes('404')) {
    return 'The requested data was not found';
  }
  if (message.includes('403')) {
    return "You don't have permission to access this";
  }
  if (message.includes('500')) {
    return 'Server error — please try again';
  }
  if (message.includes('timeout')) {
    return 'Request timed out — server took too long';
  }
  return 'Something went wrong — please retry';
}
