import { MultiTenantDbService } from '../services/multi-tenant-db.service';

async function main() {
  await MultiTenantDbService.initialize();
  const db = MultiTenantDbService.getDb();
  if (!db) {
    console.log('No Mongo db');
    return;
  }
  const srs = await db.collection('service_requests').find({}).toArray();
  console.log('--- SERVICE REQUESTS IN MONGO ---');
  console.log(JSON.stringify(srs, null, 2));

  const ordersWithCoals = await db.collection('orders').find({
    $or: [
      { requestType: 'COAL_REFILL' },
      { requestType: 'coals' },
      { request_type: 'COAL_REFILL' },
      { request_type: 'coals' },
      { _id: /^req-/ },
      { 'items.name': { $regex: 'coal', $options: 'i' } }
    ]
  } as any).toArray();
  console.log('--- ORDERS WITH COALS IN MONGO ---');
  console.log(JSON.stringify(ordersWithCoals, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
