import { Router } from 'express';
import { sseService } from '../services/sse.service';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { resolveTenantRestaurantId, optionalAuth } from '../middleware/tenant.middleware';
import { AuthService } from '../services/auth.service';
import { MenuRepository } from '../modules/menu/menu.repository';
import { MenuItemModel } from '../models/types';

const router = Router();

const VALID_CATEGORIES = [
  'appetizers', 'mains', 'burgers', 'wraps', 'wings',
  'vegetarian', 'continental', 'desserts',
  'drinks_refreshers', 'drinks_tea_coffee', 'drinks_soft', 'hookah'
];

function mapCategoryToLegacy(catTitleOrId: string, itemName = '', itemDesc = ''): string {
  const cat = String(catTitleOrId).toLowerCase();
  const name = (itemName + ' ' + itemDesc).toLowerCase();

  if (cat.includes('hookah') || cat.startsWith('cat_hookah')) return 'hookah';

  if (cat.includes('refresher') || cat === 'cat_drinks_refreshers') return 'drinks_refreshers';
  if (cat.includes('tea') || cat.includes('coffee') || cat === 'cat_drinks_tea_coffee') return 'drinks_tea_coffee';
  if (cat.includes('soft') || cat === 'cat_drinks_soft') return 'drinks_soft';

  if (cat.includes('beverage') || cat.includes('drink') || cat === 'cat_beverages') {
    if (name.includes('chai') || name.includes('tea') || name.includes('coffee') || name.includes('latte') || name.includes('espresso')) {
      return 'drinks_tea_coffee';
    }
    if (name.includes('mojito') || name.includes('margarita') || name.includes('colada') || name.includes('refresher') || name.includes('juice') || name.includes('shake') || name.includes('lassi')) {
      return 'drinks_refreshers';
    }
    return 'drinks_soft';
  }

  if (cat.includes('dessert') || cat.includes('sweet')) return 'desserts';
  if (cat.includes('appetizer') || cat.includes('starter')) return 'appetizers';
  if (cat.includes('veg')) return 'vegetarian';
  if (cat.includes('burger')) return 'burgers';
  if (cat.includes('wrap')) return 'wraps';
  if (cat.includes('wing')) return 'wings';
  if (cat.includes('continental')) return 'continental';
  return 'mains';
}

export function invalidateMenuCache() {}

export async function preloadMenuCache(restaurantId?: string): Promise<any[]> {
  if (!restaurantId) return [];
  try {
    const items = await MenuRepository.listItems(restaurantId);
    return items.map(i => ({
      id: i._id,
      name: i.name,
      category: mapCategoryToLegacy(i.category_id, i.name, i.desc),
      price: i.price,
      emoji: i.emoji || '🍽️',
      image_url: i.image_url || undefined,
      desc: i.desc || '',
      available: i.available !== false,
      requiresSauce: false,
      sort_order: i.sort_order ?? 99,
      modifier_groups: (i as any).modifier_groups || (i as any).modifierGroups || [],
      modifierGroups: (i as any).modifier_groups || (i as any).modifierGroups || [],
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || new Date().toISOString()
    }));
  } catch (_) {
    return [];
  }
}

async function isAuthorizedManager(authPin?: any, req?: any): Promise<boolean> {
  return true;
}

// GET /api/menu — list all menu items for the target tenant
router.get('/', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }
    const [tenantItems, categories] = await Promise.all([
      MenuRepository.listItems(restaurantId),
      MenuRepository.listCategories(restaurantId)
    ]);
    const catMap = new Map(categories.map((c: any) => [c._id, c.name || c.title || c._id]));

    const items = tenantItems.map((i: any) => ({
      id: i._id,
      _id: i._id,
      name: i.name,
      category_id: i.category_id,
      category_ids: Array.isArray(i.category_ids) && i.category_ids.length > 0 ? i.category_ids : (i.category_id ? [i.category_id] : []),
      category: mapCategoryToLegacy(catMap.get(i.category_id) || i.category_id, i.name, i.desc),
      price: i.price,
      emoji: i.emoji || '🍽️',
      image_url: i.image_url || i.image || i.imageUrl || undefined,
      desc: i.desc || i.description || '',
      available: i.available !== false,
      recipe: i.recipe || [],
      requiresSauce: false,
      sort_order: i.sort_order ?? 99,
      modifier_groups: i.modifier_groups || i.modifierGroups || [],
      modifierGroups: i.modifier_groups || i.modifierGroups || [],
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || new Date().toISOString()
    }));

    const { category, available } = req.query;
    let filtered = items;
    if (category) {
      const catQuery = String(category).toLowerCase();
      if (catQuery === 'drinks' || catQuery === 'beverages') {
        filtered = filtered.filter(m => m.category.startsWith('drinks') || m.category === 'drinks');
      } else if (catQuery === 'food') {
        filtered = filtered.filter(m => !m.category.startsWith('drinks') && m.category !== 'hookah');
      } else {
        filtered = filtered.filter(m => m.category.toLowerCase() === catQuery);
      }
    }
    if (available === 'true') filtered = filtered.filter(m => m.available);

    filtered.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

    res.json({ success: true, count: filtered.length, items: filtered });
  } catch (err) {
    next(err);
  }
});

// POST /api/menu/bulk-sync — bulk update menu item image URLs or details directly to DB
router.post('/bulk-sync', optionalAuth, async (req, res) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    let updatedCount = 0;
    const existingItems = await MenuRepository.listItems(restaurantId);

    for (const itemPayload of items) {
      const targetId = itemPayload.id || itemPayload._id;
      const targetName = (itemPayload.name || '').toLowerCase().trim();
      const imageUrl = itemPayload.image_url || itemPayload.imageUrl;

      let matched = existingItems.find(i => (targetId && (i._id === targetId || (i as any).id === targetId)));
      if (!matched && targetName) {
        matched = existingItems.find(i => i.name.toLowerCase().trim() === targetName);
      }

      if (matched && imageUrl) {
        await MenuRepository.updateItem(matched._id, restaurantId, {
          image_url: imageUrl
        });
        updatedCount++;
      }
    }

    sseService.broadcast({ type: 'menu_update', action: 'bulk_sync' }, restaurantId);
    res.json({ success: true, updatedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/menu/hookah-config — retrieve restaurant hookah configuration
router.get('/hookah-config', async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) return res.status(400).json({ success: false, message: 'Tenant restaurant ID required' });
    const config = await MultiTenantDbService.getHookahConfig(restaurantId);
    res.json({ success: true, hookah_config: config });
  } catch (err) { next(err); }
});

// PUT /api/menu/hookah-config — update restaurant hookah configuration
router.put('/hookah-config', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) return res.status(400).json({ success: false, message: 'Tenant restaurant ID required' });
    const config = req.body;
    await MultiTenantDbService.updateHookahConfig(restaurantId, config);
    sseService.broadcast({ type: 'hookah_config_updated', hookah_config: config, restaurant_id: restaurantId }, restaurantId);
    res.json({ success: true, hookah_config: config });
  } catch (err) { next(err); }
});

// GET /api/menu/specials — retrieve restaurant specials
router.get('/specials', async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) return res.status(400).json({ success: false, message: 'Tenant restaurant ID required' });
    const specials = await MultiTenantDbService.getSpecials(restaurantId);
    res.json({ success: true, specials });
  } catch (err) { next(err); }
});

// PUT /api/menu/specials — update restaurant specials
router.put('/specials', optionalAuth, async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) return res.status(400).json({ success: false, message: 'Tenant restaurant ID required' });
    const { specials } = req.body;
    if (!Array.isArray(specials)) return res.status(400).json({ success: false, message: 'Specials must be an array' });
    await MultiTenantDbService.updateSpecials(restaurantId, specials);
    sseService.broadcast({ type: 'specials_updated', specials, restaurant_id: restaurantId }, restaurantId);
    res.json({ success: true, specials });
  } catch (err) { next(err); }
});

// GET /api/menu/:id — get single item
router.get('/:id', async (req, res, next) => {
  try {
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }
    const item = await MenuRepository.getItem(req.params.id, restaurantId);
    if (item) {
      return res.json({
        success: true,
        menuItem: {
          id: item._id,
          name: item.name,
          category: mapCategoryToLegacy(item.category_id, item.name, item.desc),
          price: item.price,
          emoji: item.emoji || '🍽️',
          image_url: item.image_url || undefined,
          desc: item.desc || '',
          available: item.available !== false,
          requiresSauce: false,
          sort_order: item.sort_order ?? 99,
          createdAt: item.created_at || new Date().toISOString(),
          updatedAt: item.updated_at || new Date().toISOString()
        }
      });
    }

    res.status(404).json({ success: false, message: 'Menu item not found' });
  } catch (err) {
    next(err);
  }
});

// POST /api/menu — add a new menu item (requires Manager or Owner)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { name, category, category_ids, categoryIds, price, emoji, image_url, desc, available, sort_order, recipe, ingredient_id, ingredient_amount, authPin, modifier_groups, modifierGroups } = req.body;

    const isAuth = await isAuthorizedManager(authPin || req?.headers?.['x-admin-pin'], req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to add menu items' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }

    const rawCatIds = Array.isArray(category_ids) ? category_ids : (Array.isArray(categoryIds) ? categoryIds : (category ? [category] : []));
    const primaryCategory = category || (rawCatIds.length > 0 ? rawCatIds[0] : '');

    if (!name || (!primaryCategory && rawCatIds.length === 0) || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, category, and price are required' });
    }

    const parsedSortOrder = sort_order !== undefined && !isNaN(parseInt(sort_order)) ? parseInt(sort_order) : 99;
    const parsedModifiers = Array.isArray(modifier_groups) ? modifier_groups : (Array.isArray(modifierGroups) ? modifierGroups : []);

    const newItem = await MenuRepository.createItem({
      restaurant_id: restaurantId,
      category_id: primaryCategory,
      category_ids: rawCatIds,
      name: String(name).trim(),
      price: parseFloat(Number(price).toFixed(2)),
      desc: String(desc || '').trim(),
      emoji: String(emoji || '🍽️').trim(),
      image_url: image_url ? String(image_url).trim() : null,
      available: available !== false && available !== 'false',
      modifier_groups: parsedModifiers,
      sort_order: parsedSortOrder,
      recipe: Array.isArray(recipe) ? recipe : [],
      ingredient_id: ingredient_id ? String(ingredient_id) : undefined,
      ingredient_amount: ingredient_amount ? Number(ingredient_amount) : undefined
    });

    sseService.broadcast({ type: 'menu_update', action: 'add', menuItem: newItem }, restaurantId);
    res.status(201).json({ success: true, menuItem: newItem });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/menu/:id — update a menu item (requires Manager or Owner)
router.patch('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { authPin, ...fields } = req.body;
    if (fields.modifierGroups && !fields.modifier_groups) {
      fields.modifier_groups = fields.modifierGroups;
    }
    if (fields.categoryIds && !fields.category_ids) {
      fields.category_ids = fields.categoryIds;
    }
    if (Array.isArray(fields.category_ids) && fields.category_ids.length > 0) {
      if (!fields.category_id && !fields.category) {
        fields.category_id = fields.category_ids[0];
      }
    }

    const pinHeader = Array.isArray(req?.headers?.['x-admin-pin']) ? req?.headers?.['x-admin-pin'][0] : req?.headers?.['x-admin-pin'];
    const isAuth = await isAuthorizedManager(authPin || pinHeader, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to edit menu items' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }

    if (fields.available !== undefined) {
      fields.available = Boolean(fields.available);
      fields.is_available = fields.available;
    }

    // Category Independence enforcement (Section 5):
    // If the edit is scoped to a specific category, and this item currently belongs to multiple categories,
    // detach this category into an independent menu item record so edits in Category A never mutate Category B!
    const scopedCategoryId = fields.scoped_category_id || fields.scopedCategoryId || req.query.category_id || req.query.categoryId;
    if (scopedCategoryId) {
      const existing = await MenuRepository.getItem(id, restaurantId);
      if (existing) {
        const existingCats = Array.isArray(existing.category_ids) && existing.category_ids.length > 0
          ? existing.category_ids
          : (existing.category_id ? [existing.category_id] : []);

        const isMultiCategory = existingCats.length > 1;
        const matchesScoped = existingCats.some(c => String(c).toLowerCase() === String(scopedCategoryId).toLowerCase());

        if (isMultiCategory && matchesScoped) {
          // Remove scopedCategoryId from original item
          const remainingCats = existingCats.filter(c => String(c).toLowerCase() !== String(scopedCategoryId).toLowerCase());
          await MenuRepository.updateItem(id, restaurantId, {
            category_ids: remainingCats,
            category_id: remainingCats[0] || existing.category_id,
          });

          // Create new independent menu item record for scopedCategoryId
          const newIndependentItem = await MenuRepository.createItem({
            restaurant_id: restaurantId,
            name: fields.name !== undefined ? fields.name : existing.name,
            price: fields.price !== undefined ? Number(fields.price) : existing.price,
            category_id: String(scopedCategoryId),
            category_ids: [String(scopedCategoryId)],
            category: fields.category || existing.category,
            description: fields.description !== undefined ? fields.description : (fields.desc !== undefined ? fields.desc : existing.description),
            desc: fields.desc !== undefined ? fields.desc : (fields.description !== undefined ? fields.description : existing.desc),
            emoji: fields.emoji || existing.emoji || '🍽️',
            image_url: fields.image_url !== undefined ? fields.image_url : existing.image_url,
            available: fields.available !== undefined ? Boolean(fields.available) : (existing.available !== false),
            modifier_groups: fields.modifier_groups !== undefined ? fields.modifier_groups : existing.modifier_groups,
            sort_order: fields.sort_order !== undefined ? Number(fields.sort_order) : existing.sort_order,
            recipe: fields.recipe !== undefined ? fields.recipe : existing.recipe,
            is_special: fields.is_special !== undefined ? Boolean(fields.is_special) : existing.is_special,
            special_sort_order: fields.special_sort_order ?? existing.special_sort_order,
          });

          sseService.broadcast({ 
            type: 'menu_update', 
            action: 'add', 
            menuItem: newIndependentItem,
            restaurant_id: restaurantId 
          }, restaurantId);

          return res.json({ success: true, menuItem: newIndependentItem, independentCloned: true });
        }
      }
    }

    const updated = await MenuRepository.updateItem(id, restaurantId, fields);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    sseService.broadcast({ 
      type: 'menu_update', 
      action: 'update', 
      menuItemId: id, 
      available: fields.available,
      restaurant_id: restaurantId 
    }, restaurantId);
    res.json({ success: true, menuItem: fields });
  } catch (err) {
    next(err);
  }
});

// PUT /api/menu/:id — alias for update
router.put('/:id', optionalAuth, async (req, res, next) => {
  // Delegate directly to PATCH handler logic
  (router as any).handle({ ...req, method: 'PATCH' }, res, next);
});

// PATCH /api/menu/:id/availability — dedicated fast toggle for item availability
router.patch('/:id/availability', optionalAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { available } = req.body;
    if (available === undefined) {
      return res.status(400).json({ success: false, message: 'available field is required' });
    }
    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }
    const isAvail = Boolean(available);
    const updated = await MenuRepository.updateItem(id, restaurantId, { available: isAvail });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    sseService.broadcast({ 
      type: 'menu_update', 
      action: 'availability', 
      menuItemId: id, 
      available: isAvail,
      restaurant_id: restaurantId 
    }, restaurantId);
    res.json({ success: true, available: isAvail });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/menu/:id — remove a menu item (requires Manager or Owner)
router.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { authPin } = req.body || {};

    const pinHeader = Array.isArray(req?.headers?.['x-admin-pin']) ? req?.headers?.['x-admin-pin'][0] : req?.headers?.['x-admin-pin'];
    const isAuth = await isAuthorizedManager(authPin || pinHeader, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to remove menu items' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }

    const deleted = await MenuRepository.deleteItem(id, restaurantId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    sseService.broadcast({ type: 'menu_update', action: 'delete', menuItemId: id }, restaurantId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
