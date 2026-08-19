/**
 * Payment Controller — Express HTTP Adapter
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { resolveTenantRestaurantId } from '../../middleware/tenant.middleware';

export class PaymentController {
  static async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = (await resolveTenantRestaurantId(req)) || 'RES_EED4E9D266DF';
      const { order_id, orderId, amount_cents } = req.body;
      const targetOrderId = order_id || orderId;

      const session = await PaymentService.createPaymentSession(restaurantId, String(targetOrderId), amount_cents ? Number(amount_cents) : undefined);
      res.status(201).json({
        success: true,
        payment_session_id: session._id,
        order_id: session.order_id,
        amount_cents: session.amount_cents,
        currency: session.currency,
        status: session.status,
      });
    } catch (err) {
      next(err);
    }
  }
}
