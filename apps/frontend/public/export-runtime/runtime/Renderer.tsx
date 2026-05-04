import { useEffect } from 'react';
import { executeOnLoadQueries, resetReactiveState, watchDependencies } from '../engine/queryEngine';
import { useEditorStore } from '../store/editorStore';
import { GridLayer } from '../components/editor/GridLayer';

import StatCard from '../components/dashboard-components/StatCard';
import Table from '../components/dashboard-components/Table';
import BarChartComponent from '../components/dashboard-components/BarChart';
import LineChartComponent from '../components/dashboard-components/LineChart';
import StatusBadge from '../components/dashboard-components/StatusBadge';
import Button from '../components/dashboard-components/Button';
import LogsViewer from '../components/dashboard-components/LogsViewer';
import Container from '../components/dashboard-components/Container';
import TabbedContainer from '../components/dashboard-components/TabbedContainer';
import Text from '../components/dashboard-components/Text';
import TextInput from '../components/dashboard-components/TextInput';
import NumberInput from '../components/dashboard-components/NumberInput';
import Select from '../components/dashboard-components/Select';
import Image from '../components/dashboard-components/Image';
import Embed from '../components/dashboard-components/Embed';
import type { ComponentConfig, ComponentType } from '../types/template';

const ComponentMap: Record<ComponentType, React.ComponentType<any>> = {
  StatCard,
  Table,
  BarChart: BarChartComponent,
  LineChart: LineChartComponent,
  StatusBadge,
  Button,
  LogsViewer,
  Container,
  TabbedContainer,
  Text,
  TextInput,
  NumberInput,
  Select,
  Image,
  Embed,
};

interface RendererProps {
  config: {
    name?: string;
    components: ComponentConfig[];
    canvasStyle?: { backgroundColor: string };
  };
  queries?: any[];
}

export default function Renderer({ config, queries = [] }: RendererProps) {
  const components = useEditorStore((state) => state.components);
  const queriesConfig = useEditorStore((state) => state.queriesConfig);
  const canvasStyle = useEditorStore((state) => state.canvasStyle);

  useEffect(() => {
    useEditorStore.getState().loadTemplate('exported-dashboard', config.name || 'Dashboard', config.components || [], queries, 'live', null, config.canvasStyle);
  }, [config, queries]);

  useEffect(() => {
    resetReactiveState();
    if (queriesConfig.length > 0) {
      executeOnLoadQueries(queriesConfig);
      watchDependencies(queriesConfig);
    }
  }, [queriesConfig]);

  useEffect(() => {
    if (queriesConfig.length === 0) return;
    return useEditorStore.subscribe(() => watchDependencies(queriesConfig));
  }, [queriesConfig]);

  return (
    <div className="builder-canvas-wrapper preview-mode" style={{ backgroundColor: canvasStyle?.backgroundColor || '#f3f4f6' }}>
      <div className="builder-canvas">
        <GridLayer parentId="root" componentMap={ComponentMap} readOnly />
        {components.length === 0 ? (
          <div className="canvas-empty">
            <div className="canvas-empty-icon">Chart</div>
            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No components found</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
