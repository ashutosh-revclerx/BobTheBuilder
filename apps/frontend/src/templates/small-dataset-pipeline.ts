import type { TemplateConfig } from '../types/template';

// Resource name placeholder. After importing, open the Queries panel and
// change `resource` on every query to the actual name of your imported
// data-layer-services resource. Same for FileUpload.data.resourceId
// (must be the resource UUID).
const RESOURCE = 'data-layer-services';

const smallDatasetPipeline: TemplateConfig = {
  id: 'small-dataset-pipeline',
  name: 'Small Dataset Pipeline',
  description:
    'Upload Excel/CSV/PDF docs → automatic relationship detection → node-graph viz + RAG chat. Session-based: upload returns a session_id that drives every other call.',
  components: [
    // ─── Header ─────────────────────────────────────────────────────────
    {
      id: 'header-bar',
      type: 'Container',
      label: 'Header',
      layout: { x: 0, y: 0, w: 12, h: 2 },
      style: {
        backgroundColor: '#0d1424',
        borderColor: '#22d3ee',
        borderWidth: 0,
        borderRadius: 0,
        padding: 16,
        boxShadow: '0 4px 12px rgba(34, 211, 238, 0.15)',
      },
      data: {},
    },
    {
      id: 'header-title',
      type: 'Text',
      label: 'Title',
      layout: { x: 0, y: 0, w: 8, h: 2 },
      style: {
        fontSize: 26,
        fontWeight: 700,
        textColor: '#22d3ee',
        backgroundColor: 'transparent',
      },
      data: { mockValue: '🧬 Small Dataset Intelligence' },
    },
    {
      id: 'header-status',
      type: 'StatusBadge',
      label: 'Status',
      layout: { x: 10, y: 0, w: 2, h: 2 },
      style: {
        backgroundColor: '#0c2331',
        borderColor: '#22d3ee',
        borderRadius: 8,
        padding: 8,
        textColor: '#22d3ee',
      },
      data: { mockValue: '● Pipeline Ready' },
    },

    // ─── Upload + Session Display ──────────────────────────────────────
    {
      id: 'upload-zone',
      type: 'FileUpload',
      label: 'Upload Datasets',
      layout: { x: 0, y: 2, w: 4, h: 6 },
      style: {
        backgroundColor: '#111c2e',
        borderColor: '#22d3ee',
        textColor: '#e2e8f0',
        borderRadius: 14,
        padding: 18,
        boxShadow: '0 4px 12px rgba(34, 211, 238, 0.1)',
      },
      data: {
        mockValue: '',
        ...({
          accept: '.xlsx,.xls,.csv,.pdf,.docx,.txt',
          multiple: true,
          fieldName: 'files', // most FastAPI multi-file handlers expect "files"
          resourceId: '', // ← USER MUST FILL: UUID of imported data-layer-services resource
          endpointPath: '/api/v1/pipelines/small-dataset/upload',
        } as any),
      },
    },
    {
      id: 'session-display',
      type: 'Text',
      label: 'Active Session',
      layout: { x: 0, y: 8, w: 4, h: 2 },
      style: {
        backgroundColor: '#0c2331',
        borderColor: '#22d3ee',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        fontSize: 12,
        fontFamily: 'Fira Code',
        textColor: '#22d3ee',
        overflow: 'Truncate',
      },
      data: {
        mockValue: '⏳ Upload files to start a session…',
        dbBinding: '{{componentState.upload-zone.sessionId}}',
        expression: false,
      },
    },

    // ─── Stat Cards ────────────────────────────────────────────────────
    {
      id: 'stat-docs',
      type: 'StatCard',
      label: 'Documents Ingested',
      layout: { x: 4, y: 2, w: 4, h: 4 },
      style: {
        backgroundColor: '#111c2e',
        borderLeftColor: '#22d3ee',
        borderLeftWidth: 4,
        borderRadius: 14,
        padding: 22,
        textColor: '#ffffff',
        metricFontSize: 32,
        labelFontSize: 13,
        boxShadow: '0 4px 12px rgba(34, 211, 238, 0.15)',
        backgroundGradient: {
          enabled: true,
          direction: 135,
          stops: [
            { color: '#0c2331', position: 0 },
            { color: '#155e75', position: 100 },
          ],
        },
      },
      data: {
        mockValue: '0',
        dbBinding: '{{queries.get-tables.data.length}}',
      },
    },
    {
      id: 'stat-relations',
      type: 'StatCard',
      label: 'Relations Found',
      layout: { x: 8, y: 2, w: 4, h: 4 },
      style: {
        backgroundColor: '#111c2e',
        borderLeftColor: '#a855f7',
        borderLeftWidth: 4,
        borderRadius: 14,
        padding: 22,
        textColor: '#ffffff',
        metricFontSize: 32,
        labelFontSize: 13,
        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)',
      },
      data: {
        mockValue: '0',
        dbBinding: '{{queries.get-relationships.data.length}}',
      },
    },
    {
      id: 'stat-tables',
      type: 'StatCard',
      label: 'Tables Parsed',
      layout: { x: 4, y: 6, w: 4, h: 4 },
      style: {
        backgroundColor: '#111c2e',
        borderLeftColor: '#34d399',
        borderLeftWidth: 4,
        borderRadius: 14,
        padding: 22,
        textColor: '#ffffff',
        metricFontSize: 32,
        labelFontSize: 13,
        boxShadow: '0 4px 12px rgba(52, 211, 153, 0.12)',
      },
      data: {
        mockValue: '0',
        dbBinding: '{{queries.get-tables.data.length}}',
      },
    },
    {
      id: 'stat-rag',
      type: 'StatCard',
      label: 'Chat Messages',
      layout: { x: 8, y: 6, w: 4, h: 4 },
      style: {
        backgroundColor: '#111c2e',
        borderLeftColor: '#fbbf24',
        borderLeftWidth: 4,
        borderRadius: 14,
        padding: 22,
        textColor: '#ffffff',
        metricFontSize: 32,
        labelFontSize: 13,
        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.12)',
      },
      data: {
        mockValue: '0',
        dbBinding: '{{queries.get-chat-history.data.length}}',
      },
    },

    // ─── Action Buttons (manual triggers) ──────────────────────────────
    {
      id: 'btn-detect',
      type: 'Button',
      label: '🔍 Detect Relationships',
      layout: { x: 0, y: 10, w: 2, h: 3 },
      style: {
        backgroundColor: '#a855f7',
        borderColor: '#a855f7',
        textColor: '#ffffff',
        borderRadius: 10,
        padding: 12,
        fontWeight: 600,
        hoverBackgroundColor: '#9333ea',
      },
      data: {
        dbBinding: 'queries.detect-relationships.trigger',
        loadingState: true,
      },
    },
    {
      id: 'btn-refresh',
      type: 'Button',
      label: '🔄 Refresh Graph',
      layout: { x: 2, y: 10, w: 2, h: 3 },
      style: {
        backgroundColor: '#0ea5e9',
        borderColor: '#0ea5e9',
        textColor: '#ffffff',
        borderRadius: 10,
        padding: 12,
        fontWeight: 600,
        hoverBackgroundColor: '#0284c7',
      },
      data: {
        dbBinding: 'queries.get-relationships.trigger',
        loadingState: true,
      },
    },

    // ─── Node Graph + Chat ─────────────────────────────────────────────
    {
      id: 'relations-graph',
      type: 'NodeGraph',
      label: 'Dataset Relationships',
      layout: { x: 0, y: 13, w: 8, h: 13 },
      style: {
        backgroundColor: '#0d1424',
        borderColor: '#22d3ee',
        textColor: '#e2e8f0',
        borderRadius: 14,
        borderWidth: 1,
        padding: 0,
        boxShadow: '0 4px 12px rgba(34, 211, 238, 0.1)',
      },
      data: {
        dbBinding: '{{queries.get-relationships.data}}',
        // Fallback when no session yet
        mockValue: {
          nodes: [
            { id: 'customers', label: '👥 customers.xlsx' },
            { id: 'orders',    label: '📋 orders.xlsx' },
            { id: 'products',  label: '📦 products.xlsx' },
          ],
          edges: [
            { source: 'customers', target: 'orders',   label: 'customer_id' },
            { source: 'orders',    target: 'products', label: 'product_id' },
          ],
        },
      },
    },
    {
      id: 'rag-chat',
      type: 'ChatBox',
      label: 'Ask Your Data',
      layout: { x: 8, y: 10, w: 4, h: 16 },
      style: {
        backgroundColor: '#111c2e',
        borderColor: '#a855f7',
        textColor: '#e2e8f0',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.1)',
      },
      data: {
        placeholder: 'Ask about your datasets...',
        dbBinding: '{{queries.ask-rag.data}}',
        mockValue: '',
      },
    },

    // ─── Tables Table ──────────────────────────────────────────────────
    {
      id: 'tables-table',
      type: 'Table',
      label: 'Parsed Tables',
      layout: { x: 0, y: 26, w: 12, h: 7 },
      style: {
        backgroundColor: '#0d1424',
        borderColor: '#1e2d42',
        headerBackgroundColor: '#111c2e',
        textColor: '#e2e8f0',
        borderRadius: 12,
        padding: 0,
        stripeRows: true,
      },
      data: {
        searchable: true,
        pagination: true,
        columns: [
          { name: 'Table ID',     fieldKey: 'table_id' },
          { name: 'Name',         fieldKey: 'name' },
          { name: 'Source File',  fieldKey: 'source_file' },
          { name: 'Rows',         fieldKey: 'row_count' },
          { name: 'Columns',      fieldKey: 'column_count' },
        ],
        dbBinding: '{{queries.get-tables.data}}',
        mockValue: [],
        columnVisibility: { table_id: true, name: true, source_file: true, row_count: true, column_count: true },
      },
    },
  ],

  // ──────────────────────────────────────────────────────────────────────
  // QUERIES — chained on session_id captured by FileUpload after upload.
  // The user MUST update `resource` on each query to the actual name of
  // their imported data-layer-services resource (Queries panel in builder).
  // ──────────────────────────────────────────────────────────────────────
  queries: [
    // Re-fetches after upload completes & session_id appears.
    {
      name: 'get-tables',
      resource: RESOURCE,
      endpoint: '/api/v1/pipelines/small-dataset/tables/{{componentState.upload-zone.sessionId}}',
      method: 'GET',
      trigger: 'onDependencyChange',
      dependsOn: ['componentState.upload-zone.sessionId'],
    },

    // Kicks off relationship detection automatically when session_id arrives.
    {
      name: 'detect-relationships',
      resource: RESOURCE,
      endpoint: '/api/v1/pipelines/small-dataset/relationships/{{componentState.upload-zone.sessionId}}/detect',
      method: 'POST',
      trigger: 'onDependencyChange',
      dependsOn: ['componentState.upload-zone.sessionId'],
    },

    // Pulls the graph payload. Re-runs whenever detect-relationships completes.
    {
      name: 'get-relationships',
      resource: RESOURCE,
      endpoint: '/api/v1/pipelines/small-dataset/relationships/{{componentState.upload-zone.sessionId}}',
      method: 'GET',
      trigger: 'onDependencyChange',
      dependsOn: [
        'componentState.upload-zone.sessionId',
        'queries.detect-relationships.data',
      ],
    },

    // Chat history (refreshes after each ask-rag completes).
    {
      name: 'get-chat-history',
      resource: RESOURCE,
      endpoint: '/api/v1/pipelines/small-dataset/chat/{{componentState.upload-zone.sessionId}}/history',
      method: 'GET',
      trigger: 'onDependencyChange',
      dependsOn: [
        'componentState.upload-zone.sessionId',
        'queries.ask-rag.data',
      ],
    },

    // RAG ask — manual trigger, fired by ChatBox when user hits send.
    // ChatBox stores the question in componentState[<id>].value before firing.
    {
      name: 'ask-rag',
      resource: RESOURCE,
      endpoint: '/api/v1/pipelines/small-dataset/chat/{{componentState.upload-zone.sessionId}}',
      method: 'POST',
      trigger: 'manual',
      body: {
        message: '{{componentState.rag-chat.value}}',
      },
    },
  ] as any,

  canvasStyle: {
    backgroundColor: '#05080f',
    backgroundGradient: {
      enabled: true,
      direction: 135,
      stops: [
        { color: '#03060c', position: 0 },
        { color: '#0a1628', position: 100 },
      ],
    },
  },
};

export default smallDatasetPipeline;
