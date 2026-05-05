import React, { useEffect, Suspense, lazy } from 'react';
import { executeOnLoadQueries, watchDependencies, resetReactiveState } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';
import { GridLayer } from './GridLayer';
import { resolveBackground } from '../../utils/styleUtils';

import StatCard from '../dashboard-components/StatCard';
import Table from '../dashboard-components/Table';
import StatusBadge from '../dashboard-components/StatusBadge';
import Button from '../dashboard-components/Button';
import Container from '../dashboard-components/Container';
import TabbedContainer from '../dashboard-components/TabbedContainer';
import Text from '../dashboard-components/Text';
import TextInput from '../dashboard-components/TextInput';
import NumberInput from '../dashboard-components/NumberInput';
import Select from '../dashboard-components/Select';
import Image from '../dashboard-components/Image';
import Embed from '../dashboard-components/Embed';
import type { ComponentType } from '../../types/template';

// Lazy load heavy components
const BarChartComponent = lazy(() => import('../dashboard-components/BarChart'));
const LineChartComponent = lazy(() => import('../dashboard-components/LineChart'));
const LogsViewer = lazy(() => import('../dashboard-components/LogsViewer'));

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

export default function Canvas({ readOnly = false }: { readOnly?: boolean }) {
  const components = useEditorStore((s) => s.components);
  const queriesConfig = useEditorStore((s) => s.queriesConfig);
  const clearCanvasSelection = useEditorStore((s) => s.clearCanvasSelection);
  const draggingType = useEditorStore((s) => s.draggingType);

  useEffect(() => {
    resetReactiveState();
    if (queriesConfig && queriesConfig.length > 0) {
      executeOnLoadQueries(queriesConfig);
      // seed the dependency snapshots with current values
      watchDependencies(queriesConfig);
    }
  }, [queriesConfig]);

  useEffect(() => {
    if (!queriesConfig || queriesConfig.length === 0) return;
    const unsub = useEditorStore.subscribe(() => watchDependencies(queriesConfig));
    return unsub;
  }, [queriesConfig]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    if ((e.target as HTMLElement).closest('.canvas-component-wrapper')) return;
    if ((e.target as HTMLElement).closest('.inline-picker')) return;
    clearCanvasSelection();
  };

  const canvasStyle = useEditorStore((s) => s.canvasStyle);

  return (
    <div
      className={`builder-canvas-wrapper${draggingType ? ' drop-active' : ''}`}
      onClick={handleCanvasClick}
      style={{ background: resolveBackground(canvasStyle as any) }}
    >
      <div className="builder-canvas">
        <Suspense fallback={<div className="canvas-loading-placeholder">Loading components...</div>}>
          <GridLayer parentId="root" componentMap={ComponentMap} readOnly={readOnly} />
        </Suspense>
        {components.length === 0 && (
          <div className="canvas-empty">
            <div className="canvas-empty-icon">📊</div>
            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No components yet</p>
            <p style={{ fontSize: '12px' }}>Pick a component from the left sidebar to add it</p>
          </div>
        )}
        {readOnly && (
          <div className="mock-data-chip">
            Using mock data
          </div>
        )}
      </div>
    </div>
  );
}
