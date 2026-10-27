import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchBoothPage } from './booth-fetch.mjs';

test('403/429では再試行せずエラーで停止する', async () => {
  for (const status of [403, 429]) {
    let calls = 0;
    await assert.rejects(fetchBoothPage('https://booth.pm/', async () => { calls++; return new Response('', { status, headers: { 'retry-after': '60' } }); }), /停止/);
    assert.equal(calls, 1);
  }
});

test('タイムアウト・非HTML・容量超過も再試行せず失敗にする', async () => {
  await assert.rejects(fetchBoothPage('https://booth.pm/', async () => { throw new DOMException('timeout', 'TimeoutError'); }), /timeout/);
  await assert.rejects(fetchBoothPage('https://booth.pm/', async () => new Response('{}', { headers: { 'content-type': 'application/json' } })), /HTML以外/);
  await assert.rejects(fetchBoothPage('https://booth.pm/', async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } })), /容量制限/);
});

test('転送は追従せず、クエリの機密情報を含めずに転送先を案内する', async () => {
  let calls = 0;
  await assert.rejects(fetchBoothPage('https://booth.pm/ja/browse/quiz', async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    return new Response('', { status: 302, headers: { location: '/ja/items?category=quiz&token=secret' } });
  }), (error) => error.message.includes('BOOTH 302') && error.message.includes('https://booth.pm/ja/items') && !error.message.includes('secret'));
  assert.equal(calls, 1);
});
