import React, { useEffect, Suspense } from 'react';
import { executeOnLoadQueries, watchDependencies, resetReactiveState } from '../../engine/queryEngine';
import { useEditorStore } from '../../store/editorStore';
import { GridLayer } from './GridLayer';
import { resolveBackground } from '../../utils/styleUtils';
import { RenderRegistry } from '../../config/renderRegistry';

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
          <GridLayer parentId="root" componentMap={RenderRegistry} readOnly={readOnly} />
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
