import type { NextFunction, Request, Response } from 'express';
import { AuthError, extractBearerToken, type AuthenticatedUserProfile, verifyAccessToken } from '../auth/nervesparks.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserProfile;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.get('authorization'));
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const { profile } = await verifyAccessToken(token);
    req.user = profile;
    return next();
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return res.status(status).json({ error: message });
  }
}

export function requireAuthUnlessPublicCustomerDashboard(req: Request, res: Response, next: NextFunction) {
  const isPublicCustomerDashboard = req.method === 'GET' && /^\/[^/]+\/dashboard$/.test(req.path);
  if (isPublicCustomerDashboard) {
    return next();
  }
  return requireAuth(req, res, next);
}
