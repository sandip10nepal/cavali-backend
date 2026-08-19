/**
 * User / Staff Repository
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { User } from '../../models/types';

export class UserRepository {
  static async create(data: Omit<User, '_id' | 'created_at' | 'updated_at'>): Promise<User> {
    return await MultiTenantDbService.createUser(data);
  }

  static async findById(id: string): Promise<User | null> {
    return await MultiTenantDbService.getUser(id);
  }

  static async findByEmail(restaurantId: string, email: string): Promise<User | null> {
    return await MultiTenantDbService.getUserByEmail(restaurantId, email);
  }

  static async listByRestaurant(restaurantId: string, includeInactive = false): Promise<User[]> {
    return await MultiTenantDbService.listUsers(restaurantId, includeInactive);
  }

  static async update(id: string, restaurantId: string, update: Partial<User>): Promise<boolean> {
    return await MultiTenantDbService.updateUser(id, restaurantId, update);
  }

  static async delete(id: string, restaurantId?: string): Promise<boolean> {
    return await MultiTenantDbService.deleteUser(id, restaurantId);
  }
}
