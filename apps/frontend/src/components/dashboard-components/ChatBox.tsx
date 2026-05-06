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

function extractAnswer(payload: unknown): string {
  if (!payload) return 'No response.';
  if (typeof payload === 'string') return payload;
  const obj = payload as Record<string, unknown>;
  // Common RAG response shapes
  return (
    (obj.answer as string) ||
    (obj.response as string) ||
    (obj.text as string) ||
    (obj.message as string) ||
    (obj.result as string) ||
    JSON.stringify(payload)
  );
}

export default function ChatBox({ config }: ChatBoxProps) {
  const { style, data } = config;
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  const queryResults = useEditorStore((s) => s.queryResults);
  const setComponentState = useEditorStore((s) => s.setComponentState);

  const [messages, setMessages] = useState<ChatMessage[]>([SEED_GREETING]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  const queryName = parseQueryName(data.dbBinding);
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
        // After execution, queryResults[queryName] is populated.
        const result = queryResults[queryConfig.name];
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
