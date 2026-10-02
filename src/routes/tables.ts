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

// GET /api/tables
// Returns all floor tables for the restaurant
router.get('/', async (req: Request, res: Response) => {
  try {
    const restaurantId = await resolveRestaurantId(req);
    const tables = await MultiTenantDbService.listTables(restaurantId);
    // Sort tables numerically
    tables.sort((a, b) => (a.number || 0) - (b.number || 0));
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
// Adds a new floor table
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!isManagerOrAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Manager or owner role required to add tables' });
    }

    const restaurantId = await resolveRestaurantId(req);
    const existingTables = await MultiTenantDbService.listTables(restaurantId);

    let number = parseInt(String(req.body.number), 10);
    if (isNaN(number) || number <= 0) {
      // Auto-assign highest number + 1
      const maxNum = existingTables.reduce((max, t) => Math.max(max, t.number || 0), 0);
      number = maxNum + 1;
    }

    const labelInput = (req.body.label || '').trim();
    const label = labelInput || `Table ${number}`;
    const capacity = parseInt(String(req.body.capacity), 10) || 4;

    // Check for duplicate number or label
    const duplicate = existingTables.find(t => 
      t.number === number || 
      (t.label && t.label.toLowerCase() === label.toLowerCase())
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
    if (req.body.number !== undefined) {
      const num = parseInt(String(req.body.number), 10);
      if (!isNaN(num) && num > 0) updates.number = num;
    }
    if (req.body.label !== undefined) {
      const lbl = String(req.body.label).trim();
      if (lbl) updates.label = lbl;
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
          (updates.label && t.label && t.label.toLowerCase() === updates.label.toLowerCase())
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
