// Parses Swagger 2.0 OR OpenAPI 3.0 documents into a normalised array of
// endpoint records that match the resource_endpoints table shape.

export interface ParsedEndpoint {
  method:       string;
  path:         string;
  summary:      string | null;
  parameters:   unknown[];
  requestBody:  Record<string, unknown>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
type HttpMethodKey = (typeof HTTP_METHODS)[number];

interface OpenApiOperation {
  summary?:     string;
  description?: string;
  parameters?:  unknown[];
  requestBody?: Record<string, unknown>;
}

interface SwaggerLikeDoc {
  swagger?: string;
  openapi?: string;
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

export function parseSwaggerDoc(doc: unknown): ParsedEndpoint[] {
  const typed = doc as SwaggerLikeDoc | null;
  if (!typed || typeof typed !== 'object') {
    return [];
  }
  if (!typed.paths || typeof typed.paths !== 'object') {
    return [];
  }

  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(typed.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<HttpMethodKey, OpenApiOperation | undefined>)[method];
      if (!op || typeof op !== 'object') continue;

      endpoints.push({
        method:      method.toUpperCase(),
        path,
        summary:     op.summary ?? op.description ?? null,
        parameters:  Array.isArray(op.parameters) ? op.parameters : [],
        requestBody: op.requestBody && typeof op.requestBody === 'object' ? op.requestBody : {},
      });
    }
  }

  return endpoints;
}
