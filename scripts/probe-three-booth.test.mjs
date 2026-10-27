import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSearchProducts, parseLikes } from './search-collection.mjs';

const page = (ids, next = '') => `<h1>クイズ</h1>${ids.map(id => `<li class="item-card" data-product-id="${id}" data-product-brand="test-shop" data-product-price="150"><div class="item-card__title"><a href="https://booth.pm/ja/items/${id}">問題集</a></div><a class="item-card__shop-name-anchor" href="https://test-shop.booth.pm/"><span class="item-card__shop-name">店</span></a><div class="price">¥ 150~</div></li>`).join('')}${next ? `<a rel="next" href="${next}">次</a>` : ''}`;
const next = (n) => `?sort=new&page=${n}`;
const cached = (html) => ({ html, fetchedAt: '2026-10-27T00:00:00Z' });
const readLikes = async (ids) => ({ item_ids: ['not-collected'], wishlists_counts: Object.fromEntries(ids.map(id => [id, 31])) });

test('キーワード検索の新着順を保持し、価格・一括スキ数を保存する。欠損を0と推測しない', async () => {
  const result = await collectSearchProducts({ readPage: async (_url, n) => cached(page(n === 1 ? ['3', '1'] : ['2'], n === 1 ? next(2) : '')), readLikes });
  assert.deepEqual(result.snapshot.ids, ['3', '1', '2']);
  assert.equal(result.snapshot.hasMore, false);
  assert.equal(result.products[0].likes, 31);
  assert.equal(result.products[0].priceYen, 150);
  assert.equal('item_ids' in result.products[0], false);
  assert.deepEqual([...parseLikes({ wishlists_counts: { '1': 0 } }, ['1', '2'])], [['1', 0], ['2', null]]);
  assert.throws(() => parseLikes({ wishlists_counts: { '1': -1 } }, ['1']));
});

test('3ページ検証は部分取得として返し、検索条件の変化・反復・スキ取得失敗で停止する', async () => {
  const partial = await collectSearchProducts({ pageLimit: 3, readPage: async (_url, n) => cached(page([String(n)], next(n + 1))), readLikes });
  assert.equal(partial.snapshot.hasMore, true);
  assert.equal(partial.snapshot.pageCount, 3);
  await assert.rejects(collectSearchProducts({ readPage: async () => cached(page(['1'], '?sort=new&page=2&tags[]=別タグ')), readLikes }), /検索条件/);
  await assert.rejects(collectSearchProducts({ readPage: async (_url,n) => cached(page(['1'], next(n+1))), readLikes }), /繰り返/);
  await assert.rejects(collectSearchProducts({ readPage: async () => cached(page(['1'])), readLikes: async () => { throw new Error('403'); } }), /403/);
});

test('6,500件・100ページを超えても固定件数では停止しない', async () => {
  const result = await collectSearchProducts({ readPage: async (_url, n) => {
    const first = (n - 1) * 60 + 1;
    const ids = Array.from({ length: Math.min(60, 6501 - first + 1) }, (_, i) => String(first + i));
    return cached(page(ids, first + ids.length <= 6501 ? next(n + 1) : ''));
  }, readLikes });
  assert.equal(result.products.length, 6501);
  assert.equal(result.snapshot.hasMore, false);
});