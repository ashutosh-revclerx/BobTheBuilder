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
  readOnly?: boolean;
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

interface GraphPayload {
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
}

// Probes API response for common node/edge shapes. Handles nested wrappers
// and alternative key names (vertices, links, connections, relationships, etc.)
function extractGraphData(payload: unknown): GraphPayload | null {
  if (payload == null || typeof payload !== 'object') return null;

  const GRAPH_NODE_KEYS = ['nodes', 'vertices', 'items'] as const;
  const GRAPH_EDGE_KEYS = ['edges', 'links', 'relationships', 'connections'] as const;

  const tryRead = (obj: Record<string, unknown>): GraphPayload | null => {
    for (const nk of GRAPH_NODE_KEYS) {
      for (const ek of GRAPH_EDGE_KEYS) {
        const nodes = obj[nk];
        const edges = obj[ek];
        if (Array.isArray(nodes) && Array.isArray(edges)) {
          return { rawNodes: nodes as RawNode[], rawEdges: edges as RawEdge[] };
        }
      }
    }
    return null;
  };

  const obj = payload as Record<string, unknown>;

  // Direct shape: { nodes: [...], edges: [...] }
  const direct = tryRead(obj);
  if (direct) return direct;

  // Wrapped shapes: { data: { nodes, edges } }, { result: { nodes, edges } }, etc.
  for (const wrapper of ['data', 'result', 'response', 'output']) {
    const inner = obj[wrapper];
    if (inner && typeof inner === 'object') {
      const nested = tryRead(inner as Record<string, unknown>);
      if (nested) return nested;
    }
  }

  // Flat relationship list: { relationships: [{ source, target, label }] }
  const rels = obj['relationships'];
  if (Array.isArray(rels) && rels.length > 0 && rels[0]?.source) {
    // Synthesize nodes from unique sources/targets
    const nodeIds = new Set<string>();
    (rels as RawEdge[]).forEach((r) => {
      nodeIds.add(r.source);
      nodeIds.add(r.target);
    });
    return {
      rawNodes: Array.from(nodeIds).map((id) => ({ id, label: id })),
      rawEdges: rels as RawEdge[],
    };
  }

  return null;
}

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

export default function NodeGraph({ config, readOnly }: NodeGraphProps) {
  const { style, data } = config;
  const queryResults = useEditorStore((s) => s.queryResults);
  const componentState = useEditorStore((s) => s.componentState);

  // Read raw (unresolved) binding from store. By the time `data.dbBinding` arrives
  // here, {{...}} has been resolved to the actual value — losing the query name.
  // Reading the unresolved binding directly lets NodeGraph find the query
  // regardless of whether the template author wrote `queries.X.trigger`
  // (literal) or `{{queries.X.data}}` (resolved style).
  const rawBinding = useEditorStore(
    (s) => (s.components.find((c) => c.id === config.id)?.data as any)?.dbBinding,
  );

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  type GraphStatus = 'readOnly' | 'noSession' | 'loading' | 'loaded' | 'error';

  const { rawNodes, rawEdges, graphStatus } = useMemo<{
    rawNodes: RawNode[];
    rawEdges: RawEdge[];
    graphStatus: GraphStatus;
  }>(() => {
    // 1. ReadOnly mode (TemplatePicker preview) — use mockValue immediately
    if (readOnly) {
      const graph = extractGraphData(data.mockValue);
      if (graph) return { ...graph, graphStatus: 'readOnly' };
      return { rawNodes: FALLBACK_NODES, rawEdges: FALLBACK_EDGES, graphStatus: 'readOnly' };
    }

    // 2. Check if a session exists (upload-zone sessionId in componentState)
    const hasSession = Object.values(componentState).some(
      (cs) => cs && typeof cs === 'object' && 'sessionId' in cs && cs.sessionId,
    );

    // 3. Try live query result
    const queryName = parseQueryName(rawBinding) || parseQueryName(data.dbBinding);
    if (queryName) {
      const result = queryResults[queryName];

      if (result?.status === 'loading' || result?.status === 'idle') {
        return { rawNodes: [], rawEdges: [], graphStatus: hasSession ? 'loading' : 'noSession' };
      }

      if (result?.status === 'error') {
        return { rawNodes: [], rawEdges: [], graphStatus: 'error' };
      }

      if (result?.status === 'success') {
        const graph = extractGraphData(result.data);
        if (graph && graph.rawNodes.length > 0) {
          return { ...graph, graphStatus: 'loaded' };
        }
      }

      // queryName resolved but no result yet
      if (!result) {
        return { rawNodes: [], rawEdges: [], graphStatus: hasSession ? 'loading' : 'noSession' };
      }
    }

    // 4. Explicit nodes/edges on the config
    const explicitNodes = (data as any).nodes;
    const explicitEdges = (data as any).edges;
    if (Array.isArray(explicitNodes) && Array.isArray(explicitEdges)) {
      return { rawNodes: explicitNodes, rawEdges: explicitEdges, graphStatus: 'loaded' };
    }

    // 5. mockValue
    const mock = data.mockValue as any;
    if (mock) {
      const graph = extractGraphData(mock);
      if (graph) return { ...graph, graphStatus: hasSession ? 'loading' : 'noSession' };
    }

    // 6. No session → show placeholder; session but no data → fallback
    if (!hasSession) {
      return { rawNodes: [], rawEdges: [], graphStatus: 'noSession' };
    }

    return { rawNodes: FALLBACK_NODES, rawEdges: FALLBACK_EDGES, graphStatus: 'loading' };
  }, [readOnly, rawBinding, data, queryResults, componentState]);

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

  // No session state — show placeholder
  if (graphStatus === 'noSession') {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⬆</div>
        <div style={{ fontSize: 13, color: style.textColor || '#e2e8f0', opacity: 0.6, textAlign: 'center' }}>
          Upload files first to build the relationship graph
        </div>
      </div>
    );
  }

  // Loading state
  if (graphStatus === 'loading') {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: style.borderColor || '#22d3ee', opacity: 0.8 }}>
          Building relationship graph…
        </div>
      </div>
    );
  }

  // Error state
  if (graphStatus === 'error') {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#f87171', textAlign: 'center', padding: 16 }}>
          Failed to load relationships. Retry by clicking "Detect Relationships".
        </div>
      </div>
    );
  }

  // Loaded state — show ReactFlow graph
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
