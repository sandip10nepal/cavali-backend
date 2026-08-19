/**
 * Tenant Middleware
 *
 * Extracts and validates tenant context from the JWT token on every request.
 * Attaches `req.tenant` (TenantContext) for use by all downstream routes.
 *
 * CRITICAL SECURITY: The restaurant_id is ALWAYS derived from the JWT —
 * never from client-supplied query params, headers, or body fields.
 */
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import type { TenantContext, UserRole } from '../models/types';

/* ─────────────── Extend Express Request ─────────────── */

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       AUTH / TENANT MIDDLEWARE                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Middleware that requires a valid JWT and populates `req.tenant`.
 * Returns 401 if no valid token is found.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Provide a Bearer token.' });
    return;
  }

  const token = authHeader.substring(7); // Strip "Bearer "
  const payload = AuthService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
    return;
  }

  const tenantCtx = AuthService.payloadToTenantContext(payload);

  // Check if device is revoked
  if (tenantCtx.device_id) {
    const { MultiTenantDbService } = require('../services/multi-tenant-db.service');
    const device = await MultiTenantDbService.getDevice(tenantCtx.device_id);
    if (device && device.status === 'REVOKED') {
      res.status(403).json({ success: false, error: 'Device has been revoked by management.' });
      return;
    }
  }

  // Check if user is locked or deactivated
  if (tenantCtx.user_id) {
    const { MultiTenantDbService } = require('../services/multi-tenant-db.service');
    const user = await MultiTenantDbService.getUser(tenantCtx.user_id);
    if (user) {
      if (user.active === false) {
        res.status(403).json({ success: false, error: 'User account has been deactivated.' });
        return;
      }
      if (MultiTenantDbService.isAccountLocked(user)) {
        res.status(423).json({ success: false, error: 'User account is temporarily locked due to failed login attempts.' });
        return;
      }
    }
  }

  req.tenant = tenantCtx;
  next();
}

/**
 * Middleware that optionally extracts tenant context (does not reject unauthenticated requests).
 * Useful for public endpoints that behave differently for authenticated users.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    if (payload) {
      req.tenant = AuthService.payloadToTenantContext(payload);
    }
  }

  next();
}

/**
 * Factory for middleware that checks a specific permission.
 *
 * Usage:
 *   router.post('/menu', requireAuth, requirePermission('menu:create'), handler);
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!AuthService.hasPermission(req.tenant.role, permission)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: your role '${req.tenant.role}' does not have permission '${permission}'.`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that restricts access to specific roles.
 *
 * Usage:
 *   router.delete('/staff/:id', requireAuth, requireRole('owner', 'platform_admin'), handler);
 */
export function requireRole(...roles: (UserRole | 'device')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.tenant.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: this endpoint requires one of the following roles: ${roles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that validates the restaurant_id in the URL matches the JWT context.
 * Prevents REST parameter injection attacks.
 *
 * Usage:
 *   router.get('/restaurants/:restaurantId/orders', requireAuth, validateTenantParam('restaurantId'), handler);
 */
export function validateTenantParam(paramName = 'restaurantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const paramValue = req.params[paramName];
    if (paramValue && paramValue !== req.tenant.restaurant_id) {
      // Platform admins can access any restaurant
      if (req.tenant.role === 'platform_admin') {
        next();
        return;
      }

      res.status(403).json({
        success: false,
        error: 'Access denied: you cannot access another restaurant\'s data.',
      });
      return;
    }

    next();
  };
}

/**
 * Universal Tenant Resolver:
 * Extracts restaurant ID from JWT, custom headers, query params, or body.
 * Returns null if no valid tenant context is found (guaranteeing tenant isolation).
 */
export async function resolveTenantRestaurantId(req: Request): Promise<string | null> {
  const { MultiTenantDbService } = require('../services/multi-tenant-db.service');

  // 1. Authenticated JWT Context
  if (req.tenant?.restaurant_id) return req.tenant.restaurant_id;

  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    if (payload?.rid) return payload.rid;
  }

  // 2. Custom Tenant Headers
  const headerId = req.headers?.['x-restaurant-id'] || req.headers?.['x-tenant-id'];
  if (headerId) {
    const rest = await MultiTenantDbService.getRestaurant(String(headerId));
    if (rest) return rest._id;
  }

  const headerCode = req.headers?.['x-restaurant-code'];
  if (headerCode) {
    const rest = await MultiTenantDbService.getRestaurantByCode(String(headerCode));
    if (rest) return rest._id;
  }

  // 3. Query Parameters
  const queryId = req.query?.restaurant_id as string;
  if (queryId) {
    const rest = await MultiTenantDbService.getRestaurant(queryId);
    if (rest) return rest._id;
  }

  const queryCode = (req.query?.restaurant_code || req.query?.code) as string;
  if (queryCode) {
    const rest = await MultiTenantDbService.getRestaurantByCode(queryCode);
    if (rest) return rest._id;
  }

  const querySlug = (req.query?.restaurant_slug || req.query?.slug) as string;
  if (querySlug) {
    const rest = await MultiTenantDbService.getRestaurantBySlug(querySlug);
    if (rest) return rest._id;
  }

  // 4. Request Body Parameters
  if (req.body) {
    if (req.body.restaurant_id) {
      const rest = await MultiTenantDbService.getRestaurant(String(req.body.restaurant_id));
      if (rest) return rest._id;
    }
    if (req.body.restaurant_code) {
      const rest = await MultiTenantDbService.getRestaurantByCode(String(req.body.restaurant_code));
      if (rest) return rest._id;
    }
    if (req.body.restaurant_slug) {
      const rest = await MultiTenantDbService.getRestaurantBySlug(String(req.body.restaurant_slug));
      if (rest) return rest._id;
    }
  }

  return null;
}

