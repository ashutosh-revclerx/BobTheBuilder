import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { sendAssistantChat } from '../../services/assistantService';
import type { AssistantMessage } from '../../types/assistant';
import AssistantMessageBubble from './AssistantMessage';

interface AssistantPanelProps {
  onClose?: () => void;
}

const STARTER_PROMPTS = [
  'Explain this dashboard',
  'Suggest improvements',
  'Add a date filter',
];

export default function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [width, setWidth] = useState(340);
  const [draft, setDraft] = useState('');
  const isResizing = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useEditorStore((s) => s.assistantMessages);
  const loading = useEditorStore((s) => s.assistantLoading);
  const error = useEditorStore((s) => s.assistantError);
  const generationPrompt = useEditorStore((s) => s.generationPrompt);
  const dashboardName = useEditorStore((s) => s.dashboardName);
  const components = useEditorStore((s) => s.components);
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  const canvasStyle = useEditorStore((s) => s.canvasStyle);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const appendAssistantMessage = useEditorStore((s) => s.appendAssistantMessage);
  const setAssistantLoading = useEditorStore((s) => s.setAssistantLoading);
  const setAssistantError = useEditorStore((s) => s.setAssistantError);
  const clearAssistantConversation = useEditorStore((s) => s.clearAssistantConversation);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX;
      let newWidth = startWidth + delta;
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 560) newWidth = 560;
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSend = async (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || loading) return;

    setDraft('');
    setAssistantError(null);

    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
      ts: Date.now(),
    };
    appendAssistantMessage(userMsg);

    // Build the conversation history snapshot BEFORE the new user message lands,
    // so the LLM doesn't see the new message twice (we send it as `message`).
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const state = useEditorStore.getState();
    const selected = selectedComponentId
      ? state.components.find((c) => c.id === selectedComponentId)
      : undefined;

    setAssistantLoading(true);
    try {
      const result = await sendAssistantChat({
        message,
        generationPrompt: generationPrompt ?? undefined,
        dashboardName: dashboardName || undefined,
        dashboardConfig: {
          components,
          queries: queriesConfig,
          canvasStyle,
        },
        selectedComponent: selected
          ? {
              id: selected.id,
              type: selected.type,
              label: selected.label,
              style: selected.style as Record<string, any>,
              data: selected.data as Record<string, any>,
            }
          : undefined,
        conversationHistory: history,
      });

      const assistantMsg: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        suggestions: result.suggestions ?? [],
        ts: Date.now(),
      };
      appendAssistantMessage(assistantMsg);
    } catch (err) {
      setAssistantError((err as Error).message || 'Assistant failed');
    } finally {
      setAssistantLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="assistant-panel" style={{ width: `${width}px` }}>
      <div className="panel-resizer panel-resizer-right" onMouseDown={startResize} />

      <div className="assistant-panel__header">
        <div className="assistant-panel__title">
          <span className="assistant-panel__icon">✦</span> AI Assistant
        </div>
        <div className="assistant-panel__header-actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="assistant-panel__icon-btn"
              title="Clear conversation"
              onClick={clearAssistantConversation}
            >
              ⟲
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="assistant-panel__icon-btn"
              title="Close assistant"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {generationPrompt && (
        <div className="assistant-panel__context-chip" title={generationPrompt}>
          <span className="assistant-panel__context-label">Context:</span>
          <span className="assistant-panel__context-text">
            {generationPrompt.length > 80 ? generationPrompt.slice(0, 80) + '…' : generationPrompt}
          </span>
        </div>
      )}

      <div className="assistant-panel__scroll" ref={scrollRef}>
        {isEmpty ? (
          <div className="assistant-panel__empty">
            <div className="assistant-panel__empty-icon">✦</div>
            <div className="assistant-panel__empty-title">Ask me about your dashboard</div>
            <div className="assistant-panel__empty-sub">
              I have full context of {generationPrompt ? 'your original prompt and ' : ''}
              the current dashboard.
            </div>
            <div className="assistant-panel__starters">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="assistant-panel__starter"
                  onClick={() => void handleSend(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <AssistantMessageBubble key={m.id} message={m} />)
        )}
        {loading && (
          <div className="assistant-msg assistant-msg--assistant">
            <div className="assistant-msg__bubble assistant-msg__bubble--typing">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        )}
        {error && <div className="assistant-panel__error">{error}</div>}
      </div>

      <div className="assistant-panel__composer">
        <textarea
          className="assistant-panel__input"
          placeholder={loading ? 'Thinking…' : 'Ask anything about your dashboard…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          rows={2}
        />
        <button
          type="button"
          className="assistant-panel__send"
          disabled={loading || !draft.trim()}
          onClick={() => void handleSend()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
