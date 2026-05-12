import type { ChatRequestBody, ChatResponseBody } from '../types/assistant';

import { API_BASE_URL, apiFetch } from '../config/api';

export async function sendAssistantChat(body: ChatRequestBody): Promise<ChatResponseBody> {
  const response = await apiFetch(`${API_BASE_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* fall through */ }

  if (!response.ok) {
    const err = json?.error || text || `Assistant returned ${response.status}`;
    throw new Error(err);
  }

  return json as ChatResponseBody;
}
