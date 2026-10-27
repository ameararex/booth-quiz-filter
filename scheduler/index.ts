type Env = { GITHUB_DISPATCH_TOKEN: string; SCHEDULER_ENABLED: string; COLLECTION_MODE: string };
const workflow = 'https://api.github.com/repos/ameararex/booth-quiz-filter/actions/workflows/collect.yml';

export async function dispatchCollection(env: Env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<string> {
  if (env.SCHEDULER_ENABLED !== 'true') return 'disabled';
  if (!env.GITHUB_DISPATCH_TOKEN || !['probe', 'full'].includes(env.COLLECTION_MODE)) throw new Error('Scheduler configuration is incomplete');
  const headers = { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Que-Fil-Scheduler', 'X-GitHub-Api-Version': '2026-03-10' };
  const response = await fetchImpl(`${workflow}/runs?per_page=10&event=workflow_dispatch`, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GitHub run check failed (${response.status})`);
  const data = await response.json() as { workflow_runs?: { status: string; created_at: string }[] };
  if (!Array.isArray(data.workflow_runs) || data.workflow_runs.some((run) => typeof run.status !== 'string' || !Number.isFinite(Date.parse(run.created_at)))) throw new Error('Unexpected GitHub run response');
  // 実行中・待機中、または直近11時間の起動があれば重複取得を避ける。失敗時も自動再試行しない。
  if (data.workflow_runs.some((run) => run.status !== 'completed' || now - Date.parse(run.created_at) < 11 * 3600000)) return 'skipped';
  const dispatched = await fetchImpl(`${workflow}/dispatches`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main', inputs: { mode: env.COLLECTION_MODE } }), redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (dispatched.status !== 200 && dispatched.status !== 204) throw new Error(`GitHub dispatch failed (${dispatched.status})`);
  return 'accepted';
}

export default {
  async scheduled(_controller: unknown, env: Env) {
    console.log(`Que-Fil collection dispatch: ${await dispatchCollection(env)}`);
  },
  fetch() { return new Response('Not found', { status: 404 }); },
};
