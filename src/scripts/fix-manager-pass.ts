import fs from 'fs';
import path from 'path';
import { AuthService } from '../services/auth.service';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';

async function fix() {
  const newHash = AuthService.hashPin('1234abcD');
  console.log('Generated new hash for 1234abcD:', newHash);

  // 1. Update file directly
  const dbPath = path.resolve(__dirname, '../../multi_tenant_db.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  for (const u of data.users) {
    if (u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') {
      console.log(`Setting 1234abcD for user ${u.name} (${u.email}) in local JSON`);
      u.pin_hash = newHash;
      u.failed_login_attempts = 0;
      u.locked_until = null;
    }
  }
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Saved to multi_tenant_db.json');

  // 2. Initialize db service and sync Atlas
  await MultiTenantDbService.initialize();
  for (const u of data.users) {
    if (u.role === 'owner' || u.role === 'manager' || u.role === 'platform_admin') {
      await MultiTenantDbService.updateUser(u._id, u.restaurant_id, {
        pin_hash: newHash,
        failed_login_attempts: 0,
        locked_until: null,
      });
    }
  }
  console.log('Synced with Atlas and in-memory cache.');
  process.exit(0);
}

fix();
