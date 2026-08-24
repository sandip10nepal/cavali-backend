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
    const { name, title, description, subtitle, icon, color, menu_type, sort_order, is_super, parent_id } = req.body;
    const catName = (name || title || '').trim();

    if (!catName) {
      res.status(400).json({ success: false, error: 'Missing required field: name' });
      return;
    }

    const category = await MultiTenantDbService.createMenuCategory({
      restaurant_id: req.tenant!.restaurant_id,
      name: catName,
      title: catName,
      description: description || subtitle || '',
      subtitle: subtitle || description || '',
      icon: icon || (is_super || parent_id === null ? '👑' : '📋'),
      color: color || '#6366F1',
      sort_order: sort_order ?? 0,
      menu_type: menu_type || (parent_id === null ? catName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'hookah'),
      is_super: is_super === true || is_super === 'true' || parent_id === null,
      parent_id: parent_id !== undefined ? parent_id : (is_super ? null : null),
      active: true,
    });

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_created',
      'menu_category',
      category._id,
      { name: catName, parent_id: category.parent_id }
    );

    res.status(201).json({ success: true, category });
  } catch (err: any) {
    console.error('[Menu] Create category error:', err);
    res.status(400).json({ success: false, error: err.message || 'Could not create category.' });
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

    const result = await MultiTenantDbService.deleteMenuCategory(id, restaurantId);

    if (!result.success) {
      if (result.conflict) {
        res.status(409).json({ success: false, error: result.message });
        return;
      }
      if (result.notFound) {
        res.status(404).json({ success: false, error: result.message || 'Category not found.' });
        return;
      }
      res.status(400).json({ success: false, error: result.message || 'Could not delete category.' });
      return;
    }

    await MultiTenantDbService.logAudit(
      req.tenant!.restaurant_id,
      req.tenant!.user_id || 'system',
      'Admin',
      'menu_item_deleted',
      'menu_category',
      id,
      { category_id: id }
    );

    res.status(200).json({ success: true, message: 'Category deleted.' });
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
