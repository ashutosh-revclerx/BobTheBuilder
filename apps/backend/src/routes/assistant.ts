import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('assistant');

const router = Router();

const LLM_CHAT_TIMEOUT_MS = env.llmChatTimeoutMs;

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
    const response = await fetch(`${env.llmServiceUrl}/chat`, {
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
      log.error(`chat upstream error status=${response.status} detail=${detail.slice(0, 300)}`);
      return res.status(502).json({ error: detail });
    }

    const totalDurationMs = Date.now() - startedAt;
    log.info(`chat success duration_ms=${totalDurationMs}`);
    return res.json(json);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      const seconds = Math.round(LLM_CHAT_TIMEOUT_MS / 1000);
      log.error(`chat timeout timeout_ms=${LLM_CHAT_TIMEOUT_MS}`);
      return res.status(504).json({ error: `Assistant took longer than ${seconds} seconds` });
    }
    log.error('chat proxy error:', err);
    return res.status(502).json({ error: 'Could not reach the LLM service' });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
