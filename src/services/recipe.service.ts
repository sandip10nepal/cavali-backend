import { DbService } from './db.service';

export interface IngredientDeduction {
  ingredientId: string;
  amount: number;
}

// Recipes dictionary mapping item IDs to ingredients list
const RECIPES: Record<string, IngredientDeduction[]> = {
  // --- APPETIZERS ---
  hummus: [
    { ingredientId: 'chickpeas', amount: 80 },
    { ingredientId: 'tahini', amount: 20 },
    { ingredientId: 'pita_bread', amount: 1 }
  ],
  falafel: [
    { ingredientId: 'chickpea_flour', amount: 60 },
    { ingredientId: 'tahini', amount: 15 },
    { ingredientId: 'jalapenos', amount: 10 }
  ],
  dyn_chk: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'sour_cream', amount: 30 }
  ],
  bun_kab: [
    { ingredientId: 'spiced_patty', amount: 1 },
    { ingredientId: 'soft_bun', amount: 1 }
  ],
  samosa: [
    { ingredientId: 'samosa_wrappers', amount: 3 }
  ],
  papri: [
    { ingredientId: 'wafers', amount: 50 },
    { ingredientId: 'chickpeas', amount: 30 },
    { ingredientId: 'yogurt', amount: 30 }
  ],
  pani: [
    { ingredientId: 'hollow_puris', amount: 6 },
    { ingredientId: 'potatoes', amount: 50 },
    { ingredientId: 'chickpeas', amount: 20 }
  ],
  spy_pot: [
    { ingredientId: 'potatoes', amount: 200 }
  ],
  tenders: [
    { ingredientId: 'tenders', amount: 3 },
    { ingredientId: 'frozen_fries', amount: 150 }
  ],
  pizza_b: [
    { ingredientId: 'american_cheese', amount: 2 }
  ],
  fries: [
    { ingredientId: 'frozen_fries', amount: 150 }
  ],
  ld_fries: [
    { ingredientId: 'frozen_fries', amount: 200 },
    { ingredientId: 'queso_dip', amount: 50 },
    { ingredientId: 'jalapenos', amount: 15 },
    { ingredientId: 'sour_cream', amount: 15 }
  ],
  ld_nachos: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'queso_dip', amount: 60 },
    { ingredientId: 'jalapenos', amount: 20 },
    { ingredientId: 'sour_cream', amount: 20 }
  ],
  chips_q: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'queso_dip', amount: 80 }
  ],
  chips_g: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'guacamole', amount: 80 }
  ],

  // --- MAINS ---
  shaw_pl: [
    { ingredientId: 'shawarma_meat', amount: 180 },
    { ingredientId: 'frozen_fries', amount: 100 }
  ],
  koobideh: [
    { ingredientId: 'beef_koobideh', amount: 2 }
  ],
  chk_boti: [
    { ingredientId: 'chicken_breast', amount: 200 },
    { ingredientId: 'naan', amount: 1 }
  ],
  chk_kab: [
    { ingredientId: 'chicken_breast', amount: 180 },
    { ingredientId: 'basmati_rice', amount: 150 }
  ],
  lamb_ch: [
    { ingredientId: 'lamb_chops', amount: 3 },
    { ingredientId: 'potatoes', amount: 100 }
  ],
  but_chk: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'milk', amount: 100 },
    { ingredientId: 'basmati_rice', amount: 150 }
  ],
  biryani: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'basmati_rice', amount: 200 },
    { ingredientId: 'yogurt', amount: 30 }
  ],

  // --- WINGS ---
  wings6: [
    { ingredientId: 'tenders', amount: 6 }
  ],
  wings10: [
    { ingredientId: 'tenders', amount: 10 }
  ],

  // --- VEGETARIAN ---
  v_papri: [
    { ingredientId: 'wafers', amount: 50 },
    { ingredientId: 'chickpeas', amount: 30 },
    { ingredientId: 'yogurt', amount: 30 }
  ],
  v_pani: [
    { ingredientId: 'hollow_puris', amount: 6 },
    { ingredientId: 'potatoes', amount: 50 },
    { ingredientId: 'chickpeas', amount: 20 }
  ],
  v_spypot: [
    { ingredientId: 'potatoes', amount: 200 }
  ],
  v_fal: [
    { ingredientId: 'chickpea_flour', amount: 60 },
    { ingredientId: 'tahini', amount: 15 }
  ],
  v_hum: [
    { ingredientId: 'chickpeas', amount: 80 },
    { ingredientId: 'tahini', amount: 20 },
    { ingredientId: 'pita_bread', amount: 1 }
  ],
  paneer_m: [
    { ingredientId: 'dumpling_wrappers', amount: 6 }
  ],
  veg_sam: [
    { ingredientId: 'samosa_wrappers', amount: 3 }
  ],
  v_chipsq: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'queso_dip', amount: 80 }
  ],
  v_chipsg: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'guacamole', amount: 80 }
  ],
  daal_c: [
    { ingredientId: 'lentils', amount: 100 },
    { ingredientId: 'basmati_rice', amount: 200 }
  ],
  v_fries: [
    { ingredientId: 'frozen_fries', amount: 150 }
  ],
  v_ldfr: [
    { ingredientId: 'frozen_fries', amount: 200 },
    { ingredientId: 'queso_dip', amount: 50 },
    { ingredientId: 'jalapenos', amount: 15 }
  ],
  v_ldna: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'queso_dip', amount: 60 },
    { ingredientId: 'jalapenos', amount: 20 }
  ],

  // --- BURGERS ---
  smash: [
    { ingredientId: 'beef_patty', amount: 2 },
    { ingredientId: 'american_cheese', amount: 2 },
    { ingredientId: 'burger_bun', amount: 1 }
  ],
  zinger: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'burger_bun', amount: 1 },
    { ingredientId: 'lettuce', amount: 10 }
  ],
  club: [
    { ingredientId: 'chicken_breast', amount: 100 },
    { ingredientId: 'lettuce', amount: 15 }
  ],
  swiss_m: [
    { ingredientId: 'beef_patty', amount: 1 },
    { ingredientId: 'swiss_cheese', amount: 1 },
    { ingredientId: 'burger_bun', amount: 1 },
    { ingredientId: 'mushrooms', amount: 50 },
    { ingredientId: 'onions', amount: 30 }
  ],

  // --- WRAPS ---
  shaw_w: [
    { ingredientId: 'shawarma_meat', amount: 120 },
    { ingredientId: 'pita_bread', amount: 1 }
  ],
  dyn_w: [
    { ingredientId: 'chicken_breast', amount: 120 },
    { ingredientId: 'pita_bread', amount: 1 }
  ],
  zing_w: [
    { ingredientId: 'chicken_breast', amount: 120 },
    { ingredientId: 'burger_bun', amount: 1 }
  ],
  mir_p: [
    { ingredientId: 'chicken_breast', amount: 120 },
    { ingredientId: 'naan', amount: 1 }
  ],

  // --- CONTINENTAL ---
  tacos: [
    { ingredientId: 'chicken_breast', amount: 120 }
  ],
  c_chipsq: [
    { ingredientId: 'tortilla_chips', amount: 100 },
    { ingredientId: 'queso_dip', amount: 80 }
  ],
  chili_c: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'basmati_rice', amount: 150 }
  ],
  mongo_c: [
    { ingredientId: 'chicken_breast', amount: 150 },
    { ingredientId: 'basmati_rice', amount: 150 }
  ],
  momo: [
    { ingredientId: 'dumpling_wrappers', amount: 6 },
    { ingredientId: 'dumpling_meat', amount: 100 }
  ],
  chow: [
    { ingredientId: 'onions', amount: 30 }
  ],
  daal_s: [
    { ingredientId: 'lentils', amount: 100 },
    { ingredientId: 'basmati_rice', amount: 150 },
    { ingredientId: 'shami_kabob', amount: 1 }
  ],
  cordon: [
    { ingredientId: 'chicken_breast', amount: 200 },
    { ingredientId: 'american_cheese', amount: 2 },
    { ingredientId: 'potatoes', amount: 100 }
  ],

  // --- DESSERTS ---
  car_cr: [{ ingredientId: 'caramel_cake', amount: 1 }],
  pis_ck: [{ ingredientId: 'pistachio_cake', amount: 1 }],
  rasp_ck: [{ ingredientId: 'raspberry_cake', amount: 1 }],
  choc_ck: [{ ingredientId: 'chocolate_cake', amount: 1 }],
  butt_b: [{ ingredientId: 'butterscotch_cake', amount: 1 }],

  // --- DRINKS: REFRESHERS ---
  cl_moj: [
    { ingredientId: 'mint_leaves', amount: 5 },
    { ingredientId: 'lime', amount: 0.5 },
    { ingredientId: 'syrup', amount: 30 },
    { ingredientId: 'soda', amount: 150 }
  ],
  mn_moj: [
    { ingredientId: 'mint_leaves', amount: 5 },
    { ingredientId: 'syrup', amount: 40 },
    { ingredientId: 'soda', amount: 150 }
  ],
  ly_moj: [
    { ingredientId: 'mint_leaves', amount: 5 },
    { ingredientId: 'syrup', amount: 40 },
    { ingredientId: 'soda', amount: 150 }
  ],
  mt_marg: [
    { ingredientId: 'mint_leaves', amount: 5 },
    { ingredientId: 'lime', amount: 0.5 },
    { ingredientId: 'soda', amount: 150 }
  ],
  rm_fire: [
    { ingredientId: 'watermelon', amount: 200 }
  ],
  wm_jce: [
    { ingredientId: 'watermelon', amount: 250 }
  ],
  or_jce: [
    { ingredientId: 'orange_fruit', amount: 3 }
  ],
  mn_shk: [
    { ingredientId: 'milk', amount: 200 }
  ],
  sw_las: [
    { ingredientId: 'yogurt', amount: 150 },
    { ingredientId: 'milk', amount: 50 }
  ],

  // --- DRINKS: TEA & COFFEE ---
  karak: [
    { ingredientId: 'milk', amount: 100 },
    { ingredientId: 'black_tea', amount: 5 }
  ],
  kash_c: [
    { ingredientId: 'milk', amount: 100 },
    { ingredientId: 'pink_tea', amount: 5 }
  ],
  desi_c: [
    { ingredientId: 'milk', amount: 120 },
    { ingredientId: 'coffee_beans', amount: 10 }
  ],
  cold_c: [
    { ingredientId: 'milk', amount: 150 },
    { ingredientId: 'coffee_beans', amount: 10 }
  ],
  mint_t: [
    { ingredientId: 'mint_leaves', amount: 5 }
  ],
  moroc_t: [
    { ingredientId: 'mint_leaves', amount: 3 }
  ],

  // --- DRINKS: SOFT DRINKS ---
  coca: [{ ingredientId: 'coca_cola', amount: 1 }],
  coke_z: [{ ingredientId: 'coke_zero', amount: 1 }],
  fanta: [{ ingredientId: 'fanta', amount: 1 }],
  ging_a: [{ ingredientId: 'ginger_ale', amount: 1 }],
  sprite: [{ ingredientId: 'sprite', amount: 1 }],
  drpep: [{ ingredientId: 'dr_pepper', amount: 1 }],
  redbull: [{ ingredientId: 'red_bull', amount: 1 }],
  spark_w: [{ ingredientId: 'sparkling_water', amount: 1 }],
  sara_w: [{ ingredientId: 'saratoga_water', amount: 1 }]
};

// Composite House Mix Shisha Recipes (ratios sum to 100%)
const HOUSE_MIX_RECIPES: Record<string, { id: string; ratio: number }[]> = {
  anarkali: [
    { id: 'pan_ras', ratio: 30 },
    { id: 'lady_killer', ratio: 40 },
    { id: 'bagdadi', ratio: 30 }
  ],
  sokha: [
    { id: 'pan_ras', ratio: 30 },
    { id: 'lychee', ratio: 40 },
    { id: 'blueberry', ratio: 30 }
  ],
  zalim: [
    { id: 'red_bull_shisha', ratio: 50 },
    { id: 'mint_pro', ratio: 50 }
  ],
  dragon: [
    { id: 'red_bull_shisha', ratio: 40 },
    { id: 'dragon_fruit', ratio: 40 },
    { id: 'spice_shisha', ratio: 20 }
  ],
  chulbuli: [
    { id: 'mango', ratio: 50 },
    { id: 'peach', ratio: 30 },
    { id: 'mint_pro', ratio: 20 }
  ],
  white_king: [
    { id: 'vanilla', ratio: 50 },
    { id: 'cardamom', ratio: 30 },
    { id: 'cream_shisha', ratio: 20 }
  ],
  dubai_nights: [
    { id: 'watermelon_lit', ratio: 60 },
    { id: 'grape_hub', ratio: 30 },
    { id: 'mint_pro', ratio: 10 }
  ]
};

export class RecipeService {
  /**
   * Deducts ingredients for a given mixed order payload
   */
  static processOrderDeductions(order: any) {
    if (order.kind !== 'mixed') return;

    // 1. Process Hookahs
    if (Array.isArray(order.hookahs)) {
      for (const hookah of order.hookahs) {
        const flavor = hookah.flavor;
        if (!flavor) continue;

        const mixComponents = HOUSE_MIX_RECIPES[flavor.id];
        if (mixComponents) {
          // House Mix. Deduct raw flavors using ratio of 20g standard head
          for (const component of mixComponents) {
            const shishaAmount = 20 * (component.ratio / 100);
            DbService.deductInventory(component.id, shishaAmount);
          }
        } else if (flavor.isMix && Array.isArray(flavor.mixDetails)) {
          // Custom mix
          for (const component of flavor.mixDetails) {
            const ratio = Number(component.ratio) || 0;
            const shishaAmount = 20 * (ratio / 100);
            DbService.deductInventory(component.id, shishaAmount);
          }
        } else if (flavor.id) {
          // Standard single shisha flavor
          DbService.deductInventory(flavor.id, 20);
        }
      }
    }

    // 2. Process Food
    if (Array.isArray(order.food)) {
      for (const cartLine of order.food) {
        const item = cartLine.item;
        const qty = Number(cartLine.qty) || 0;
        if (!item || qty <= 0) continue;

        const ingredients = RECIPES[item.id];
        if (ingredients) {
          for (const ing of ingredients) {
            DbService.deductInventory(ing.ingredientId, ing.amount * qty);
          }
        }
      }
    }

    // 3. Process Drinks
    if (Array.isArray(order.drinks)) {
      for (const cartLine of order.drinks) {
        const item = cartLine.item;
        const qty = Number(cartLine.qty) || 0;
        if (!item || qty <= 0) continue;

        const ingredients = RECIPES[item.id];
        if (ingredients) {
          for (const ing of ingredients) {
            DbService.deductInventory(ing.ingredientId, ing.amount * qty);
          }
        }
      }
    }
  }
}
