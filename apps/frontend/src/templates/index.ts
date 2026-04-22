import type { TemplateConfig } from '../types/template';
import projectOverview from './project-overview';
import sprintTracker from './sprint-tracker';
import budgetMonitor from './budget-monitor';
import phase1Testing from './phase1-testing';

export const templates: TemplateConfig[] = [
  phase1Testing,
  projectOverview,
  sprintTracker,
  budgetMonitor,
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
