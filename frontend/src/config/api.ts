const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

function readObjectValue(source: unknown, keys: string[]): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasAuthTokens(): boolean {
  return Boolean(getAccessToken());
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event('btb:auth-change'));
}

export function parseAuthTokens(payload: unknown): AuthTokens | null {
  const sources = [payload];
  const data = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>).data
    : null;
  if (data && typeof data === 'object') {
    sources.push(data);
  }

  for (const source of sources) {
    const accessToken = readObjectValue(source, ['access_token', 'accessToken', 'token']);
    if (!accessToken) {
      continue;
    }
    return {
      accessToken,
      refreshToken: readObjectValue(source, ['refresh_token', 'refreshToken']),
    };
  }

  return null;
}

export function storeAuthTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
  window.dispatchEvent(new Event('btb:auth-change'));
}

export function storeAuthTokensFromResponse(payload: unknown): AuthTokens | null {
  const tokens = parseAuthTokens(payload);
  if (!tokens) {
    return null;
  }
  storeAuthTokens(tokens);
  return tokens;
}

function redirectToLogin() {
  if (window.location.pathname === '/login') {
    return;
  }
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    return false;
  }

  const json = await response.json().catch(() => null);
  return Boolean(storeAuthTokensFromResponse(json));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const accessToken = getAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    clearAuthTokens();
    redirectToLogin();
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${getAccessToken()}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
