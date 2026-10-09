// Read-only: reconciles the Vibe Quest spec candidates against the live Cavalli catalog.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const RID = 'RES_EED4E9D266DF';

const candidates = [
  'Cavalli Crush','Shah Jahan','Habibi Nights','Kashmiri Chai','Anarkali','White King','Zaalim','Shokha','Dubai Nights','Dragon',
  'Ice Hose','Ice Base','Head Refill',
  'Chicken Dum Biryani','Chicken Boti','Sizzling Gola Kabob','Daal Chawal','Beef Koobideh','Chicken Kabob','Lamb Chops','Malai Chicken Boti',
  'Beef Smash','Chicken Zinger','Chicken Club Sandwich','Shawarma Wrap','Dynamite Chicken Wrap','Zinger Wrap','Mirchi Paratha Roll',
  'Chili Chicken','Mongolian Chicken','Chow Mein','Momo','Kung Pao Chicken','Orange Chicken','Daal Chawal with Beef Shami',
  'Chicken Parmesan','Chicken Cordon Bleu','Pizza Bites','Chips and Queso','Loaded Fries','Loaded Nachos',
  'Falafel','Hummus','Veg Samosa','Paneer Momo','Fries','Spicy Aloo Chaat','Chips and Guacamole',
  'Dynamite Chicken','Papri Chaat','Pani Puri','Kabob Lollipop','Spicy Potato','Shawarma Plate',
  'Kunafa','Gulab Jamun','Biscoff Cake','Rasmalai Cake','Gajar Halwa Cheesecake','Mango Lassi Cheesecake',
  'Classic Mint Mojito','Mint Margarita','Mint Tea','Mango Mojito','Lychee Mojito','Watermelon Juice','Orange Juice','Mango Shake',
  'Sweet Lassi','Cold Coffee','Pistachio Latte','Karak Chai','Desi Coffee','Moroccan Tea',
  'Coca-Cola','Coke Zero','Fanta','Ginger Ale','Sprite','Dr Pepper','Soft Drinks','Red Bull','Saratoga Water','Sparkling Water',
  "Ocean's Secret",'Pina Colada','Red Affair','Rim Fire Melon',
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('benzin_saas_db');
  const items = await db.collection('menu_items').find({ restaurant_id: RID }).toArray();
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const name of candidates) {
    const hits = items.filter((i: any) => norm(i.name) === norm(name));
    const cats = [...new Set(hits.flatMap((h: any) => (h.category_ids?.length ? h.category_ids : [h.category_id])))];
    console.log(`${hits.length ? 'OK ' : 'MISSING'} ${name} x${hits.length} ${hits.map((h: any) => h._id).join(',')} cats=${cats.join(',')} avail=${hits.map((h: any) => h.available !== false).join(',')}`);
  }
  const show = (n: string) => {
    const it: any = items.find((i: any) => norm(i.name) === norm(n));
    if (!it) return;
    console.log(`\n--- ${n} ---\ndesc: ${it.description}\nvariants: ${JSON.stringify(it.variants)}\nmods: ${JSON.stringify((it.modifier_groups || []).map((g: any) => ({ g: g.name, req: g.required, min: g.min_selection, opts: (g.options || []).map((o: any) => `${o.name}:${o.price ?? o.price_adjustment}`) })))}`);
  };
  ['10 pc Wings', 'Kunafa', 'Soft Drinks', 'Kung Pao Chicken', 'Momo', 'Shawarma Wrap', 'Red Bull', 'Chow Mein', 'Anarkali', 'White King'].forEach(show);
  await client.close();
}
run();
