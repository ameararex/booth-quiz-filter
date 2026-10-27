import type { Catalog, Product } from './catalog.ts';

export type SortOrder = 'source' | 'new' | 'popular';
// 架空データの操作確認用。実データの公開日・人気度を表す値ではない。
const popularIds = ['004', '002', '007', '001', '008', '005', '003', '006'].map((id) => `sample-item-${id}`);
const covers: Record<string, string> = {
  'sample-item-001': 'spring', 'sample-item-002': 'questions', 'sample-item-003': 'puzzle',
  'sample-item-004': 'open', 'sample-item-005': 'daily', 'sample-item-006': 'puzzle',
  'sample-item-007': 'literature', 'sample-item-008': 'open',
};

export function thumbnailFor(product: Product, mode: Catalog['mode']): string | null {
  return mode === 'sample' && covers[product.id] ? `/sample-covers/${covers[product.id]}.svg` : null;
}

export function sortProducts(products: Product[], mode: Catalog['mode'], order: SortOrder): Product[] {
  if (mode !== 'sample' || order !== 'popular') return products;
  const ranks = new Map(popularIds.map((id, rank) => [id, rank]));
  return [...products].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
}
