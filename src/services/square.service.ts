/**
 * Square Payment Service
 *
 * DEMO MODE (default when SQUARE_DEMO_MODE is not explicitly 'false'):
 *   - verifyPayment() always returns { valid: true }
 *   - No real Square API calls are made
 *   - A clearly labelled demo payment ID is generated
 *
 * PRODUCTION MODE (SQUARE_DEMO_MODE=false + real credentials):
 *   - Makes a server-side call to Square Payments API to verify the payment
 *   - Checks status, amount, and currency before marking an order paid
 */
export class SquareService {

  static get isDemoMode(): boolean {
    return process.env.SQUARE_DEMO_MODE !== 'false';
  }

  static get environment(): string {
    return process.env.SQUARE_ENVIRONMENT || 'sandbox';
  }

  /**
   * Generate a demo payment ID for DEMO MODE.
   * Never used in production — always labelled "DEMO".
   */
  static generateDemoPaymentId(): string {
    return `DEMO-PAY-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }

  /**
   * Verify a Square payment server-side before marking an order as paid.
   *
   * In DEMO MODE: always returns valid = true without any API call.
   * In PRODUCTION: calls Square Payments API and checks amount + currency.
   */
  static async verifyPayment(
    squarePaymentId: string,
    expectedAmountCents: number,
    currency: string
  ): Promise<{ valid: boolean; error?: string; paymentDetails?: any }> {

    if (this.isDemoMode) {
      console.log(`[DEMO] Square verification bypassed. Payment ID: ${squarePaymentId}, Amount: ${expectedAmountCents} ${currency}`);
      return {
        valid: true,
        paymentDetails: {
          id: squarePaymentId,
          status: 'COMPLETED',
          amount_money: { amount: expectedAmountCents, currency },
          demo: true,
          note: 'DEMO MODE — no real Square payment occurred'
        }
      };
    }

    // ── Real Square server-side verification ──────────────────────────────
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId  = process.env.SQUARE_LOCATION_ID;

    if (!accessToken || !locationId) {
      console.error('[Square] Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID');
      return { valid: false, error: 'Square credentials not configured on server' };
    }

    const baseUrl = this.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    try {
      const response = await fetch(`${baseUrl}/v2/payments/${squarePaymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18'
        }
      });

      if (!response.ok) {
        return { valid: false, error: `Square API returned HTTP ${response.status}` };
      }

      const data = await response.json() as any;
      const payment = data.payment;

      if (!payment) return { valid: false, error: 'Payment not found in Square' };
      if (payment.status !== 'COMPLETED') return { valid: false, error: `Payment status is ${payment.status}, expected COMPLETED` };
      if (payment.amount_money?.amount !== expectedAmountCents) return { valid: false, error: `Amount mismatch: Square has ${payment.amount_money?.amount}, expected ${expectedAmountCents}` };
      if (payment.amount_money?.currency !== currency) return { valid: false, error: `Currency mismatch: Square has ${payment.amount_money?.currency}` };
      if (payment.location_id && locationId && payment.location_id !== locationId) return { valid: false, error: 'Payment location does not match restaurant location' };

      return { valid: true, paymentDetails: payment };
    } catch (err: any) {
      console.error('[Square] Verification error:', err.message);
      return { valid: false, error: `Square API call failed: ${err.message}` };
    }
  }
}
