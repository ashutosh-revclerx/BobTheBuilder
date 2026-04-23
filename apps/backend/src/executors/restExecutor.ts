export interface RestExecutorInput {
  baseUrl:        string;
  authType:       string | null;
  resolvedSecret: string | null;
  endpoint:       string;
  method:         string;
  params?:        Record<string, unknown>;
  body?:          Record<string, unknown>;
}

export interface ExecutorResult {
  success: boolean;
  data?:   unknown;
  error?:  string;
}

const TIMEOUT_MS = 30_000;

export async function restExecutor(input: RestExecutorInput): Promise<ExecutorResult> {
  const { baseUrl, authType, resolvedSecret, endpoint, method, params, body } = input;

  // Build URL — strip trailing slash from base, ensure leading slash on endpoint
  const base = baseUrl.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url  = new URL(`${base}${path}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  // Apply authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };

  if (resolvedSecret) {
    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${resolvedSecret}`;
        break;
      case 'api_key':
        headers['X-API-Key'] = resolvedSecret;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(resolvedSecret).toString('base64')}`;
        break;
      // 'none' and unknown: no auth header
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

    const response = await fetch(url.toString(), {
      method,
      headers,
      body:   hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // Parse response body — accept JSON or fall back to text
    const ct   = response.headers.get('content-type') ?? '';
    const data = ct.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      return {
        success: false,
        error:   `Upstream returned ${response.status} ${response.statusText}`,
        data,
      };
    }

    return { success: true, data };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds' };
    }
    return { success: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
