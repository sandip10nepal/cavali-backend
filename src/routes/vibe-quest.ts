import { Router } from 'express';
import {
  requireAuth,
  requirePermission,
  resolveTenantRestaurantId,
} from '../middleware/tenant.middleware';
import { VibeQuestService } from '../modules/vibe-quest/vibe-quest.service';

const router = Router();

/* ── PUBLIC ENDPOINTS (CUSTOMER) ─────────────────────────────────────────── */

/**
 * GET /api/vibe-quest
 * Returns only the published configuration for the resolved tenant restaurant.
 */
router.get('/', async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    const config = await VibeQuestService.getPublishedConfig(restaurantId);
    return res.json({
      success: true,
      enabled: !!config,
      config: config || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/events
 * Record discovery analytics event (fire-and-forget).
 */
router.post('/events', async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    const { event_type, question_id, answer_id, product_id, session_id, metadata } = req.body;
    if (!event_type) {
      return res.status(400).json({ success: false, error: 'event_type is required' });
    }

    await VibeQuestService.recordEvent(restaurantId, {
      event_type,
      question_id,
      answer_id,
      product_id,
      session_id,
      metadata,
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ── ADMIN ENDPOINTS (AUTHENTICATED & TENANT-ISOLATED) ───────────────────── */

/**
 * GET /api/vibe-quest/admin/settings
 * Fetch complete settings including draft and published configs.
 */
router.get('/admin/settings', requireAuth, requirePermission('menu:read'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    // Verify tenant authorization match if non-platform_admin
    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const settings = await VibeQuestService.getSettings(restaurantId);
    return res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/vibe-quest/admin/draft
 * Update the draft configuration.
 */
router.put('/admin/draft', requireAuth, requirePermission('menu:update'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const { draft } = req.body;
    if (!draft || !Array.isArray(draft.questions)) {
      return res.status(400).json({ success: false, error: 'Valid draft with questions array required' });
    }

    await VibeQuestService.updateDraft(restaurantId, draft);
    return res.json({ success: true, message: 'Draft saved successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/admin/validate
 * Validate draft against live restaurant catalog.
 */
router.post('/admin/validate', requireAuth, requirePermission('menu:read'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const validation = await VibeQuestService.validateDraft(restaurantId);
    return res.json({ success: true, validation });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/admin/publish
 * Validate and publish draft configuration.
 */
router.post('/admin/publish', requireAuth, requirePermission('menu:update'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const result = await VibeQuestService.publishConfig(restaurantId);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed. Fix errors before publishing.',
        validation: result.validation,
      });
    }

    return res.json({
      success: true,
      version: result.version,
      validation: result.validation,
      message: 'Vibe Quest configuration published successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/admin/toggle
 * Enable or disable Vibe Quest for the restaurant.
 */
router.post('/admin/toggle', requireAuth, requirePermission('menu:update'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const { enabled } = req.body;
    await VibeQuestService.setEnabled(restaurantId, !!enabled);
    return res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vibe-quest/admin/analytics
 * Retrieve discovery event summary.
 */
router.get('/admin/analytics', requireAuth, requirePermission('menu:read'), async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, error: 'Tenant restaurant ID required' });
    }

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const summary = await VibeQuestService.getAnalyticsSummary(restaurantId);
    return res.json({ success: true, analytics: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
