import { CATEGORY_URL, parseBoothPage } from './booth-parser.mjs';

export async function collectSortPages({ key, label, readPage, onPage = () => {}, maxPages = Infinity }) {
  const products = new Map();
  const signatures = new Set();
  let url = new URL(CATEGORY_URL);
  if (key !== 'popularity') url.searchParams.set('sort', key);
  for (let page = 1; page <= maxPages; page++) {
    const cache = await readPage(url.href, page);
    const parsed = parseBoothPage(cache.html);
    const signature = parsed.products.map((product) => product.id).join(',');
    if (signatures.has(signature)) throw new Error('同じ商品ページが繰り返されたため停止します。');
    signatures.add(signature);
    for (const product of parsed.products) if (!products.has(product.id)) products.set(product.id, product);
    const snapshot = { label, url: key === 'popularity' ? CATEGORY_URL : `${CATEGORY_URL}?sort=${key}`, fetchedAt: cache.fetchedAt, pageCount: page, hasMore: parsed.hasMore, categoryTotal: parsed.categoryTotal, ids: [...products.keys()] };
    await onPage(snapshot);
    if (!parsed.hasMore) return { snapshot, products: [...products.values()] };
    const next = new URL(parsed.nextUrl);
    if (Number(next.searchParams.get('page')) !== page + 1 || (next.searchParams.get('sort') ?? 'popularity') !== key) throw new Error('次ページの番号・並び順が不整合です。');
    // 取得元のURLをそのまま使う。人気順のページ送りにはsort指定がない。
    url = next;
  }
  throw new Error(`ページ数が試作の上限${maxPages}を超えたため停止します。`);
}
