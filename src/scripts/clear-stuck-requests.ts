import { MultiTenantDbService } from '../services/multi-tenant-db.service';

async function main() {
  await MultiTenantDbService.initialize();
  const db = MultiTenantDbService.getDb();
  if (!db) {
    console.error('❌ Could not connect to MongoDB Atlas');
    process.exit(1);
  }

  const now = new Date().toISOString();

  // 1. Mark req-1789010827623-eusn and any pending service requests in orders collection as fulfilled
  const orderResult = await db.collection('orders').updateMany(
    {
      $or: [
        { _id: 'req-1789010827623-eusn' },
        { kind: 'server_request', status: 'pending' },
        { notes: { $regex: 'coal', $options: 'i' }, status: 'pending' },
        { _id: /^req-/, status: 'pending' }
      ]
    } as any,
    {
      $set: {
        status: 'fulfilled',
        completed_at: new Date(),
        updated_at: new Date()
      }
    }
  );
  console.log(`✅ Updated ${orderResult.matchedCount} orders (${orderResult.modifiedCount} modified) to fulfilled`);

  // 2. Mark any remaining pending service_requests in service_requests collection as COMPLETED
  const srResult = await db.collection('service_requests').updateMany(
    {
      status: { $in: ['pending', 'PENDING', 'in_progress', 'IN_PROGRESS'] }
    },
    {
      $set: {
        status: 'COMPLETED',
        completed_at: now,
        updated_at: now
      }
    }
  );
  console.log(`✅ Updated ${srResult.matchedCount} service_requests (${srResult.modifiedCount} modified) to COMPLETED`);

  // 3. Verify clean state
  const remainingPendingOrders = await db.collection('orders').countDocuments({
    status: 'pending',
    kind: 'server_request'
  });
  const remainingPendingSRs = await db.collection('service_requests').countDocuments({
    status: { $in: ['pending', 'PENDING', 'in_progress', 'IN_PROGRESS'] }
  });

  console.log(`📊 Remaining pending server request orders: ${remainingPendingOrders}`);
  console.log(`📊 Remaining pending service requests: ${remainingPendingSRs}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
