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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
const publicPath = path.join(__dirname, '../public');

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: publicPath });
});

// Serve iPhone Payment Device web app (supports both URLs)
app.get('/payment-device', (req, res) => {
  res.sendFile('payment-device.html', { root: publicPath });
});
app.get('/payment', (req, res) => {
  res.sendFile('payment-device.html', { root: publicPath });
});

app.use(express.static(publicPath));

// SPA Wildcard fallback for Expo Web App dynamic NFC routes (e.g. /4821/5 or /cavali/12)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/ready') {
    return next();
  }
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile('index.html', { root: publicPath });
  }
  next();
});

// Liveness probe
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    payment_mode: SquareService.isDemoMode ? 'DEMO' : SquareService.environment.toUpperCase(),
    multi_tenant: MultiTenantDbService.isInitialized(),
    mongo_connected: MultiTenantDbService.isMongoConnected(),
  });
});

// Readiness probe
app.get('/ready', (req, res) => {
  if (MultiTenantDbService.isInitialized()) {
    res.status(200).json({
      status: 'ready',
      database: MultiTenantDbService.isMongoConnected() ? 'mongodb_atlas_authoritative' : 'local_cached_fallback',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      error: 'Database service is initializing...',
    });
  }
});

import { errorMiddleware } from './middleware/error.middleware';
import { ensureDatabaseIndexes } from './database/indexes';

async function startServer() {
  // Initialize multi-tenant database (sole authoritative database)
  try {
    await MultiTenantDbService.initialize();
    await ensureDatabaseIndexes();
    console.log('🏢 Multi-tenant SaaS platform initialized');
    preloadMenuCache().catch(e => console.warn('Preload cache error:', e));
  } catch (err) {
    console.warn('⚠️  Multi-tenant DB initialization failed:', err);
  }

  // Register centralized error middleware
  app.use(errorMiddleware);

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
}

startServer().catch(err => {
  console.error('Failed to start backend server:', err);
});
