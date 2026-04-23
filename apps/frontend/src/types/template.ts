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

export interface ComponentEvent {
  type: 'onClick' | 'onChange' | 'onLoad' | 'onRowClick';
  action: 'runQuery' | 'setState' | 'navigate' | 'none';
  target?: string; // query name, state key, or URL
}

export interface ComponentData {
  // ─── Global ───
  fieldName?: string;
  mockValue?: unknown;
  dbBinding?: any;
  refreshOn?: 'manual' | 'onLoad' | 'onRowSelect';
  label?: string;
  _resolvedBindings?: Record<string, boolean>;

  // ─── Container ───
  containerLayout?: 'vertical' | 'horizontal';
  gap?: number;

  // ─── TabbedContainer ───
  tabs?: string[];

  // ─── Table ───
  columns?: Array<{ name: string; fieldKey: string }>;
  searchable?: boolean;
  pagination?: boolean;

  // ─── StatCard ───
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';

  // ─── StatusBadge ───
  mapping?: Record<string, string>; // value → color

  // ─── LogsViewer ───
  levelFilter?: 'all' | 'info' | 'warn' | 'error';
  logSearchable?: boolean;

  // ─── Charts (Bar / Line) ───
  series?: Array<{ name: string; fieldKey: string }>;
  xField?: string;
  yField?: string;

  // ─── TextInput ───
  placeholder?: string;

  // ─── NumberInput ───
  min?: number;
  max?: number;
  step?: number;

  // ─── Select ───
  options?: string[];

  // ─── Events (all components) ───
  events?: ComponentEvent[];
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
  visible?: boolean;
  loading?: boolean;
  style: ComponentStyle;
  data: ComponentData;
  parentId?: string;
  parentTab?: string;
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
