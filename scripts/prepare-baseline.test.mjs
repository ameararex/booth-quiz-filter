import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareBaseline } from './prepare-baseline.mjs';

const origin = 'https://que-fil.example';
const manifest = { version: 1, catalog: '/data/catalog.published.json' };
const raw = {
  version: 1, mode: 'live', sourceUrl: 'https://booth.pm/ja/items?sort=new',
  fetchedAt: '2026-10-26T03:00:00Z', coverage: '公開中のデータ', orderLabel: '新着順',
  products: [{ id: '123', name: '問題集', shopId: 'shop', shopName: '店', priceLabel: '¥ 100', priceYen: 100, likes: 31, url: 'https://booth.pm/ja/items/123' }],
};
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'que-fil-baseline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'data'));
  await writeFile(join(dir, 'data/manifest.json'), 'previous manifest');
  return dir;
}
const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('配信中の商品・取得日時・manifestを保持し、本番サイトへの2通信だけで引き継ぐ', async (t) => {
  const outputDir = await directory(t), calls = [];
  await prepareBaseline(origin, { outputDir, fetcher: async (url, options) => {
    calls.push(url.href);
    assert.equal(options.redirect, 'error');
    return json(url.pathname === '/data/manifest.json' ? manifest : raw);
  } });
  assert.deepEqual(calls, [origin + '/data/manifest.json', origin + manifest.catalog]);
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, 'data/manifest.json'), 'utf8')), manifest);
  assert.deepEqual(JSON.parse(await readFile(outputDir + manifest.catalog, 'utf8')), raw);
});

test('通信失敗・不正データ・不正manifestでは既存manifestを変更しない', async (t) => {
  const outputDir = await directory(t);
  for (const fetcher of [
    async () => new Response('', { status: 503 }),
    async (url) => json(url.pathname === '/data/manifest.json' ? manifest : { ...raw, products: [{ ...raw.products[0], likes: -1 }] }),
    async () => json({ version: 1, catalog: 'https://booth.pm/ja/items' }),
  ]) {
    await assert.rejects(prepareBaseline(origin, { outputDir, fetcher }));
    assert.equal(await readFile(join(outputDir, 'data/manifest.json'), 'utf8'), 'previous manifest');
  }
});
