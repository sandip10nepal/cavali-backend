/**
 * Service Request Domain Service
 */

import { ServiceRequestRepository, ServiceRequestEntity, ServiceRequestType, ServiceRequestStatus } from './serviceRequest.repository';
import { MultiTenantDbService } from '../../services/multi-tenant-db.service';
import { sseService } from '../../services/sse.service';
import { NotFoundError, ValidationError, ConflictError } from '../../core/errors';
import { eventBus } from '../../events/event-bus';
import { randomUUID } from 'crypto';

export interface CreateRequestOptions {
  tableId: string;
  tableNumber?: string;
  requestType: ServiceRequestType;
  note?: string;
  sessionId?: string | null;
  customerName?: string | null;
}

export class ServiceRequestService {
  /**
   * Create a service request with validation & duplicate protection
   */
  static async createRequest(
    restaurantId: string, 
    tableId: string, 
    requestType: ServiceRequestType, 
    note: string = '',
    options?: { tableNumber?: string; sessionId?: string | null; customerName?: string | null }
  ): Promise<ServiceRequestEntity> {
    if (!restaurantId) {
      throw new ValidationError('Restaurant ID is required for table assistance requests');
    }
    if (!tableId) {
      throw new ValidationError('Table ID is required for table assistance requests');
    }

    const normType = (requestType || 'server').toUpperCase() === 'COAL_REFILL' ? 'COAL_REFILL' : requestType;

    // Duplicate spam protection for coal refills
    if (normType === 'COAL_REFILL' || normType === 'coals') {
      const active = await ServiceRequestRepository.findActiveCoalRefill(restaurantId, tableId);
      if (active) {
        throw new ConflictError(
          'A coal refill request is already pending or in progress for this table.',
          { duplicate: true, activeRequest: active }
        );
      }
    }

    const tableNum = options?.tableNumber || ServiceRequestRepository.normalizeTableId(tableId) || tableId;

    const request = await ServiceRequestRepository.create({
      restaurant_id: restaurantId,
      table_id: tableId,
      table_number: tableNum,
      request_type: normType,
      note: note || (normType === 'COAL_REFILL' ? 'Hookah Coal Refill 🔥' : 'Assistance Needed'),
      session_id: options?.sessionId || null,
      customer_session_id: options?.sessionId || null,
      customer_name: options?.customerName || `Table ${tableNum}`,
      status: 'PENDING',
    });

    // Publish event
    eventBus.publish({
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 8)}`,
      eventType: 'SERVICE_REQUEST_CREATED',
      tenantId: restaurantId,
      entityId: request._id,
      entityType: 'SERVICE_REQUEST',
      timestamp: new Date().toISOString(),
      payload: request,
    });

    // Broadcast SSE (Targeted to Hookah Station for coal refills)
    const isCoal = normType === 'COAL_REFILL' || normType === 'coals';
    sseService.broadcast({ 
      type: isCoal ? 'coal_refill_request' : 'server_call',
      station: isCoal ? 'hookah_maker' : 'floor',
      request 
    }, restaurantId);

    // Also broadcast generic server_call for legacy compatibility
    if (isCoal) {
      sseService.broadcast({ type: 'server_call', request, station: 'hookah_maker' }, restaurantId);
    }

    return request;
  }

  /**
   * Check active coal refill request for a table
   */
  static async getActiveCoalRefill(restaurantId: string, tableId: string): Promise<ServiceRequestEntity | null> {
    if (!restaurantId || !tableId) return null;
    return ServiceRequestRepository.findActiveCoalRefill(restaurantId, tableId);
  }

  /**
   * List requests by restaurant and optional station filter
   */
  static async listRequests(
    restaurantId: string, 
    options?: { station?: string; activeOnly?: boolean; tableId?: string }
  ): Promise<ServiceRequestEntity[]> {
    if (!restaurantId) return [];
    return ServiceRequestRepository.listByRestaurant(restaurantId, options);
  }

  /**
   * Update request status (PENDING -> IN_PROGRESS -> COMPLETED / CANCELLED)
   */
  static async updateStatus(
    restaurantId: string, 
    requestId: string, 
    status: ServiceRequestStatus
  ): Promise<boolean> {
    const normStatus = (status || '').toUpperCase() as ServiceRequestStatus;
    const existing = await ServiceRequestRepository.findById(requestId, restaurantId);
    if (!existing) {
      throw new NotFoundError(`Service request #${requestId} not found`);
    }

    const updated = await ServiceRequestRepository.updateStatus(requestId, normStatus, restaurantId);
    if (!updated) {
      throw new NotFoundError(`Service request #${requestId} could not be updated`);
    }

    const updatedEntity = await ServiceRequestRepository.findById(requestId, restaurantId);

    // Sync fulfillment to orders collection if mirrored as an order
    const isFinished = normStatus === 'COMPLETED' || normStatus === 'CANCELLED';
    if (isFinished) {
      try {
        const db = MultiTenantDbService.getDb();
        if (db) {
          await db.collection('orders').updateOne(
            { _id: requestId as any },
            { $set: { status: 'fulfilled', completed_at: new Date() } }
          );
        }
        const ordersList = MultiTenantDbService.getCollection('orders');
        if (Array.isArray(ordersList)) {
          const ord = ordersList.find((o: any) => o._id === requestId || o.id === requestId);
          if (ord) {
            ord.status = 'fulfilled' as any;
            ord.completed_at = new Date().toISOString();
            MultiTenantDbService.saveCollection('orders', ordersList);
          }
        }
        sseService.broadcast({ type: 'order_fulfilled', orderId: requestId, order: { _id: requestId, status: 'fulfilled' } }, restaurantId);
      } catch (syncErr) {
        console.warn('[ServiceRequestService] Could not sync fulfilled status to orders collection:', syncErr);
      }
    }

    // Broadcast status change via SSE
    const isCoal = existing.request_type === 'COAL_REFILL' || existing.request_type === 'coals';
    if (isCoal) {
      sseService.broadcast({ 
        type: 'coal_refill_updated', 
        station: 'hookah_maker',
        requestId, 
        status: normStatus,
        tableId: existing.table_id,
        tableNumber: existing.table_number,
        request: updatedEntity
      }, restaurantId);
    }

    sseService.broadcast({ 
      type: 'server_call_updated', 
      requestId, 
      status: normStatus,
      tableId: existing.table_id,
      request: updatedEntity
    }, restaurantId);

    return true;
  }
}
