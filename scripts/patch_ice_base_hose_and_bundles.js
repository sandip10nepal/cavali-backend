const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Update multi_tenant_db.json
const dbPath = path.join(__dirname, '../multi_tenant_db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const hookahEnhancementGroup = {
    id: 'MOD_HOOKAH_ENHANCEMENTS',
    name: 'Hookah Enhancements',
    min_selection: 0,
    max_selection: 2,
    required: false,
    options: [
      { id: 'OPT_ICE_BASE', name: 'Ice Base', price: 2, price_adjustment: 2, available: true, sort_order: 1 },
      { id: 'OPT_ICE_HOSE', name: 'Ice Hose', price: 6, price_adjustment: 6, available: true, sort_order: 2 }
    ]
  };

  let updatedCount = 0;
  if (Array.isArray(db.menu_items)) {
    db.menu_items.forEach(item => {
      const cat = (item.category || item.category_id || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      if (cat.includes('hookah') || name.includes('hookah')) {
        if (!item.modifier_groups || item.modifier_groups.length === 0) {
          item.modifier_groups = [hookahEnhancementGroup];
          updatedCount++;
        } else {
          const hasIce = item.modifier_groups.some(g => (g.options || []).some(o => (o.name || '').toLowerCase().includes('ice base')));
          if (!hasIce) {
            item.modifier_groups.push(hookahEnhancementGroup);
            updatedCount++;
          }
        }
      }
    });
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`✅ [multi_tenant_db.json] Added Hookah Enhancements (Ice Base & Ice Hose) to ${updatedCount} hookah items.`);
}

// 2. Patch Web Bundles
const dir = path.join(__dirname, '../public/_expo/static/js/web');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
console.log(`Starting Ice Base & Ice Hose patch on ${files.length} web bundles...`);

const replacements = [
  {
    name: 'HouseMixItemCard & HostHookahCard selectedOpts with optionName & note',
    target: 'var selectedOpts = [];\n    if (iceBase) selectedOpts.push({ id: "OPT_ICE_BASE", name: "Ice Base", price: 2 });\n    if (iceHose) selectedOpts.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", price: 6 });\n    if (onAddToCart) {\n      onAddToCart(item, 1, selectedOpts);\n    }',
    replacement: 'var selectedOpts = [];\n    if (iceBase) selectedOpts.push({ id: "OPT_ICE_BASE", name: "Ice Base", optionName: "Ice Base", price: 2 });\n    if (iceHose) selectedOpts.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", optionName: "Ice Hose", price: 6 });\n    var noteParts = []; if (iceBase) noteParts.push("Ice Base (+$2)"); if (iceHose) noteParts.push("Ice Hose (+$6)");\n    if (onAddToCart) {\n      onAddToCart(item, 1, selectedOpts, noteParts.join(" · "));\n    }'
  },
  {
    name: 'HookahMixLabModal selectedOptions with optionName & note',
    target: 'var selectedOptions = [];\n    if (iceBase) selectedOptions.push({ id: "OPT_ICE_BASE", name: "Ice Base", price: 2 });\n    if (iceHose) selectedOptions.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", price: 6 });\n\n    var itemObj = {\n      id: "custom_mix_" + Date.now(),\n      name: mixName || "Create Custom Hookah Mix",\n      price: finalPrice,\n      description: "Custom Bowl: " + compText + (iceBase ? " • Ice Base (+$2)" : "") + (iceHose ? " • Ice Hose (+$6)" : ""),\n      category: "hookah",\n      subcategory: "Custom Mix Lab",\n      badge: "🧪 $25 CUSTOM",\n      emoji: "🧪"\n    };\n\n    onAddMixToCart(itemObj, 1, selectedOptions, "Composition: " + compText);',
    replacement: 'var selectedOptions = [];\n    if (iceBase) selectedOptions.push({ id: "OPT_ICE_BASE", name: "Ice Base", optionName: "Ice Base", price: 2 });\n    if (iceHose) selectedOptions.push({ id: "OPT_ICE_HOSE", name: "Ice Hose", optionName: "Ice Hose", price: 6 });\n    var addOnNotes = []; if (iceBase) addOnNotes.push("Ice Base (+$2)"); if (iceHose) addOnNotes.push("Ice Hose (+$6)");\n    var fullNotes = ["Composition: " + compText, ...addOnNotes].join(" · ");\n\n    var itemObj = {\n      id: "custom_mix_" + Date.now(),\n      name: mixName || "Create Custom Hookah Mix",\n      price: finalPrice,\n      description: "Custom Bowl: " + compText + (iceBase ? " • Ice Base (+$2)" : "") + (iceHose ? " • Ice Hose (+$6)" : ""),\n      category: "hookah",\n      subcategory: "Custom Mix Lab",\n      badge: "🧪 $25 CUSTOM",\n      emoji: "🧪"\n    };\n\n    onAddMixToCart(itemObj, 1, selectedOptions, fullNotes);'
  },
  {
    name: 'useBenzinState hookahs mapping in placeOrder',
    target: "t=l.filter(e=>'hookah'===e.item.category).map(e=>({flavor:{name:e.item.name,id:e.item.id},notes:[e.specialInstructions,...e.selectedModifiers.map(e=>e.optionName)].filter(Boolean).join(' · ')}))",
    replacement: "t=l.filter(e=>{const c=(e.item.category||'').toLowerCase(),n=(e.item.name||'').toLowerCase();return c==='hookah'||n.includes('hookah')||e.item.emoji==='\\ud83d\\udca8'||e.item.emoji==='\\ud83e\\uddea'}).map(e=>{const mn=(e.selectedModifiers||[]).map(e=>e.optionName||e.name).filter(Boolean);const cn=[e.specialInstructions,...mn.filter(m=>!e.specialInstructions.includes(m))].filter(Boolean).join(' · ');return{flavor:{name:e.item.name,id:e.item.id},name:e.item.name,qty:e.quantity,price:e.item.price,modifiers:e.selectedModifiers,notes:cn,note:cn}})"
  }
];

let totalPatched = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;
  let fileMatches = 0;

  for (const r of replacements) {
    if (content.includes(r.target)) {
      content = content.replaceAll(r.target, r.replacement);
      fileChanged = true;
      fileMatches++;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf8');
    try {
      execSync(`node --check "${filePath}"`);
      console.log(`✅ [${file}] Successfully patched (${fileMatches} replacements) and syntax verified.`);
      totalPatched++;
    } catch (err) {
      console.error(`❌ [${file}] Syntax check failed:`, err.message);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️ [${file}] No matching targets.`);
  }
}

console.log(`\n🎉 Patch complete! Updated ${totalPatched} bundle files without syntax errors.`);
