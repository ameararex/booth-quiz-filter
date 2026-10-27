export async function fetchBoothPage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'BoothQuizFilterPrototype/0.1 (manual verification)' },
    signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`BOOTH ${response.status}：取得を停止します。自動再試行しません。Retry-After=${response.headers.get('retry-after') ?? 'なし'}`);
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('HTML以外の応答のため停止します。');
  const html = await response.text();
  if (Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error('HTMLが試作の容量制限を超えています。');
  return html;
}
