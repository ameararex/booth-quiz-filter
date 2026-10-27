import type { Catalog, Product } from './catalog.ts';

export type SortOrder = 'source' | 'new' | 'popularity' | 'wish_lists' | 'price_desc' | 'price_asc';
// 架空データの操作確認用。実データの公開日・人気度を表す値ではない。
const popularIds = ['004', '002', '007', '001', '008', '005', '003', '006'].map((id) => `sample-item-${id}`);
const covers: Record<string, string> = {
  'sample-item-001': 'spring', 'sample-item-002': 'questions', 'sample-item-003': 'puzzle',
  'sample-item-004': 'open', 'sample-item-005': 'daily', 'sample-item-006': 'puzzle',
  'sample-item-007': 'literature', 'sample-item-008': 'open',
};

export function thumbnailFor(product: Product, mode: Catalog['mode']): string | null {
  if (mode === 'live') return product.thumbnailUrl ?? null;
  return mode === 'sample' && covers[product.id] ? `/sample-covers/${covers[product.id]}.svg` : null;
}

export function sortProducts(products: Product[], mode: Catalog['mode'], order: SortOrder, sorts?: Catalog['sorts']): Product[] {
  if (mode === 'live') {
    const snapshot = sorts?.new;
    const byId = new Map(products.map((product) => [product.id, product]));
    const source = snapshot ? snapshot.ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product)) : [...products];
    if (order === 'wish_lists' || order === 'price_asc' || order === 'price_desc') {
      const field = order === 'wish_lists' ? 'likes' : 'priceYen';
      const direction = order === 'price_asc' ? 1 : -1;
      return source.sort((a, b) => {
        const left = a[field], right = b[field];
        if (left == null) return right == null ? 0 : 1;
        if (right == null) return -1;
        return direction * (left - right);
      });
    }
    return source;
  }
  if (order === 'source' || order === 'new') return products;
  const sampleOrders = {
    popularity: popularIds,
    wish_lists: ['002', '004', '001', '007', '005', '008', '003', '006'].map((id) => `sample-item-${id}`),
    price_desc: ['004', '001', '008', '002', '006', '003', '005', '007'].map((id) => `sample-item-${id}`),
    price_asc: ['005', '003', '006', '002', '008', '001', '004', '007'].map((id) => `sample-item-${id}`),
  };
  const ranks = new Map(sampleOrders[order].map((id, rank) => [id, rank]));
  return [...products].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
}
