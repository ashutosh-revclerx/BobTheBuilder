import type { TemplateConfig } from '../types/template';

const nexusOperations: TemplateConfig = {
  id: 'nexus-operations',
  name: 'Nexus Operations',
  description: 'Dual-workflow operations dashboard for URL scraping and person lookup.',
  components: [
    {
      id: 'container-scrape',
      type: 'Container',
      label: 'Workflow A — URL Scraper',
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 12,
        padding: 24,
      },
      data: {},
      layout: { x: 0, y: 0, w: 12, h: 16 }
    },
    {
      id: 'input-url',
      type: 'TextInput',
      label: 'URL to scrape',
      parentId: 'container-scrape',
      style: {
        backgroundColor: '#f8f9fb',
        textColor: '#0f1117',
        fontFamily: 'Inter',
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 6,
      },
      data: {
        placeholder: 'https://example.com',
      },
      layout: { x: 0, y: 0, w: 8, h: 4 }
    },
    {
      id: 'badge-scrape',
      type: 'StatusBadge',
      label: 'Scrape Status',
      parentId: 'container-scrape',
      style: {
        backgroundColor: 'transparent',
        textColor: '#2563eb',
        fontFamily: 'Inter',
      },
      data: {
        mockValue: 'ready',
        dbBinding: 'queries.runScrape.data.status',
        mapping: {
          'ready': '#9ba3af',
          'running': '#d97706',
          'done': '#059669',
          'failed': '#dc2626'
        }
      },
      layout: { x: 8, y: 0, w: 4, h: 4 }
    },
    {
      id: 'btn-scrape',
      type: 'Button',
      label: 'Scrape URL',
      parentId: 'container-scrape',
      style: {
        backgroundColor: '#2563eb',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        borderRadius: 6,
      },
      data: {
        dbBinding: 'queries.runScrape',
      },
      layout: { x: 0, y: 4, w: 4, h: 3 }
    },
    {
      id: 'result-scrape',
      type: 'Text',
      label: 'Scraped Content',
      parentId: 'container-scrape',
      style: {
        backgroundColor: '#f8f9fb',
        textColor: '#5c6370',
        fontFamily: 'Fira Code',
        fontSize: 12,
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 6,
        padding: 12,
        overflow: 'Scroll'
      },
      data: {
        mockValue: 'Waiting for output...',
        dbBinding: 'queries.runScrape.data.result',
      },
      layout: { x: 0, y: 7, w: 12, h: 9 }
    },

    {
      id: 'container-lookup',
      type: 'Container',
      label: 'Workflow B — Person Lookup',
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 12,
        padding: 24,
      },
      data: {},
      layout: { x: 0, y: 17, w: 12, h: 18 }
    },
    {
      id: 'input-name',
      type: 'TextInput',
      label: 'Name',
      parentId: 'container-lookup',
      style: {
        backgroundColor: '#f8f9fb',
        textColor: '#0f1117',
        fontFamily: 'Inter',
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 6,
      },
      data: {
        placeholder: 'e.g. Dhruv Sharma',
      },
      layout: { x: 0, y: 0, w: 4, h: 4 }
    },
    {
      id: 'input-org',
      type: 'TextInput',
      label: 'Organisation',
      parentId: 'container-lookup',
      style: {
        backgroundColor: '#f8f9fb',
        textColor: '#0f1117',
        fontFamily: 'Inter',
        borderColor: '#e3e6ec',
        borderWidth: 1,
        borderRadius: 6,
      },
      data: {
        placeholder: 'e.g. Revclerx Pvt Ltd.',
      },
      layout: { x: 4, y: 0, w: 4, h: 4 }
    },
    {
      id: 'badge-lookup',
      type: 'StatusBadge',
      label: 'Lookup Status',
      parentId: 'container-lookup',
      style: {
        backgroundColor: 'transparent',
        textColor: '#2563eb',
        fontFamily: 'Inter',
      },
      data: {
        mockValue: 'ready',
        dbBinding: 'queries.runLookup.data.status',
        mapping: {
          'ready': '#9ba3af',
          'running': '#d97706',
          'done': '#059669',
          'failed': '#dc2626'
        }
      },
      layout: { x: 8, y: 0, w: 4, h: 4 }
    },
    {
      id: 'btn-lookup',
      type: 'Button',
      label: 'Look up Person',
      parentId: 'container-lookup',
      style: {
        backgroundColor: '#2563eb',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        borderRadius: 6,
      },
      data: {
        dbBinding: 'queries.runLookup',
      },
      layout: { x: 0, y: 4, w: 4, h: 3 }
    },
    {
      id: 'result-lookup',
      type: 'Table',
      label: 'Person Info',
      parentId: 'container-lookup',
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
        columns: [
          { name: 'Name', fieldKey: 'name' },
          { name: 'Designation', fieldKey: 'designation' },
          { name: 'Location', fieldKey: 'location' },
          { name: 'Company Website', fieldKey: 'website' }
        ],
        mockValue: [
          { name: 'Dhruv Sharma', designation: 'Engineer', location: 'India', website: 'https://revclerx.com' }
        ],
        dbBinding: 'queries.runLookup.data.result'
      },
      layout: { x: 0, y: 7, w: 12, h: 10 }
    }
  ],
  queries: [
    {
      name: 'runScrape',
      resource: 'nexus-scrape',
      endpoint: '/public/scrape',
      method: 'POST',
      trigger: 'manual',
      params: {},
      body: {
        url: '{{components.input-url.value}}'
      }
    },
    {
      name: 'runLookup',
      resource: 'nexus-scrape',
      endpoint: '/v1/person-lookup',
      method: 'POST',
      trigger: 'manual',
      params: {},
      body: {
        name: '{{components.input-name.value}}',
        organization: '{{components.input-org.value}}'
      }
    }
  ]
};

export default nexusOperations;
