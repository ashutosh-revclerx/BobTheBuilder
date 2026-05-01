import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Helper to get file content (in a real app, these might be fetched or bundled)
const getRuntimeFile = async (path: string) => {
  // For the purpose of this implementation, we will fetch the local files 
  // which are served by the dev server.
  const response = await fetch(`/src/export-runtime/${path}`);
  return response.text();
};

export const downloadAsCode = async (dashboardState: any) => {
  const zip = new JSZip();
  
  // 1. Add Config files
  zip.folder('config');
  zip.file('config/dashboard.json', JSON.stringify({
    name: dashboardState.dashboardName,
    components: dashboardState.components
  }, null, 2));
  zip.file('config/queries.json', JSON.stringify(dashboardState.queriesConfig, null, 2));

  // 2. Add Runtime files
  const runtimeFiles = [
    'BindingResolver.ts',
    'QueryEngine.ts',
    'Renderer.tsx',
    'StateManager.tsx',
    'App.tsx',
    'components/Button.tsx',
    'components/Table.tsx',
    'components/Text.tsx'
  ];

  const runtimeFolder = zip.folder('src/runtime');
  const componentsFolder = zip.folder('src/runtime/components');

  for (const file of runtimeFiles) {
    const content = await getRuntimeFile(file);
    if (file.startsWith('components/')) {
      componentsFolder!.file(file.replace('components/', ''), content);
    } else if (file === 'App.tsx') {
      zip.file('src/App.tsx', content);
    } else {
      runtimeFolder!.file(file, content);
    }
  }

  // 3. Add Project files
  const packageJson = await getRuntimeFile('package.json.template');
  const viteConfig = await getRuntimeFile('vite.config.ts.template');
  const indexHtml = await getRuntimeFile('index.html.template');
  const mainTsx = await getRuntimeFile('main.tsx.template');
  const indexCss = await getRuntimeFile('index.css.template');
  
  zip.file('package.json', packageJson);
  zip.file('vite.config.ts', viteConfig);
  zip.file('index.html', indexHtml);
  zip.file('src/main.tsx', mainTsx);
  zip.file('src/index.css', indexCss);
  zip.file('README.md', `# Exported Dashboard: ${dashboardState.dashboardName}

This project was exported from BobTheBuilder.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Configuration

Update the backend URL in \`src/runtime/QueryEngine.ts\` or use a \`.env\` file.
`);

  // 4. Generate and download
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${dashboardState.dashboardName.toLowerCase().replace(/\s+/g, '-')}-app.zip`);
};
