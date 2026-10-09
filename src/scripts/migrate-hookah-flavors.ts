import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { COLLECTIONS } from '../services/multi-tenant-db.service';

import { env } from '../config/env';

const CAVALLI_RESTAURANT_ID = 'rest_cavali_94b2'; // Cavalli Hookah Lounge

const HOOKAH_FLAVORS_DATABASE = [
  // ── ETERNAL (9 FLAVORS) ──
  { id: 'flv_peach_lit_1', name: 'Peach Lit', brand: 'Eternal', category: 'eternal', description: 'Sweet Georgia peach with a cool lit chill', color: '#0099FF', emoji: '🍑', tags: ['eternal', 'peach', 'lit'] },
  { id: 'flv_milkin_cookies_2', name: 'Milkin Cookies', brand: 'Eternal', category: 'eternal', description: 'Creamy baked cookies and sweet vanilla cream', color: '#0099FF', emoji: '🍪', tags: ['eternal', 'cookies', 'creamy'] },
  { id: 'flv_blue_lit_3', name: 'Blue Lit', brand: 'Eternal', category: 'eternal', description: 'Electric blueberry with an icy menthol kick', color: '#0099FF', emoji: '⚡', tags: ['eternal', 'blueberry', 'ice'] },
  { id: 'flv_tropical_ball_4', name: 'Tropical Ball', brand: 'Eternal', category: 'eternal', description: 'Exotic tropical island punch blend', color: '#0099FF', emoji: '🌴', tags: ['eternal', 'tropical', 'punch'] },
  { id: 'flv_lemon_lit_5', name: 'Lemon Lit', brand: 'Eternal', category: 'eternal', description: 'Zesty lemon citrus with crisp cooling frost', color: '#0099FF', emoji: '🍋', tags: ['eternal', 'lemon', 'citrus'] },
  { id: 'flv_watermelon_lit_6', name: 'Watermelon Lit', brand: 'Eternal', category: 'eternal', description: 'Juicy summer watermelon on crushed ice', color: '#0099FF', emoji: '🍉', tags: ['eternal', 'watermelon', 'ice'] },
  { id: 'flv_like_ice_7', name: 'Like Ice', brand: 'Eternal', category: 'eternal', description: 'Sub-zero pure arctic menthol blast', color: '#0099FF', emoji: '❄️', tags: ['eternal', 'ice', 'menthol'] },
  { id: 'flv_smoothie_sunshine_8', name: 'Smoothie Sunshine', brand: 'Eternal', category: 'eternal', description: 'Rich tropical smoothie fruit cocktail', color: '#0099FF', emoji: '☀️', tags: ['eternal', 'smoothie', 'tropical'] },
  { id: 'flv_red_lips_9', name: 'Red Lips', brand: 'Eternal', category: 'eternal', description: 'Sweet seductive wild berry candy', color: '#0099FF', emoji: '💋', tags: ['eternal', 'berry', 'sweet'] },

  // ── ADALYA (5 FLAVORS) ──
  { id: 'flv_baghdadi_10', name: 'Baghdadi', brand: 'Adalya', category: 'adalya', description: 'Grape, peach, mixed berries & fresh mint', color: '#E5B13A', emoji: '💨', tags: ['adalya', 'grape', 'peach', 'mint'] },
  { id: 'flv_lady_killer_11', name: 'Lady Killer', brand: 'Adalya', category: 'adalya', description: 'Fragrant melon, sweet mango & berries', color: '#E5B13A', emoji: '👑', tags: ['adalya', 'melon', 'mango', 'berries'] },
  { id: 'flv_love_66_12', name: 'Love 66', brand: 'Adalya', category: 'adalya', description: 'Watermelon, honeydew, passion fruit & mint', color: '#E5B13A', emoji: '❤️', tags: ['adalya', 'watermelon', 'mint', 'popular'] },
  { id: 'flv_baku_nights_13', name: 'Baku Nights', brand: 'Adalya', category: 'adalya', description: 'Rich night blend of sweet exotic fruits & mint', color: '#E5B13A', emoji: '🌙', tags: ['adalya', 'exotic', 'mint'] },
  { id: 'flv_skyfall_14', name: 'Skyfall', brand: 'Adalya', category: 'adalya', description: 'Juicy sweet melon, peach & ice mint', color: '#E5B13A', emoji: '🌌', tags: ['adalya', 'melon', 'peach', 'mint'] },

  // ── FUMARI (3 FLAVORS) ──
  { id: 'flv_spiced_chai_15', name: 'Spiced Chai', brand: 'Fumari', category: 'fumari', description: 'Warm creamy black tea, cinnamon & cardamom', color: '#14B8A6', emoji: '☕', tags: ['fumari', 'chai', 'spice', 'tea'] },
  { id: 'flv_ambrosia_16', name: 'Ambrosia', brand: 'Fumari', category: 'fumari', description: 'Sweet marshmallow, juicy melon & cream', color: '#14B8A6', emoji: '🍈', tags: ['fumari', 'marshmallow', 'melon'] },
  { id: 'flv_white_peach_17', name: 'White Peach', brand: 'Fumari', category: 'fumari', description: 'Ultra-juicy authentic Georgia white peach', color: '#14B8A6', emoji: '🍑', tags: ['fumari', 'peach', 'sweet'] },

  // ── AFZAL (8 FLAVORS) ──
  { id: 'flv_paan_ras_18', name: 'Paan Ras', brand: 'Afzal', category: 'afzal', description: 'Authentic royal betel leaf, rose & menthol', color: '#10B981', emoji: '🍃', tags: ['afzal', 'paan', 'desi', 'popular'] },
  { id: 'flv_lychee_19', name: 'Lychee', brand: 'Afzal', category: 'afzal', description: 'Delicate Asian lychee blossom sweetness', color: '#10B981', emoji: '🌸', tags: ['afzal', 'lychee', 'floral'] },
  { id: 'flv_kiwi_lemonade_20', name: 'Kiwi Lemonade', brand: 'Afzal', category: 'afzal', description: 'Zesty kiwi crushed into chilled lemonade', color: '#10B981', emoji: '🥝', tags: ['afzal', 'kiwi', 'lemonade'] },
  { id: 'flv_guava_21', name: 'Guava', brand: 'Afzal', category: 'afzal', description: 'Fragrant sweet pink tropical guava', color: '#10B981', emoji: '🍈', tags: ['afzal', 'guava', 'tropical'] },
  { id: 'flv_mixed_fruit_22', name: 'Mixed Fruit', brand: 'Afzal', category: 'afzal', description: 'Rich orchard and tropical fruit medley', color: '#10B981', emoji: '🍓', tags: ['afzal', 'fruit', 'sweet'] },
  { id: 'flv_choco_crackle_23', name: 'Choco Crackle', brand: 'Afzal', category: 'afzal', description: 'Rich velvety chocolate crunch', color: '#10B981', emoji: '🍫', tags: ['afzal', 'chocolate', 'dessert'] },
  { id: 'flv_1001_nights_24', name: '1001 Nights', brand: 'Afzal', category: 'afzal', description: 'Exotic Arabian spiced fruit night blend', color: '#10B981', emoji: '🌙', tags: ['afzal', 'exotic', 'arabian'] },
  { id: 'flv_chief_commissioner_25', name: 'Chief Commissioner', brand: 'Afzal', category: 'afzal', description: 'Strong royal spiced blend with paan notes', color: '#10B981', emoji: '🎖️', tags: ['afzal', 'paan', 'spiced'] },

  // ── AL FAKHAR (23 FLAVORS) ──
  { id: 'flv_grapes_26', name: 'Grapes', brand: 'Al Fakhar', category: 'al fakhar', description: 'Classic sweet Concord purple grape', color: '#EC4899', emoji: '🍇', tags: ['al fakhar', 'grape', 'classic'] },
  { id: 'flv_peach_27', name: 'Peach', brand: 'Al Fakhar', category: 'al fakhar', description: 'Ripe sunny peach nectar', color: '#EC4899', emoji: '🍑', tags: ['al fakhar', 'peach', 'sweet'] },
  { id: 'flv_berry_28', name: 'Berry', brand: 'Al Fakhar', category: 'al fakhar', description: 'Wild forest mixed berry punch', color: '#EC4899', emoji: '🫐', tags: ['al fakhar', 'berry', 'sweet'] },
  { id: 'flv_vanilla_29', name: 'Vanilla', brand: 'Al Fakhar', category: 'al fakhar', description: 'Smooth Madagascar sweet vanilla cream', color: '#EC4899', emoji: '🍦', tags: ['al fakhar', 'vanilla', 'creamy'] },
  { id: 'flv_cinnamon_30', name: 'Cinnamon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Warm aromatic Ceylon cinnamon spice', color: '#EC4899', emoji: '🪵', tags: ['al fakhar', 'cinnamon', 'spice'] },
  { id: 'flv_cinnamon_gum_31', name: 'Cinnamon Gum', brand: 'Al Fakhar', category: 'al fakhar', description: 'Spiced cinnamon chewing gum', color: '#EC4899', emoji: '🍬', tags: ['al fakhar', 'cinnamon', 'gum'] },
  { id: 'flv_mint_32', name: 'Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Pure fresh garden spearmint leaves', color: '#EC4899', emoji: '🌿', tags: ['al fakhar', 'mint', 'fresh', 'popular'] },
  { id: 'flv_rose_cocktail_33', name: 'Rose Cocktail', brand: 'Al Fakhar', category: 'al fakhar', description: 'Aromatic Damask rose petal preserves', color: '#EC4899', emoji: '🌹', tags: ['al fakhar', 'rose', 'floral'] },
  { id: 'flv_pineapple_34', name: 'Pineapple', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet tropical Hawaiian pineapple', color: '#EC4899', emoji: '🍍', tags: ['al fakhar', 'pineapple', 'tropical'] },
  { id: 'flv_lemon_35', name: 'Lemon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Crisp zesty yellow lemon citrus', color: '#EC4899', emoji: '🍋', tags: ['al fakhar', 'lemon', 'citrus'] },
  { id: 'flv_lemon_mint_36', name: 'Lemon Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Zesty lemon with refreshing garden mint', color: '#EC4899', emoji: '🍋', tags: ['al fakhar', 'lemon', 'mint', 'popular'] },
  { id: 'flv_cocktail_37', name: 'Cocktail', brand: 'Al Fakhar', category: 'al fakhar', description: 'Vibrant tropical mixed fruit cocktail', color: '#EC4899', emoji: '🍹', tags: ['al fakhar', 'cocktail', 'tropical'] },
  { id: 'flv_watermelon_38', name: 'Watermelon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Crisp refreshing summer watermelon', color: '#EC4899', emoji: '🍉', tags: ['al fakhar', 'watermelon', 'melon'] },
  { id: 'flv_melon_39', name: 'Melon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet golden honeydew melon', color: '#EC4899', emoji: '🍈', tags: ['al fakhar', 'melon', 'sweet'] },
  { id: 'flv_mango_40', name: 'Mango', brand: 'Al Fakhar', category: 'al fakhar', description: 'Rich tropical Alphonso mango nectar', color: '#EC4899', emoji: '🥭', tags: ['al fakhar', 'mango', 'tropical'] },
  { id: 'flv_pomegranate_41', name: 'Pomegranate', brand: 'Al Fakhar', category: 'al fakhar', description: 'Tart Mediterranean ruby pomegranate', color: '#EC4899', emoji: '🍎', tags: ['al fakhar', 'pomegranate', 'tart'] },
  { id: 'flv_double_apple_42', name: 'Double Apple', brand: 'Al Fakhar', category: 'al fakhar', description: 'Traditional world-famous aniseed & red apple', color: '#EC4899', emoji: '🍎', tags: ['al fakhar', 'apple', 'anise', 'classic', 'popular'] },
  { id: 'flv_kiwi_43', name: 'Kiwi', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet & tangy green kiwi fruit', color: '#EC4899', emoji: '🥝', tags: ['al fakhar', 'kiwi', 'tangy'] },
  { id: 'flv_guava_44', name: 'Guava', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet pink tropical island guava', color: '#EC4899', emoji: '🍈', tags: ['al fakhar', 'guava', 'tropical'] },
  { id: 'flv_gum_45', name: 'Gum', brand: 'Al Fakhar', category: 'al fakhar', description: 'Classic sweet pink retro bubblegum', color: '#EC4899', emoji: '🫧', tags: ['al fakhar', 'gum', 'sweet'] },
  { id: 'flv_gum_mint_46', name: 'Gum Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Chewing gum infused with icy mint', color: '#EC4899', emoji: '🌿', tags: ['al fakhar', 'gum', 'mint'] },
  { id: 'flv_coconut_47', name: 'Coconut', brand: 'Al Fakhar', category: 'al fakhar', description: 'Creamy tropical island coconut milk', color: '#EC4899', emoji: '🥥', tags: ['al fakhar', 'coconut', 'tropical'] },
  { id: 'flv_orange_48', name: 'Orange', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sun-kissed Valencia orange citrus', color: '#EC4899', emoji: '🍊', tags: ['al fakhar', 'orange', 'citrus'] },

  // ── STARBUZZ (12 FLAVORS) ──
  { id: 'flv_blue_mist_49', name: 'Blue Mist', brand: 'Starbuzz', category: 'starbuzz', description: 'World-famous sweet blueberry and cool mint', color: '#3B82F6', emoji: '🫐', tags: ['starbuzz', 'blueberry', 'mint', 'popular'] },
  { id: 'flv_code_69_50', name: 'Code 69', brand: 'Starbuzz', category: 'starbuzz', description: 'Cool fruit punch mixed with thick tart citrus', color: '#3B82F6', emoji: '🥤', tags: ['starbuzz', 'punch', 'citrus'] },
  { id: 'flv_pirates_cave_51', name: 'Pirates Cave', brand: 'Starbuzz', category: 'starbuzz', description: 'Mellow, sweet, and tangy lemon-lime blast', color: '#3B82F6', emoji: '🏴‍☠️', tags: ['starbuzz', 'lemon', 'lime', 'sweet'] },
  { id: 'flv_sex_on_the_beach_52', name: 'Sex on the Beach', brand: 'Starbuzz', category: 'starbuzz', description: 'Classic tropical citrus and cranberry cocktail', color: '#3B82F6', emoji: '🏖️', tags: ['starbuzz', 'cocktail', 'tropical'] },
  { id: 'flv_safari_melon_dew_53', name: 'Safari Melon Dew', brand: 'Starbuzz', category: 'starbuzz', description: 'Smooth, sweet, and classic green melon', color: '#3B82F6', emoji: '🍈', tags: ['starbuzz', 'melon', 'sweet'] },
  { id: 'flv_tangerine_dream_54', name: 'Tangerine Dream', brand: 'Starbuzz', category: 'starbuzz', description: 'Sweet orange cream popsicle nostalgia', color: '#3B82F6', emoji: '🍊', tags: ['starbuzz', 'tangerine', 'orange', 'creamy'] },
  { id: 'flv_mighty_freeze_55', name: 'Mighty Freeze', brand: 'Starbuzz', category: 'starbuzz', description: 'Lemon tartness injected with spearmint cold', color: '#3B82F6', emoji: '🥶', tags: ['starbuzz', 'lemon', 'mint', 'ice'] },
  { id: 'flv_pink_56', name: 'Pink', brand: 'Starbuzz', category: 'starbuzz', description: 'Light raspberry with hints of sweet floral notes', color: '#3B82F6', emoji: '🩷', tags: ['starbuzz', 'raspberry', 'floral'] },
  { id: 'flv_white_peach_57', name: 'White Peach', brand: 'Starbuzz', category: 'starbuzz', description: 'Peachy sweetness with a thick, luscious cloud', color: '#3B82F6', emoji: '🍑', tags: ['starbuzz', 'peach', 'sweet'] },
  { id: 'flv_queen_of_sex_58', name: 'Queen of Sex', brand: 'Starbuzz', category: 'starbuzz', description: 'Intense citrus flavor with a sweet tang', color: '#3B82F6', emoji: '👑', tags: ['starbuzz', 'citrus', 'tangy'] },
  { id: 'flv_watermelon_freeze_59', name: 'Watermelon Freeze', brand: 'Starbuzz', category: 'starbuzz', description: 'Juicy watermelon crushed with freezing mint', color: '#3B82F6', emoji: '🍉', tags: ['starbuzz', 'watermelon', 'mint', 'ice'] },
  { id: 'flv_citrus_mist_60', name: 'Citrus Mist', brand: 'Starbuzz', category: 'starbuzz', description: 'Robust citrus mix smoothed out with cool mint', color: '#3B82F6', emoji: '🍋', tags: ['starbuzz', 'citrus', 'mint'] },
];

async function run() {
  console.log('Initializing DB...');
  await MultiTenantDbService.initialize();
  const db = MultiTenantDbService.getDb();
  
  // 1. Check or Create Inventory Category
  let invCat = await db!.collection(COLLECTIONS.inventory_categories).findOne({ name: 'Hookah Flavors', restaurant_id: CAVALLI_RESTAURANT_ID });
  if (!invCat) {
    const invCatId = `invcat_hk_${Date.now()}`;
    await db!.collection(COLLECTIONS.inventory_categories).insertOne({
      id: invCatId,
      restaurant_id: CAVALLI_RESTAURANT_ID,
      name: 'Hookah Flavors',
      description: 'Hookah tobacco flavors for tracking by weight/grams'
    });
    invCat = { id: invCatId } as any;
  }
  
  // 2. Check or Create Menu Category
  let menuCat = await db!.collection(COLLECTIONS.menu_categories).findOne({ title: 'Hookah Flavors', restaurant_id: CAVALLI_RESTAURANT_ID });
  if (!menuCat) {
    const catId = `cat_hk_flavors_${Date.now()}`;
    await db!.collection(COLLECTIONS.menu_categories).insertOne({
      id: catId,
      restaurant_id: CAVALLI_RESTAURANT_ID,
      title: 'Hookah Flavors',
      subtitle: 'Premium Shisha Flavors',
      parent_id: 'cat_hookah',
      icon: '💨',
      color: '#8B5CF6',
      sort_order: 10,
      menu_type: 'primary',
      active: true
    });
    menuCat = { id: catId } as any;
  }
  
  let added = 0;
  
  for (const f of HOOKAH_FLAVORS_DATABASE) {
    // Check if ingredient exists
    const ingId = `ing_${f.id}`;
    const invExists = await db!.collection(COLLECTIONS.inventory).findOne({ id: ingId, restaurant_id: CAVALLI_RESTAURANT_ID });
    
    if (!invExists) {
      await db!.collection(COLLECTIONS.inventory).insertOne({
        id: ingId,
        restaurant_id: CAVALLI_RESTAURANT_ID,
        name: `${f.brand} ${f.name} (250g)`,
        category_id: invCat!.id,
        unit: 'grams',
        stock_quantity: 1000,
        low_stock_threshold: 250,
        cost_per_unit: 0.1,
        last_updated: new Date().toISOString()
      });
    }
    
    // Check if menu item exists
    const menuExists = await db!.collection(COLLECTIONS.menu_items).findOne({ id: f.id, restaurant_id: CAVALLI_RESTAURANT_ID });
    if (!menuExists) {
      await db!.collection(COLLECTIONS.menu_items).insertOne({
        id: f.id,
        restaurant_id: CAVALLI_RESTAURANT_ID,
        category_id: menuCat!.id,
        category_ids: [menuCat!.id],
        name: `${f.brand} ${f.name}`,
        price: 0,
        desc: `${f.brand} - ${f.description}`,
        emoji: f.emoji,
        image_url: f.color, // Storing color in image_url for UI styling if needed, or we can use custom field
        brand: f.brand, // Add custom field for brand
        color: f.color,
        sort_order: 1,
        active: true,
        ingredient_id: ingId,
        tags: f.tags,
      });
      added++;
    }
  }
  
  console.log(`Migration complete. Added ${added} hookah flavors to the database.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
