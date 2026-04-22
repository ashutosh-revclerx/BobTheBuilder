import type { TemplateConfig } from '../types/template';

const phase1Testing: TemplateConfig = {
  id: 'phase1-testing',
  name: 'Phase 1 - Engine Test',
  description: 'A live dashboard executing real queries against the Node/Express execution endpoint.',
  thumbnail: '',
  queries: [
    {
      name: 'getMainApi',
      resource: 'mainApi',
      trigger: 'onLoad',
      endpoint: '/data',
      method: 'POST'
    },
    {
      name: 'runAgent',
      resource: 'agentRunner',
      trigger: 'manual',
    }
  ],
  components: [
    {
      id: 'table-test-1',
      type: 'Table',
      label: 'Main API Data',
      style: {
        backgroundColor: '#ffffff',
        textColor: '#0f1117',
        fontFamily: 'Inter',
        fontSize: 13,
        borderRadius: 10,
        borderColor: '#e3e6ec',
        borderWidth: 1,
        padding: 0,
      },
      data: {
        columns: [
          { name: 'ID', fieldKey: 'id' },
          { name: 'Name', fieldKey: 'name' },
          { name: 'Amount', fieldKey: 'amount' },
          { name: 'Status', fieldKey: 'status' }
        ],
        dbBinding: 'queries.getMainApi.data',
        mockValue: [],
        refreshOn: 'onLoad'
      }
    },
    {
      id: 'button-test-1',
      type: 'Button',
      label: 'Execute Strategy Agent',
      style: {
        backgroundColor: '#ffffff',
        textColor: '#f59e0b', // yellow main button
        fontFamily: 'Inter',
        borderRadius: 6,
        padding: 16
      },
      data: {
        dbBinding: 'queries.runAgent',
        mockValue: null
      }
    },
    {
      id: 'logs-test-1',
      type: 'LogsViewer',
      label: 'Agent Terminal logs',
      style: {
        backgroundColor: '#f8f9fb',
        textColor: '#3b82f6',
        fontFamily: 'monospace',
        fontSize: 12,
        borderRadius: 6,
        borderColor: '#e3e6ec',
        borderWidth: 1
      },
      data: {
        dbBinding: 'queries.runAgent.data.logs',
        mockValue: ['[INFO] Waiting for agent execution...']
      }
    }
  ]
};

export default phase1Testing;
