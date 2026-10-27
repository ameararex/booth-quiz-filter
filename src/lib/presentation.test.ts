import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortProducts, thumbnailFor } from './presentation.ts';
import type { Product } from './catalog.ts';

const products: Product[] = ['001', '002', '004'].map((id) => ({ id: `sample-item-${id}`, name: '商品', shopId: 'shop', shopName: '店', priceLabel: '無料', url: null }));

test('仮の人気順はサンプルにだけ適用し、元配列と実データの取得順を変えない', () => {
  assert.equal(sortProducts(products, 'sample', 'popular')[0].id, 'sample-item-004');
  assert.equal(products[0].id, 'sample-item-001');
  assert.deepEqual(sortProducts(products, 'live', 'popular'), products);
  assert.deepEqual(sortProducts(products, 'sample', 'new'), products);
});

test('仮表紙は既知のサンプルIDだけに表示し、実商品や未知IDへ流用しない', () => {
  assert.equal(thumbnailFor(products[0], 'sample'), '/sample-covers/spring.svg');
  assert.equal(thumbnailFor(products[0], 'live'), null);
  assert.equal(thumbnailFor({ ...products[0], id: 'unknown' }, 'sample'), null);
});
