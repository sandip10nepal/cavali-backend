import { Router, Request, Response } from 'express';
import { MultiTenantDbService } from '../services/multi-tenant-db.service';
import { OrderRepository } from '../modules/orders/order.repository';
import { sseService } from '../services/sse.service';

const router = Router();

// Helper to resolve restaurant ID from request context
async function resolveRestaurantId(req: Request): Promise<string> {
  const headerId = req.headers['x-restaurant-id'] as string;
  if (headerId && headerId !== 'undefined' && headerId !== 'null') {
    return headerId;
  }
  const queryId = req.query.restaurant_id as string;
  if (queryId && queryId !== 'undefined' && queryId !== 'null') {
    return queryId;
  }
  const bodyId = req.body?.restaurant_id as string;
  if (bodyId && bodyId !== 'undefined' && bodyId !== 'null') {
    return bodyId;
  }
  const restCode = (req.headers['x-restaurant-code'] || req.query.restaurant_code || req.body?.restaurant_code) as string;
  if (restCode) {
    const restaurant = await MultiTenantDbService.getRestaurantByCode(restCode);
    if (restaurant) return restaurant._id;
  }
  return 'RES_EED4E9D266DF'; // Default Cavalli
}

// Helper to check manager role permissions
function isManagerOrAdmin(req: Request): boolean {
  const role = (req.headers['x-user-role'] as string || '').toLowerCase().trim();
  if (!role) return true; // Permissive fallback if not passed, but frontend passes x-user-role
  return ['owner', 'manager', 'platform_admin', 'admin'].includes(role);
}

// Natural sort helper for tables
export function sortTablesNaturally(a: any, b: any): number {
  const getSortKey = (item: any) => {
    const raw = String(item.label || item.table_label || item.table_number || item.number || '').trim();
    const clean = raw.replace(/^table[\s-_]*/i, '').replace(/^tbl[\s-_]*/i, '').trim();
    
    // 1. Pure numeric tables: 1, 2, 3 ... 21
    const numMatch = clean.match(/^(\d+)$/);
    if (numMatch) {
      return { type: 1, section: '', num: parseInt(numMatch[1], 10), raw: clean };
    }
    
    // 2. Alphanumeric section tables like P1, P2, VIP1
    const alphaNumMatch = clean.match(/^([a-zA-Z\s_-]+?)(\d+)$/);
    if (alphaNumMatch) {
      const section = alphaNumMatch[1].replace(/[\s-_]+$/, '').toUpperCase();
      return { type: 2, section, num: parseInt(alphaNumMatch[2], 10), raw: clean };
    }
    
    // 3. Other named tables
    return { type: 3, section: clean.toUpperCase(), num: 0, raw: clean };
  };

  const keyA = getSortKey(a);
  const keyB = getSortKey(b);

  if (keyA.type !== keyB.type) {
    return keyA.type - keyB.type;
  }

  if (keyA.type === 1) {
    return keyA.num - keyB.num;
  }

  if (keyA.type === 2) {
    if (keyA.section !== keyB.section) {
      return keyA.section.localeCompare(keyB.section);
    }
    return keyA.num - keyB.num;
  }

  return keyA.raw.localeCompare(keyB.raw, undefined, { numeric: true, sensitivity: 'base' });
}

// GET /api/tables
// Returns all floor tables for the restaurant
router.get('/', async (req: Request, res: Response) => {
  try {
    const restaurantId = await resolveRestaurantId(req);
    const tables = await MultiTenantDbService.listTables(restaurantId);
    // Sort tables naturally: 1-21, then P1-P8, etc.
    tables.sort(sortTablesNaturally);
    return res.status(200).json({
      success: true,
      restaurant_id: restaurantId,
      tables
    });
  } catch (err: any) {
    console.error('Error listing tables:', err);
    return res.status(500).json({ success: false, message: 'Failed to list tables: ' + err.message });
  }
});

// POST /api/tables
// Adds a new floor table (supports numeric like "15" and alphanumeric like "P1", "P2", "VIP1")
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!isManagerOrAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Manager or owner role required to add tables' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const existingTables = await MultiTenantDbService.listTables(restaurantId);

    const rawNumStr = String(req.body.number || '').trim();
    const rawLabelStr = String(req.body.label || '').trim();

    // Check if input represents a Patio table like "P1", "P2" or "Patio 1"
    const pMatch = rawNumStr.match(/^p(\d+)$/i) || 
                   rawLabelStr.match(/^p(\d+)$/i) || 
                   rawNumStr.match(/^patio[\s-_]*(\d+)$/i) || 
                   rawLabelStr.match(/^patio[\s-_]*(\d+)$/i);

    let number = 0;
    let label = '';

    if (pMatch) {
      const pIdx = parseInt(pMatch[1], 10);
      label = rawLabelStr && !/^p\d+$/i.test(rawLabelStr) ? rawLabelStr : `P${pIdx}`;
      number = 100 + pIdx;
    } else {
      const parsedNum = parseInt(rawNumStr, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        number = parsedNum;
      } else {
        const maxNum = existingTables.reduce((max, t) => Math.max(max, t.number || 0), 0);
        number = maxNum + 1;
      }
      label = rawLabelStr || (rawNumStr && isNaN(parseInt(rawNumStr, 10)) ? rawNumStr : `Table ${number}`);
    }

    const capacity = parseInt(String(req.body.capacity), 10) || 4;

    // Check for duplicate number or label
    const duplicate = existingTables.find(t => 
      t.number === number || 
      (t.label && t.label.trim().toLowerCase() === label.trim().toLowerCase())
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A table with number "${number}" or name "${label}" already exists.`
      });
    }

    const newTable = await MultiTenantDbService.createTable({
      restaurant_id: restaurantId,
      number,
      label,
      capacity,
      active: true,
    });

    sseService.broadcast({
      type: 'table_created',
      restaurant_id: restaurantId,
      table: newTable
    });

    return res.status(201).json({
      success: true,
      message: `${newTable.label} created successfully`,
      table: newTable
    });
  } catch (err: any) {
    console.error('Error creating table:', err);
    return res.status(500).json({ success: false, message: 'Failed to create table: ' + err.message });
  }
});

// PUT /api/tables/:id
// Updates an existing floor table's details (number, label, capacity, active)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!isManagerOrAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Manager or owner role required to edit tables' });
    }

    const tableId = String(req.params.id);
    const restaurantId = await resolveRestaurantId(req);

    const existing = await MultiTenantDbService.getTable(tableId, restaurantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const updates: any = {};
    const rawNumStr = req.body.number !== undefined ? String(req.body.number).trim() : '';
    const rawLabelStr = req.body.label !== undefined ? String(req.body.label).trim() : '';

    if (rawNumStr || rawLabelStr) {
      const pMatch = rawNumStr.match(/^p(\d+)$/i) || 
                     rawLabelStr.match(/^p(\d+)$/i) || 
                     rawNumStr.match(/^patio[\s-_]*(\d+)$/i) || 
                     rawLabelStr.match(/^patio[\s-_]*(\d+)$/i);

      if (pMatch) {
        const pIdx = parseInt(pMatch[1], 10);
        updates.label = rawLabelStr && !/^p\d+$/i.test(rawLabelStr) ? rawLabelStr : `P${pIdx}`;
        updates.number = 100 + pIdx;
      } else {
        if (rawNumStr) {
          const num = parseInt(rawNumStr, 10);
          if (!isNaN(num) && num > 0) updates.number = num;
        }
        if (rawLabelStr) {
          updates.label = rawLabelStr;
        }
      }
    }

    if (req.body.capacity !== undefined) {
      const cap = parseInt(String(req.body.capacity), 10);
      if (!isNaN(cap) && cap > 0) updates.capacity = cap;
    }
    if (req.body.active !== undefined) {
      updates.active = Boolean(req.body.active);
    }

    // Check duplicate if number or label changed
    if (updates.number || updates.label) {
      const allTables = await MultiTenantDbService.listTables(restaurantId);
      const conflict = allTables.find(t => 
        t._id !== tableId && (
          (updates.number && t.number === updates.number) ||
          (updates.label && t.label && t.label.trim().toLowerCase() === updates.label.trim().toLowerCase())
        )
      );
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Another table already uses number ${updates.number || existing.number} or name "${updates.label || existing.label}".`
        });
      }
    }

    const updatedTable = await MultiTenantDbService.updateTable(tableId, restaurantId, updates);

    sseService.broadcast({
      type: 'table_updated',
      restaurant_id: restaurantId,
      table: updatedTable
    });

    return res.status(200).json({
      success: true,
      message: `${updatedTable?.label || 'Table'} updated successfully`,
      table: updatedTable
    });
  } catch (err: any) {
    console.error('Error updating table:', err);
    return res.status(500).json({ success: false, message: 'Failed to update table: ' + err.message });
  }
});

// DELETE /api/tables/:id
// Removes a floor table
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!isManagerOrAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Manager or owner role required to delete tables' });
    }

    const tableId = String(req.params.id);
    const restaurantId = await resolveRestaurantId(req);

    const table = await MultiTenantDbService.getTable(tableId, restaurantId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    // Safety check: Prevent deletion if this table currently has an active order
    const orders = await OrderRepository.listByRestaurant(restaurantId);
    const hasActiveOrder = orders.some((o: any) => {
      const isClosed = o.status === 'fulfilled' || o.status === 'completed' || o.closedSession;
      if (isClosed) return false;
      const orderTbl = String(o.table || o.table_id || '').toLowerCase();
      const matchId = o.table_id === table._id;
      const matchLabel = table.label && orderTbl === table.label.toLowerCase();
      const matchNum = orderTbl === String(table.number) || orderTbl === `table ${table.number}`;
      return matchId || matchLabel || matchNum;
    });

    if (hasActiveOrder) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove "${table.label}" because it currently has an active order. Please complete or reset the table order first.`
      });
    }

    const deleted = await MultiTenantDbService.deleteTable(tableId, restaurantId);
    if (!deleted) {
      return res.status(500).json({ success: false, message: 'Failed to delete table from database' });
    }

    sseService.broadcast({
      type: 'table_deleted',
      restaurant_id: restaurantId,
      table_id: tableId,
      label: table.label
    });

    return res.status(200).json({
      success: true,
      message: `Table "${table.label}" removed successfully`,
      table_id: tableId
    });
  } catch (err: any) {
    console.error('Error deleting table:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete table: ' + err.message });
  }
});

export default router;
