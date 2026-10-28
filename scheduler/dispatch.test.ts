import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCollection } from './index.ts';

const env = { SCHEDULER_ENABLED: 'true', COLLECTION_MODE: 'probe', GITHUB_DISPATCH_TOKEN: 'test-secret' };
test('6時間前の完了ジョブは次回を妨げず、5時間以内の起動は重複させない', async () => {
  const now = Date.parse('2026-10-27T13:00:00Z');
  for (const [elapsed, expected] of [[6 * 3600000, 'accepted'], [5 * 3600000 - 1, 'skipped']] as const) {
    let calls = 0;
    const result = await dispatchCollection(env, async () => {
      calls++;
      return calls === 1 ? Response.json({ workflow_runs: [{ status: 'completed', created_at: new Date(now - elapsed).toISOString() }] }) : new Response(null, { status: 204 });
    }, now);
    assert.equal(result, expected);
    assert.equal(calls, expected === 'accepted' ? 2 : 1);
  }
});
test('停止中は通信せず、実行中・直近の起動があれば再取得しない', async () => {
  assert.equal(await dispatchCollection({ ...env, SCHEDULER_ENABLED: 'false' }, async () => { throw new Error('unexpected'); }), 'disabled');
  for (const run of [{ status: 'in_progress', created_at: '2026-01-01T00:00:00Z' }, { status: 'completed', created_at: new Date().toISOString() }]) {
    let calls = 0;
    assert.equal(await dispatchCollection(env, async () => { calls++; return Response.json({ workflow_runs: [run] }); }), 'skipped');
    assert.equal(calls, 1);
  }
});
test('実行受付と完了を区別し、起動モードと固定のmainを送る', async () => {
  let calls = 0;
  const result = await dispatchCollection(env, async (url, init) => {
    calls++;
    assert.ok(String(url).startsWith('https://api.github.com/repos/ameararex/booth-quiz-filter/'));
    assert.equal(init?.redirect, 'manual', 'Workersで対応する転送モードを両方の通信で使う');
    if (calls === 1) return Response.json({ workflow_runs: [] });
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { ref: 'main', inputs: { mode: 'probe' } });
    return Response.json({ workflow_run_id: 123, run_url: 'https://api.github.com/repos/ameararex/booth-quiz-filter/actions/runs/123' });
  });
  assert.equal(result, 'accepted');
  assert.equal(calls, 2);
});
test('API拒否・不正応答・タイムアウトは自動再試行しない', async () => {
  for (const response of [() => new Response('', { status: 403 }), () => Response.json({}), () => Response.json({ workflow_runs: [{ status: 'completed', created_at: 'invalid' }] })]) {
    let calls = 0;
    await assert.rejects(dispatchCollection(env, async () => { calls++; return response(); }));
    assert.equal(calls, 1);
  }
  await assert.rejects(dispatchCollection(env, async () => { throw new Error('timeout'); }), /timeout/);
});

test('履歴取得・起動要求の3xxは転送先へ追従せず停止する', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    for (const redirectAt of [1, 2]) {
      let calls = 0;
      await assert.rejects(dispatchCollection(env, async (_url, init) => {
        calls++;
        assert.equal(init?.redirect, 'manual');
        if (calls === redirectAt) return new Response(null, { status, headers: { Location: 'https://unexpected.example/' } });
        return Response.json({ workflow_runs: [] });
      }), new RegExp(`GitHub ${redirectAt === 1 ? 'run check' : 'dispatch'} failed \\(${status}\\)`));
      assert.equal(calls, redirectAt, 'エラー後の転送・再試行・起動要求を行わない');
    }
  }
});
