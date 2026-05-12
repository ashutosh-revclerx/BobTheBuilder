import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ComponentConfig } from '../../types/template';
import { parseQueryName } from '../../engine/runtimeUtils';
import { useEditorStore } from '../../store/editorStore';
import { resolveBackground } from '../../utils/styleUtils';

// Custom node component that renders handles for multiple edges
function MultiHandleNode({ data }: any) {
  const handleCount = data.handleCount || 1;
  const handles = Array.from({ length: handleCount }, (_, i) => i);

  return (
    <div
      style={{
        background: data.nodeType === 'column' ? '#6366f1' : '#0ea5e9',
        color: '#ffffff',
        border: `2px solid ${data.borderColor || '#22d3ee'}`,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 130,
        maxWidth: 180,
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        position: 'relative',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        whiteSpace: 'normal',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {handles.map((i) => (
        <Handle
          key={`handle-${i}`}
          type="target"
          position={handleCount === 1 ? Position.Left : i % 2 === 0 ? Position.Left : Position.Right}
          id={`handle-${i}`}
          style={{
            top: `${((i + 1) / (handleCount + 1)) * 100}%`,
          }}
        />
      ))}
      {handles.map((i) => (
        <Handle
          key={`handle-out-${i}`}
          type="source"
          position={handleCount === 1 ? Position.Right : i % 2 === 0 ? Position.Right : Position.Left}
          id={`handle-out-${i}`}
          style={{
            top: `${((i + 1) / (handleCount + 1)) * 100}%`,
          }}
        />
      ))}
      {data.label}
    </div>
  );
}

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
  strength?: string;
  confidence?: number;
  score?: number;
  [k: string]: unknown;
}

interface GraphPayload {
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
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

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return '';
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const numeric = Number(record[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function relationshipToEdge(item: unknown, index: number): RawEdge | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const source = readString(record, ['source', 'from', 'source_table', 'sourceTable', 'left_table', 'leftTable', 'table_a', 'tableA']);
  const target = readString(record, ['target', 'to', 'target_table', 'targetTable', 'right_table', 'rightTable', 'table_b', 'tableB']);
  if (!source || !target) return null;

  const sourceColumn = readString(record, ['source_column', 'sourceColumn', 'left_column', 'leftColumn', 'column_a', 'columnA']);
  const targetColumn = readString(record, ['target_column', 'targetColumn', 'right_column', 'rightColumn', 'column_b', 'columnB']);
  const strength = readString(record, ['strength', 'confidence_label', 'confidenceLabel']);
  const score = readNumber(record, ['score', 'confidence', 'similarity']);
  const label = readString(record, ['label', 'relationship', 'type', 'strength'])
    || [sourceColumn, targetColumn].filter(Boolean).join(' -> ')
    || undefined;

  return {
    id: readString(record, ['id', 'relationship_id', 'relationshipId']) || `relationship-${index}`,
    source,
    target,
    label,
    strength,
    score,
    ...record,
  };
}

function graphFromRelationshipArray(rels: unknown[]): GraphPayload | null {
  const rawEdges = rels
    .map((relationship, index) => relationshipToEdge(relationship, index))
    .filter((edge): edge is RawEdge => edge != null);
  if (rawEdges.length === 0) return null;

  const nodeIds = new Set<string>();
  rawEdges.forEach((edge) => {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  });

  // Heuristic: if a target ID has no file extension and looks like a column name
  // (snake_case/camelCase, no spaces), mark it as a column node so the bridge
  // normalizer can convert it to an edge label later.
  const hasFileExt = (id: string) => /\.(xlsx|xls|csv|pdf|docx|txt|json)$/i.test(id);
  const looksLikeColumn = (id: string) => !hasFileExt(id) && /^[a-z_][a-z0-9_]*$/i.test(id);
  const sourceIds = new Set(rawEdges.map(e => e.source));

  return {
    rawNodes: Array.from(nodeIds).map((id) => ({
      id,
      label: id,
      type: !sourceIds.has(id) && looksLikeColumn(id) ? 'column' : 'table',
    })),
    rawEdges,
  };
}

// Convert column-bridge nodes (table A → column ← table B) to direct
// table-to-table edges with the column name as a label.
// Column nodes with only one connected table (orphans) are dropped since
// no meaningful cross-table edge can be inferred.
function normalizeColumnNodes(graph: GraphPayload): GraphPayload {
  const columnNodeIds = new Set(
    graph.rawNodes
      .filter(n => String(n.type ?? '').toLowerCase() === 'column')
      .map(n => n.id),
  );
  if (columnNodeIds.size === 0) return graph;

  // Collect all tables connected to each column node (from either direction)
  const colToTables = new Map<string, string[]>();
  graph.rawEdges.forEach(edge => {
    if (columnNodeIds.has(edge.target) && !columnNodeIds.has(edge.source)) {
      const list = colToTables.get(edge.target) ?? [];
      list.push(edge.source);
      colToTables.set(edge.target, list);
    }
    if (columnNodeIds.has(edge.source) && !columnNodeIds.has(edge.target)) {
      const list = colToTables.get(edge.source) ?? [];
      list.push(edge.target);
      colToTables.set(edge.source, list);
    }
  });

  // For column nodes shared by 2+ tables, build direct table-to-table edges
  const pairLabels = new Map<string, string[]>();
  colToTables.forEach((tables, colId) => {
    const unique = [...new Set(tables)];
    if (unique.length < 2) return;
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = `${unique[i]}|${unique[j]}`;
        const existing = pairLabels.get(key) ?? [];
        existing.push(colId);
        pairLabels.set(key, existing);
      }
    }
  });

  const bridgeEdges: RawEdge[] = [];
  pairLabels.forEach((labels, key) => {
    const [src, tgt] = key.split('|');
    bridgeEdges.push({ id: `bridge-${src}-${tgt}`, source: src, target: tgt, label: labels.join(', ') });
  });

  const tableNodes = graph.rawNodes.filter(n => !columnNodeIds.has(n.id));
  const tableEdges = graph.rawEdges.filter(e => !columnNodeIds.has(e.source) && !columnNodeIds.has(e.target));

  return {
    rawNodes: tableNodes,
    rawEdges: [...tableEdges, ...bridgeEdges],
  };
}

function extractGraphData(payload: unknown): GraphPayload | null {
  const normalize = (g: GraphPayload | null) => (g ? normalizeColumnNodes(g) : null);

  if (Array.isArray(payload)) return normalize(graphFromRelationshipArray(payload));
  if (payload == null || typeof payload !== 'object') return null;

  const GRAPH_NODE_KEYS = ['nodes', 'vertices', 'items'] as const;
  const GRAPH_EDGE_KEYS = ['edges', 'links', 'relationships', 'connections'] as const;
  const obj = payload as Record<string, unknown>;

  const tryRead = (candidate: Record<string, unknown>): GraphPayload | null => {
    for (const nodeKey of GRAPH_NODE_KEYS) {
      for (const edgeKey of GRAPH_EDGE_KEYS) {
        const nodes = candidate[nodeKey];
        const edges = candidate[edgeKey];
        if (Array.isArray(nodes) && Array.isArray(edges)) {
          return normalizeColumnNodes({ rawNodes: nodes as RawNode[], rawEdges: edges as RawEdge[] });
        }
      }
    }
    return null;
  };

  const direct = tryRead(obj);
  if (direct) return direct;

  if (Array.isArray(obj.relationships)) return normalize(graphFromRelationshipArray(obj.relationships));

  for (const wrapper of ['data', 'result', 'response', 'output']) {
    const inner = obj[wrapper];
    if (Array.isArray(inner)) return normalize(graphFromRelationshipArray(inner));
    if (inner && typeof inner === 'object') {
      const nested = extractGraphData(inner);
      if (nested) return nested;
    }
  }

  return null;
}

function extractUploadedTables(componentState: Record<string, Record<string, unknown>>): RawNode[] {
  const tables = Object.values(componentState)
    .map((state) => state?.tables)
    .find(Array.isArray) as Array<Record<string, unknown>> | undefined;

  if (!tables) return [];
  return tables.map((table, index) => {
    const id = readString(table, ['table_id', 'id', 'table_name', 'name']) || `table-${index + 1}`;
    const label = readString(table, ['table_name', 'name', 'source_file']) || id;
    return { id, label, type: 'table', ...table };
  });
}

function autoLayout(nodes: RawNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const radius = Math.max(140, nodes.length * 42);
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    positions.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });
  return positions;
}

function edgeColor(edge: RawEdge, fallback: string): string {
  const strength = String(edge.strength ?? edge.confidence ?? '').toLowerCase();
  const score = Number(edge.score ?? edge.confidence);
  if (strength.includes('strong') || score >= 0.75) return '#22c55e';
  if (strength.includes('medium') || score >= 0.45) return '#f59e0b';
  if (strength.includes('weak') || score > 0) return '#94a3b8';
  return fallback;
}

function emptyGraphMessage(nodeCount: number): string {
  if (nodeCount > 1) {
    return 'No relationships found yet. Uploaded tables are shown as separate draggable nodes.';
  }
  return 'No relationships found. Upload at least two related tables, then run detection.';
}

export default function NodeGraph({ config, readOnly }: NodeGraphProps) {
  const { style, data } = config;
  const queryResults = useEditorStore((s) => s.queryResults);
  const componentState = useEditorStore((s) => s.componentState);
  const setComponentState = useEditorStore((s) => s.setComponentState);
  const rawBinding = useEditorStore(
    (s) => (s.components.find((component) => component.id === config.id)?.data as any)?.dbBinding,
  );

  const bg = useMemo(
    () => resolveBackground(style),
    [style.backgroundColor, style.backgroundGradient],
  );

  type GraphStatus = 'readOnly' | 'noSession' | 'loading' | 'loaded' | 'empty' | 'error';

  const { rawNodes, rawEdges, graphStatus } = useMemo<{
    rawNodes: RawNode[];
    rawEdges: RawEdge[];
    graphStatus: GraphStatus;
  }>(() => {
    const queryName = parseQueryName(rawBinding) || parseQueryName(data.dbBinding);

    if (readOnly) {
      // Prefer real query results over mockValue even in read-only/preview mode
      if (queryName) {
        const result = queryResults[queryName];
        if (result?.status === 'success') {
          const graph = extractGraphData(result.data);
          if (graph && graph.rawNodes.length > 0) {
            return { ...graph, graphStatus: 'loaded' };
          }
        }
      }
      const graph = extractGraphData(data.mockValue);
      if (graph) return { ...graph, graphStatus: 'readOnly' };
      return { rawNodes: FALLBACK_NODES, rawEdges: FALLBACK_EDGES, graphStatus: 'readOnly' };
    }

    const hasSession = Object.values(componentState).some(
      (state) => state && typeof state === 'object' && 'sessionId' in state && state.sessionId,
    );
    const uploadedTableNodes = extractUploadedTables(componentState);

    if (queryName) {
      const result = queryResults[queryName];

      if (result?.status === 'loading' || result?.status === 'idle') {
        return { rawNodes: uploadedTableNodes, rawEdges: [], graphStatus: uploadedTableNodes.length ? 'empty' : (hasSession ? 'loading' : 'noSession') };
      }

      if (result?.status === 'error') {
        return { rawNodes: uploadedTableNodes, rawEdges: [], graphStatus: 'error' };
      }

      if (result?.status === 'success') {
        const graph = extractGraphData(result.data);
        if (graph && graph.rawNodes.length > 0) {
          return { ...graph, graphStatus: 'loaded' };
        }
        if (uploadedTableNodes.length > 0) {
          return { rawNodes: uploadedTableNodes, rawEdges: [], graphStatus: 'empty' };
        }
        return { rawNodes: [], rawEdges: [], graphStatus: 'empty' };
      }

      if (!result) {
        // In builder mode with bound query not yet fired: try mockValue first
        const graph = extractGraphData(data.mockValue);
        if (graph && graph.rawNodes.length > 0) {
          return { ...graph, graphStatus: 'loaded' };
        }
        return { rawNodes: uploadedTableNodes, rawEdges: [], graphStatus: uploadedTableNodes.length ? 'empty' : (hasSession ? 'loading' : 'noSession') };
      }
    }

    const explicitNodes = (data as any).nodes;
    const explicitEdges = (data as any).edges;
    if (Array.isArray(explicitNodes) && Array.isArray(explicitEdges)) {
      return { rawNodes: explicitNodes, rawEdges: explicitEdges, graphStatus: 'loaded' };
    }

    if (!hasSession) {
      const graph = extractGraphData(data.mockValue);
      // If mockValue has valid graph data, show it in the builder (not the "upload files" placeholder)
      if (graph && graph.rawNodes.length > 0) return { ...graph, graphStatus: 'loaded' };
      return { rawNodes: [], rawEdges: [], graphStatus: 'noSession' };
    }

    if (uploadedTableNodes.length > 0) {
      return { rawNodes: uploadedTableNodes, rawEdges: [], graphStatus: 'empty' };
    }

    return { rawNodes: [], rawEdges: [], graphStatus: 'empty' };
  }, [readOnly, rawBinding, data, queryResults, componentState]);

  const computedNodes = useMemo<Node[]>(() => {
    const positions = autoLayout(rawNodes);
    const savedPositions = componentState[config.id]?.nodePositions as Record<string, { x: number; y: number }> | undefined;

    // Count how many edges connect to each node to determine handle count
    const edgeCountPerNode = new Map<string, number>();
    rawEdges.forEach((edge) => {
      edgeCountPerNode.set(edge.source, (edgeCountPerNode.get(edge.source) || 0) + 1);
      edgeCountPerNode.set(edge.target, (edgeCountPerNode.get(edge.target) || 0) + 1);
    });

    return rawNodes.map((node) => {
      const position = savedPositions?.[node.id] ?? positions.get(node.id) ?? { x: 0, y: 0 };
      const nodeType = String(node.type ?? 'table');
      const handleCount = edgeCountPerNode.get(node.id) || 1;

      return {
        id: node.id,
        position,
        type: 'multiHandle',
        data: {
          label: node.label ?? node.id,
          source: node,
          nodeType,
          borderColor: style.borderColor || '#22d3ee',
          handleCount: Math.max(1, handleCount),
        },
        draggable: true,
      };
    });
  }, [componentState, config.id, rawNodes, style.borderColor, rawEdges]);

  const [nodes, setNodes] = useState<Node[]>(computedNodes);

  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const current = (useEditorStore.getState().componentState[config.id]?.nodePositions ?? {}) as Record<string, { x: number; y: number }>;
    setComponentState(config.id, 'nodePositions', {
      ...current,
      [node.id]: node.position,
    });
    setComponentState(config.id, 'selectedNode', node.data);
  }, [config.id, setComponentState]);

  const nodeTypes = useMemo(() => ({
    multiHandle: MultiHandleNode,
  }), []);

  const edges = useMemo<Edge[]>(
    () => {
      // Count edges between each pair of nodes
      const edgeCounts = new Map<string, RawEdge[]>();
      rawEdges.forEach((edge) => {
        const key = `${edge.source}|${edge.target}`;
        const existing = edgeCounts.get(key) || [];
        edgeCounts.set(key, [...existing, edge]);
      });

      return rawEdges.map((edge, index) => {
        const stroke = edgeColor(edge, style.borderColor || '#22d3ee');
        const weak = String(edge.strength ?? '').toLowerCase().includes('weak');
        const key = `${edge.source}|${edge.target}`;
        const edgesForPair = edgeCounts.get(key) || [];
        const edgeIndex = edgesForPair.indexOf(edge);
        const totalEdges = edgesForPair.length;

        // For multiple edges between same nodes, use smoothstep to curve them
        const edgeType = totalEdges > 1 ? 'smoothstep' : 'bezier';

        return {
          id: edge.id ?? `e-${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          sourceHandle: `handle-out-${edgeIndex}`,
          targetHandle: `handle-${edgeIndex}`,
          label: edge.label,
          animated: true,
          type: edgeType,
          markerEnd: { type: 'arrowclosed', color: stroke },
          style: { stroke, strokeWidth: 2, strokeDasharray: weak ? '6 4' : undefined },
          labelStyle: {
            fill: style.textColor || '#e2e8f0',
            fontWeight: 700,
            fontSize: 11,
            textAnchor: 'middle' as const,
          },
          labelBgStyle: {
            fill: '#0d1424',
            stroke: stroke,
            strokeWidth: 1.5,
            fillOpacity: 0.95,
            rx: 6,
            ry: 6,
          },
          labelBgPadding: [6, 10] as [number, number],
          labelBgBorderRadius: 6,
        };
      });
    },
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
    position: 'relative',
  };

  if (graphStatus === 'noSession') {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>Upload</div>
        <div style={{ fontSize: 13, color: style.textColor || '#e2e8f0', opacity: 0.6, textAlign: 'center' }}>
          Upload files first to build the relationship graph
        </div>
      </div>
    );
  }

  if (graphStatus === 'loading') {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: style.borderColor || '#22d3ee', opacity: 0.8 }}>
          Building relationship graph...
        </div>
      </div>
    );
  }

  if (graphStatus === 'error' && rawNodes.length === 0) {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#f87171', textAlign: 'center', padding: 16 }}>
          Failed to load relationships. Retry by clicking "Detect Relationships".
        </div>
      </div>
    );
  }

  if (graphStatus === 'empty' && rawNodes.length === 0) {
    return (
      <div className="nodegraph-component" style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: style.textColor || '#e2e8f0', opacity: 0.75, textAlign: 'center', padding: 16 }}>
          {emptyGraphMessage(rawNodes.length)}
        </div>
      </div>
    );
  }

  return (
    <div className="nodegraph-component" style={wrapperStyle}>
      {(graphStatus === 'empty' || graphStatus === 'error') && (
        <div
          style={{
            position: 'absolute',
            zIndex: 5,
            margin: 10,
            padding: '6px 9px',
            borderRadius: 8,
            background: 'rgba(15, 23, 42, 0.78)',
            color: graphStatus === 'error' ? '#fca5a5' : (style.textColor || '#e2e8f0'),
            fontSize: 11,
            maxWidth: 300,
          }}
        >
          {graphStatus === 'error'
            ? 'Relationship query failed, but uploaded tables are shown.'
            : emptyGraphMessage(rawNodes.length)}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
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
