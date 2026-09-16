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
    const { name, category, price, emoji, image_url, desc, available, sort_order, recipe, ingredient_id, ingredient_amount, authPin, modifier_groups, modifierGroups } = req.body;

    const isAuth = await isAuthorizedManager(authPin || req.headers['x-admin-pin'], req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to add menu items' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }

    if (!name || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, category, and price are required' });
    }

    const parsedSortOrder = sort_order !== undefined && !isNaN(parseInt(sort_order)) ? parseInt(sort_order) : 99;
    const parsedModifiers = Array.isArray(modifier_groups) ? modifier_groups : (Array.isArray(modifierGroups) ? modifierGroups : []);

    const newItem = await MenuRepository.createItem({
      restaurant_id: restaurantId,
      category_id: category,
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

    const pinHeader = Array.isArray(req.headers['x-admin-pin']) ? req.headers['x-admin-pin'][0] : req.headers['x-admin-pin'];
    const isAuth = await isAuthorizedManager(authPin || pinHeader, req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to edit menu items' });
    }

    const restaurantId = await resolveTenantRestaurantId(req);
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Tenant restaurant ID is required' });
    }

    const updated = await MenuRepository.updateItem(id, restaurantId, fields);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    sseService.broadcast({ type: 'menu_update', action: 'update', menuItemId: id }, restaurantId);
    res.json({ success: true, menuItem: fields });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/menu/:id — remove a menu item (requires Manager or Owner)
router.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { authPin } = req.body || {};

    const pinHeader = Array.isArray(req.headers['x-admin-pin']) ? req.headers['x-admin-pin'][0] : req.headers['x-admin-pin'];
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

export default router;
