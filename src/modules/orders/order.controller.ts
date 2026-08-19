/**
 * Order Controller — Express Request/Response Adapter
 */

import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { resolveTenantRestaurantId } from '../../middleware/tenant.middleware';

export class OrderController {
  static async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
      const role = String(req.query.role || req.headers['x-user-role'] || 'manager');
      const orders = await OrderService.getOrdersForStation(restaurantId, role);
      res.status(200).json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  }

  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
      const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string | undefined;
      const order = await OrderService.createOrder(restaurantId, req.body, idempotencyKey);
      res.status(201).json({ success: true, order, message: 'Order received & sent to POS' });
    } catch (err) {
      next(err);
    }
  }

  static async fulfillOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
      const { orderId, department } = req.body;
      const order = await OrderService.fulfillOrder(restaurantId, orderId, department);
      res.status(200).json({ success: true, message: 'Order fulfilled successfully', order });
    } catch (err) {
      next(err);
    }
  }
}
