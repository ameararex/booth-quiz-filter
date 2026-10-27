import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CATEGORY_URL, SORTS, parseBoothPage } from './booth-parser.mjs';
import { fetchBoothPage } from './booth-fetch.mjs';
import { collectSortPages } from './booth-pagination.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cacheDir = resolve(root, '.wrangler/booth-cache');
const dataDir = resolve(root, 'public/data');
const progressPath = resolve(cacheDir, 'progress.json');
const lockPath = resolve(cacheDir, 'collector.lock');
let requestCount = 0;
let stop = false;
const cacheHours = Number(process.env.BOOTH_CACHE_MAX_AGE_HOURS ?? 6);
if (!Number.isFinite(cacheHours) || cacheHours < 0 || cacheHours > 24) throw new Error('キャッシュ時間は0〜24時間で指定してください。');
process.once('SIGINT', () => { stop = true; });
process.once('SIGTERM', () => { stop = true; });

async function main() {
  await mkdir(cacheDir, { recursive: true });
  const lock = await open(lockPath, 'wx');
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  let progress = { status: 'running', startedAt: new Date().toISOString(), requestCount: 0 };
  try {
    const sorts = {};
    const all = new Map();
    for (const [key, label] of Object.entries(SORTS)) {
      const result = await collectSortPages({ key, label,
        readPage: async (sourceUrl, page) => {
          if (stop) throw new Error('手動停止。次回はキャッシュから再開します。');
          const cachePath = resolve(cacheDir, page === 1 ? `${key}.json` : `${key}.${page}.json`);
          try {
            const cache = JSON.parse(await readFile(cachePath, 'utf8'));
            const age = Date.now() - Date.parse(cache.fetchedAt);
            if (cache.url === sourceUrl && age >= 0 && age < cacheHours * 3600000 && cache.html) return cache;
          } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
          // 試作用の抑制。安全な頻度を保証するものではない。
          if (requestCount > 0) await delay(10000);
          if (stop) throw new Error('手動停止。次回はキャッシュから再開します。');
          const html = await fetchBoothPage(sourceUrl);
          requestCount++;
          parseBoothPage(html);
          const cache = { url: sourceUrl, fetchedAt: new Date().toISOString(), html };
          await writeFile(cachePath, JSON.stringify(cache));
          return cache;
        },
        onPage: async (snapshot) => {
          progress = { ...progress, sort: key, label, pages: snapshot.pageCount, products: snapshot.ids.length, categoryTotal: snapshot.categoryTotal, requestCount, updatedAt: new Date().toISOString() };
          await writeFile(progressPath, JSON.stringify(progress, null, 2));
          console.log(`${label}: ${snapshot.pageCount}ページ / ${snapshot.ids.length}商品`);
        },
      });
      sorts[key] = result.snapshot;
      for (const product of result.products) if (!all.has(product.id)) all.set(product.id, product);
      if (all.size > 5000) throw new Error('重複除去後の商品数が5,000件を超えました。');
    }
    const newestTime = Object.values(sorts).map((sort) => sort.fetchedAt).sort().at(-1);
    const manifest = JSON.parse(await readFile(resolve(dataDir, 'manifest.json'), 'utf8'));
    if (/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog ?? '')) {
      const previous = JSON.parse(await readFile(resolve(dataDir, manifest.catalog.slice('/data/'.length)), 'utf8'));
      for (const [key, snapshot] of Object.entries(sorts)) {
        if (snapshot.ids.length < (previous.sorts?.[key]?.ids?.length ?? 0) / 2) throw new Error(`${SORTS[key]}の件数が半分未満のため切り替えません。`);
      }
    }
    const catalog = {
      version: 1, mode: 'live', sourceUrl: CATEGORY_URL, fetchedAt: newestTime,
      collectionStartedAt: progress.startedAt, collectionFinishedAt: new Date().toISOString(),
      coverage: 'クイズカテゴリの5種類の並び順について最後の公開ページまで順に取得しました。収集中の追加・削除・順位変更により、同一時点の全商品を保証するものではありません。',
      orderLabel: 'BOOTH取得時の順序', products: [...all.values()], sorts,
    };
    const filename = `catalog.booth.${newestTime.replace(/[^0-9TZ]/g, '')}.json`;
    await writeFile(resolve(dataDir, filename), JSON.stringify(catalog, null, 2) + '\n');
    await writeFile(resolve(dataDir, 'manifest.next.json'), JSON.stringify({ version: 1, catalog: `/data/${filename}` }, null, 2) + '\n');
    await rename(resolve(dataDir, 'manifest.next.json'), resolve(dataDir, 'manifest.json'));
    if (process.argv.includes('--build-on-complete')) {
      await new Promise((success, failure) => {
        const child = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit', windowsHide: true });
        child.on('error', failure);
        child.on('exit', (code) => code === 0 ? success() : failure(new Error('ビルドに失敗しました。')));
      });
    }
    progress = { ...progress, status: 'complete', totalProducts: all.size, file: filename, finishedAt: new Date().toISOString() };
    await writeFile(progressPath, JSON.stringify(progress, null, 2));
    console.log(`保存: ${filename} / ${all.size}商品 / HTTP取得${requestCount}回`);
  } catch (error) {
    await writeFile(progressPath, JSON.stringify({ ...progress, status: 'stopped', error: error.message, updatedAt: new Date().toISOString() }, null, 2));
    throw error;
  } finally { await lock.close(); await unlink(lockPath); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
