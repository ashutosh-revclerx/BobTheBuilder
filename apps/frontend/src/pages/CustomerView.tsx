import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { executeOnLoadQueries, watchDependencies, resetReactiveState } from '../engine/queryEngine';
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
import type { ComponentType } from '../types/template';

const API_BASE = 'http://localhost:3001';

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

interface CustomerPayload {
  customer: {
    id:           string;
    name:         string;
    slug:         string;
    brand_config: Record<string, any>;
  };
  dashboard: {
    id:     string;
    name:   string;
    slug:   string;
    config: {
      components: any[];
      queries?:   any[];
      [k: string]: any;
    };
  };
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CustomerPayload };

export default function CustomerView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const loadTemplate = useEditorStore((s) => s.loadTemplate);
  const queriesConfig = useEditorStore((s) => s.queriesConfig);

  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/customers/${encodeURIComponent(slug)}/dashboard`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setState({
              status:  'error',
              message: body?.error || 'Dashboard not found',
            });
          }
          return;
        }
        const payload = (await res.json()) as CustomerPayload;
        if (cancelled) return;

        loadTemplate(
          payload.dashboard.id,
          payload.dashboard.name,
          payload.dashboard.config?.components ?? [],
          payload.dashboard.config?.queries ?? [],
        );
        setState({ status: 'ready', data: payload });
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', message: 'Dashboard not found' });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [slug, loadTemplate]);

  // Fire onLoad queries once queriesConfig has landed in the store, seed
  // dependency baselines, and subscribe for reactive re-runs.
  useEffect(() => {
    if (state.status !== 'ready' || !queriesConfig || queriesConfig.length === 0) return;
    resetReactiveState();
    executeOnLoadQueries(queriesConfig);
    watchDependencies(queriesConfig);
    const unsub = useEditorStore.subscribe(() => watchDependencies(queriesConfig));
    return unsub;
  }, [state.status, queriesConfig]);

  const brandStyle = useMemo<React.CSSProperties>(() => {
    if (state.status !== 'ready') return {};
    const primary = state.data.customer.brand_config?.primaryColor;
    return primary ? ({ ['--brand-primary' as any]: primary } as React.CSSProperties) : {};
  }, [state]);

  if (state.status === 'loading') {
    return (
      <div className="customer-view-centered">
        <div className="spinner" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="customer-view-centered">
        <div className="customer-view-error">
          <h2>Dashboard not found</h2>
          <p>{state.message}</p>
          <button className="btn-topbar" onClick={() => navigate('/templates')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const { customer } = state.data;
  const logo = customer.brand_config?.logoUrl as string | undefined;

  return (
    <div className="customer-view" style={brandStyle}>
      {logo && (
        <div className="customer-view-header">
          <img src={logo} alt={`${customer.name} logo`} className="customer-view-logo" />
        </div>
      )}
      <div className="customer-view-canvas builder-canvas-wrapper">
        <div className="builder-canvas">
          <GridLayer parentId="root" componentMap={ComponentMap} readOnly />
        </div>
      </div>
    </div>
  );
}
