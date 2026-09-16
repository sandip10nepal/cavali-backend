import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://sandip2nepal_db_user:jzKRgGtGJpU9jhR7@cluster0.tkcmyix.mongodb.net/benzin_saas_db?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('benzin_saas_db');
  const items = await db.collection('menu_items').find({ restaurant_id: 'RES_EED4E9D266DF' }).toArray();
  const cats = await db.collection('menu_categories').find({ restaurant_id: 'RES_EED4E9D266DF' }).toArray();
  const catMap = new Map();
  cats.forEach((c: any) => catMap.set(c._id, c.name || c.title || c._id));

  console.log('Categories count:', cats.length);
  for (const c of cats) {
    const matched = items.filter((i: any) => {
      const cids = (Array.isArray(i.category_ids) && i.category_ids.length > 0) ? i.category_ids : [i.category_id];
      return cids.includes(c._id);
    });
    if (matched.length > 0 || c.name) {
      console.log(`\n=== Category: ${c.name || c.title} (${c._id}) [parent: ${c.parent_id}] [Items: ${matched.length}] ===`);
      matched.forEach((i: any) => console.log(`  - ${i.name} ($${i.price}) [cats: ${JSON.stringify(i.category_ids)}]`));
    }
  }

  await client.close();
}
run();
