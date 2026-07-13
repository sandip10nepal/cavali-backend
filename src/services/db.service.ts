import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(__dirname, '../../db.json');

export interface InventoryItem {
  id: string;
  name: string;
  category: 'shisha' | 'proteins' | 'dairy_bakery' | 'veggies' | 'dry_goods' | 'beverages' | 'desserts';
  stock: number;
  unit: string;
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

interface DatabaseSchema {
  orders: any[];
  inventory: Record<string, InventoryItem>;
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
          inventory: cleanedInventory
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

  private static loadLocalDb(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.inventory) parsed.inventory = { ...DEFAULT_INVENTORY };
        
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
      inventory: { ...DEFAULT_INVENTORY }
    };
    DbService.saveDb(initialDb);
    return initialDb;
  }

  private static saveDb(data: DatabaseSchema) {
    DbService.cachedDb = data;
    
    const MONGODB_URI = process.env.MONGODB_URI;
    if (MONGODB_URI && DbService.dbInstance) {
      // Async write-behind persist to MongoDB Atlas
      const col = DbService.dbInstance.collection('state');
      col.updateOne(
        { _id: 'cavali_state' },
        { $set: { orders: data.orders, inventory: data.inventory } },
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
}
