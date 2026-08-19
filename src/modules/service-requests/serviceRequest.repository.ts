/**
 * Service Request Repository
 *
 * Persists table assistance / server call requests (coals, water, check, server).
 * Kept strictly isolated from financial order entities.
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';

export interface ServiceRequestEntity {
  _id: string;
  restaurant_id: string;
  table_id: string;
  request_type: 'server' | 'coals' | 'water' | 'utensils' | 'check' | 'custom';
  note: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string | null;
}

export class ServiceRequestRepository {
  /**
   * Create a new service request
   */
  static async create(data: Omit<ServiceRequestEntity, '_id' | 'created_at' | 'status'>): Promise<ServiceRequestEntity> {
    const entity: ServiceRequestEntity = {
      ...data,
      _id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Store as service request in MT DB
    try {
      const db = MultiTenantDbService.getDb();
      if (db) {
        await db.collection('service_requests').updateOne(
          { _id: entity._id as any },
          { $set: entity },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn('[ServiceRequestRepository] DB store error:', (err as Error).message);
    }

    return entity;
  }

  /**
   * Update request status
   */
  static async updateStatus(id: string, status: ServiceRequestEntity['status']): Promise<boolean> {
    try {
      const db = MultiTenantDbService.getDb();
      if (db) {
        await db.collection('service_requests').updateOne(
          { _id: id as any },
          { $set: { status, completed_at: status === 'completed' ? new Date().toISOString() : null } }
        );
        return true;
      }
    } catch (err) {
      console.warn('[ServiceRequestRepository] Update error:', (err as Error).message);
    }
    return false;
  }
}
