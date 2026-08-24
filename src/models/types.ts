/**
 * Multi-Tenant Restaurant SaaS — Shared Types & Enums
 *
 * Central type definitions used across all models and services.
 */

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              ENUMS & CONSTANTS                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export type UserRole = 'platform_admin' | 'owner' | 'manager' | 'cashier' | 'kitchen' | 'server' | 'chef' | 'bartender' | 'hookah_maker';

export type DeviceStatus = 'paired' | 'unpaired' | 'disabled';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'CREATED'
  | 'PAYMENT_REQUESTED'
  | 'CLAIMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED';

export type PaymentMethod = 'cash' | 'card' | 'split';

export type AuditAction =
  | 'employee_added'
  | 'employee_deactivated'
  | 'employee_deleted'
  | 'timecard_clock_in'
  | 'timecard_clock_out'
  | 'timecard_updated'
  | 'timecard_deleted'
  | 'timecard_pruned'
  | 'timecard_archived'
  | 'menu_price_changed'
  | 'menu_item_created'
  | 'menu_item_deleted'
  | 'menu_item_updated'
  | 'inventory_adjusted'
  | 'inventory_transaction'
  | 'credit_issued'
  | 'credit_redeemed'
  | 'refund_initiated'
  | 'restaurant_setting_changed'
  | 'device_paired'
  | 'device_configured'
  | 'device_activated'
  | 'device_revoked'
  | 'device_updated'
  | 'device_unpaired'
  | 'order_created'
  | 'order_status_changed'
  | 'payment_processed'
  | 'login_failed'
  | 'account_locked'
  | 'marketing_demo_request';

export type RestaurantCapability =
  | 'kitchen'
  | 'bar'
  | 'hookah'
  | 'tables'
  | 'takeout'
  | 'delivery'
  | 'customer_ordering'
  | 'payments'
  | 'inventory';

export interface Lead {
  _id: string;
  name: string;
  restaurant_name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  status: 'new' | 'contacted' | 'demo_scheduled' | 'qualified' | 'converted' | 'closed';
  source: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           BRANDING & SETTINGS                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

export interface RestaurantBranding {
  primary_color: string;      // e.g. "#FF5A1F" (ember)
  secondary_color: string;    // e.g. "#E5B13A" (gold)
  accent_color: string;       // e.g. "#14B8A6" (teal)
  background_color: string;   // e.g. "#0E0A08" (night)
  card_color: string;         // e.g. "#1C1411"
  text_color: string;         // e.g. "#F8F1EA" (cream)
  muted_color: string;        // e.g. "#948375"
  logo_url: string | null;
  font_family: string;        // e.g. "ui-rounded"
}

export interface TaxConfig {
  default_rate: number;       // e.g. 0.0825 = 8.25%
  category_rates: Record<string, number>;  // category_id → rate override
}

export interface RestaurantSettings {
  currency: string;           // e.g. "USD"
  timezone: string;           // e.g. "America/Chicago"
  tax_config: TaxConfig;
  auto_accept_orders: boolean;
  require_table_number: boolean;
  enable_tips: boolean;
  tip_options: number[];      // e.g. [15, 18, 20, 25]
  enable_split_payment: boolean;
  session_timeout_minutes: number;  // auto-reset after inactivity
  capabilities?: RestaurantCapability[];
  payment_provider: 'square' | 'stripe' | 'none';
  payment_credentials: Record<string, string>;  // encrypted provider keys
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                              CORE MODELS                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

export interface Restaurant {
  _id: string;                // e.g. "RES_001"
  slug: string;               // URL-safe identifier, e.g. "cavali"
  restaurant_code: string;    // 4-digit fast floor login code, e.g. "4821"
  name: string;               // Display name, e.g. "Cavali Hookah Lounge"
  branding: RestaurantBranding;
  settings: RestaurantSettings;
  retention_days?: number;    // Automated timecard retention in days (default 180)
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  _id: string;
  restaurant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  position?: string;          // e.g. "Lead Bartender", "Server"
  hourly_rate?: number;       // hourly wage rate in USD
  pin_hash: string;           // bcrypt / PBKDF2 hash of PIN
  failed_login_attempts?: number; // Failed PIN tracking for rate limiting
  locked_until?: string | null;   // Lockout timestamp if brute-force triggered
  token_version?: number;         // Incremented to invalidate all active sessions
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Timecard {
  _id: string;                // e.g. "TC_001"
  restaurant_id: string;      // Tenant isolation
  user_id: string;            // Reference to User._id
  employee_name: string;      // Snapshot of employee name
  role: UserRole;             // Shift position/role
  hourly_rate?: number;       // Hourly rate during shift
  clock_in: string;           // ISO 8601 timestamp
  clock_out: string | null;   // ISO 8601 timestamp or null if currently active
  total_minutes?: number;     // Elapsed minutes
  total_hours?: number;       // Elapsed decimal hours (e.g. 7.50)
  notes?: string;             // Shift or manager notes
  status: 'active' | 'completed' | 'auto_closed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  reason: string;
  items: any[];
  isFullRefund: boolean;
  issuedBy: string;
  createdAt: string;
}

export type DeviceType = 'customer_table' | 'kitchen' | 'bar' | 'hookah' | 'server' | 'admin';
export type DeviceLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'OFFLINE' | 'PENDING_ACTIVATION';

export interface Device {
  _id: string;
  restaurant_id: string;
  table_id?: string;
  station_id?: string;
  device_token: string;       // Unique token for device auth
  device_name: string;        // e.g. "iPad Table 7"
  device_type: DeviceType;    // Station type
  status: DeviceLifecycleStatus;
  last_seen_at: string;
  app_version?: string;
  os_version?: string;
  last_activity?: string;
  paired_at: string;
  created_at: string;
}

export interface DeviceActivationCode {
  _id: string;
  restaurant_id: string;
  code: string;               // 6-digit random code, e.g. "739184"
  device_type: DeviceType;
  device_name?: string;
  table_id?: string;
  station_id?: string;
  expires_at: string;         // ISO 8601, typically 15 minutes expiry
  used: boolean;
  created_by: string;         // user_id of manager/owner
  created_at: string;
}

export interface InventoryTransaction {
  _id: string;
  restaurant_id: string;
  inventory_item_id: string;
  item_name: string;
  type: 'PURCHASE' | 'SALE_DEDUCTION' | 'WASTE' | 'MANUAL_ADJUSTMENT' | 'TRANSFER' | 'RETURN' | 'CORRECTION';
  quantity_change: number;    // negative for deductions, positive for restock
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  order_id?: string;
  user_id?: string;
  device_id?: string;
  timestamp: string;
}

export interface RestaurantTable {
  _id: string;
  restaurant_id: string;
  number: number;
  label: string;              // e.g. "Patio 3", "VIP Booth"
  capacity: number;
  active: boolean;
  created_at: string;
}

export interface MenuCategory {
  _id: string;
  restaurant_id: string;
  parent_id?: string | null;    // null = Super Category, string = Sub Category
  name?: string;               // Canonical category name
  description?: string;        // Category description
  title?: string;              // Backward-compatible title getter/setter
  subtitle?: string;           // Backward-compatible subtitle
  icon?: string;               // Emoji icon
  color?: string;              // Hex color
  sort_order: number;
  menu_type?: string;          // Backward-compatible slug ('food', 'drinks', 'hookah')
  is_super?: boolean;          // Backward-compatible flag
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuRecipeIngredient {
  ingredient_id: string;
  quantity: number;
  unit: string;
}

export interface MenuItemModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  available?: boolean;
  sort_order?: number;
}

export interface MenuItemModifierGroup {
  id: string;
  name: string;
  min_selections?: number;
  max_selections: number;
  required: boolean;
  sort_order?: number;
  options: MenuItemModifierOption[];
}

export type ModifierGroup = MenuItemModifierGroup;

export interface MenuItemVariant {
  _id: string;
  menu_item_id: string;
  name: string;
  price: number;
  available: boolean;
  sort_order: number;
}

export interface MenuItemModel {
  _id: string;
  restaurant_id: string;
  category_id: string;         // MUST point to a Sub Category
  category?: string;           // Backward-compatible category link / title
  name: string;
  description?: string;
  desc?: string;
  price: number;
  emoji?: string;
  image_url?: string | null;
  available: boolean;          // Ordering availability toggle
  active?: boolean;            // Soft delete flag
  modifier_groups?: MenuItemModifierGroup[] | ModifierGroup[];
  variants?: MenuItemVariant[];
  sort_order: number;
  recipe?: MenuRecipeIngredient[] | any[];
  ingredient_id?: string;
  ingredient_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;         // price at time of order (authoritative)
  modifiers: { group_name: string; option_name: string; price: number }[];
  special_notes: string;
  line_total: number;
}

export interface Order {
  _id: string;
  restaurant_id: string;
  table_id: string;
  device_id: string;
  session_id: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  tip_amount: number;
  discount_amount: number;
  grand_total: number;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_session_id: string | null;
  idempotency_key?: string;
  client_order_id?: string;
  notes: string;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
}

export interface InventoryItem {
  _id: string;
  restaurant_id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  low_threshold: number;
  reorder_threshold?: number;
  cost_per_unit?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentSession {
  _id: string;
  restaurant_id: string;
  order_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  idempotency_key: string;
  provider_payment_id: string | null;
  payment_device_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Credit {
  _id: string;
  restaurant_id: string;
  customer_phone: string;
  amount: number;
  balance: number;
  reason: string;
  reference: string;
  issued_by: string;
  created_at: string;
  expires_at: string | null;
}

export interface AuditLog {
  _id: string;
  restaurant_id: string;
  actor_id: string;
  actor_name: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface CustomerSession {
  _id: string;
  restaurant_id: string;
  device_id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  started_at: string;
  ended_at: string | null;
  order_ids: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                           TENANT CONTEXT                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Attached to every authenticated request by the tenant middleware.
 * The backend derives this from JWT claims — never from client input.
 */
export interface TenantContext {
  restaurant_id: string;
  user_id: string | null;       // null for device-only auth
  device_id: string | null;     // null for admin/staff auth
  table_id: string | null;
  role: UserRole | 'device';
  restaurant_name: string;
}
