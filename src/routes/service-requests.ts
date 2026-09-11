import { Router } from 'express';
import { ServiceRequestController } from '../modules/service-requests/serviceRequest.controller';

const router = Router();

// Dedicated coal refill route
router.post('/coal-refill', ServiceRequestController.createCoalRefill);

// Active request checker for tables
router.get('/active', ServiceRequestController.getActiveCoalRefill);

// List service requests (supports ?station=hookah, ?active=true, ?table=1)
router.get('/', ServiceRequestController.listRequests);

// Create generic table assistance request
router.post('/', ServiceRequestController.createCall);

// Update status (e.g. PENDING -> IN_PROGRESS -> COMPLETED)
router.patch('/:requestId/status', ServiceRequestController.updateStatus);
router.post('/:requestId/status', ServiceRequestController.updateStatus);
router.patch('/:requestId', ServiceRequestController.updateStatus);
router.post('/:requestId', ServiceRequestController.updateStatus);

export default router;
