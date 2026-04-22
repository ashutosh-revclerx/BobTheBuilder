export interface ComponentStyle {
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
}

export interface ComponentData {
  fieldName?: string;
  mockValue?: unknown;
  dbBinding?: any; // Changed from string to any because it gets replaced with resolved data at runtime
  refreshOn?: 'manual' | 'onLoad' | 'onRowSelect';
  label?: string;
  series?: Array<{ name: string; fieldKey: string }>;
  columns?: Array<{ name: string; fieldKey: string }>;
  _resolvedBindings?: Record<string, boolean>;
  tabs?: string[]; // for TabbedContainer
  options?: string[]; // for Select
}

export type ComponentType = 
  | 'StatCard' | 'Table' | 'BarChart' | 'LineChart' 
  | 'StatusBadge' | 'Button' | 'LogsViewer'
  | 'Container' | 'TabbedContainer'
  | 'Text' | 'TextInput' | 'NumberInput' | 'Select';

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  label: string;
  style: ComponentStyle;
  data: ComponentData;
  parentId?: string; // used for nesting inside containers
  parentTab?: string; // used when nested inside a TabbedContainer
  layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  components: ComponentConfig[];
  queries?: any[];
}

export interface SavedTemplate {
  templateId: string;
  dashboardName: string;
  components: ComponentConfig[];
  savedAt: string;
  originalTemplateId: string;
}
