import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import ordersRouter from './routes/orders';
import paymentsRouter from './routes/payments';
import employeesRouter from './routes/employees';
import menuRouter, { preloadMenuCache } from './routes/menu';
import { SquareService } from './services/square.service';

// ── Multi-Tenant SaaS Imports ────────────────────────────────────────────
import authRouter from './routes/auth';
import restaurantsRouter from './routes/restaurants';
import devicesRouter from './routes/devices';
import menuV2Router from './routes/menu-v2';
import { MultiTenantDbService } from './services/multi-tenant-db.service';

import { env } from './config/env';

const app = express();
const PORT = env.PORT;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    API ROUTES                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */
app.use('/api/orders', ordersRouter);
app.use('/api/payment-sessions', paymentsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/menu', menuRouter);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                   MULTI-TENANT v2 ROUTES                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
app.use('/api/auth', authRouter);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/v2/menu', menuV2Router);

// Serve Admin Dashboard
const publicPath = path.resolve(process.cwd(), 'public');
const adminDistPath = path.resolve(publicPath, 'admin_dist');
const adminAssetsPath = path.resolve(adminDistPath, 'assets');

// Static asset mounts FIRST
app.use('/admin_dist', express.static(adminDistPath));
app.use(express.static(publicPath));

// Serve Admin Dashboard (Cavalli Admin & Staff Management Portal)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const isAdminHost = req.hostname && req.hostname.toLowerCase().startsWith('admin.');
  const isAdminPath = req.path === '/admin' || req.path.startsWith('/admin/') || req.path === '/staff' || req.path === '/admin.html';

  if (isAdminHost || isAdminPath) {
    return res.sendFile('admin.html', { root: publicPath });
  }
  next();
});

// Serve Standalone Dark Staff Clock-in Portal
app.get('/staff', (req, res) => {
  res.sendFile('admin.html', { root: publicPath });
});
app.get('/admin.html', (req, res) => {
  res.sendFile('admin.html', { root: publicPath });
});

// Serve iPhone Payment Device web app (supports both URLs)
app.get('/payment-device', (req, res) => {
  res.sendFile('payment-device.html', { root: publicPath });
});
app.get('/payment', (req, res) => {
  res.sendFile('payment-device.html', { root: publicPath });
});

// Liveness probe (indicates Node process is functioning)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    payment_mode: SquareService.isDemoMode ? 'DEMO' : SquareService.environment.toUpperCase(),
    database_mode: env.DATABASE_MODE,
    multi_tenant: MultiTenantDbService.isInitialized(),
    mongo_connected: MultiTenantDbService.isMongoConnected(),
  });
});

// Readiness probe (indicates whether service can safely receive traffic and access required authoritative database)
app.get('/ready', async (req, res) => {
  try {
    if (!MultiTenantDbService.isInitialized()) {
      return res.status(503).json({
        status: 'not_ready',
        error: 'Database service is initializing...',
      });
    }

    if (env.isMongoMode) {
      const isAlive = await MultiTenantDbService.pingDatabase();
      if (!isAlive) {
        return res.status(503).json({
          status: 'not_ready',
          database: 'mongodb',
          error: 'MongoDB Atlas ping failed or connection is unavailable',
        });
      }
      return res.status(200).json({
        status: 'ready',
        database: 'mongodb_atlas_authoritative',
        timestamp: new Date().toISOString(),
      });
    }

    // Local mode (development only)
    return res.status(200).json({
      status: 'ready',
      database: 'local_json_dev_mode',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'not_ready',
      error: err.message || 'Readiness check failed',
    });
  }
});

// Serve static assets
app.use(express.static(publicPath));

// SPA Catch-All fallback middleware for Expo Web App dynamic NFC routes (e.g. /4821/5 or /cavali/12)
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/ready') {
    return next();
  }
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile('index.html', { root: publicPath });
  }
  next();
});

import { errorMiddleware } from './middleware/error.middleware';
import { ensureDatabaseIndexes } from './database/indexes';

// Register centralized error middleware
app.use(errorMiddleware);

// Listen on PORT immediately for Cloud Run container startup health check
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Restaurant SaaS Platform running on http://localhost:${PORT}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Legacy API:     /api/orders, /api/menu, /api/employees`);
  console.log(`  Auth API:       /api/auth/login, /api/auth/device`);
  console.log(`  Restaurants:    /api/restaurants`);
  console.log(`  Menu v2:        /api/v2/menu/categories, /api/v2/menu/items`);
  console.log(`  Admin:          http://localhost:${PORT}/admin`);
  console.log(`  Payment Device: http://localhost:${PORT}/payment-device`);
  console.log(`  Payment mode:   ${SquareService.isDemoMode ? '⚠️  DEMO MODE' : `✅ ${SquareService.environment.toUpperCase()}`}`);
  console.log(`${'═'.repeat(60)}\n`);
});

// Initialize database asynchronously in background with self-healing retry loop
(async function initDbLoop() {
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await MultiTenantDbService.initialize();
      await ensureDatabaseIndexes();
      console.log('🏢 Multi-tenant SaaS platform database ready');
      preloadMenuCache().catch(e => console.warn('Preload cache error:', e));
      return;
    } catch (err: any) {
      console.error(`[Database] Attempt ${attempt}/${maxAttempts} failed:`, err.message || err);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error('🚨 FATAL: Exhausted database initialization retries.');
      }
    }
  }
})();
