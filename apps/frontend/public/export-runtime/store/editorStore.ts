import { create } from 'zustand';
import type { ComponentConfig, ComponentType } from '../types/template';

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
  loadTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[]) => void;
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

  loadTemplate: (_templateId, name, components, queries = []) => set({
    dashboardName: name,
    components: clone(components || []),
    queriesConfig: clone(queries || []),
    queryResults: {},
    componentState: {},
    activeTabs: {},
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
        data: null,
        status: 'idle',
        error: null,
        lastUpdated: null,
        ...state.queryResults[queryName],
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
