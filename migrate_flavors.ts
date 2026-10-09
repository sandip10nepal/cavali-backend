import { env } from './src/config/env';
import { MultiTenantDbService } from './src/services/multi-tenant-db.service';
import { connectDB } from './src/config/db';

async function migrate() {
  await connectDB();
  const restId = (await MultiTenantDbService.getRestaurantBySlug('cavali'))?._id;
  if (!restId) return console.log('No restaurant');
  
  const items = await MultiTenantDbService.listMenuItems(restId, 'cat_hookah');
  console.log('Hookah items:', items.map(i => i.name));
  
  process.exit(0);
}

migrate().catch(console.error);
