import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { collectSortPages } from './booth-pagination.mjs';
import { fetchBoothPage } from './booth-fetch.mjs';
import { parseBoothPage } from './booth-parser.mjs';
import { parseCatalog } from '../src/lib/catalog.ts';

await mkdir('.wrangler/booth-cache', { recursive: true });
let requests = 0;
let result;
const done = new Error('Three-page probe complete');
try {
  await collectSortPages({ key: 'popularity', label: '人気順', readPage: async (url, page) => {
    const path = `.wrangler/booth-cache/${page === 1 ? 'popularity' : `popularity.${page}`}.json`;
    try {
      const cache = JSON.parse(await readFile(path, 'utf8'));
      const age = Date.now() - Date.parse(cache.fetchedAt);
      if (cache.url === url && age >= 0 && age < 6 * 3600000 && cache.html) return cache;
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (requests) await delay(10000);
    const html = await fetchBoothPage(url);
    requests++;
    const cache = { url, html, fetchedAt: new Date().toISOString() };
    await writeFile(path, JSON.stringify(cache));
    return cache;
  }, onPage: async (snapshot) => {
    console.log(`${snapshot.pageCount}ページ / ${snapshot.ids.length}商品`);
    if (snapshot.pageCount === 3) {
      result = { ...snapshot, status: 'probe-complete', requestCount: requests };
      throw done;
    }
  } });
  throw new Error('3ページ未満で終了したため収集範囲の確認が必要です。');
} catch (error) { if (error !== done) throw error; }
await writeFile('.wrangler/booth-cache/probe-3pages.json', JSON.stringify(result, null, 2));
const publish = process.argv.includes('--publish');
if (publish) {
  const manifest = JSON.parse(await readFile('public/data/manifest.json', 'utf8'));
  if (!/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('Invalid catalog path');
  const current = parseCatalog(JSON.parse(await readFile(`public${manifest.catalog}`, 'utf8')));
  const products = new Map(current.products.map((product) => [product.id, product]));
  for (let page = 1; page <= 3; page++) {
    const cache = JSON.parse(await readFile(`.wrangler/booth-cache/${page === 1 ? 'popularity' : `popularity.${page}`}.json`, 'utf8'));
    for (const product of parseBoothPage(cache.html).products) products.set(product.id, product);
  }
  const { status: _status, requestCount: _requests, ...snapshot } = result;
  const raw = { ...current, mode: 'live', fetchedAt: result.fetchedAt, products: [...products.values()], sorts: { ...current.sorts, popularity: snapshot }, coverage: '人気順は先頭3ページ、その他の並び順は各取得済みページの商品が対象です。カテゴリ全件を対象とした検索ではありません。' };
  parseCatalog(raw);
  const filename = `catalog.booth.${result.fetchedAt.replace(/[^0-9TZ]/g, '')}.json`;
  await writeFile(`public/data/${filename}`, JSON.stringify(raw, null, 2) + '\n');
  await writeFile('public/data/manifest.next.json', JSON.stringify({ version: 1, catalog: `/data/${filename}` }) + '\n');
  await rename('public/data/manifest.next.json', 'public/data/manifest.json');
}
const message = `人気順3ページ・${result.ids.length}商品を確認。${publish ? '配信用JSONに反映しました。' : '公開JSONは変更していません。'}`;
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, message + '\n', { flag: 'a' });
console.log(message);
