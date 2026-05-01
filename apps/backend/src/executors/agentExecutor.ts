import type { ExecutorResult } from './restExecutor.js';

export interface AgentExecutorInput {
  baseUrl:        string;
  authType:       string | null;
  resolvedSecret: string | null;
  endpoint:       string;
  params?:        Record<string, unknown>;
  body?:          Record<string, unknown>;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_TOTAL_MS     = 60_000;
const MAX_POLL_ATTEMPTS = 30;

function buildAuthHeaders(authType: string | null, resolvedSecret: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  };
  if (!resolvedSecret) return h;
  switch (authType) {
    case 'bearer':  h['Authorization'] = `Bearer ${resolvedSecret}`; break;
    case 'api_key': h['X-API-Key']     = resolvedSecret;             break;
    case 'basic':   h['Authorization'] = `Basic ${Buffer.from(resolvedSecret).toString('base64')}`; break;
  }
  return h;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function agentExecutor(input: AgentExecutorInput): Promise<ExecutorResult> {
  const { baseUrl, authType, resolvedSecret, endpoint, params, body } = input;

  const base    = baseUrl.replace(/\/$/, '');
  const path    = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const kickUrl = new URL(`${base}${path}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      kickUrl.searchParams.set(k, String(v));
    }
  }

  const headers = buildAuthHeaders(authType, resolvedSecret);

  // ── 1. Kick off the job ─────────────────────────────────────────────────────
  console.log(`[agentExecutor] kickoff → ${kickUrl.toString()}`);
  let kickoffResponse: Response;
  try {
    kickoffResponse = await fetch(kickUrl.toString(), {
      method:  'POST',
      headers,
      body:    JSON.stringify(body ?? {}),
    });
  } catch (err) {
    return { success: false, error: `Agent kickoff failed (${kickUrl.toString()}): ${(err as Error).message}` };
  }

  if (!kickoffResponse.ok) {
    // Read the response body so the user sees the API's actual complaint
    // (e.g. "url: must be a valid URL") instead of a generic status text.
    let detail = '';
    try {
      const raw = await kickoffResponse.text();
      if (raw) {
        // If it's JSON, pluck the most useful field; otherwise show first 200 chars
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.detail || parsed?.error || parsed?.message
                || JSON.stringify(parsed).slice(0, 200);
        } catch {
          detail = raw.slice(0, 200);
        }
      }
    } catch { /* ignore body read errors */ }

    return {
      success: false,
      error:   detail
        ? `Agent kickoff returned ${kickoffResponse.status} ${kickoffResponse.statusText} — ${detail}`
        : `Agent kickoff returned ${kickoffResponse.status} ${kickoffResponse.statusText}`,
    };
  }

  let kickoffJson: any;
  try {
    kickoffJson = await kickoffResponse.json();
  } catch {
    return { success: false, error: 'Agent kickoff returned non-JSON response' };
  }

  const jobId: string | undefined = kickoffJson?.jobId ?? kickoffJson?.job_id;
  if (!jobId || typeof jobId !== 'string') {
    return { success: false, error: 'Agent kickoff did not return a jobId' };
  }

  // ── 2. Poll for completion ──────────────────────────────────────────────────
  // Prefer poll_url / result_url from the kickoff response. If the agent
  // service doesn't provide one, fall back to a generic convention.
  // Currently our only agent (Nexus) uses `/public/result/<id>`.
  // If you add a second agent with a different convention, make sure its
  // kickoff response includes a `poll_url` field so this fallback never fires.
  const startedAt = Date.now();
  const pollUrlFromResponse: string | undefined =
    kickoffJson?.poll_url ?? kickoffJson?.pollUrl ?? kickoffJson?.result_url;
  const pollUrl = pollUrlFromResponse
    ? (pollUrlFromResponse.startsWith('http')
        ? pollUrlFromResponse
        : `${base}${pollUrlFromResponse.startsWith('/') ? '' : '/'}${pollUrlFromResponse}`)
    : `${base}/public/result/${encodeURIComponent(jobId)}`;

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    if (Date.now() - startedAt >= MAX_TOTAL_MS) {
      return { success: false, error: 'Agent timed out after 60s' };
    }

    await sleep(POLL_INTERVAL_MS);

    let pollResponse: Response;
    try {
      pollResponse = await fetch(pollUrl, { method: 'GET', headers });
    } catch (err) {
      return { success: false, error: `Agent poll failed: ${(err as Error).message}` };
    }

    if (!pollResponse.ok) {
      return {
        success: false,
        error:   `Agent poll returned ${pollResponse.status} ${pollResponse.statusText}`,
      };
    }

    let pollJson: any;
    try {
      pollJson = await pollResponse.json();
    } catch {
      return { success: false, error: 'Agent poll returned non-JSON response' };
    }

    const status = String(pollJson?.status ?? '').toLowerCase();

    if (status === 'complete' || status === 'completed' || status === 'success' || status === 'done') {
      // Some APIs (Nexus) return the result inline; others nest it under .result.
      // Default to the whole payload so nothing is dropped.
      return { success: true, data: pollJson.result ?? pollJson };
    }
    if (status === 'error' || status === 'failed') {
      return { success: false, error: pollJson.error ?? pollJson.message ?? 'Agent reported an error' };
    }
    // queued, running, processing, in_progress, etc. → keep polling
  }

  return { success: false, error: 'Agent timed out after 30 poll attempts' };
}
