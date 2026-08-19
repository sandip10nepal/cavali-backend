/**
 * Restaurant Management Routes
 *
 * POST   /api/restaurants                 — Create restaurant (platform admin)
 * GET    /api/restaurants                 — List all restaurants (platform admin)
 * GET    /api/restaurants/:id             — Get restaurant details
 * PATCH  /api/restaurants/:id             — Update restaurant settings
 * GET    /api/restaurants/:id/config      — Public config for customer app (device auth)
 * GET    /api/restaurants/slug/:slug/config — Public config by slug (no auth needed for initial load)
 */
import { Router } from 'express';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';
import { requireAuth, requirePermission, requireRole, validateTenantParam } from '../middleware/tenant.middleware';
import type { RestaurantBranding, RestaurantSettings } from '../models/types';

const router = Router();

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       CREATE RESTAURANT                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * POST /api/restaurants
 *
 * Creates a new restaurant tenant with default settings.
 * Also creates the initial owner account.
 *
 * Body: {
 *   name: string,
 *   slug: string,
 *   owner_name: string,
 *   owner_email: string,
 *   owner_pin: string,    // 4-6 digit PIN
 *   branding?: Partial<RestaurantBranding>,
 *   settings?: Partial<RestaurantSettings>,
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { name, slug, owner_name, owner_email, owner_pin, branding, settings } = req.body;

    if (!name || !slug || !owner_name || !owner_email || !owner_pin) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, slug, owner_name, owner_email, owner_pin',
      });
      return;
    }

    // Validate slug format (alphanumeric + hyphens, lowercase)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json({
        success: false,
        error: 'Slug must be lowercase alphanumeric with hyphens only.',
      });
      return;
    }

    // Check slug uniqueness
    const existing = await MultiTenantDbService.getRestaurantBySlug(slug);
    if (existing) {
      res.status(409).json({ success: false, error: 'A restaurant with this slug already exists.' });
      return;
    }

    // Default branding
    const defaultBranding: RestaurantBranding = {
      primary_color: '#FF5A1F',
      secondary_color: '#E5B13A',
      accent_color: '#14B8A6',
      background_color: '#0E0A08',
      card_color: '#1C1411',
      text_color: '#F8F1EA',
      muted_color: '#948375',
      logo_url: null,
      font_family: 'ui-rounded',
      ...branding,
    };

    // Default settings
    const defaultSettings: RestaurantSettings = {
      currency: 'USD',
      timezone: 'America/Chicago',
      tax_config: {
        default_rate: 0.0825,
        category_rates: {},
      },
      auto_accept_orders: false,
      require_table_number: true,
      enable_tips: true,
      tip_options: [15, 18, 20, 25],
      enable_split_payment: true,
      session_timeout_minutes: 5,
      payment_provider: 'square',
      payment_credentials: {},
      ...settings,
    };

    // 1. Create restaurant
    const restaurant = await MultiTenantDbService.createRestaurant({
      slug,
      name,
      branding: defaultBranding,
      settings: defaultSettings,
      active: true,
    });

    // 2. Create owner account
    const owner = await MultiTenantDbService.createUser({
      restaurant_id: restaurant._id,
      name: owner_name,
      email: owner_email,
      phone: null,
      role: 'owner',
      pin_hash: AuthService.hashPin(owner_pin),
      active: true,
    });

    // 3. Audit log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      owner._id,
      owner.name,
      'restaurant_setting_changed',
      'restaurant',
      restaurant._id,
      { action: 'created', name, slug }
    );

    // 4. Generate owner JWT
    const token = AuthService.generateStaffToken(owner._id, restaurant._id, 'owner', restaurant.name);

    res.status(201).json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
      },
      token,
    });
  } catch (err: any) {
    console.error('[Restaurants] Create error:', err);
    if (err.code === 11000) {
      res.status(409).json({ success: false, error: 'Duplicate slug.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/restaurants/onboard
 *
 * Full Turnkey Onboarding Endpoint for new restaurants/venues.
 * Creates:
 * 1. Restaurant Tenant (with 4-digit unique code, branding, settings)
 * 2. Owner & Manager Account (min 8-char password)
 * 3. Floor Staff Accounts (Server, Bartender, Chef, Hookah Maker with 4-digit PIN)
 * 4. Floor Layout Tables (1..N)
 * 5. Initial Menu Categories & Starter Menu Items
 */
router.post('/onboard', async (req, res) => {
  try {
    const {
      name,
      slug,
      restaurant_code,
      owner_name,
      owner_email,
      manager_password,
      staff_pin = '1234',
      table_count = 10,
      business_type = 'hookah_lounge',
      branding,
      tax_rate = 8.25,
      currency = 'USD',
      timezone = 'America/Chicago'
    } = req.body;

    if (!name || !owner_name || !manager_password) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, owner_name, manager_password'
      });
      return;
    }

    const cleanPass = String(manager_password).trim();
    if (cleanPass.length < 4) {
      res.status(400).json({
        success: false,
        error: 'Manager password or PIN code must be at least 4 characters.'
      });
      return;
    }

    const cleanStaffPin = String(staff_pin).trim().replace(/[^0-9]/g, '');
    if (cleanStaffPin.length !== 4) {
      res.status(400).json({
        success: false,
        error: 'Floor staff PIN must be exactly 4 digits (e.g. 1234).'
      });
      return;
    }

    // 1. Generate or validate Slug
    let targetSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!targetSlug) targetSlug = 'restaurant-' + Math.floor(1000 + Math.random() * 9000);

    const allRestaurants = await MultiTenantDbService.listRestaurants();
    const existingSlug = allRestaurants.find(r => r.slug === targetSlug);
    if (existingSlug) {
      targetSlug = `${targetSlug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // 2. Generate or validate unique 4-digit restaurant code
    let targetCode = restaurant_code ? String(restaurant_code).trim().replace(/[^0-9]/g, '') : '';
    if (targetCode.length !== 4 || allRestaurants.some(r => r.restaurant_code === targetCode)) {
      let attempts = 0;
      do {
        targetCode = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
      } while (allRestaurants.some(r => r.restaurant_code === targetCode) && attempts < 100);
    }

    // 3. Setup Branding & Settings
    const defaultBranding: RestaurantBranding = {
      primary_color: branding?.primary_color || (business_type === 'hookah_lounge' ? '#FF5A1F' : '#E5B13A'),
      secondary_color: branding?.secondary_color || '#E5B13A',
      accent_color: branding?.accent_color || '#14B8A6',
      background_color: '#0E0A08',
      card_color: '#1C1411',
      text_color: '#F8F1EA',
      muted_color: '#948375',
      logo_url: branding?.logo_url || null,
      font_family: 'ui-rounded',
    };

    const defaultSettings: RestaurantSettings = {
      currency,
      timezone,
      tax_config: {
        default_rate: (Number(tax_rate) || 8.25) / 100,
        category_rates: {},
      },
      auto_accept_orders: false,
      require_table_number: true,
      enable_tips: true,
      tip_options: [15, 18, 20, 25],
      enable_split_payment: true,
      session_timeout_minutes: 5,
      payment_provider: 'square',
      payment_credentials: {},
    };

    // 4. Create Restaurant
    const restaurant = await MultiTenantDbService.createRestaurant({
      name: String(name).trim(),
      slug: targetSlug,
      restaurant_code: targetCode,
      branding: defaultBranding,
      settings: defaultSettings,
      active: true,
    });

    // 5. Create Owner / Manager User
    const ownerEmail = owner_email ? String(owner_email).trim().toLowerCase() : `manager@${targetSlug}.com`;
    const owner = await MultiTenantDbService.createUser({
      restaurant_id: restaurant._id,
      name: String(owner_name).trim(),
      email: ownerEmail,
      phone: req.body.owner_phone || req.body.phone || null,
      role: 'owner',
      pin_hash: AuthService.hashPin(String(manager_password).trim()),
      active: true,
    });

    // 6. Create Standard Floor Staff Accounts
    const firstName = String(owner_name).trim().split(' ')[0] || 'Floor';
    const staffMembers: { name: string; role: any }[] = [
      { name: `${firstName} (Floor Server)`, role: 'server' },
      { name: 'Lead Bartender', role: 'bartender' },
      { name: 'Kitchen Chef', role: 'chef' },
    ];

    if (business_type === 'hookah_lounge' || business_type === 'hookah') {
      staffMembers.push({ name: 'Hookah Master', role: 'hookah_maker' });
    }

    for (const staff of staffMembers) {
      await MultiTenantDbService.createUser({
        restaurant_id: restaurant._id,
        name: staff.name,
        email: null,
        phone: null,
        role: staff.role,
        pin_hash: AuthService.hashPin(cleanStaffPin),
        active: true,
      });
    }

    // 7. Create Floor Tables
    const totalTables = Math.min(Math.max(parseInt(String(table_count), 10) || 10, 1), 100);
    for (let t = 1; t <= totalTables; t++) {
      await MultiTenantDbService.createTable({
        restaurant_id: restaurant._id,
        number: t,
        label: `Table ${t}`,
        capacity: t <= 4 ? 2 : t <= 12 ? 4 : 6,
        active: true,
      });
    }

    // 8. Create Starter Categories & Menu Items
    const categoriesToCreate = [
      { id: 'appetizers', title: 'Small Plates & Appetizers', subtitle: 'Starters', icon: '🍿', color: defaultBranding.primary_color, menu_type: 'food', sort_order: 10 },
      { id: 'mains', title: 'Entrees & Specialties', subtitle: 'Mains', icon: '🍖', color: defaultBranding.secondary_color, menu_type: 'food', sort_order: 20 },
      { id: 'beverages', title: 'Refreshers & Mocktails', subtitle: 'Drinks', icon: '🍹', color: defaultBranding.accent_color, menu_type: 'drinks', sort_order: 30 },
    ];

    if (business_type === 'hookah_lounge' || business_type === 'hookah') {
      categoriesToCreate.unshift({
        id: 'hookahs',
        title: 'Signature Hookah Mixes',
        subtitle: 'Hookahs',
        icon: '💨',
        color: defaultBranding.primary_color,
        menu_type: 'hookah',
        sort_order: 5,
      });
    }

    const createdCats: any[] = [];
    for (const cat of categoriesToCreate) {
      const created = await MultiTenantDbService.createMenuCategory({
        restaurant_id: restaurant._id,
        title: cat.title,
        subtitle: cat.subtitle,
        icon: cat.icon,
        color: cat.color,
        menu_type: cat.menu_type,
        sort_order: cat.sort_order,
        active: true,
      });
      createdCats.push({ ...created, original_id: cat.id });
    }

    // Create Sample Starter Menu Items
    const starterItems: any[] = [];
    if (business_type === 'hookah_lounge' || business_type === 'hookah') {
      const hCat = createdCats.find(c => c.original_id === 'hookahs') || createdCats[0];
      starterItems.push(
        {
          restaurant_id: restaurant._id,
          category_id: hCat._id,
          name: 'House Signature Hookah',
          desc: 'Premium double-apple & mint slow-roasted hookah blend.',
          price: 25.00,
          cost_price: 4.50,
          inventory_tracking: true,
          active: true,
        },
        {
          restaurant_id: restaurant._id,
          category_id: hCat._id,
          name: 'Tropical Ice Blend Hookah',
          desc: 'Refreshing mango, passionfruit, and chilled peppermint.',
          price: 28.00,
          cost_price: 5.00,
          inventory_tracking: true,
          active: true,
        }
      );
    }

    const appCat = createdCats.find(c => c.original_id === 'appetizers') || createdCats[0];
    starterItems.push(
      {
        restaurant_id: restaurant._id,
        category_id: appCat._id,
        name: 'Crispy Truffle Fries',
        desc: 'Hand-cut fries with white truffle oil, parmesan, and herbs.',
        price: 12.00,
        cost_price: 2.50,
        inventory_tracking: true,
        active: true,
      },
      {
        restaurant_id: restaurant._id,
        category_id: appCat._id,
        name: 'Fire-Roasted Wings (8 pcs)',
        desc: 'Crispy jumbo wings tossed in spicy peri-peri or sweet BBQ.',
        price: 16.00,
        cost_price: 4.00,
        inventory_tracking: true,
        active: true,
      }
    );

    const drinkCat = createdCats.find(c => c.original_id === 'beverages') || createdCats[createdCats.length - 1];
    starterItems.push(
      {
        restaurant_id: restaurant._id,
        category_id: drinkCat._id,
        name: 'Signature Passionfruit Mojito',
        desc: 'Fresh crushed mint, lime, passionfruit puree, and sparkling soda.',
        price: 9.00,
        cost_price: 1.50,
        inventory_tracking: true,
        active: true,
      },
      {
        restaurant_id: restaurant._id,
        category_id: drinkCat._id,
        name: 'Spiced Karak Chai Tea',
        desc: 'Traditional slow-brewed black tea infused with cardamom and evaporated milk.',
        price: 5.00,
        cost_price: 0.80,
        inventory_tracking: true,
        active: true,
      }
    );

    for (const item of starterItems) {
      await MultiTenantDbService.createMenuItem(item);
    }

    // 9. Generate Owner JWT
    const token = AuthService.generateStaffToken(owner._id, restaurant._id, 'owner', restaurant.name);

    // 10. Audit Log
    await MultiTenantDbService.logAudit(
      restaurant._id,
      owner._id,
      owner.name,
      'restaurant_setting_changed',
      'restaurant',
      restaurant._id,
      {
        action: 'onboarded',
        restaurant_name: restaurant.name,
        restaurant_code: restaurant.restaurant_code,
        tables_created: totalTables,
        staff_created: staffMembers.length + 1
      }
    );

    res.status(201).json({
      success: true,
      message: `🎉 Restaurant "${restaurant.name}" successfully onboarded to Benzin!`,
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        restaurant_code: restaurant.restaurant_code,
        branding: restaurant.branding,
        settings: restaurant.settings,
      },
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      },
      credentials: {
        restaurant_code: restaurant.restaurant_code,
        manager_email: owner.email,
        manager_password: manager_password,
        staff_pin: cleanStaffPin,
        unified_floor_pin: `${restaurant.restaurant_code}-${cleanStaffPin}`,
        ipad_pairing_code: `${restaurant.restaurant_code}-${cleanStaffPin}`,
      },
      stats: {
        tables_created: totalTables,
        staff_accounts_created: staffMembers.length + 1,
        categories_created: createdCats.length,
        menu_items_created: starterItems.length,
      },
      token,
    });
  } catch (err: any) {
    console.error('[Restaurants] Onboard error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       PUBLIC RESTAURANTS LIST                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/restaurants/public
 *
 * Returns active restaurants for tenant selection on POS / Admin login screen
 */
router.get('/public', async (req, res) => {
  try {
    const list = await MultiTenantDbService.listRestaurants();
    const restaurants = list.filter(r => r.active !== false).map(r => ({
      id: r._id,
      name: r.name,
      slug: r.slug,
      restaurant_code: r.restaurant_code,
      branding: r.branding,
    }));
    res.json({ success: true, restaurants });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to list restaurants' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       LIST RESTAURANTS                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/restaurants
 *
 * Platform admin: list all restaurants.
 * Restaurant staff: returns only their restaurant.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.tenant!.role === 'platform_admin') {
      const restaurants = await MultiTenantDbService.listRestaurants();
      res.status(200).json({ success: true, restaurants });
      return;
    }

    // Non-admin: return only their restaurant
    const restaurant = await MultiTenantDbService.getRestaurant(req.tenant!.restaurant_id);
    res.status(200).json({ success: true, restaurants: restaurant ? [restaurant] : [] });
  } catch (err: any) {
    console.error('[Restaurants] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       GET RESTAURANT                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/restaurants/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;

    // Tenant isolation: non-admins can only access their own restaurant
    if (req.tenant!.role !== 'platform_admin' && id !== req.tenant!.restaurant_id) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const restaurant = await MultiTenantDbService.getRestaurant(id);
    if (!restaurant) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    res.status(200).json({ success: true, restaurant });
  } catch (err: any) {
    console.error('[Restaurants] Get error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     UPDATE RESTAURANT                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * PATCH /api/restaurants/:id
 *
 * Body: { name?, branding?, settings? }
 */
router.patch('/:id', requireAuth, requirePermission('restaurant:update'), async (req, res) => {
  try {
    const id = req.params.id as string;

    if (req.tenant!.role !== 'platform_admin' && id !== req.tenant!.restaurant_id) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const { name, branding, settings } = req.body;
    const update: any = {};
    if (name) update.name = name;
    if (branding) update.branding = branding;
    if (settings) update.settings = settings;

    const updated = await MultiTenantDbService.updateRestaurant(id, update);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    // Audit
    await MultiTenantDbService.logAudit(
      id,
      req.tenant!.user_id || 'system',
      'Admin',
      'restaurant_setting_changed',
      'restaurant',
      id,
      { updated_fields: Object.keys(update) }
    );

    const restaurant = await MultiTenantDbService.getRestaurant(id);
    res.status(200).json({ success: true, restaurant });
  } catch (err: any) {
    console.error('[Restaurants] Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    PUBLIC CONFIG (CUSTOMER APP)                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/restaurants/slug/:slug/config
 *
 * Public config lookup by slug. No auth required.
 * Used for initial device setup before pairing & live app config sync.
 */
router.get('/slug/:slug/config', async (req, res) => {
  try {
    const slug = req.params.slug as string;
    const restaurant = await MultiTenantDbService.getRestaurantBySlug(slug);

    if (!restaurant || !restaurant.active) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    const config = await MultiTenantDbService.getPublicConfig(restaurant._id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Restaurant config not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      ...config
    });
  } catch (err: any) {
    console.error('[Restaurants] Slug config error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * GET /api/restaurants/:id/config
 *
 * Returns the full public configuration for the customer iPad app.
 * Requires device auth (or any auth).
 */
router.get('/:id/config', async (req, res) => {
  try {
    const id = req.params.id as string;
    const config = await MultiTenantDbService.getPublicConfig(id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Restaurant not found.' });
      return;
    }

    res.status(200).json({ success: true, ...config });
  } catch (err: any) {
    console.error('[Restaurants] Config error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

export default router;
