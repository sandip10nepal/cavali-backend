import fs from 'fs';
import path from 'path';
import { MultiTenantDbService, COLLECTIONS } from '../services/multi-tenant-db.service';

const HTML_PATH = '/Users/sandipnepal/Downloads/Cavalli_Menu_10Web_Button_Highlight_Fix-3.html';
const OUTPUT_DIR = path.resolve(__dirname, '../../public/images/menu');

interface ExtractedItem {
  id: string;
  name: string;
  price: number;
  desc: string;
  category_id: string;
  category_name: string;
  image_filename?: string;
  emoji: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getEmojiForCategoryOrName(catId: string, name: string): string {
  const n = name.toLowerCase();
  if (n.includes('hummus') || n.includes('dip')) return '🥗';
  if (n.includes('falafel')) return '🧆';
  if (n.includes('chicken') || n.includes('tender') || n.includes('boti')) return '🍗';
  if (n.includes('burger') || n.includes('smash') || n.includes('zinger')) return '🍔';
  if (n.includes('kabab') || n.includes('kebab') || n.includes('koobideh') || n.includes('chop')) return '🍢';
  if (n.includes('wing')) return '🍗';
  if (n.includes('fry') || n.includes('fries') || n.includes('potato')) return '🍟';
  if (n.includes('taco')) return '🌮';
  if (n.includes('nacho') || n.includes('queso') || n.includes('chip')) return '🧀';
  if (n.includes('wrap') || n.includes('shawarma') || n.includes('roll')) return '🌯';
  if (n.includes('momo') || n.includes('dumpling')) return '🥟';
  if (n.includes('rice') || n.includes('biryani') || n.includes('daal')) return '🍚';
  if (n.includes('chow mein') || n.includes('noodle')) return '🍜';
  if (n.includes('cake') || n.includes('dessert') || n.includes('sweet') || n.includes('crunch') || n.includes('bliss')) return '🍰';
  if (n.includes('mojito') || n.includes('margarita') || n.includes('refresher') || n.includes('juice') || n.includes('shake') || n.includes('lassi')) return '🍹';
  if (n.includes('chai') || n.includes('tea')) return '🫖';
  if (n.includes('coffee') || n.includes('latte') || n.includes('espresso')) return '☕';
  if (n.includes('cola') || n.includes('coke') || n.includes('sprite') || n.includes('fanta') || n.includes('drink') || n.includes('water') || n.includes('red bull')) return '🥤';
  if (n.includes('hookah') || n.includes('mix') || n.includes('refill') || n.includes('hose') || n.includes('base')) return '💨';
  return '🍽️';
}

async function run() {
  console.log('🚀 Starting Cavalli HTML Menu Ingestion & Image Asset Extractor...');

  if (!fs.existsSync(HTML_PATH)) {
    console.error('❌ HTML file not found at:', HTML_PATH);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const html = fs.readFileSync(HTML_PATH, 'utf-8');

  // Extract Sections
  const sectionRegex = /<section\s+class="menu-section"\s+id="([^"]+)">([\s\S]*?)<\/section>/gi;
  let sectionMatch;

  const extractedCategories: { id: string; name: string; sort_order: number; icon: string }[] = [];
  const extractedItems: ExtractedItem[] = [];

  let catIndex = 0;

  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const sectionId = sectionMatch[1];
    const sectionContent = sectionMatch[2];

    const headingMatch = sectionContent.match(/<h2 class="section-heading">([^<]+)<\/h2>/i);
    const categoryName = headingMatch ? headingMatch[1].trim() : sectionId;

    let icon = '🍽️';
    if (sectionId === 'appetizers') icon = '🥗';
    else if (sectionId === 'mains') icon = '🥩';
    else if (sectionId === 'wings') icon = '🍗';
    else if (sectionId === 'vegetarian') icon = '🥦';
    else if (sectionId === 'burgers') icon = '🍔';
    else if (sectionId === 'wraps') icon = '🌯';
    else if (sectionId === 'continental') icon = '🥟';
    else if (sectionId === 'desserts') icon = '🍰';
    else if (sectionId === 'drinks') icon = '🍹';
    else if (sectionId === 'hookah') icon = '💨';

    extractedCategories.push({
      id: `CAT_${sectionId.toUpperCase()}`,
      name: categoryName,
      sort_order: catIndex++ * 10,
      icon,
    });

    // Parse food/drink items in section
    const articleRegex = /<article\s+class="menu-card"(?:\s+id="([^"]*)")?>([\s\S]*?)<\/article>/gi;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(sectionContent)) !== null) {
      const cardId = articleMatch[1] || '';
      const cardContent = articleMatch[2];

      const nameMatch = cardContent.match(/<h3>([^<]+)<\/h3>/i);
      const priceMatch = cardContent.match(/<span>([^<]+)<\/span>/i);
      const descMatch = cardContent.match(/<p>([^<]+)<\/p>/i);
      const imgMatch = cardContent.match(/<img[^>]+src="(data:image\/([^;]+);base64,([^"]+))"/i);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        const rawPrice = priceMatch ? priceMatch[1].trim() : '';
        const priceNum = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
        const desc = descMatch ? descMatch[1].trim() : '';

        let imageFilename: string | undefined;

        if (imgMatch) {
          const mimeSubtype = imgMatch[2]; // e.g. webp, png, jpeg
          const base64Data = imgMatch[3];
          const ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
          const slug = slugify(name);
          imageFilename = `${slug}.${ext}`;
          const filePath = path.join(OUTPUT_DIR, imageFilename);

          // Write extracted image to static asset disk
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        }

        extractedItems.push({
          id: `MI_${slugify(name)}_${extractedItems.length + 1}`,
          name,
          price: priceNum,
          desc,
          category_id: `CAT_${sectionId.toUpperCase()}`,
          category_name: categoryName,
          image_filename: imageFilename,
          emoji: getEmojiForCategoryOrName(sectionId, name),
        });
      }
    }
  }

  // Parse Hookah Section specifically (it uses custom article layout)
  const hookahSectionMatch = html.match(/id="hookah"[\s\S]*?<\/section>/i);
  if (hookahSectionMatch) {
    const hookahContent = hookahSectionMatch[0];

    // 1. Hookah Services
    const serviceMatches = hookahContent.match(/<span style="color:#fff;">([^<]+)<\/span><span style="color:var\(--gold2\)[^"]*">\$?([0-9.]+)<\/span>/gi) || [];
    for (const sm of serviceMatches) {
      const parts = sm.match(/<span style="color:#fff;">([^<]+)<\/span><span style="color:var\(--gold2\)[^"]*">\$?([0-9.]+)<\/span>/i);
      if (parts) {
        const name = parts[1].trim();
        const price = parseFloat(parts[2]) || 0;
        extractedItems.push({
          id: `MI_${slugify(name)}_${extractedItems.length + 1}`,
          name,
          price,
          desc: name.includes('Mix') ? 'Premium hookah pipe prepared with coals and coals service.' : 'Hookah accessory / service enhancement.',
          category_id: 'CAT_HOOKAH',
          category_name: 'Premium Hookah',
          emoji: '💨',
        });
      }
    }

    // 2. Cavalli Signature Hookah Mixes ($35)
    const mixRegex = /<span style="color:#fff;[^"]*">([^<]+)<\/span><span style="color:var\(--gold2\)[^"]*">\$?([0-9.]+)<\/span>[\s\S]*?(?:<div style="margin-top:4px;[^"]*">([^<]+)<\/div>)?/gi;
    let mixMatch;
    // Limit search to the signature mixes container
    const mixSectionIdx = hookahContent.indexOf('Cavalli Mix · Signature Premium Blends');
    if (mixSectionIdx !== -1) {
      const mixesBlock = hookahContent.substring(mixSectionIdx, hookahContent.indexOf('Broken or damaged hookah fee'));
      while ((mixMatch = mixRegex.exec(mixesBlock)) !== null) {
        const name = mixMatch[1].trim();
        const price = parseFloat(mixMatch[2]) || 35;
        const desc = mixMatch[3] ? mixMatch[3].trim() : 'Cavalli signature premium blend.';
        
        extractedItems.push({
          id: `MI_${slugify(name)}_${extractedItems.length + 1}`,
          name: `${name} (Signature Mix)`,
          price,
          desc,
          category_id: 'CAT_HOOKAH',
          category_name: 'Premium Hookah',
          emoji: '💨',
        });
      }
    }
  }

  console.log(`\n Extracted ${extractedCategories.length} Categories and ${extractedItems.length} Menu Items.`);
  console.log(` Extracted and saved ${extractedItems.filter(i => i.image_filename).length} image files to /public/images/menu/`);

  // Connect to MongoDB Atlas
  await MultiTenantDbService.initialize();
  const db = await MultiTenantDbService.ensureReady();
  const rest = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (!rest) throw new Error('Cavali restaurant not found in Atlas!');

  console.log(`\n Authoritative Restaurant: ${rest.name} (${rest._id})`);

  // 1. Upsert Categories
  console.log('\n Syncing Menu Categories to MongoDB Atlas...');
  for (const cat of extractedCategories) {
    await db.collection<any>(COLLECTIONS.menu_categories).updateOne(
      { restaurant_id: rest._id, _id: cat.id as any },
      {
        $set: {
          restaurant_id: rest._id,
          _id: cat.id,
          id: cat.id,
          name: cat.name,
          title: cat.name,
          sort_order: cat.sort_order,
          icon: cat.icon,
          color: '#E5B13A',
          is_super: false,
          active: true,
          updated_at: new Date().toISOString(),
        },
        $setOnInsert: {
          created_at: new Date().toISOString(),
        }
      },
      { upsert: true }
    );
  }
  console.log('✅ Categories synced successfully.');

  // 2. Sync Menu Items
  console.log('\n Syncing Menu Items to MongoDB Atlas...');
  const existingItems = await db.collection<any>(COLLECTIONS.menu_items).find({ restaurant_id: rest._id }).toArray();
  const existingMap = new Map(existingItems.map(i => [i.name.toLowerCase().trim(), i]));

  let createdCount = 0;
  let updatedCount = 0;

  for (let idx = 0; idx < extractedItems.length; idx++) {
    const item = extractedItems[idx];
    const key = item.name.toLowerCase().trim();
    const existing = existingMap.get(key);

    const imageUrl = item.image_filename ? `/images/menu/${item.image_filename}` : undefined;

    if (existing) {
      // Update existing item
      await db.collection<any>(COLLECTIONS.menu_items).updateOne(
        { restaurant_id: rest._id, _id: existing._id as any },
        {
          $set: {
            name: item.name,
            price: item.price,
            desc: item.desc || existing.desc || '',
            description: item.desc || existing.desc || '',
            category_id: item.category_id,
            emoji: item.emoji,
            ...(imageUrl ? { image_url: imageUrl, imageUrl: imageUrl, image: imageUrl } : {}),
            sort_order: idx + 1,
            available: true,
            updated_at: new Date().toISOString(),
          }
        }
      );
      updatedCount++;
    } else {
      // Create new item
      const newId = item.id;
      await db.collection<any>(COLLECTIONS.menu_items).insertOne({
        restaurant_id: rest._id,
        _id: newId as any,
        id: newId,
        name: item.name,
        price: item.price,
        desc: item.desc,
        description: item.desc,
        category_id: item.category_id,
        emoji: item.emoji,
        image_url: imageUrl,
        imageUrl: imageUrl,
        image: imageUrl,
        sort_order: idx + 1,
        available: true,
        recipe: [],
        requiresSauce: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      createdCount++;
    }
  }

  console.log(`✅ Items Sync Complete: ${createdCount} created, ${updatedCount} updated.`);

  const finalItems = await db.collection<any>(COLLECTIONS.menu_items).find({ restaurant_id: rest._id }).toArray();
  console.log(` Total Cavali menu items in MongoDB Atlas: ${finalItems.length}`);
  
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during menu ingestion:', err);
  process.exit(1);
});
