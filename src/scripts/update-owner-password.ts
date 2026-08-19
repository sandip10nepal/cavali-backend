/**
 * Update Manager / Owner Password to "1234abcD"
 */
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';

async function main() {
  console.log('Connecting to database...');
  await MultiTenantDbService.initialize();

  const restaurants = await MultiTenantDbService.listRestaurants();
  console.log(`Found ${restaurants.length} restaurants.`);

  const newPassword = '1234abcD';
  const newHash = AuthService.hashPin(newPassword);

  for (const r of restaurants) {
    const users = await MultiTenantDbService.listUsers(r._id);
    for (const u of users) {
      if (u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') {
        console.log(`Updating password for ${u.role}: ${u.name} (${u.email}) in restaurant ${r.name}`);
        await MultiTenantDbService.updateUser(u._id, r._id, {
          pin_hash: newHash,
          failed_login_attempts: 0,
          locked_until: null,
        });
      }
    }
  }

  console.log('✅ Successfully updated manager/owner password to "1234abcD" in all stores!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error updating manager password:', err);
  process.exit(1);
});
