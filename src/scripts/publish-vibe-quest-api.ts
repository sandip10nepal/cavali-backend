import '../config/env';
import { AuthService } from '../services/auth.service';

async function main() {
  const restaurantId = 'RES_EED4E9D266DF';

  // 1. Generate owner admin token
  const token = AuthService.generateToken({
    sub: 'admin_cavalli_owner',
    rid: restaurantId,
    role: 'owner',
    rname: 'Cavalli Huqqa',
  });

  console.log('Generated Admin Token:', token.substring(0, 30) + '...');

  const baseUrl = 'http://localhost:3000';

  // 2. Validate Draft via API
  console.log('\n--- Step 1: Validating Draft via Admin API ---');
  const validateRes = await fetch(`${baseUrl}/api/vibe-quest/admin/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-restaurant-id': restaurantId,
      'Content-Type': 'application/json',
    },
  });

  const validateJson = await validateRes.json();
  console.log('Status:', validateRes.status);
  console.log('Validation Response:', JSON.stringify(validateJson, null, 2));

  if (!validateRes.ok || !validateJson.success || !validateJson.validation.valid) {
    console.error('Validation failed! Cannot publish.');
    process.exit(1);
  }

  // 3. Publish Live via API
  console.log('\n--- Step 2: Publishing Live via Admin API ---');
  const publishRes = await fetch(`${baseUrl}/api/vibe-quest/admin/publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-restaurant-id': restaurantId,
      'Content-Type': 'application/json',
    },
  });

  const publishJson = await publishRes.json();
  console.log('Status:', publishRes.status);
  console.log('Publish Response:', JSON.stringify(publishJson, null, 2));

  // 4. Verify Public Customer Endpoint
  console.log('\n--- Step 3: Verifying Public Customer Endpoint ---');
  const publicRes = await fetch(`${baseUrl}/api/vibe-quest?restaurantId=${restaurantId}`);
  const publicJson = await publicRes.json();
  console.log('Status:', publicRes.status);
  console.log('Enabled:', publicJson.enabled);
  console.log('Version:', publicJson.config?.version);
  console.log('Questions Count:', publicJson.config?.questions?.length);
  console.log('Seeded Questions:', publicJson.config?.questions?.map((q: any) => `${q.id}: ${q.text}`));
}

main().catch((err) => {
  console.error('Error running Option B:', err);
  process.exit(1);
});
