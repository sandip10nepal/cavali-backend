import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../multi_tenant_db.json');

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

  // ── STARBUZZ (11 FLAVORS) ──
  { id: 'flv_safari_melon_49', name: 'Safari Melon', brand: 'Starbuzz', category: 'starbuzz', description: 'Exotic African sweet melon blend', color: '#8B5CF6', emoji: '🍈', tags: ['starbuzz', 'melon', 'exotic'] },
  { id: 'flv_irish_peach_50', name: 'Irish Peach', brand: 'Starbuzz', category: 'starbuzz', description: 'Creamy peach nectar with spiced citrus', color: '#8B5CF6', emoji: '🍑', tags: ['starbuzz', 'peach', 'creamy'] },
  { id: 'flv_blue_mist_51', name: 'Blue Mist', brand: 'Starbuzz', category: 'starbuzz', description: 'Iconic sweet blueberry with cool frosty finish', color: '#8B5CF6', emoji: '🌌', tags: ['starbuzz', 'blueberry', 'ice', 'popular'] },
  { id: 'flv_white_peach_52', name: 'White Peach', brand: 'Starbuzz', category: 'starbuzz', description: 'Soft velvety sweet white peach', color: '#8B5CF6', emoji: '🍑', tags: ['starbuzz', 'peach', 'sweet'] },
  { id: 'flv_green_savior_53', name: 'Green Savior', brand: 'Starbuzz', category: 'starbuzz', description: 'Herbal blend of exotic spices & paan', color: '#8B5CF6', emoji: '🌿', tags: ['starbuzz', 'paan', 'spices'] },
  { id: 'flv_watermelon_freeze_54', name: 'Watermelon Freeze', brand: 'Starbuzz', category: 'starbuzz', description: 'Frozen sweet watermelon with icy blast', color: '#8B5CF6', emoji: '🍉', tags: ['starbuzz', 'watermelon', 'freeze', 'ice'] },
  { id: 'flv_code_69_55', name: 'Code 69', brand: 'Starbuzz', category: 'starbuzz', description: 'Passion fruit mixed with citrus cola', color: '#8B5CF6', emoji: '⚡', tags: ['starbuzz', 'passionfruit', 'cola'] },
  { id: 'flv_melon_blue_56', name: 'Melon Blue', brand: 'Starbuzz', category: 'starbuzz', description: 'Juicy sweet melon and blueberry fusion', color: '#8B5CF6', emoji: '🍈', tags: ['starbuzz', 'melon', 'blueberry'] },
  { id: 'flv_geisha_57', name: 'Geisha', brand: 'Starbuzz', category: 'starbuzz', description: 'Smooth peach, passion fruit & cooling mint', color: '#8B5CF6', emoji: '👘', tags: ['starbuzz', 'peach', 'passionfruit', 'mint'] },
  { id: 'flv_exotic_wild_mint_58', name: 'Exotic Wild Mint', brand: 'Starbuzz', category: 'starbuzz', description: 'Intense wild mountain peppermint', color: '#8B5CF6', emoji: '🌿', tags: ['starbuzz', 'mint', 'ice'] },
  { id: 'flv_sex_on_the_beach_59', name: 'Sex on the Beach', brand: 'Starbuzz', category: 'starbuzz', description: 'Vodka-inspired cranberry, orange & peach punch', color: '#8B5CF6', emoji: '🏖️', tags: ['starbuzz', 'cocktail', 'punch', 'peach'] }
].map(f => ({ ...f, active: true }));

async function run() {
  const dbStr = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(dbStr);

  const cavalli = db.restaurants.find((r: any) => r.slug === 'cavalli' || r.restaurant_code === '4821' || r.name.toLowerCase().includes('cavalli'));
  if (!cavalli) {
    console.error('Cavalli restaurant not found');
    return;
  }
  
  if (!cavalli.settings.hookah_config) {
     cavalli.settings.hookah_config = {
        flavors: [],
        bases: [
            { id: 'base_water', name: 'Standard Water Base', price: 0, description: 'Clean crisp purified ice water', active: true },
            { id: 'base_rooh_afza', name: 'Rooh Afza Base', price: 5, description: 'Rose & herbal cooling refreshment', active: true },
            { id: 'base_watermelon', name: 'Watermelon Syrup Base', price: 5, description: 'Sweet concentrated watermelon nectar', active: true },
            { id: 'base_milk', name: 'Cream / Milk Base', price: 6, description: 'Extra thick and silky clouds', active: true },
        ],
        addons: [
            { id: 'addon_ice_base', name: 'Ice Base', price: 2, description: 'Chilled icy base reservoir', active: true },
            { id: 'addon_ice_hose', name: 'Ice Hose', price: 6, description: 'Sub-zero frozen freeze-tip hose', active: true },
        ],
        packages: [
            { id: 'pkg_daku', name: 'Daku', price: 65, description: 'Unlimited head refill included', includes_unlimited_refills: true, active: true },
        ]
     };
  }

  cavalli.settings.hookah_config.flavors = HOOKAH_FLAVORS_DATABASE;

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log('Successfully updated hookah flavors for', cavalli.name);
}

run().catch(console.error);
