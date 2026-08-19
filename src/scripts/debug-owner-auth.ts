import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { AuthService } from '../services/auth.service';

async function test() {
  await MultiTenantDbService.initialize();
  const restaurants = await MultiTenantDbService.listRestaurants();
  const cavali = restaurants.find(r => r.restaurant_code === '4821' || r.slug === 'cavali');
  console.log('Cavali ID:', cavali?._id);
  const users = await MultiTenantDbService.listUsers(cavali!._id);
  const owner = users.find(u => u.email === 'owner@cavali.com');
  console.log('Owner object:', owner);
  if (owner) {
    const valid = AuthService.verifyPin('1234abcD', owner.pin_hash);
    console.log('Is 1234abcD valid for owner?', valid);
    const validOld = AuthService.verifyPin('1234', owner.pin_hash);
    console.log('Is 1234 valid for owner?', validOld);
  }
  process.exit(0);
}
test();
