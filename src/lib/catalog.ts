import { isRecord, validId, validText } from './filters.ts';

export const SORT_OPTIONS = { popularity: '人気順', new: '新着順', wish_lists: 'スキ順', price_desc: '価格が高い順', price_asc: '価格が低い順' } as const;
export type BoothSort = keyof typeof SORT_OPTIONS;
export type SortSnapshot = { label: string; url: string; fetchedAt: string; pageCount: number; hasMore: boolean; categoryTotal: number | null; ids: string[] };
export type Product = { id: string; name: string; shopId: string; shopName: string; priceLabel: string; url: string | null; thumbnailUrl?: string | null };
export type Catalog = {
  version: 1; mode: 'sample' | 'live'; sourceUrl: string | null; fetchedAt: string | null;
  coverage: string; orderLabel: string; products: Product[]; sorts?: Partial<Record<BoothSort, SortSnapshot>>;
};

export function validThumbnail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'booth.pximg.net' && !url.username && !url.password && !url.port && url.pathname.startsWith('/c/300x300_');
  } catch { return false; }
}

export function boothUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'booth.pm' || /^[a-z0-9-]+\.booth\.pm$/.test(url.hostname));
  } catch { return false; }
}

export function parseCatalog(value: unknown): Catalog {
  if (!isRecord(value) || value.version !== 1 || !['sample', 'live'].includes(String(value.mode)) ||
    !validText(value.coverage, 2000) || !validText(value.orderLabel) || !Array.isArray(value.products) ||
    value.products.length > 5000) throw new Error('商品データの形式に対応していません。');
  const sample = value.mode === 'sample';
  if (sample ? (value.sourceUrl !== null || value.fetchedAt !== null) :
    (!boothUrl(value.sourceUrl) || typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt)))) {
    throw new Error('取得元・取得日時を確認できません。');
  }
  const seen = new Set<string>();
  const products = value.products.map((entry): Product => {
    if (!isRecord(entry) || !validId(entry.id) || !validId(entry.shopId) || !validText(entry.name) ||
      !validText(entry.shopName) || !validText(entry.priceLabel) || seen.has(entry.id) ||
      (sample ? entry.url !== null : !boothUrl(entry.url))) throw new Error('商品情報またはリンクが不正です。');
    if (!sample && !/^\/(?:[a-z]{2}\/)?items\/\d+\/?$/.test(new URL(entry.url as string).pathname)) {
      throw new Error('商品ページのURLではありません。');
    }
    const thumbnailUrl = entry.thumbnailUrl ?? null;
    if (thumbnailUrl !== null && (sample || !validThumbnail(thumbnailUrl))) throw new Error('未確認のサムネイルURLです。');
    seen.add(entry.id);
    return { id: entry.id, name: entry.name, shopId: entry.shopId, shopName: entry.shopName, priceLabel: entry.priceLabel, url: entry.url as string | null, thumbnailUrl };
  });
  let sorts: Catalog['sorts'];
  if (value.sorts !== undefined) {
    if (!isRecord(value.sorts) || !Object.keys(value.sorts).length) throw new Error('並び順の情報が不正です。');
    sorts = {};
    for (const [key, entry] of Object.entries(value.sorts)) {
      if (!(key in SORT_OPTIONS) || !isRecord(entry) || entry.label !== SORT_OPTIONS[key as BoothSort] || !boothUrl(entry.url) ||
        new URL(entry.url).searchParams.get('sort') !== key || typeof entry.fetchedAt !== 'string' || !Number.isFinite(Date.parse(entry.fetchedAt)) ||
        !Number.isInteger(entry.pageCount) || Number(entry.pageCount) < 1 || typeof entry.hasMore !== 'boolean' ||
        (entry.categoryTotal !== null && (!Number.isInteger(entry.categoryTotal) || Number(entry.categoryTotal) < 0)) ||
        !Array.isArray(entry.ids) || !entry.ids.length || entry.ids.some((id) => typeof id !== 'string' || !seen.has(id)) || new Set(entry.ids).size !== entry.ids.length) {
        throw new Error('取得済みの並び順・商品IDに不整合があります。');
      }
      sorts[key as BoothSort] = entry as SortSnapshot;
    }
  }
  return { version: 1, mode: value.mode as Catalog['mode'], sourceUrl: value.sourceUrl as string | null,
    fetchedAt: value.fetchedAt as string | null, coverage: value.coverage, orderLabel: value.orderLabel, products, sorts };
}

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`商品データの取得に失敗しました（${response.status}）。`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('JSONデータを受信できませんでした。');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024) throw new Error('商品データが読み込み容量の上限を超えています。');
  return JSON.parse(text) as unknown;
}

export async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const manifest = await getJson('/data/manifest.json', signal);
  if (!isRecord(manifest) || manifest.version !== 1 || typeof manifest.catalog !== 'string' ||
    !/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('商品データの参照先が不正です。');
  const catalog = parseCatalog(await getJson(manifest.catalog, signal));
  if (catalog.mode !== 'live') throw new Error('公開用の商品データを確認できません。');
  return catalog;
}
