import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineLists, emptyList, matchesSearch, MAX_IMPORT_BYTES, parseList, readStoredList } from './filters.ts';

const current = { version: 1 as const, items: [{ id: 'old', name: '既存商品' }], shops: [{ id: 'shop-a', name: '既存ショップ' }] };

test('取り込みはIDで重複を除去し、名前とIDだけを取り出す', () => {
  const parsed = parseList(JSON.stringify({ version: 1, items: [{ id: 'one', name: '商品', extra: '<script>' }, { id: 'one', name: '別名' }], shops: [] }));
  assert.deepEqual(parsed.items, [{ id: 'one', name: '商品' }]);
});

test('追加は既存設定を保持し、重複するIDの既存名を保持する', () => {
  const incoming = parseList(JSON.stringify({ version: 1, items: [{ id: 'new', name: '追加商品' }], shops: [{ id: 'shop-a', name: '新しい名前' }] }));
  const combined = combineLists(current, incoming, 'merge');
  assert.equal(combined.items.length, 2);
  assert.equal(combined.shops[0].name, '既存ショップ');
  assert.equal(current.items.length, 1);
});

test('置換と空の取り込みの結果は追加と異なる', () => {
  assert.deepEqual(combineLists(current, emptyList(), 'replace'), emptyList());
  assert.deepEqual(combineLists(current, emptyList(), 'merge'), current);
});

test('不正JSON・不明バージョン・不正な型やID・空名を拒否する', () => {
  for (const input of ['{', 'null', '[]', '{"version":2,"items":[],"shops":[]}',
    '{"version":1,"items":{},"shops":[]}',
    '{"version":1,"items":[{"id":12,"name":"商品"}],"shops":[]}',
    '{"version":1,"items":[{"id":"bad/id","name":"商品"}],"shops":[]}',
    '{"version":1,"items":[{"id":"valid","name":" "}],"shops":[]}']) {
    assert.throws(() => parseList(input));
  }
  assert.equal(current.items.length, 1);
});

test('201件以上を取り込めるが2MiB超のファイルを拒否する', () => {
  const items = Array.from({ length: 250 }, (_, index) => ({ id: `item-${index}`, name: `商品${index}` }));
  assert.equal(parseList(JSON.stringify({ version: 1, items, shops: [] })).items.length, 250);
  assert.throws(() => parseList(' '.repeat(MAX_IMPORT_BYTES + 1)), /2MiB/);
});

test('全角・半角・英字の大小を正規化し、語をまたいでAND検索する', () => {
  assert.equal(matchesSearch('ＱＵＩＺ 大会記録', '青空工房', 'quiz 青空'), true);
  assert.equal(matchesSearch('大会記録', '青空工房', '大会 文学'), false);
  assert.equal(matchesSearch('商品', 'ショップ', '  '), true);
});

test('保存済み設定の再読込と未保存の空リスト', () => {
  assert.deepEqual(readStoredList(() => ({ getItem: () => JSON.stringify(current) })).list, current);
  assert.deepEqual(readStoredList(() => ({ getItem: () => null })).list, emptyList());
});

test('破損した元データを回復用に保持し、ストレージ取得自体の例外も扱う', () => {
  const broken = readStoredList(() => ({ getItem: () => 'broken json' }));
  assert.equal(broken.raw, 'broken json');
  assert.ok(broken.error);
  const unavailable = readStoredList(() => { throw new Error('blocked storage'); });
  assert.ok(unavailable.error);
  assert.equal(unavailable.raw, null);
});
