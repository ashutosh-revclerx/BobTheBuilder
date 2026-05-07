import { useEditorStore } from '../../store/editorStore';
import type { Suggestion } from '../../types/assistant';

interface SuggestionCardProps {
  messageId: string;
  index: number;
  suggestion: Suggestion;
  applied: boolean;
  dismissed: boolean;
}

const TYPE_LABELS: Record<Suggestion['type'], string> = {
  addComponent:    '+ Add component',
  updateComponent: '✎ Update component',
  removeComponent: '− Remove component',
  addQuery:        '+ Add query',
  updateQuery:     '✎ Update query',
  removeQuery:     '− Remove query',
  updateCanvas:    '✎ Update canvas',
};

export default function SuggestionCard({
  messageId,
  index,
  suggestion,
  applied,
  dismissed,
}: SuggestionCardProps) {
  const applySuggestion = useEditorStore((s) => s.applySuggestion);
  const undoSuggestion = useEditorStore((s) => s.undoSuggestion);
  const dismissSuggestion = useEditorStore((s) => s.dismissSuggestion);

  const isResolved = applied || dismissed;

  return (
    <div className={`assistant-suggestion ${isResolved ? 'resolved' : ''}`}>
      <div className="assistant-suggestion__header">
        <span className="assistant-suggestion__chip">{TYPE_LABELS[suggestion.type]}</span>
      </div>
      <div className="assistant-suggestion__body">
        {suggestion.description}
      </div>
      <div className="assistant-suggestion__actions">
        {applied && (
          <>
            <span className="assistant-suggestion__status applied">✓ Applied</span>
            <button
              type="button"
              className="assistant-suggestion__btn assistant-suggestion__btn--undo"
              onClick={() => undoSuggestion(messageId, index)}
              title="Revert this change"
            >
              ↶ Undo
            </button>
          </>
        )}
        {dismissed && <span className="assistant-suggestion__status dismissed">Dismissed</span>}
        {!isResolved && (
          <>
            <button
              type="button"
              className="assistant-suggestion__btn assistant-suggestion__btn--apply"
              onClick={() => applySuggestion(messageId, index)}
            >
              Apply
            </button>
            <button
              type="button"
              className="assistant-suggestion__btn assistant-suggestion__btn--dismiss"
              onClick={() => dismissSuggestion(messageId, index)}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
