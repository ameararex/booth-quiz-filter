import { TAG_URL, parseBoothPage } from './booth-parser.mjs';

export function parseLikes(value, ids) {
  if (!value || typeof value.wishlists_counts !== 'object' || value.wishlists_counts === null || Array.isArray(value.wishlists_counts)) throw new Error('スキ数の応答形式が不正です。');
  return new Map(ids.map((id) => {
    const count = value.wishlists_counts[id];
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error('スキ数が不正です。');
    return [id, count ?? null]; // 欠損を0と推測しない。個人のitem_idsは利用・保存しない。
  }));
}

export async function collectTaggedProducts({ readPage, readLikes, pageLimit = Infinity, onPage = async () => {} }) {
  const products = new Map();
  const signatures = new Set();
  let url = new URL(TAG_URL);
  for (let page = 1; ; page++) {
    const cache = await readPage(url.href, page);
    const parsed = parseBoothPage(cache.html, url.href);
    const signature = parsed.products.map((product) => product.id).join(',');
    if (signatures.has(signature)) throw new Error('同じ商品ページが繰り返されたため停止します。');
    signatures.add(signature);
    const ids = parsed.products.filter((product) => !products.has(product.id)).map((product) => product.id);
    const likes = ids.length ? parseLikes(await readLikes(ids), ids) : new Map();
    for (const product of parsed.products) if (!products.has(product.id)) products.set(product.id, { ...product, likes: likes.get(product.id) ?? null });
    if (Buffer.byteLength(JSON.stringify([...products.values()])) > 19 * 1024 * 1024) throw new Error('商品JSONが配信容量予算に達したため停止します。');
    const snapshot = { label: '新着順', url: TAG_URL, fetchedAt: cache.fetchedAt, pageCount: page, hasMore: parsed.hasMore, categoryTotal: parsed.categoryTotal, ids: [...products.keys()] };
    await onPage(snapshot);
    if (!parsed.hasMore || page >= pageLimit) return { products: [...products.values()], snapshot };
    const next = new URL(parsed.nextUrl);
    if (next.searchParams.getAll('tags[]').length !== 1 || next.searchParams.get('tags[]') !== 'クイズ' || next.searchParams.get('sort') !== 'new' || Number(next.searchParams.get('page')) !== page + 1 || [...next.searchParams.keys()].some((key) => !['tags[]', 'sort', 'page'].includes(key))) throw new Error('タグ・新着順・ページ番号が変わったため停止します。');
    url = next;
  }
}
