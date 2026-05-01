import { create } from 'zustand';
import type {
  ComponentConfig,
  ComponentData,
  ComponentStyle,
  ComponentType,
  SavedTemplate,
  TableColumn,
} from '../types/template';

const STORAGE_KEY = 'dashboard_templates';

const VISIBILITY_ROLE_OPTIONS = ['admin', 'editor', 'viewer'] as const;

type LayoutConfig = NonNullable<ComponentConfig['layout']>;

const COMPONENT_LAYOUTS: Record<ComponentType, LayoutConfig> = {
  Table: { x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
  Button: { x: 0, y: 0, w: 2, h: 4, minW: 1, minH: 2 },
  Text: { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 1 },
  Container: { x: 0, y: 0, w: 4, h: 12, minW: 3, minH: 4 },
  TabbedContainer: { x: 0, y: 0, w: 6, h: 12, minW: 4, minH: 6 },
  StatCard: { x: 0, y: 0, w: 4, h: 6, minW: 2, minH: 4 },
  StatusBadge: { x: 0, y: 0, w: 2, h: 4, minW: 1, minH: 2 },
  TextInput: { x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 3 },
  Select: { x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 3 },
  NumberInput: { x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 3 },
  BarChart: { x: 0, y: 0, w: 6, h: 12, minW: 3, minH: 6 },
  LineChart: { x: 0, y: 0, w: 6, h: 12, minW: 3, minH: 6 },
  LogsViewer: { x: 0, y: 0, w: 4, h: 12, minW: 4, minH: 4 },
  Image: { x: 0, y: 0, w: 4, h: 8, minW: 2, minH: 3 },
  Embed: { x: 0, y: 0, w: 6, h: 10, minW: 3, minH: 4 },
};

const createBaseData = (): ComponentData => ({
  dbBinding: '',
  mockValue: '',
  refreshOn: 'manual',
  visible: 'true',
  visibleForRoles: [],
});

const createBaseStyle = (): ComponentStyle => ({
  backgroundColor: '#ffffff',
  textColor: '#0f1117',
  fontFamily: 'Inter',
  fontSize: 14,
  borderRadius: 8,
  borderColor: '#e3e6ec',
  borderWidth: 1,
  padding: 16,
});

const defaultTableColumns: TableColumn[] = [
  { name: 'Column 1', fieldKey: 'col1' },
  { name: 'Column 2', fieldKey: 'col2' },
];

const createDefaultConfig = (
  type: ComponentType,
): { style: ComponentStyle; data: ComponentData; layout: LayoutConfig } => {
  switch (type) {
    case 'Table':
      return {
        style: {
          ...createBaseStyle(),
          fontSize: 13,
          padding: 0,
          headerBackgroundColor: '#f2f4f7',
          rowAlternateColor: 'transparent',
          strikethrough: false,
          strikethroughField: '',
          strikethroughValue: '',
        },
        data: {
          ...createBaseData(),
          mockValue: [
            { col1: 'Sample', col2: 'Data' },
            { col1: 'Row 2', col2: 'Value' },
          ],
          rows: [
            { col1: 'Sample', col2: 'Data' },
            { col1: 'Row 2', col2: 'Value' },
          ],
          columns: defaultTableColumns,
          searchable: true,
          pagination: true,
          conditionalRowColor: [],
          onRowSelectAction: '',
          columnVisibility: { col1: true, col2: true },
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Button':
      return {
        style: {
          ...createBaseStyle(),
          backgroundColor: '#2563eb',
          textColor: '#ffffff',
          borderColor: '#2563eb',
          variant: 'Primary',
          iconLeft: '',
          fullWidth: false,
        },
        data: {
          ...createBaseData(),
          mockValue: null,
          disabled: 'false',
          loadingState: false,
          confirmationDialog: false,
          confirmationMessage: 'Are you sure?',
          confirmLabel: 'Confirm',
          cancelLabel: 'Cancel',
          onSuccessAction: '',
          onErrorAction: '',
          events: [{ type: 'onClick', action: 'none' }],
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Text':
      return {
        style: {
          ...createBaseStyle(),
          padding: 8,
          textAlign: 'Left',
          lineHeight: 1.5,
          overflow: 'Wrap',
        },
        data: {
          ...createBaseData(),
          mockValue: 'This is a text component. You can bind data to it or type markdown.',
          expression: false,
          linkTo: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Container':
      return {
        style: {
          ...createBaseStyle(),
          alignItems: 'Stretch',
          justifyContent: 'Start',
        },
        data: {
          ...createBaseData(),
          containerLayout: 'vertical',
          gap: 10,
          scrollable: false,
          divider: false,
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'TabbedContainer':
      return {
        style: {
          ...createBaseStyle(),
          padding: 0,
          tabPosition: 'Top',
          tabStyle: 'Underline',
        },
        data: {
          ...createBaseData(),
          tabs: ['View 1', 'View 2', 'View 3'],
          defaultTab: 'View 1',
          onTabChangeAction: '',
          gap: 10,
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'StatCard':
      return {
        style: {
          ...createBaseStyle(),
          borderRadius: 10,
          padding: 20,
          metricFontSize: 28,
          trendColorOverride: '',
        },
        data: {
          ...createBaseData(),
          fieldName: 'new_metric',
          mockValue: '0',
          refreshOn: 'onLoad',
          trend: '+12.5%',
          trendType: 'positive',
          prefix: '',
          suffix: '',
          comparisonValue: '',
          sparklineData: [],
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'StatusBadge':
      return {
        style: {
          ...createBaseStyle(),
          textColor: '#2563eb',
          fontSize: 13,
          borderRadius: 10,
          padding: 16,
          shape: 'Pill',
        },
        data: {
          ...createBaseData(),
          fieldName: 'status',
          mockValue: 'Active',
          refreshOn: 'onLoad',
          mapping: {
            Active: '#059669',
            Pending: '#d97706',
            Error: '#dc2626',
          },
          defaultColor: '#9ba3af',
          showDot: true,
          size: 'Medium',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'TextInput':
      return {
        style: {
          ...createBaseStyle(),
          fontSize: 13,
          padding: 8,
          labelPosition: 'Top',
        },
        data: {
          ...createBaseData(),
          label: 'Input label',
          mockValue: '',
          placeholder: 'Enter text...',
          type: 'Text',
          required: false,
          regex: '',
          errorMessage: 'Invalid input',
          maxLength: null,
          onChangeAction: '',
          onSubmitAction: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Select':
      return {
        style: {
          ...createBaseStyle(),
          fontSize: 13,
          padding: 8,
          labelPosition: 'Top',
        },
        data: {
          ...createBaseData(),
          label: 'Select label',
          options: ['Option 1', 'Option 2', 'Option 3'],
          mockValue: 'Option 1',
          required: false,
          multiSelect: false,
          searchable: false,
          onChangeAction: '',
          optionsSource: 'Static',
          queryBinding: '',
          labelField: 'label',
          valueField: 'value',
          optionsList: [
            { label: 'Option 1', value: 'Option 1' },
            { label: 'Option 2', value: 'Option 2' },
            { label: 'Option 3', value: 'Option 3' },
          ],
          events: [{ type: 'onChange', action: 'none' }],
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'NumberInput':
      return {
        style: {
          ...createBaseStyle(),
          fontSize: 13,
          padding: 8,
          labelPosition: 'Top',
          showStepper: true,
        },
        data: {
          ...createBaseData(),
          label: 'Number label',
          mockValue: 0,
          min: 0,
          max: 100,
          step: 1,
          required: false,
          prefix: '',
          suffix: '',
          errorMessage: 'Value out of range',
          onChangeAction: '',
          formatter: 'None',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'BarChart':
      return {
        style: {
          ...createBaseStyle(),
          borderRadius: 10,
          padding: 20,
          barRadius: 4,
          showDataLabels: false,
        },
        data: {
          ...createBaseData(),
          series: [{ name: 'Series 1', fieldKey: 'value' }],
          mockValue: [
            { label: 'A', value: 30 },
            { label: 'B', value: 50 },
            { label: 'C', value: 40 },
          ],
          xField: 'label',
          yField: 'value',
          refreshOn: 'onLoad',
          orientation: 'Vertical',
          stacked: false,
          showLegend: true,
          showGrid: true,
          xAxisLabel: '',
          yAxisLabel: '',
          showXAxis: true,
          showYAxis: true,
          colorScheme: 'Blue',
          onBarClickAction: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'LineChart':
      return {
        style: {
          ...createBaseStyle(),
          borderRadius: 10,
          padding: 20,
          lineWidth: 2,
          showDataLabels: false,
        },
        data: {
          ...createBaseData(),
          series: [{ name: 'Series 1', fieldKey: 'value' }],
          mockValue: [
            { label: 'A', value: 20 },
            { label: 'B', value: 35 },
            { label: 'C', value: 28 },
          ],
          xField: 'label',
          yField: 'value',
          refreshOn: 'onLoad',
          smooth: true,
          showDots: true,
          showLegend: true,
          showGrid: true,
          xAxisLabel: '',
          yAxisLabel: '',
          showXAxis: true,
          showYAxis: true,
          colorScheme: 'Blue',
          fillArea: false,
          onPointClickAction: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'LogsViewer':
      return {
        style: {
          ...createBaseStyle(),
          backgroundColor: '#f8f9fb',
          fontFamily: 'Fira Code',
          fontSize: 12,
          borderRadius: 6,
          levelColors: {
            INFO: '#059669',
            WARN: '#d97706',
            ERROR: '#dc2626',
            DEBUG: '#2563eb',
          },
        },
        data: {
          ...createBaseData(),
          mockValue: ['[INFO] Ready.'],
          levelFilter: 'all',
          logSearchable: true,
          maxLines: 200,
          autoScroll: true,
          timestampField: 'timestamp',
          levelField: 'level',
          messageField: 'message',
          wrapLines: false,
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Image':
      return {
        style: {
          ...createBaseStyle(),
          backgroundColor: '#f9fafb',
          padding: 0,
          borderRadius: 10,
        },
        data: {
          ...createBaseData(),
          src: '',
          uploadedSrc: '',
          alt: '',
          fit: 'contain',
          linkTo: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    case 'Embed':
      return {
        style: {
          ...createBaseStyle(),
          backgroundColor: '#000000',
          padding: 0,
          borderRadius: 10,
        },
        data: {
          ...createBaseData(),
          src: '',
        },
        layout: { ...COMPONENT_LAYOUTS[type] },
      };
    default:
      return {
        style: createBaseStyle(),
        data: createBaseData(),
        layout: { x: 0, y: 0, w: 4, h: 4, minW: 1, minH: 1 },
      };
  }
};

const defaultConfigs: Record<ComponentType, { style: ComponentStyle; data: ComponentData; layout: LayoutConfig }> = {
  StatCard: createDefaultConfig('StatCard'),
  Table: createDefaultConfig('Table'),
  BarChart: createDefaultConfig('BarChart'),
  LineChart: createDefaultConfig('LineChart'),
  StatusBadge: createDefaultConfig('StatusBadge'),
  Button: createDefaultConfig('Button'),
  LogsViewer: createDefaultConfig('LogsViewer'),
  Container: createDefaultConfig('Container'),
  TabbedContainer: createDefaultConfig('TabbedContainer'),
  Text: createDefaultConfig('Text'),
  TextInput: createDefaultConfig('TextInput'),
  NumberInput: createDefaultConfig('NumberInput'),
  Select: createDefaultConfig('Select'),
  Image: createDefaultConfig('Image'),
  Embed: createDefaultConfig('Embed'),
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const ensureColumnVisibility = (columns: TableColumn[] = [], current?: Record<string, boolean>) =>
  columns.reduce<Record<string, boolean>>((acc, column) => {
    acc[column.fieldKey] = current?.[column.fieldKey] ?? true;
    return acc;
  }, {});

const normalizeVisibleForRoles = (roles?: string[]) =>
  Array.isArray(roles) ? roles.filter((role): role is string => VISIBILITY_ROLE_OPTIONS.includes(role as any)) : [];

const normalizeComponent = (component: ComponentConfig): ComponentConfig => {
  const defaults = defaultConfigs[component.type];
  const data = {
    ...clone(defaults.data),
    ...clone(component.data ?? {}),
  };
  const columns = (data.columns ?? clone(defaultTableColumns)) as TableColumn[];

  if (component.type === 'Table') {
    data.columns = columns;
    data.columnVisibility = ensureColumnVisibility(columns, data.columnVisibility);
    data.rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data.mockValue) ? (data.mockValue as Record<string, any>[]) : [];
  }

  if (component.type === 'TabbedContainer') {
    const tabs = data.tabs?.length ? data.tabs : ['View 1'];
    data.tabs = tabs;
    data.defaultTab = tabs.includes(data.defaultTab || '') ? data.defaultTab : tabs[0];
  }

  if (component.type === 'Select') {
    const options = data.options?.length ? data.options : ['Option 1', 'Option 2', 'Option 3'];
    data.options = options;
    data.optionsList = data.optionsList?.length
      ? data.optionsList
      : options.map((option) => ({ label: option, value: option }));
  }

  const visibleValue = component.visible ?? data.visible ?? 'true';

  return {
    ...component,
    label: component.label ?? component.data?.label ?? `New ${component.type}`,
    visible: typeof visibleValue === 'boolean' ? String(visibleValue) : visibleValue,
    visibleForRoles: normalizeVisibleForRoles(component.visibleForRoles ?? data.visibleForRoles),
    style: {
      ...clone(defaults.style),
      ...clone(component.style ?? {}),
    },
    data: {
      ...data,
      visible: typeof visibleValue === 'boolean' ? String(visibleValue) : visibleValue,
      visibleForRoles: normalizeVisibleForRoles(component.visibleForRoles ?? data.visibleForRoles),
    },
    layout: {
      ...clone(defaults.layout),
      ...clone(component.layout ?? {}),
      minW: component.layout?.minW ?? defaults.layout.minW,
      minH: component.layout?.minH ?? defaults.layout.minH,
    },
  };
};

const normalizeComponents = (components: ComponentConfig[]) => components.map(normalizeComponent);

interface QueryState {
  data: unknown;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  lastUpdated: number | null;
}

interface EditorState {
  activeTemplateId: string | null;
  originalTemplateId: string | null;
  dashboardName: string;
  components: ComponentConfig[];
  queriesConfig: any[];
  selectedComponentId: string | null;
  dirtyStyleMap: Record<string, Partial<ComponentStyle>>;
  dirtyDataMap: Record<string, Partial<ComponentData>>;
  savedTemplates: Record<string, SavedTemplate>;
  queryResults: Record<string, QueryState>;
  componentState: Record<string, Record<string, unknown>>;
  activeTabs: Record<string, string>;
  draggingType: string | null;
  rightPanelOpen: boolean;
  lastSelectedComponentId: string | null;
  isPreviewMode: boolean;
  previewDevice: 'desktop' | 'mobile';
  rightPanelTab: 'style' | 'data' | 'theme';
  isDirty: boolean;
  status: 'draft' | 'live';
  publishedAt: string | null;
  loadTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[], status?: 'draft' | 'live', publishedAt?: string | null) => void;
  loadSavedTemplate: (saved: SavedTemplate) => void;
  selectComponent: (id: string | null) => void;
  clearCanvasSelection: () => void;
  setActiveTab: (containerId: string, tab: string) => void;
  setDashboardName: (name: string) => void;
  updateStyle: (componentId: string, style: Partial<ComponentStyle>) => void;
  updateData: (componentId: string, data: Partial<ComponentData>) => void;
  updateLabel: (componentId: string, label: string) => void;
  updateLayouts: (layouts: { id: string; x: number; y: number; w: number; h: number }[]) => void;
  addComponent: (
    type: ComponentType,
    placement?: {
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      parentId?: string;
      parentTab?: string;
    },
  ) => void;
  removeComponent: (id: string) => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  resetToTemplate: (templateId: string, name: string, components: ComponentConfig[], queries?: any[]) => void;
  resetToDefault: () => void;
  getResolvedComponent: (id: string) => ComponentConfig | undefined;
  renameSavedTemplate: (templateId: string, name: string) => void;
  deleteSavedTemplate: (templateId: string) => void;
  setDraggingType: (type: string | null) => void;
  closeRightPanel: () => void;
  setQueryState: (queryName: string, state: Partial<QueryState>) => void;
  setComponentState: (componentId: string, key: string, value: unknown) => void;
  setIsPreviewMode: (val: boolean) => void;
  setPreviewDevice: (device: 'desktop' | 'mobile') => void;
  togglePreviewMode: () => void;
  setRightPanelTab: (tab: 'style' | 'data' | 'theme') => void;
  upsertQuery: (query: Record<string, unknown> & { name: string }) => void;
  setStatus: (status: 'draft' | 'live', publishedAt: string | null) => void;
  applyThemeToAll: (paletteName: 'Cobalt' | 'Forest' | 'Graphite' | 'Amber' | 'Obsidian') => void;
  duplicateComponent: (id?: string) => void;
  importDashboard: (data: any) => void;
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
  queryResults: {},
  componentState: {},
  rightPanelOpen: true,
  lastSelectedComponentId: null,
  isPreviewMode: false,
  previewDevice: 'desktop',
  rightPanelTab: 'style',
  isDirty: false,
  status: 'draft',
  publishedAt: null,

  setDraggingType: (type) => set({ draggingType: type }),

  closeRightPanel: () => set({ rightPanelOpen: false, selectedComponentId: null }),

  clearCanvasSelection: () => set({ selectedComponentId: null, rightPanelOpen: true }),

  setActiveTab: (containerId, tab) =>
    set((state) => ({
      activeTabs: { ...state.activeTabs, [containerId]: tab },
    })),

  setQueryState: (queryName, stateUpdates) =>
    set((state) => ({
      queryResults: {
        ...state.queryResults,
        [queryName]: {
          ...(state.queryResults[queryName] || { data: null, status: 'idle', error: null, lastUpdated: null }),
          ...stateUpdates,
        },
      },
    })),

  setComponentState: (componentId, key, value) =>
    set((state) => ({
      componentState: {
        ...state.componentState,
        [componentId]: {
          ...(state.componentState[componentId] || {}),
          [key]: value,
        },
      },
    })),

  loadTemplate: (templateId, name, components, queries = [], status = 'draft', publishedAt = null) => {
    const normalizedComponents = normalizeComponents(clone(components));
    set({
      activeTemplateId: templateId,
      originalTemplateId: templateId,
      dashboardName: name,
      components: normalizedComponents,
      queriesConfig: clone(queries),
      status,
      publishedAt,
      selectedComponentId: null,
      lastSelectedComponentId: normalizedComponents[0]?.id ?? null,
      rightPanelOpen: true,
      activeTabs: {},
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queryResults: {},
      componentState: {},
      isDirty: false,
    });
  },

  loadSavedTemplate: (saved) => {
    const normalizedComponents = normalizeComponents(clone(saved.components));
    set({
      activeTemplateId: saved.templateId,
      originalTemplateId: saved.originalTemplateId,
      dashboardName: saved.dashboardName,
      components: normalizedComponents,
      queriesConfig: clone(saved.queries || []),
      status: (saved as any).status || 'draft',
      publishedAt: (saved as any).publishedAt || null,
      selectedComponentId: null,
      lastSelectedComponentId: normalizedComponents[0]?.id ?? null,
      rightPanelOpen: true,
      activeTabs: {},
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queryResults: {},
      componentState: {},
      isDirty: false,
    });
  },

  selectComponent: (id) => {
    if (id) {
      set({ selectedComponentId: id, lastSelectedComponentId: id, rightPanelOpen: true });
      return;
    }

    set({ selectedComponentId: null });
  },

  setDashboardName: (name) => set({ dashboardName: name, isDirty: true }),

  updateStyle: (componentId, styleUpdates) => {
    set((state) => {
      const components = state.components.map((component) =>
        component.id !== componentId
          ? component
          : {
              ...component,
              style: { ...component.style, ...styleUpdates },
            },
      );

      return {
        components,
        dirtyStyleMap: {
          ...state.dirtyStyleMap,
          [componentId]: {
            ...(state.dirtyStyleMap[componentId] || {}),
            ...styleUpdates,
          },
        },
        isDirty: true,
      };
    });
  },

  updateData: (componentId, dataUpdates) => {
    set((state) => {
      const components = state.components.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        const nextVisible = dataUpdates.visible ?? component.visible ?? component.data.visible ?? 'true';
        const nextRoles = dataUpdates.visibleForRoles ?? component.visibleForRoles ?? component.data.visibleForRoles ?? [];

        return normalizeComponent({
          ...component,
          label: dataUpdates.label !== undefined ? String(dataUpdates.label) : component.label,
          visible: typeof nextVisible === 'boolean' ? String(nextVisible) : nextVisible,
          visibleForRoles: normalizeVisibleForRoles(nextRoles as string[]),
          data: {
            ...component.data,
            ...dataUpdates,
            visible: typeof nextVisible === 'boolean' ? String(nextVisible) : nextVisible,
            visibleForRoles: normalizeVisibleForRoles(nextRoles as string[]),
          },
        });
      });

      return {
        components,
        dirtyDataMap: {
          ...state.dirtyDataMap,
          [componentId]: {
            ...(state.dirtyDataMap[componentId] || {}),
            ...dataUpdates,
          },
        },
        isDirty: true,
      };
    });
  },

  updateLabel: (componentId, label) => {
    set((state) => ({
      components: state.components.map((c) => 
        c.id === componentId ? normalizeComponent({ ...c, label }) : c
      ),
      isDirty: true,
    }));
  },

  updateLayouts: (newLayouts) => {
    set((state) => ({
      components: state.components.map((component) => {
        const matchingLayout = newLayouts.find((layout) => layout.id === component.id);
        if (!matchingLayout) {
          return component;
        }

        return {
          ...component,
          layout: {
            ...component.layout,
            x: matchingLayout.x,
            y: matchingLayout.y,
            w: matchingLayout.w,
            h: matchingLayout.h,
          },
        };
      }),
      isDirty: true,
    }));
  },

  addComponent: (type, placement) => {
    set((state) => {
      const id = `${type.toLowerCase()}-${Date.now()}`;
      const defaults = defaultConfigs[type];
      let parentId: string | undefined = placement?.parentId;
      let parentTab: string | undefined = placement?.parentTab;

      if (!placement && state.selectedComponentId) {
        const selectedComp = state.components.find((component) => component.id === state.selectedComponentId);
        if (selectedComp?.type === 'Container') {
          parentId = selectedComp.id;
        } else if (selectedComp?.type === 'TabbedContainer') {
          parentId = selectedComp.id;
          parentTab = state.activeTabs[selectedComp.id] || selectedComp.data.defaultTab || selectedComp.data.tabs?.[0];
        }
      }

      let layout: LayoutConfig = {
        ...clone(defaults.layout),
        x: placement?.x ?? defaults.layout.x,
        y: Number.isFinite(placement?.y) ? placement!.y! : defaults.layout.y,
        w: placement?.w ?? defaults.layout.w,
        h: placement?.h ?? defaults.layout.h,
      };

      if (Number.isFinite(layout.y)) {
        const levelSiblings = state.components.filter((component) =>
          parentId !== undefined ? component.parentId === parentId : !component.parentId,
        );
        const collides = levelSiblings.some((component) => {
          const cx = component.layout?.x ?? 0;
          const cy = component.layout?.y ?? 0;
          const cw = component.layout?.w ?? 4;
          const ch = component.layout?.h ?? 4;
          return layout.x < cx + cw && layout.x + layout.w > cx && layout.y < cy + ch && layout.y + layout.h > cy;
        });

        if (collides) {
          layout = {
            ...layout,
            y: levelSiblings.reduce((max, component) => Math.max(max, (component.layout?.y ?? 0) + (component.layout?.h ?? 4)), 0),
          };
        }
      }

      const newComponent = normalizeComponent({
        id,
        type,
        label: `New ${type}`,
        visible: 'true',
        visibleForRoles: [],
        style: clone(defaults.style),
        data: clone(defaults.data),
        parentId,
        parentTab,
        layout,
      });

      return {
        components: [...state.components, newComponent],
        selectedComponentId: id,
        lastSelectedComponentId: id,
        rightPanelOpen: true,
        isDirty: true,
      };
    });
  },

  removeComponent: (id) => {
    set((state) => {
      const idsToRemove = new Set<string>([id]);
      let hasNewChildren = true;

      while (hasNewChildren) {
        hasNewChildren = false;
        for (const component of state.components) {
          if (component.parentId && idsToRemove.has(component.parentId) && !idsToRemove.has(component.id)) {
            idsToRemove.add(component.id);
            hasNewChildren = true;
          }
        }
      }

      return {
        components: state.components.filter((component) => !idsToRemove.has(component.id)),
        selectedComponentId: idsToRemove.has(state.selectedComponentId || '') ? null : state.selectedComponentId,
        isDirty: true,
      };
    });
  },

  duplicateComponent: (id) => {
    set((state) => {
      const targetId = id || state.selectedComponentId;
      if (!targetId) return state;

      const source = state.components.find((c) => c.id === targetId);
      if (!source) return state;

      const newIdMap: Record<string, string> = {};
      const componentsToDuplicate: ComponentConfig[] = [];

      const collect = (cid: string) => {
        const comp = state.components.find((c) => c.id === cid);
        if (!comp) return;

        const newCid = `${comp.type.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        newIdMap[cid] = newCid;
        componentsToDuplicate.push(comp);

        state.components
          .filter((c) => c.parentId === cid)
          .forEach((child) => collect(child.id));
      };

      collect(targetId);

      const duplicated = componentsToDuplicate.map((comp) => {
        const newCid = newIdMap[comp.id];
        const newParentId = comp.parentId ? newIdMap[comp.parentId] : undefined;

        const layout = clone(comp.layout);
        if (comp.id === targetId) {
          layout.y = (layout.y ?? 0) + (layout.h ?? 2);
          
          // Collision check: if the new position overlaps with any existing component at the same level
          const levelSiblings = state.components.filter(s => 
            newParentId !== undefined ? s.parentId === newParentId : !s.parentId
          );
          
          let collision = levelSiblings.some(s => 
            layout.x < (s.layout.x + s.layout.w) && 
            (layout.x + layout.w) > s.layout.x && 
            layout.y < (s.layout.y + s.layout.h) && 
            (layout.y + layout.h) > s.layout.y
          );

          // If collision, push to bottom
          if (collision) {
             layout.y = levelSiblings.reduce((max, s) => Math.max(max, (s.layout?.y ?? 0) + (s.layout?.h ?? 2)), 0);
          }
        }

        return {
          ...clone(comp),
          id: newCid,
          parentId: newParentId,
          layout,
          label: `${comp.label} (Copy)`,
        };
      });

      return {
        components: [...state.components, ...duplicated],
        selectedComponentId: newIdMap[targetId],
        lastSelectedComponentId: newIdMap[targetId],
        isDirty: true,
      };
    });
  },

  saveToLocalStorage: () => {
    const state = get();
    const activeId = state.activeTemplateId;
    if (!activeId) return;

    // Real DB-backed dashboards (UUID id) live in Postgres — the builder PUTs
    // to /api/dashboards/<uuid> on Save and the loader fetches from the DB
    // unconditionally. Skip localStorage writes for UUID ids so that local
    // snapshots never shadow the canonical DB version.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(activeId)) {
      set({ isDirty: false });
      return;
    }

    const saved: SavedTemplate = {
      templateId: activeId,
      dashboardName: state.dashboardName,
      components: clone(state.components),
      queries: clone(state.queriesConfig),
      savedAt: new Date().toISOString(),
      originalTemplateId: state.originalTemplateId!,
    };

    const existing = { ...state.savedTemplates, [activeId]: saved };
    set({ savedTemplates: existing, isDirty: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, SavedTemplate>;
      const normalized = Object.fromEntries(
        Object.entries(parsed).map(([templateId, saved]) => [
          templateId,
          {
            ...saved,
            components: normalizeComponents(clone(saved.components)),
          },
        ]),
      );
      set({ savedTemplates: normalized });
    } catch {
      // Ignore parse errors
    }
  },

  resetToTemplate: (templateId, name, components, queries = []) => {
    const state = get();
    const existing = { ...state.savedTemplates };
    if (state.activeTemplateId) {
      delete existing[state.activeTemplateId];
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    
    const normalizedComponents = normalizeComponents(clone(components));
    set({
      savedTemplates: existing,
      activeTemplateId: templateId,
      originalTemplateId: templateId,
      dashboardName: name,
      components: normalizedComponents,
      queriesConfig: clone(queries),
      selectedComponentId: null,
      lastSelectedComponentId: normalizedComponents[0]?.id ?? null,
      rightPanelOpen: true,
      activeTabs: {},
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queryResults: {},
      componentState: {},
      isDirty: false,
      draggingType: null,
    });
  },

  resetToDefault: () => {
    const state = get();
    if (!state.activeTemplateId) return;
    const existing = { ...state.savedTemplates };
    delete existing[state.activeTemplateId];
    set({ 
      savedTemplates: existing,
      isDirty: false,
      dirtyStyleMap: {},
      dirtyDataMap: {},
      componentState: {},
      draggingType: null,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  },

  getResolvedComponent: (id) => get().components.find((component) => component.id === id),

  renameSavedTemplate: (templateId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    set((state) => {
      const saved = state.savedTemplates[templateId];
      if (!saved) return {};

      const existing = {
        ...state.savedTemplates,
        [templateId]: {
          ...saved,
          dashboardName: trimmedName,
          savedAt: new Date().toISOString(),
        },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

      return {
        savedTemplates: existing,
        dashboardName: state.activeTemplateId === templateId ? trimmedName : state.dashboardName,
      };
    });
  },

  deleteSavedTemplate: (templateId) => {
    set((state) => {
      const existing = { ...state.savedTemplates };
      delete existing[templateId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      return { savedTemplates: existing };
    });
  },

  setIsPreviewMode: (val) => set({ isPreviewMode: val }),

  setPreviewDevice: (device) => set({ previewDevice: device }),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  upsertQuery: (query) =>
    set((state) => {
      const existingIdx = state.queriesConfig.findIndex((q) => q.name === query.name);
      if (existingIdx >= 0) {
        const next = [...state.queriesConfig];
        next[existingIdx] = { ...next[existingIdx], ...query };
        return { queriesConfig: next, isDirty: true };
      }
      return { queriesConfig: [...state.queriesConfig, query], isDirty: true };
    }),

  setStatus: (status, publishedAt) => set({ status, publishedAt }),

  togglePreviewMode: () =>
    set((state) => {
      const nextPreview = !state.isPreviewMode;
      if (nextPreview) {
        // Entering preview
        return {
          isPreviewMode: true,
          selectedComponentId: null,
        };
      } else {
        // Exiting preview
        return {
          isPreviewMode: false,
          selectedComponentId: state.rightPanelOpen ? state.lastSelectedComponentId : null,
        };
      }
    }),

  applyThemeToAll: (paletteName) => {
    const THEME_PALETTES: Record<'Cobalt' | 'Forest' | 'Graphite' | 'Amber' | 'Obsidian', Record<string, string>> = {
      Cobalt: {
        surface: '#f0f4f8',
        panel: '#ffffff',
        border: '#cbd5e1',
        text: '#0f172a',
        primary: '#2563eb',
        card_tint: '#eff6ff',
        chart_tint: '#dbeafe',
        table_tint: '#f8fafc',
        input_tint: '#ffffff',
        success: '#16a34a',
        warning: '#d97706',
        error: '#dc2626',
      },
      Forest: {
        surface: '#f0faf4',
        panel: '#ffffff',
        border: '#bbf7d0',
        text: '#052e16',
        primary: '#16a34a',
        card_tint: '#f0fdf4',
        chart_tint: '#dcfce7',
        table_tint: '#f7fdf9',
        input_tint: '#ffffff',
        success: '#15803d',
        warning: '#ca8a04',
        error: '#b91c1c',
      },
      Graphite: {
        surface: '#080e1a',
        panel: '#0d1424',
        border: '#1e2d42',
        text: '#e2e8f0',
        primary: '#22d3ee',
        card_tint: '#0d1a2d',
        chart_tint: '#0a1628',
        table_tint: '#0a1220',
        input_tint: '#0d1424',
        success: '#34d399',
        warning: '#fbbf24',
        error: '#f87171',
      },
      Amber: {
        surface: '#fefce8',
        panel: '#fffef5',
        border: '#fde68a',
        text: '#292524',
        primary: '#b45309',
        card_tint: '#fefce8',
        chart_tint: '#fef3c7',
        table_tint: '#fffef5',
        input_tint: '#fffef5',
        success: '#15803d',
        warning: '#b45309',
        error: '#b91c1c',
      },
      Obsidian: {
        surface: '#09090b',
        panel: '#0f0f12',
        border: '#27272a',
        text: '#fafafa',
        primary: '#6366f1',
        card_tint: '#0f0f14',
        chart_tint: '#0c0c14',
        table_tint: '#09090b',
        input_tint: '#0f0f12',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
    };

    const palette = THEME_PALETTES[paletteName];
    if (!palette) return;

    set((state) => {
      const components = state.components.map((comp) => {
        const style = { ...comp.style };
        const ctype = comp.type;

        // Base
        style.backgroundColor = palette.panel;
        style.borderColor = palette.border;
        style.textColor = palette.text;

        // Component-specific
        if (ctype === 'StatCard' || ctype === 'StatusBadge') {
          style.backgroundColor = palette.card_tint;
        } else if (ctype === 'BarChart' || ctype === 'LineChart') {
          style.backgroundColor = palette.chart_tint;
        } else if (ctype === 'Table') {
          style.backgroundColor = palette.table_tint;
        } else if (ctype === 'Container' || ctype === 'TabbedContainer') {
          style.backgroundColor = palette.surface;
        } else if (ctype === 'TextInput' || ctype === 'NumberInput' || ctype === 'Select') {
          style.backgroundColor = palette.input_tint;
        } else if (ctype === 'Button') {
          style.backgroundColor = palette.primary;
        } else if (ctype === 'Text') {
          style.backgroundColor = 'transparent';
        }

        return { ...comp, style };
      });

      return { components, isDirty: true };
    });
  },
  
  importDashboard: (data) => {
    const { metadata, config, queries, state } = data;
    const normalizedComponents = normalizeComponents(clone(config.components || []));
    
    set({
      dashboardName: metadata.name,
      components: normalizedComponents,
      queriesConfig: clone(queries || []),
      status: metadata.status || 'draft',
      publishedAt: metadata.publishedAt || null,
      activeTabs: state?.activeTabs || {},
      selectedComponentId: null,
      lastSelectedComponentId: normalizedComponents[0]?.id ?? null,
      isDirty: false,
      activeTemplateId: null, // Importing a file breaks template link
      originalTemplateId: null,
      dirtyStyleMap: {},
      dirtyDataMap: {},
      queryResults: {},
      componentState: {},
    });
  },
}));
