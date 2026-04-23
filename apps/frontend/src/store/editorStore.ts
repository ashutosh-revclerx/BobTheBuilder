import { create } from 'zustand';
import type { ComponentConfig, ComponentStyle, ComponentData, SavedTemplate, ComponentType } from '../types/template';

const STORAGE_KEY = 'dashboard_templates';

// Default styles & data per component type
const defaultConfigs: Record<ComponentType, { style: ComponentStyle; data: ComponentData; layout: ComponentConfig['layout'] }> = {
  StatCard: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 20,
    },
    data: {
      fieldName: 'new_metric',
      mockValue: '0',
      dbBinding: '',
      refreshOn: 'onLoad',
      trend: '+12.5%',
      trendType: 'positive',
    },
    layout: { x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 4 }
  },
  Table: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 10,
      borderColor: '#000000',
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
      searchable: true,
      pagination: true,
    },
    layout: { x: 0, y: 0, w: 12, h: 16, minW: 4, minH: 8 }
  },
  BarChart: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#000000',
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
      xField: 'label',
      yField: 'value',
      dbBinding: '',
      refreshOn: 'onLoad',
    },
    layout: { x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6 }
  },
  LineChart: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 10,
      borderColor: '#000000',
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
      xField: 'label',
      yField: 'value',
      dbBinding: '',
      refreshOn: 'onLoad',
    },
    layout: { x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6 }
  },
  StatusBadge: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#2563eb',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 10,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 16,
    },
    data: {
      fieldName: 'status',
      mockValue: 'Active',
      dbBinding: '',
      refreshOn: 'onLoad',
      mapping: {
        'Active': '#059669',
        'Pending': '#d97706',
        'Error': '#dc2626',
      },
    },
    layout: { x: 0, y: 0, w: 2, h: 4, minW: 1, minH: 2 }
  },
  Button: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#2563eb',
      fontFamily: 'Inter',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#000000',
    },
    data: {
      dbBinding: '',
      mockValue: null,
      events: [{ type: 'onClick', action: 'none' }],
    },
    layout: { x: 0, y: 0, w: 2, h: 4, minW: 1, minH: 2 }
  },
  LogsViewer: {
    style: {
      backgroundColor: '#f8f9fb',
      textColor: '#0f1117',
      fontFamily: 'monospace',
      fontSize: 12,
      borderRadius: 6,
      borderColor: '#000000',
      borderWidth: 1
    },
    data: {
      dbBinding: '',
      mockValue: ['[INFO] Ready.'],
      levelFilter: 'all',
      logSearchable: true,
    },
    layout: { x: 0, y: 0, w: 12, h: 8, minW: 4, minH: 4 }
  },
  Container: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      borderRadius: 10,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 16
    },
    data: {
      containerLayout: 'vertical',
      gap: 10,
    },
    layout: { x: 0, y: 0, w: 12, h: 12, minW: 4, minH: 4 }
  },
  TabbedContainer: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      borderRadius: 10,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 0
    },
    data: {
      tabs: ['View 1', 'View 2', 'View 3']
    },
    layout: { x: 0, y: 0, w: 12, h: 16, minW: 4, minH: 4 }
  },
  Text: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 14,
      borderRadius: 6,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 8
    },
    data: {
      mockValue: 'This is a text component. You can bind data to it or type markdown.'
    },
    layout: { x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 }
  },
  TextInput: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 6,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 8
    },
    data: {
      label: 'Input label',
      mockValue: '',
      placeholder: 'Enter text...',
    },
    layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 }
  },
  NumberInput: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 6,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 8
    },
    data: {
      label: 'Number label',
      mockValue: 0,
      min: 0,
      max: 100,
      step: 1,
    },
    layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 }
  },
  Select: {
    style: {
      backgroundColor: '#ffffff',
      textColor: '#0f1117',
      fontFamily: 'Inter',
      fontSize: 13,
      borderRadius: 6,
      borderColor: '#000000',
      borderWidth: 1,
      padding: 8
    },
    data: {
      label: 'Select label',
      options: ['Option 1', 'Option 2', 'Option 3'],
      mockValue: 'Option 1',
      events: [{ type: 'onChange', action: 'none' }],
    },
    layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 }
  }
};
;


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

  // UI State for editing
  activeTabs: Record<string, string>; // Tracks which tab is currently viewed in a TabbedContainer
  draggingType: string | null;
  rightPanelOpen: boolean;
  lastSelectedComponentId: string | null;

  // Actions
  loadTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[]) => void;
  loadSavedTemplate: (saved: SavedTemplate) => void;
  selectComponent: (id: string | null) => void;
  setActiveTab: (containerId: string, tab: string) => void;
  setDashboardName: (name: string) => void;
  updateStyle: (componentId: string, style: Partial<ComponentStyle>) => void;
  updateData: (componentId: string, data: Partial<ComponentData>) => void;
  updateLayouts: (layouts: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  addComponent: (type: ComponentType, placement?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    parentId?: string;
    parentTab?: string;
  }) => void;
  removeComponent: (id: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  resetToDefault: () => void;
  getResolvedComponent: (id: string) => ComponentConfig | undefined;
  deleteSavedTemplate: (templateId: string) => void;
  setDraggingType: (type: string | null) => void;
  closeRightPanel: () => void;

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
  activeTabs: {},
  draggingType: null,
  dirtyStyleMap: {},
  dirtyDataMap: {},
  savedTemplates: {},
  queries: {},
  componentState: {},
  rightPanelOpen: true,
  lastSelectedComponentId: null,

  setDraggingType: (type) => set({ draggingType: type }),

  closeRightPanel: () => set({ rightPanelOpen: false, selectedComponentId: null }),

  setActiveTab: (containerId, tab) => set((state) => ({
    activeTabs: { ...state.activeTabs, [containerId]: tab }
  })),

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
      lastSelectedComponentId: components[0]?.id ?? null,
      rightPanelOpen: true,
      activeTabs: {},
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
      lastSelectedComponentId: saved.components[0]?.id ?? null,
      rightPanelOpen: true,
      activeTabs: {},
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queries: {},
      componentState: {},
    });
  },

  selectComponent: (id) => {
    if (id) {
      set({ selectedComponentId: id, lastSelectedComponentId: id, rightPanelOpen: true });
    } else {
      set({ selectedComponentId: null });
    }
  },

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

  updateLayouts: (newLayouts) => {
    set((state) => {
      const newComponents = state.components.map((c) => {
        const matchingLayout = newLayouts.find((l) => l.id === c.id);
        if (matchingLayout) {
          return {
            ...c,
            layout: {
              x: matchingLayout.x,
              y: matchingLayout.y,
              w: matchingLayout.w,
              h: matchingLayout.h,
            },
          };
        }
        return c;
      });
      return { components: newComponents };
    });
  },

  addComponent: (type, placement) => {
    set((state) => {
      const id = `${type.toLowerCase()}-${Date.now()}`;
      const defaults = defaultConfigs[type];
      
      let parentId: string | undefined = placement?.parentId;
      let parentTab: string | undefined = placement?.parentTab;
      
      // Auto-nesting only if no explicit placement is provided
      if (!placement && state.selectedComponentId) {
        const selectedComp = state.components.find((c) => c.id === state.selectedComponentId);
        if (selectedComp) {
          if (selectedComp.type === 'Container') {
            parentId = selectedComp.id;
          } else if (selectedComp.type === 'TabbedContainer') {
            parentId = selectedComp.id;
            parentTab = state.activeTabs[selectedComp.id] || selectedComp.data.tabs?.[0];
          }
        }
      }

      let layout = placement ? {
        x: placement.x ?? 0,
        y: placement.y ?? Infinity,
        w: placement.w ?? (defaults as any).layout.w,
        h: placement.h ?? (defaults as any).layout.h,
        minW: (defaults as any).layout.minW,
        minH: (defaults as any).layout.minH,
      } : {
        x: 0,
        y: Infinity,
        w: (defaults as any).layout.w,
        h: (defaults as any).layout.h,
        minW: (defaults as any).layout.minW,
        minH: (defaults as any).layout.minH,
      };

      const newComponent: ComponentConfig = {
        id,
        type,
        label: `New ${type}`,
        style: { ...defaults.style },
        data: JSON.parse(JSON.stringify(defaults.data)),
        parentId,
        parentTab,
        layout
      };

      return {
        components: [...state.components, newComponent],
        selectedComponentId: id,
        lastSelectedComponentId: id,
        rightPanelOpen: true,
      };
    });
  },

  removeComponent: (id) => {
    set((state) => {
      let idsToRemove = new Set<string>([id]);
      
      // Cascade recursively find all children
      let hasNewChildren = true;
      while (hasNewChildren) {
        hasNewChildren = false;
        const currentCount = idsToRemove.size;
        for (const comp of state.components) {
          if (comp.parentId && idsToRemove.has(comp.parentId) && !idsToRemove.has(comp.id)) {
            idsToRemove.add(comp.id);
            hasNewChildren = true;
          }
        }
        if (idsToRemove.size === currentCount) break;
      }

      return {
        components: state.components.filter((c) => !idsToRemove.has(c.id)),
        selectedComponentId: (state.selectedComponentId && idsToRemove.has(state.selectedComponentId)) ? null : state.selectedComponentId,
      };
    });
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
