/**
 * Request ID Middleware — Attaches unique X-Request-ID trace header to all HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'] as string;
  const requestId = existingId || `req_${Date.now()}_${randomUUID().substring(0, 8)}`;

  req.context = {
    ...(req.context || {}),
    requestId,
    tenantId: (req.context?.tenantId || req.headers['x-restaurant-id'] || '') as string,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
    userAgent: req.headers['user-agent'] || null,
  };

  res.setHeader('X-Request-ID', requestId);
  next();
}
