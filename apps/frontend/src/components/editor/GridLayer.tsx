import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useState, useMemo } from 'react';
import { useLabelWidth } from '../../hooks/useTextMeasure';
import { resolveBindings } from '../../engine/bindingResolver';
import { useEditorStore } from '../../store/editorStore';

const DEFAULT_SIZES: Record<string, {w:number, h:number}> = {
  StatCard:        { w: 3, h: 3 },
  BarChart:        { w: 6, h: 6 },
  LineChart:       { w: 6, h: 6 },
  Table:           { w: 8, h: 6 },
  Button:          { w: 2, h: 2 },
  StatusBadge:     { w: 2, h: 2 },
  LogsViewer:      { w: 6, h: 5 },
  Container:       { w: 6, h: 8 },
  TabbedContainer: { w: 8, h: 10 },
};

const ResponsiveGridLayout = WidthProvider(Responsive);

function FloatingLabel({ text }: { text: string }) {
  return (
    <span className="canvas-component-label">
      {text}
    </span>
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
  const addComponent = useEditorStore((s) => s.addComponent);
  const draggingType = useEditorStore((s) => s.draggingType);
  const setDraggingType = useEditorStore((s) => s.setDraggingType);
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

  const onLayoutChange = (currentLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    updateLayouts(Array.from(currentLayout).map(l => ({
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

  const size = draggingType ? DEFAULT_SIZES[draggingType] ?? {w:4,h:4} : {w:4,h:4};

  return (
    <div 
      className={`grid-layer-wrapper ${draggingType ? 'drop-active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30}
        resizeHandles={['se', 'sw', 'ne', 'nw']}
        draggableCancel="input, button, select, textarea, .tabbed-header-btn, .inline-picker, .container-empty-dropzone, .recharts-wrapper"
        onLayoutChange={onLayoutChange}
        margin={[10, 10]}
        style={{ minHeight: parentId === 'root' ? 'calc(100vh - 100px)' : '100px' }}
        isDroppable={!!draggingType}
        droppingItem={{ i: '__dropping__', x: 0, y: 0, ...size }}
        onDrop={(_layout, item, e) => {
          e.preventDefault();
          if (!item) return;
          const type = (e as DragEvent & { dataTransfer: DataTransfer }).dataTransfer.getData('componentType');
          if (!type || !type.length) return;

          addComponent(type as any, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            parentId: parentId === 'root' ? undefined : parentId,
            parentTab: parentTab ?? undefined,
          });
          setDraggingType(null);
        }}
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
            <Component config={resolvedComp} componentMap={componentMap} />
          </div>
        );
      })}
    </ResponsiveGridLayout>
  </div>
  );
}
