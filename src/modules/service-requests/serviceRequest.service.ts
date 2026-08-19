/**
 * Service Request Domain Service
 */

import { ServiceRequestRepository, ServiceRequestEntity } from './serviceRequest.repository';
import { sseService } from '../../services/sse.service';
import { NotFoundError, ValidationError } from '../../core/errors';
import { eventBus } from '../../events/event-bus';
import { randomUUID } from 'crypto';

export class ServiceRequestService {
  static async createRequest(restaurantId: string, tableId: string, requestType: ServiceRequestEntity['request_type'], note: string = ''): Promise<ServiceRequestEntity> {
    if (!tableId) {
      throw new ValidationError('Table ID is required for table assistance requests');
    }

    const request = await ServiceRequestRepository.create({
      restaurant_id: restaurantId,
      table_id: tableId,
      request_type: requestType,
      note,
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

    // Broadcast SSE
    sseService.broadcast({ type: 'server_call', request }, restaurantId);

    return request;
  }

  static async updateStatus(restaurantId: string, requestId: string, status: ServiceRequestEntity['status']): Promise<boolean> {
    const updated = await ServiceRequestRepository.updateStatus(requestId, status);
    if (!updated) {
      throw new NotFoundError(`Service request #${requestId} not found`);
    }

    sseService.broadcast({ type: 'server_call_updated', requestId, status }, restaurantId);
    return true;
  }
}
