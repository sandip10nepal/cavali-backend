// Read-only: dumps the Cavalli catalog (categories, items, tags) for discovery planning.
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const RID = 'RES_EED4E9D266DF';

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('benzin_saas_db');
  const items = await db.collection('menu_items').find({ restaurant_id: RID }).toArray();
  const cats = await db.collection('menu_categories').find({ restaurant_id: RID }).toArray();
  const out: any = {
    categories: cats.map((c: any) => ({ id: c._id, name: c.name || c.title, parent: c.parent_id, type: c.type, venue: c.venue, available: c.available })),
    items: items.map((i: any) => ({
      id: i._id, name: i.name, price: i.price, cats: i.category_ids?.length ? i.category_ids : [i.category_id],
      tags: i.tags, dietary: i.dietary_tags || i.dietary, available: i.available, desc: (i.description || '').slice(0, 120),
      mods: (i.modifier_groups || []).map((m: any) => m.name || m.title || m.id),
      keys: Object.keys(i).join(','),
    })),
  };
  console.log(JSON.stringify(out, null, 1));
  await client.close();
}
run();
