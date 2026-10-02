import { MultiTenantDbService } from '../services/multi-tenant-db.service';

async function main() {
  await MultiTenantDbService.ensureReady();
  const restaurant = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (!restaurant) {
    console.error('Cavalli restaurant not found');
    process.exit(1);
  }

  const existingTables = await MultiTenantDbService.listTables(restaurant._id);
  console.log(`Current Cavalli tables count: ${existingTables.length}`);

  const existingLabels = new Set(existingTables.map(t => (t.label || '').trim().toLowerCase()));
  const patioTables = [
    { label: 'P1', number: 101, capacity: 4 },
    { label: 'P2', number: 102, capacity: 4 },
    { label: 'P3', number: 103, capacity: 4 },
    { label: 'P4', number: 104, capacity: 4 },
    { label: 'P5', number: 105, capacity: 6 },
    { label: 'P6', number: 106, capacity: 6 },
    { label: 'P7', number: 107, capacity: 6 },
    { label: 'P8', number: 108, capacity: 6 },
  ];

  for (const pt of patioTables) {
    if (!existingLabels.has(pt.label.toLowerCase()) && !existingLabels.has(`table ${pt.label.toLowerCase()}`)) {
      const created = await MultiTenantDbService.createTable({
        restaurant_id: restaurant._id,
        number: pt.number,
        label: pt.label,
        capacity: pt.capacity,
        active: true,
      });
      console.log(`✅ Created patio table ${created.label} (ID: ${created._id})`);
    } else {
      console.log(`ℹ️ Patio table ${pt.label} already exists`);
    }
  }

  const updatedTables = await MultiTenantDbService.listTables(restaurant._id);
  console.log(`Updated Cavalli tables count: ${updatedTables.length}`);
  console.log('Tables:', updatedTables.map(t => ({ id: t._id, number: t.number, label: t.label })));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
