import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useState, useMemo } from 'react';
import { useLabelWidth } from '../../hooks/useTextMeasure';
import { resolveBindings } from '../../engine/bindingResolver';
import { useEditorStore } from '../../store/editorStore';

const ResponsiveGridLayout = WidthProvider(Responsive);

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

interface GridLayerProps {
  parentId: string | 'root';
  parentTab?: string;
  componentMap: Record<string, React.ComponentType<any>>;
}

export function GridLayer({ parentId, parentTab, componentMap }: GridLayerProps) {
  const components = useEditorStore((s) => s.components);
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  const removeComponent = useEditorStore((s) => s.removeComponent);
  const updateLayouts = useEditorStore((s) => s.updateLayouts);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      if (parentId === 'root') return !c.parentId;
      return c.parentId === parentId && (!parentTab || c.parentTab === parentTab);
    });
  }, [components, parentId, parentTab]);

  const layout = useMemo(() => {
    return filteredComponents.map(c => ({
      i: c.id,
      x: c.layout?.x || 0,
      y: c.layout?.y || 0,
      w: c.layout?.w || 4,
      h: c.layout?.h || 4,
    }));
  }, [filteredComponents]);

  const onLayoutChange = (currentLayout: any[]) => {
    updateLayouts(currentLayout.map(l => ({
      id: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h
    })));
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

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={30}
      draggableHandle=".canvas-component-label"
      onLayoutChange={onLayoutChange}
      margin={[10, 10]}
      style={{ minHeight: parentId === 'root' ? 'calc(100vh - 100px)' : '100px' }}
    >
      {filteredComponents.map(comp => {
        const Component = componentMap[comp.type];
        if (!Component) return null;

        const resolvedData = resolveBindings(comp.data);
        const resolvedComp = { ...comp, data: resolvedData };

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
            <FloatingLabel text={comp.label} />
            <button className="remove-btn" onClick={(e) => handleRemoveClick(e, comp.id)} title="Remove component">×</button>
            {confirmRemoveId === comp.id && (
              <div className="remove-confirm">
                <span>Remove?</span>
                <div className="remove-confirm-buttons">
                  <button className="confirm-yes" onClick={(e) => handleConfirmRemove(e, comp.id)}>Yes</button>
                  <button className="confirm-no" onClick={handleCancelRemove}>No</button>
                </div>
              </div>
            )}
            <div className="component-inner-content" style={{ height: '100%', overflow: 'hidden' }}>
              <Component config={resolvedComp} componentMap={componentMap} />
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
