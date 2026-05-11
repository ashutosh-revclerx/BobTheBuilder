import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL ?? 'http://localhost:8001';
const DEFAULT_LLM_TIMEOUT_MS = 60_000; // chat is faster than generation; tighter cap

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const LLM_CHAT_TIMEOUT_MS = readPositiveIntEnv('LLM_CHAT_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS);

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const SelectedComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  style: z.record(z.string(), z.any()).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

const ChatSchema = z.object({
  message: z.string().min(1),
  generationPrompt: z.string().optional(),
  dashboardName: z.string().optional(),
  dashboardConfig: z
    .object({
      components: z.array(z.any()),
      queries: z.array(z.any()),
      canvasStyle: z.any().optional(),
    })
    .passthrough()
    .optional(),
  selectedComponent: SelectedComponentSchema.optional(),
  conversationHistory: z.array(ChatMessageSchema).default([]),
});

// ─── POST /api/assistant/chat ─────────────────────────────────────────────────
// Proxy to the Python LLM microservice's /chat endpoint. The LLM responds
// with both free-text and structured suggestions; we forward the response
// untouched so the frontend can render Apply buttons for each suggestion.

router.post('/chat', async (req, res) => {
  const startedAt = Date.now();
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_CHAT_TIMEOUT_MS);

  try {
    const response = await fetch(`${LLM_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* fall through */ }

    if (!response.ok) {
      const detail = (json && typeof json === 'object' && 'detail' in json)
        ? String((json as Record<string, unknown>).detail)
        : text || `LLM service returned ${response.status}`;
      console.error('[assistant] chat upstream error status=%d detail=%s', response.status, detail.slice(0, 300));
      return res.status(502).json({ error: detail });
    }

    const totalDurationMs = Date.now() - startedAt;
    console.info('[assistant] chat success duration_ms=%d', totalDurationMs);
    return res.json(json);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      const seconds = Math.round(LLM_CHAT_TIMEOUT_MS / 1000);
      console.error('[assistant] chat timeout timeout_ms=%d', LLM_CHAT_TIMEOUT_MS);
      return res.status(504).json({ error: `Assistant took longer than ${seconds} seconds` });
    }
    console.error('[assistant] chat proxy error:', err);
    return res.status(502).json({ error: 'Could not reach the LLM service' });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
