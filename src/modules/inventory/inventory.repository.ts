/**
 * Inventory Repository
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { InventoryItem, InventoryTransaction } from '../../models/types';

export class InventoryRepository {
  static async list(restaurantId: string): Promise<InventoryItem[]> {
    return await MultiTenantDbService.listInventory(restaurantId);
  }

  static async createItem(item: {
    restaurant_id: string;
    name: string;
    category?: string;
    stock: number;
    unit: string;
    reorder_threshold?: number;
    cost_per_unit?: number;
  }): Promise<InventoryItem> {
    return await MultiTenantDbService.addInventoryItem(item);
  }

  static async updateStock(
    itemId: string,
    restaurantId: string,
    quantityChange: number,
    metadata: {
      type: InventoryTransaction['type'];
      reason: string;
      orderId?: string;
      userId?: string;
      deviceId?: string;
    }
  ): Promise<boolean> {
    return await MultiTenantDbService.updateInventoryStock(itemId, restaurantId, quantityChange, metadata);
  }

  static async listTransactions(restaurantId: string, limit = 100): Promise<InventoryTransaction[]> {
    return await MultiTenantDbService.listInventoryTransactions(restaurantId, limit);
  }
}
