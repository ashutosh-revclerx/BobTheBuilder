import React, { useMemo } from 'react';
import { useAppState } from './StateManager';
import { resolveBindings } from './BindingResolver';

// Import components (these will be created next)
import Table from './components/Table';
import Button from './components/Button';
import Text from './components/Text';
// ... other components

const COMPONENT_MAP: Record<string, React.FC<any>> = {
  Table,
  Button,
  Text,
  // ... other components
};

interface RendererProps {
  config: {
    components: any[];
  };
}

const Renderer: React.FC<RendererProps> = ({ config }) => {
  const { getGlobalState } = useAppState();
  const state = getGlobalState();

  const renderedComponents = useMemo(() => {
    return config.components.map(comp => {
      const Component = COMPONENT_MAP[comp.type];
      if (!Component) return <div key={comp.id}>Unknown component: {comp.type}</div>;

      const resolvedConfig = {
        ...comp,
        data: resolveBindings(comp.data, state),
      };

      // Check visibility
      const isVisible = String(resolvedConfig.data.visible) !== 'false';
      if (!isVisible) return null;

      const layout = comp.layout || { x: 0, y: 0, w: 6, h: 4 };

      return (
        <div
          key={comp.id}
          style={{
            gridArea: `${layout.y + 1} / ${layout.x + 1} / span ${layout.h} / span ${layout.w}`,
            position: 'relative',
          }}
        >
          <Component config={resolvedConfig} />
        </div>
      );
    });
  }, [config.components, state]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridAutoRows: 'minmax(20px, auto)',
        gap: '16px',
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {renderedComponents}
    </div>
  );
};

export default Renderer;
