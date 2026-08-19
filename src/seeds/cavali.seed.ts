/**
 * Cavali Venue Development Seed Data
 *
 * This file contains the seed data for Cavali Hookah Lounge & Bar.
 * It is DATA, not application logic. It is loaded via seed commands when
 * initializing a new Cavali instance.
 */

export const CAVALI_VENUE_SEED = {
  organization: {
    name: 'Cavali Hospitality Group',
    slug: 'cavali-group',
  },
  restaurant: {
    _id: 'RES_EED4E9D266DF',
    slug: 'cavali',
    restaurant_code: '4821',
    name: 'Cavali Hookah Lounge',
    branding: {
      primary_color: '#FF5A1F',
      secondary_color: '#E5B13A',
      accent_color: '#14B8A6',
      background_color: '#0E0A08',
      card_color: '#1C1411',
      text_color: '#F8F1EA',
      muted_color: '#948375',
      logo_url: null,
      font_family: 'ui-rounded',
    },
    settings: {
      currency: 'USD',
      timezone: 'America/Chicago',
      tax_config: {
        default_rate: 0.0825,
        category_rates: {
          hookah: 0.0825,
          food: 0.0825,
          drinks: 0.0825,
        },
      },
      auto_accept_orders: true,
      require_table_number: true,
      enable_tips: true,
      tip_options: [15, 18, 20, 25],
      enable_split_payment: true,
      session_timeout_minutes: 120,
      payment_provider: 'square',
      payment_credentials: {},
    },
    active: true,
  },
  defaultStaff: [
    { name: 'Manager / Owner', email: 'manager@cavalli.com', role: 'manager', pin: '1234', position: 'General Manager', rate: 30 },
    { name: 'Suzi', email: 'server@cavalli.com', role: 'server', pin: '1234', position: 'Head Server', rate: 15 },
    { name: 'Chef Kenji', email: 'chief@cavalli.com', role: 'chef', pin: '1234', position: 'Head Chef', rate: 25 },
    { name: 'Alex Rivera', email: 'bar@cavalli.com', role: 'bartender', pin: '1234', position: 'Lead Mixologist', rate: 22.5 },
    { name: 'Samir Hookah Master', email: 'hookah@cavalli.com', role: 'hookah_maker', pin: '1234', position: 'Lounge Master', rate: 20 },
  ],
};
