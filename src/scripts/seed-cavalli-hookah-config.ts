import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { COLLECTIONS } from '../services/multi-tenant-db.service';

const CAVALLI_RESTAURANT_ID = 'RES_EED4E9D266DF'; // Cavalli Hookah Lounge

const HOOKAH_FLAVORS_DATABASE = [
  // ── ETERNAL (9 FLAVORS) ──
  { id: 'flv_peach_lit_1', name: 'Peach Lit', brand: 'Eternal', category: 'eternal', description: 'Sweet Georgia peach with a cool lit chill', color: '#0099FF', emoji: '🍑', available: true },
  { id: 'flv_milkin_cookies_2', name: 'Milkin Cookies', brand: 'Eternal', category: 'eternal', description: 'Creamy baked cookies and sweet vanilla cream', color: '#0099FF', emoji: '🍪', available: true },
  { id: 'flv_blue_lit_3', name: 'Blue Lit', brand: 'Eternal', category: 'eternal', description: 'Electric blueberry with an icy menthol kick', color: '#0099FF', emoji: '⚡', available: true },
  { id: 'flv_tropical_ball_4', name: 'Tropical Ball', brand: 'Eternal', category: 'eternal', description: 'Exotic tropical island punch blend', color: '#0099FF', emoji: '🌴', available: true },
  { id: 'flv_lemon_lit_5', name: 'Lemon Lit', brand: 'Eternal', category: 'eternal', description: 'Zesty lemon citrus with crisp cooling frost', color: '#0099FF', emoji: '🍋', available: true },
  { id: 'flv_watermelon_lit_6', name: 'Watermelon Lit', brand: 'Eternal', category: 'eternal', description: 'Juicy summer watermelon on crushed ice', color: '#0099FF', emoji: '🍉', available: true },
  { id: 'flv_like_ice_7', name: 'Like Ice', brand: 'Eternal', category: 'eternal', description: 'Sub-zero pure arctic menthol blast', color: '#0099FF', emoji: '❄️', available: true },
  { id: 'flv_smoothie_sunshine_8', name: 'Smoothie Sunshine', brand: 'Eternal', category: 'eternal', description: 'Rich tropical smoothie fruit cocktail', color: '#0099FF', emoji: '☀️', available: true },
  { id: 'flv_red_lips_9', name: 'Red Lips', brand: 'Eternal', category: 'eternal', description: 'Sweet seductive wild berry candy', color: '#0099FF', emoji: '💋', available: true },

  // ── ADALYA (5 FLAVORS) ──
  { id: 'flv_baghdadi_10', name: 'Baghdadi', brand: 'Adalya', category: 'adalya', description: 'Grape, peach, mixed berries & fresh mint', color: '#E5B13A', emoji: '💨', available: true },
  { id: 'flv_lady_killer_11', name: 'Lady Killer', brand: 'Adalya', category: 'adalya', description: 'Fragrant melon, sweet mango & berries', color: '#E5B13A', emoji: '👑', available: true },
  { id: 'flv_love_66_12', name: 'Love 66', brand: 'Adalya', category: 'adalya', description: 'Watermelon, honeydew, passion fruit & mint', color: '#E5B13A', emoji: '❤️', available: true },
  { id: 'flv_baku_nights_13', name: 'Baku Nights', brand: 'Adalya', category: 'adalya', description: 'Rich night blend of sweet exotic fruits & mint', color: '#E5B13A', emoji: '🌙', available: true },
  { id: 'flv_skyfall_14', name: 'Skyfall', brand: 'Adalya', category: 'adalya', description: 'Juicy sweet melon, peach & ice mint', color: '#E5B13A', emoji: '🌌', available: true },

  // ── FUMARI (3 FLAVORS) ──
  { id: 'flv_spiced_chai_15', name: 'Spiced Chai', brand: 'Fumari', category: 'fumari', description: 'Warm creamy black tea, cinnamon & cardamom', color: '#14B8A6', emoji: '☕', available: true },
  { id: 'flv_ambrosia_16', name: 'Ambrosia', brand: 'Fumari', category: 'fumari', description: 'Sweet marshmallow, juicy melon & cream', color: '#14B8A6', emoji: '🍈', available: true },
  { id: 'flv_white_peach_17', name: 'White Peach', brand: 'Fumari', category: 'fumari', description: 'Ultra-juicy authentic Georgia white peach', color: '#14B8A6', emoji: '🍑', available: true },

  // ── AFZAL (8 FLAVORS) ──
  { id: 'flv_paan_ras_18', name: 'Paan Ras', brand: 'Afzal', category: 'afzal', description: 'Authentic royal betel leaf, rose & menthol', color: '#10B981', emoji: '🍃', available: true },
  { id: 'flv_lychee_19', name: 'Lychee', brand: 'Afzal', category: 'afzal', description: 'Delicate Asian lychee blossom sweetness', color: '#10B981', emoji: '🌸', available: true },
  { id: 'flv_kiwi_lemonade_20', name: 'Kiwi Lemonade', brand: 'Afzal', category: 'afzal', description: 'Zesty kiwi crushed into chilled lemonade', color: '#10B981', emoji: '🥝', available: true },
  { id: 'flv_guava_21', name: 'Guava', brand: 'Afzal', category: 'afzal', description: 'Fragrant sweet pink tropical guava', color: '#10B981', emoji: '🍈', available: true },
  { id: 'flv_mixed_fruit_22', name: 'Mixed Fruit', brand: 'Afzal', category: 'afzal', description: 'Rich orchard and tropical fruit medley', color: '#10B981', emoji: '🍓', available: true },
  { id: 'flv_choco_crackle_23', name: 'Choco Crackle', brand: 'Afzal', category: 'afzal', description: 'Rich velvety chocolate crunch', color: '#10B981', emoji: '🍫', available: true },
  { id: 'flv_1001_nights_24', name: '1001 Nights', brand: 'Afzal', category: 'afzal', description: 'Exotic Arabian spiced fruit night blend', color: '#10B981', emoji: '✨', available: true },
  { id: 'flv_chief_commissioner_25', name: 'Chief Commissioner', brand: 'Afzal', category: 'afzal', description: 'Strong royal spiced blend with paan notes', color: '#10B981', emoji: '🎖️', available: true },

  // ── AL FAKHAR (23 FLAVORS) ──
  { id: 'flv_grapes_26', name: 'Grapes', brand: 'Al Fakhar', category: 'al fakhar', description: 'Classic sweet Concord purple grape', color: '#EC4899', emoji: '🍇', available: true },
  { id: 'flv_peach_27', name: 'Peach', brand: 'Al Fakhar', category: 'al fakhar', description: 'Ripe sunny peach nectar', color: '#EC4899', emoji: '🍑', available: true },
  { id: 'flv_berry_28', name: 'Berry', brand: 'Al Fakhar', category: 'al fakhar', description: 'Wild forest mixed berry punch', color: '#EC4899', emoji: '🫐', available: true },
  { id: 'flv_vanilla_29', name: 'Vanilla', brand: 'Al Fakhar', category: 'al fakhar', description: 'Smooth Madagascar sweet vanilla cream', color: '#EC4899', emoji: '🍦', available: true },
  { id: 'flv_cinnamon_30', name: 'Cinnamon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Warm aromatic Ceylon cinnamon spice', color: '#EC4899', emoji: '🪵', available: true },
  { id: 'flv_cinnamon_gum_31', name: 'Cinnamon Gum', brand: 'Al Fakhar', category: 'al fakhar', description: 'Spiced cinnamon chewing gum', color: '#EC4899', emoji: '🍬', available: true },
  { id: 'flv_mint_32', name: 'Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Pure fresh garden spearmint leaves', color: '#EC4899', emoji: '🌿', available: true },
  { id: 'flv_rose_cocktail_33', name: 'Rose Cocktail', brand: 'Al Fakhar', category: 'al fakhar', description: 'Aromatic Damask rose petal preserves', color: '#EC4899', emoji: '🌹', available: true },
  { id: 'flv_pineapple_34', name: 'Pineapple', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet tropical Hawaiian pineapple', color: '#EC4899', emoji: '🍍', available: true },
  { id: 'flv_lemon_35', name: 'Lemon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Crisp zesty yellow lemon citrus', color: '#EC4899', emoji: '🍋', available: true },
  { id: 'flv_lemon_mint_36', name: 'Lemon Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Zesty lemon with refreshing garden mint', color: '#EC4899', emoji: '🍋', available: true },
  { id: 'flv_cocktail_37', name: 'Cocktail', brand: 'Al Fakhar', category: 'al fakhar', description: 'Vibrant tropical mixed fruit cocktail', color: '#EC4899', emoji: '🍹', available: true },
  { id: 'flv_watermelon_38', name: 'Watermelon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Crisp refreshing summer watermelon', color: '#EC4899', emoji: '🍉', available: true },
  { id: 'flv_melon_39', name: 'Melon', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet golden honeydew melon', color: '#EC4899', emoji: '🍈', available: true },
  { id: 'flv_mango_40', name: 'Mango', brand: 'Al Fakhar', category: 'al fakhar', description: 'Rich tropical Alphonso mango nectar', color: '#EC4899', emoji: '🥭', available: true },
  { id: 'flv_pomegranate_41', name: 'Pomegranate', brand: 'Al Fakhar', category: 'al fakhar', description: 'Tart Mediterranean ruby pomegranate', color: '#EC4899', emoji: '🍎', available: true },
  { id: 'flv_double_apple_42', name: 'Double Apple', brand: 'Al Fakhar', category: 'al fakhar', description: 'Traditional world-famous aniseed & red apple', color: '#EC4899', emoji: '🍎', available: true },
  { id: 'flv_kiwi_43', name: 'Kiwi', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet & tangy green kiwi fruit', color: '#EC4899', emoji: '🥝', available: true },
  { id: 'flv_guava_44', name: 'Guava', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sweet pink tropical island guava', color: '#EC4899', emoji: '🍈', available: true },
  { id: 'flv_gum_45', name: 'Gum', brand: 'Al Fakhar', category: 'al fakhar', description: 'Classic sweet pink retro bubblegum', color: '#EC4899', emoji: '🫧', available: true },
  { id: 'flv_gum_mint_46', name: 'Gum Mint', brand: 'Al Fakhar', category: 'al fakhar', description: 'Chewing gum infused with icy mint', color: '#EC4899', emoji: '🌿', available: true },
  { id: 'flv_coconut_47', name: 'Coconut', brand: 'Al Fakhar', category: 'al fakhar', description: 'Creamy tropical island coconut milk', color: '#EC4899', emoji: '🥥', available: true },
  { id: 'flv_orange_48', name: 'Orange', brand: 'Al Fakhar', category: 'al fakhar', description: 'Sun-kissed Valencia orange citrus', color: '#EC4899', emoji: '🍊', available: true },

  // ── STARBUZZ (12 FLAVORS) ──
  { id: 'flv_blue_mist_49', name: 'Blue Mist', brand: 'Starbuzz', category: 'starbuzz', description: 'World-famous sweet blueberry and cool mint', color: '#3B82F6', emoji: '🫐', available: true },
  { id: 'flv_code_69_50', name: 'Code 69', brand: 'Starbuzz', category: 'starbuzz', description: 'Cool fruit punch mixed with thick tart citrus', color: '#3B82F6', emoji: '🥤', available: true },
  { id: 'flv_pirates_cave_51', name: 'Pirates Cave', brand: 'Starbuzz', category: 'starbuzz', description: 'Mellow, sweet, and tangy lemon-lime blast', color: '#3B82F6', emoji: '🏴‍☠️', available: true },
  { id: 'flv_sex_on_the_beach_52', name: 'Sex on the Beach', brand: 'Starbuzz', category: 'starbuzz', description: 'Classic tropical citrus and cranberry cocktail', color: '#3B82F6', emoji: '🏖️', available: true },
  { id: 'flv_safari_melon_dew_53', name: 'Safari Melon Dew', brand: 'Starbuzz', category: 'starbuzz', description: 'Smooth, sweet, and classic green melon', color: '#3B82F6', emoji: '🍈', available: true },
  { id: 'flv_tangerine_dream_54', name: 'Tangerine Dream', brand: 'Starbuzz', category: 'starbuzz', description: 'Sweet orange cream popsicle nostalgia', color: '#3B82F6', emoji: '🍊', available: true },
  { id: 'flv_mighty_freeze_55', name: 'Mighty Freeze', brand: 'Starbuzz', category: 'starbuzz', description: 'Lemon tartness injected with spearmint cold', color: '#3B82F6', emoji: '🥶', available: true },
  { id: 'flv_pink_56', name: 'Pink', brand: 'Starbuzz', category: 'starbuzz', description: 'Light raspberry with hints of sweet floral notes', color: '#3B82F6', emoji: '🩷', available: true },
  { id: 'flv_white_peach_57', name: 'White Peach', brand: 'Starbuzz', category: 'starbuzz', description: 'Peachy sweetness with a thick, luscious cloud', color: '#3B82F6', emoji: '🍑', available: true },
  { id: 'flv_queen_of_sex_58', name: 'Queen of Sex', brand: 'Starbuzz', category: 'starbuzz', description: 'Intense citrus flavor with a sweet tang', color: '#3B82F6', emoji: '👑', available: true },
  { id: 'flv_watermelon_freeze_59', name: 'Watermelon Freeze', brand: 'Starbuzz', category: 'starbuzz', description: 'Juicy watermelon crushed with freezing mint', color: '#3B82F6', emoji: '🍉', available: true },
  { id: 'flv_citrus_mist_60', name: 'Citrus Mist', brand: 'Starbuzz', category: 'starbuzz', description: 'Robust citrus mix smoothed out with cool mint', color: '#3B82F6', emoji: '🍋', available: true },
];

async function seed() {
  console.log('Initializing DB for Cavalli Hookah seed...');
  await MultiTenantDbService.initialize();
  const db = MultiTenantDbService.getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  const rest = await db.collection(COLLECTIONS.restaurants).findOne({
    $or: [{ _id: CAVALLI_RESTAURANT_ID as any }, { slug: 'cavali' }]
  });

  if (!rest) {
    console.error('Cavalli restaurant document not found!');
    process.exit(1);
  }

  const restId = String(rest._id);

  const currentConfig = rest.settings?.hookah_config || {};
  const updatedConfig = {
    ...currentConfig,
    flavors: HOOKAH_FLAVORS_DATABASE,
    bases: currentConfig.bases && currentConfig.bases.length > 0 ? currentConfig.bases : [
      { id: 'base_water', name: 'Standard Water Base', price: 0, description: 'Clean crisp purified ice water', available: true },
      { id: 'base_rooh_afza', name: 'Rooh Afza Base', price: 5, description: 'Rose & herbal cooling refreshment', available: true },
      { id: 'base_watermelon', name: 'Watermelon Syrup Base', price: 5, description: 'Sweet concentrated watermelon nectar', available: true },
      { id: 'base_milk', name: 'Cream / Milk Base', price: 6, description: 'Extra thick and silky clouds', available: true },
    ],
    addons: currentConfig.addons && currentConfig.addons.length > 0 ? currentConfig.addons : [
      { id: 'addon_ice_base', name: 'Ice Base', price: 2, description: 'Chilled icy base reservoir', available: true },
      { id: 'addon_ice_hose', name: 'Ice Hose', price: 6, description: 'Sub-zero frozen freeze-tip hose', available: true },
    ],
    packages: currentConfig.packages && currentConfig.packages.length > 0 ? currentConfig.packages : [
      { id: 'daku', name: 'Daku', price: 65, description: 'Unlimited head refill included', includes_unlimited_refills: true, available: true }
    ]
  };

  const success = await MultiTenantDbService.updateHookahConfig(restId, updatedConfig);
  console.log(`Successfully seeded ${HOOKAH_FLAVORS_DATABASE.length} Cavalli hookah flavors into hookah_config! Success=${success}`);

  // Also clean up any lingering menu_items that were previously synced into the menu catalog
  const deleteResult = await db.collection(COLLECTIONS.menu_items).deleteMany({
    restaurant_id: restId as any,
    $or: [
      { category_id: { $regex: 'cat_hk_flavors' } },
      { category_ids: { $elemMatch: { $regex: 'cat_hk_flavors|Hookah Flavors' } } }
    ]
  });
  console.log(`Cleaned up ${deleteResult.deletedCount} legacy hookah flavor menu items from main catalog.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
