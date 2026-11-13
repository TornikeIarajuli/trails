import { availableCategories, filterProducts, shopNames } from '../../utils/shopFilters';

const products = [
  { id: 'boots', shop_name: 'CampShare', gear_tags: ['hiking_boots'] },
  { id: 'tent', shop_name: 'CampShare', gear_tags: ['tent'] },
  { id: 'lamp', shop_name: 'Mountain Shop', gear_tags: ['headlamp'] },
  { id: 'jacket', shop_name: 'Mountain Shop', gear_tags: ['rain_jacket', 'warm_layer'] },
  { id: 'untagged', shop_name: 'Mountain Shop' },
  { id: 'nameless', shop_name: null, gear_tags: ['tent'] },
];

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('shop filters', () => {
  it('shows everything without a filter', () => {
    expect(filterProducts(products, { category: null, shop: null })).toHaveLength(products.length);
  });

  it('filters by gear category and by shop, together', () => {
    expect(ids(filterProducts(products, { category: 'camping', shop: null }))).toEqual(['tent', 'nameless']);
    expect(ids(filterProducts(products, { category: 'clothing', shop: null }))).toEqual(['jacket']);
    expect(ids(filterProducts(products, { category: null, shop: 'Mountain Shop' }))).toEqual(['lamp', 'jacket', 'untagged']);
    expect(ids(filterProducts(products, { category: 'camping', shop: 'Mountain Shop' }))).toEqual([]);
    expect(filterProducts(products, { category: 'no-such-category', shop: null })).toEqual([]);
  });

  it('offers only categories that have products, in catalog order', () => {
    expect(availableCategories(products).map((c) => c.key)).toEqual(['footwear', 'clothing', 'camping', 'equipment']);
    expect(availableCategories(products, 'Mountain Shop').map((c) => c.key)).toEqual(['clothing', 'equipment']);
  });

  it('lists shops with the most products first', () => {
    expect(shopNames(products)).toEqual(['Mountain Shop', 'CampShare']);
  });
});
