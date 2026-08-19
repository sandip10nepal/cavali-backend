/**
 * Migration Script: Seed Cavali as Restaurant #1
 *
 * This script populates the multi-tenant database with Cavali's existing
 * data as the first restaurant tenant. Run once after database setup.
 *
 * Usage: npx ts-node src/scripts/seed-cavali.ts
 */
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';
import type { RestaurantBranding, RestaurantSettings, MenuCategory, MenuItemModel } from '../models/types';

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          CAVALI DATA                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const CAVALI_BRANDING: RestaurantBranding = {
  primary_color: '#FF5A1F',      // ember
  secondary_color: '#E5B13A',    // gold
  accent_color: '#14B8A6',       // teal
  background_color: '#0E0A08',   // night
  card_color: '#1C1411',
  text_color: '#F8F1EA',         // cream
  muted_color: '#948375',
  logo_url: null,                // Will be set when logo is uploaded
  font_family: 'ui-rounded',
};

const CAVALI_SETTINGS: RestaurantSettings = {
  currency: 'USD',
  timezone: 'America/Chicago',
  tax_config: {
    default_rate: 0.0825,
    category_rates: {},           // uniform 8.25% for all categories
  },
  auto_accept_orders: false,
  require_table_number: true,
  enable_tips: true,
  tip_options: [15, 18, 20, 25],
  enable_split_payment: true,
  session_timeout_minutes: 5,
  payment_provider: 'square',
  payment_credentials: {},        // Configured via env vars
};

/* ─────────────── Menu Categories ─────────────── */

interface SeedCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  menu_type: string;
  sort_order: number;
}

const FOOD_CATEGORIES: SeedCategory[] = [
  { id: 'appetizers',    title: 'Small Plates to Share',    subtitle: 'Appetizers',              icon: '🍿', color: '#FF5A1F', menu_type: 'food',    sort_order: 10 },
  { id: 'mains',         title: 'From the Grill and the Pot', subtitle: 'Mains',               icon: '🍖', color: '#E5B13A', menu_type: 'food',    sort_order: 20 },
  { id: 'wings',         title: 'Tossed to Order',          subtitle: 'Wings',                   icon: '🍗', color: '#EF4444', menu_type: 'food',    sort_order: 30 },
  { id: 'vegetarian',    title: 'Meat-Free Favorites',      subtitle: 'Vegetarian',              icon: '🥗', color: '#22C55E', menu_type: 'food',    sort_order: 40 },
  { id: 'burgers',       title: 'Served with Fries',        subtitle: 'Burgers',                 icon: '🍔', color: '#F59E0B', menu_type: 'food',    sort_order: 50 },
  { id: 'wraps',         title: 'Served with Fries',        subtitle: 'Wraps',                   icon: '🌯', color: '#8B5CF6', menu_type: 'food',    sort_order: 60 },
  { id: 'continental',   title: 'Globe-Trotting Bites',     subtitle: 'Continental Street Food', icon: '🌎', color: '#06B6D4', menu_type: 'food',    sort_order: 70 },
  { id: 'desserts',      title: 'Sweet Finishes',           subtitle: 'Desserts',                icon: '🎂', color: '#EC4899', menu_type: 'food',    sort_order: 80 },
];

const DRINK_CATEGORIES: SeedCategory[] = [
  { id: 'refreshers',    title: 'Refreshers',               subtitle: 'Refreshers',              icon: '🍹', color: '#14B8A6', menu_type: 'drinks',  sort_order: 90  },
  { id: 'tea_coffee',    title: 'Tea & Coffee',             subtitle: 'Tea & Coffee',            icon: '☕',  color: '#E5B13A', menu_type: 'drinks',  sort_order: 100 },
  { id: 'soft_drinks',   title: 'Soft Drinks & Water',      subtitle: 'Soft Drinks & Water',     icon: '🥤', color: '#6366F1', menu_type: 'drinks',  sort_order: 110 },
];

const HOOKAH_CATEGORIES: SeedCategory[] = [
  { id: 'house_mix',     title: 'Signature House Blends',   subtitle: 'House Mix',               icon: '🏠', color: '#FF5A1F', menu_type: 'hookah',  sort_order: 1  },
  { id: 'fruity',        title: 'Fruity Flavors',           subtitle: 'Fruity',                  icon: '🍓', color: '#F472B6', menu_type: 'hookah',  sort_order: 2  },
  { id: 'classic',       title: 'Classic Flavors',          subtitle: 'Classic',                 icon: '💨', color: '#6366F1', menu_type: 'hookah',  sort_order: 3  },
  { id: 'fresh_cool',    title: 'Fresh & Cool',             subtitle: 'Fresh & Cool',            icon: '❄️',  color: '#14B8A6', menu_type: 'hookah',  sort_order: 4  },
];

/* ─────────────── Menu Items (from existing menu.ts) ─────────────── */

interface SeedItem {
  image_url?: string;
  id: string;
  category_seed_id: string;  // maps to SeedCategory.id
  name: string;
  price: number;
  desc: string;
  emoji: string;
  modifier_groups?: any[];
}

const WING_SAUCES = ['Buffalo', 'BBQ', 'Garlic Parmesan', 'Lemon Pepper', 'Honey BBQ', 'Mango Habanero'];

const FOOD_ITEMS: SeedItem[] = [
  // Appetizers
  { id: 'hummus',    category_seed_id: 'appetizers', name: 'Hummus',              price: 10, emoji: '🫘', desc: 'Creamy chickpea puree with tahini, olive oil, and warm pita.', image_url: 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=600&auto=format&fit=crop&q=80' },
  { id: 'falafel',   category_seed_id: 'appetizers', name: 'Falafel',             price: 10, emoji: '🧆', desc: 'Crisp chickpea fritters served with tahini sauce and pickled vegetables.', image_url: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=600&auto=format&fit=crop&q=80' },
  { id: 'dyn_chk',   category_seed_id: 'appetizers', name: 'Dynamite Chicken',    price: 14, emoji: '🔥', desc: 'Crispy chicken bites tossed in our signature spicy aioli.', image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80' },
  { id: 'bun_kab',   category_seed_id: 'appetizers', name: 'Bun Kabab',           price: 10, emoji: '🥙', desc: 'Spiced patty in a soft bun with green chutney and tamarind.', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
  { id: 'samosa',    category_seed_id: 'appetizers', name: 'Samosa',              price: 8,  emoji: '🔺', desc: 'Crispy pastry triangles – vegetable, chicken, or beef. (3 pc)', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80' },
  { id: 'papri',     category_seed_id: 'appetizers', name: 'Papri Chaat',         price: 10, emoji: '🍿', desc: 'Crisp wafers layered with chickpeas, yogurt, mint, and tamarind chutneys.', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80' },
  { id: 'pani',      category_seed_id: 'appetizers', name: 'Pani Puri',           price: 12, emoji: '🫙', desc: 'Hollow puris filled with spiced potato, chickpeas, and tangy mint water. (6 pc)', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80' },
  { id: 'spy_pot',   category_seed_id: 'appetizers', name: 'Spicy Potato',        price: 8,  emoji: '🥔', desc: 'Cubed potatoes tossed in chili and Cavali spices.', image_url: 'https://images.unsplash.com/photo-1518013031184-41d4bf22045e?w=600&auto=format&fit=crop&q=80' },
  { id: 'tenders',   category_seed_id: 'appetizers', name: 'Tenders with Fries',  price: 12, emoji: '🍗', desc: 'Golden chicken tenders with seasoned fries and dipping sauce.', image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80' },
  { id: 'pizza_b',   category_seed_id: 'appetizers', name: 'Pizza Bites',         price: 10, emoji: '🍕', desc: 'Mini cheese-and-marinara pizza pockets baked golden.', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80' },
  { id: 'fries',     category_seed_id: 'appetizers', name: 'Fries',               price: 7,  emoji: '🍟', desc: 'Potato fries with house seasoning.', image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80' },
  { id: 'ld_fries',  category_seed_id: 'appetizers', name: 'Loaded Fries',        price: 12, emoji: '🍟', desc: 'Fries topped with cheese, jalapenos, green onion, and sour cream. Add chicken for $3.', image_url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80' },
  { id: 'ld_nachos', category_seed_id: 'appetizers', name: 'Loaded Nachos',       price: 12, emoji: '🧀', desc: 'Tortilla chips piled with cheese, jalapenos, salsa, and sour cream. Add chicken for $3.', image_url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80' },
  { id: 'chips_q',   category_seed_id: 'appetizers', name: 'Chips and Queso',     price: 10, emoji: '🫕', desc: 'Crisp tortilla chips with warm, melted cheese dip.', image_url: 'https://images.unsplash.com/photo-1576777647209-e8733d0b8515?w=600&auto=format&fit=crop&q=80' },
  { id: 'chips_g',   category_seed_id: 'appetizers', name: 'Chips and Guacamole', price: 10, emoji: '🥑', desc: 'Crisp tortilla chips with guacamole.', image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80' },
  // Mains
  { id: 'shaw_pl',   category_seed_id: 'mains', name: 'Shawarma Plate',      price: 19, emoji: '🥙', desc: 'Marinated chicken or beef shawarma with garlic toum, pickles, and rice/fries.', image_url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&auto=format&fit=crop&q=80' },
  { id: 'koobideh',  category_seed_id: 'mains', name: 'Beef Koobideh',       price: 26, emoji: '🍢', desc: 'Persian-style ground beef kabobs, served with salad.', image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80' },
  { id: 'chk_boti',  category_seed_id: 'mains', name: 'Chicken Boti',        price: 18, emoji: '🍗', desc: 'Charcoal-grilled spiced chicken cubes served with mint chutney and naan.', image_url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=80' },
  { id: 'chk_kab',   category_seed_id: 'mains', name: 'Chicken Kabob',       price: 19, emoji: '🍢', desc: 'Tender grilled chicken skewers marinated with spices. Served with rice and garlic sauce.', image_url: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&auto=format&fit=crop&q=80' },
  { id: 'lamb_ch',   category_seed_id: 'mains', name: 'Lamb Chops',          price: 32, emoji: '🥩', desc: 'Herb-marinated lamb chops, charred over open flame, with mashed potatoes.', image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80' },
  { id: 'but_chk',   category_seed_id: 'mains', name: 'Butter Chicken',      price: 20, emoji: '🍛', desc: 'Tandoori chicken simmered in a rich tomato-cream gravy, served with rice.', image_url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&auto=format&fit=crop&q=80' },
  { id: 'biryani',   category_seed_id: 'mains', name: 'Chicken Dum Biryani', price: 20, emoji: '🍚', desc: 'Slow-cooked basmati and spiced chicken sealed in a dough pot, with raita.', image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80' },
  // Wings (with sauce modifier group)
  { id: 'wings6',    category_seed_id: 'wings', name: '6 pc Wings',  price: 11, emoji: '🍗', desc: 'Choose your sauce flavor.',
    modifier_groups: [{ id: 'wing_sauce', name: 'Wing Sauce', required: true, max_selections: 1, options: WING_SAUCES.map(s => ({ id: s.toLowerCase().replace(/\s+/g, '_'), name: s, price_adjustment: 0, image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80' })) }] },
  { id: 'wings10',   category_seed_id: 'wings', name: '10 pc Wings', price: 17, emoji: '🍗', desc: 'Choose your sauce flavor.',
    modifier_groups: [{ id: 'wing_sauce', name: 'Wing Sauce', required: true, max_selections: 1, options: WING_SAUCES.map(s => ({ id: s.toLowerCase().replace(/\s+/g, '_'), name: s, price_adjustment: 0, image_url: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&auto=format&fit=crop&q=80' })) }] },
  // Vegetarian
  { id: 'v_papri',   category_seed_id: 'vegetarian', name: 'Papri Chaat',         price: 10, emoji: '🍿', desc: 'Crisp wafers layered with chickpeas, yogurt, mint, and tamarind chutneys.', image_url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_pani',    category_seed_id: 'vegetarian', name: 'Pani Puri',           price: 12, emoji: '🫙', desc: 'Hollow puris filled with spiced potato, chickpeas, and tangy mint water.', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_spypot',  category_seed_id: 'vegetarian', name: 'Spicy Potato',        price: 8,  emoji: '🥔', desc: 'Fried potatoes with chili and Cavali spices.', image_url: 'https://images.unsplash.com/photo-1518013031184-41d4bf22045e?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_fal',     category_seed_id: 'vegetarian', name: 'Falafel',             price: 10, emoji: '🧆', desc: 'Crisp chickpea fritters served with tahini sauce and pickled vegetables.', image_url: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_hum',     category_seed_id: 'vegetarian', name: 'Hummus',              price: 10, emoji: '🫘', desc: 'Creamy chickpea puree with tahini, olive oil, and warm pita.', image_url: 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=600&auto=format&fit=crop&q=80' },
  { id: 'paneer_m',  category_seed_id: 'vegetarian', name: 'Paneer Momo',         price: 14, emoji: '🥟', desc: 'Steamed dumplings filled with seasoned paneer.', image_url: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&auto=format&fit=crop&q=80' },
  { id: 'veg_sam',   category_seed_id: 'vegetarian', name: 'Veg Samosa',          price: 8,  emoji: '🔺', desc: 'Crispy pastry triangles with spiced potato and pea filling. (3 pc)', image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_chipsq',  category_seed_id: 'vegetarian', name: 'Chips and Queso',     price: 10, emoji: '🫕', desc: 'Crisp tortilla chips with warm, melted cheese dip.', image_url: 'https://images.unsplash.com/photo-1576777647209-e8733d0b8515?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_chipsg',  category_seed_id: 'vegetarian', name: 'Chips and Guacamole', price: 10, emoji: '🥑', desc: 'Crisp tortilla chips with guacamole dip.', image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80' },
  { id: 'daal_c',    category_seed_id: 'vegetarian', name: 'Daal Chawal',         price: 14, emoji: '🍲', desc: 'Slow-cooked lentils served over basmati rice with cumin tadka.', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_fries',   category_seed_id: 'vegetarian', name: 'Fries',               price: 7,  emoji: '🍟', desc: 'Potato fries with house seasoning.', image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_ldfr',    category_seed_id: 'vegetarian', name: 'Loaded Fries',        price: 12, emoji: '🍟', desc: 'Fries topped with cheese, jalapenos, green onion, and sour cream.', image_url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80' },
  { id: 'v_ldna',    category_seed_id: 'vegetarian', name: 'Loaded Nachos',       price: 12, emoji: '🧀', desc: 'Tortilla chips piled with cheese, jalapenos, salsa, and sour cream.', image_url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop&q=80' },
  // Burgers
  { id: 'smash',     category_seed_id: 'burgers', name: 'Beef Smash',     price: 18, emoji: '🍔', desc: 'Double smashed beef patties with American cheese, pickles, and Cavali sauce.', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
  { id: 'zinger',    category_seed_id: 'burgers', name: 'Chicken Zinger', price: 18, emoji: '🍔', desc: 'Crispy spiced chicken fillet with lettuce, mayo, and pickles.', image_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80' },
  { id: 'club',      category_seed_id: 'burgers', name: 'Chicken Club',   price: 15, emoji: '🥪', desc: 'Grilled chicken, lettuce, tomato, and aioli on toasted bread.', image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80' },
  { id: 'swiss_m',   category_seed_id: 'burgers', name: 'Swiss Mushroom', price: 18, emoji: '🍄', desc: 'Beef patty with sauteed mushrooms, Swiss cheese, and caramelized onions.', image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80' },
  // Wraps
  { id: 'shaw_w',    category_seed_id: 'wraps', name: 'Shawarma Wrap',         price: 15, emoji: '🌯', desc: 'Chicken or beef shawarma in pita with toum, pickles, and fries.' },
  { id: 'dyn_w',     category_seed_id: 'wraps', name: 'Dynamite Chicken Wrap', price: 15, emoji: '🌯', desc: 'Crispy spiced chicken with lettuce and signature dynamite sauce.' },
  { id: 'zing_w',    category_seed_id: 'wraps', name: 'Zinger Wrap',           price: 15, emoji: '🌯', desc: 'Crispy zinger fillet with lettuce, cheese, and mayo in a soft wrap.' },
  { id: 'mir_p',     category_seed_id: 'wraps', name: 'Mirchi Paratha Roll',   price: 15, emoji: '🌶', desc: 'Spicy chili-seasoned chicken rolled in flaky paratha with chutneys.', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80' },
  // Continental
  { id: 'tacos',     category_seed_id: 'continental', name: 'Tacos',                       price: 14, emoji: '🌮', desc: 'Soft tortillas (3 pc) - chicken or steak.' },
  { id: 'c_chipsq',  category_seed_id: 'continental', name: 'Chips and Queso',             price: 10, emoji: '🫕', desc: 'Crisp tortilla chips with warm, melted cheese dip.' },
  { id: 'chili_c',   category_seed_id: 'continental', name: 'Chili Chicken',               price: 22, emoji: '🌶', desc: 'Indo-Chinese wok-tossed chicken with green chili, soy, and bell pepper. Served with fried rice.', image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80' },
  { id: 'mongo_c',   category_seed_id: 'continental', name: 'Mongolian Chicken',           price: 22, emoji: '🥡', desc: 'Crispy chicken tossed in sweet-savory Mongolian sauce with scallions. Served with fried rice.', image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80' },
  { id: 'momo',      category_seed_id: 'continental', name: 'Momo',                        price: 14, emoji: '🥟', desc: 'Street-style steamed dumplings - chicken, beef, or paneer. (6 pc)', image_url: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&auto=format&fit=crop&q=80' },
  { id: 'chow',      category_seed_id: 'continental', name: 'Chow Mein',                   price: 15, emoji: '🍜', desc: 'Stir-fried noodles with vegetables. Add your choice of protein for $3.', image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80' },
  { id: 'daal_s',    category_seed_id: 'continental', name: 'Daal Chawal with Beef Shami', price: 15, emoji: '🍲', desc: 'Lentils and rice served with grilled beef shami kabob and chutney.' },
  { id: 'cordon',    category_seed_id: 'continental', name: 'Chicken Cordon Bleu',         price: 26, emoji: '🍽', desc: 'Crispy breaded chicken stuffed with melted cheese, served with creamy mashed potatoes.' },
  // Desserts
  { id: 'car_cr',    category_seed_id: 'desserts', name: 'Caramel Crunch',             price: 10, emoji: '🍮', desc: 'House-made caramel and crunch toffee cake.', image_url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&auto=format&fit=crop&q=80' },
  { id: 'pis_ck',    category_seed_id: 'desserts', name: 'Pistachio Cake',             price: 10, emoji: '🎂', desc: 'Fluffy pistachio sponge with whipped cream and nuts.', image_url: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?w=600&auto=format&fit=crop&q=80' },
  { id: 'rasp_ck',   category_seed_id: 'desserts', name: 'Raspberry White Chocolate',  price: 10, emoji: '🍰', desc: 'White chocolate mousse with fresh raspberry coulis.', image_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&auto=format&fit=crop&q=80' },
  { id: 'choc_ck',   category_seed_id: 'desserts', name: 'Chocolate Cake',             price: 10, emoji: '🍫', desc: 'Rich dark chocolate layer cake with ganache.', image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80' },
  { id: 'butt_b',    category_seed_id: 'desserts', name: 'Butterscotch Bliss',         price: 14, emoji: '🍯', desc: 'Warm butterscotch pudding cake with vanilla ice cream.', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },
];

const DRINK_ITEMS: SeedItem[] = [
  // Refreshers
  { id: 'cl_moj',   category_seed_id: 'refreshers',  name: 'Classic Mint Mojito', price: 10, emoji: '🍹', desc: '', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },
  { id: 'mn_moj',   category_seed_id: 'refreshers',  name: 'Mango Mojito',        price: 10, emoji: '🥭', desc: '', image_url: 'https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop&q=80' },
  { id: 'ly_moj',   category_seed_id: 'refreshers',  name: 'Lychee Mojito',       price: 10, emoji: '🍹', desc: '', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80' },
  { id: 'mt_marg',  category_seed_id: 'refreshers',  name: 'Mint Margarita',      price: 10, emoji: '🍹', desc: '', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80' },
  { id: 'rm_fire',  category_seed_id: 'refreshers',  name: 'Rim Fire Melon',      price: 10, emoji: '🍉', desc: '', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },
  { id: 'wm_jce',   category_seed_id: 'refreshers',  name: 'Watermelon Juice',    price: 10, emoji: '🍉', desc: '', image_url: 'https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?w=600&auto=format&fit=crop&q=80' },
  { id: 'or_jce',   category_seed_id: 'refreshers',  name: 'Orange Juice',        price: 10, emoji: '🍊', desc: '', image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80' },
  { id: 'mn_shk',   category_seed_id: 'refreshers',  name: 'Mango Shake',         price: 12, emoji: '🥭', desc: '', image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80' },
  { id: 'sw_las',   category_seed_id: 'refreshers',  name: 'Sweet Lassi',         price: 8,  emoji: '🥛', desc: '', image_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80' },
  // Tea & Coffee
  { id: 'karak',    category_seed_id: 'tea_coffee',  name: 'Karak Chai',    price: 4, emoji: '☕', desc: '', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80' },
  { id: 'kash_c',   category_seed_id: 'tea_coffee',  name: 'Kashmiri Chai', price: 4, emoji: '🌸', desc: '', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80' },
  { id: 'desi_c',   category_seed_id: 'tea_coffee',  name: 'Desi Coffee',   price: 6, emoji: '☕', desc: '', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80' },
  { id: 'cold_c',   category_seed_id: 'tea_coffee',  name: 'Cold Coffee',   price: 7, emoji: '🧋', desc: '', image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80' },
  { id: 'mint_t',   category_seed_id: 'tea_coffee',  name: 'Mint Tea',      price: 4, emoji: '🌿', desc: '', image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80' },
  { id: 'moroc_t',  category_seed_id: 'tea_coffee',  name: 'Moroccan Tea',  price: 4, emoji: '🫖', desc: '', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80' },
  // Soft Drinks
  { id: 'coca',     category_seed_id: 'soft_drinks', name: 'Coca-Cola',        price: 4,   emoji: '🥤', desc: '' },
  { id: 'coke_z',   category_seed_id: 'soft_drinks', name: 'Coke Zero / Diet', price: 4,   emoji: '🥤', desc: '' },
  { id: 'fanta_d',  category_seed_id: 'soft_drinks', name: 'Fanta',            price: 4,   emoji: '🥤', desc: '' },
  { id: 'ging_a',   category_seed_id: 'soft_drinks', name: 'Ginger Ale',       price: 4,   emoji: '🥤', desc: '' },
  { id: 'sprite',   category_seed_id: 'soft_drinks', name: 'Sprite',           price: 4,   emoji: '🥤', desc: '' },
  { id: 'drpep',    category_seed_id: 'soft_drinks', name: 'Dr Pepper',        price: 4,   emoji: '🥤', desc: '' },
  { id: 'redbull',  category_seed_id: 'soft_drinks', name: 'Red Bull',         price: 6,   emoji: '⚡', desc: '' },
  { id: 'spark_w',  category_seed_id: 'soft_drinks', name: 'Sparkling Water',  price: 6,   emoji: '💧', desc: '' },
  { id: 'sara_w',   category_seed_id: 'soft_drinks', name: 'Saratoga Water',   price: 4.5, emoji: '💧', desc: '' },
];

const HOOKAH_ITEMS: SeedItem[] = [
  // House Mix (Signature)
  { id: 'habibi_nights',      category_seed_id: 'house_mix', name: 'Habibi Nights',  price: 18, emoji: '💜', desc: "Cavali's signature premium blend" },
  { id: 'kashmiri_c_hookah',  category_seed_id: 'house_mix', name: 'Kashmiri Chai',  price: 18, emoji: '🌸', desc: 'Sweet Rooh Afza base with cardamoms' },
  { id: 'anarkali',           category_seed_id: 'house_mix', name: 'Anarkali',       price: 18, emoji: '🌺', desc: 'Rooh Afza milk base — sweet & floral' },
  { id: 'sokha',              category_seed_id: 'house_mix', name: 'Sokha',          price: 18, emoji: '🫐', desc: 'Blueberry base — rich & berry-forward' },
  { id: 'zalim',              category_seed_id: 'house_mix', name: 'Zalim',          price: 18, emoji: '⚡', desc: 'Red Bull base — energising & sharp' },
  { id: 'dragon',             category_seed_id: 'house_mix', name: 'Dragon',         price: 18, emoji: '🐉', desc: 'Mango base — bold tropical kick' },
  { id: 'chulbuli',           category_seed_id: 'house_mix', name: 'Chulbuli',       price: 18, emoji: '🥭', desc: 'Mango base — tropical & playful' },
  { id: 'white_king',         category_seed_id: 'house_mix', name: 'White King',     price: 18, emoji: '👑', desc: 'Milk base — smooth & creamy royalty' },
  { id: 'dubai_nights',       category_seed_id: 'house_mix', name: 'Dubai Nights',   price: 18, emoji: '🌃', desc: 'Watermelon base — refreshing & lush' },
  // Fruity
  { id: 'lychee',             category_seed_id: 'fruity', name: 'Lychee',       price: 18, emoji: '🍑', desc: 'Delicate sweet lychee' },
  { id: 'blueberry',          category_seed_id: 'fruity', name: 'Blueberry',    price: 18, emoji: '🫐', desc: 'Rich berry notes' },
  { id: 'mango_h',            category_seed_id: 'fruity', name: 'Mango',        price: 18, emoji: '🥭', desc: 'Tropical mango sweetness' },
  { id: 'peach',              category_seed_id: 'fruity', name: 'Peach',        price: 18, emoji: '🍑', desc: 'Sweet summer peach' },
  { id: 'dragon_fruit',       category_seed_id: 'fruity', name: 'Dragon Fruit', price: 18, emoji: '🐲', desc: 'Exotic dragon fruit' },
  { id: 'watermelon_lit',     category_seed_id: 'fruity', name: 'Watermelon',   price: 18, emoji: '🍉', desc: 'Fresh watermelon burst' },
  { id: 'grape_hub',          category_seed_id: 'fruity', name: 'Grape',        price: 18, emoji: '🍇', desc: 'Classic grape flavor' },
  // Classic
  { id: 'double_apple',       category_seed_id: 'classic', name: 'Double Apple', price: 18, emoji: '🍏', desc: 'Traditional double apple' },
  { id: 'pan_ras',            category_seed_id: 'classic', name: 'Pan Ras',      price: 18, emoji: '🍃', desc: 'Aromatic pan masala flavor' },
  { id: 'love_66',            category_seed_id: 'classic', name: 'Love 66',      price: 18, emoji: '❤️', desc: 'Popular smooth blend' },
  { id: 'lady_killer',        category_seed_id: 'classic', name: 'Lady Killer',  price: 18, emoji: '🌹', desc: 'Bold and sophisticated' },
  { id: 'bagdadi',            category_seed_id: 'classic', name: 'Bagdadi',      price: 18, emoji: '🕌', desc: 'Rich Middle Eastern blend' },
  // Fresh & Cool
  { id: 'mint_pro',           category_seed_id: 'fresh_cool', name: 'Mint',        price: 18, emoji: '🌿', desc: 'Cool fresh mint' },
  { id: 'lemon_mint',         category_seed_id: 'fresh_cool', name: 'Lemon Mint',  price: 18, emoji: '🍋', desc: 'Citrus mint freshness' },
  { id: 'spring_breeze',      category_seed_id: 'fresh_cool', name: 'Spring Breeze', price: 18, emoji: '🌸', desc: 'Light floral breeze' },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SEED FUNCTION                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

const ICE_ADDONS_MODIFIER: any = {
  id: 'hookah_addons',
  name: 'Add-ons',
  required: false,
  max_selections: 2,
  options: [
    { id: 'ice_hose', name: 'Ice Hose', price_adjustment: 0 },
    { id: 'ice_base', name: 'Ice Base', price_adjustment: 0 },
  ],
};

async function seed() {
  console.log('🌱 Starting Cavali seed migration...\n');

  await MultiTenantDbService.initialize();

  // Check if Cavali already exists
  const existing = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (existing) {
    console.log('⚠️  Cavali restaurant already exists. Skipping seed.');
    process.exit(0);
  }

  // 1. Create Cavali restaurant
  const restaurant = await MultiTenantDbService.createRestaurant({
    slug: 'cavali',
    name: 'Cavali Hookah Lounge',
    branding: CAVALI_BRANDING,
    settings: CAVALI_SETTINGS,
    active: true,
  });
  console.log(`✅ Created restaurant: ${restaurant.name} (${restaurant._id})`);

  // 2. Create owner account (PIN: 1234)
  const owner = await MultiTenantDbService.createUser({
    restaurant_id: restaurant._id,
    name: 'Owner',
    email: 'owner@cavali.com',
    phone: null,
    role: 'owner',
    pin_hash: AuthService.hashPin('1234abcD'),
    active: true,
  });
  console.log(`✅ Created owner: ${owner.name} (${owner._id})`);

  // 3. Create default tables (1-12)
  for (let i = 1; i <= 12; i++) {
    await MultiTenantDbService.createTable({
      restaurant_id: restaurant._id,
      number: i,
      label: `Table ${i}`,
      capacity: i <= 8 ? 4 : 6,
      active: true,
    });
  }
  console.log(`✅ Created 12 tables`);

  // 4. Create menu categories and track their IDs
  const categoryIdMap: Record<string, string> = {};
  const allCategories = [...FOOD_CATEGORIES, ...DRINK_CATEGORIES, ...HOOKAH_CATEGORIES];

  for (const cat of allCategories) {
    const created = await MultiTenantDbService.createMenuCategory({
      restaurant_id: restaurant._id,
      title: cat.title,
      subtitle: cat.subtitle,
      icon: cat.icon,
      color: cat.color,
      sort_order: cat.sort_order,
      menu_type: cat.menu_type,
      active: true,
    });
    categoryIdMap[cat.id] = created._id;
  }
  console.log(`✅ Created ${allCategories.length} menu categories`);

  // 5. Create menu items
  const allItems = [...FOOD_ITEMS, ...DRINK_ITEMS, ...HOOKAH_ITEMS];
  let itemCount = 0;

  for (const item of allItems) {
    const categoryId = categoryIdMap[item.category_seed_id];
    if (!categoryId) {
      console.warn(`⚠️  Skipping item ${item.name}: category ${item.category_seed_id} not found`);
      continue;
    }

    // Add hookah addons modifier to all hookah items
    const modifiers = item.modifier_groups || [];
    if (item.category_seed_id.startsWith('house_') || ['fruity', 'classic', 'fresh_cool'].includes(item.category_seed_id)) {
      modifiers.push(ICE_ADDONS_MODIFIER);
    }

    const nameLower = item.name.toLowerCase();
    let assignedPhoto: string | null = null;
    const dishKeywordMap: Record<string, string> = {
      "hummus": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5854-scaled.jpg",
      "falafel": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5855-scaled.jpg",
      "fries": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5856-scaled.jpg",
      "wings": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5858-scaled.jpg",
      "slider": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5862-scaled.jpg",
      "burger": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5868-scaled.jpg",
      "kebab": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5904-scaled.jpg",
      "chops": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5906-scaled.jpg",
      "shawarma": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5910-scaled.jpg",
      "baklava": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6001-scaled.jpg",
      "cheesecake": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6003-scaled.jpg",
      "tea": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6005-scaled.jpg",
      "chai": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6006-scaled.jpg",
      "coffee": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6008-scaled.jpg",
      "mojito": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6010-scaled.jpg",
      "refresher": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__6012-scaled.jpg",
      "hookah": "https://cavallidallas.com/wp-content/uploads/2026/02/R6__5730-scaled.jpg"
    };
    for (const [kw, url] of Object.entries(dishKeywordMap)) {
      if (nameLower.includes(kw)) {
        assignedPhoto = url;
        break;
      }
    }
    if (!assignedPhoto) {
      assignedPhoto = `https://cavallidallas.com/wp-content/uploads/2026/02/R6__${5715 + (itemCount % 50)}-scaled.jpg`;
    }

    await MultiTenantDbService.createMenuItem({
      restaurant_id: restaurant._id,
      category_id: categoryId,
      name: item.name,
      price: item.price,
      desc: item.desc,
      emoji: item.emoji,
      image_url: assignedPhoto,
      available: true,
      modifier_groups: modifiers,
      sort_order: itemCount,
    });
    itemCount++;
  }
  console.log(`✅ Created ${itemCount} menu items`);

  // 6. Audit log
  await MultiTenantDbService.logAudit(
    restaurant._id,
    owner._id,
    owner.name,
    'restaurant_setting_changed',
    'restaurant',
    restaurant._id,
    { action: 'seed_migration', items_created: itemCount }
  );

  console.log(`\n🎉 Cavali seed migration complete!`);
  console.log(`   Restaurant ID: ${restaurant._id}`);
  console.log(`   Owner email:   owner@cavali.com`);
  console.log(`   Owner PIN:     1234`);
  console.log(`   Slug:          cavali`);

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
