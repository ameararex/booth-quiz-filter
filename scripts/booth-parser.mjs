import { load } from 'cheerio';

export const CATEGORY_URL = 'https://booth.pm/ja/browse/' + encodeURIComponent('クイズ');
export const SEARCH_URL = 'https://booth.pm/ja/search/' + encodeURIComponent('クイズ') + '?sort=new';
export const SORTS = {
  popularity: '人気順', new: '新着順', wish_lists: 'スキ順',
  price_desc: '価格が高い順', price_asc: '価格が低い順',
};

export function parseBoothPage(html, sourceUrl = CATEGORY_URL) {
  const $ = load(html);
  if (!$('h1').text().includes('クイズ')) throw new Error('クイズの検索HTMLではありません。');
  const cards = $('li.item-card[data-product-id]');
  if (!cards.length || cards.length > 100) throw new Error('商品件数またはHTML構造が想定外です。');
  const products = [];
  const seen = new Set();
  cards.each((_, node) => {
    const card = $(node);
    const id = card.attr('data-product-id');
    const name = card.find('.item-card__title a').first().text().trim();
    const shopLink = card.find('.item-card__shop-name-anchor').first();
    const shopName = shopLink.find('.item-card__shop-name').text().trim();
    const shopUrl = new URL(shopLink.attr('href'));
    const shopId = shopUrl.hostname.replace(/\.booth\.pm$/, '');
    const url = new URL(card.find('.item-card__title a').first().attr('href'));
    const priceLabel = card.find('.price').first().text().replace(/\s+/g, ' ').trim();
    const priceValue = card.attr('data-product-price');
    const priceYen = priceValue !== undefined && /^\d+$/.test(priceValue) && Number.isSafeInteger(Number(priceValue)) ? Number(priceValue) : null;
    let thumbnailUrl = card.find('.item-card__thumbnail-image').first().attr('data-original') ?? null;
    if (thumbnailUrl && /^https:\/\/asset\.booth\.pm\/assets\/thumbnail_placeholder_c_300-[a-f0-9]+\.png$/.test(thumbnailUrl)) thumbnailUrl = null;
    if (!/^\d+$/.test(id ?? '') || seen.has(id) || !name || !shopName || !priceLabel ||
      shopUrl.protocol !== 'https:' || !/^[a-z0-9-]+\.booth\.pm$/.test(shopUrl.hostname) ||
      shopId !== card.attr('data-product-brand') || url.protocol !== 'https:' || url.hostname !== 'booth.pm' ||
      !new RegExp('^/ja/items/' + id + '$').test(url.pathname)) throw new Error('商品・ショップ情報が不正または欠損しています。');
    if (thumbnailUrl) {
      const image = new URL(thumbnailUrl);
      if (image.protocol !== 'https:' || image.hostname !== 'booth.pximg.net' || !image.pathname.startsWith('/c/300x300_')) throw new Error('未確認の画像URLです。');
    }
    seen.add(id);
    products.push({ id, name, shopId, shopName, priceLabel, priceYen, url: url.href, thumbnailUrl });
  });
  const totalMatch = $('body').text().match(/対象商品\s*([\d,]+)\s*件/);
  const nextHref = $('a[rel="next"]').first().attr('href');
  const nextUrl = nextHref ? new URL(nextHref, sourceUrl) : null;
  if (nextUrl && (nextUrl.origin !== new URL(sourceUrl).origin || nextUrl.pathname !== new URL(sourceUrl).pathname)) throw new Error('想定外の次ページURLです。');
  return { products, hasMore: Boolean(nextUrl), nextUrl: nextUrl?.href ?? null, categoryTotal: totalMatch ? Number(totalMatch[1].replaceAll(',', '')) : null };
}
