import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ComponentConfig } from '../types/template';

export interface ProjectData {
  metadata: {
    name: string;
    version: string;
    generatedAt: string;
    platform: string;
    status: 'draft' | 'live';
    publishedAt: string | null;
  };
  config: {
    components: ComponentConfig[];
  };
  queries: any[];
  styles: {
    themes: any[];
    tokens: {
      colors: string[];
      fonts: string[];
    };
  };
  state: {
    activeTabs: Record<string, string>;
  };
}

export const exportProject = async (state: any) => {
  const zip = new JSZip();
  const timestamp = new Date().toISOString();
  
  const projectData: ProjectData = {
    metadata: {
      name: state.dashboardName || 'untitled-dashboard',
      version: '1.0',
      generatedAt: timestamp,
      platform: 'bob-the-builder',
      status: state.status || 'draft',
      publishedAt: state.publishedAt,
    },
    config: {
      components: state.components || [],
    },
    queries: state.queriesConfig || [],
    styles: {
      themes: [], // placeholder for future theme system
      tokens: {
        colors: Array.from(new Set(state.components.map((c: any) => c.style?.backgroundColor).filter(Boolean))),
        fonts: Array.from(new Set(state.components.map((c: any) => c.style?.fontFamily).filter(Boolean))),
      }
    },
    state: {
      activeTabs: state.activeTabs || {},
    }
  };

  // Add individual JSON files for modularity as requested
  zip.file('metadata.json', JSON.stringify(projectData.metadata, null, 2));
  zip.file('config.json', JSON.stringify(projectData.config, null, 2));
  zip.file('queries.json', JSON.stringify(projectData.queries, null, 2));
  zip.file('styles.json', JSON.stringify(projectData.styles, null, 2));
  zip.file('state.json', JSON.stringify(projectData.state, null, 2));
  
  zip.file('README.md', `# Dashboard Export: ${projectData.metadata.name}

Generated at: ${projectData.metadata.generatedAt}
Platform: ${projectData.metadata.platform}
Version: ${projectData.metadata.version}

## Files
- \`metadata.json\`: Project metadata and versioning
- \`config.json\`: Component definitions, layouts, and data bindings
- \`queries.json\`: API query configurations
- \`styles.json\`: Design tokens and styling extraction
- \`state.json\`: Default application state (e.g. active tabs)

## Usage
This file is a structured export of a BobTheBuilder dashboard. You can re-import it into the builder to restore your project.
`);

  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${projectData.metadata.name.toLowerCase().replace(/\s+/g, '-')}-export.zip`;
  saveAs(content, filename);
};

export const importProject = async (file: File): Promise<ProjectData> => {
  const zip = await JSZip.loadAsync(file);
  
  const metadataStr = await zip.file('metadata.json')?.async('string');
  const configStr = await zip.file('config.json')?.async('string');
  const queriesStr = await zip.file('queries.json')?.async('string');
  const stylesStr = await zip.file('styles.json')?.async('string');
  const stateStr = await zip.file('state.json')?.async('string');

  if (!metadataStr || !configStr) {
    throw new Error('Invalid project file: Missing critical configuration files.');
  }

  return {
    metadata: JSON.parse(metadataStr),
    config: JSON.parse(configStr),
    queries: queriesStr ? JSON.parse(queriesStr) : [],
    styles: stylesStr ? JSON.parse(stylesStr) : { themes: [], tokens: { colors: [], fonts: [] } },
    state: stateStr ? JSON.parse(stateStr) : { activeTabs: {} },
  };
};
