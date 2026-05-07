/**
 * Preview renderer that uses actual dashboard components without store dependency.
 * This ensures visual parity with the final rendered dashboard.
 */

import { Suspense } from 'react';
import { RenderRegistry } from '../../config/renderRegistry';
import { resolveBackground } from '../../utils/styleUtils';
import type { ComponentType } from '../../types/template';

interface DashboardConfig {
  components: Array<Record<string, any>>;
  queries?: Array<Record<string, any>>;
  canvasStyle?: {
    backgroundColor?: string;
    backgroundGradient?: any;
  };
}

interface PreviewRendererProps {
  config: DashboardConfig;
  height?: string | number;
  width?: string | number;
  className?: string;
}

/**
 * Renders a dashboard preview using the exact rendering pipeline as the final dashboard.
 *
 * This component:
 * - Uses RenderRegistry (actual components, not simplified mocks)
 * - Applies actual theme/style system (gradients, colors, spacing)
 * - Renders in read-only mode (no editing or interaction)
 * - No custom "Mini" component skeletons — real visual output
 */
export default function PreviewRenderer({
  config,
  height = '100%',
  width = '100%',
  className = '',
}: PreviewRendererProps) {
  const canvasStyle = config.canvasStyle || { backgroundColor: '#f3f4f6' };

  return (
    <div
      className={`preview-renderer ${className}`}
      style={{
        width,
        height,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: resolveBackground(canvasStyle as any),
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
        }}
      >
        <Suspense fallback={<div style={{ padding: '20px', color: '#999' }}>Loading preview...</div>}>
          <PreviewGridLayer config={config} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Grid layer that renders components from config without relying on editor store.
 * Uses the same component registry as the main Canvas.
 */
function PreviewGridLayer({ config }: { config: DashboardConfig }) {
  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridAutoRows: 'auto',
        gap: '12px',
        padding: '12px',
      }}
    >
      {(config.components || [])
        .filter((c: any) => !c.parentId)
        .map((component: any) => {
          const Component = (RenderRegistry as Record<string, any>)[component.type];
          if (!Component) return null;

          const layout = component.layout || { x: 0, y: 0, w: 4, h: 4 };
          const gridColumn = `${layout.x + 1} / span ${layout.w}`;
          const gridRow = `${layout.y + 1} / span ${layout.h}`;

          return (
            <div
              key={component.id}
              style={{
                gridColumn,
                gridRow,
                minHeight: '40px',
              }}
            >
              <Component config={component} readOnly={true} />
            </div>
          );
        })}
    </div>
  );
}
