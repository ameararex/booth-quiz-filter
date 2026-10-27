import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareIdFromUrl } from './sharing.ts';

test('共有URLから検証済みIDのみを取り出す', () => {
  assert.equal(shareIdFromUrl('https://example.test/?share=' + 'a'.repeat(24)), 'a'.repeat(24));
  for (const url of ['invalid', 'javascript:alert(1)', 'https://example.test/?share=short', 'https://example.test/']) assert.throws(() => shareIdFromUrl(url));
});
