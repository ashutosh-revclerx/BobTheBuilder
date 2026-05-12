import { Router } from 'express';
import {
  AUTH_BASE_URL,
  AuthError,
  extractAuthTokensFromResponse,
  extractBearerToken,
  extractTokenFromAuthResponse,
  verifyAccessToken,
} from '../auth/nervesparks.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const AUTH_API_BASE = `${AUTH_BASE_URL}/api/v1/auth`;

async function proxyAuthRequest(path: 'login' | 'register' | 'refresh' | 'logout', reqBody: unknown, authorization?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(`${AUTH_API_BASE}/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reqBody ?? {}),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text || response.statusText };
  }

  if (response.ok) {
    const accessToken = extractTokenFromAuthResponse(json);
    if (accessToken) {
      await verifyAccessToken(accessToken);
    }
  }

  return { response, json };
}

function sendProxyResponse(res: import('express').Response, status: number, body: unknown) {
  return res.status(status).json(body);
}

for (const path of ['login', 'register', 'refresh', 'logout'] as const) {
  router.post(`/${path}`, async (req, res, next) => {
    try {
      const { response, json } = await proxyAuthRequest(path, req.body, req.get('authorization'));
      if (response.ok && path !== 'logout') {
        const tokens = extractAuthTokensFromResponse(json);
        if (!tokens) {
          return res.status(502).json({ error: 'Auth provider did not return an access token' });
        }
        const { profile } = await verifyAccessToken(tokens.access_token);
        return sendProxyResponse(res, response.status, {
          ...tokens,
          user: profile,
        });
      }
      return sendProxyResponse(res, response.status, json);
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      return next(err);
    }
  });
}

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.post('/me', async (req, res) => {
  const token = extractBearerToken(req.get('authorization'));
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const { profile } = await verifyAccessToken(token);
    return res.json({ user: profile });
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return res.status(status).json({ error: message });
  }
});

export default router;
