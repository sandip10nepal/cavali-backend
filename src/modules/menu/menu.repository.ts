/**
 * Menu Repository
 *
 * Handles database operations for menu items & categories across tenants.
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { MenuCategory, MenuItemModel } from '../../models/types';

export class MenuRepository {
  static async listCategories(restaurantId: string): Promise<MenuCategory[]> {
    return await MultiTenantDbService.listCategories(restaurantId);
  }

  static async createCategory(data: Omit<MenuCategory, '_id' | 'created_at' | 'updated_at'>): Promise<MenuCategory> {
    return await MultiTenantDbService.createMenuCategory(data);
  }

  static async updateCategory(id: string, restaurantId: string, update: Partial<MenuCategory>): Promise<boolean> {
    return await MultiTenantDbService.updateMenuCategory(id, restaurantId, update);
  }

  static async deleteCategory(id: string, restaurantId: string): Promise<boolean> {
    const res = await MultiTenantDbService.deleteMenuCategory(id, restaurantId);
    return res.success;
  }

  static async listItems(restaurantId: string, categoryId?: string): Promise<MenuItemModel[]> {
    return await MultiTenantDbService.listMenuItems(restaurantId, categoryId);
  }

  static async getItem(id: string, restaurantId: string): Promise<MenuItemModel | null> {
    return await MultiTenantDbService.getMenuItem(id, restaurantId);
  }

  static async createItem(data: Omit<MenuItemModel, '_id' | 'created_at' | 'updated_at'>): Promise<MenuItemModel> {
    return await MultiTenantDbService.createMenuItem(data);
  }

  static async updateItem(id: string, restaurantId: string, update: Partial<MenuItemModel>): Promise<boolean> {
    return await MultiTenantDbService.updateMenuItem(id, restaurantId, update);
  }

  static async deleteItem(id: string, restaurantId: string): Promise<boolean> {
    return await MultiTenantDbService.deleteMenuItem(id, restaurantId);
  }

  static async setAvailability(id: string, restaurantId: string, available: boolean): Promise<boolean> {
    return await MultiTenantDbService.setMenuItemAvailability(id, restaurantId, available);
  }
}
