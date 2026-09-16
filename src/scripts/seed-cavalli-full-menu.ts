import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://sandip2nepal_db_user:jzKRgGtGJpU9jhR7@cluster0.tkcmyix.mongodb.net/benzin_saas_db?retryWrites=true&w=majority';
const RESTAURANT_ID = 'RES_EED4E9D266DF';

const categories = [
  // Super Categories
  { _id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD', restaurant_id: RESTAURANT_ID, name: 'Food & Dining', title: 'Food & Dining', icon: '🍽️', sort_order: 1, active: true, parent_id: null },
  { _id: 'CAT_SUPER_RES_EED4E9D266DF_DRINKS', restaurant_id: RESTAURANT_ID, name: 'Beverages', title: 'Beverages', icon: '🍹', sort_order: 2, active: true, parent_id: null },
  { _id: 'CAT_SUPER_RES_EED4E9D266DF_HOOKAH', restaurant_id: RESTAURANT_ID, name: 'Hookah & Shisha', title: 'Hookah & Shisha', icon: '💨', sort_order: 3, active: true, parent_id: null },

  // Food Subcategories
  { _id: 'CAT_APPETIZERS', restaurant_id: RESTAURANT_ID, name: 'Appetizers', title: 'Appetizers', icon: '🥗', sort_order: 1, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_MAINS', restaurant_id: RESTAURANT_ID, name: 'Mains', title: 'Mains', icon: '🥩', sort_order: 2, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_WINGS', restaurant_id: RESTAURANT_ID, name: 'Wings', title: 'Wings', icon: '🍗', sort_order: 3, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_VEGETARIAN', restaurant_id: RESTAURANT_ID, name: 'Vegetarian', title: 'Vegetarian', icon: '🌱', sort_order: 4, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_BURGERS', restaurant_id: RESTAURANT_ID, name: 'Burgers', title: 'Burgers', icon: '🍔', sort_order: 5, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_WRAPS', restaurant_id: RESTAURANT_ID, name: 'Wraps', title: 'Wraps', icon: '🌯', sort_order: 6, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_CONTINENTAL', restaurant_id: RESTAURANT_ID, name: 'Continental Street Food', title: 'Continental Street Food', icon: '🥢', sort_order: 7, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },
  { _id: 'CAT_DESSERTS', restaurant_id: RESTAURANT_ID, name: 'Desserts', title: 'Desserts', icon: '🍰', sort_order: 8, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_FOOD' },

  // Drinks Subcategories
  { _id: 'CAT_DRINKS_REFRESHERS', restaurant_id: RESTAURANT_ID, name: 'Refreshers', title: 'Refreshers', icon: '🍹', sort_order: 9, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_DRINKS' },
  { _id: 'CAT_DRINKS_TEA_COFFEE', restaurant_id: RESTAURANT_ID, name: 'Tea & Coffee', title: 'Tea & Coffee', icon: '☕', sort_order: 10, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_DRINKS' },
  { _id: 'CAT_DRINKS_SOFT', restaurant_id: RESTAURANT_ID, name: 'Soft Drinks', title: 'Soft Drinks', icon: '🥤', sort_order: 11, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_DRINKS' },

  // Hookah Subcategories
  { _id: 'CAT_HOOKAH_HOUSE_MIXES', restaurant_id: RESTAURANT_ID, name: 'House Mixes', title: 'House Mixes', icon: '💨', sort_order: 12, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_HOOKAH' },
  { _id: 'CAT_HOOKAH_CUSTOM', restaurant_id: RESTAURANT_ID, name: 'Custom Mix Lab', title: 'Custom Mix Lab', icon: '🧪', sort_order: 13, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_HOOKAH' },
  { _id: 'CAT_HOOKAH_EXTRAS', restaurant_id: RESTAURANT_ID, name: 'Refills & Add-ons', title: 'Refills & Add-ons', icon: '🔥', sort_order: 14, active: true, parent_id: 'CAT_SUPER_RES_EED4E9D266DF_HOOKAH' },
];

const wingSauceModifierGroup = {
  id: 'grp_wing_sauces',
  name: 'Sauce Choices',
  required: true,
  min_selection: 1,
  max_selection: 1,
  maxSelect: 1,
  max_selections: 1,
  options: [
    { id: 'opt_buffalo', name: 'Buffalo', price: 0, description: 'Classic buttery cayenne hot sauce' },
    { id: 'opt_bbq', name: 'BBQ', price: 0, description: 'Smoky-sweet barbecue glaze' },
    { id: 'opt_garlic_parm', name: 'Garlic Parmesan', price: 0, description: 'Roasted garlic butter and aged parmesan' },
    { id: 'opt_lemon_pepper', name: 'Lemon Pepper', price: 0, description: 'Cracked black pepper and lemon zest rub' },
    { id: 'opt_honey_bbq', name: 'Honey BBQ', price: 0, description: 'Sweet honey-laced barbecue glaze' },
    { id: 'opt_mango_habanero', name: 'Mango Habanero', price: 0, description: 'Sweet mango with a fiery habanero kick' }
  ]
};

const softDrinkModifierGroup = {
  id: 'mod_soft_drink_choice',
  name: 'Select Beverage Flavors',
  required: false,
  min_selection: 0,
  max_selection: 10,
  maxSelect: 10,
  max_selections: 10,
  options: [
    { id: 'opt_coca_cola', name: 'Coca-Cola', price: 0 },
    { id: 'opt_coke_zero', name: 'Coke Zero / Diet', price: 0 },
    { id: 'opt_fanta', name: 'Fanta', price: 0 },
    { id: 'opt_ginger_ale', name: 'Ginger Ale', price: 0 },
    { id: 'opt_sprite', name: 'Sprite', price: 0 },
    { id: 'opt_dr_pepper', name: 'Dr Pepper', price: 0 }
  ]
};

interface ItemDef {
  _id: string;
  name: string;
  category_id: string;
  category_ids: string[];
  price: number;
  desc: string;
  emoji: string;
  image_url: string;
  sort_order: number;
  modifier_groups?: any[];
}

const allItems: ItemDef[] = [
  // ── APPETIZERS ─────────────────────────────────────────────────────────────
  {
    _id: 'MI_kabob_lollipop_app',
    name: 'Kabob Lollipop',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS'],
    price: 12,
    desc: 'Seasoned minced chicken wrapped around a drumstick, grilled until golden and juicy.',
    emoji: '🍗',
    image_url: '/images/menu/tenders.webp',
    sort_order: 1
  },
  {
    _id: 'MI_hummus_app',
    name: 'Hummus',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Creamy chickpea puree with tahini, olive oil, and warm pita.',
    emoji: '🧆',
    image_url: '/images/menu/hummus.webp',
    sort_order: 2
  },
  {
    _id: 'MI_falafel_app',
    name: 'Falafel',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Crisp chickpea fritters served with tahini sauce and pickled vegetables.',
    emoji: '🧆',
    image_url: '/images/menu/falafel.webp',
    sort_order: 3
  },
  {
    _id: 'MI_dynamite_chicken_app',
    name: 'Dynamite Chicken',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS'],
    price: 14,
    desc: 'Crispy chicken bites tossed in our signature spicy aioli. Also available with shrimp.',
    emoji: '🍗',
    image_url: '/images/menu/dynamite_chicken.webp',
    sort_order: 4
  },
  {
    _id: 'MI_bun_kabab_app',
    name: 'Bun Kabab',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS'],
    price: 10,
    desc: 'Spiced patty in a soft bun with green chutney and tamarind.',
    emoji: '🍔',
    image_url: '/images/menu/bun_kab.webp',
    sort_order: 5
  },
  {
    _id: 'MI_samosa_app',
    name: 'Samosa',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 8,
    desc: 'Crispy pastry triangles - vegetable, chicken, or beef. (3 pc)',
    emoji: '🥟',
    image_url: '/images/menu/samosa.webp',
    sort_order: 6
  },
  {
    _id: 'MI_papri_chaat_app',
    name: 'Papri Chaat',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Crisp wafers layered with chickpeas, yogurt, mint, and tamarind chutneys.',
    emoji: '🥗',
    image_url: '/images/menu/papri_chaat.webp',
    sort_order: 7
  },
  {
    _id: 'MI_pani_puri_app',
    name: 'Pani Puri',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 12,
    desc: 'Hollow puris filled with spiced potato, chickpeas, and tangy mint water. (6 pc)',
    emoji: '🍲',
    image_url: '/images/menu/pani_puri.webp',
    sort_order: 8
  },
  {
    _id: 'MI_spicy_potato_app',
    name: 'Spicy Potato',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 8,
    desc: 'Cubed potatoes tossed in chili and Cavalli spices.',
    emoji: '🥔',
    image_url: '/images/menu/spicy_potato.webp',
    sort_order: 9
  },
  {
    _id: 'MI_tenders_with_fries_app',
    name: 'Tenders with Fries',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS'],
    price: 12,
    desc: 'Golden chicken tenders with seasoned fries and dipping sauce.',
    emoji: '🍟',
    image_url: '/images/menu/tenders_with_fries.webp',
    sort_order: 10
  },
  {
    _id: 'MI_pizza_bites_app',
    name: 'Pizza Bites',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS'],
    price: 10,
    desc: 'Mini cheese-and-marinara pizza pockets baked golden.',
    emoji: '🍕',
    image_url: '/images/menu/pizza_bites.webp',
    sort_order: 11
  },
  {
    _id: 'MI_fries_app',
    name: 'Fries',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 7,
    desc: 'Potato fries with house seasoning.',
    emoji: '🍟',
    image_url: '/images/menu/fries.webp',
    sort_order: 12
  },
  {
    _id: 'MI_loaded_fries_app',
    name: 'Loaded Fries',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 12,
    desc: 'Fries topped with cheese, jalapeños, green onion, and sour cream. Add chicken for $3.',
    emoji: '🍟',
    image_url: '/images/menu/loaded_fries.webp',
    sort_order: 13
  },
  {
    _id: 'MI_loaded_nachos_app',
    name: 'Loaded Nachos',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 12,
    desc: 'Tortilla chips piled with cheese, jalapeños, salsa, and sour cream. Add chicken for $3.',
    emoji: '🧀',
    image_url: '/images/menu/loaded_nachos.webp',
    sort_order: 14
  },
  {
    _id: 'MI_chips_and_queso_app',
    name: 'Chips and Queso',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN', 'CAT_CONTINENTAL'],
    price: 10,
    desc: 'Crisp tortilla chips with warm, melted cheese dip.',
    emoji: '🧀',
    image_url: '/images/menu/chips_q.webp',
    sort_order: 15
  },
  {
    _id: 'MI_chips_and_guacamole_app',
    name: 'Chips and Guacamole',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Crisp tortilla chips with guacamole.',
    emoji: '🥑',
    image_url: '/images/menu/chips_g.webp',
    sort_order: 16
  },
  {
    _id: 'MI_spicy_aloo_chaat_app',
    name: 'Spicy Aloo Chaat',
    category_id: 'CAT_APPETIZERS',
    category_ids: ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Spiced potatoes, tangy chutneys, creamy yogurt, and crunchy sev served in a crispy pastry bowl.',
    emoji: '🥗',
    image_url: '/images/menu/spicy_aloo_chaat.jpg',
    sort_order: 17
  },

  // ── VEGETARIAN ─────────────────────────────────────────────────────────────
  {
    _id: 'MI_papri_chaat_veg',
    name: 'Papri Chaat',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 10,
    desc: 'Crisp wafers layered with chickpeas, yogurt, mint, and tamarind chutneys.',
    emoji: '🥗',
    image_url: '/images/menu/v_papri.webp',
    sort_order: 1
  },
  {
    _id: 'MI_pani_puri_veg',
    name: 'Pani Puri',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 12,
    desc: 'Hollow puris filled with spiced potato, chickpeas, and tangy mint water.',
    emoji: '🍲',
    image_url: '/images/menu/v_pani.webp',
    sort_order: 2
  },
  {
    _id: 'MI_spicy_potato_veg',
    name: 'Spicy Potato',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 8,
    desc: 'Fried potatoes with chili and Cavalli spices.',
    emoji: '🥔',
    image_url: '/images/menu/v_spypot.webp',
    sort_order: 3
  },
  {
    _id: 'MI_falafel_veg',
    name: 'Falafel',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 10,
    desc: 'Crisp chickpea fritters served with tahini sauce and pickled vegetables.',
    emoji: '🧆',
    image_url: '/images/menu/v_fal.webp',
    sort_order: 4
  },
  {
    _id: 'MI_hummus_veg',
    name: 'Hummus',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 10,
    desc: 'Creamy chickpea puree with tahini, olive oil, and warm pita.',
    emoji: '🧆',
    image_url: '/images/menu/v_hum.webp',
    sort_order: 5
  },
  {
    _id: 'MI_paneer_momo_veg',
    name: 'Paneer Momo',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN'],
    price: 14,
    desc: 'Steamed dumplings filled with seasoned paneer.',
    emoji: '🥟',
    image_url: '/images/menu/paneer_momo.webp',
    sort_order: 6
  },
  {
    _id: 'MI_veg_samosa_veg',
    name: 'Veg Samosa',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 8,
    desc: 'Crispy pastry triangles with spiced potato and pea filling. (3 pc)',
    emoji: '🥟',
    image_url: '/images/menu/veg_sam.webp',
    sort_order: 7
  },
  {
    _id: 'MI_chips_and_queso_veg',
    name: 'Chips and Queso',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS', 'CAT_CONTINENTAL'],
    price: 10,
    desc: 'Crisp tortilla chips with warm, melted cheese dip.',
    emoji: '🧀',
    image_url: '/images/menu/v_chipsq.webp',
    sort_order: 8
  },
  {
    _id: 'MI_chips_and_guacamole_veg',
    name: 'Chips and Guacamole',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 10,
    desc: 'Crisp tortilla chips with guacamole dip.',
    emoji: '🥑',
    image_url: '/images/menu/v_chipsg.webp',
    sort_order: 9
  },
  {
    _id: 'MI_daal_chawal_veg',
    name: 'Daal Chawal',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN'],
    price: 14,
    desc: 'Slow-cooked lentils served over basmati rice with cumin tadka.',
    emoji: '🍛',
    image_url: '/images/menu/daal_chawal.webp',
    sort_order: 10
  },
  {
    _id: 'MI_fries_veg',
    name: 'Fries',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 7,
    desc: 'Potato fries with house seasoning.',
    emoji: '🍟',
    image_url: '/images/menu/v_fries.webp',
    sort_order: 11
  },
  {
    _id: 'MI_loaded_fries_veg',
    name: 'Loaded Fries',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 12,
    desc: 'Fries topped with cheese, jalapeños, green onion, and sour cream.',
    emoji: '🍟',
    image_url: '/images/menu/v_ldfr.webp',
    sort_order: 12
  },
  {
    _id: 'MI_loaded_nachos_veg',
    name: 'Loaded Nachos',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 12,
    desc: 'Tortilla chips piled with cheese, jalapeños, salsa, and sour cream.',
    emoji: '🧀',
    image_url: '/images/menu/v_ldna.webp',
    sort_order: 13
  },
  {
    _id: 'MI_spicy_aloo_chaat_veg',
    name: 'Spicy Aloo Chaat',
    category_id: 'CAT_VEGETARIAN',
    category_ids: ['CAT_VEGETARIAN', 'CAT_APPETIZERS'],
    price: 10,
    desc: 'Spiced potatoes, tangy chutneys, creamy yogurt, and crunchy sev served in a crispy pastry bowl.',
    emoji: '🥗',
    image_url: '/images/menu/spicy_aloo_chaat.jpg',
    sort_order: 14
  },

  // ── CONTINENTAL STREET FOOD ────────────────────────────────────────────────
  {
    _id: 'MI_chips_and_queso_cont',
    name: 'Chips and Queso',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL', 'CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    price: 10,
    desc: 'Crisp tortilla chips with warm, melted cheese dip.',
    emoji: '🧀',
    image_url: '/images/menu/chips_q.webp',
    sort_order: 1
  },
  {
    _id: 'MI_chili_chicken_cont',
    name: 'Chili Chicken',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 22,
    desc: 'Indo-Chinese wok-tossed chicken with green chili, soy, and bell pepper. Served with fried rice.',
    emoji: '🍗',
    image_url: '/images/menu/chili_c.webp',
    sort_order: 2
  },
  {
    _id: 'MI_mongolian_chicken_cont',
    name: 'Mongolian Chicken',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 22,
    desc: 'Crispy chicken tossed in sweet-savory Mongolian sauce with scallions. Served with fried rice.',
    emoji: '🍗',
    image_url: '/images/menu/mongolian_chicken.webp',
    sort_order: 3
  },
  {
    _id: 'MI_momo_cont',
    name: 'Momo',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 14,
    desc: 'Famous street-style steamed dumplings filled with your choice of chicken, beef, or paneer. (6 pc)',
    emoji: '🥟',
    image_url: '/images/menu/momo.webp',
    sort_order: 4
  },
  {
    _id: 'MI_chow_mein_cont',
    name: 'Chow Mein',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 15,
    desc: 'Stir-fried noodles with vegetables. Add your choice of protein for $3.',
    emoji: '🍜',
    image_url: '/images/menu/chow_mein.webp',
    sort_order: 5
  },
  {
    _id: 'MI_daal_chawal_shami_cont',
    name: 'Daal Chawal with Beef Shami',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 15,
    desc: 'Lentils and rice served with grilled beef shami kabob and chutney.',
    emoji: '🍛',
    image_url: '/images/menu/daal_chawal_with_beef_shami.webp',
    sort_order: 6
  },
  {
    _id: 'MI_chicken_cordon_bleu_cont',
    name: 'Chicken Cordon Bleu',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 26,
    desc: 'Crispy breaded chicken stuffed with melted cheese, served with creamy mashed potatoes.',
    emoji: '🍗',
    image_url: '/images/menu/cordon.webp',
    sort_order: 7
  },
  {
    _id: 'MI_kung_pao_chicken_cont',
    name: 'Kung Pao Chicken',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 22,
    desc: 'Stir-fried chicken with bell peppers, scallions, and chilies in a savory-sweet Kung Pao sauce. Served with fried rice. Contains peanuts.',
    emoji: '🍗',
    image_url: '/images/menu/mongolian_chicken.webp',
    sort_order: 8
  },
  {
    _id: 'MI_orange_chicken_cont',
    name: 'Orange Chicken',
    category_id: 'CAT_CONTINENTAL',
    category_ids: ['CAT_CONTINENTAL'],
    price: 22,
    desc: 'Chicken pieces tossed in a sweet and tangy orange glaze, finished with scallions and sesame seeds. Served with fried rice.',
    emoji: '🍗',
    image_url: '/images/menu/dynamite_chicken.webp',
    sort_order: 9
  },

  // ── WINGS ──────────────────────────────────────────────────────────────────
  {
    _id: 'MI_wings_6pc',
    name: '6 pc Wings',
    category_id: 'CAT_WINGS',
    category_ids: ['CAT_WINGS'],
    price: 11,
    desc: 'Choose any sauce below.',
    emoji: '🍗',
    image_url: '/images/menu/wings6.webp',
    sort_order: 1,
    modifier_groups: [wingSauceModifierGroup]
  },
  {
    _id: 'MI_wings_10pc',
    name: '10 pc Wings',
    category_id: 'CAT_WINGS',
    category_ids: ['CAT_WINGS'],
    price: 17,
    desc: 'Choose any sauce below.',
    emoji: '🍗',
    image_url: '/images/menu/wings10.webp',
    sort_order: 2,
    modifier_groups: [wingSauceModifierGroup]
  },

  // ── MAINS ──────────────────────────────────────────────────────────────────
  {
    _id: 'MI_shawarma_plate_main',
    name: 'Shawarma Plate',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 19,
    desc: 'Marinated chicken or beef shawarma with garlic toum, pickles, and rice.',
    emoji: '🥩',
    image_url: '/images/menu/shawarma_plate.webp',
    sort_order: 1
  },
  {
    _id: 'MI_beef_koobideh_main',
    name: 'Beef Koobideh',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 26,
    desc: 'Persian-style ground beef kabobs, served with salad.',
    emoji: '🥩',
    image_url: '/images/menu/koobideh.webp',
    sort_order: 2
  },
  {
    _id: 'MI_chicken_boti_main',
    name: 'Chicken Boti',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 18,
    desc: 'Charcoal-grilled spiced chicken cubes served with mint chutney and naan.',
    emoji: '🍗',
    image_url: '/images/menu/chk_boti.webp',
    sort_order: 3
  },
  {
    _id: 'MI_chicken_kabob_main',
    name: 'Chicken Kabob',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 19,
    desc: 'Tender grilled chicken skewers marinated with spices. Served with rice and garlic sauce.',
    emoji: '🍗',
    image_url: '/images/menu/chk_kab.webp',
    sort_order: 4
  },
  {
    _id: 'MI_lamb_chops_main',
    name: 'Lamb Chops',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 32,
    desc: 'Herb-marinated lamb chops, charred over open flame, with mashed potatoes.',
    emoji: '🥩',
    image_url: '/images/menu/lamb_chops.webp',
    sort_order: 5
  },
  {
    _id: 'MI_chicken_dum_biryani_main',
    name: 'Chicken Dum Biryani',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 20,
    desc: 'Slow-cooked basmati and spiced chicken sealed in a dough pot, with raita.',
    emoji: '🍛',
    image_url: '/images/menu/biryani.webp',
    sort_order: 6
  },
  {
    _id: 'MI_chicken_parmesan_main',
    name: 'Chicken Parmesan',
    category_id: 'CAT_MAINS',
    category_ids: ['CAT_MAINS'],
    price: 18,
    desc: 'Chicken topped with melted Parmesan, served with creamy mashed potatoes and garlic sauce.',
    emoji: '🍗',
    image_url: '/images/menu/cordon.webp',
    sort_order: 7
  },

  // ── BURGERS ────────────────────────────────────────────────────────────────
  {
    _id: 'MI_beef_smash_burger',
    name: 'Beef Smash',
    category_id: 'CAT_BURGERS',
    category_ids: ['CAT_BURGERS'],
    price: 18,
    desc: 'Double smashed beef patties with American cheese, pickles, and Cavalli sauce.',
    emoji: '🍔',
    image_url: '/images/menu/smash.webp',
    sort_order: 1
  },
  {
    _id: 'MI_chicken_zinger_burger',
    name: 'Chicken Zinger',
    category_id: 'CAT_BURGERS',
    category_ids: ['CAT_BURGERS'],
    price: 18,
    desc: 'Crispy spiced chicken fillet with lettuce, mayo, and pickles.',
    emoji: '🍔',
    image_url: '/images/menu/zinger.webp',
    sort_order: 2
  },
  {
    _id: 'MI_chicken_club_sandwich',
    name: 'Chicken Club Sandwich',
    category_id: 'CAT_BURGERS',
    category_ids: ['CAT_BURGERS'],
    price: 15,
    desc: 'Grilled chicken, lettuce, tomato, and aioli on toasted bread.',
    emoji: '🥪',
    image_url: '/images/menu/club.webp',
    sort_order: 3
  },
  {
    _id: 'MI_swiss_mushroom_burger',
    name: 'Swiss Mushroom',
    category_id: 'CAT_BURGERS',
    category_ids: ['CAT_BURGERS'],
    price: 18,
    desc: 'Beef patty with sautéed mushrooms, Swiss cheese, and caramelized onions.',
    emoji: '🍔',
    image_url: '/images/menu/swiss_mushroom.webp',
    sort_order: 4
  },

  // ── WRAPS ──────────────────────────────────────────────────────────────────
  {
    _id: 'MI_shawarma_wrap',
    name: 'Shawarma Wrap',
    category_id: 'CAT_WRAPS',
    category_ids: ['CAT_WRAPS'],
    price: 15,
    desc: 'Chicken or beef shawarma in pita with toum, pickles, and fries.',
    emoji: '🌯',
    image_url: '/images/menu/shawarma_wrap.webp',
    sort_order: 1
  },
  {
    _id: 'MI_dynamite_chicken_wrap',
    name: 'Dynamite Chicken Wrap',
    category_id: 'CAT_WRAPS',
    category_ids: ['CAT_WRAPS'],
    price: 15,
    desc: 'Crispy spiced chicken with lettuce and signature dynamite sauce.',
    emoji: '🌯',
    image_url: '/images/menu/dynamite_chicken_wrap.webp',
    sort_order: 2
  },
  {
    _id: 'MI_zinger_wrap',
    name: 'Zinger Wrap',
    category_id: 'CAT_WRAPS',
    category_ids: ['CAT_WRAPS'],
    price: 15,
    desc: 'Crispy zinger fillet with lettuce, cheese, and mayo in a soft wrap.',
    emoji: '🌯',
    image_url: '/images/menu/zinger_wrap.webp',
    sort_order: 3
  },
  {
    _id: 'MI_mirchi_paratha_roll',
    name: 'Mirchi Paratha Roll',
    category_id: 'CAT_WRAPS',
    category_ids: ['CAT_WRAPS'],
    price: 15,
    desc: 'Spicy chili-seasoned chicken rolled in flaky paratha with chutneys.',
    emoji: '🌯',
    image_url: '/images/menu/mirchi_paratha_roll.webp',
    sort_order: 4
  },

  // ── DESSERTS ───────────────────────────────────────────────────────────────
  {
    _id: 'MI_kunafa_dessert',
    name: 'Kunafa',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 12,
    desc: 'Crispy shredded pastry layered with creamy cheese, finished with sweet syrup. Available Regular, Pistachio, or Nutella.',
    emoji: '🍰',
    image_url: '/images/menu/chocolate_cake.webp',
    sort_order: 1
  },
  {
    _id: 'MI_biscoff_cake_dessert',
    name: 'Biscoff Cake',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 12,
    desc: 'Rich spiced caramel biscuit cake with whipped lotus mascarpone cream.',
    emoji: '🍰',
    image_url: '/images/menu/car_cr.webp',
    sort_order: 2
  },
  {
    _id: 'MI_gajar_halwa_cheesecake_dessert',
    name: 'Gajar Halwa Cheesecake',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 14,
    desc: 'Fusion spiced carrot confection layered over rich velvet cheesecake.',
    emoji: '🍰',
    image_url: '/images/menu/choc_ck.webp',
    sort_order: 3
  },
  {
    _id: 'MI_mango_lassi_cheesecake_dessert',
    name: 'Mango Lassi Cheesecake',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 14,
    desc: 'Creamy mango-infused cheesecake topped with cardamom mango coulis.',
    emoji: '🍰',
    image_url: '/images/menu/butt_b.webp',
    sort_order: 4
  },
  {
    _id: 'MI_rasmalai_cake_dessert',
    name: 'Rasmalai Cake',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 12,
    desc: 'Saffron-infused sponge soaked in cardamom milk with chopped pistachios.',
    emoji: '🍰',
    image_url: '/images/menu/pistachio_cake.webp',
    sort_order: 5
  },
  {
    _id: 'MI_gulab_jamun_dessert',
    name: 'Gulab Jamun',
    category_id: 'CAT_DESSERTS',
    category_ids: ['CAT_DESSERTS'],
    price: 8,
    desc: 'Warm milk-solid dumplings soaked in rose and cardamom sugar syrup.',
    emoji: '🍯',
    image_url: '/images/menu/raspberry_white_chocolate_cake.webp',
    sort_order: 6
  },

  // ── REFRESHERS ─────────────────────────────────────────────────────────────
  {
    _id: 'MI_classic_mint_mojito',
    name: 'Classic Mint Mojito',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Fresh mint leaves muddled with lime and sparkling soda.',
    emoji: '🍹',
    image_url: '/images/menu/classic_mint_mojito.webp',
    sort_order: 1
  },
  {
    _id: 'MI_mango_mojito',
    name: 'Mango Mojito',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Tropical mango puree paired with muddled fresh lime and mint.',
    emoji: '🍹',
    image_url: '/images/menu/mango_mojito.webp',
    sort_order: 2
  },
  {
    _id: 'MI_lychee_mojito',
    name: 'Lychee Mojito',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Sweet floral lychee notes infused with refreshing lime and mint.',
    emoji: '🍹',
    image_url: '/images/menu/lychee_mojito.webp',
    sort_order: 3
  },
  {
    _id: 'MI_mint_margarita',
    name: 'Mint Margarita',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Blended mint, citrus lime, and rock salt mocktail.',
    emoji: '🍹',
    image_url: '/images/menu/mint_margarita.webp',
    sort_order: 4
  },
  {
    _id: 'MI_rim_fire_melon',
    name: 'Rim Fire Melon',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Watermelon with spicy chili rim and tangy citrus zest.',
    emoji: '🍉',
    image_url: '/images/menu/rim_fire_melon.webp',
    sort_order: 5
  },
  {
    _id: 'MI_watermelon_juice',
    name: 'Watermelon Juice',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Freshly pressed chilled watermelon juice.',
    emoji: '🍉',
    image_url: '/images/menu/watermelon_juice.webp',
    sort_order: 6
  },
  {
    _id: 'MI_orange_juice',
    name: 'Orange Juice',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: '100% pure fresh-squeezed Florida orange juice.',
    emoji: '🍊',
    image_url: '/images/menu/orange_juice.webp',
    sort_order: 7
  },
  {
    _id: 'MI_mango_shake',
    name: 'Mango Shake',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 12,
    desc: 'Rich velvety mango pulp blended with vanilla ice cream and whole milk.',
    emoji: '🥭',
    image_url: '/images/menu/mango_shake.webp',
    sort_order: 8
  },
  {
    _id: 'MI_sweet_lassi',
    name: 'Sweet Lassi',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 8,
    desc: 'Traditional chilled sweetened yogurt drink with cardamom essence.',
    emoji: '🥛',
    image_url: '/images/menu/sweet_lassi.webp',
    sort_order: 9
  },
  {
    _id: 'MI_oceans_secret',
    name: 'Ocean\'s Secret',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Deep blue curaçao mocktail layered with tropical coconut and pineapple.',
    emoji: '🌊',
    image_url: '/images/menu/ocean_s_secret.webp',
    sort_order: 10
  },
  {
    _id: 'MI_pina_colada',
    name: 'Pina Colada',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Creamy coconut milk blended with tangy crushed pineapple.',
    emoji: '🍍',
    image_url: '/images/menu/pina_colada.webp',
    sort_order: 11
  },
  {
    _id: 'MI_red_affair',
    name: 'Red Affair',
    category_id: 'CAT_DRINKS_REFRESHERS',
    category_ids: ['CAT_DRINKS_REFRESHERS'],
    price: 10,
    desc: 'Crimson berry blend infused with pomegranate and sparking citrus soda.',
    emoji: '🍓',
    image_url: '/images/menu/red_affair.webp',
    sort_order: 12
  },

  // ── TEA & COFFEE ───────────────────────────────────────────────────────────
  {
    _id: 'MI_karak_chai',
    name: 'Karak Chai',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 4,
    desc: 'Strong brewed black tea simmered with evaporated milk and crushed cardamom.',
    emoji: '☕',
    image_url: '/images/menu/karak_chai.webp',
    sort_order: 1
  },
  {
    _id: 'MI_kashmiri_chai',
    name: 'Kashmiri Chai',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 4,
    desc: 'Traditional pink tea brewed with green tea leaves, crushed pistachios, and almonds.',
    emoji: '☕',
    image_url: '/images/menu/kashmiri_chai.webp',
    sort_order: 2
  },
  {
    _id: 'MI_desi_coffee',
    name: 'Desi Coffee',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 6,
    desc: 'Whipped frothy hand-beaten espresso style coffee with hot steamed milk.',
    emoji: '☕',
    image_url: '/images/menu/desi_coffee.webp',
    sort_order: 3
  },
  {
    _id: 'MI_cold_coffee',
    name: 'Cold Coffee',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 7,
    desc: 'Chilled blended espresso with chocolate drizzle and cream.',
    emoji: '🧊',
    image_url: '/images/menu/cold_coffee.webp',
    sort_order: 4
  },
  {
    _id: 'MI_mint_tea',
    name: 'Mint Tea',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 4,
    desc: 'Fresh steeped peppermint leaves with wild honey.',
    emoji: '🫖',
    image_url: '/images/menu/mint_tea.webp',
    sort_order: 5
  },
  {
    _id: 'MI_moroccan_tea',
    name: 'Moroccan Tea',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 4,
    desc: 'Green gunpowder tea brewed with fresh spearmint leaves and cane sugar.',
    emoji: '🫖',
    image_url: '/images/menu/moroccan_tea.webp',
    sort_order: 6
  },
  {
    _id: 'MI_pistachio_latte',
    name: 'Pistachio Latte',
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    category_ids: ['CAT_DRINKS_TEA_COFFEE'],
    price: 7,
    desc: 'Steamed milk with rich double espresso, sweet pistachio cream, and crushed nuts.',
    emoji: '☕',
    image_url: '/images/menu/pistachio_latte.webp',
    sort_order: 7
  },

  // ── SOFT DRINKS ────────────────────────────────────────────────────────────
  {
    _id: 'MI_soft_drinks_selection',
    name: 'Soft Drinks',
    category_id: 'CAT_DRINKS_SOFT',
    category_ids: ['CAT_DRINKS_SOFT'],
    price: 4,
    desc: 'Choice of Coca-Cola, Coke Zero / Diet, Fanta, Ginger Ale, Sprite, Dr Pepper.',
    emoji: '🥤',
    image_url: '/images/menu/classic_mint_mojito.webp',
    sort_order: 1,
    modifier_groups: [softDrinkModifierGroup]
  },
  {
    _id: 'MI_red_bull',
    name: 'Red Bull',
    category_id: 'CAT_DRINKS_SOFT',
    category_ids: ['CAT_DRINKS_SOFT'],
    price: 6,
    desc: 'Energy drink (Regular or Sugarfree).',
    emoji: '⚡',
    image_url: '/images/menu/red_affair.webp',
    sort_order: 2
  },
  {
    _id: 'MI_sparkling_water',
    name: 'Sparkling Water',
    category_id: 'CAT_DRINKS_SOFT',
    category_ids: ['CAT_DRINKS_SOFT'],
    price: 6,
    desc: 'Chilled bottle of effervescent sparkling water.',
    emoji: '💧',
    image_url: '/images/menu/cold_coffee.webp',
    sort_order: 3
  },
  {
    _id: 'MI_saratoga_water',
    name: 'Saratoga Water',
    category_id: 'CAT_DRINKS_SOFT',
    category_ids: ['CAT_DRINKS_SOFT'],
    price: 4.5,
    desc: 'Premium natural spring water in cobalt blue glass bottle.',
    emoji: '💧',
    image_url: '/images/menu/mint_tea.webp',
    sort_order: 4
  },

  // ── HOOKAH HOUSE MIXES ─────────────────────────────────────────────────────
  {
    _id: 'MI_cavalli_crush_hookah',
    name: 'Cavalli Crush',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'House blend of passion fruit, iced berries, and sweet mint.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 1
  },
  {
    _id: 'MI_shah_jahan_hookah',
    name: 'Shah Jahan',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Regal mix of saffron spice, sweet double apple, and royal mint.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 2
  },
  {
    _id: 'MI_habibi_nights_hookah',
    name: 'Habibi Nights',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Grape mint combined with smooth lemon chill.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 3
  },
  {
    _id: 'MI_kashmiri_chai_hookah',
    name: 'Kashmiri Chai (House Mix)',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Spiced aromatic pink tea notes with creamy vanilla undertones.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 4
  },
  {
    _id: 'MI_anarkali_hookah',
    name: 'Anarkali',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Sweet pomegranate, wild berries, and cooling frosted mint.',
    emoji: '💨',
    image_url: '/images/menu/hookah_anarkali.png',
    sort_order: 5
  },
  {
    _id: 'MI_white_king_hookah',
    name: 'White King',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'White gummy bear with sweet peach and sub-zero ice.',
    emoji: '💨',
    image_url: '/images/menu/hookah_white_king.png',
    sort_order: 6
  },
  {
    _id: 'MI_zaalim_hookah',
    name: 'Zaalim',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Bold citrus punch, spiced paan, and frozen mint.',
    emoji: '💨',
    image_url: '/images/menu/hookah_zalim.png',
    sort_order: 7
  },
  {
    _id: 'MI_shokha_hookah',
    name: 'Shokha',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Exotic guava, juicy kiwi, and iced spearmint.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 8
  },
  {
    _id: 'MI_dubai_nights_hookah',
    name: 'Dubai Nights',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Rich sweet mango, passionfruit, and chilled lime mist.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 9
  },
  {
    _id: 'MI_dragon_hookah',
    name: 'Dragon',
    category_id: 'CAT_HOOKAH_HOUSE_MIXES',
    category_ids: ['CAT_HOOKAH_HOUSE_MIXES'],
    price: 35,
    desc: 'Fiery dragonfruit, iced watermelon, and citrus burst.',
    emoji: '💨',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 10
  },

  // ── HOOKAH EXTRAS ──────────────────────────────────────────────────────────
  {
    _id: 'MI_head_refill_hookah',
    name: 'Head Refill',
    category_id: 'CAT_HOOKAH_EXTRAS',
    category_ids: ['CAT_HOOKAH_EXTRAS'],
    price: 10,
    desc: 'Freshly packed replacement bowl with your choice of flavor.',
    emoji: '🔥',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 1
  },
  {
    _id: 'MI_ice_hose_hookah',
    name: 'Ice Hose',
    category_id: 'CAT_HOOKAH_EXTRAS',
    category_ids: ['CAT_HOOKAH_EXTRAS'],
    price: 6,
    desc: 'Frozen gel ice hose attachment for ultra-chilled smoke.',
    emoji: '❄️',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 2
  },
  {
    _id: 'MI_ice_base_hookah',
    name: 'Ice Base',
    category_id: 'CAT_HOOKAH_EXTRAS',
    category_ids: ['CAT_HOOKAH_EXTRAS'],
    price: 2,
    desc: 'Chilled base filled with ice cubes for cooler clouds.',
    emoji: '🧊',
    image_url: '/images/menu/hookah_generic.png',
    sort_order: 3
  }
];

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('benzin_saas_db');

  console.log(`Setting up categories for restaurant: ${RESTAURANT_ID}`);
  for (const cat of categories) {
    await db.collection<any>('menu_categories').updateOne(
      { _id: cat._id, restaurant_id: RESTAURANT_ID },
      { $set: cat },
      { upsert: true }
    );
  }
  console.log(`✅ Upserted ${categories.length} categories.`);

  console.log(`Dropping and rewriting clean menu items for ${RESTAURANT_ID}...`);
  // Remove existing items for this restaurant to ensure zero duplicates/ghost items
  const delRes = await db.collection<any>('menu_items').deleteMany({ restaurant_id: RESTAURANT_ID });
  console.log(`Deleted ${delRes.deletedCount} old items.`);

  const now = new Date().toISOString();
  const docsToInsert = allItems.map(item => ({
    _id: item._id,
    restaurant_id: RESTAURANT_ID,
    category_id: item.category_id,
    category_ids: item.category_ids,
    category: item.category_id,
    name: item.name,
    price: item.price,
    desc: item.desc,
    description: item.desc,
    emoji: item.emoji,
    image_url: item.image_url,
    imageUrl: item.image_url,
    image: item.image_url,
    sort_order: item.sort_order,
    available: true,
    active: true,
    recipe: [],
    variants: [],
    modifier_groups: item.modifier_groups || [],
    modifierGroups: item.modifier_groups || [],
    created_at: now,
    updated_at: now
  }));

  const insertRes = await db.collection<any>('menu_items').insertMany(docsToInsert);
  console.log(`✅ Successfully inserted ${insertRes.insertedCount} menu items!`);

  // Verify counts per category
  console.log('\n--- VERIFICATION OF CATEGORIES ---');
  for (const cat of categories) {
    const directCount = await db.collection('menu_items').countDocuments({
      restaurant_id: RESTAURANT_ID,
      category_id: cat._id
    });
    const multiCount = await db.collection('menu_items').countDocuments({
      restaurant_id: RESTAURANT_ID,
      category_ids: cat._id
    });
    if (directCount > 0 || multiCount > 0) {
      console.log(`  ${cat.name.padEnd(25)} (${cat._id}): Direct = ${directCount}, In category_ids = ${multiCount}`);
    }
  }

  // Check Wings sauce modifier groups
  const wingsCheck = await db.collection('menu_items').find({
    restaurant_id: RESTAURANT_ID,
    category_id: 'CAT_WINGS'
  }).toArray();
  console.log(`\nWings items with modifier_groups:`);
  wingsCheck.forEach(w => {
    console.log(`  - ${w.name}: groups = ${w.modifier_groups.length}, options = ${w.modifier_groups[0]?.options?.length}, max_selection = ${w.modifier_groups[0]?.max_selection}`);
  });

  await client.close();
  console.log('\nAll done! Database seeding completed successfully.');
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
