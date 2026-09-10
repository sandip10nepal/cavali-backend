/**
 * Environment Configuration — Centralized env loading & validation
 *
 * All environment variables are read here and exported as typed constants.
 * No other module should read process.env directly.
 */
import fs from 'fs';
import path from 'path';

// Load .env file if present (before accessing process.env)
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}

export type DatabaseMode = 'mongodb' | 'local';

export const env = {
  /** Server port */
  get PORT(): number {
    return Number(process.env.PORT) || 3000;
  },

  /** Node environment */
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },

  /** Is production? */
  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },

  /** Is development? */
  get isDevelopment(): boolean {
    return !this.isProduction;
  },

  /**
   * Database Mode:
   * - 'mongodb': Mandatory authoritative MongoDB Atlas database (enforced in production).
   * - 'local': Explicit opt-in local JSON database for offline development only (prohibited in production).
   */
  get DATABASE_MODE(): DatabaseMode {
    const rawMode = (process.env.DATABASE_MODE || '').trim().toLowerCase();
    const isProd = this.isProduction;

    if (isProd) {
      if (rawMode === 'local') {
        throw new Error('FATAL: DATABASE_MODE=local is strictly prohibited in production! Production must use MongoDB Atlas.');
      }
      return 'mongodb';
    }

    if (rawMode === 'local') {
      return 'local';
    }

    if (rawMode === 'mongodb') {
      return 'mongodb';
    }

    // In development without explicit DATABASE_MODE:
    if (process.env.MONGODB_URI) {
      return 'mongodb';
    }

    throw new Error(
      'FATAL: DATABASE_MODE must be explicitly configured. ' +
      'Set DATABASE_MODE=mongodb with MONGODB_URI, or explicitly set DATABASE_MODE=local for offline dev. ' +
      'Implicit local fallback is disabled.'
    );
  },

  get isMongoMode(): boolean {
    return this.DATABASE_MODE === 'mongodb';
  },

  get isLocalMode(): boolean {
    return this.DATABASE_MODE === 'local';
  },

  /** MongoDB Atlas connection URI */
  get MONGODB_URI(): string {
    const uri = (process.env.MONGODB_URI || '').trim();
    if (this.isMongoMode && !uri) {
      throw new Error('FATAL: MONGODB_URI is required when DATABASE_MODE=mongodb');
    }
    return uri;
  },

  /** JWT signing secret — MUST be set in production */
  get JWT_SECRET(): string {
    const secret = process.env.JWT_SECRET || '';
    if (this.isProduction && (!secret || secret === 'benzin-dev-secret-change-in-production')) {
      throw new Error('FATAL: A secure JWT_SECRET environment variable is mandatory in production.');
    }
    return secret || 'benzin-dev-secret-change-in-production';
  },

  /** JWT expiry for staff tokens (seconds) */
  get JWT_EXPIRY_SECONDS(): number {
    return Number(process.env.JWT_EXPIRY_SECONDS) || 24 * 60 * 60;
  },

  /** JWT expiry for device tokens (seconds) */
  get DEVICE_JWT_EXPIRY_SECONDS(): number {
    return Number(process.env.DEVICE_JWT_EXPIRY_SECONDS) || 365 * 24 * 60 * 60;
  },

  /** Square payment environment */
  get SQUARE_ENVIRONMENT(): string {
    return process.env.SQUARE_ENVIRONMENT || 'sandbox';
  },
  get SQUARE_ACCESS_TOKEN(): string {
    return process.env.SQUARE_ACCESS_TOKEN || '';
  },
  get SQUARE_LOCATION_ID(): string {
    return process.env.SQUARE_LOCATION_ID || '';
  },
};
