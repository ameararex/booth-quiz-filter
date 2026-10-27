import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { D1Database } from '@cloudflare/workers-types';
import { isRecord, parseList } from '../src/lib/filters.ts';

const SHARE_TTL_SECONDS = 7 * 86400;
const SHARE_MAX_BYTES = 64 * 1024;
const SHARE_DAILY_LIMIT = 100;
type Bindings = { SHARES_DB: D1Database };
type ShareRow = { payload: string; delete_hash: string; expires_at: number };
const idPattern = /^[a-zA-Z0-9_-]{24}$/;
const app = new Hono<{ Bindings: Bindings }>();

function token(bytes: number): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function hash(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

app.use('/api/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  if (['POST', 'DELETE'].includes(c.req.method) && c.req.header('Origin') !== new URL(c.req.url).origin) return c.json({ error: '同じサイトから操作してください。' }, 403);
  await next();
});
app.use('/api/*', bodyLimit({ maxSize: SHARE_MAX_BYTES, onError: (c) => c.json({ error: '共有リストは64KiB以下にしてください。' }, 413) }));

app.post('/api/shares', async (c) => {
  if (!c.req.header('Content-Type')?.startsWith('application/json')) return c.json({ error: 'JSON形式で送信してください。' }, 415);
  let payload: string;
  try {
    const input: unknown = await c.req.json();
    if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.shops) || input.shops.length < 1 || input.shops.length > 5000) throw new Error();
    const list = parseList(JSON.stringify({ version: 1, items: [], shops: input.shops }));
    payload = JSON.stringify(list);
    if (new TextEncoder().encode(payload).byteLength > SHARE_MAX_BYTES) return c.json({ error: '共有リストが64KiBを超えています。JSONファイルを使ってください。' }, 413);
  } catch { return c.json({ error: 'ショップリストの形式が正しくありません。' }, 400); }
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const quota = await c.env.SHARES_DB.prepare(`INSERT INTO share_limits(day, created_count) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET created_count = created_count + 1 WHERE created_count < ? RETURNING created_count`).bind(day, SHARE_DAILY_LIMIT).first();
  if (!quota) return c.json({ error: '本日の共有リンク作成上限に達しました。JSONファイルで移行するか、翌日09:00（日本時間）以降にお試しください。' }, 429);
  const id = token(18);
  const deleteToken = token(32);
  const expiresAt = now + SHARE_TTL_SECONDS;
  const oldDay = new Date((now - 30 * 86400) * 1000).toISOString().slice(0, 10);
  await c.env.SHARES_DB.batch([
    c.env.SHARES_DB.prepare('DELETE FROM shares WHERE id IN (SELECT id FROM shares WHERE expires_at <= ? ORDER BY expires_at LIMIT 20)').bind(now),
    c.env.SHARES_DB.prepare('DELETE FROM share_limits WHERE day IN (SELECT day FROM share_limits WHERE day < ? ORDER BY day LIMIT 1)').bind(oldDay),
    c.env.SHARES_DB.prepare('INSERT INTO shares(id,payload,delete_hash,created_at,expires_at) VALUES (?,?,?,?,?)').bind(id, payload, await hash(deleteToken), now, expiresAt),
  ]);
  return c.json({ version: 1, id, deleteToken, expiresAt: new Date(expiresAt * 1000).toISOString() }, 201);
});

app.get('/api/shares/:id', async (c) => {
  const id = c.req.param('id');
  if (!idPattern.test(id)) return c.json({ error: '共有URLの形式が正しくありません。' }, 400);
  const row = await c.env.SHARES_DB.prepare('SELECT payload,expires_at FROM shares WHERE id = ?').bind(id).first<ShareRow>();
  if (!row || row.expires_at <= Math.floor(Date.now() / 1000)) return c.json({ error: '共有リンクが見つからないか、有効期限が切れています。' }, 404);
  return c.json({ version: 1, list: JSON.parse(row.payload), expiresAt: new Date(row.expires_at * 1000).toISOString() });
});

app.delete('/api/shares/:id', async (c) => {
  const id = c.req.param('id');
  const secret = c.req.header('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (!idPattern.test(id) || !/^[a-zA-Z0-9_-]{43}$/.test(secret)) return c.json({ error: '削除情報の形式が正しくありません。' }, 400);
  const row = await c.env.SHARES_DB.prepare('SELECT delete_hash FROM shares WHERE id = ?').bind(id).first<ShareRow>();
  if (!row || row.delete_hash !== await hash(secret)) return c.json({ error: '削除情報を確認できません。' }, 403);
  await c.env.SHARES_DB.prepare('DELETE FROM shares WHERE id = ?').bind(id).run();
  return c.json({ deleted: true });
});

app.notFound((c) => c.json({ error: 'APIが見つかりません。' }, 404));
app.onError((_error, c) => c.json({ error: '共有機能を利用できません。時間をおくか、JSONファイルを使ってください。' }, 503));
export default app;
