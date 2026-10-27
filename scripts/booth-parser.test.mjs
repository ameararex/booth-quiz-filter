import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoothPage } from './booth-parser.mjs';

const fixture = `<h1>クイズの検索結果</h1><p>対象商品 1,234 件</p><ul><li class="item-card" data-product-id="123" data-product-brand="sample-shop"><div class="item-card__title"><a href="https://booth.pm/ja/items/123">架空の問題集</a></div><a class="item-card__shop-name-anchor" href="https://sample-shop.booth.pm/"><div class="item-card__shop-name">架空ショップ</div></a><div class="price">¥ 500~</div><a class="item-card__thumbnail-image" data-original="https://booth.pximg.net/c/300x300_a2_g5/sample.jpg"></a></li></ul><a rel="next" href="?page=2">次</a>`;

test('架空HTMLから最小のメタデータと取得範囲を抽出する', () => {
  const parsed = parseBoothPage(fixture);
  assert.equal(parsed.products[0].shopId, 'sample-shop');
  assert.equal(parsed.products[0].priceLabel, '¥ 500~');
  assert.equal(parsed.categoryTotal, 1234);
  assert.equal(parsed.hasMore, true);
});

test('HTML変更・商品欠損・ID重複・不正リンクを拒否する', () => {
  assert.throws(() => parseBoothPage('<h1>Access denied</h1>'));
  assert.throws(() => parseBoothPage(fixture.replace('item-card__shop-name"', 'changed"')));
  assert.throws(() => parseBoothPage(fixture.replace('https://booth.pm/ja/items/123', 'https://evil.example/123')));
  assert.throws(() => parseBoothPage(fixture.replace('https://booth.pximg.net/', 'https://evil.example/')));
  assert.throws(() => parseBoothPage(fixture.replace('</ul>', fixture.match(/<li[\s\S]*<\/li>/)[0] + '</ul>')));
});

test('BOOTHの画像なし用プレースホルダーはサムネイルなしとして扱う', () => {
  const html = fixture.replace('https://booth.pximg.net/c/300x300_a2_g5/sample.jpg', 'https://asset.booth.pm/assets/thumbnail_placeholder_c_300-abc123.png');
  assert.equal(parseBoothPage(html).products[0].thumbnailUrl, null);
});
