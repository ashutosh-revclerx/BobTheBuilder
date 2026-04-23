import { useEffect } from 'react';
import { executeOnLoadQueries } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';
import { GridLayer } from './GridLayer';

import StatCard from '../dashboard-components/StatCard';
import Table from '../dashboard-components/Table';
import BarChartComponent from '../dashboard-components/BarChart';
import LineChartComponent from '../dashboard-components/LineChart';
import StatusBadge from '../dashboard-components/StatusBadge';
import Button from '../dashboard-components/Button';
import LogsViewer from '../dashboard-components/LogsViewer';
import Container from '../dashboard-components/Container';
import TabbedContainer from '../dashboard-components/TabbedContainer';
import Text from '../dashboard-components/Text';
import TextInput from '../dashboard-components/TextInput';
import NumberInput from '../dashboard-components/NumberInput';
import Select from '../dashboard-components/Select';
import type { ComponentType } from '../../types/template';

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
};

export default function Canvas() {
  const components = useEditorStore((s) => s.components);
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const draggingType = useEditorStore((s) => s.draggingType);

  useEffect(() => {
    if (queriesConfig && queriesConfig.length > 0) {
      executeOnLoadQueries(queriesConfig);
    }
  }, [queriesConfig]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-component-wrapper')) return;
    if ((e.target as HTMLElement).closest('.inline-picker')) return;
    selectComponent(null);
  };

  return (
    <div
      className={`builder-canvas-wrapper${draggingType ? ' drop-active' : ''}`}
      onClick={handleCanvasClick}
    >
      <div className="builder-canvas">
        <GridLayer parentId="root" componentMap={ComponentMap} />
        {components.length === 0 && (
          <div className="canvas-empty">
            <div className="canvas-empty-icon">📊</div>
            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No components yet</p>
            <p style={{ fontSize: '12px' }}>Pick a component from the left sidebar to add it</p>
          </div>
        )}
      </div>
    </div>
  );
}
