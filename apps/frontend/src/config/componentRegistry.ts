import type { ComponentType } from '../types/template';

export interface ComponentOption {
  type: ComponentType;
  icon: string;
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
      { type: 'Table', icon: '📋', label: 'Table', description: 'Display data in a grid' },
      { type: 'Button', icon: '⏹️', label: 'Button', description: 'Trigger actions' },
      { type: 'Text', icon: 'T', label: 'Text', description: 'Display static text or markdown' },
      { type: 'Container', icon: '◰', label: 'Container', description: 'Group components together' },
      { type: 'TabbedContainer', icon: '🗂️', label: 'Tabbed Container', description: 'Multi-view container' },
      { type: 'StatCard', icon: '📊', label: 'Stat Card', description: 'Display single metric' },
      { type: 'StatusBadge', icon: '🏷️', label: 'Status Badge', description: 'Display status indicators' },
    ],
  },
  {
    title: 'Text inputs',
    options: [
      { type: 'TextInput', icon: '📝', label: 'Text Input', description: 'Single line text field' },
      { type: 'Select', icon: '✅', label: 'Select', description: 'Dropdown selection' },
    ],
  },
  {
    title: 'Number inputs',
    options: [
      { type: 'NumberInput', icon: '#', label: 'Number Input', description: 'Numeric input field' },
    ],
  },
  {
    title: 'Charts',
    options: [
      { type: 'BarChart', icon: '📶', label: 'Bar Chart', description: 'Visualize data with bars' },
      { type: 'LineChart', icon: '📈', label: 'Line Chart', description: 'Visualize trends over time' },
    ],
  },
  {
    title: 'Data & Logs',
    options: [
      { type: 'LogsViewer', icon: '📜', label: 'Logs Viewer', description: 'Display real-time logs' },
    ],
  },
];
