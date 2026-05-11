import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { deepClone } from '../utils/deepClone';
import sourceIndexCss from '../index.css?raw';
import templateTypeSource from '../types/template.ts?raw';
import queryEngineSource from '../engine/queryEngine.ts?raw';
import bindingResolverSource from '../engine/bindingResolver.ts?raw';
import runtimeUtilsSource from '../engine/runtimeUtils.ts?raw';
import styleUtilsSource from '../utils/styleUtils.ts?raw';
import useTextMeasureSource from '../hooks/useTextMeasure.ts?raw';
import componentRegistrySource from '../config/componentRegistry.ts?raw';
import gridLayerSource from '../components/editor/GridLayer.tsx?raw';
import inlinePickerSource from '../components/editor/InlinePicker.tsx?raw';
import queryErrorBannerSource from '../components/ui/QueryErrorBanner.tsx?raw';
import statCardSource from '../components/dashboard-components/StatCard.tsx?raw';
import tableSource from '../components/dashboard-components/Table.tsx?raw';
import barChartSource from '../components/dashboard-components/BarChart.tsx?raw';
import lineChartSource from '../components/dashboard-components/LineChart.tsx?raw';
import statusBadgeSource from '../components/dashboard-components/StatusBadge.tsx?raw';
import buttonSource from '../components/dashboard-components/Button.tsx?raw';
import logsViewerSource from '../components/dashboard-components/LogsViewer.tsx?raw';
import containerSource from '../components/dashboard-components/Container.tsx?raw';
import tabbedContainerSource from '../components/dashboard-components/TabbedContainer.tsx?raw';
import textSource from '../components/dashboard-components/Text.tsx?raw';
import textInputSource from '../components/dashboard-components/TextInput.tsx?raw';
import numberInputSource from '../components/dashboard-components/NumberInput.tsx?raw';
import selectSource from '../components/dashboard-components/Select.tsx?raw';
import imageSource from '../components/dashboard-components/Image.tsx?raw';
import embedSource from '../components/dashboard-components/Embed.tsx?raw';
import nodeGraphSource from '../components/dashboard-components/NodeGraph.tsx?raw';
import chatBoxSource from '../components/dashboard-components/ChatBox.tsx?raw';
import fileUploadSource from '../components/dashboard-components/FileUpload.tsx?raw';

const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/;

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
};

// Helper to get file content (in a real app, these might be fetched or bundled)
const getRuntimeFile = async (path: string) => {
  // We fetch from the public folder which is served as-is by Vite
  const response = await fetch(`/export-runtime/${path}`);
  if (!response.ok) {
    throw new Error(`Missing export runtime file: ${path}`);
  }
  return response.text();
};

const exportedShellCss = `
.exported-dashboard-app { min-height: 100vh; }
.exported-dashboard-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 52px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.exported-dashboard-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.exported-dashboard-logo {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background: var(--blue-500);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.exported-dashboard-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exported-dashboard-meta {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.exported-dashboard-main .builder-canvas-wrapper { min-height: 100vh; }
`;

const sourceRuntimeFiles: Record<string, string> = {
  'src/types/template.ts': templateTypeSource,
  'src/engine/queryEngine.ts': queryEngineSource,
  'src/engine/bindingResolver.ts': bindingResolverSource,
  'src/engine/runtimeUtils.ts': runtimeUtilsSource,
  'src/utils/styleUtils.ts': styleUtilsSource,
  'src/hooks/useTextMeasure.ts': useTextMeasureSource,
  'src/config/componentRegistry.ts': componentRegistrySource,
  'src/components/editor/GridLayer.tsx': gridLayerSource,
  'src/components/editor/InlinePicker.tsx': inlinePickerSource,
  'src/components/ui/QueryErrorBanner.tsx': queryErrorBannerSource,
  'src/components/dashboard-components/StatCard.tsx': statCardSource,
  'src/components/dashboard-components/Table.tsx': tableSource,
  'src/components/dashboard-components/BarChart.tsx': barChartSource,
  'src/components/dashboard-components/LineChart.tsx': lineChartSource,
  'src/components/dashboard-components/StatusBadge.tsx': statusBadgeSource,
  'src/components/dashboard-components/Button.tsx': buttonSource,
  'src/components/dashboard-components/LogsViewer.tsx': logsViewerSource,
  'src/components/dashboard-components/Container.tsx': containerSource,
  'src/components/dashboard-components/TabbedContainer.tsx': tabbedContainerSource,
  'src/components/dashboard-components/Text.tsx': textSource,
  'src/components/dashboard-components/TextInput.tsx': textInputSource,
  'src/components/dashboard-components/NumberInput.tsx': numberInputSource,
  'src/components/dashboard-components/Select.tsx': selectSource,
  'src/components/dashboard-components/Image.tsx': imageSource,
  'src/components/dashboard-components/Embed.tsx': embedSource,
  'src/components/dashboard-components/NodeGraph.tsx': nodeGraphSource,
  'src/components/dashboard-components/ChatBox.tsx': chatBoxSource,
  'src/components/dashboard-components/FileUpload.tsx': fileUploadSource,
};

// Use shared deepClone utility instead of local definition

const decodeBase64 = (input: string): Uint8Array => {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const extForMime = (mimeType: string): string => MIME_TO_EXTENSION[mimeType.toLowerCase()] ?? 'bin';

const sanitizeFilePart = (value: string): string => value.toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'image';

type ImageAssetFile = {
  zipPath: string;
  bytes: Uint8Array;
};

const extractImageAssetsFromComponents = (rawComponents: any[]): { components: any[]; assets: ImageAssetFile[] } => {
  const components = deepClone(rawComponents ?? []);
  const assets: ImageAssetFile[] = [];
  const usedNames = new Set<string>();

  components.forEach((component: any, index: number) => {
    if (component?.type !== 'Image') return;
    const uploadedSrc = component?.data?.uploadedSrc;
    if (typeof uploadedSrc !== 'string' || !uploadedSrc.startsWith('data:')) return;

    const match = uploadedSrc.match(DATA_URL_PATTERN);
    if (!match) return;

    const [, mimeType, base64Payload] = match;
    if (!mimeType || !base64Payload) return;

    const ext = extForMime(mimeType);
    const baseName = sanitizeFilePart(String(component?.id || `image-${index + 1}`));
    let candidateName = `${baseName}.${ext}`;
    let counter = 1;

    while (usedNames.has(candidateName)) {
      counter += 1;
      candidateName = `${baseName}-${counter}.${ext}`;
    }
    usedNames.add(candidateName);

    const zipPath = `public/assets/images/${candidateName}`;
    assets.push({
      zipPath,
      bytes: decodeBase64(base64Payload),
    });

    component.data = {
      ...(component.data ?? {}),
      uploadedSrc: `/assets/images/${candidateName}`,
    };
  });

  return { components, assets };
};

export const downloadAsCode = async (dashboardState: any) => {
  const zip = new JSZip();
  const dashboardName = dashboardState.dashboardName || 'Untitled Dashboard';
  const { components: exportedComponents, assets: imageAssets } = extractImageAssetsFromComponents(
    dashboardState.components || [],
  );
  const queriesConfig = dashboardState.queriesConfig || [];
  const componentState = dashboardState.componentState || {};

  // Export includes all required fields for lossless round-trip:
  // queries (required for bindings), canvasStyle (visual fidelity), componentState (runtime config),
  // and status metadata
  const dashboardConfig = {
    name: dashboardName,
    components: exportedComponents,
    queries: queriesConfig,
    canvasStyle: dashboardState.canvasStyle || { backgroundColor: '#f3f4f6' },
    componentState: componentState,
    status: dashboardState.status || 'draft',
    publishedAt: dashboardState.publishedAt || null,
  };

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

  // Store uploaded image data-URLs as physical files in exported code.
  imageAssets.forEach((asset) => {
    zip.file(asset.zipPath, asset.bytes);
  });

  // 2. Add Runtime files
  const runtimeFiles = [
    'runtime/Renderer.tsx',
    'App.tsx',
    'store/editorStore.ts',
    'types/shared.d.ts',
  ];

  console.log('Adding runtime files to ZIP...');
  for (const file of runtimeFiles) {
    const content = await getRuntimeFile(file);
    if (file === 'App.tsx') {
      zip.file('src/App.tsx', content);
    } else {
      zip.file(`src/${file}`, content);
    }
  }

  Object.entries(sourceRuntimeFiles).forEach(([path, content]) => {
    zip.file(path, content);
  });

  // 3. Add Project files
  const packageJson = await getRuntimeFile('package.json.template');
  const viteConfig = await getRuntimeFile('vite.config.ts.template');
  const indexHtml = await getRuntimeFile('index.html.template');
  const mainTsx = await getRuntimeFile('main.tsx.template');
  
  zip.file('package.json', packageJson);
  zip.file('vite.config.ts', viteConfig);
  zip.file('index.html', indexHtml);
  zip.file('src/main.tsx', mainTsx);
  zip.file('src/index.css', `${sourceIndexCss}\n${exportedShellCss}`);
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
