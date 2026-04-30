import { 
  Table as TableIcon, 
  Square, 
  Type, 
  Box, 
  Layout, 
  BarChart3, 
  Activity, 
  FileText, 
  CheckSquare, 
  Hash,
  LineChart as LineIcon,
  Terminal
} from 'lucide-react';
import type { ComponentType } from '../types/template';

export interface ComponentOption {
  type: ComponentType;
  icon: React.ElementType;
  label: string;
  description?: string;
}

export interface ComponentCategory {
  title: string;
  options: ComponentOption[];
}

export const COMPONENT_REGISTRY: ComponentCategory[] = [
  {
    title: 'Commonly used',
    options: [
      { type: 'Table', icon: TableIcon, label: 'Table', description: 'Display data in a grid' },
      { type: 'Button', icon: Square, label: 'Button', description: 'Trigger actions' },
      { type: 'Text', icon: Type, label: 'Text', description: 'Display static text or markdown' },
      { type: 'Container', icon: Box, label: 'Container', description: 'Group components together' },
      { type: 'TabbedContainer', icon: Layout, label: 'Tabbed Container', description: 'Multi-view container' },
      { type: 'StatCard', icon: Activity, label: 'Stat Card', description: 'Display single metric' },
      { type: 'StatusBadge', icon: CheckSquare, label: 'Status Badge', description: 'Display status indicators' },
    ],
  },
  {
    title: 'Text inputs',
    options: [
      { type: 'TextInput', icon: FileText, label: 'Text Input', description: 'Single line text field' },
      { type: 'Select', icon: CheckSquare, label: 'Select', description: 'Dropdown selection' },
    ],
  },
  {
    title: 'Number inputs',
    options: [
      { type: 'NumberInput', icon: Hash, label: 'Number Input', description: 'Numeric input field' },
    ],
  },
  {
    title: 'Charts',
    options: [
      { type: 'BarChart', icon: BarChart3, label: 'Bar Chart', description: 'Visualize data with bars' },
      { type: 'LineChart', icon: LineIcon, label: 'Line Chart', description: 'Visualize trends over time' },
    ],
  },
  {
    title: 'Data & Logs',
    options: [
      { type: 'LogsViewer', icon: Terminal, label: 'Logs Viewer', description: 'Display real-time logs' },
    ],
  },
];
