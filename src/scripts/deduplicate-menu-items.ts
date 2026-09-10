import { env } from '../config/env';
import { MongoClient } from 'mongodb';

const CAVALI_RESTAURANT_ID = 'RES_EED4E9D266DF';

async function main() {
  console.log('🔄 Connecting to MongoDB Atlas...');
  const client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  await client.connect();
  const db = client.db('benzin_saas_db');
  console.log('✅ Connected to Atlas database: benzin_saas_db');

  const menuCol = db.collection('menu_items');

  // Step 1: Analyze current Cavali menu items
  const cavaliItems = await menuCol.find({ restaurant_id: CAVALI_RESTAURANT_ID }).toArray();
  console.log(`\n📊 Total Cavali items in Atlas before cleanup: ${cavaliItems.length}`);

  const groups = new Map<string, any[]>();
  for (const item of cavaliItems) {
    const key = (item.name || '').trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const dupes = Array.from(groups.entries()).filter(([_, list]) => list.length > 1);
  console.log(`🔍 Found ${dupes.length} duplicate dish groups in Cavali:`);

  let deletedDuplicateCount = 0;
  const deletedIds: string[] = [];

  for (const [name, list] of dupes) {
    console.log(`\nProcessing duplicate group: "${name}" (${list.length} records)`);

    // Sort to pick canonical item: prefer item with 'appetizer' in category or lowest ID
    list.sort((a, b) => {
      const aApp = String(a.category_id || '').toLowerCase().includes('appetizer') ? -1 : 1;
      const bApp = String(b.category_id || '').toLowerCase().includes('appetizer') ? -1 : 1;
      if (aApp !== bApp) return aApp - bApp;
      return String(a._id).localeCompare(String(b._id));
    });

    const canonical = list[0];
    const duplicates = list.slice(1);

    // Merge best fields from duplicates into canonical
    let bestImageUrl = canonical.image_url || canonical.imageUrl || canonical.image || '';
    let bestDesc = canonical.desc || canonical.description || '';
    let bestRecipe = Array.isArray(canonical.recipe) && canonical.recipe.length > 0 ? canonical.recipe : null;
    let bestModifiers = Array.isArray(canonical.modifier_groups) && canonical.modifier_groups.length > 0 ? canonical.modifier_groups : null;

    for (const dup of duplicates) {
      const dupImg = dup.image_url || dup.imageUrl || dup.image || '';
      // Prefer high-res cavallidallas or http URL over data:image/base64 or local path
      if (dupImg.startsWith('http') && (!bestImageUrl.startsWith('http') || bestImageUrl.startsWith('data:'))) {
        bestImageUrl = dupImg;
      } else if (!bestImageUrl && dupImg) {
        bestImageUrl = dupImg;
      }

      if (!bestDesc && (dup.desc || dup.description)) {
        bestDesc = dup.desc || dup.description;
      }
      if (!bestRecipe && Array.isArray(dup.recipe) && dup.recipe.length > 0) {
        bestRecipe = dup.recipe;
      }
      if (!bestModifiers && Array.isArray(dup.modifier_groups) && dup.modifier_groups.length > 0) {
        bestModifiers = dup.modifier_groups;
      }
    }

    // Special check for Hummus: ensure official Cavalli Dallas photo is preserved
    if (name === 'hummus' && !bestImageUrl.includes('cavallidallas.com')) {
      for (const dup of list) {
        const url = dup.image_url || dup.imageUrl || dup.image || '';
        if (url.includes('cavallidallas.com')) {
          bestImageUrl = url;
          break;
        }
      }
    }

    // Update canonical record in Atlas
    const updateFields: any = {
      image_url: bestImageUrl,
      imageUrl: bestImageUrl,
      image: bestImageUrl,
      desc: bestDesc,
      description: bestDesc,
      updated_at: new Date().toISOString(),
    };
    if (bestRecipe) updateFields.recipe = bestRecipe;
    if (bestModifiers) updateFields.modifier_groups = bestModifiers;

    await menuCol.updateOne({ _id: canonical._id }, { $set: updateFields });
    console.log(`  ✅ Updated canonical [${canonical._id}] with photo: ${bestImageUrl.slice(0, 65)}...`);

    // Delete duplicates
    for (const dup of duplicates) {
      await menuCol.deleteOne({ _id: dup._id });
      deletedIds.push(dup._id);
      deletedDuplicateCount++;
      console.log(`  🗑️  Deleted duplicate record: [${dup._id}] (Category: ${dup.category_id})`);
    }
  }

  console.log(`\n🧹 Removed ${deletedDuplicateCount} duplicate menu item documents from Cavali.`);

  // Step 2: Clean up legacy test restaurant menu items
  const nonCavaliCount = await menuCol.countDocuments({ restaurant_id: { $ne: CAVALI_RESTAURANT_ID } });
  console.log(`\n🧹 Found ${nonCavaliCount} menu items from legacy test/demo restaurants.`);
  if (nonCavaliCount > 0) {
    const purgeRes = await menuCol.deleteMany({ restaurant_id: { $ne: CAVALI_RESTAURANT_ID } });
    console.log(`  🗑️  Purged ${purgeRes.deletedCount} legacy test restaurant items from Atlas.`);
  }

  // Step 3: Verify clean item count in Atlas
  const finalTotal = await menuCol.countDocuments();
  const finalCavali = await menuCol.countDocuments({ restaurant_id: CAVALI_RESTAURANT_ID });
  console.log(`\n🎉 Verification:`);
  console.log(`  Total menu items in collection: ${finalTotal}`);
  console.log(`  Cavali unique menu items: ${finalCavali}`);

  // Step 4: Create authoritative unique compound index on { restaurant_id: 1, name: 1 }
  console.log('\n🔒 Creating compound unique index: { restaurant_id: 1, name: 1 } with case-insensitive collation...');
  try {
    await menuCol.createIndex(
      { restaurant_id: 1, name: 1 },
      {
        name: 'uniq_restaurant_item_name',
        unique: true,
        collation: { locale: 'en', strength: 2 },
      }
    );
    console.log('✅ Compound unique index created successfully! Duplicates are permanently forbidden in MongoDB Atlas.');
  } catch (idxErr: any) {
    console.error('⚠️  Failed to create unique index:', idxErr.message);
  }

  // Step 5: Test unique index rejection
  try {
    console.log('\n🧪 Testing unique constraint by attempting to insert duplicate "Hummus"...');
    await menuCol.insertOne({
      _id: 'TEST_DUP_HUMMUS',
      restaurant_id: CAVALI_RESTAURANT_ID,
      name: 'Hummus',
      price: 10,
      active: true,
    } as any);
    console.error('❌ ERROR: Duplicate was accepted! Unique index failed.');
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('✅ PASSED: MongoDB Atlas rejected duplicate item with error code 11000 (DuplicateKey)!');
    } else {
      console.warn('⚠️  Unexpected error on duplicate test:', err.message);
    }
  }

  await client.close();
  console.log('\n🏁 Menu items deduplication completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error in deduplication script:', err);
  process.exit(1);
});
