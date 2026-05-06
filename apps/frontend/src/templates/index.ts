import type { TemplateConfig } from '../types/template';

export const templates: TemplateConfig[] = [];

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
