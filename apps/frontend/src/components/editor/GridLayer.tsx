import { Responsive } from 'react-grid-layout/legacy';
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { resolveBindings } from '../../engine/bindingResolver';
import { evaluateBooleanExpression } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { useShallow } from 'zustand/react/shallow';

const DEFAULT_SIZES: Record<string, {w:number, h:number}> = {
  StatCard:        { w: 4, h: 6 },
  BarChart:        { w: 6, h: 12 },
  LineChart:       { w: 6, h: 12 },
  Table:           { w: 6, h: 12 },
  Button:          { w: 2, h: 4 },
  StatusBadge:     { w: 2, h: 4 },
  LogsViewer:      { w: 4, h: 12 },
  Container:       { w: 4, h: 12 },
  TabbedContainer: { w: 6, h: 12 },
  Text:            { w: 2, h: 2 },
  TextInput:       { w: 3, h: 6 },
  NumberInput:     { w: 3, h: 6 },
  Select:          { w: 3, h: 6 },
};

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
  readOnly?: boolean;
}

/**
 * Optimized wrapper for individual canvas components.
 * Uses useShallow to subscribe only to its specific component config.
 * This prevents re-renders of sibling components when one changes.
 */
const CanvasComponentWrapper = React.memo(({
  id,
  componentMap,
  readOnly,
  confirmRemoveId,
  setConfirmRemoveId,
  handleRemoveClick,
  handleConfirmRemove,
  handleCancelRemove,
}: {
  id: string;
  componentMap: Record<string, React.ComponentType<any>>;
  readOnly: boolean;
  confirmRemoveId: string | null;
  setConfirmRemoveId: (id: string | null) => void;
  handleRemoveClick: (e: React.MouseEvent, id: string) => void;
  handleConfirmRemove: (e: React.MouseEvent, id: string) => void;
  handleCancelRemove: (e: React.MouseEvent) => void;
}) => {
  // Subscribe to this component's config only — stable reference via useShallow
  const comp = useEditorStore(useShallow((s) => s.components.find(c => c.id === id)));
  const selectedComponentId = useEditorStore((s) => s.selectedComponentId);
  const selectComponent = useEditorStore((s) => s.selectComponent);
  // Subscribing to queryResults/componentState ensures resolveBindings
  // re-runs when data arrives, without GridLayer re-rendering all children.
  useEditorStore((s) => s.queryResults);
  useEditorStore((s) => s.componentState);

  if (!comp) return null;

  const Component = componentMap[comp.type];
  const visibleExpression = comp.visible ?? comp.data.visible ?? 'true';
  if (!Component || !evaluateBooleanExpression(visibleExpression, true)) return null;

  const resolvedData = resolveBindings(comp.data);
  const resolvedComp = { ...comp, data: resolvedData, visible: visibleExpression };

  return (
    <div
      className={`canvas-component-wrapper${readOnly ? ' read-only' : ''} ${selectedComponentId === comp.id && !readOnly ? 'selected' : ''}`}
      onClick={readOnly ? undefined : (e) => {
        e.stopPropagation();
        selectComponent(comp.id);
        if (confirmRemoveId !== comp.id) setConfirmRemoveId(null);
      }}
    >
      {!readOnly && <FloatingLabel text={comp.label} />}
      {!readOnly && (
        <button className="remove-btn" onClick={(e) => handleRemoveClick(e, comp.id)} title="Remove component">×</button>
      )}
      {!readOnly && confirmRemoveId === comp.id && (
        <div className="remove-confirm">
          <span>Remove?</span>
          <div className="remove-confirm-buttons">
            <button className="confirm-yes" onClick={(e) => handleConfirmRemove(e, comp.id)}>Yes</button>
            <button className="confirm-no" onClick={handleCancelRemove}>No</button>
          </div>
        </div>
      )}
      <div className="component-inner-content" style={{ height: '100%', overflow: 'visible', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {comp.loading && (
          <div className="component-loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        <Component config={resolvedComp} componentMap={componentMap} readOnly={readOnly} />
      </div>
    </div>
  );
});

export function GridLayer({ parentId, parentTab, componentMap, customGap, readOnly = false }: GridLayerProps) {
  // Subscribe to the raw components array — this is a stable reference from Zustand
  // and avoids the "getSnapshot should be cached" infinite loop caused by inline
  // .filter().map() chains inside useShallow selectors.
  const components = useEditorStore((s) => s.components);
  const updateLayouts = useEditorStore((s) => s.updateLayouts);
  const addComponent = useEditorStore((s) => s.addComponent);
  const removeComponent = useEditorStore((s) => s.removeComponent);
  const draggingType = useEditorStore((s) => s.draggingType);
  const setDraggingType = useEditorStore((s) => s.setDraggingType);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  // Derive filtered list and layout in useMemo — stable between renders when
  // components/parentId/parentTab haven't changed.
  const filteredComponents = useMemo(() =>
    components.filter(c => {
      if (parentId === 'root') return !c.parentId;
      return c.parentId === parentId && (!parentTab || c.parentTab === parentTab);
    }),
    [components, parentId, parentTab]
  );

  const filteredComponentIds = useMemo(
    () => filteredComponents.map(c => c.id),
    [filteredComponents]
  );

  const layout = useMemo(() =>
    filteredComponents.map(c => ({
      i: c.id,
      x: c.layout?.x ?? 0,
      y: c.layout?.y ?? 0,
      w: c.layout?.w ?? 4,
      h: c.layout?.h ?? 4,
      minW: c.layout?.minW,
      minH: c.layout?.minH,
      isResizable: !readOnly,
      isDraggable: !readOnly,
      static: readOnly,
    })),
    [filteredComponents, readOnly]
  );

  const canvasMinHeight = useMemo(() => {
    if (parentId !== 'root') return '100%';
    if (filteredComponents.length === 0) return 'calc(100vh - 100px)';
    const lowestPoint = filteredComponents.reduce((max, c) => {
      const bottom = (c.layout?.y ?? 0) + (c.layout?.h ?? 4);
      return Math.max(max, bottom);
    }, 0);
    const rowHeight = 30;
    const marginSize = customGap ?? 10;
    const pixelHeight = (lowestPoint * rowHeight) + (lowestPoint * marginSize) + 400;
    return `max(calc(100vh - 100px), ${pixelHeight}px)`;
  }, [filteredComponents, parentId, customGap]);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && draggingType) {
        setDraggingType(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draggingType, setDraggingType]);

  const syncLayoutToStore = useCallback((currentLayout: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
    updateLayouts(currentLayout.map(l => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
  }, [updateLayouts]);

  const handleDragStop = useCallback((_layout: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
    syncLayoutToStore(_layout);
  }, [syncLayoutToStore]);

  const handleResizeStop = useCallback((_layout: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) => {
    syncLayoutToStore(_layout);
  }, [syncLayoutToStore]);

  const handleRemoveClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmRemoveId(id);
  }, []);

  const handleConfirmRemove = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeComponent(id);
    setConfirmRemoveId(null);
  }, [removeComponent]);

  const handleCancelRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmRemoveId(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const size = draggingType ? DEFAULT_SIZES[draggingType] ?? { w: 4, h: 4 } : { w: 4, h: 4 };

  return (
    <div
      ref={wrapperRef}
      className={`grid-layer-wrapper ${draggingType ? 'drop-active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Responsive
        className="layout"
        width={containerWidth}
        layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={30}
        isDraggable={!readOnly}
        isResizable={!readOnly}
        resizeHandles={['se', 'sw', 'ne', 'nw']}
        droppingItem={{ i: '__dropping-elem__', x: 0, y: 0, w: size.w, h: size.h }}
        draggableCancel="input, button, select, textarea, .tabbed-header-btn, .inline-picker, .container-empty-dropzone, .recharts-wrapper, .container-inner-layout, .tabbed-content"
        compactType={null}
        preventCollision={true}
        onDragStop={readOnly ? undefined : handleDragStop}
        onResizeStop={readOnly ? undefined : handleResizeStop}
        margin={[customGap ?? 10, customGap ?? 10]}
        style={{ minHeight: canvasMinHeight }}
        isDroppable={!readOnly && !!draggingType}
        onDrop={(_layout, item, e) => {
          e.preventDefault();
          if (!item) return;
          const type = (e as any).dataTransfer?.getData('componentType');
          if (!type || !type.length) return;

          const existingItems = (_layout as any[]).filter((l) => l.i !== '__dropping__');
          if (existingItems.length > 0) {
            syncLayoutToStore(existingItems);
          }

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
        {filteredComponentIds.map(id => (
          <div key={id} onContextMenu={(e) => handleContextMenu(e, id)}>
            <CanvasComponentWrapper
              id={id}
              componentMap={componentMap}
              readOnly={readOnly}
              confirmRemoveId={confirmRemoveId}
              setConfirmRemoveId={setConfirmRemoveId}
              handleRemoveClick={handleRemoveClick}
              handleConfirmRemove={handleConfirmRemove}
              handleCancelRemove={handleCancelRemove}
            />
          </div>
        ))}
      </Responsive>

      {contextMenu && (
        <div 
          className="canvas-context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button className="menu-item" onClick={() => { useEditorStore.getState().duplicateComponent(contextMenu.id); setContextMenu(null); }}>
            <span className="menu-icon">⧉</span> Duplicate
          </button>
          <div className="menu-divider" />
          <button className="menu-item danger" onClick={() => { removeComponent(contextMenu.id); setContextMenu(null); }}>
            <span className="menu-icon">🗑</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}
