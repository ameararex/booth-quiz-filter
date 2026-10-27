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
    const snapshot = order === 'source' ? undefined : sorts?.[order];
    if (!snapshot) return products;
    const byId = new Map(products.map((product) => [product.id, product]));
    return snapshot.ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
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
