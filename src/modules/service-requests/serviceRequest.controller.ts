/**
 * Service Request Controller — Express Request/Response Adapter
 */

import { Request, Response, NextFunction } from 'express';
import { ServiceRequestService } from './serviceRequest.service';
import { resolveTenantRestaurantId } from '../../middleware/tenant.middleware';
import { ConflictError } from '../../core/errors';

export class ServiceRequestController {
  /**
   * Generic server call assistance
   */
  static async createCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || req.body.restaurant_id || (req as any).tenant?.restaurant_id;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const { table, tableId, table_id, requestType, type, note, sessionId, customerName } = req.body;
      const targetTable = tableId || table_id || table || '1';
      const reqType = requestType || type || 'server';

      const request = await ServiceRequestService.createRequest(restaurantId, String(targetTable), reqType, note || '', {
        sessionId,
        customerName,
      });
      res.status(201).json({ success: true, request, message: 'Request submitted successfully' });
    } catch (err: any) {
      if (err instanceof ConflictError || err.statusCode === 409) {
        res.status(409).json({ 
          success: false, 
          code: 'DUPLICATE_ACTIVE_REQUEST', 
          message: err.message, 
          details: err.details 
        });
        return;
      }
      next(err);
    }
  }

  /**
   * Dedicated Coal Refill creation
   */
  static async createCoalRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || req.body.restaurant_id || (req as any).tenant?.restaurant_id;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const { table, tableId, table_id, note, sessionId, customerName } = req.body;
      const targetTable = tableId || table_id || table || '1';

      const request = await ServiceRequestService.createRequest(restaurantId, String(targetTable), 'COAL_REFILL', note || 'Hookah Coal Refill 🔥', {
        sessionId,
        customerName,
      });
      res.status(201).json({ success: true, request, message: 'Coal refill request routed to Hookah Station' });
    } catch (err: any) {
      if (err instanceof ConflictError || err.statusCode === 409) {
        res.status(409).json({ 
          success: false, 
          code: 'DUPLICATE_ACTIVE_REQUEST', 
          message: err.message, 
          details: err.details 
        });
        return;
      }
      next(err);
    }
  }

  /**
   * Check active coal refill for table
   */
  static async getActiveCoalRefill(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || (req.query.restaurant_id as string) || (req as any).tenant?.restaurant_id;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const rawTable = (req.query.table as string) || (req.query.table_id as string) || '1';
      const active = await ServiceRequestService.getActiveCoalRefill(restaurantId, rawTable);
      res.status(200).json({ success: true, activeRequest: active });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List requests (optionally filtered by station=hookah)
   */
  static async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || (req.query.restaurant_id as string) || (req as any).tenant?.restaurant_id;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const station = (req.query.station as string) || (req.query.role as string);
      const activeOnly = req.query.active === 'true' || req.query.activeOnly === 'true';
      const tableId = req.query.table as string;

      const requests = await ServiceRequestService.listRequests(restaurantId, { station, activeOnly, tableId });
      res.status(200).json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update request status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || req.body.restaurant_id || (req as any).tenant?.restaurant_id;
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const requestId = req.params.requestId || req.params.id;
      const status = req.body.status;
      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required' });
        return;
      }

      await ServiceRequestService.updateStatus(restaurantId, String(requestId), status);
      res.status(200).json({ success: true, message: `Service request status updated to ${status}` });
    } catch (err) {
      next(err);
    }
  }
}
