/**
 * Every item the "What to bring" list can contain. The keys are shared with the shop:
 * `products.gear_tags` holds the keys a product covers, so a checklist item can link to it and
 * the shop can filter by category. The admin panel keeps the same list in
 * `web/src/lib/gear.ts` (a web test compares the two) — add keys in both places.
 */
export const GEAR_ITEMS = {
  // Footwear
  hiking_boots: { label: 'Hiking boots', icon: 'footsteps-outline' },
  trail_shoes: { label: 'Trail shoes', icon: 'footsteps-outline' },
  river_shoes: { label: 'Sandals for river crossings', icon: 'water-outline' },
  hiking_socks: { label: 'Hiking socks', icon: 'footsteps-outline' },
  // Clothing
  rain_jacket: { label: 'Rain jacket', icon: 'umbrella-outline' },
  warm_layer: { label: 'Warm layer', icon: 'shirt-outline' },
  hat_gloves: { label: 'Warm hat and gloves', icon: 'snow-outline' },
  quick_dry_clothes: { label: 'Quick-dry clothes', icon: 'shirt-outline' },
  sun_protection: { label: 'Sun protection', icon: 'sunny-outline' },
  // Packs
  daypack: { label: 'Daypack', icon: 'bag-handle-outline' },
  backpack: { label: 'Large backpack', icon: 'bag-outline' },
  // Camping
  tent: { label: 'Tent', icon: 'home-outline' },
  sleeping_bag: { label: 'Sleeping bag', icon: 'bed-outline' },
  sleeping_mat: { label: 'Sleeping mat', icon: 'bed-outline' },
  stove: { label: 'Stove and pot', icon: 'flame-outline' },
  // Equipment
  trekking_poles: { label: 'Trekking poles', icon: 'walk-outline' },
  headlamp: { label: 'Headlamp', icon: 'flashlight-outline' },
  power_bank: { label: 'Power bank', icon: 'battery-charging-outline' },
  water: { label: 'Water', icon: 'water-outline' },
  water_filter: { label: 'Water filter', icon: 'funnel-outline' },
  knife: { label: 'Knife or multitool', icon: 'construct-outline' },
  // Safety
  first_aid: { label: 'First-aid kit', icon: 'medkit-outline' },
  helmet: { label: 'Helmet', icon: 'shield-outline' },
  microspikes: { label: 'Microspikes', icon: 'snow-outline' },
  // Not sold in the shop
  food: { label: 'Food', icon: 'fast-food-outline' },
  offline_map: { label: 'Offline map', icon: 'map-outline' },
  passport: { label: 'Passport', icon: 'card-outline' },
  cash: { label: 'Cash', icon: 'cash-outline' },
  insect_repellent: { label: 'Insect and tick repellent', icon: 'bug-outline' },
  rubbish_bag: { label: 'Rubbish bag', icon: 'trash-outline' },
} as const;

export type GearKey = keyof typeof GEAR_ITEMS;

/** Shop filter groups. Only these keys may appear in `products.gear_tags`. */
export const SHOP_CATEGORIES: { key: string; label: string; items: GearKey[] }[] = [
  { key: 'footwear', label: 'Footwear', items: ['hiking_boots', 'trail_shoes', 'river_shoes', 'hiking_socks'] },
  {
    key: 'clothing',
    label: 'Clothing',
    items: ['rain_jacket', 'warm_layer', 'hat_gloves', 'quick_dry_clothes', 'sun_protection'],
  },
  { key: 'packs', label: 'Backpacks', items: ['daypack', 'backpack'] },
  { key: 'camping', label: 'Camping', items: ['tent', 'sleeping_bag', 'sleeping_mat', 'stove'] },
  {
    key: 'equipment',
    label: 'Equipment',
    items: ['trekking_poles', 'headlamp', 'power_bank', 'water', 'water_filter', 'knife'],
  },
  { key: 'safety', label: 'Safety', items: ['first_aid', 'helmet', 'microspikes'] },
];

export const PRODUCT_GEAR_KEYS: GearKey[] = SHOP_CATEGORIES.flatMap((c) => c.items);

export function isGearKey(value: unknown): value is GearKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GEAR_ITEMS, value);
}

/** The shop category a gear key belongs to, if it is sold at all. */
export function shopCategoryOf(key: GearKey): string | null {
  return SHOP_CATEGORIES.find((c) => c.items.includes(key))?.key ?? null;
}
