/**
 * Order Domain Types & Enums
 */

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'partially_ready'
  | 'ready'
  | 'served'
  | 'fulfilled'
  | 'completed'
  | 'cancelled'
  | 'voided';

export type OrderItemStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export type OrderItemCategory = 'food' | 'drinks' | 'hookah' | 'other';

export interface OrderModifier {
  group_name: string;
  option_name: string;
  price_cents: number;
}

export interface OrderItem {
  id: string;
  menu_item_id?: string;
  name: string;
  category: OrderItemCategory;
  station_id?: string;
  qty: number;
  unit_price_cents: number;
  modifiers?: OrderModifier[];
  sauce?: string;
  flavor?: any;
  iceHose?: boolean;
  iceBase?: boolean;
  notes?: string;
  status: OrderItemStatus;
  line_total_cents: number;
}

export interface Order {
  _id: string;
  restaurant_id: string;
  table_id: string;
  device_id: string;
  session_id: string;
  customer_name: string;
  customer_phone?: string;
  items: OrderItem[];
  subtotal_cents: number;
  tax_amount_cents: number;
  tip_amount_cents: number;
  discount_amount_cents: number;
  grand_total_cents: number;
  total_paid_cents: number;
  total_due_cents: number;
  status: OrderStatus;
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'partial_refund';
  payment_method?: 'cash' | 'card' | 'split' | null;
  payment_session_id?: string | null;
  idempotency_key?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  fulfilledDepartments?: string[];
  taxExempt?: boolean;
  closedSession?: boolean;
}
