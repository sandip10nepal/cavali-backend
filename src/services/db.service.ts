import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(__dirname, '../../multi_tenant_db.json');

export interface InventoryItem {
  id: string;
  name: string;
  category: 'shisha' | 'proteins' | 'dairy_bakery' | 'veggies' | 'dry_goods' | 'beverages' | 'desserts';
  stock: number;
  unit: string;
}

export type PaymentSessionStatus =
  | 'CREATED'
  | 'PAYMENT_REQUESTED'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED';

export interface PaymentSession {
  id: string;
  order_id: string;
  amount_cents: number;      // always integer cents, never float
  currency: string;          // e.g. "USD"
  status: PaymentSessionStatus;
  idempotency_key: string;
  square_payment_id: string | null;
  payment_device_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const DEFAULT_INVENTORY: Record<string, InventoryItem> = {
  // Hookah Raw Single Flavors (g) - House mixes are constructed from these
  pan_ras: { id: 'pan_ras', name: 'Pan Ras', category: 'shisha', stock: 1000, unit: 'g' },
  lady_killer: { id: 'lady_killer', name: 'Lady Killer', category: 'shisha', stock: 1000, unit: 'g' },
  bagdadi: { id: 'bagdadi', name: 'Bagdadi', category: 'shisha', stock: 1000, unit: 'g' },
  lychee: { id: 'lychee', name: 'Lychee', category: 'shisha', stock: 1000, unit: 'g' },
  blueberry: { id: 'blueberry', name: 'Blueberry', category: 'shisha', stock: 1000, unit: 'g' },
  red_bull_shisha: { id: 'red_bull_shisha', name: 'Red Bull Flavor', category: 'shisha', stock: 1000, unit: 'g' },
  dragon_fruit: { id: 'dragon_fruit', name: 'Dragon Fruit', category: 'shisha', stock: 1000, unit: 'g' },
  spice_shisha: { id: 'spice_shisha', name: 'Spice/Cinnamon', category: 'shisha', stock: 1000, unit: 'g' },
  mango: { id: 'mango', name: 'Mango', category: 'shisha', stock: 1000, unit: 'g' },
  peach: { id: 'peach', name: 'Peach', category: 'shisha', stock: 1000, unit: 'g' },
  vanilla: { id: 'vanilla', name: 'Vanilla', category: 'shisha', stock: 1000, unit: 'g' },
  cardamom: { id: 'cardamom', name: 'Cardamom', category: 'shisha', stock: 1000, unit: 'g' },
  cream_shisha: { id: 'cream_shisha', name: 'Sweet Cream', category: 'shisha', stock: 1000, unit: 'g' },
  watermelon_lit: { id: 'watermelon_lit', name: 'Watermelon Lit', category: 'shisha', stock: 1500, unit: 'g' },
  grape_hub: { id: 'grape_hub', name: 'Grape Hub', category: 'shisha', stock: 1500, unit: 'g' },
  mint_pro: { id: 'mint_pro', name: 'Mint Pro', category: 'shisha', stock: 2000, unit: 'g' },
  double_apple: { id: 'double_apple', name: 'Double Apple', category: 'shisha', stock: 2000, unit: 'g' },
  love_66: { id: 'love_66', name: 'Love 66', category: 'shisha', stock: 1500, unit: 'g' },
  spring_breeze: { id: 'spring_breeze', name: 'Spring Breeze', category: 'shisha', stock: 1000, unit: 'g' },
  lemon_mint: { id: 'lemon_mint', name: 'Lemon Mint', category: 'shisha', stock: 1500, unit: 'g' },

  // Proteins (g or pcs)
  chicken_breast: { id: 'chicken_breast', name: 'Chicken Breast', category: 'proteins', stock: 5000, unit: 'g' },
  beef_patty: { id: 'beef_patty', name: 'Beef Smash Patty', category: 'proteins', stock: 100, unit: 'pcs' },
  spiced_patty: { id: 'spiced_patty', name: 'Kabob Spiced Patty', category: 'proteins', stock: 50, unit: 'pcs' },
  beef_koobideh: { id: 'beef_koobideh', name: 'Beef Koobideh Skewers', category: 'proteins', stock: 40, unit: 'pcs' },
  lamb_chops: { id: 'lamb_chops', name: 'Lamb Chops', category: 'proteins', stock: 30, unit: 'pcs' },
  shami_kabob: { id: 'shami_kabob', name: 'Beef Shami Kabob', category: 'proteins', stock: 40, unit: 'pcs' },
  shawarma_meat: { id: 'shawarma_meat', name: 'Shawarma Meat', category: 'proteins', stock: 5000, unit: 'g' },
  dumpling_meat: { id: 'dumpling_meat', name: 'Momo Meat Filling', category: 'proteins', stock: 2000, unit: 'g' },
  tenders: { id: 'tenders', name: 'Chicken Tenders', category: 'proteins', stock: 80, unit: 'pcs' },

  // Dairy & Bakery (ml, slices, pcs)
  milk: { id: 'milk', name: 'Whole Milk', category: 'dairy_bakery', stock: 5000, unit: 'ml' },
  yogurt: { id: 'yogurt', name: 'Greek Yogurt', category: 'dairy_bakery', stock: 2000, unit: 'g' },
  swiss_cheese: { id: 'swiss_cheese', name: 'Swiss Cheese Slices', category: 'dairy_bakery', stock: 60, unit: 'slices' },
  american_cheese: { id: 'american_cheese', name: 'American Cheese Slices', category: 'dairy_bakery', stock: 100, unit: 'slices' },
  sour_cream: { id: 'sour_cream', name: 'Sour Cream', category: 'dairy_bakery', stock: 1000, unit: 'g' },
  pita_bread: { id: 'pita_bread', name: 'Warm Pita Bread', category: 'dairy_bakery', stock: 50, unit: 'pcs' },
  soft_bun: { id: 'soft_bun', name: 'Soft Buns', category: 'dairy_bakery', stock: 50, unit: 'pcs' },
  burger_bun: { id: 'burger_bun', name: 'Brioche Burger Buns', category: 'dairy_bakery', stock: 60, unit: 'pcs' },
  naan: { id: 'naan', name: 'Naan Bread', category: 'dairy_bakery', stock: 50, unit: 'pcs' },
  dumpling_wrappers: { id: 'dumpling_wrappers', name: 'Momo Dumpling Wrappers', category: 'dairy_bakery', stock: 300, unit: 'pcs' },

  // Veggies & Fruits (g, pcs)
  chickpeas: { id: 'chickpeas', name: 'Dry Chickpeas', category: 'veggies', stock: 4000, unit: 'g' },
  potatoes: { id: 'potatoes', name: 'Potatoes', category: 'veggies', stock: 10000, unit: 'g' },
  lettuce: { id: 'lettuce', name: 'Lettuce', category: 'veggies', stock: 1000, unit: 'g' },
  onions: { id: 'onions', name: 'Onions', category: 'veggies', stock: 2000, unit: 'g' },
  mushrooms: { id: 'mushrooms', name: 'Swiss Mushrooms', category: 'veggies', stock: 1500, unit: 'g' },
  mint_leaves: { id: 'mint_leaves', name: 'Fresh Mint Leaves', category: 'veggies', stock: 500, unit: 'g' },
  lime: { id: 'lime', name: 'Fresh Lime', category: 'veggies', stock: 40, unit: 'pcs' },
  watermelon: { id: 'watermelon', name: 'Fresh Watermelon', category: 'veggies', stock: 10000, unit: 'g' },
  orange_fruit: { id: 'orange_fruit', name: 'Fresh Oranges', category: 'veggies', stock: 50, unit: 'pcs' },
  guacamole: { id: 'guacamole', name: 'Fresh Guacamole', category: 'veggies', stock: 2000, unit: 'g' },
  jalapenos: { id: 'jalapenos', name: 'Jalapenos', category: 'veggies', stock: 1000, unit: 'g' },

  // Dry Goods / Cans / Other (g, pcs)
  tahini: { id: 'tahini', name: 'Tahini Paste', category: 'dry_goods', stock: 2000, unit: 'g' },
  chickpea_flour: { id: 'chickpea_flour', name: 'Chickpea Flour', category: 'dry_goods', stock: 5000, unit: 'g' },
  samosa_wrappers: { id: 'samosa_wrappers', name: 'Samosa Pastry Triangles', category: 'dry_goods', stock: 120, unit: 'pcs' },
  wafers: { id: 'wafers', name: 'Crisp Papri Wafers', category: 'dry_goods', stock: 2000, unit: 'g' },
  hollow_puris: { id: 'hollow_puris', name: 'Hollow Puris', category: 'dry_goods', stock: 150, unit: 'pcs' },
  basmati_rice: { id: 'basmati_rice', name: 'Basmati Rice', category: 'dry_goods', stock: 8000, unit: 'g' },
  lentils: { id: 'lentils', name: 'Daal Lentils', category: 'dry_goods', stock: 5000, unit: 'g' },
  tortilla_chips: { id: 'tortilla_chips', name: 'Tortilla Chips', category: 'dry_goods', stock: 4000, unit: 'g' },
  queso_dip: { id: 'queso_dip', name: 'Queso Cheese Dip', category: 'dry_goods', stock: 3000, unit: 'ml' },
  black_tea: { id: 'black_tea', name: 'Black Tea Dust', category: 'dry_goods', stock: 1000, unit: 'g' },
  pink_tea: { id: 'pink_tea', name: 'Kashmiri Pink Tea Leaves', category: 'dry_goods', stock: 500, unit: 'g' },
  coffee_beans: { id: 'coffee_beans', name: 'Desi Coffee Beans', category: 'dry_goods', stock: 1000, unit: 'g' },
  syrup: { id: 'syrup', name: 'Mojito Fruit Syrup', category: 'dry_goods', stock: 2000, unit: 'ml' },
  soda: { id: 'soda', name: 'Club Soda', category: 'dry_goods', stock: 5000, unit: 'ml' },
  frozen_fries: { id: 'frozen_fries', name: 'Frozen Seasoned Fries', category: 'dry_goods', stock: 15000, unit: 'g' },

  // Desserts (pcs)
  caramel_cake: { id: 'caramel_cake', name: 'Caramel Crunch Slices', category: 'desserts', stock: 15, unit: 'pcs' },
  pistachio_cake: { id: 'pistachio_cake', name: 'Pistachio Cake Slices', category: 'desserts', stock: 15, unit: 'pcs' },
  raspberry_cake: { id: 'raspberry_cake', name: 'Raspberry White Choc Slices', category: 'desserts', stock: 15, unit: 'pcs' },
  chocolate_cake: { id: 'chocolate_cake', name: 'Chocolate Cake Slices', category: 'desserts', stock: 15, unit: 'pcs' },
  butterscotch_cake: { id: 'butterscotch_cake', name: 'Butterscotch Pudding Slices', category: 'desserts', stock: 15, unit: 'pcs' },

  // Cans / Beverages (pcs)
  coca_cola: { id: 'coca_cola', name: 'Coca-Cola Cans', category: 'beverages', stock: 48, unit: 'cans' },
  coke_zero: { id: 'coke_zero', name: 'Coke Zero Cans', category: 'beverages', stock: 48, unit: 'cans' },
  fanta: { id: 'fanta', name: 'Fanta Cans', category: 'beverages', stock: 24, unit: 'cans' },
  ginger_ale: { id: 'ginger_ale', name: 'Ginger Ale Cans', category: 'beverages', stock: 24, unit: 'cans' },
  sprite: { id: 'sprite', name: 'Sprite Cans', category: 'beverages', stock: 48, unit: 'cans' },
  dr_pepper: { id: 'dr_pepper', name: 'Dr Pepper Cans', category: 'beverages', stock: 24, unit: 'cans' },
  red_bull: { id: 'red_bull', name: 'Red Bull Cans', category: 'beverages', stock: 36, unit: 'cans' },
  sparkling_water: { id: 'sparkling_water', name: 'Sparkling Water Cans', category: 'beverages', stock: 24, unit: 'cans' },
  saratoga_water: { id: 'saratoga_water', name: 'Saratoga Water Bottles', category: 'beverages', stock: 24, unit: 'bottles' }
};

export interface Employee {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'cashier' | 'kitchen';
  pin: string;           // 4-digit PIN stored as plain string (local system)
  active: boolean;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  amount: number;        // dollars
  reason: string;
  items: any[];          // refunded items (empty = full refund)
  isFullRefund: boolean;
  issuedBy: string;      // employee name
  createdAt: string;
}

export interface TaxConfig {
  defaultRate: number;   // e.g. 0.0825 = 8.25%
  hookahRate: number;
  foodRate: number;
  drinksRate: number;
}

export interface Discount {
  id: string;
  name: string;
  code: string;
  type: 'percent' | 'fixed';  // % off or $ off
  value: number;
  active: boolean;
  createdAt: string;
}

export type MenuCategory =
  | 'appetizers'
  | 'mains'
  | 'burgers'
  | 'wraps'
  | 'wings'
  | 'vegetarian'
  | 'continental'
  | 'desserts'
  | 'drinks_refreshers'
  | 'drinks_tea_coffee'
  | 'drinks_soft'
  | 'hookah';

export interface MenuItem {
  id: string;                  // e.g. "but_chk"
  name: string;                // "Butter Chicken"
  category: MenuCategory;
  price: number;               // dollars
  emoji: string;               // "🍛"
  image_url?: string;          // Photo URL
  desc: string;
  available: boolean;          // toggle visibility on the ordering app
  requiresSauce?: boolean;
  sort_order?: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // ── APPETIZERS ───────────────────────────────────────────────────────────
  { id: 'hummus',   name: 'Hummus & Pita',          category: 'appetizers', price: 9,  emoji: '🫘', desc: 'House hummus with warm pita bread.', available: true, createdAt: '', updatedAt: '' },
  { id: 'falafel',  name: 'Falafel',                 category: 'appetizers', price: 9,  emoji: '🧆', desc: 'Crispy chickpea fritters with tahini dip.', available: true, createdAt: '', updatedAt: '' },
  { id: 'dyn_chk',  name: 'Dynamite Chicken',        category: 'appetizers', price: 12, emoji: '🌶️', desc: 'Crispy chicken tossed in our fiery dynamite sauce.', available: true, createdAt: '', updatedAt: '' },
  { id: 'bun_kab',  name: 'Bun Kabob',               category: 'appetizers', price: 9,  emoji: '🥙', desc: 'South Asian street-style spiced patty in a soft bun.', available: true, createdAt: '', updatedAt: '' },
  { id: 'samosa',   name: 'Samosa',                  category: 'appetizers', price: 8,  emoji: '🔺', desc: 'Crispy pastry triangles – vegetable, chicken, or beef. (3 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'papri',    name: 'Papri Chaat',              category: 'appetizers', price: 10, emoji: '🥗', desc: 'Crisp wafers, chickpeas, yogurt, tamarind & chutneys.', available: true, createdAt: '', updatedAt: '' },
  { id: 'pani',     name: 'Pani Puri',               category: 'appetizers', price: 10, emoji: '🫙', desc: 'Hollow puris filled with spiced potato, chickpeas & tangy water. (6 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'spy_pot',  name: 'Spicy Potatoes',           category: 'appetizers', price: 8,  emoji: '🥔', desc: 'Crispy fried potatoes with a fiery spice rub.', available: true, createdAt: '', updatedAt: '' },
  { id: 'tenders',  name: 'Chicken Tenders',          category: 'appetizers', price: 13, emoji: '🍗', desc: 'Golden crispy tenders served with seasoned fries & dipping sauce.', available: true, createdAt: '', updatedAt: '' },
  { id: 'pizza_b',  name: 'Pita Pizza Bites',         category: 'appetizers', price: 9,  emoji: '🍕', desc: 'Mini pita pizzas with cheese and toppings.', available: true, createdAt: '', updatedAt: '' },
  { id: 'fries',    name: 'Seasoned Fries',           category: 'appetizers', price: 7,  emoji: '🍟', desc: 'Crispy house-seasoned fries.', available: true, createdAt: '', updatedAt: '' },
  { id: 'ld_fries', name: 'Loaded Fries',             category: 'appetizers', price: 10, emoji: '🍟', desc: 'Seasoned fries topped with queso, jalapenos & sour cream.', available: true, createdAt: '', updatedAt: '' },
  { id: 'ld_nachos',name: 'Loaded Nachos',            category: 'appetizers', price: 11, emoji: '🫔', desc: 'Tortilla chips with queso, jalapenos & sour cream.', available: true, createdAt: '', updatedAt: '' },
  { id: 'chips_q',  name: 'Chips & Queso',            category: 'appetizers', price: 9,  emoji: '🧀', desc: 'Tortilla chips with warm queso cheese dip.', available: true, createdAt: '', updatedAt: '' },
  { id: 'chips_g',  name: 'Chips & Guacamole',        category: 'appetizers', price: 9,  emoji: '🥑', desc: 'Tortilla chips with fresh house guacamole.', available: true, createdAt: '', updatedAt: '' },
  // ── MAINS ────────────────────────────────────────────────────────────────
  { id: 'shaw_pl',  name: 'Shawarma Plate',           category: 'mains', price: 17, emoji: '🌯', desc: 'Marinated meat over seasoned fries with garlic sauce.', available: true, createdAt: '', updatedAt: '' },
  { id: 'koobideh', name: 'Beef Koobideh',            category: 'mains', price: 18, emoji: '🍢', desc: 'Persian-style ground beef skewers, grilled to perfection.', available: true, createdAt: '', updatedAt: '' },
  { id: 'chk_boti', name: 'Chicken Boti',             category: 'mains', price: 16, emoji: '🍖', desc: 'Tandoori marinated chicken chunks on naan.', available: true, createdAt: '', updatedAt: '' },
  { id: 'chk_kab',  name: 'Chicken Kabob Plate',      category: 'mains', price: 16, emoji: '🍛', desc: 'Grilled chicken kabob over basmati rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'lamb_ch',  name: 'Lamb Chops',               category: 'mains', price: 26, emoji: '🥩', desc: 'Premium lamb chops grilled with herbs, served with potatoes.', available: true, createdAt: '', updatedAt: '' },
  { id: 'but_chk',  name: 'Butter Chicken',           category: 'mains', price: 20, emoji: '🍛', desc: 'Tandoori chicken in a rich tomato-cream gravy with rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'biryani',  name: 'Chicken Biryani',          category: 'mains', price: 18, emoji: '🍚', desc: 'Fragrant basmati rice slow-cooked with marinated chicken & spices.', available: true, createdAt: '', updatedAt: '' },
  // ── WINGS ────────────────────────────────────────────────────────────────
  { id: 'wings6',   name: '6 pc Wings',               category: 'wings', price: 11, emoji: '🍗', desc: 'Buffalo | BBQ | Garlic Parmesan | Lemon Pepper | Honey BBQ | Mango Habanero', available: true, requiresSauce: true, createdAt: '', updatedAt: '' },
  { id: 'wings10',  name: '10 pc Wings',              category: 'wings', price: 17, emoji: '🍗', desc: 'Buffalo | BBQ | Garlic Parmesan | Lemon Pepper | Honey BBQ | Mango Habanero', available: true, requiresSauce: true, createdAt: '', updatedAt: '' },
  // ── VEGETARIAN ───────────────────────────────────────────────────────────
  { id: 'v_papri',  name: 'Papri Chaat (V)',          category: 'vegetarian', price: 10, emoji: '🥗', desc: 'Crisp wafers, chickpeas, yogurt, tamarind & chutneys.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_pani',   name: 'Pani Puri (V)',            category: 'vegetarian', price: 10, emoji: '🫙', desc: 'Hollow puris with spiced potato & tangy water.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_spypot', name: 'Spicy Potatoes (V)',        category: 'vegetarian', price: 8,  emoji: '🥔', desc: 'Crispy fried potatoes with fiery spice rub.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_fal',    name: 'Falafel (V)',               category: 'vegetarian', price: 9,  emoji: '🧆', desc: 'Crispy chickpea fritters with tahini dip.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_hum',    name: 'Hummus & Pita (V)',         category: 'vegetarian', price: 9,  emoji: '🫘', desc: 'House hummus with warm pita bread.', available: true, createdAt: '', updatedAt: '' },
  { id: 'paneer_m', name: 'Paneer Momo',              category: 'vegetarian', price: 12, emoji: '🥟', desc: 'Steamed dumplings filled with spiced paneer. (6 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'veg_sam',  name: 'Veggie Samosa (V)',         category: 'vegetarian', price: 8,  emoji: '🔺', desc: 'Crispy pastry triangles with vegetable filling. (3 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_chipsq', name: 'Chips & Queso (V)',         category: 'vegetarian', price: 9,  emoji: '🧀', desc: 'Tortilla chips with warm queso cheese dip.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_chipsg', name: 'Chips & Guacamole (V)',     category: 'vegetarian', price: 9,  emoji: '🥑', desc: 'Tortilla chips with fresh house guacamole.', available: true, createdAt: '', updatedAt: '' },
  { id: 'daal_c',   name: 'Daal Chawal (V)',           category: 'vegetarian', price: 13, emoji: '🍲', desc: 'Slow-simmered lentils with basmati rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_fries',  name: 'Seasoned Fries (V)',        category: 'vegetarian', price: 7,  emoji: '🍟', desc: 'Crispy house-seasoned fries.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_ldfr',   name: 'Loaded Fries (V)',          category: 'vegetarian', price: 10, emoji: '🍟', desc: 'Seasoned fries with queso & jalapenos.', available: true, createdAt: '', updatedAt: '' },
  { id: 'v_ldna',   name: 'Loaded Nachos (V)',         category: 'vegetarian', price: 11, emoji: '🫔', desc: 'Tortilla chips with queso & jalapenos.', available: true, createdAt: '', updatedAt: '' },
  // ── BURGERS ──────────────────────────────────────────────────────────────
  { id: 'smash',    name: 'Double Smash Burger',      category: 'burgers', price: 16, emoji: '🍔', desc: 'Two smashed beef patties with American cheese on a brioche bun.', available: true, createdAt: '', updatedAt: '' },
  { id: 'zinger',   name: 'Zinger Burger',            category: 'burgers', price: 14, emoji: '🍔', desc: 'Crispy chicken fillet with lettuce & sauce on a brioche bun.', available: true, createdAt: '', updatedAt: '' },
  { id: 'club',     name: 'Club Sandwich',            category: 'burgers', price: 13, emoji: '🥪', desc: 'Layered grilled chicken, lettuce & sauce.', available: true, createdAt: '', updatedAt: '' },
  { id: 'swiss_m',  name: 'Swiss Mushroom Burger',    category: 'burgers', price: 16, emoji: '🍔', desc: 'Beef patty with Swiss cheese, sautéed mushrooms & onions.', available: true, createdAt: '', updatedAt: '' },
  // ── WRAPS ────────────────────────────────────────────────────────────────
  { id: 'shaw_w',   name: 'Shawarma Wrap',            category: 'wraps', price: 13, emoji: '🌯', desc: 'Marinated shawarma in warm pita with garlic sauce.', available: true, createdAt: '', updatedAt: '' },
  { id: 'dyn_w',    name: 'Dynamite Wrap',            category: 'wraps', price: 13, emoji: '🌯', desc: 'Crispy chicken tossed in dynamite sauce in a pita.', available: true, createdAt: '', updatedAt: '' },
  { id: 'zing_w',   name: 'Zinger Wrap',              category: 'wraps', price: 12, emoji: '🌯', desc: 'Crispy chicken fillet in a soft bun wrap.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mir_p',    name: 'Mirchi Paratha Roll',      category: 'wraps', price: 12, emoji: '🫓', desc: 'Spiced chicken in a flaky naan paratha roll.', available: true, createdAt: '', updatedAt: '' },
  // ── CONTINENTAL ──────────────────────────────────────────────────────────
  { id: 'tacos',    name: 'Chicken Tacos',            category: 'continental', price: 13, emoji: '🌮', desc: 'Seasoned chicken tacos with toppings. (3 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'c_chipsq', name: 'Chips & Queso',            category: 'continental', price: 9,  emoji: '🧀', desc: 'Tortilla chips with warm queso cheese dip.', available: true, createdAt: '', updatedAt: '' },
  { id: 'chili_c',  name: 'Chili Chicken',            category: 'continental', price: 17, emoji: '🌶️', desc: 'Wok-tossed chicken in a bold chili sauce with rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mongo_c',  name: 'Mongolian Chicken',        category: 'continental', price: 17, emoji: '🥢', desc: 'Tender chicken in a sweet soy-ginger glaze with rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'momo',     name: 'Chicken Momo',             category: 'continental', price: 12, emoji: '🥟', desc: 'Steamed dumplings filled with spiced chicken. (6 pc)', available: true, createdAt: '', updatedAt: '' },
  { id: 'chow',     name: 'Chow Mein',                category: 'continental', price: 13, emoji: '🍜', desc: 'Stir-fried noodles with vegetables & your choice of protein.', available: true, createdAt: '', updatedAt: '' },
  { id: 'daal_s',   name: 'Daal with Shami',          category: 'continental', price: 15, emoji: '🍲', desc: 'Slow-simmered lentils with beef shami kabob & rice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'cordon',   name: 'Chicken Cordon Bleu',      category: 'continental', price: 20, emoji: '🍽️', desc: 'Stuffed chicken with American cheese, served with potatoes.', available: true, createdAt: '', updatedAt: '' },
  // ── DESSERTS ─────────────────────────────────────────────────────────────
  { id: 'car_cr',   name: 'Caramel Crunch Cake',      category: 'desserts', price: 9,  emoji: '🍰', desc: 'Decadent caramel crunch cake slice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'pis_ck',   name: 'Pistachio Cake',           category: 'desserts', price: 9,  emoji: '🍰', desc: 'Delicate pistachio cake slice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'rasp_ck',  name: 'Raspberry White Choc Cake',category: 'desserts', price: 9,  emoji: '🍰', desc: 'Raspberry & white chocolate cake slice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'choc_ck',  name: 'Chocolate Cake',           category: 'desserts', price: 9,  emoji: '🍫', desc: 'Rich chocolate cake slice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'butt_b',   name: 'Butterscotch Pudding',     category: 'desserts', price: 9,  emoji: '🍮', desc: 'Creamy butterscotch pudding cake slice.', available: true, createdAt: '', updatedAt: '' },
  // ── DRINKS: REFRESHERS ───────────────────────────────────────────────────
  { id: 'cl_moj',   name: 'Classic Mojito',           category: 'drinks_refreshers', price: 7,  emoji: '🍹', desc: 'Mint, lime, soda & house mojito syrup.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mn_moj',   name: 'Mango Mojito',             category: 'drinks_refreshers', price: 7,  emoji: '🥭', desc: 'Mango syrup, mint & soda.', available: true, createdAt: '', updatedAt: '' },
  { id: 'ly_moj',   name: 'Lychee Mojito',            category: 'drinks_refreshers', price: 7,  emoji: '🍹', desc: 'Lychee syrup, mint & soda.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mt_marg',  name: 'Mint Margarita',           category: 'drinks_refreshers', price: 7,  emoji: '🍸', desc: 'Fresh mint, lime & soda shaken with ice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'rm_fire',  name: 'Watermelon Firecracker',   category: 'drinks_refreshers', price: 8,  emoji: '🍉', desc: 'Fresh watermelon juice with a spicy kick.', available: true, createdAt: '', updatedAt: '' },
  { id: 'wm_jce',   name: 'Watermelon Juice',         category: 'drinks_refreshers', price: 7,  emoji: '🍉', desc: 'Fresh-pressed watermelon juice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'or_jce',   name: 'Fresh Orange Juice',       category: 'drinks_refreshers', price: 7,  emoji: '🍊', desc: 'Cold-pressed fresh orange juice.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mn_shk',   name: 'Mango Shake',              category: 'drinks_refreshers', price: 7,  emoji: '🥤', desc: 'Creamy mango milkshake.', available: true, createdAt: '', updatedAt: '' },
  { id: 'sw_las',   name: 'Sweet Lassi',              category: 'drinks_refreshers', price: 6,  emoji: '🥛', desc: 'Traditional sweet yogurt drink.', available: true, createdAt: '', updatedAt: '' },
  // ── DRINKS: TEA & COFFEE ─────────────────────────────────────────────────
  { id: 'karak',    name: 'Karak Chai',               category: 'drinks_tea_coffee', price: 5,  emoji: '☕', desc: 'Spiced black tea brewed with milk.', available: true, createdAt: '', updatedAt: '' },
  { id: 'kash_c',   name: 'Kashmiri Chai',            category: 'drinks_tea_coffee', price: 6,  emoji: '🍵', desc: 'Pink Kashmiri tea with nuts & cream.', available: true, createdAt: '', updatedAt: '' },
  { id: 'desi_c',   name: 'Desi Coffee',              category: 'drinks_tea_coffee', price: 5,  emoji: '☕', desc: 'Strong South Asian-style coffee with milk.', available: true, createdAt: '', updatedAt: '' },
  { id: 'cold_c',   name: 'Cold Coffee',              category: 'drinks_tea_coffee', price: 6,  emoji: '🥤', desc: 'Iced blended coffee.', available: true, createdAt: '', updatedAt: '' },
  { id: 'mint_t',   name: 'Mint Tea',                 category: 'drinks_tea_coffee', price: 4,  emoji: '🌿', desc: 'Fresh mint herbal tea.', available: true, createdAt: '', updatedAt: '' },
  { id: 'moroc_t',  name: 'Moroccan Mint Tea',        category: 'drinks_tea_coffee', price: 5,  emoji: '🍵', desc: 'Traditional Moroccan mint tea.', available: true, createdAt: '', updatedAt: '' },
  // ── DRINKS: SOFT DRINKS ──────────────────────────────────────────────────
  { id: 'coca',     name: 'Coca-Cola',                category: 'drinks_soft', price: 4, emoji: '🥤', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'coke_z',   name: 'Coke Zero',               category: 'drinks_soft', price: 4, emoji: '🥤', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'fanta',    name: 'Fanta',                   category: 'drinks_soft', price: 4, emoji: '🧡', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'ging_a',   name: 'Ginger Ale',              category: 'drinks_soft', price: 4, emoji: '🥤', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'sprite',   name: 'Sprite',                  category: 'drinks_soft', price: 4, emoji: '🥤', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'drpep',    name: 'Dr Pepper',               category: 'drinks_soft', price: 4, emoji: '🥤', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'redbull',  name: 'Red Bull',                category: 'drinks_soft', price: 5, emoji: '⚡', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'spark_w',  name: 'Sparkling Water',         category: 'drinks_soft', price: 3, emoji: '💧', desc: '', available: true, createdAt: '', updatedAt: '' },
  { id: 'sara_w',   name: 'Saratoga Water',          category: 'drinks_soft', price: 4, emoji: '💧', desc: '', available: true, createdAt: '', updatedAt: '' },
].map(item => ({ ...item, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() })) as MenuItem[];

interface DatabaseSchema {
  orders: any[];
  inventory: Record<string, InventoryItem>;
  paymentSessions: PaymentSession[];
  employees: Employee[];
  refunds: Refund[];
  taxConfig: TaxConfig;
  discounts: Discount[];
  closedDays: any[];
  menuItems: MenuItem[];
}

export class DbService {
  private static cachedDb: DatabaseSchema | null = null;
  private static client: any = null;
  private static dbInstance: any = null;

  // Asynchronous initializer called on server startup
  static async initialize() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (MONGODB_URI) {
      console.log('🔌 [MongoDB] Connecting to database...');
      try {
        const { MongoClient } = require('mongodb');
        DbService.client = new MongoClient(MONGODB_URI);
        await DbService.client.connect();
        DbService.dbInstance = DbService.client.db();
        console.log('🔌 [MongoDB] Connected successfully.');

        const col = DbService.dbInstance.collection('state');
        let doc = await col.findOne({ _id: 'cavali_state' });
        
        if (!doc) {
          console.log('🔌 [MongoDB] Creating initial state document in cloud...');
          doc = {
            _id: 'cavali_state',
            orders: [],
            inventory: { ...DEFAULT_INVENTORY }
          };
          await col.insertOne(doc);
        }

        // Standardize inventory categories and clear stale configs
        const cleanedInventory: Record<string, InventoryItem> = {};
        const sourceInv = doc.inventory || {};
        for (const [id, value] of Object.entries(DEFAULT_INVENTORY)) {
          cleanedInventory[id] = sourceInv[id] || value;
        }

        DbService.cachedDb = {
          orders: doc.orders || [],
          inventory: cleanedInventory,
          paymentSessions: doc.paymentSessions || [],
          employees: doc.employees || DbService.defaultEmployees(),
          refunds: doc.refunds || [],
          taxConfig: doc.taxConfig || DbService.defaultTaxConfig(),
          discounts: doc.discounts || [],
          closedDays: doc.closedDays || [],
          menuItems: doc.menuItems || DEFAULT_MENU_ITEMS
        };
      } catch (err) {
        console.error('❌ [MongoDB] Connection error, falling back to local db.json:', err);
        DbService.initializeLocal();
      }
    } else {
      console.log('📁 [LocalDB] MONGODB_URI environment variable not found, using local db.json.');
      DbService.initializeLocal();
    }
  }

  private static initializeLocal() {
    DbService.cachedDb = DbService.loadLocalDb();
  }

  private static initializeSync() {
    if (!DbService.cachedDb) {
      DbService.cachedDb = DbService.loadLocalDb();
    }
  }

  private static defaultEmployees(): Employee[] {
    const now = new Date().toISOString();
    return [
      { id: 'emp-owner', name: 'Manager / Owner', role: 'owner', pin: '1234', active: true, createdAt: now },
      { id: 'emp-server', name: 'Server', role: 'cashier', pin: '1234', active: true, createdAt: now },
      { id: 'emp-chef', name: 'Chef', role: 'kitchen', pin: '1234', active: true, createdAt: now },
      { id: 'emp-bartender', name: 'Bartender', role: 'kitchen', pin: '1234', active: true, createdAt: now },
      { id: 'emp-hookah', name: 'Hookah Maker', role: 'kitchen', pin: '1234', active: true, createdAt: now }
    ];
  }

  private static defaultTaxConfig(): TaxConfig {
    return { defaultRate: 0.0825, hookahRate: 0.0825, foodRate: 0.0825, drinksRate: 0.0825 };
  }

  private static loadLocalDb(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.inventory) parsed.inventory = { ...DEFAULT_INVENTORY };
        if (!parsed.paymentSessions) parsed.paymentSessions = [];
        if (!parsed.employees || parsed.employees.length === 0) parsed.employees = DbService.defaultEmployees();
        if (!parsed.refunds) parsed.refunds = [];
        if (!parsed.taxConfig) parsed.taxConfig = DbService.defaultTaxConfig();
        if (!parsed.discounts) parsed.discounts = [];
        if (!parsed.closedDays) parsed.closedDays = [];
        if (!parsed.menuItems || parsed.menuItems.length === 0) parsed.menuItems = DEFAULT_MENU_ITEMS;
        
        // Force inventory cleanup to remove deleted items if they exist in file
        const cleanedInventory: Record<string, InventoryItem> = {};
        for (const [id, value] of Object.entries(DEFAULT_INVENTORY)) {
          cleanedInventory[id] = parsed.inventory[id] || value;
        }
        parsed.inventory = cleanedInventory;
        
        return parsed;
      }
    } catch (e) {
      console.error('Error loading db.json, resetting database.', e);
    }
    
    const initialDb: DatabaseSchema = {
      orders: [],
      inventory: { ...DEFAULT_INVENTORY },
      paymentSessions: [],
      employees: DbService.defaultEmployees(),
      refunds: [],
      taxConfig: DbService.defaultTaxConfig(),
      discounts: [],
      closedDays: [],
      menuItems: DEFAULT_MENU_ITEMS
    };
    DbService.saveDb(initialDb);
    return initialDb;
  }

  static saveDb(data: DatabaseSchema) {
    DbService.cachedDb = data;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (MONGODB_URI && DbService.dbInstance) {
      // Async write-behind persist to MongoDB Atlas
      const col = DbService.dbInstance.collection('state');
      col.updateOne(
        { _id: 'cavali_state' },
        { $set: {
          orders: data.orders,
          inventory: data.inventory,
          paymentSessions: data.paymentSessions,
          employees: data.employees,
          refunds: data.refunds,
          taxConfig: data.taxConfig,
          discounts: data.discounts,
          closedDays: data.closedDays,
          menuItems: data.menuItems
        }},
        { upsert: true }
      ).catch((err: any) => {
        console.error('❌ [MongoDB] Async write-behind update failed:', err);
      });
    } else {
      // Local write-behind fallback to db.json
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) {
        console.error('Error writing db.json', e);
      }
    }
  }

  static getOrders(): any[] {
    DbService.initializeSync();
    return DbService.cachedDb!.orders;
  }

  static addOrder(order: any) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    db.orders.push(order);
    DbService.saveDb(db);
  }

  static updateOrderStatus(orderId: string, status: string) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const idx = db.orders.findIndex(o => String(o.id) === String(orderId));
    if (idx >= 0) {
      db.orders[idx].status = status;
      DbService.saveDb(db);
    }
  }

  static updateOrder(orderId: string, fields: Partial<any>): any | undefined {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const cleanTargetId = String(orderId).replace(/^cav-/, '');
    const idx = db.orders.findIndex(o => String(o.id).replace(/^cav-/, '') === cleanTargetId);
    if (idx >= 0) {
      db.orders[idx] = { ...db.orders[idx], ...fields };
      DbService.saveDb(db);
      return db.orders[idx];
    }
    return undefined;
  }

  static deleteOrder(orderId: string): boolean {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const cleanTargetId = String(orderId).replace(/^cav-/, '');
    const idx = db.orders.findIndex(o => String(o.id).replace(/^cav-/, '') === cleanTargetId);
    if (idx >= 0) {
      db.orders.splice(idx, 1);
      // Also delete any payment sessions associated with this order
      db.paymentSessions = db.paymentSessions.filter((s: PaymentSession) => String(s.order_id).replace(/^cav-/, '') !== cleanTargetId);
      DbService.saveDb(db);
      return true;
    }
    return false;
  }

  static getInventory(): Record<string, InventoryItem> {
    DbService.initializeSync();
    return DbService.cachedDb!.inventory;
  }

  static deductInventory(ingredientId: string, amount: number) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (db.inventory[ingredientId]) {
      db.inventory[ingredientId].stock = Math.max(0, Number(db.inventory[ingredientId].stock) - Number(amount));
      DbService.saveDb(db);
    }
  }

  static restockInventory(ingredientId: string, amount: number) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (db.inventory[ingredientId]) {
      db.inventory[ingredientId].stock = Number(db.inventory[ingredientId].stock) + Number(amount);
      DbService.saveDb(db);
    }
  }

  static reduceInventory(ingredientId: string, amount: number) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (db.inventory[ingredientId]) {
      db.inventory[ingredientId].stock = Math.max(0, Number(db.inventory[ingredientId].stock) - Number(amount));
      DbService.saveDb(db);
    }
  }

  static clearArchivedOrders() {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    db.orders = db.orders.filter((o: any) => o.status !== 'fulfilled');
    DbService.saveDb(db);
  }

  // ── Payment Session CRUD ──────────────────────────────────────────────

  static getPaymentSessions(): PaymentSession[] {
    DbService.initializeSync();
    return DbService.cachedDb!.paymentSessions || [];
  }

  static getPaymentSession(id: string): PaymentSession | undefined {
    return DbService.getPaymentSessions().find(s => s.id === id);
  }

  static getPaymentSessionsByOrderId(orderId: string): PaymentSession[] {
    return DbService.getPaymentSessions().filter(s => s.order_id === String(orderId));
  }

  static addPaymentSession(session: PaymentSession) {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.paymentSessions) db.paymentSessions = [];
    db.paymentSessions.push(session);
    DbService.saveDb(db);
  }

  static updatePaymentSession(id: string, fields: Partial<PaymentSession>): PaymentSession | undefined {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.paymentSessions) db.paymentSessions = [];
    const idx = db.paymentSessions.findIndex(s => s.id === id);
    if (idx < 0) return undefined;
    db.paymentSessions[idx] = { ...db.paymentSessions[idx], ...fields, updated_at: new Date().toISOString() };
    DbService.saveDb(db);
    return db.paymentSessions[idx];
  }

  // ── Employee CRUD ─────────────────────────────────────────────────────

  static getEmployees(): Employee[] {
    DbService.initializeSync();
    return DbService.cachedDb!.employees || [];
  }

  static getEmployee(id: string): Employee | undefined {
    return DbService.getEmployees().find(e => e.id === id);
  }

  static verifyPin(pin: string): Employee | undefined {
    return DbService.getEmployees().find(e => e.pin === pin && e.active);
  }

  static addEmployee(emp: Employee): Employee {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.employees) db.employees = [];
    db.employees.push(emp);
    DbService.saveDb(db);
    return emp;
  }

  static updateEmployee(id: string, fields: Partial<Employee>): Employee | undefined {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const idx = db.employees.findIndex(e => e.id === id);
    if (idx < 0) return undefined;
    db.employees[idx] = { ...db.employees[idx], ...fields };
    DbService.saveDb(db);
    return db.employees[idx];
  }

  static deleteEmployee(id: string): boolean {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const before = db.employees.length;
    db.employees = db.employees.filter(e => e.id !== id);
    if (db.employees.length !== before) { DbService.saveDb(db); return true; }
    return false;
  }

  // ── Refund CRUD ───────────────────────────────────────────────────────

  static getRefunds(): Refund[] {
    DbService.initializeSync();
    return DbService.cachedDb!.refunds || [];
  }

  static addRefund(refund: Refund): Refund {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.refunds) db.refunds = [];
    db.refunds.push(refund);
    DbService.saveDb(db);
    return refund;
  }

  // ── Tax Config ────────────────────────────────────────────────────────

  static getTaxConfig(): TaxConfig {
    DbService.initializeSync();
    return DbService.cachedDb!.taxConfig || DbService.defaultTaxConfig();
  }

  static updateTaxConfig(fields: Partial<TaxConfig>): TaxConfig {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    db.taxConfig = { ...db.taxConfig, ...fields };
    DbService.saveDb(db);
    return db.taxConfig;
  }

  // ── Discounts CRUD ────────────────────────────────────────────────────

  static getDiscounts(): Discount[] {
    DbService.initializeSync();
    return DbService.cachedDb!.discounts || [];
  }

  static addDiscount(discount: Discount): Discount {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.discounts) db.discounts = [];
    db.discounts.push(discount);
    DbService.saveDb(db);
    return discount;
  }

  static updateDiscount(id: string, fields: Partial<Discount>): Discount | undefined {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const idx = db.discounts.findIndex(d => d.id === id);
    if (idx < 0) return undefined;
    db.discounts[idx] = { ...db.discounts[idx], ...fields };
    DbService.saveDb(db);
    return db.discounts[idx];
  }

  static deleteDiscount(id: string): boolean {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    const before = db.discounts.length;
    db.discounts = db.discounts.filter(d => d.id !== id);
    if (db.discounts.length !== before) { DbService.saveDb(db); return true; }
    return false;
  }

  // ── Menu Items CRUD ───────────────────────────────────────────────────

  static getMenuItems(): MenuItem[] {
    DbService.initializeSync();
    return DbService.cachedDb!.menuItems || [];
  }

  static getMenuItem(id: string): MenuItem | undefined {
    return DbService.getMenuItems().find(m => m.id === id);
  }

  static addMenuItem(item: MenuItem): MenuItem {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.menuItems) db.menuItems = [];
    db.menuItems.push(item);
    DbService.saveDb(db);
    return item;
  }

  static updateMenuItem(id: string, fields: Partial<MenuItem>): MenuItem | undefined {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.menuItems) db.menuItems = [];
    const idx = db.menuItems.findIndex(m => m.id === id);
    if (idx < 0) {
      const created: MenuItem = {
        id,
        name: fields.name || id,
        category: (fields.category as any) || 'appetizers',
        price: fields.price || 0,
        emoji: fields.emoji || '🍽️',
        image_url: fields.image_url,
        desc: fields.desc || '',
        available: fields.available !== false,
        requiresSauce: !!fields.requiresSauce,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.menuItems.push(created);
      DbService.saveDb(db);
      return created;
    }
    db.menuItems[idx] = { ...db.menuItems[idx], ...fields, updatedAt: new Date().toISOString() };
    DbService.saveDb(db);
    return db.menuItems[idx];
  }

  static deleteMenuItem(id: string): boolean {
    DbService.initializeSync();
    const db = DbService.cachedDb!;
    if (!db.menuItems) db.menuItems = [];
    const before = db.menuItems.length;
    db.menuItems = db.menuItems.filter(m => m.id !== id);
    if (db.menuItems.length !== before) { DbService.saveDb(db); return true; }
    return false;
  }
}
