import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boothUrl, parseCatalog } from './catalog.ts';

const sample = JSON.parse(readFileSync(new URL('../../public/data/catalog.sample.v1.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')) as unknown;

test('BOOTHのHTTPS URLだけを許可する', () => {
  assert.equal(boothUrl('https://booth.pm/ja/items/123'), true);
  assert.equal(boothUrl('https://sample.booth.pm/items/123'), true);
  for (const url of ['javascript:alert(1)', 'https://booth.pm.evil.example/items/1', 'https://evil.example/booth.pm', 'http://booth.pm/items/1', 'https://user:pass@booth.pm/items/1', 'https://booth.pm:8080/items/1']) assert.equal(boothUrl(url), false);
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
