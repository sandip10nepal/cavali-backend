/**
 * Mock Toast POS Service
 * 
 * Once Toast API access is granted, this module will be updated to:
 * 1. Fetch OAuth token
 * 2. POST the order to /orders/v2/orders endpoint
 */

export class ToastService {
  /**
   * Pretends to submit an order to Toast
   */
  static async submitOrder(orderData: any): Promise<{ success: boolean; toastOrderId?: string; error?: string }> {
    console.log('----------------------------------------------------');
    console.log('📡 [ToastService] Intercepted new order submission');
    console.log(JSON.stringify(orderData, null, 2));
    
    // Simulate network delay to Toast servers
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log('✅ [ToastService] Order successfully processed (MOCK)');
    console.log('----------------------------------------------------');

    return {
      success: true,
      toastOrderId: `toast-mock-${Date.now()}`
    };
  }
}
