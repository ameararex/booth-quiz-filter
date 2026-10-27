import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import app from './index.ts';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_shares.sql', import.meta.url), 'utf8'));
  function prepare(sql: string) {
    let values: (string | number)[] = [];
    return {
      bind(...args: (string | number)[]) { values = args; return this; },
      async first() { return db.prepare(sql).get(...values) ?? null; },
      async run() { return db.prepare(sql).run(...values); },
    };
  }
  const binding = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    db.exec('BEGIN');
    try { const results = await Promise.all(statements.map((s) => s.run())); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
  const request = (path: string, method = 'GET', body?: unknown, secret?: string) => app.request(`https://example.test/api/shares${path}`, {
    method, headers: { Origin: 'https://example.test', 'Content-Type': 'application/json', ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, { SHARES_DB: binding });
  return { db, request };
}

test('200ショップの共有・7日期限を検証し、管理用トークンを発行しない', async () => {
  const { db, request } = setup();
  try {
    const before = Date.now();
    const created = await request('', 'POST', { version: 1, shops: Array.from({ length: 200 }, (_, i) => ({ id: `shop-${i}`, name: `ショップ${i}` })) });
    assert.equal(created.status, 201);
    const owner = await created.json() as { id: string; expiresAt: string };
    assert.ok(Math.abs(Date.parse(owner.expiresAt) - before - 7 * 86400000) < 5000);
    const result = await request(`/${owner.id}`);
    const shared = await result.json() as { list: { shops: unknown[]; items: unknown[] } };
    assert.equal(shared.list.shops.length, 200);
    assert.deepEqual(shared.list.items, []);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal('deleteToken' in owner, false);
    assert.equal((await request(`/${owner.id}`, 'DELETE')).status, 404);
    assert.equal((await request(`/${owner.id}`)).status, 200);
  } finally { db.close(); }
});

test('長い名前400ショップの64KB超のリストも128KB以内なら共有できる', async () => {
  const { db, request } = setup();
  try {
    const shops = Array.from({ length: 400 }, (_, i) => ({ id: `shop-${i}`.padEnd(20, 'x'), name: 'あ'.repeat(80) }));
    const input = { version: 1, shops };
    const bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
    assert.ok(bytes > 64000 && bytes < 128000);
    const created = await request('', 'POST', input);
    assert.equal(created.status, 201);
    const { id } = await created.json() as { id: string };
    const shared = await (await request(`/${id}`)).json() as { list: { shops: unknown[] } };
    assert.deepEqual(shared.list.shops, shops);
    const tooLarge = { version: 1, shops: shops.map((shop) => ({ ...shop, name: 'あ'.repeat(100) })) };
    assert.equal((await request('', 'POST', tooLarge)).status, 413);
  } finally { db.close(); }
});

test('失効したリンクは削除前でも取得不可。日次500件と容量制限を検証する', async () => {
  const { db, request } = setup();
  try {
    const body = { version: 1, shops: [{ id: 'sample', name: '店舗' }] };
    const owner = await (await request('', 'POST', body)).json() as { id: string };
    db.prepare('UPDATE shares SET expires_at = 0').run();
    assert.equal((await request(`/${owner.id}`)).status, 404);
    db.prepare('UPDATE share_limits SET created_count = 499').run();
    assert.equal((await request('', 'POST', body)).status, 201);
    assert.equal((await request('', 'POST', body)).status, 429);
    assert.equal((await request('', 'POST', { version: 1, shops: [], padding: 'x'.repeat(128000) })).status, 413);
    assert.equal((await request('', 'POST', { version: 99 })).status, 400);
    const crossOrigin = await app.request('https://example.test/api/shares', { method: 'POST', headers: { Origin: 'https://other.test' } }, { SHARES_DB: {} as D1Database });
    assert.equal(crossOrigin.status, 403);
  } finally { db.close(); }
});
