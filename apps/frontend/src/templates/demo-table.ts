import type { TemplateConfig } from '../types/template';

const demoTable: TemplateConfig = {
  id: 'demo-table',
  name: 'Demo Admin Table',
  description: 'A pre-configured table connected to the PostgreSQL test database.',
  components: [
    {
      id: 'table-admins',
      type: 'Table',
      label: 'Admin Users Table',
      style: {
        backgroundColor: '#ffffff',
        textColor: '#0f1117',
        fontFamily: 'Inter',
        fontSize: 13,
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 8,
      },
      data: {
        // Here we explicitly define the columns to match the database response
        columns: [
          { name: 'Name', fieldKey: 'name' },
          { name: 'Role', fieldKey: 'role' }
        ],
        // dbBinding is securely wrapped in {{ }}
        dbBinding: '{{queries.getAdmins.data}}',
        // This queryBindingConfig ensures the UI dropdowns in DataTab.tsx are pre-populated!
        queryBindingConfig: {
          resourceId: 'test-db', // The resource ID must match the one in your DB! Usually 'test-db' or a UUID
          resourceName: 'test-db',
          method: 'POST',
          path: 'SELECT * FROM mock_users WHERE role = \'Admin\'',
          trigger: 'onLoad',
          queryName: 'getAdmins'
        }
      },
      layout: { x: 0, y: 0, w: 12, h: 10 }
    }
  ],
  queries: [
    {
      name: 'getAdmins',
      resource: 'test-db', // Must match the resource name in the backend
      endpoint: 'SELECT * FROM mock_users WHERE role = \'Admin\'',
      method: 'POST',
      trigger: 'onLoad',
      params: {}
    }
  ]
};

export default demoTable;
