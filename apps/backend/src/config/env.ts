function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  port:             readPositiveInt('PORT', 3001),
  llmServiceUrl:    (process.env.LLM_SERVICE_URL ?? 'http://localhost:8001').replace(/\/$/, ''),
  llmTimeoutMs:     readPositiveInt('LLM_TIMEOUT_MS', 180_000),
  llmChatTimeoutMs: readPositiveInt('LLM_CHAT_TIMEOUT_MS', 60_000),
  corsOrigin:       process.env.CORS_ORIGIN ?? '*',
  logLevel:         process.env.LOG_LEVEL ?? 'info',
} as const;
