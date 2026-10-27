import { writeFile } from 'node:fs/promises';
import { parseCatalog } from '../src/lib/catalog.ts';

// 配信中の正常データを件数比較の基準にする。失敗時は収集・公開へ進めない。
const origin = new URL(process.env.CATALOG_SITE_URL ?? '');
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('CATALOG_SITE_URLは公開サイトのHTTPS originにしてください。');
async function json(path) {
  const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('公開中データを確認できません。');
  const text = await response.text();
  if (Buffer.byteLength(text) > 5 * 1024 * 1024) throw new Error('公開中データが容量上限を超えています。');
  return JSON.parse(text);
}
const manifest = await json('/data/manifest.json');
if (manifest.version !== 1 || !/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('公開中manifestが不正です。');
const raw = await json(manifest.catalog);
const catalog = parseCatalog(raw);
if (catalog.mode !== 'live') throw new Error('公開中データが実データではありません。');
await writeFile(`public${manifest.catalog}`, JSON.stringify(raw, null, 2) + '\n');
await writeFile('public/data/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`公開中の${catalog.products.length}商品を比較基準にしました。`);
