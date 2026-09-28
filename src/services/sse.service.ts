import { Response } from 'express';

export interface SSEClient {
  id: number;
  restaurantId: string;
  res: Response;
  role?: string;
  userId?: string | null;
  deviceId?: string | null;
  trackingOrderId?: string | null;
  trackingExpiresAt?: string | null;
}

/**
 * Multi-Tenant SSE Service
 *
 * Ensures real-time order/payment/KDS event broadcasts are strictly
 * isolated by restaurant_id and customer tracking capabilities.
 */
class SSEService {
  private clients: SSEClient[] = [];

  addClient(client: SSEClient) {
    this.clients.push(client);
  }

  removeClient(id: number) {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  /**
   * Broadcast an event strictly to clients of the matching restaurant.
   * If restaurantId is not provided, tries to read event.restaurant_id.
   * Enforces 2-hour customer tracking expiration and customer order isolation.
   */
  broadcast(event: any, restaurantId?: string) {
    const targetRestaurantId = restaurantId || event.restaurant_id || event.restaurantId;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    const now = Date.now();

    this.clients.forEach(client => {
      // 1. Enforce 2-hour server-side expiration for customer tracking clients
      if (client.trackingExpiresAt) {
        const expTime = new Date(client.trackingExpiresAt).getTime();
        if (now > expTime) {
          try {
            client.res.write(`data: ${JSON.stringify({ type: 'tracking_expired', orderId: client.trackingOrderId, message: 'Tracking access expired (2-hour limit reached)' })}\n\n`);
            client.res.end();
          } catch (_) {}
          this.removeClient(client.id);
          return;
        }
      }

      // 2. Strict Customer Tracking Isolation: customers only receive events for their specific order
      if (client.trackingOrderId) {
        const eventOrderId = event.orderId || event.order?.id || event.order?._id || event.id || event._id;
        if (eventOrderId !== client.trackingOrderId) {
          return; // Skip unauthorized event for this customer
        }
      }

      // 3. Multi-tenant isolation — only deliver if matching client restaurant
      if (targetRestaurantId && client.restaurantId) {
        const isMatch = client.restaurantId === targetRestaurantId ||
          client.role === 'platform_admin' ||
          (client.restaurantId === 'RES_EED4E9D266DF' && (targetRestaurantId === 'cavali' || targetRestaurantId === 'cavalli' || targetRestaurantId === '4821')) ||
          (targetRestaurantId === 'RES_EED4E9D266DF' && (client.restaurantId === 'cavali' || client.restaurantId === 'cavalli' || client.restaurantId === '4821'));

        if (!isMatch) {
          return; // Tenant isolation — skip other restaurants
        }
      }

      try {
        client.res.write(data);
      } catch (_) {
        // Client disconnected — handled by req.on('close')
      }
    });
  }

  getClientCount(restaurantId?: string): number {
    if (!restaurantId) return this.clients.length;
    return this.clients.filter(c => c.restaurantId === restaurantId).length;
  }
}

// Singleton shared across all routes
export const sseService = new SSEService();
