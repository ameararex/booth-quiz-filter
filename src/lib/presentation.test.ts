import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortProducts, thumbnailFor } from './presentation.ts';
import type { Product } from './catalog.ts';

const products: Product[] = ['001', '002', '004'].map((id) => ({ id: `sample-item-${id}`, name: '商品', shopId: 'shop', shopName: '店', priceLabel: '無料', url: null }));

test('仮の人気順はサンプルにだけ適用し、元配列と実データの取得順を変えない', () => {
  assert.equal(sortProducts(products, 'sample', 'popularity')[0].id, 'sample-item-004');
  assert.equal(products[0].id, 'sample-item-001');
  assert.deepEqual(sortProducts(products, 'live', 'popularity'), products);
  assert.deepEqual(sortProducts(products, 'sample', 'new'), products);
});

test('実データは選択中の取得済みIDの順序だけを使い、別の並び順の商品を混ぜない', () => {
  const sorts = { new: { label: '新着順', url: 'https://booth.pm/?sort=new', fetchedAt: '2026-10-27T00:00:00Z', pageCount: 1, hasMore: true, categoryTotal: 100, ids: [products[2].id, products[0].id] } };
  assert.deepEqual(sortProducts(products, 'live', 'new', sorts).map((product) => product.id), [products[2].id, products[0].id]);
});

test('仮表紙は既知のサンプルIDだけに表示し、実商品や未知IDへ流用しない', () => {
  assert.equal(thumbnailFor(products[0], 'sample'), '/sample-covers/spring.svg');
  assert.equal(thumbnailFor(products[0], 'live'), null);
  assert.equal(thumbnailFor({ ...products[0], id: 'unknown' }, 'sample'), null);
});

test('価格・スキは全て同じ新着取得範囲で計算し、同数は新着順、不明値は末尾', () => {
  const rows = products.map((p, i) => ({ ...p, priceYen: [100, 0, 100][i], likes: [31, null, 31][i] }));
  const sorts = { new: { label: '新着順', url: 'https://booth.pm/?sort=new', fetchedAt: '2026-10-27T00:00:00Z', pageCount: 1, hasMore: false, categoryTotal: 3, ids: [rows[2].id, rows[0].id, rows[1].id] } };
  assert.deepEqual(sortProducts(rows, 'live', 'price_asc', sorts).map(p => p.id), [rows[1].id, rows[2].id, rows[0].id]);
  assert.deepEqual(sortProducts(rows, 'live', 'price_desc', sorts).map(p => p.id), [rows[2].id, rows[0].id, rows[1].id]);
  assert.deepEqual(sortProducts(rows, 'live', 'wish_lists', sorts).map(p => p.id), [rows[2].id, rows[0].id, rows[1].id]);
});
