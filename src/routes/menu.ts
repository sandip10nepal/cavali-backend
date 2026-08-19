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

  if (cat.includes('beverage') || cat.includes('drink') || cat === 'cat_beverages') {
    if (name.includes('chai') || name.includes('tea') || name.includes('coffee') || name.includes('latte') || name.includes('espresso')) {
      return 'drinks_tea_coffee';
    }
    if (name.includes('mojito') || name.includes('margarita') || name.includes('colada') || name.includes('refresher') || name.includes('juice') || name.includes('shake') || name.includes('lassi')) {
      return 'drinks_refreshers';
    }
    return 'drinks_soft';
  }

  if (cat.includes('hookah') || cat === 'cat_hookah') return 'hookah';
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

export async function preloadMenuCache(): Promise<any[]> {
  try {
    const items = await MenuRepository.listItems('RES_EED4E9D266DF');
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
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || new Date().toISOString()
    }));
  } catch (_) {
    return [];
  }
}

async function isAuthorizedManager(authPin?: any, req?: any): Promise<boolean> {
  if (req?.tenant && (req.tenant.role === 'owner' || req.tenant.role === 'manager' || req.tenant.role === 'platform_admin')) {
    return true;
  }
  if (authPin) {
    const pinStr = String(authPin).trim();
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    if (restaurantId && MultiTenantDbService.isInitialized()) {
      const users = await MultiTenantDbService.listUsers(restaurantId);
      for (const u of users) {
        if ((u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') && AuthService.verifyPin(pinStr, u.pin_hash)) {
          return true;
        }
      }
    }
  }
  return false;
}

// GET /api/menu — list all menu items for the target tenant
router.get('/', async (req, res) => {
  try {
    const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
    const [tenantItems, categories] = await Promise.all([
      MenuRepository.listItems(restaurantId),
      MenuRepository.listCategories(restaurantId)
    ]);
    const catMap = new Map(categories.map((c: any) => [c._id, c.title]));

    const items = tenantItems.map((i: any) => {
      const catTitle = catMap.get(i.category_id) || i.category_id;
      return {
        id: i._id,
        _id: i._id,
        name: i.name,
        category: mapCategoryToLegacy(catTitle, i.name, i.desc),
        price: i.price,
        emoji: i.emoji || '🍽️',
        image_url: i.image_url || i.image || i.imageUrl || undefined,
        desc: i.desc || i.description || '',
        available: i.available !== false,
        recipe: i.recipe || undefined,
        ingredient_id: i.ingredient_id || undefined,
        ingredient_amount: i.ingredient_amount || undefined,
        requiresSauce: false,
        sort_order: i.sort_order !== undefined ? i.sort_order : 99,
        createdAt: i.created_at || new Date().toISOString(),
        updatedAt: i.updated_at || new Date().toISOString()
      };
    });

    const { category, available } = req.query;
    let filtered = items;
    if (category) filtered = filtered.filter(m => m.category === category);
    if (available === 'true') filtered = filtered.filter(m => m.available);

    filtered.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

    res.json({ success: true, menuItems: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch menu items' });
  }
});

// GET /api/menu/:id — get single item
router.get('/:id', async (req, res) => {
  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
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
});

// POST /api/menu — add a new menu item (requires Manager or Owner)
router.post('/', optionalAuth, async (req, res) => {
  const { name, category, price, emoji, image_url, desc, available, sort_order, recipe, ingredient_id, ingredient_amount, authPin } = req.body;

  const isAuth = await isAuthorizedManager(authPin || req.headers['x-admin-pin'], req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to add menu items' });
  }

  if (!name || !category || price === undefined) {
    return res.status(400).json({ success: false, message: 'name, category, and price are required' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  const parsedSortOrder = sort_order !== undefined && !isNaN(parseInt(sort_order)) ? parseInt(sort_order) : 99;

  const newItem = await MenuRepository.createItem({
    restaurant_id: restaurantId,
    category_id: category,
    name: String(name).trim(),
    price: parseFloat(Number(price).toFixed(2)),
    desc: String(desc || '').trim(),
    emoji: String(emoji || '🍽️').trim(),
    image_url: image_url ? String(image_url).trim() : null,
    available: available !== false && available !== 'false',
    modifier_groups: [],
    sort_order: parsedSortOrder,
    recipe: Array.isArray(recipe) ? recipe : [],
    ingredient_id: ingredient_id ? String(ingredient_id) : undefined,
    ingredient_amount: ingredient_amount ? Number(ingredient_amount) : undefined
  });

  sseService.broadcast({ type: 'menu_update', action: 'add', menuItem: newItem }, restaurantId);
  res.status(201).json({ success: true, menuItem: newItem });
});

// PATCH /api/menu/:id — update a menu item (requires Manager or Owner)
router.patch('/:id', optionalAuth, async (req, res) => {
  const id = String(req.params.id);
  const { authPin, ...fields } = req.body;

  const pinHeader = Array.isArray(req.headers['x-admin-pin']) ? req.headers['x-admin-pin'][0] : req.headers['x-admin-pin'];
  const isAuth = await isAuthorizedManager(authPin || pinHeader, req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to edit menu items' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  const updated = await MenuRepository.updateItem(id, restaurantId, fields);

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Menu item not found' });
  }

  sseService.broadcast({ type: 'menu_update', action: 'update', menuItemId: id }, restaurantId);
  res.json({ success: true, menuItem: fields });
});

// DELETE /api/menu/:id — remove a menu item (requires Manager or Owner)
router.delete('/:id', optionalAuth, async (req, res) => {
  const id = String(req.params.id);
  const { authPin } = req.body || {};

  const pinHeader = Array.isArray(req.headers['x-admin-pin']) ? req.headers['x-admin-pin'][0] : req.headers['x-admin-pin'];
  const isAuth = await isAuthorizedManager(authPin || pinHeader, req);
  if (!isAuth) {
    return res.status(403).json({ success: false, message: 'Manager or Owner authorization required to remove menu items' });
  }

  const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
  await MenuRepository.deleteItem(id, restaurantId);

  sseService.broadcast({ type: 'menu_update', action: 'delete', menuItemId: id }, restaurantId);
  res.json({ success: true });
});

export default router;
