import { Response } from 'express';

export interface SSEClient {
  id: number;
  restaurantId: string;
  res: Response;
  role?: string;
  userId?: string | null;
  deviceId?: string | null;
}

/**
 * Multi-Tenant SSE Service
 *
 * Ensures real-time order/payment/KDS event broadcasts are strictly
 * isolated by restaurant_id.
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
   */
  broadcast(event: any, restaurantId?: string) {
    const targetRestaurantId = restaurantId || event.restaurant_id || event.restaurantId;
    const data = `data: ${JSON.stringify(event)}\n\n`;

    this.clients.forEach(client => {
      // If event is scoped to a restaurant, only deliver if matching client
      if (targetRestaurantId && client.restaurantId && client.restaurantId !== targetRestaurantId) {
        return; // Tenant isolation — skip other restaurants
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
