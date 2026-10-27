import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSortPages } from './booth-pagination.mjs';

function html(id, next = '') {
  return `<h1>クイズ</h1><li class="item-card" data-product-id="${id}" data-product-brand="sample"><div class="item-card__title"><a href="https://booth.pm/ja/items/${id}">問題集</a></div><a class="item-card__shop-name-anchor" href="https://sample.booth.pm/"><span class="item-card__shop-name">店</span></a><div class="price">¥ 100</div></li>${next ? `<a rel="next" href="${next}">次</a>` : ''}`;
}
const cache = (html) => ({ html, fetchedAt: '2026-10-27T10:00:00Z' });

test('最後のページまで取得した順序とページ数を保持する', async () => {
  const pages = [];
  const result = await collectSortPages({ key: 'new', label: '新着順', readPage: async (_url, page) => {
    pages.push(page); return cache(html(String(page), page === 1 ? '?sort=new&page=2' : ''));
  } });
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(result.snapshot.ids, ['1', '2']);
  assert.equal(result.snapshot.hasMore, false);
  assert.equal(result.snapshot.pageCount, 2);
});

test('繰り返し・異常な次ページ・途中失敗では完了結果を返さない', async () => {
  const options = { key: 'new', label: '新着順' };
  await assert.rejects(collectSortPages({ ...options, readPage: async () => cache(html('1', '?sort=new&page=2')) }), /繰り返/);
  await assert.rejects(collectSortPages({ ...options, readPage: async () => cache(html('1', '?sort=popularity&page=2')) }), /不整合/);
  await assert.rejects(collectSortPages({ ...options, readPage: async (_url, page) => {
    if (page === 2) throw new Error('offline');
    return cache(html('1', '?sort=new&page=2'));
  } }), /offline/);
  await assert.rejects(collectSortPages({ ...options, maxPages: 1, readPage: async () => cache(html('1', '?sort=new&page=2')) }), /上限/);
});

test('人気順の次ページURLへsortを追加せず、他の順序のsort欠落は拒否する', async () => {
  const urls = [];
  await collectSortPages({ key: 'popularity', label: '人気順', readPage: async (url, page) => {
    urls.push(url); return cache(html(String(page), page === 1 ? '?page=2' : ''));
  } });
  assert.equal(new URL(urls[1]).searchParams.has('sort'), false);
  await assert.rejects(collectSortPages({ key: 'new', label: '新着順', readPage: async () => cache(html('1', '?page=2')) }), /不整合/);
});
