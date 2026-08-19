/**
 * Authentication & Authorization Service
 *
 * Handles JWT generation/verification, PIN hashing, and role-based
 * permission checks for the multi-tenant platform.
 */
import crypto from 'crypto';
import type { UserRole, TenantContext } from '../models/types';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          JWT IMPLEMENTATION                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

// Simple, dependency-free JWT implementation using HMAC-SHA256.
// For production, consider using 'jsonwebtoken' package.

const JWT_SECRET = process.env.JWT_SECRET || 'cavali-saas-dev-secret-change-in-production';
const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
const DEVICE_JWT_EXPIRY_SECONDS = 365 * 24 * 60 * 60; // 1 year for devices

interface JwtPayload {
  sub: string;                  // user_id or device_id
  rid: string;                  // restaurant_id
  role: UserRole | 'device';
  did?: string;                 // device_id (for device tokens)
  tid?: string;                 // table_id (for device tokens)
  rname: string;                // restaurant name
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

export class AuthService {

  /* ─────────────── JWT Generation ─────────────── */

  static generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expirySeconds?: number): string {
    const expiry = expirySeconds ?? JWT_EXPIRY_SECONDS;
    const now = Math.floor(Date.now() / 1000);

    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiry,
    };

    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  /**
   * Generate a JWT for staff login (owner, manager, cashier, kitchen).
   */
  static generateStaffToken(
    userId: string,
    restaurantId: string,
    role: UserRole,
    restaurantName: string
  ): string {
    return this.generateToken({
      sub: userId,
      rid: restaurantId,
      role,
      rname: restaurantName,
    });
  }

  /**
   * Generate a long-lived JWT for paired devices.
   */
  static generateDeviceToken(
    deviceId: string,
    restaurantId: string,
    tableId: string,
    restaurantName: string
  ): string {
    return this.generateToken(
      {
        sub: deviceId,
        rid: restaurantId,
        role: 'device',
        did: deviceId,
        tid: tableId,
        rname: restaurantName,
      },
      DEVICE_JWT_EXPIRY_SECONDS
    );
  }

  /* ─────────────── JWT Verification ─────────────── */

  static verifyToken(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        console.warn('[Auth] JWT signature mismatch');
        return null;
      }

      // Decode payload
      const payload: JwtPayload = JSON.parse(base64UrlDecode(body));

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.warn('[Auth] JWT expired');
        return null;
      }

      return payload;
    } catch (err) {
      console.error('[Auth] JWT verification error:', err);
      return null;
    }
  }

  /**
   * Extract a TenantContext from a verified JWT payload.
   */
  static payloadToTenantContext(payload: JwtPayload): TenantContext {
    return {
      restaurant_id: payload.rid,
      user_id: payload.role === 'device' ? null : payload.sub,
      device_id: payload.did || null,
      table_id: payload.tid || null,
      role: payload.role,
      restaurant_name: payload.rname,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                          PIN HASHING                                       */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Hash a PIN using PBKDF2 (no bcrypt dependency needed).
   */
  static hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify a PIN against its stored hash.
   */
  /**
   * Verify a PIN against its stored hash.
   */
  static verifyPin(pin: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const candidateHash = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidateHash, 'hex'));
  }

  /**
   * Parse 8-digit or formatted floor code (RRRR-EEEE)
   */
  static parseFloorCode(input: string): { restaurantCode: string; pin: string } | null {
    if (!input) return null;
    const clean = input.trim();

    // Check for delimiter format: "4821-7394" or "4821 7394" or "4821:7394"
    const matchDelim = clean.match(/^([0-9a-zA-Z_-]+)[-\s:]([0-9]{4,6})$/);
    if (matchDelim) {
      return { restaurantCode: matchDelim[1], pin: matchDelim[2] };
    }

    // Check for 8-digit continuous number: "48217394"
    if (/^[0-9]{8}$/.test(clean)) {
      return { restaurantCode: clean.slice(0, 4), pin: clean.slice(4) };
    }

    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*                     ROLE-BASED PERMISSIONS                                 */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Permission matrix: what each role can do.
   *
   * Key: resource:action
   * Value: array of roles allowed
   */
  private static readonly PERMISSIONS: Record<string, (UserRole | 'device')[]> = {
    // Restaurant management
    'restaurant:read':          ['platform_admin', 'owner', 'manager'],
    'restaurant:update':        ['platform_admin', 'owner'],
    'restaurant:create':        ['platform_admin'],

    // Staff management (Manager/Owner only)
    'staff:read':               ['platform_admin', 'owner', 'manager'],
    'staff:create':             ['platform_admin', 'owner', 'manager'],
    'staff:update':             ['platform_admin', 'owner', 'manager'],
    'staff:delete':             ['platform_admin', 'owner'],

    // Timecards & Shifts (Clock In / Clock Out)
    'timecards:read':           ['platform_admin', 'owner', 'manager'],
    'timecards:clock':          ['platform_admin', 'owner', 'manager', 'cashier', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker', 'device'],
    'timecards:manage':         ['platform_admin', 'owner', 'manager'],

    // Menu management (Read for order taking; modify/availability strictly Manager/Owner)
    'menu:read':                ['platform_admin', 'owner', 'manager', 'cashier', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker', 'device'],
    'menu:create':              ['platform_admin', 'owner', 'manager'],
    'menu:update':              ['platform_admin', 'owner', 'manager'],
    'menu:delete':              ['platform_admin', 'owner', 'manager'],
    'menu:availability':        ['platform_admin', 'owner', 'manager'],

    // Orders
    'order:read':               ['platform_admin', 'owner', 'manager', 'cashier', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker', 'device'],
    'order:create':             ['platform_admin', 'owner', 'manager', 'cashier', 'server', 'device'],
    'order:update_status':      ['platform_admin', 'owner', 'manager', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker'],
    'order:cancel':             ['platform_admin', 'owner', 'manager'],
    'order:refund':             ['platform_admin', 'owner', 'manager'],

    // Inventory (Strictly Manager/Owner only)
    'inventory:read':           ['platform_admin', 'owner', 'manager'],
    'inventory:update':         ['platform_admin', 'owner', 'manager'],
    'inventory:ledger':         ['platform_admin', 'owner', 'manager'],

    // Sales & Analytics (Strictly Manager/Owner only)
    'sales:read':               ['platform_admin', 'owner', 'manager'],

    // Payments
    'payment:read':             ['platform_admin', 'owner', 'manager'],
    'payment:create':           ['platform_admin', 'owner', 'manager', 'cashier', 'server', 'device'],

    // Credits / Debt (Strictly Manager/Owner only)
    'credits:read':             ['platform_admin', 'owner', 'manager'],
    'credits:create':           ['platform_admin', 'owner', 'manager'],

    // Audit logs
    'audit:read':               ['platform_admin', 'owner'],

    // Devices & Provisioning
    'device:read':              ['platform_admin', 'owner', 'manager'],
    'device:create':            ['platform_admin', 'owner', 'manager'],
    'device:manage':            ['platform_admin', 'owner', 'manager'],
    'device:delete':            ['platform_admin', 'owner', 'manager'],
    'table:read':               ['platform_admin', 'owner', 'manager', 'cashier', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker', 'device'],
    'table:create':             ['platform_admin', 'owner', 'manager'],
    'table:update':             ['platform_admin', 'owner', 'manager'],

    // Customer session
    'session:create':           ['device'],
    'session:end':              ['device', 'owner', 'manager', 'server'],

    // Public config (no auth needed, but listed for documentation)
    'config:read':              ['platform_admin', 'owner', 'manager', 'cashier', 'kitchen', 'server', 'chef', 'bartender', 'hookah_maker', 'device'],
  };

  /**
   * Check if a role has a specific permission.
   */
  static hasPermission(role: UserRole | 'device', permission: string): boolean {
    const allowed = this.PERMISSIONS[permission];
    if (!allowed) {
      console.warn(`[Auth] Unknown permission: ${permission}`);
      return false;
    }
    return allowed.includes(role);
  }

  /**
   * Assert a permission — throws if denied.
   */
  static assertPermission(role: UserRole | 'device', permission: string): void {
    if (!this.hasPermission(role, permission)) {
      const err: any = new Error(`Forbidden: role '${role}' lacks permission '${permission}'`);
      err.statusCode = 403;
      throw err;
    }
  }
}
