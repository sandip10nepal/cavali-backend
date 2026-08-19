/**
 * Station Repository — KDS Station Routing Configuration
 */

export interface Station {
  _id: string;
  restaurant_id: string;
  name: string;           // e.g. "Kitchen", "Bar", "Hookah Lounge", "Dessert Prep"
  code: string;           // e.g. "KITCHEN", "BAR", "HOOKAH"
  categories: string[];   // Categories assigned to this station
  active: boolean;
}

const DEFAULT_STATIONS: Station[] = [
  { _id: 'stn-kitchen', restaurant_id: 'RES_EED4E9D266DF', name: 'Main Kitchen', code: 'KITCHEN', categories: ['appetizers', 'mains', 'burgers', 'wraps', 'wings', 'vegetarian', 'continental'], active: true },
  { _id: 'stn-bar', restaurant_id: 'RES_EED4E9D266DF', name: 'Bar & Refreshers', code: 'BAR', categories: ['drinks_refreshers', 'drinks_tea_coffee', 'drinks_soft'], active: true },
  { _id: 'stn-hookah', restaurant_id: 'RES_EED4E9D266DF', name: 'Hookah Prep Station', code: 'HOOKAH', categories: ['hookah'], active: true },
];

export class StationRepository {
  static async listByRestaurant(restaurantId: string): Promise<Station[]> {
    return DEFAULT_STATIONS.map(s => ({ ...s, restaurant_id: restaurantId }));
  }
}
