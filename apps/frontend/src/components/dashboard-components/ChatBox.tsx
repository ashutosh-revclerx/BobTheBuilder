import { useEffect, useMemo, useRef, useState } from 'react';
import type { QueryConfig } from '@btb/shared';
import type { ComponentConfig } from '../../types/template';
import { executeQuery } from '../../engine/queryEngine';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface ChatBoxProps {
  config: ComponentConfig;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

const SEED_GREETING: ChatMessage = {
  id: 'seed',
  role: 'assistant',
  text: 'Hi! Ask me anything about your uploaded documents and their relations.',
  ts: Date.now(),
};

// Probe a payload for the actual answer text. Walks one level deep so we
// handle BOTH flat shapes ({ answer: "..." }) AND nested wrappers
// ({ data: { answer: "..." } }, { result: { reply: "..." } }) without
// configuration. Falls back to JSON dump so the user can ALWAYS see what
// the API returned and tell us what key to use.
function extractAnswer(payload: unknown): string {
  if (payload == null) return 'No response.';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);

  const KEYS = [
    'answer', 'response', 'reply', 'text', 'message', 'content',
    'output', 'completion', 'result', 'data',
  ];

  const tryRead = (obj: Record<string, unknown>): string | null => {
    for (const k of KEYS) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  };

  const obj = payload as Record<string, unknown>;
  const direct = tryRead(obj);
  if (direct) return direct;

  // Walk into known wrapper keys one level deep.
  for (const wrapper of ['data', 'result', 'response', 'output']) {
    const inner = obj[wrapper];
    if (inner && typeof inner === 'object') {
      const nested = tryRead(inner as Record<string, unknown>);
      if (nested) return nested;
    }
  }

  // Last resort: show the raw payload so user can identify the right field.
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function ChatBox({ config }: ChatBoxProps) {
  const { style, data } = config;
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  // Note: we read queryResults via getState() inside sendMessage so we get
  // the freshest snapshot AFTER executeQuery completes. Subscribing here
  // would only give us a stale closure.
  const setComponentState = useEditorStore((s) => s.setComponentState);

  const [messages, setMessages] = useState<ChatMessage[]>([SEED_GREETING]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  // Read the RAW binding string from the editor store. By the time the
  // resolved `data` reaches us here, `{{ }}`-wrapped bindings have already
  // been replaced with their resolved values — losing the query name.
  // Reading the unresolved binding directly lets ChatBox find the query
  // regardless of whether the template author wrote `queries.X.trigger`
  // (literal) or `{{queries.X.data}}` (resolved style).
  const rawBinding = useEditorStore(
    (s) => (s.components.find((c) => c.id === config.id)?.data as any)?.dbBinding,
  );
  const queryName = parseQueryName(rawBinding) || parseQueryName(data.dbBinding);
  const queryConfig = queriesConfig.find((q: QueryConfig) => q.name === queryName) as QueryConfig | undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPending(true);

    // Stash the question so the bound query can pick it up via {{components.X.value}}
    setComponentState(config.id, 'value', trimmed);
    setComponentState(config.id, 'lastQuestion', trimmed);

    try {
      if (queryConfig) {
        await executeQuery(queryConfig, { question: trimmed, value: trimmed });
        // Pull a FRESH snapshot from the store — the `queryResults` closure
        // captured at render time is stale and would still show the pre-call
        // state. getState() reads the just-updated store value.
        const fresh = useEditorStore.getState().queryResults;
        const result = fresh[queryConfig.name];
        if (result?.status === 'error') {
          setMessages((prev) => [
            ...prev,
            {
              id: `e-${Date.now()}`,
              role: 'assistant',
              text: `⚠️ Error: ${result.error || 'unknown'}`,
              ts: Date.now(),
            },
          ]);
        } else {
          const answer = extractAnswer(result?.data);
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: answer,
              ts: Date.now(),
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: '⚠️ No query bound. Bind a RAG endpoint in the Data tab via "dbBinding".',
            ts: Date.now(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: `Error: ${(err as Error).message}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  const accent = style.borderColor || '#6366f1';
  const txt = style.textColor || '#0f172a';
  const isDark = (style.backgroundColor || '').toLowerCase().match(/^#0|#1[0-3]/) !== null;

  return (
    <div
      className="chatbox-component"
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        borderRadius: style.borderRadius ? `${style.borderRadius}px` : '12px',
        border: `1px solid ${style.borderColor || '#e2e8f0'}`,
        padding: `${style.padding ?? 12}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingRight: 4,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              background: m.role === 'user' ? accent : (isDark ? '#1e293b' : '#f1f5f9'),
              color: m.role === 'user' ? '#ffffff' : txt,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 13,
              background: isDark ? '#1e293b' : '#f1f5f9',
              color: txt,
              opacity: 0.7,
            }}
          >
            <span className="chatbox-typing">● ● ●</span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          paddingTop: 8,
          borderTop: `1px solid ${style.borderColor || '#e2e8f0'}`,
        }}
      >
        <input
          type="text"
          value={input}
          placeholder={(data.placeholder as string) || 'Ask a question about your data...'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void sendMessage();
          }}
          disabled={pending}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${style.borderColor || '#cbd5e1'}`,
            background: isDark ? '#0f172a' : '#ffffff',
            color: txt,
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={pending || !input.trim()}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: accent,
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: pending || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: pending || !input.trim() ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {pending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
