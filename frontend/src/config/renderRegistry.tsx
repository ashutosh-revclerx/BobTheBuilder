/**
 * Shared component registry used by both the main Canvas and preview renderers.
 * This is the single source of truth for component implementations.
 *
 * Both preview and final dashboard use these same components, ensuring
 * visual consistency between preview and rendered output.
 */

import React, { lazy, Suspense } from 'react';
import StatCard from '../components/dashboard-components/StatCard';
import Table from '../components/dashboard-components/Table';
import StatusBadge from '../components/dashboard-components/StatusBadge';
import Button from '../components/dashboard-components/Button';
import Container from '../components/dashboard-components/Container';
import TabbedContainer from '../components/dashboard-components/TabbedContainer';
import Text from '../components/dashboard-components/Text';
import TextInput from '../components/dashboard-components/TextInput';
import NumberInput from '../components/dashboard-components/NumberInput';
import Select from '../components/dashboard-components/Select';
import Image from '../components/dashboard-components/Image';
import Embed from '../components/dashboard-components/Embed';
import FileUpload from '../components/dashboard-components/FileUpload';
import ChatBox from '../components/dashboard-components/ChatBox';
import type { ComponentType } from '../types/template';

// Lazy load heavy components with Suspense
const BarChartComponent = lazy(() => import('../components/dashboard-components/BarChart'));
const LineChartComponent = lazy(() => import('../components/dashboard-components/LineChart'));
const LogsViewer = lazy(() => import('../components/dashboard-components/LogsViewer'));
const NodeGraph = lazy(() => import('../components/dashboard-components/NodeGraph'));

/**
 * Single source of truth for all component implementations.
 * Used by:
 * - Canvas (main editor/viewer)
 * - PreviewRenderer (template picker)
 * - Any other rendering context
 */
export const RenderRegistry: Record<ComponentType, React.ComponentType<any>> = {
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
  NodeGraph,
  FileUpload,
  ChatBox,
};

export function getComponent(type: ComponentType): React.ComponentType<any> | undefined {
  return RenderRegistry[type];
}

/**
 * Component renderer wrapper that provides Suspense handling for lazy-loaded components.
 * Use this in preview contexts where you want to avoid rendering placeholders.
 */
export function ComponentWithSuspense({
  component: Component,
  fallback = null,
  ...props
}: {
  component: React.ComponentType<any>;
  fallback?: React.ReactNode;
  [key: string]: any;
}) {
  // Check if component is lazy by looking for ._result property
  const isLazy = (Component as any)._result === undefined && (Component as any).$$typeof?.toString().includes('lazy');

  if (isLazy) {
    return (
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    );
  }

  return <Component {...props} />;
}
