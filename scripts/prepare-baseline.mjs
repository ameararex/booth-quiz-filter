import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseCatalog } from '../src/lib/catalog.ts';

// 配信中のデータを件数比較や画面のみの再デプロイへ引き継ぐ。失敗時は公開へ進めない。
export async function prepareBaseline(siteUrl, { fetcher = fetch, outputDir = 'public' } = {}) {
  const origin = new URL(siteUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('CATALOG_SITE_URLは公開サイトのHTTPS originにしてください。');
  async function json(path) {
    const response = await fetcher(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('公開中データを確認できません。');
    const text = await response.text();
    if (Buffer.byteLength(text) > 20 * 1024 * 1024) throw new Error('公開中データが容量上限を超えています。');
    return JSON.parse(text);
  }
  const manifest = await json('/data/manifest.json');
  if (manifest.version !== 1 || !/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('公開中manifestが不正です。');
  const raw = await json(manifest.catalog);
  const catalog = parseCatalog(raw);
  if (catalog.mode !== 'live') throw new Error('公開中データが実データではありません。');
  await writeFile(`${outputDir}${manifest.catalog}`, JSON.stringify(raw, null, 2) + '\n');
  await writeFile(`${outputDir}/data/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`公開中の${catalog.products.length}商品を引き継ぎました。`);

  return { manifest, catalog };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareBaseline(process.env.CATALOG_SITE_URL ?? '');
}
