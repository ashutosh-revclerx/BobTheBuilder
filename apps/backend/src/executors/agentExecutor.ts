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
  let kickoffResponse: Response;
  try {
    kickoffResponse = await fetch(kickUrl.toString(), {
      method:  'POST',
      headers,
      body:    JSON.stringify(body ?? {}),
    });
  } catch (err) {
    return { success: false, error: `Agent kickoff failed: ${(err as Error).message}` };
  }

  if (!kickoffResponse.ok) {
    return {
      success: false,
      error:   `Agent kickoff returned ${kickoffResponse.status} ${kickoffResponse.statusText}`,
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
  const startedAt = Date.now();
  const pollUrl   = `${base}/jobs/${encodeURIComponent(jobId)}`;

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

    const status = pollJson?.status;

    if (status === 'complete') {
      return { success: true, data: pollJson.result };
    }
    if (status === 'error') {
      return { success: false, error: pollJson.error ?? 'Agent reported an error' };
    }
    // Any other status (running, queued, etc.) → keep polling
  }

  return { success: false, error: 'Agent timed out after 30 poll attempts' };
}
