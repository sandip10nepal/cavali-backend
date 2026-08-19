/**
 * Central API Router Registry
 */

import { Router } from 'express';
import { requestIdMiddleware } from '../middleware/request-id.middleware';
import { OrderController } from '../modules/orders/order.controller';
import { PaymentController } from '../modules/payments/payment.controller';
import { ServiceRequestController } from '../modules/service-requests/serviceRequest.controller';
import { validateSchema } from '../middleware/validation.middleware';
import { CreateOrderSchema, FulfillOrderSchema } from '../modules/orders/order.schemas';
import { requirePermission } from '../middleware/authorization.middleware';

const apiRouter = Router();

// Apply Request ID tracking
apiRouter.use(requestIdMiddleware);

// ── Orders API ─────────────────────────────────────────────────────────────
apiRouter.get('/orders', OrderController.listOrders);
apiRouter.post('/orders', validateSchema({ body: CreateOrderSchema }), OrderController.createOrder);
apiRouter.post('/orders/fulfill', requirePermission('orders.fulfill'), validateSchema({ body: FulfillOrderSchema }), OrderController.fulfillOrder);

// ── Table Service Requests API ─────────────────────────────────────────────
apiRouter.post('/orders/server-call', ServiceRequestController.createCall);
apiRouter.patch('/service-requests/:requestId/status', requirePermission('service_requests.update'), ServiceRequestController.updateStatus);

// ── Payment Sessions API ───────────────────────────────────────────────────
apiRouter.post('/payment-sessions', PaymentController.createSession);

export default apiRouter;
