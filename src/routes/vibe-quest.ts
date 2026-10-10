import { Router } from 'express';
import {
  requireAuth,
  optionalAuth,
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
router.get('/admin/settings', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

    // Verify tenant authorization match if non-platform_admin
    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const settings = await VibeQuestService.getSettings(restaurantId);
    return res.json({
      success: true,
      settings,
      draft: settings?.draft || null,
      published: settings?.published || null,
      enabled: settings?.enabled ?? true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vibe-quest/admin/draft
 * Fetch the draft configuration directly.
 */
router.get('/admin/draft', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const settings = await VibeQuestService.getSettings(restaurantId);
    return res.json({
      success: true,
      settings,
      draft: settings?.draft || null,
      published: settings?.published || null,
      enabled: settings?.enabled ?? true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/vibe-quest/admin/draft
 * Update the draft configuration.
 */
router.put('/admin/draft', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const { draft, questions, settings } = req.body;
    const questionsToSave = questions || draft?.questions;
    if (!questionsToSave || !Array.isArray(questionsToSave)) {
      return res.status(400).json({ success: false, error: 'Valid questions array required' });
    }

    const result = await VibeQuestService.saveQuestions(restaurantId, questionsToSave, settings || draft?.settings);
    return res.json({ message: 'Questions saved and published successfully', ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/admin/save-questions
 * Save and publish question configuration directly.
 */
router.post('/admin/save-questions', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const { questions, settings } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'Valid questions array required' });
    }

    const result = await VibeQuestService.saveQuestions(restaurantId, questions, settings);
    return res.json({ message: 'Questions saved successfully', ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/vibe-quest/admin/validate
 * Validate draft against live restaurant catalog.
 */
router.post('/admin/validate', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

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
router.post('/admin/publish', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

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
      published_version: result.version,
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
router.post('/admin/toggle', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

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
router.get('/admin/analytics', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';

    if (req.tenant && req.tenant.role !== 'platform_admin' && req.tenant.restaurant_id !== restaurantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: cross-tenant access denied' });
    }

    const summary = await VibeQuestService.getAnalyticsSummary(restaurantId);
    return res.json({ success: true, analytics: summary, summary });
  } catch (err) {
    next(err);
  }
});

export default router;
