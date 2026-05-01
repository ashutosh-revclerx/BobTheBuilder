import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Helper to get file content (in a real app, these might be fetched or bundled)
const getRuntimeFile = async (path: string) => {
  // We fetch from the public folder which is served as-is by Vite
  const response = await fetch(`/export-runtime/${path}`);
  if (!response.ok) {
    throw new Error(`Missing export runtime file: ${path}`);
  }
  return response.text();
};

export const downloadAsCode = async (dashboardState: any) => {
  const zip = new JSZip();
  const dashboardName = dashboardState.dashboardName || 'Untitled Dashboard';
  const dashboardConfig = {
    name: dashboardName,
    components: dashboardState.components || []
  };
  const queriesConfig = dashboardState.queriesConfig || [];
  
  // 1. Add Config files
  console.log('Adding config files to ZIP...');
  const dashboardJson = JSON.stringify(dashboardConfig, null, 2);
  const queriesJson = JSON.stringify(queriesConfig, null, 2);

  // App.tsx imports these as ./config/*.json, so they must live under src/.
  zip.folder('src/config');
  zip.file('src/config/dashboard.json', dashboardJson);
  zip.file('src/config/queries.json', queriesJson);

  // Keep root-level copies for humans/backward compatibility with older exports.
  zip.folder('config');
  zip.file('config/dashboard.json', dashboardJson);
  zip.file('config/queries.json', queriesJson);

  // 2. Add Runtime files
  const runtimeFiles = [
    'runtime/BindingResolver.ts',
    'runtime/QueryEngine.ts',
    'runtime/Renderer.tsx',
    'runtime/StateManager.tsx',
    'App.tsx',
    'runtime/components/Button.tsx',
    'runtime/components/Table.tsx',
    'runtime/components/Text.tsx'
  ];

  console.log('Adding runtime files to ZIP...');
  for (const file of runtimeFiles) {
    const content = await getRuntimeFile(file);
    if (file.includes('components/')) {
      const fileName = file.split('/').pop()!;
      zip.file(`src/runtime/components/${fileName}`, content);
    } else if (file === 'App.tsx') {
      zip.file('src/App.tsx', content);
    } else {
      const fileName = file.split('/').pop()!;
      zip.file(`src/runtime/${fileName}`, content);
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
  zip.file('.env.example', 'VITE_BACKEND_URL=http://localhost:3001/api/execute\n');
  zip.file('README.md', `# Exported Dashboard: ${dashboardName}

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
  const filename = dashboardName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '') || 'dashboard';
  saveAs(blob, `${filename}-app.zip`);
};
