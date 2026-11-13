import { SHOP_CATEGORIES } from './gearCatalog';

interface Filterable {
  shop_name: string | null;
  gear_tags?: string[];
}

export interface ShopFilter {
  /** A SHOP_CATEGORIES key, or null for everything. */
  category: string | null;
  /** A shop name, or null for every shop. */
  shop: string | null;
}

function inCategory(product: Filterable, category: string): boolean {
  const items: readonly string[] = SHOP_CATEGORIES.find((c) => c.key === category)?.items ?? [];
  return (product.gear_tags ?? []).some((tag) => items.includes(tag));
}

export function filterProducts<T extends Filterable>(products: T[], filter: ShopFilter): T[] {
  return products.filter(
    (p) => (!filter.category || inCategory(p, filter.category)) && (!filter.shop || p.shop_name === filter.shop),
  );
}

/** Categories that have at least one product (in the selected shop, if any), in catalog order. */
export function availableCategories(products: Filterable[], shop: string | null = null) {
  const pool = shop ? products.filter((p) => p.shop_name === shop) : products;
  return SHOP_CATEGORIES.filter((c) => pool.some((p) => inCategory(p, c.key)));
}

/** Shop names, the ones with most products first. */
export function shopNames(products: Filterable[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const name = p.shop_name?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}
