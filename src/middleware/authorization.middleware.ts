/**
 * Authorization Middleware — Role-Based Access Control (RBAC) & Permission Enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../core/errors';

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: [
    'orders.read', 'orders.create', 'orders.update', 'orders.cancel', 'orders.void', 'orders.fulfill',
    'menu.read', 'menu.create', 'menu.update', 'menu.delete',
    'inventory.read', 'inventory.adjust', 'inventory.manage',
    'employees.read', 'employees.manage',
    'payments.read', 'payments.process', 'payments.refund',
    'devices.read', 'devices.manage',
    'settings.read', 'settings.manage',
    'reports.read',
  ],
  server: [
    'orders.read', 'orders.create', 'orders.update',
    'service_requests.read', 'service_requests.create', 'service_requests.update',
  ],
  bartender: [
    'orders.read', 'orders.fulfill_drinks', 'orders.update',
    'inventory.read',
  ],
  chef: [
    'orders.read', 'orders.fulfill_food', 'orders.update',
    'inventory.read',
  ],
  hookah_maker: [
    'orders.read', 'orders.fulfill_hookah', 'orders.update',
    'inventory.read',
  ],
};

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.context?.user || (req as any).user;
    const role = (user?.role || req.headers['x-user-role'] || 'server').toString().toLowerCase();

    const allowedPermissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['server'];

    if (allowedPermissions.includes('*') || allowedPermissions.includes(permission)) {
      return next();
    }

    throw new ForbiddenError(`Forbidden: Role '${role}' lacks permission '${permission}'`);
  };
}
