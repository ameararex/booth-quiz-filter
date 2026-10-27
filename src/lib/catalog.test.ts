import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boothUrl, parseCatalog, validThumbnail } from './catalog.ts';

const sample = JSON.parse(readFileSync(new URL('../../test-fixtures/catalog.sample.v1.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')) as unknown;

test('5,000件超を検証でき、価格・スキ数の不正値は拒否する', () => {
  const base = parseCatalog(sample);
  const products = Array.from({ length: 6001 }, (_, i) => ({ ...base.products[0], id: `large-${i}`, priceYen: 100, likes: 0 }));
  assert.equal(parseCatalog({ ...base, products }).products.length, 6001);
  for (const fields of [{ priceYen: -1 }, { likes: '31' }, { likes: 1.2 }]) assert.throws(() => parseCatalog({ ...base, products: [{ ...products[0], ...fields }] }));
});

test('BOOTHのHTTPS URLだけを許可する', () => {
  assert.equal(boothUrl('https://booth.pm/ja/items/123'), true);
  assert.equal(boothUrl('https://sample.booth.pm/items/123'), true);
  for (const url of ['javascript:alert(1)', 'https://booth.pm.evil.example/items/1', 'https://evil.example/booth.pm', 'http://booth.pm/items/1', 'https://user:pass@booth.pm/items/1', 'https://booth.pm:8080/items/1']) assert.equal(boothUrl(url), false);
});

test('画像URLと並び順の取得範囲・IDの整合性を検証する', () => {
  assert.equal(validThumbnail('https://booth.pximg.net/c/300x300_a2_g5/sample.jpg'), true);
  assert.equal(validThumbnail('https://evil.example/sample.jpg'), false);
  const parsed = parseCatalog(sample);
  const snapshot = { label: '新着順', url: 'https://booth.pm/ja/browse/quiz?sort=new', fetchedAt: '2026-10-27T00:00:00Z', pageCount: 1, hasMore: true, categoryTotal: 100, ids: [parsed.products[0].id] };
  assert.equal(parseCatalog({ ...parsed, sorts: { new: snapshot } }).sorts?.new?.ids.length, 1);
  assert.throws(() => parseCatalog({ ...parsed, sorts: { new: { ...snapshot, ids: ['missing'] } } }));
  assert.throws(() => parseCatalog({ ...parsed, sorts: { new: { ...snapshot, ids: [parsed.products[0].id, parsed.products[0].id] } } }));
  assert.throws(() => parseCatalog({ ...parsed, sorts: { new: { ...snapshot, url: 'https://booth.pm/?sort=price_asc' } } }));
});

test('架空データを正常に読み込み、取得日時・購入リンクは設けない', () => {
  const catalog = parseCatalog(sample);
  assert.equal(catalog.products.length, 8);
  assert.equal(catalog.mode, 'sample');
  assert.equal(catalog.fetchedAt, null);
  assert.ok(catalog.products.every((product) => product.url === null));
});

test('商品欠損・ID重複・不正URL・取得時刻不明の実データを拒否する', () => {
  const catalog = parseCatalog(sample);
  assert.throws(() => parseCatalog({ ...catalog, products: [{}] }));
  assert.throws(() => parseCatalog({ ...catalog, products: [catalog.products[0], catalog.products[0]] }));
  assert.throws(() => parseCatalog({ ...catalog, mode: 'live' }));
  const live = { ...catalog, mode: 'live', sourceUrl: 'https://booth.pm/ja', fetchedAt: '2026-10-27T00:00:00Z', products: [{ ...catalog.products[0], url: 'https://booth.pm/ja/items/123' }] };
  assert.equal(parseCatalog(live).products.length, 1);
  assert.throws(() => parseCatalog({ ...live, products: [{ ...live.products[0], url: 'https://booth.pm/ja' }] }));
});
