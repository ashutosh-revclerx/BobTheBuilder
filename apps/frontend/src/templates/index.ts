import type { TemplateConfig } from '../types/template';
import majesticMaroon from './majestic-maroon';
import oceanicTeal from './oceanic-teal';
import emeraldGrove from './emerald-grove';
import midnightIndigo from './midnight-indigo';
import sunsetBlaze from './sunset-blaze';
import smallDatasetPipeline from './small-dataset-pipeline';
import demoBackendSuite from './demo-backend-suite';

export const templates: TemplateConfig[] = [
  smallDatasetPipeline,
  demoBackendSuite,
  majesticMaroon,
  oceanicTeal,
  emeraldGrove,
  midnightIndigo,
  sunsetBlaze,
];

export function getTemplateById(id: string): TemplateConfig | undefined {
  return templates.find(t => t.id === id);
}

export function getBlankTemplate(): TemplateConfig {
  return {
    id: `blank-${Date.now()}`,
    name: 'Untitled Dashboard',
    description: 'Start from scratch',
    components: [],
  };
}
