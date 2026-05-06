import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ComponentConfig } from '../../types/template';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

interface NodeGraphProps {
  config: ComponentConfig;
}

interface RawNode {
  id: string;
  label?: string;
  type?: string;
  [k: string]: unknown;
}

interface RawEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  [k: string]: unknown;
}

const FALLBACK_NODES: RawNode[] = [
  { id: 'sheet-1', label: 'customers.xlsx', type: 'sheet' },
  { id: 'sheet-2', label: 'orders.xlsx', type: 'sheet' },
  { id: 'sheet-3', label: 'products.xlsx', type: 'sheet' },
  { id: 'sheet-4', label: 'invoices.xlsx', type: 'sheet' },
];

const FALLBACK_EDGES: RawEdge[] = [
  { source: 'sheet-1', target: 'sheet-2', label: 'customer_id' },
  { source: 'sheet-2', target: 'sheet-3', label: 'product_id' },
  { source: 'sheet-2', target: 'sheet-4', label: 'order_id' },
];

function autoLayout(nodes: RawNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const radius = Math.max(120, nodes.length * 30);
  const cx = 0;
  const cy = 0;
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    positions.set(node.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });
  return positions;
}

export default function NodeGraph({ config }: NodeGraphProps) {
  const { style, data } = config;
  const queryResults = useEditorStore((s) => s.queryResults);

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  const { rawNodes, rawEdges } = useMemo<{
    rawNodes: RawNode[];
    rawEdges: RawEdge[];
  }>(() => {
    // First try a single dbBinding that returns { nodes: [...], edges: [...] }
    const queryName = parseQueryName(data.dbBinding);
    if (queryName) {
      const result = queryResults[queryName];
      const payload = result?.data as any;
      if (payload && Array.isArray(payload.nodes) && Array.isArray(payload.edges)) {
        return { rawNodes: payload.nodes, rawEdges: payload.edges };
      }
    }

    // Fallback: explicit `nodes` / `edges` on data, or mockValue
    const explicitNodes = (data as any).nodes;
    const explicitEdges = (data as any).edges;
    if (Array.isArray(explicitNodes) && Array.isArray(explicitEdges)) {
      return { rawNodes: explicitNodes, rawEdges: explicitEdges };
    }

    const mock = data.mockValue as any;
    if (mock && Array.isArray(mock.nodes) && Array.isArray(mock.edges)) {
      return { rawNodes: mock.nodes, rawEdges: mock.edges };
    }

    return { rawNodes: FALLBACK_NODES, rawEdges: FALLBACK_EDGES };
  }, [data.dbBinding, data.mockValue, (data as any).nodes, (data as any).edges, queryResults]);

  const nodes = useMemo<Node[]>(() => {
    const positions = autoLayout(rawNodes);
    return rawNodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      return {
        id: n.id,
        position: pos,
        data: { label: n.label ?? n.id },
        style: {
          background: style.backgroundColor === 'transparent' ? '#1e293b' : (n.type === 'column' ? '#6366f1' : '#0ea5e9'),
          color: '#ffffff',
          border: `2px solid ${style.borderColor || '#22d3ee'}`,
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 600,
          minWidth: 120,
          textAlign: 'center' as const,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        },
      };
    });
  }, [rawNodes, style.backgroundColor, style.borderColor]);

  const edges = useMemo<Edge[]>(
    () =>
      rawEdges.map((e, i) => ({
        id: e.id ?? `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: style.borderColor || '#22d3ee', strokeWidth: 2 },
        labelStyle: { fill: style.textColor || '#e2e8f0', fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: '#0d1424', fillOpacity: 0.9 },
      })),
    [rawEdges, style.borderColor, style.textColor],
  );

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: bg,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    border: style.borderWidth
      ? `${style.borderWidth}px solid ${style.borderColor || '#1e293b'}`
      : undefined,
    overflow: 'hidden',
  };

  return (
    <div className="nodegraph-component" style={wrapperStyle}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background color={style.borderColor || '#1e293b'} gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: '#0d1424', borderRadius: 8 }}
        />
        <MiniMap
          nodeStrokeColor={() => style.borderColor || '#22d3ee'}
          nodeColor={() => '#0ea5e9'}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#0d1424', borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}
