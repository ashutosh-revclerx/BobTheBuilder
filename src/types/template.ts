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
  dbBinding?: string;
  refreshOn?: 'manual' | 'onLoad' | 'onRowSelect';
  label?: string;
  series?: Array<{ name: string; fieldKey: string }>;
  columns?: Array<{ name: string; fieldKey: string }>;
}

export type ComponentType = 'StatCard' | 'Table' | 'BarChart' | 'LineChart' | 'StatusBadge';

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  label: string;
  style: ComponentStyle;
  data: ComponentData;
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  components: ComponentConfig[];
}

export interface SavedTemplate {
  templateId: string;
  dashboardName: string;
  components: ComponentConfig[];
  savedAt: string;
  originalTemplateId: string;
}
