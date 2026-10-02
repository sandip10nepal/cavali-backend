import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { sortTablesNaturally } from '../routes/tables';

async function test() {
  console.log('🧪 Starting Patio Tables Overview test...');
  await MultiTenantDbService.ensureReady();
  const rest = await MultiTenantDbService.getRestaurantBySlug('cavali');
  if (!rest) throw new Error('Restaurant cavali not found');

  // Test 1: ensureDefaultTables
  await MultiTenantDbService.ensureDefaultTables();
  const tables = await MultiTenantDbService.listTables(rest._id);
  tables.sort(sortTablesNaturally);

  console.log(`\nTotal Cavalli tables: ${tables.length}`);
  const patioTables = tables.filter(t => /^p\d+/i.test(t.label) || (t.label || '').toLowerCase().includes('patio'));
  console.log(`Patio tables found: ${patioTables.length}`);
  if (patioTables.length < 8) {
    throw new Error(`Expected at least 8 patio tables, found ${patioTables.length}`);
  }

  // Verify sort order: 1..21 dining tables come before P1..P8
  const labels = tables.map(t => t.label);
  console.log('Table order preview:');
  console.log('First 5:', labels.slice(0, 5));
  console.log('Last 10:', labels.slice(-10));

  const p1Index = labels.indexOf('P1');
  const table1Index = labels.indexOf('Table 1');
  const table12Index = labels.indexOf('Table 12');

  if (table1Index >= p1Index || table12Index >= p1Index) {
    throw new Error(`Expected standard dining tables before patio tables. Table 1 idx: ${table1Index}, Table 12 idx: ${table12Index}, P1 idx: ${p1Index}`);
  }
  console.log('✅ Natural sorting verified: Dining tables appear first, followed by Patio tables P1-P8');

  // Test 2: Table normalization and matching
  const normalizeTable = (val: any): string => {
    let s = String(val || '').trim().toLowerCase();
    s = s.replace(/^tbl[_\s-]*/i, '').replace(/^table[\s-_]*/i, '').trim();
    if (s.startsWith('patio')) {
      s = s.replace(/^patio[\s-_]*/i, '');
      if (!s.startsWith('p')) {
        s = 'p' + s;
      }
    }
    s = s.replace(/[\s-_]+/g, '');
    return s;
  };

  const matchesTable = (tableObj: any, orderTableStr: any): boolean => {
    if (!orderTableStr) return false;
    const orderIdStr = String(orderTableStr).trim();
    if (tableObj._id === orderIdStr || tableObj.id === orderIdStr) return true;

    const oClean = normalizeTable(orderTableStr);
    if (!oClean) return false;
    const labelClean = normalizeTable(tableObj.label || '');
    if (oClean === labelClean) return true;

    const numStr = String(tableObj.number || '');
    if (/^\d+$/.test(oClean) && /^\d+$/.test(numStr)) {
      return parseInt(oClean, 10) === parseInt(numStr, 10);
    }
    return false;
  };

  const p1Table = tables.find(t => t.label === 'P1');
  const table1 = tables.find(t => t.label === 'Table 1');

  if (!p1Table || !table1) throw new Error('Missing P1 or Table 1');

  if (!matchesTable(p1Table, 'P1')) throw new Error('matchesTable(p1Table, "P1") failed');
  if (!matchesTable(p1Table, 'p1')) throw new Error('matchesTable(p1Table, "p1") failed');
  if (!matchesTable(p1Table, 'Patio 1')) throw new Error('matchesTable(p1Table, "Patio 1") failed');
  if (!matchesTable(p1Table, 'Table P1')) throw new Error('matchesTable(p1Table, "Table P1") failed');

  // Ensure P1 order does NOT match Table 1
  if (matchesTable(table1, 'P1')) throw new Error('matchesTable(table1, "P1") incorrectly matched Table 1!');
  if (matchesTable(table1, 'Patio 1')) throw new Error('matchesTable(table1, "Patio 1") incorrectly matched Table 1!');

  // Ensure Table 1 order matches Table 1 and does NOT match P1
  if (!matchesTable(table1, '1')) throw new Error('matchesTable(table1, "1") failed');
  if (!matchesTable(table1, 'Table 1')) throw new Error('matchesTable(table1, "Table 1") failed');
  if (matchesTable(p1Table, '1')) throw new Error('matchesTable(p1Table, "1") incorrectly matched P1!');

  console.log('✅ Patio table matching verified: P1, p1, Patio 1, Table P1 match P1 and never collide with Table 1');

  console.log('🎉 All tests passed successfully!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
