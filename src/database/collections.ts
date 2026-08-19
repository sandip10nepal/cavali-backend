/**
 * MongoDB Collection Names & Identifiers
 */

export const COLLECTIONS = {
  restaurants: 'restaurants',
  users: 'users',
  devices: 'devices',
  device_activation_codes: 'device_activation_codes',
  tables: 'tables',
  menu_categories: 'menu_categories',
  menu_items: 'menu_items',
  orders: 'orders',
  inventory_items: 'inventory_items',
  inventory_transactions: 'inventory_transactions',
  payment_sessions: 'payment_sessions',
  audit_logs: 'audit_logs',
  customer_sessions: 'customer_sessions',
  credits: 'credits',
  timecards: 'timecards',
  service_requests: 'service_requests',
  stations: 'stations',
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
