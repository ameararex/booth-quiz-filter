import { isRecord, validId, validText } from './filters.ts';

export type Product = { id: string; name: string; shopId: string; shopName: string; priceLabel: string; url: string | null };
export type Catalog = {
  version: 1; mode: 'sample' | 'live'; sourceUrl: string | null; fetchedAt: string | null;
  coverage: string; orderLabel: string; products: Product[];
};

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
    seen.add(entry.id);
    return { id: entry.id, name: entry.name, shopId: entry.shopId, shopName: entry.shopName, priceLabel: entry.priceLabel, url: entry.url as string | null };
  });
  return { version: 1, mode: value.mode as Catalog['mode'], sourceUrl: value.sourceUrl as string | null,
    fetchedAt: value.fetchedAt as string | null, coverage: value.coverage, orderLabel: value.orderLabel, products };
}

async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`商品データの取得に失敗しました（${response.status}）。`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('JSONデータを受信できませんでした。');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024) throw new Error('商品データが試作の容量上限を超えています。');
  return JSON.parse(text) as unknown;
}

export async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const manifest = await getJson('/data/manifest.json', signal);
  if (!isRecord(manifest) || manifest.version !== 1 || typeof manifest.catalog !== 'string' ||
    !/^\/data\/catalog\.[a-zA-Z0-9._-]+\.json$/.test(manifest.catalog)) throw new Error('商品データの参照先が不正です。');
  return parseCatalog(await getJson(manifest.catalog, signal));
}
