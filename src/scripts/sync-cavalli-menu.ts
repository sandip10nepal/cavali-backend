import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://sandip2nepal_db_user:jzKRgGtGJpU9jhR7@cluster0.tkcmyix.mongodb.net/benzin_saas_db?retryWrites=true&w=majority';
const RESTAURANT_ID = 'RES_EED4E9D266DF';

async function syncMenu() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('benzin_saas_db');

  console.log('Connected to MongoDB Atlas. Syncing Cavalli menu items...');

  // 1. Clean up obsolete dummy or duplicate typo items
  const deletedTypo = await db.collection('menu_items').deleteMany({
    restaurant_id: RESTAURANT_ID,
    name: { $in: ['Humus', 'Butter Chicken', 'Tacos', 'Sauce Choices', 'Caramel Crunch', 'Raspberry White Chocolate Cake', 'Chocolate Cake', 'Butterscotch Bliss', 'Pistachio Cake'] }
  });
  console.log(`Removed ${deletedTypo.deletedCount} old/duplicate/orphaned items.`);

  // 2. Multi-category items mapping
  const multiCatMap: Record<string, string[]> = {
    'hummus': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'falafel': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'papri chaat': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'pani puri': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'spicy potato': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'fries': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'loaded fries': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'loaded nachos': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'chips and queso': ['CAT_APPETIZERS', 'CAT_VEGETARIAN', 'CAT_CONTINENTAL'],
    'chips and guacamole': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'spicy aloo chaat': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'samosa': ['CAT_APPETIZERS', 'CAT_VEGETARIAN'],
    'veg samosa': ['CAT_VEGETARIAN', 'CAT_APPETIZERS']
  };

  for (const [nameKey, catIds] of Object.entries(multiCatMap)) {
    const res = await db.collection('menu_items').updateMany(
      {
        restaurant_id: RESTAURANT_ID,
        name: { $regex: new RegExp(`^${nameKey}$`, 'i') }
      },
      {
        $set: {
          category_ids: catIds,
          category_id: catIds[0],
          available: true,
          active: true,
          updated_at: new Date().toISOString()
        }
      }
    );
    console.log(`Updated multi-cat for "${nameKey}": matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // 3. Update specific prices to match official menu
  await db.collection('menu_items').updateOne(
    { restaurant_id: RESTAURANT_ID, name: { $regex: /^Kung Pao Chicken$/i } },
    { $set: { price: 22, category_ids: ['CAT_CONTINENTAL'], category_id: 'CAT_CONTINENTAL' } }
  );
  await db.collection('menu_items').updateOne(
    { restaurant_id: RESTAURANT_ID, name: { $regex: /^Gulab Jamun$/i } },
    { $set: { price: 8, category_ids: ['CAT_DESSERTS'], category_id: 'CAT_DESSERTS' } }
  );

  // 4. Ensure Wings modifier group (Sauces) is attached to both wings items
  const wingModifiers = [
    {
      name: 'Sauce Choices',
      required: true,
      min_selection: 1,
      max_selection: 1,
      options: [
        { name: 'Buffalo', price: 0 },
        { name: 'BBQ', price: 0 },
        { name: 'Garlic Parmesan', price: 0 },
        { name: 'Lemon Pepper', price: 0 },
        { name: 'Honey BBQ', price: 0 },
        { name: 'Mango Habanero', price: 0 }
      ]
    }
  ];
  await db.collection('menu_items').updateMany(
    { restaurant_id: RESTAURANT_ID, name: { $regex: /Wings/i } },
    { $set: { modifier_groups: wingModifiers, modifierGroups: wingModifiers } }
  );

  // 5. Ensure Soft Drinks modifier group (Flavors) is attached
  const drinkModifiers = [
    {
      name: 'Flavor Choice',
      required: true,
      min_selection: 1,
      max_selection: 1,
      options: [
        { name: 'Coca-Cola', price: 0 },
        { name: 'Coke Zero / Diet', price: 0 },
        { name: 'Fanta', price: 0 },
        { name: 'Ginger Ale', price: 0 },
        { name: 'Sprite', price: 0 },
        { name: 'Dr Pepper', price: 0 }
      ]
    }
  ];
  await db.collection('menu_items').updateOne(
    { restaurant_id: RESTAURANT_ID, name: 'Soft Drinks' },
    { $set: { modifier_groups: drinkModifiers, modifierGroups: drinkModifiers } }
  );

  // 6. Hookah house mix Kashmiri Chai -> rename to distinguish from beverage
  await db.collection('menu_items').updateOne(
    { restaurant_id: RESTAURANT_ID, category_id: 'CAT_HOOKAH_HOUSE_MIXES', name: { $regex: /^Kashmiri Chai$/i } },
    { $set: { name: 'Kashmiri Chai (House Mix)' } }
  );

  // Now ensure Kashmiri Chai beverage in Tea & Coffee
  const existingKashmiriChaiBev = await db.collection('menu_items').findOne({
    restaurant_id: RESTAURANT_ID,
    category_id: 'CAT_DRINKS_TEA_COFFEE',
    name: { $regex: /^Kashmiri Chai$/i }
  });
  if (!existingKashmiriChaiBev) {
    await db.collection('menu_items').insertOne({
      restaurant_id: RESTAURANT_ID,
      category_id: 'CAT_DRINKS_TEA_COFFEE',
      category_ids: ['CAT_DRINKS_TEA_COFFEE'],
      name: 'Kashmiri Chai',
      desc: 'Traditional pink tea brewed with cardamom, milk, and crushed pistachios.',
      description: 'Traditional pink tea brewed with cardamom, milk, and crushed pistachios.',
      price: 4,
      emoji: '☕',
      sort_order: 2,
      active: true,
      available: true,
      modifier_groups: [],
      variants: [],
      recipe: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log('Added Kashmiri Chai to Tea & Coffee.');
  }

  // 7. Verify all categories and their items count
  const items = await db.collection('menu_items').find({ restaurant_id: RESTAURANT_ID }).toArray();
  const cats = await db.collection('menu_categories').find({ restaurant_id: RESTAURANT_ID }).toArray();
  console.log('\n--- VERIFICATION AFTER SYNC ---');
  for (const c of cats) {
    if (!c.name && !c.title) continue;
    const catItems = items.filter((i: any) => {
      const cids = (Array.isArray(i.category_ids) && i.category_ids.length > 0) ? i.category_ids : [i.category_id];
      return cids.includes(c._id);
    });
    console.log(`${c.name || c.title} (${c._id}): ${catItems.length} items`);
  }

  await client.close();
}

syncMenu().catch(console.error);
