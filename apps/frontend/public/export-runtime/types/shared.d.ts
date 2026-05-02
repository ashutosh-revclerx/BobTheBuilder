declare module '@btb/shared' {
  export interface QueryConfig {
    name: string;
    resource: string;
    endpoint: string;
    method?: string;
    params?: Record<string, unknown>;
    body?: Record<string, unknown>;
    trigger?: 'onLoad' | 'manual' | 'onDependencyChange';
    dependsOn?: string[];
  }
}
