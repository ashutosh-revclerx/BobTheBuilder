// Shared types for the in-builder AI assistant.

export type SuggestionType =
  | 'addComponent'
  | 'updateComponent'
  | 'removeComponent'
  | 'addQuery'
  | 'updateQuery'
  | 'removeQuery'
  | 'updateCanvas';

export interface Suggestion {
  type: SuggestionType;
  description: string;
  payload: Record<string, any>;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[];
  /** Tracks which suggestions in this message were applied/dismissed. */
  appliedIndexes?: number[];
  dismissedIndexes?: number[];
  ts: number;
}

export interface ChatRequestBody {
  message: string;
  generationPrompt?: string;
  dashboardName?: string;
  dashboardConfig?: {
    components: any[];
    queries: any[];
    canvasStyle?: any;
  };
  selectedComponent?: {
    id: string;
    type: string;
    label?: string;
    style?: Record<string, any>;
    data?: Record<string, any>;
  };
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponseBody {
  success: boolean;
  response: string;
  suggestions: Suggestion[];
  error?: string;
}
