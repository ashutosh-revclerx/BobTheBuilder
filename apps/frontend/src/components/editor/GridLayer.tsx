import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useState, useMemo, useCallback } from 'react';
import { useLabelWidth } from '../../hooks/useTextMeasure';
import { resolveBindings } from '../../engine/bindingResolver';
import { useEditorStore } from '../../store/editorStore';

const DEFAULT_SIZES: Record<string, {w:number, h:number}> = {
  StatCard:        { w: 3, h: 6 },
  BarChart:        { w: 6, h: 12 },
  LineChart:       { w: 6, h: 12 },
  Table:           { w: 12, h: 16 },
  Button:          { w: 2, h: 4 },
  StatusBadge:     { w: 2, h: 4 },
  LogsViewer:      { w: 12, h: 8 },
  Container:       { w: 12, h: 12 },
  TabbedContainer: { w: 12, h: 16 },
  Text:            { w: 6, h: 4 },
  TextInput:       { w: 4, h: 4 },
  NumberInput:     { w: 4, h: 4 },
  Select:          { w: 4, h: 4 },
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
  customGap?: number;
}

export function GridLayer({ parentId, parentTab, componentMap, customGap }: GridLayerProps) {
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
      x: c.layout?.x ?? 0,
      y: c.layout?.y ?? 0,
      w: c.layout?.w ?? 4,
      h: c.layout?.h ?? 4,
    }));
  }, [filteredComponents]);

  // Calculate auto-expanding canvas height based on component positions
  const canvasMinHeight = useMemo(() => {
    if (parentId !== 'root') return '100%';
    if (filteredComponents.length === 0) return 'calc(100vh - 100px)';
    
    // Find the lowest point of any component (y + h) and add padding
    const lowestPoint = filteredComponents.reduce((max, c) => {
      const bottom = (c.layout?.y ?? 0) + (c.layout?.h ?? 4);
      return Math.max(max, bottom);
    }, 0);
    
    // Convert grid units to pixels: (rows * rowHeight) + (rows * margin) + extra padding
    const pixelHeight = (lowestPoint * 10) + (lowestPoint * 10) + 400;
    const viewportHeight = 'calc(100vh - 100px)';
    
    // Use whichever is larger
    return `max(${viewportHeight}, ${pixelHeight}px)`;
  }, [filteredComponents, parentId]);

  // Only sync to store on user interaction (drag/resize STOP), not on every render
  const syncLayoutToStore = useCallback((currentLayout: { i: string; x: number; y: number; w: number; h: number }[]) => {
    updateLayouts(currentLayout.map(l => ({
      id: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h
    })));
  }, [updateLayouts]);

  const handleDragStop = useCallback((_layout: any[], _oldItem: any, _newItem: any, _placeholder: any, _e: any, _node: any) => {
    syncLayoutToStore(_layout);
  }, [syncLayoutToStore]);

  const handleResizeStop = useCallback((_layout: any[], _oldItem: any, _newItem: any, _placeholder: any, _e: any, _node: any) => {
    syncLayoutToStore(_layout);
  }, [syncLayoutToStore]);

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
        compactType={null}
        preventCollision={true}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        margin={[customGap ?? 10, customGap ?? 10]}
        style={{ minHeight: canvasMinHeight }}
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
        if (!Component || comp.visible === false) return null;

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
            <div className="component-inner-content" style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
              {comp.loading && (
                <div className="component-loading-overlay">
                  <div className="spinner"></div>
                </div>
              )}
              <Component config={resolvedComp} componentMap={componentMap} />
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  </div>
  );
}
