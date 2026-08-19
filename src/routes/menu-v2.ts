/**
 * Tenant-Aware Menu Routes (v2)
 *
 * All operations are scoped to the authenticated restaurant_id from the JWT.
 *
 * GET    /api/v2/menu/categories       — List categories for the restaurant
 * POST   /api/v2/menu/categories       — Create category
 * PATCH  /api/v2/menu/categories/:id   — Update category
 * DELETE /api/v2/menu/categories/:id   — Soft-delete category
 *
 * GET    /api/v2/menu/items            — List all items (optionally by category)
 * POST   /api/v2/menu/items            — Create item
 * PATCH  /api/v2/menu/items/:id        — Update item
 * DELETE /api/v2/menu/items/:id        — Delete item
 * PATCH  /api/v2/menu/items/:id/availability — Toggle availability
 */
import { Router } from 'express';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { requireAuth, requirePermission } from '../middleware/tenant.middleware';

const router = Router();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CATEGORIES                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

router.get('/categories', requireAuth, requirePermission('menu:read'), async (req, res) => {
  try {
    const categories = await MultiTenantDbService.listMenuCategories(req.tenant!.restaurant_id);
    res.status(200).json({ success: true, categories });
  } catch (err: any) {
    console.error('[Menu] List categories error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.post('/categories', requireAuth, requirePermission('menu:create'), async (req, res) => {
  try {
    const { title, subtitle, icon, color, menu_type, sort_order } = req.body;
    if (!title || !menu_type) {
      res.status(400).json({ success: false, error: 'Missing required fields: title, menu_type' });
      return;
    }

    const category = await MultiTenantDbService.createMenuCategory({
      restaurant_id: req.tenant!.restaurant_id,
      title,
      subtitle: subtitle || '',
      icon: icon || '📋',
      color: color || '#6366F1',
      sort_order: sort_order ?? 0,
      menu_type,
      active: true,
    });

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_created',
      'menu_category',
      category._id,
      { title, menu_type }
    );

    res.status(201).json({ success: true, category });
  } catch (err: any) {
    console.error('[Menu] Create category error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.patch('/categories/:id', requireAuth, requirePermission('menu:update'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const update = req.body;

    const updated = await MultiTenantDbService.updateMenuCategory(id, req.tenant!.restaurant_id, update);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Category not found.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Category updated.' });
  } catch (err: any) {
    console.error('[Menu] Update category error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.delete('/categories/:id', requireAuth, requirePermission('menu:delete'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const restaurantId = req.tenant!.restaurant_id;

    // Safety Check: verify if any menu items exist in this category
    const items = await MultiTenantDbService.listMenuItems(restaurantId);
    const catCategories = await MultiTenantDbService.listMenuCategories(restaurantId);
    const catObj = catCategories.find((c: any) => (c._id || c.id) === id);
    const catTitle = (catObj?.title || '').toLowerCase();

    const matchingItems = items.filter((i: any) => {
      const c = (i.category_id || i.category || '').toLowerCase();
      return c === id.toLowerCase() || (catTitle && c === catTitle);
    });

    if (matchingItems.length > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete category because it contains ${matchingItems.length} active menu item(s). Please delete or move the items first.`
      });
      return;
    }

    // Soft delete: set active = false
    const updated = await MultiTenantDbService.updateMenuCategory(id, restaurantId, { active: false });
    if (!updated) {
      res.status(404).json({ success: false, error: 'Category not found.' });
      return;
    }

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_deleted',
      'menu_category',
      id,
      {}
    );

    res.status(200).json({ success: true, message: 'Category deactivated.' });
  } catch (err: any) {
    console.error('[Menu] Delete category error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                            ITEMS                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

router.get('/items', requireAuth, requirePermission('menu:read'), async (req, res) => {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const items = await MultiTenantDbService.listMenuItems(req.tenant!.restaurant_id, categoryId);
    res.status(200).json({ success: true, items });
  } catch (err: any) {
    console.error('[Menu] List items error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.post('/items', requireAuth, requirePermission('menu:create'), async (req, res) => {
  try {
    const { category_id, name, price, desc, emoji, image_url, modifier_groups, sort_order } = req.body;
    if (!category_id || !name || price === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields: category_id, name, price' });
      return;
    }

    const item = await MultiTenantDbService.createMenuItem({
      restaurant_id: req.tenant!.restaurant_id,
      category_id,
      name,
      price: Number(price),
      desc: desc || '',
      emoji: emoji || '🍽',
      image_url: image_url || null,
      available: true,
      modifier_groups: modifier_groups || [],
      sort_order: sort_order ?? 0,
    });

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_created',
      'menu_item',
      item._id,
      { name, price, category_id }
    );

    res.status(201).json({ success: true, item });
  } catch (err: any) {
    console.error('[Menu] Create item error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.patch('/items/:id', requireAuth, requirePermission('menu:update'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const update = req.body;

    // Track price changes for audit
    if (update.price !== undefined) {
      const existing = await MultiTenantDbService.getMenuItem(id, req.tenant!.restaurant_id);
      if (existing && existing.price !== Number(update.price)) {
        await MultiTenantDbService.logAudit(
          req.tenant!.restaurant_id,
          req.tenant!.user_id || 'system',
          'Admin',
          'menu_price_changed',
          'menu_item',
          id,
          { old_price: existing.price, new_price: Number(update.price), name: existing.name }
        );
      }
    }

    const updated = await MultiTenantDbService.updateMenuItem(id, req.tenant!.restaurant_id, update);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Menu item not found.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Item updated.' });
  } catch (err: any) {
    console.error('[Menu] Update item error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.delete('/items/:id', requireAuth, requirePermission('menu:delete'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const deleted = await MultiTenantDbService.deleteMenuItem(id, req.tenant!.restaurant_id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Menu item not found.' });
      return;
    }

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_deleted',
      'menu_item',
      id,
      {}
    );

    res.status(200).json({ success: true, message: 'Item deleted.' });
  } catch (err: any) {
    console.error('[Menu] Delete item error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

router.patch('/items/:id/availability', requireAuth, requirePermission('menu:availability'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { available } = req.body;

    if (available === undefined) {
      res.status(400).json({ success: false, error: 'Missing required field: available' });
      return;
    }

    const updated = await MultiTenantDbService.setMenuItemAvailability(id, req.tenant!.restaurant_id, Boolean(available));
    if (!updated) {
      res.status(404).json({ success: false, error: 'Menu item not found.' });
      return;
    }

    res.status(200).json({ success: true, message: `Item ${available ? 'enabled' : 'marked as sold out'}.` });
  } catch (err: any) {
    console.error('[Menu] Availability error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
