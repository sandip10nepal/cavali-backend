/**
 * Service Request Controller — Express Request/Response Adapter
 */

import { Request, Response, NextFunction } from 'express';
import { ServiceRequestService } from './serviceRequest.service';
import { resolveTenantRestaurantId } from '../../middleware/tenant.middleware';

export class ServiceRequestController {
  static async createCall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = await resolveTenantRestaurantId(req);
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const { table, tableId, table_id, requestType, type, note } = req.body;
      const targetTable = tableId || table_id || table || 'Table 1';
      const reqType = requestType || type || 'server';

      const request = await ServiceRequestService.createRequest(restaurantId, targetTable, reqType, note || '');
      res.status(201).json({ success: true, request, message: 'Server notified' });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = await resolveTenantRestaurantId(req);
      if (!restaurantId) {
        res.status(400).json({ success: false, message: 'Restaurant ID required' });
        return;
      }
      const { requestId } = req.params;
      const { status } = req.body;

      await ServiceRequestService.updateStatus(restaurantId, String(requestId), status);
      res.status(200).json({ success: true, message: `Service request status updated to ${status}` });
    } catch (err) {
      next(err);
    }
  }
}
