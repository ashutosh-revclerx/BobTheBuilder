import { createPublicKey, createVerify } from 'crypto';

export const AUTH_BASE_URL = 'https://auth.nervesparks.com';
export const JWKS_URL = `${AUTH_BASE_URL}/api/v1/auth/.well-known/jwks.json`;
export const ALGORITHM = 'RS256';
export const ISSUER = 'auth-gateway';
export const ACCESS_AUDIENCE = 'auth-gateway-access';
export const REFRESH_AUDIENCE = 'auth-gateway-refresh';
export const ACCESS_TOKEN_TYPE = 'access';
export const REFRESH_TOKEN_TYPE = 'refresh';

const JWKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface JwkKey extends JsonWebKey {
  [key: string]: unknown;
  kty: string;
  use?: string;
  alg?: string;
  kid: string;
  n: string;
  e: string;
}

interface JwksResponse {
  status_code?: number;
  data?: {
    keys?: JwkKey[];
  };
  keys?: JwkKey[];
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  display_name?: string | null;
  email_verified?: boolean;
  tenant_id?: string;
  role?: string;
  jti?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUserProfile {
  uid: string;
  id: string;
  email: string;
  full_name: string;
  tenant_id?: string;
  role?: string;
}

export class AuthError extends Error {
  status = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

let cachedKeys: JwkKey[] | null = null;
let cachedAt = 0;

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function parseJwtPart<T>(part: string): T {
  try {
    return JSON.parse(base64UrlDecode(part).toString('utf8')) as T;
  } catch {
    throw new AuthError('Invalid token');
  }
}

async function fetchJwks(force = false): Promise<JwkKey[]> {
  const cached = cachedKeys;
  const freshEnough = cached && Date.now() - cachedAt < JWKS_CACHE_TTL_MS;
  if (!force && freshEnough) {
    return cached;
  }

  const response = await fetch(JWKS_URL);
  if (!response.ok) {
    throw new AuthError('Could not load auth keys');
  }

  const json = (await response.json()) as JwksResponse;
  const keys = json.data?.keys ?? json.keys ?? [];
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new AuthError('No auth keys available');
  }

  cachedKeys = keys;
  cachedAt = Date.now();
  return keys;
}

function audienceMatches(audience: JwtPayload['aud'], expected: string): boolean {
  if (Array.isArray(audience)) {
    return audience.includes(expected);
  }
  return audience === expected;
}

function validateAccessPayload(payload: JwtPayload): asserts payload is JwtPayload & { sub: string; email: string } {
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== ISSUER) {
    throw new AuthError('Invalid token issuer');
  }
  if (!audienceMatches(payload.aud, ACCESS_AUDIENCE)) {
    throw new AuthError('Invalid token audience');
  }
  if (payload.type !== ACCESS_TOKEN_TYPE) {
    throw new AuthError('Invalid token type');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new AuthError('Token expired');
  }
  if (!payload.sub || !payload.email) {
    throw new AuthError('Invalid token claims');
  }
}

async function getKeyForKid(kid: string): Promise<JwkKey> {
  let keys = await fetchJwks(false);
  let key = keys.find((candidate) => candidate.kid === kid);
  if (key) {
    return key;
  }

  keys = await fetchJwks(true);
  key = keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    throw new AuthError('Unknown token key');
  }
  return key;
}

export async function verifyAccessToken(token: string): Promise<{
  payload: JwtPayload;
  profile: AuthenticatedUserProfile;
}> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new AuthError('Invalid token');
  }

  const header = parseJwtPart<JwtHeader>(encodedHeader);
  if (header.alg !== ALGORITHM || !header.kid) {
    throw new AuthError('Invalid token header');
  }

  const key = await getKeyForKid(header.kid);
  if (key.kty !== 'RSA' || (key.alg && key.alg !== ALGORITHM)) {
    throw new AuthError('Unsupported auth key');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const publicKey = createPublicKey({ key, format: 'jwk' });
  const signature = base64UrlDecode(encodedSignature);
  if (!verifier.verify(publicKey, signature)) {
    throw new AuthError('Invalid token signature');
  }

  const payload = parseJwtPart<JwtPayload>(encodedPayload);
  validateAccessPayload(payload);

  const profile: AuthenticatedUserProfile = {
    uid: payload.sub,
    id: payload.sub,
    email: payload.email,
    full_name: payload.display_name || payload.email.split('@')[0],
    tenant_id: payload.tenant_id,
    role: payload.role,
  };

  return { payload, profile };
}

export function extractBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function extractTokenFromAuthResponse(body: unknown): string | null {
  return extractAuthTokensFromResponse(body)?.access_token ?? null;
}

export function extractAuthTokensFromResponse(body: unknown): {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
} | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const candidates: unknown[] = [body];
  const data = (body as Record<string, unknown>).data;
  if (data && typeof data === 'object') {
    candidates.push(data);
  }

  for (const candidate of candidates) {
    const accessToken = (candidate as Record<string, unknown>).access_token
      ?? (candidate as Record<string, unknown>).accessToken
      ?? (candidate as Record<string, unknown>).token;
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      const refreshToken = (candidate as Record<string, unknown>).refresh_token
        ?? (candidate as Record<string, unknown>).refreshToken;
      const tokenType = (candidate as Record<string, unknown>).token_type
        ?? (candidate as Record<string, unknown>).tokenType;
      return {
        access_token: accessToken,
        refresh_token: typeof refreshToken === 'string' ? refreshToken : undefined,
        token_type: typeof tokenType === 'string' ? tokenType : 'bearer',
      };
    }
  }

  return null;
}
