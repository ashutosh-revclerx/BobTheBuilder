import { z } from 'zod';

export const ComponentStyleSchema = z.object({
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  padding: z.number().optional()
});

export const ComponentConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['StatCard', 'Table', 'BarChart', 'LineChart', 'StatusBadge', 'Button', 'LogsViewer']),
  label: z.string().default(''),
  style: ComponentStyleSchema.optional().default({}),
  data: z.any().optional(),
  columns: z.array(z.string()).optional(),
  onClick: z.string().optional()
});

export const QueryConfigSchema = z.object({
  name: z.string(),
  resource: z.string(),
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('POST'),
  trigger: z.enum(['onLoad', 'manual', 'onDependencyChange']).default('onLoad'),
  params: z.record(z.string(), z.any()).optional(),
  body: z.any().optional(),
  dependsOn: z.array(z.string()).optional(),
  responseTransformer: z.string().optional(),
  pollUrlTemplate: z.string().optional()
});

export const ResourceConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['rest_api', 'agent', 'postgres']),
  baseUrl: z.string().optional(),
  endpoint: z.string().optional() // For agents
});

export const DashboardTemplateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  components: z.array(ComponentConfigSchema),
  queries: z.array(QueryConfigSchema).optional().default([]),
  resources: z.array(ResourceConfigSchema).optional().default([])
});

export type ComponentStyle = z.infer<typeof ComponentStyleSchema>;
export type ComponentConfig = z.infer<typeof ComponentConfigSchema>;
export type QueryConfig = z.infer<typeof QueryConfigSchema>;
export type ResourceConfig = z.infer<typeof ResourceConfigSchema>;
export type DashboardTemplate = z.infer<typeof DashboardTemplateSchema>;

export const ExecuteRequestSchema = z.object({
  resourceId: z.string(),
  queryName: z.string().optional(),
  endpoint: z.string().optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.any()).optional()
});

export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

export const ExecuteResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional()
});

export type ExecuteResponse = z.infer<typeof ExecuteResponseSchema>;
