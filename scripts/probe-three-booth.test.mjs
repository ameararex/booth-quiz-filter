import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CATEGORY_URL } from './booth-parser.mjs';

test('3ページ検証の公開オプションは新規取得順だけ更新し、他の並び順を保持する（通信なし）', async () => {
  const root = resolve('.wrangler/tests');
  await mkdir(root, { recursive: true });
  const temp = await mkdtemp(join(root, 'probe-'));
  try {
    await cp('public/data', join(temp, 'public/data'), { recursive: true });
    await mkdir(join(temp, '.wrangler/booth-cache'), { recursive: true });
    await writeFile(join(temp, 'no-network.mjs'), 'globalThis.fetch = async () => { throw new Error("Network must not be used"); };');
    const previousManifest = JSON.parse(await readFile(join(temp, 'public/data/manifest.json'), 'utf8'));
    const previous = JSON.parse(await readFile(join(temp, 'public', previousManifest.catalog), 'utf8'));
    for (let page = 1; page <= 3; page++) {
      const id = `9999900${page}`;
      const html = `<h1>クイズ</h1><li class="item-card" data-product-id="${id}" data-product-brand="test-shop"><div class="item-card__title"><a href="https://booth.pm/ja/items/${id}">テスト問題集</a></div><a class="item-card__shop-name-anchor" href="https://test-shop.booth.pm/"><span class="item-card__shop-name">店</span></a><div class="price">¥ 100</div></li><a rel="next" href="?page=${page + 1}">次</a>`;
      await writeFile(join(temp, `.wrangler/booth-cache/${page === 1 ? 'popularity' : `popularity.${page}`}.json`), JSON.stringify({ html, fetchedAt: new Date().toISOString(), url: `${CATEGORY_URL}?${page === 1 ? 'sort=popularity' : `page=${page}`}` }));
    }
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(join(temp, 'no-network.mjs')).href, resolve('scripts/probe-three-booth.mjs'), '--publish'], { cwd: temp, encoding: 'utf8', windowsHide: true });
    assert.equal(child.status, 0, child.stderr);
    const manifest = JSON.parse(await readFile(join(temp, 'public/data/manifest.json'), 'utf8'));
    const catalog = JSON.parse(await readFile(join(temp, 'public', manifest.catalog), 'utf8'));
    assert.deepEqual(catalog.sorts.popularity.ids, ['99999001', '99999002', '99999003']);
    assert.equal(catalog.sorts.popularity.pageCount, 3);
    assert.equal(catalog.sorts.popularity.hasMore, true);
    assert.deepEqual(catalog.sorts.new, previous.sorts.new);
    assert.equal(catalog.products.length, previous.products.length + 3);
  } finally {
    assert.ok(temp.startsWith(root + sep));
    await rm(temp, { recursive: true, force: true });
  }
});
