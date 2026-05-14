import type { AssistantMessage as Msg } from '../../types/assistant';
import SuggestionCard from './SuggestionCard';

interface AssistantMessageProps {
  message: Msg;
}

export default function AssistantMessageBubble({ message }: AssistantMessageProps) {
  const applied = new Set(message.appliedIndexes ?? []);
  const dismissed = new Set(message.dismissedIndexes ?? []);

  return (
    <div className={`assistant-msg assistant-msg--${message.role}`}>
      <div className="assistant-msg__bubble">
        {message.content || (message.role === 'assistant' ? <em style={{ opacity: 0.6 }}>(no reply)</em> : null)}
      </div>
      {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
        <div className="assistant-msg__suggestions">
          {message.suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              messageId={message.id}
              index={i}
              suggestion={s}
              applied={applied.has(i)}
              dismissed={dismissed.has(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
