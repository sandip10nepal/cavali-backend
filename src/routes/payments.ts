import { Router } from 'express';
import { PaymentRepository } from '../modules/payments/payment.repository';
import { OrderRepository } from '../modules/orders/order.repository';
import { SquareService } from '../services/square.service';
import { sseService } from '../services/sse.service';
import { PaymentSession } from '../models/types';

const router = Router();

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED'];

// ── Helper ────────────────────────────────────────────────────────────────

function broadcastPaymentUpdate(session: PaymentSession) {
  sseService.broadcast({
    type: 'payment_status_update',
    session,
    order_id: session.order_id
  });
}

// ── GET /api/payment-sessions/next ───────────────────────────────────────
// iPhone polls this to pick up the next unclaimed payment session.
// Returns { session: null } when nothing is pending.
router.get('/next', async (_req, res) => {
  const sessions = await PaymentRepository.listUnclaimedSessions();
  const next = sessions.length > 0 ? sessions[0] : null;
  res.status(200).json({ success: true, session: next });
});

// ── GET /api/payment-sessions/:id ────────────────────────────────────────
// iPad polls this to track payment status.
router.get('/:id', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Payment session not found' });
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(200).json({ success: true, session });
});

// ── POST /api/payment-sessions/:id/claim ─────────────────────────────────
// iPhone claims a session before processing to prevent double-charging.
router.post('/:id/claim', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  if (session.status === 'CLAIMED') {
    // Idempotent: if same device already claimed it, return OK
    const deviceId = req.body.device_id;
    if (deviceId && session.payment_device_id === deviceId) {
      return res.status(200).json({ success: true, session });
    }
    return res.status(409).json({ success: false, message: 'Session already claimed by another device' });
  }

  if (session.status !== 'PAYMENT_REQUESTED') {
    return res.status(409).json({
      success: false,
      message: `Cannot claim session in status ${session.status}`
    });
  }

  const deviceId = req.body.device_id || `device-${Date.now()}`;
  const updated = await PaymentRepository.updateSession(session._id, {
    status: 'CLAIMED',
    payment_device_id: deviceId
  });

  if (!updated) return res.status(500).json({ success: false, message: 'Failed to update session' });

  broadcastPaymentUpdate(updated);
  console.log(`[Payment] Session ${session._id} CLAIMED by device ${deviceId}`);
  res.status(200).json({ success: true, session: updated });
});

// ── POST /api/payment-sessions/:id/processing ────────────────────────────
// iPhone reports that Square tap-to-pay has started.
router.post('/:id/processing', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  if (session.status !== 'CLAIMED') {
    return res.status(409).json({
      success: false,
      message: `Cannot mark processing from status ${session.status}`
    });
  }

  const updated = await PaymentRepository.updateSession(session._id, { status: 'PROCESSING' });
  if (!updated) return res.status(500).json({ success: false, message: 'Failed to update session' });

  broadcastPaymentUpdate(updated);
  console.log(`[Payment] Session ${session._id} PROCESSING`);
  res.status(200).json({ success: true, session: updated });
});

// ── POST /api/payment-sessions/:id/complete ──────────────────────────────
// iPhone sends the Square payment ID after customer taps card.
// Backend verifies server-side before marking order PAID.
router.post('/:id/complete', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  if (session.status === 'COMPLETED') {
    return res.status(200).json({ success: true, session, message: 'Already completed' });
  }

  if (session.status !== 'PROCESSING') {
    return res.status(409).json({
      success: false,
      message: `Cannot complete session in status ${session.status}`
    });
  }

  const { square_payment_id } = req.body;
  if (!square_payment_id) {
    return res.status(400).json({ success: false, message: 'square_payment_id is required' });
  }

  // Server-side Square verification (DEMO MODE: always passes)
  const verification = await SquareService.verifyPayment(
    square_payment_id,
    session.amount_cents,
    session.currency
  );

  if (!verification.valid) {
    console.error(`[Payment] Square verification FAILED: ${verification.error}`);
    const failed = await PaymentRepository.updateSession(session._id, {
      status: 'FAILED',
      error_code: 'VERIFICATION_FAILED',
      error_message: verification.error || 'Square verification failed'
    });
    if (failed) broadcastPaymentUpdate(failed);
    return res.status(400).json({
      success: false,
      message: `Payment verification failed: ${verification.error}`
    });
  }

  // Verification passed — mark COMPLETED and mark order PAID
  const now = new Date().toISOString();
  const updated = await PaymentRepository.updateSession(session._id, {
    status: 'COMPLETED',
    provider_payment_id: square_payment_id,
    completed_at: now
  });

  if (!updated) return res.status(500).json({ success: false, message: 'Failed to complete session' });

  // Update order paid and due amounts dynamically
  const restaurantId = session.restaurant_id || 'RES_EED4E9D266DF';
  const order = await OrderRepository.findById(session.order_id, restaurantId);
  let finalOrder = order;

  if (order) {
    const sessionPaidAmount = session.amount_cents / 100;
    const currentDue = order.totalDue !== undefined ? Number(order.totalDue) : (order.total || order.grand_total || 0);
    const newPaid = Number(((order.totalPaid || 0) + sessionPaidAmount).toFixed(2));
    const newDue = Number(Math.max(0, currentDue - sessionPaidAmount).toFixed(2));
    const paymentStatus = newDue <= 0.01 ? 'paid' : 'partially_paid';

    const updateFields: any = {
      totalPaid: newPaid,
      totalDue: newDue,
      paymentStatus
    };
    if (paymentStatus === 'paid') {
      updateFields.status = 'paid';
    }
    finalOrder = await OrderRepository.update(order._id || order.id, restaurantId, updateFields);
    console.log(`[Payment] Order ${order._id || order.id} updated. Paid: $${newPaid}, Due: $${newDue}, Status: ${paymentStatus}`);
  }

  broadcastPaymentUpdate(updated);
  sseService.broadcast({ type: 'order_paid', orderId: session.order_id, order: finalOrder });

  res.status(200).json({ success: true, session: updated });
});

// ── POST /api/payment-sessions/:id/failed ────────────────────────────────
// iPhone reports Square payment declined or errored.
router.post('/:id/failed', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  if (session.status === 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'Cannot fail a completed payment' });
  }
  if (TERMINAL_STATUSES.includes(session.status)) {
    return res.status(200).json({ success: true, session }); // idempotent
  }

  const { error_code, error_message } = req.body;
  const updated = await PaymentRepository.updateSession(session._id, {
    status: 'FAILED',
    error_code: error_code || 'UNKNOWN_ERROR',
    error_message: error_message || 'Payment failed'
  });

  if (!updated) return res.status(500).json({ success: false, message: 'Failed to update session' });

  console.log(`[Payment] Session ${session._id} FAILED: ${error_code} — ${error_message}`);
  broadcastPaymentUpdate(updated);
  res.status(200).json({ success: true, session: updated });
});

// ── POST /api/payment-sessions/:id/cancel ────────────────────────────────
// iPad or iPhone cancels a pending payment (cannot cancel COMPLETED).
router.post('/:id/cancel', async (req, res) => {
  const session = await PaymentRepository.getSession(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  if (session.status === 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'Cannot cancel a completed payment' });
  }
  if (session.status === 'CANCELED') {
    return res.status(200).json({ success: true, session }); // idempotent
  }

  const updated = await PaymentRepository.updateSession(session._id, { status: 'CANCELED' });
  if (!updated) return res.status(500).json({ success: false, message: 'Failed to cancel session' });

  console.log(`[Payment] Session ${session._id} CANCELED`);
  broadcastPaymentUpdate(updated);
  res.status(200).json({ success: true, session: updated });
});

export default router;
