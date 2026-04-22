import { useEditorStore } from '../../store/editorStore';
import type { ComponentConfig, ComponentType } from '../../types/template';
import StatCard from '../dashboard-components/StatCard';
import Table from '../dashboard-components/Table';
import BarChartComponent from '../dashboard-components/BarChart';
import LineChartComponent from '../dashboard-components/LineChart';
import StatusBadge from '../dashboard-components/StatusBadge';
import ComponentPicker from './ComponentPicker';
import { useState } from 'react';
import { useLabelWidth } from '../../hooks/useTextMeasure';

const ComponentMap: Record<ComponentType, React.ComponentType<{ config: ComponentConfig }>> = {
  StatCard,
  Table,
  BarChart: BarChartComponent,
  LineChart: LineChartComponent,
  StatusBadge,
};

// Floating label rendered with pretext-measured pill width
function FloatingLabel({ text }: { text: string }) {
  const pillWidth = useLabelWidth(text);

  return (
    <div
      className="canvas-component-label"
      style={{ width: pillWidth > 0 ? `${pillWidth}px` : undefined }}
    >
      {text}
    </div>
  );
}

export default function Canvas() {
  const components = useEditorStore((s) => s.components);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const removeComponent = useEditorStore((s) => s.removeComponent);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Group components by type for visual layout
  const statCards = components.filter((c) => c.type === 'StatCard');
  const statusBadges = components.filter((c) => c.type === 'StatusBadge');
  const charts = components.filter((c) => c.type === 'BarChart' || c.type === 'LineChart');
  const tables = components.filter((c) => c.type === 'Table');

  const groupOrder: { type: string; items: ComponentConfig[] }[] = [];
  const seen = new Set<string>();

  components.forEach((comp) => {
    if (seen.has(comp.id)) return;

    if (comp.type === 'StatCard') {
      if (!groupOrder.find((g) => g.type === 'stat')) {
        groupOrder.push({ type: 'stat', items: statCards });
        statCards.forEach((c) => seen.add(c.id));
      }
    } else if (comp.type === 'StatusBadge') {
      if (!groupOrder.find((g) => g.type === 'badge')) {
        groupOrder.push({ type: 'badge', items: statusBadges });
        statusBadges.forEach((c) => seen.add(c.id));
      }
    } else if (comp.type === 'BarChart' || comp.type === 'LineChart') {
      if (!groupOrder.find((g) => g.type === 'chart')) {
        groupOrder.push({ type: 'chart', items: charts });
        charts.forEach((c) => seen.add(c.id));
      }
    } else if (comp.type === 'Table') {
      if (!groupOrder.find((g) => g.type === 'table')) {
        groupOrder.push({ type: 'table', items: tables });
        tables.forEach((c) => seen.add(c.id));
      }
    }
  });

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-component-wrapper')) return;
    selectComponent(null);
    setConfirmRemoveId(null);
  };

  const handleRemoveClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmRemoveId(id);
  };

  const handleConfirmRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeComponent(id);
    setConfirmRemoveId(null);
  };

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmRemoveId(null);
  };

  const renderComponent = (comp: ComponentConfig) => {
    const Component = ComponentMap[comp.type];
    if (!Component) return null;

    return (
      <div
        key={comp.id}
        className={`canvas-component-wrapper ${selectedComponentId === comp.id ? 'selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          selectComponent(comp.id);
          if (confirmRemoveId !== comp.id) setConfirmRemoveId(null);
        }}
      >
        {/* Feature A: pretext-measured floating label */}
        <FloatingLabel text={comp.label} />

        <button
          className="remove-btn"
          onClick={(e) => handleRemoveClick(e, comp.id)}
          title="Remove component"
        >
          ×
        </button>
        {confirmRemoveId === comp.id && (
          <div className="remove-confirm">
            <span>Remove this component?</span>
            <div className="remove-confirm-buttons">
              <button className="confirm-yes" onClick={(e) => handleConfirmRemove(e, comp.id)}>
                Yes
              </button>
              <button className="confirm-no" onClick={handleCancelRemove}>
                No
              </button>
            </div>
          </div>
        )}
        <Component config={comp} />
      </div>
    );
  };

  return (
    <div className="builder-canvas-wrapper" onClick={handleCanvasClick}>
      <div className="builder-canvas">
        {groupOrder.map((group, gi) => {
          let rowClass = '';
          if (group.type === 'stat') rowClass = 'stat-row';
          else if (group.type === 'badge') rowClass = 'badge-row';
          else if (group.type === 'chart') rowClass = 'chart-row';
          else if (group.type === 'table') rowClass = 'table-row';

          return (
            <div key={gi} className={`canvas-grid-row ${rowClass}`}>
              {group.items.map(renderComponent)}
            </div>
          );
        })}

        {components.length === 0 && (
          <div className="canvas-empty">
            <div className="canvas-empty-icon">📊</div>
            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No components yet</p>
            <p style={{ fontSize: '12px' }}>Click the button below to add your first component</p>
          </div>
        )}

        <ComponentPicker />
      </div>
    </div>
  );
}
