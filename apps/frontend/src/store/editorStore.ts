import { create } from 'zustand';
import type { ComponentConfig, ComponentStyle, ComponentData, SavedTemplate, ComponentType } from '../types/template';

const STORAGE_KEY = 'dashboard_templates';

// Default styles & data per component type
const defaultConfigs: Record<ComponentType, { style: ComponentStyle; data: ComponentData }> = {
  StatCard: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#e3e6ec',
      borderWidth: 1,
      padding: 20,
    },
    data: {
      fieldName: 'new_metric',
      mockValue: '0',
      dbBinding: '',
      refreshOn: 'onLoad',
    },
  },
  Table: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 10,
      borderColor: '#e3e6ec',
      borderWidth: 1,
      padding: 0,
    },
    data: {
      columns: [
        { name: 'Column 1', fieldKey: 'col1' },
        { name: 'Column 2', fieldKey: 'col2' },
      ],
      mockValue: [
        { col1: 'Sample', col2: 'Data' },
        { col1: 'Row 2', col2: 'Value' },
      ],
      dbBinding: '',
      refreshOn: 'onLoad',
    },
  },
  BarChart: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#e3e6ec',
      borderWidth: 1,
      padding: 20,
    },
    data: {
      series: [{ name: 'Series 1', fieldKey: 'value' }],
      mockValue: [
        { label: 'A', value: 30 },
        { label: 'B', value: 50 },
        { label: 'C', value: 40 },
      ],
      dbBinding: '',
      refreshOn: 'onLoad',
    },
  },
  LineChart: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#e3e6ec',
      borderWidth: 1,
      padding: 20,
    },
    data: {
      series: [{ name: 'Series 1', fieldKey: 'value' }],
      mockValue: [
        { label: 'A', value: 20 },
        { label: 'B', value: 35 },
        { label: 'C', value: 28 },
      ],
      dbBinding: '',
      refreshOn: 'onLoad',
    },
  },
  StatusBadge: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#2563eb',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 10,
      borderColor: '#e3e6ec',
      borderWidth: 1,
      padding: 16,
    },
    data: {
      fieldName: 'status',
      mockValue: 'Active',
      dbBinding: '',
      refreshOn: 'onLoad',
    },
  },
  Button: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#2563eb',
      fontFamily: 'Inter',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#e3e6ec',
    },
    data: {
      dbBinding: '',
      mockValue: null
    }
  },
  LogsViewer: {
    style: {
      backgroundColor: '#f8f9fb',
      textColor: '#0f1117',
      fontFamily: 'monospace',
      fontSize: 12,
      borderRadius: 6,
      borderColor: '#e3e6ec',
      borderWidth: 1
    },
    data: {
      dbBinding: '',
      mockValue: ['[INFO] Ready.']
    }
  }
};

interface EditorState {
  // Core state
  activeTemplateId: string | null;
  originalTemplateId: string | null;
  dashboardName: string;
  components: ComponentConfig[];
  queriesConfig: any[];
  selectedComponentId: string | null;
  dirtyStyleMap: Record<string, Partial<ComponentStyle>>;
  dirtyDataMap: Record<string, Partial<ComponentData>>;
  savedTemplates: Record<string, SavedTemplate>;

  // Engine state
  queries: Record<string, { data: any; isLoading: boolean; error: string | null; lastRunAt: string | null }>;
  componentState: Record<string, any>;

  // Actions
  loadTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[]) => void;
  loadSavedTemplate: (saved: SavedTemplate) => void;
  selectComponent: (id: string | null) => void;
  setDashboardName: (name: string) => void;
  updateStyle: (componentId: string, style: Partial<ComponentStyle>) => void;
  updateData: (componentId: string, data: Partial<ComponentData>) => void;
  addComponent: (type: ComponentType) => void;
  removeComponent: (id: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  resetToDefault: () => void;
  getResolvedComponent: (id: string) => ComponentConfig | undefined;
  deleteSavedTemplate: (templateId: string) => void;

  setQueryState: (queryName: string, state: Partial<{ data: any; isLoading: boolean; error: string | null; lastRunAt: string | null }>) => void;
  setComponentState: (componentId: string, state: any) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeTemplateId: null,
  originalTemplateId: null,
  dashboardName: '',
  components: [],
  queriesConfig: [],
  selectedComponentId: null,
  dirtyStyleMap: {},
  dirtyDataMap: {},
  savedTemplates: {},
  queries: {},
  componentState: {},

  setQueryState: (queryName, stateUpdates) => set((state) => ({
    queries: {
      ...state.queries,
      [queryName]: {
        ...(state.queries[queryName] || { data: null, isLoading: false, error: null, lastRunAt: null }),
        ...stateUpdates
      }
    }
  })),

  setComponentState: (componentId, stateUpdates) => set((state) => ({
    componentState: {
      ...state.componentState,
      [componentId]: {
        ...(state.componentState[componentId] || {}),
        ...stateUpdates
      }
    }
  })),

  loadTemplate: (templateId, name, components, queries = []) => {
    set({
      activeTemplateId: templateId,
      originalTemplateId: templateId,
      dashboardName: name,
      components: JSON.parse(JSON.stringify(components)),
      queriesConfig: JSON.parse(JSON.stringify(queries)),
      selectedComponentId: null,
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queries: {},
      componentState: {},
    });
  },

  loadSavedTemplate: (saved) => {
    set({
      activeTemplateId: saved.templateId,
      originalTemplateId: saved.originalTemplateId,
      dashboardName: saved.dashboardName,
      components: JSON.parse(JSON.stringify(saved.components)),
      queriesConfig: JSON.parse(JSON.stringify((saved as any).queries || [])),
      selectedComponentId: null,
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queries: {},
      componentState: {},
    });
  },

  selectComponent: (id) => set({ selectedComponentId: id }),

  setDashboardName: (name) => set({ dashboardName: name }),

  updateStyle: (componentId, styleUpdates) => {
    set((state) => {
      const newComponents = state.components.map((c) => {
        if (c.id !== componentId) return c;
        return {
          ...c,
          style: { ...c.style, ...styleUpdates },
        };
      });
      return {
        components: newComponents,
        dirtyStyleMap: {
          ...state.dirtyStyleMap,
          [componentId]: {
            ...(state.dirtyStyleMap[componentId] || {}),
            ...styleUpdates,
          },
        },
      };
    });
  },

  updateData: (componentId, dataUpdates) => {
    set((state) => {
      const newComponents = state.components.map((c) => {
        if (c.id !== componentId) return c;
        return {
          ...c,
          label: dataUpdates.label !== undefined ? (dataUpdates.label as string) : c.label,
          data: { ...c.data, ...dataUpdates },
        };
      });
      return {
        components: newComponents,
        dirtyDataMap: {
          ...state.dirtyDataMap,
          [componentId]: {
            ...(state.dirtyDataMap[componentId] || {}),
            ...dataUpdates,
          },
        },
      };
    });
  },

  addComponent: (type) => {
    const id = `${type.toLowerCase()}-${Date.now()}`;
    const defaults = defaultConfigs[type];
    const newComponent: ComponentConfig = {
      id,
      type,
      label: `New ${type}`,
      style: { ...defaults.style },
      data: JSON.parse(JSON.stringify(defaults.data)),
    };
    set((state) => ({
      components: [...state.components, newComponent],
      selectedComponentId: id,
    }));
  },

  removeComponent: (id) => {
    set((state) => ({
      components: state.components.filter((c) => c.id !== id),
      selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
    }));
  },

  saveToLocalStorage: () => {
    const state = get();
    const saved: SavedTemplate = {
      templateId: state.activeTemplateId!,
      dashboardName: state.dashboardName,
      components: JSON.parse(JSON.stringify(state.components)),
      savedAt: new Date().toISOString(),
      originalTemplateId: state.originalTemplateId!,
    };

    const existing = { ...state.savedTemplates };
    existing[state.activeTemplateId!] = saved;

    set({ savedTemplates: existing });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, SavedTemplate>;
        set({ savedTemplates: parsed });
      }
    } catch {
      // Ignore parse errors
    }
  },

  resetToDefault: () => {
    const state = get();
    // Delete from saved templates
    const existing = { ...state.savedTemplates };
    delete existing[state.activeTemplateId!];
    set({ savedTemplates: existing });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  },

  getResolvedComponent: (id) => {
    const state = get();
    return state.components.find((c) => c.id === id);
  },

  deleteSavedTemplate: (templateId) => {
    set((state) => {
      const existing = { ...state.savedTemplates };
      delete existing[templateId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      return { savedTemplates: existing };
    });
  },
}));
