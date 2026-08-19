/**
 * Request Context — Per-request Container for Tenant, User, and Traceability Metadata
 */

export interface RequestUser {
  id: string;
  restaurant_id: string;
  name: string;
  email?: string | null;
  role: string;
  permissions: string[];
}

export interface RequestContext {
  requestId: string;
  tenantId: string;
  user?: RequestUser | null;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}
