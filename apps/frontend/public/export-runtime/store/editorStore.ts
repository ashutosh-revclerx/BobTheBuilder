import { create } from 'zustand';

// Minimal inline types — the full types live in src/types/template.ts in the exported app
type ComponentType = string;
type ComponentConfig = {
  id: string;
  type: ComponentType;
  label: string;
  visible?: string | boolean;
  visibleForRoles?: string[];
  style: Record<string, unknown>;
  data: Record<string, unknown>;
  parentId?: string;
  parentTab?: string;
  layout?: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
};

type QueryState = {
  data: unknown;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  lastUpdated: number | null;
};

type EditorState = {
  dashboardName: string;
  components: ComponentConfig[];
  queriesConfig: any[];
  selectedComponentId: string | null;
  lastSelectedComponentId: string | null;
  rightPanelOpen: boolean;
  draggingType: string | null;
  queryResults: Record<string, QueryState>;
  componentState: Record<string, Record<string, unknown>>;
  activeTabs: Record<string, string>;
  canvasStyle: { backgroundColor: string };
  loadTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[], status?: 'draft' | 'live', publishedAt?: string | null, canvasStyle?: { backgroundColor: string }) => void;
  selectComponent: (id: string | null) => void;
  clearCanvasSelection: () => void;
  closeRightPanel: () => void;
  setDraggingType: (type: string | null) => void;
  setActiveTab: (containerId: string, tab: string) => void;
  updateLayouts: (layouts: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  addComponent: (type: ComponentType, placement?: Partial<NonNullable<ComponentConfig['layout']>> & { parentId?: string; parentTab?: string }) => void;
  removeComponent: (id: string) => void;
  duplicateComponent: (id?: string) => void;
  updateData: (componentId: string, data: Record<string, unknown>) => void;
  setQueryState: (queryName: string, state: Partial<QueryState>) => void;
  setComponentState: (componentId: string, key: string, value: unknown) => void;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const useEditorStore = create<EditorState>((set) => ({
  dashboardName: '',
  components: [],
  queriesConfig: [],
  selectedComponentId: null,
  lastSelectedComponentId: null,
  rightPanelOpen: false,
  draggingType: null,
  queryResults: {},
  componentState: {},
  activeTabs: {},
  canvasStyle: { backgroundColor: '#f3f4f6' },

  loadTemplate: (_templateId, name, components, queries = [], _status = 'draft', _publishedAt = null, canvasStyle) => set({
    dashboardName: name,
    components: clone(components || []),
    queriesConfig: clone(queries || []),
    queryResults: {},
    componentState: {},
    activeTabs: {},
    canvasStyle: canvasStyle || { backgroundColor: '#f3f4f6' },
  }),

  selectComponent: () => undefined,
  clearCanvasSelection: () => undefined,
  closeRightPanel: () => undefined,
  setDraggingType: () => undefined,

  setActiveTab: (containerId, tab) => set((state) => ({
    activeTabs: { ...state.activeTabs, [containerId]: tab },
  })),

  updateLayouts: () => undefined,
  addComponent: () => undefined,
  removeComponent: () => undefined,
  duplicateComponent: () => undefined,

  updateData: (componentId, data) => set((state) => ({
    components: state.components.map((component) =>
      component.id === componentId
        ? { ...component, data: { ...component.data, ...data } }
        : component,
    ),
  })),

  setQueryState: (queryName, queryState) => set((state) => ({
    queryResults: {
      ...state.queryResults,
      [queryName]: {
        ...(state.queryResults[queryName] || {
          data: null,
          status: 'idle',
          error: null,
          lastUpdated: null,
        }),
        ...queryState,
      },
    },
  })),

  setComponentState: (componentId, key, value) => set((state) => ({
    componentState: {
      ...state.componentState,
      [componentId]: {
        ...state.componentState[componentId],
        [key]: value,
      },
    },
  })),
}));
