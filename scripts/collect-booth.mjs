import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_URL, SORTS, parseBoothPage } from './booth-parser.mjs';
import { fetchBoothPage } from './booth-fetch.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheDir = resolve(root, '.wrangler/booth-cache');
const dataDir = resolve(root, 'public/data');
const cacheMs = 24 * 60 * 60 * 1000;

// 1回の実行で各並び順の先頭1ページのみ。間隔は試作の制限であり、安全な頻度の保証ではない。
async function main() {
  await mkdir(cacheDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const sorts = {};
  const all = new Map();
  let requestCount = 0;
  for (const [key, label] of Object.entries(SORTS)) {
    const sourceUrl = `${CATEGORY_URL}?sort=${key}`;
    const cachePath = resolve(cacheDir, `${key}.json`);
    let cache;
    try {
      const candidate = JSON.parse(await readFile(cachePath, 'utf8'));
      if (candidate.url === sourceUrl && Date.now() - Date.parse(candidate.fetchedAt) < cacheMs && candidate.html) cache = candidate;
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (!cache) {
      if (requestCount > 0) await delay(10000);
      const html = await fetchBoothPage(sourceUrl);
      requestCount++;
      cache = { url: sourceUrl, fetchedAt: new Date().toISOString(), html };
      parseBoothPage(html); // 異常な応答を正常キャッシュとして保存しない。
      await writeFile(cachePath, JSON.stringify(cache));
    }
    const parsed = parseBoothPage(cache.html);
    sorts[key] = { label, url: sourceUrl, fetchedAt: cache.fetchedAt, pageCount: 1, hasMore: parsed.hasMore, categoryTotal: parsed.categoryTotal, ids: parsed.products.map((product) => product.id) };
    for (const product of parsed.products) if (!all.has(product.id)) all.set(product.id, product);
    console.log(`${label}: ${parsed.products.length}商品 (${cache.fetchedAt})`);
  }
  const newestTime = Object.values(sorts).map((sort) => sort.fetchedAt).sort().at(-1);
  const previousManifest = JSON.parse(await readFile(resolve(dataDir, 'manifest.json'), 'utf8'));
  if (/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(previousManifest.catalog ?? '')) {
    const previous = JSON.parse(await readFile(resolve(dataDir, previousManifest.catalog.slice('/data/'.length)), 'utf8'));
    for (const [key, snapshot] of Object.entries(sorts)) {
      const previousCount = previous.sorts?.[key]?.ids?.length ?? 0;
      if (previousCount > 0 && snapshot.ids.length < previousCount / 2) throw new Error(`${SORTS[key]}の商品件数が前回の半分未満のため公開JSONを更新しません。`);
    }
  }
  const catalog = {
    version: 1, mode: 'live', sourceUrl: CATEGORY_URL, fetchedAt: newestTime,
    collectionStartedAt: startedAt, collectionFinishedAt: new Date().toISOString(),
    coverage: 'クイズカテゴリの各並び順の先頭1ページのみを取得した試験データです。検索・非表示は選択中の並び順で取得できた商品だけが対象で、全件検索ではありません。',
    orderLabel: 'BOOTH取得時の順序', products: [...all.values()], sorts,
  };
  const filename = `catalog.booth.${newestTime.replace(/[^0-9TZ]/g, '')}.json`;
  // 全5種類の取得・検証成功後にだけ参照先を切り替える。正常な旧データは残す。
  await writeFile(resolve(dataDir, filename), JSON.stringify(catalog, null, 2) + '\n');
  const manifestPath = resolve(dataDir, 'manifest.next.json');
  await writeFile(manifestPath, JSON.stringify({ version: 1, catalog: `/data/${filename}` }, null, 2) + '\n');
  await rename(manifestPath, resolve(dataDir, 'manifest.json'));
  console.log(`保存: ${filename} / 重複除去後${all.size}商品 / HTTP取得${requestCount}回`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
