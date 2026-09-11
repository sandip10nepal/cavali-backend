/**
 * Service Request Repository
 *
 * Persists table assistance / server call requests (coals, water, check, server, COAL_REFILL).
 * Kept strictly isolated from financial order entities.
 */

import { MultiTenantDbService } from '../../services/multi-tenant-db.service';

export type ServiceRequestType = 'COAL_REFILL' | 'server' | 'coals' | 'water' | 'utensils' | 'check' | 'custom';
export type ServiceRequestStatus = 
  | 'pending' 
  | 'acknowledged' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ServiceRequestEntity {
  _id: string;
  id?: string;
  restaurant_id: string;
  table_id: string;
  table_number?: string;
  session_id?: string | null;
  customer_session_id?: string | null;
  customer_name?: string | null;
  request_type: ServiceRequestType;
  note: string;
  status: ServiceRequestStatus;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export class ServiceRequestRepository {
  /**
   * Helper to normalize table string (e.g. 'Table 1' -> '1', 'TBL_1' -> '1')
   */
  static normalizeTableId(raw: string): string {
    return String(raw || '').replace(/[^0-9]/g, '') || String(raw || '').trim();
  }

  /**
   * Create a new service request
   */
  static async create(data: Omit<ServiceRequestEntity, '_id' | 'created_at' | 'status'> & { status?: ServiceRequestStatus }): Promise<ServiceRequestEntity> {
    const now = new Date().toISOString();
    const entity: ServiceRequestEntity = {
      ...data,
      _id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status: data.status || 'PENDING',
      created_at: now,
      updated_at: now,
    };
    entity.id = entity._id;

    // 1. Attempt MongoDB persistence if connected
    const db = MultiTenantDbService.getDb();
    if (db) {
      try {
        await db.collection('service_requests').updateOne(
          { _id: entity._id as any },
          { $set: entity },
          { upsert: true }
        );
        return entity;
      } catch (err) {
        console.warn('[ServiceRequestRepository] MongoDB store warning:', (err as Error).message);
      }
    }

    // 2. Fallback to Local file/memory store in MultiTenantDbService when not in Mongo mode
    try {
      const list = (MultiTenantDbService.getCollection('service_requests') as ServiceRequestEntity[]) || [];
      const existingIdx = list.findIndex(r => r._id === entity._id);
      if (existingIdx >= 0) {
        list[existingIdx] = entity;
      } else {
        list.push(entity);
      }
      MultiTenantDbService.saveCollection('service_requests', list);
    } catch (err) {
      // Local fallback unavailable
    }

    return entity;
  }

  /**
   * Find request by ID with tenant isolation
   */
  static async findById(id: string, restaurantId?: string): Promise<ServiceRequestEntity | null> {
    const db = MultiTenantDbService.getDb();
    if (db) {
      try {
        const query: any = { _id: id };
        if (restaurantId) query.restaurant_id = restaurantId;
        const doc = await db.collection<any>('service_requests').findOne(query);
        if (doc) return { ...doc, id: doc._id };
        return null;
      } catch (err) {
        console.warn('[ServiceRequestRepository] findById Mongo error:', (err as Error).message);
      }
    }

    try {
      const list = (MultiTenantDbService.getCollection('service_requests') as ServiceRequestEntity[]) || [];
      return list.find(r => (r._id === id || r.id === id) && (!restaurantId || r.restaurant_id === restaurantId)) || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Find active coal refill request for a table to prevent spam/duplicates
   */
  static async findActiveCoalRefill(restaurantId: string, tableId: string): Promise<ServiceRequestEntity | null> {
    const normTarget = this.normalizeTableId(tableId);
    const activeStatuses = ['pending', 'PENDING', 'acknowledged', 'in_progress', 'IN_PROGRESS'];
    const coalTypes = ['COAL_REFILL', 'coals'];

    const db = MultiTenantDbService.getDb();
    if (db) {
      try {
        const docs = await db.collection<any>('service_requests').find({
          restaurant_id: restaurantId,
          request_type: { $in: coalTypes },
          status: { $in: activeStatuses },
        }).toArray();

        const match = docs.find(d => {
          const dTable = this.normalizeTableId(d.table_number || d.table_id || '');
          return dTable === normTarget || d.table_id === tableId;
        });

        if (match) return { ...match, id: match._id };
        return null;
      } catch (err) {
        console.warn('[ServiceRequestRepository] findActiveCoalRefill Mongo error:', (err as Error).message);
      }
    }

    try {
      const list = (MultiTenantDbService.getCollection('service_requests') as ServiceRequestEntity[]) || [];
      return list.find(r => {
        if (r.restaurant_id !== restaurantId) return false;
        const typeMatch = coalTypes.includes(r.request_type);
        const statusMatch = activeStatuses.includes(r.status);
        const tableMatch = this.normalizeTableId(r.table_number || r.table_id) === normTarget || r.table_id === tableId;
        return typeMatch && statusMatch && tableMatch;
      }) || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * List requests by restaurant with optional station/active filtering
   */
  static async listByRestaurant(
    restaurantId: string, 
    options?: { station?: string; activeOnly?: boolean; tableId?: string }
  ): Promise<ServiceRequestEntity[]> {
    const activeStatuses = ['pending', 'PENDING', 'acknowledged', 'in_progress', 'IN_PROGRESS'];

    const db = MultiTenantDbService.getDb();
    if (db) {
      try {
        const query: any = { restaurant_id: restaurantId };
        if (options?.activeOnly) {
          query.status = { $in: activeStatuses };
        }
        if (options?.station === 'hookah' || options?.station === 'hookah_maker') {
          query.request_type = { $in: ['COAL_REFILL', 'coals'] };
        }
        const docs = await db.collection<any>('service_requests').find(query).sort({ created_at: -1 }).toArray();
        let results = docs.map(d => ({ ...d, id: d._id }));
        if (options?.tableId) {
          const normTarget = this.normalizeTableId(options.tableId);
          results = results.filter(r => {
            const normItem = this.normalizeTableId(r.table_number || r.table_id);
            return normTarget === normItem || r.table_id === options.tableId;
          });
        }
        return results;
      } catch (err) {
        console.warn('[ServiceRequestRepository] listByRestaurant Mongo error:', (err as Error).message);
      }
    }

    try {
      const list = (MultiTenantDbService.getCollection('service_requests') as ServiceRequestEntity[]) || [];
      let results = list.filter(r => {
        if (r.restaurant_id !== restaurantId) return false;
        if (options?.activeOnly && !activeStatuses.includes(r.status)) return false;
        if ((options?.station === 'hookah' || options?.station === 'hookah_maker') && !['COAL_REFILL', 'coals'].includes(r.request_type)) {
          return false;
        }
        if (options?.tableId) {
          const normTarget = this.normalizeTableId(options.tableId);
          const normItem = this.normalizeTableId(r.table_number || r.table_id);
          if (normTarget !== normItem && r.table_id !== options.tableId) return false;
        }
        return true;
      });
      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (err) {
      return [];
    }
  }

  /**
   * Update request status
   */
  static async updateStatus(id: string, status: ServiceRequestStatus, restaurantId?: string): Promise<boolean> {
    const now = new Date().toISOString();
    const isFinished = status === 'completed' || status === 'COMPLETED' || status === 'cancelled' || status === 'CANCELLED';
    const completedAt = isFinished ? now : null;

    const db = MultiTenantDbService.getDb();
    if (db) {
      try {
        const query: any = { _id: id };
        if (restaurantId) query.restaurant_id = restaurantId;
        const res = await db.collection('service_requests').updateOne(
          query,
          { 
            $set: { 
              status, 
              updated_at: now,
              ...(completedAt ? { completed_at: completedAt } : {})
            } 
          }
        );
        if (res.modifiedCount > 0 || res.matchedCount > 0) return true;
        return false;
      } catch (err) {
        console.warn('[ServiceRequestRepository] Update error:', (err as Error).message);
      }
    }

    // Update in local file store when not in Mongo mode
    try {
      const list = (MultiTenantDbService.getCollection('service_requests') as ServiceRequestEntity[]) || [];
      const item = list.find(r => (r._id === id || r.id === id) && (!restaurantId || r.restaurant_id === restaurantId));
      if (item) {
        item.status = status;
        item.updated_at = now;
        if (completedAt) item.completed_at = completedAt;
        MultiTenantDbService.saveCollection('service_requests', list);
        return true;
      }
    } catch (err) {
      // Ignore local fallback error
    }

    return false;
  }
}
