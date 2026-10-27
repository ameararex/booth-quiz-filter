import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { collectTaggedProducts } from './tag-collection.mjs';
import { TAG_URL } from './booth-parser.mjs';
import { fetchBoothPage } from './booth-fetch.mjs';
import { parseCatalog } from '../src/lib/catalog.ts';

export async function collectTaggedCatalog({ pageLimit = Infinity, publish = true } = {}) {
  const dir = '.wrangler/booth-cache';
  await mkdir(dir, { recursive: true });
  const lockPath = `${dir}/collector.lock`;
  const lock = await open(lockPath, 'wx');
  const started = Date.now();
  let requests = 0, stop = false;
  const stopCollection = () => { stop = true; };
  process.once('SIGINT', stopCollection);
  process.once('SIGTERM', stopCollection);
  const progressPath = `${dir}/tag-progress.json`;
  let progress = { status: 'running', startedAt: new Date(started).toISOString(), sourceUrl: TAG_URL };
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: progress.startedAt }));
    const cacheHours = Number(process.env.BOOTH_CACHE_MAX_AGE_HOURS ?? 6);
    if (!Number.isFinite(cacheHours) || cacheHours < 0 || cacheHours > 24) throw new Error('キャッシュ時間は0〜24時間で指定してください。');
    function budget() {
      if (stop || Date.now() - started > 80 * 60000 || requests >= 800) throw new Error('手動停止または実行時間・リクエスト予算により停止します。');
    }
    async function request(task) {
      budget();
      if (requests) await delay(10000);
      budget(); requests++;
      return task();
    }
    const result = await collectTaggedProducts({ pageLimit,
      readPage: async (url, page) => {
        budget();
        const path = `${dir}/tag-new.${page}.json`;
        try {
          const cached = JSON.parse(await readFile(path, 'utf8'));
          const age = Date.now() - Date.parse(cached.fetchedAt);
          if (cached.url === url && cached.html && age >= 0 && age < cacheHours * 3600000) return cached;
        } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
        const html = await request(() => fetchBoothPage(url));
        const cached = { html, url, fetchedAt: new Date().toISOString() };
        await writeFile(path, JSON.stringify(cached));
        return cached;
      },
      readLikes: async (ids) => request(async () => {
        const url = new URL('https://accounts.booth.pm/wish_lists.json');
        for (const id of ids) url.searchParams.append('item_ids[]', id);
        const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Que-Fil/0.1 (catalog collection)' } });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`スキ数取得失敗（HTTP ${response.status}）。追従・再試行せず停止します。`);
        const text = await response.text();
        if (Buffer.byteLength(text) > 262144) throw new Error('スキ数の応答容量が上限を超えました。');
        const value = JSON.parse(text);
        // 個人の登録状態を含み得るitem_idsは収集結果にもキャッシュにも保存しない。
        return { wishlists_counts: value.wishlists_counts };
      }),
      onPage: async (snapshot) => {
        progress = { ...progress, pages: snapshot.pageCount, products: snapshot.ids.length, requestCount: requests, updatedAt: new Date().toISOString() };
        await writeFile(progressPath, JSON.stringify(progress, null, 2));
        console.log(`クイズタグ・新着順: ${snapshot.pageCount}ページ / ${snapshot.ids.length}商品`);
      },
    });
    const raw = { version: 1, mode: 'live', sourceUrl: TAG_URL, fetchedAt: new Date().toISOString(), orderLabel: 'BOOTHの新着順', coverage: result.snapshot.hasMore ? `「クイズ」タグの新着順の先頭${result.snapshot.pageCount}ページを取得しています。検索・並べ替えはこの範囲が対象です。` : '「クイズ」タグの新着順で最後の公開ページまで取得しました。取得中の追加・変更により、同一時点の全商品を保証するものではありません。', products: result.products, sorts: { new: result.snapshot } };
    parseCatalog(raw);
    const text = JSON.stringify(raw, null, 2) + '\n';
    if (Buffer.byteLength(text) > 20 * 1024 * 1024) throw new Error('配信用JSONの容量予算を超えたため更新しません。');
    if (publish) {
      const manifest = JSON.parse(await readFile('public/data/manifest.json', 'utf8'));
      if (!/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('Invalid catalog path');
      const previous = parseCatalog(JSON.parse(await readFile(`public${manifest.catalog}`, 'utf8')));
      if (result.snapshot.hasMore && previous.sourceUrl === TAG_URL && previous.sorts?.new?.hasMore === false) throw new Error('全件取得済みのJSONを部分取得で置き換えないため更新しません。');
      // 対象と収集範囲が同じときに比較する。カテゴリ→タグ移行や少量検証とは混同しない。
      if (!result.snapshot.hasMore && previous.sourceUrl === TAG_URL && previous.sorts?.new?.hasMore === false && raw.products.length < previous.products.length / 2) throw new Error('商品数が直近正常データの半分未満のため更新しません。');
      const filename = `catalog.booth.${raw.fetchedAt.replace(/[^0-9TZ]/g, '')}.json`;
      await writeFile(`public/data/${filename}`, text);
      await writeFile('public/data/manifest.next.json', JSON.stringify({ version: 1, catalog: `/data/${filename}` }) + '\n');
      await rename('public/data/manifest.next.json', 'public/data/manifest.json');
    }
    progress = { ...progress, status: 'complete', partial: result.snapshot.hasMore, published: publish, finishedAt: new Date().toISOString() };
    await writeFile(progressPath, JSON.stringify(progress, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `クイズタグの新着順 ${raw.products.length}商品。${result.snapshot.hasMore ? '部分取得' : '最終ページまで取得'}。価格・スキ順はブラウザ内で計算します。\n`, { flag: 'a' });
    return raw;
  } catch (error) {
    await writeFile(progressPath, JSON.stringify({ ...progress, status: 'stopped', error: error.message }, null, 2));
    throw error;
  } finally {
    process.removeListener('SIGINT', stopCollection); process.removeListener('SIGTERM', stopCollection);
    await lock.close(); await unlink(lockPath);
  }
}
