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

export const env = {
  /** Server port */
  PORT: Number(process.env.PORT) || 3000,

  /** MongoDB Atlas connection URI */
  MONGODB_URI: process.env.MONGODB_URI || '',

  /** JWT signing secret — MUST be set in production */
  JWT_SECRET: process.env.JWT_SECRET || 'benzin-dev-secret-change-in-production',

  /** JWT expiry for staff tokens (seconds) */
  JWT_EXPIRY_SECONDS: Number(process.env.JWT_EXPIRY_SECONDS) || 24 * 60 * 60,

  /** JWT expiry for device tokens (seconds) */
  DEVICE_JWT_EXPIRY_SECONDS: Number(process.env.DEVICE_JWT_EXPIRY_SECONDS) || 365 * 24 * 60 * 60,

  /** Square payment environment */
  SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
  SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID || '',

  /** Node environment */
  NODE_ENV: process.env.NODE_ENV || 'development',

  /** Is production? */
  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },

  /** Is development? */
  get isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },
} as const;
