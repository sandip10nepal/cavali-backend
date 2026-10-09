const fs = require('fs');

const dbPath = './multi_tenant_db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

if (db.menu_items) {
  for (const itemKey in db.menu_items) {
    const item = db.menu_items[itemKey];
    if (!item) continue;

    // 1. Remove "Select Base" or Ice Base/Hose modifiers from House Mixes
    const isHouseMix = item.subcategory === "House Mixes" || item.name.includes("House Mix") || item.name.includes("House Blend") || item.category === "hookah";
    if (isHouseMix && item.modifiers) {
      item.modifiers = item.modifiers.filter(mod => {
        const mName = (mod.name || "").toLowerCase();
        return !mName.includes("base");
      });
    }

    // 2. Remove modifiers entirely from Hookah Add-ons
    const isAddon = item.subcategory === "Hookah Add-ons" || item.name.includes("Ice Base") || item.name.includes("Ice Hose") || item.name.includes("Refill");
    if (isAddon) {
      item.modifiers = [];
    }
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("DB Modifiers patched successfully!");
