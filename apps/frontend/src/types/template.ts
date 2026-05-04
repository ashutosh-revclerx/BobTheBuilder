export interface ComponentStyle {
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  headerBackgroundColor?: string;
  rowAlternateColor?: string;
  strikethrough?: boolean;
  strikethroughField?: string;
  strikethroughValue?: string;
  letterSpacing?: number;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: number;
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  variant?: 'Primary' | 'Secondary' | 'Danger' | 'Ghost';
  iconLeft?: string;
  fullWidth?: boolean;
  textAlign?: 'Left' | 'Center' | 'Right' | 'Justify';
  lineHeight?: number;
  overflow?: 'Wrap' | 'Truncate' | 'Scroll';
  alignItems?: 'Start' | 'Center' | 'End' | 'Stretch';
  justifyContent?: 'Start' | 'Center' | 'End' | 'Space Between' | 'Space Around';
  tabPosition?: 'Top' | 'Bottom' | 'Left';
  tabStyle?: 'Underline' | 'Pills' | 'Boxed';
  metricFontSize?: number;
  trendColorOverride?: string;
  shape?: 'Rounded' | 'Pill' | 'Square';
  labelPosition?: 'Top' | 'Left' | 'Hidden';
  showStepper?: boolean;
  barRadius?: number;
  showDataLabels?: boolean;
  lineWidth?: number;
  levelColors?: Record<'INFO' | 'WARN' | 'ERROR' | 'DEBUG', string>;
  backgroundGradient?: {
    enabled: boolean;
    direction: number;
    stops: Array<{ color: string; position: number }>;
  };
  // Chart-specific
  seriesColors?: string[];
  gridColor?: string;
  axisColor?: string;
  xAxisColor?: string;
  yAxisColor?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;

  // Button-specific
  hoverBackgroundColor?: string;

  // Table-specific
  selectedRowColor?: string;
  stripeRows?: boolean;
  // StatCard-specific
  labelFontSize?: number;
  // Set by variants.py; used by components
  mutedColor?: string;
  focusBorderColor?: string;
  borderLeftColor?: string;
  borderLeftWidth?: number;

  // TabbedContainer-specific
  tabHeaderBackground?: string;
  tabHeaderTextColor?: string;
  tabHeaderActiveBackground?: string;
  tabHeaderActiveTextColor?: string;
  tabHeaderBorderColor?: string;

  // Search-specific (Table, Logs)
  searchBarBackground?: string;
  searchBarTextColor?: string;
  searchBarBorderColor?: string;
}

export interface ComponentEvent {
  type: 'onClick' | 'onChange' | 'onLoad' | 'onRowClick';
  action: 'runQuery' | 'setState' | 'navigate' | 'none';
  target?: string;
}

export interface TableColumn {
  name: string;
  fieldKey: string;
}

export interface TableConditionalRowColorRule {
  field: string;
  operator: '=' | '!=' | '>' | '<' | 'contains';
  value: string;
  color: string;
}

export interface SelectOptionItem {
  label: string;
  value: string;
}

export interface ComponentData {
  fieldName?: string;
  mockValue?: unknown;
  dbBinding?: any;
  refreshOn?: 'manual' | 'onLoad' | 'onRowSelect';
  label?: string;
  _resolvedBindings?: Record<string, boolean>;
  visible?: string | boolean;
  visibleForRoles?: string[];

  containerLayout?: 'vertical' | 'horizontal';
  gap?: number;
  scrollable?: boolean;
  divider?: boolean;

  tabs?: string[];
  defaultTab?: string;
  onTabChangeAction?: string;
  tabStyles?: Record<string, Partial<ComponentStyle>>;

  columns?: TableColumn[];
  rows?: Record<string, any>[];
  searchable?: boolean;
  pagination?: boolean;
  allowAddRows?: boolean;
  conditionalRowColor?: TableConditionalRowColorRule[];
  onRowSelectAction?: string;
  columnVisibility?: Record<string, boolean>;

  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  prefix?: string;
  suffix?: string;
  comparisonValue?: string;
  sparklineData?: number[];

  mapping?: Record<string, string>;
  defaultColor?: string;
  showDot?: boolean;
  size?: 'Small' | 'Medium' | 'Large';

  levelFilter?: 'all' | 'info' | 'warn' | 'error';
  logSearchable?: boolean;
  maxLines?: number;
  autoScroll?: boolean;
  timestampField?: string;
  levelField?: string;
  messageField?: string;
  wrapLines?: boolean;

  series?: Array<{ name: string; fieldKey: string }>;
  xField?: string;
  yField?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showXAxis?: boolean;
  showYAxis?: boolean;
  colorScheme?: 'Blue' | 'Green' | 'Amber' | 'Multi';
  orientation?: 'Vertical' | 'Horizontal';
  stacked?: boolean;
  onBarClickAction?: string;
  smooth?: boolean;
  showDots?: boolean;
  fillArea?: boolean;
  onPointClickAction?: string;

  placeholder?: string;
  type?: 'Text' | 'Email' | 'Password' | 'URL' | 'Search';
  required?: boolean;
  regex?: string;
  errorMessage?: string;
  maxLength?: number | null;
  onChangeAction?: string;
  onSubmitAction?: string;

  min?: number;
  max?: number;
  step?: number;
  formatter?: 'None' | 'Currency' | 'Percentage' | 'Compact';

  options?: string[];
  multiSelect?: boolean;
  optionsSource?: 'Static' | 'From query';
  queryBinding?: string;
  queryBindingConfig?: Record<string, unknown>;
  labelField?: string;
  valueField?: string;
  optionsList?: SelectOptionItem[];

  events?: ComponentEvent[];
  disabled?: string;
  loadingState?: boolean;
  confirmationDialog?: boolean;
  confirmationMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onSuccessAction?: string;
  onErrorAction?: string;
  expression?: boolean;
  linkTo?: string;
  // Image component
  src?:           string;
  uploadedSrc?:   string;  // base64 data URL when user uploads from disk
  alt?:           string;
  fit?:           'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

export type ComponentType =
  | 'StatCard'
  | 'Table'
  | 'BarChart'
  | 'LineChart'
  | 'StatusBadge'
  | 'Button'
  | 'LogsViewer'
  | 'Container'
  | 'TabbedContainer'
  | 'Text'
  | 'TextInput'
  | 'NumberInput'
  | 'Select'
  | 'Image'
  | 'Embed';

export interface ComponentConfig {
  id: string;
  type: ComponentType;
  label: string;
  visible?: string | boolean;
  visibleForRoles?: string[];
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
    minW?: number;
    minH?: number;
  };
}

export interface CanvasStyle {
  backgroundColor: string;
  backgroundGradient?: {
    enabled: boolean;
    direction: number;
    stops: Array<{ color: string; position: number }>;
  };
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  components: ComponentConfig[];
  queries?: any[];
  canvasStyle?: CanvasStyle;
}

export interface SavedTemplate {
  templateId: string;
  dashboardName: string;
  components: ComponentConfig[];
  queries?: any[];
  savedAt: string;
  originalTemplateId: string;
  canvasStyle?: CanvasStyle;
}
