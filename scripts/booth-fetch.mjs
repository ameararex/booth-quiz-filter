export async function fetchBoothPage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'BoothQuizFilterPrototype/0.1 (manual verification)' },
    signal: AbortSignal.timeout(20000), redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    let destination = '転送先不明';
    try {
      const target = new URL(response.headers.get('location') ?? '', url);
      destination = `${target.origin}${target.pathname}`;
    } catch { /* 不正な転送先をそのままログへ出さない */ }
    throw new Error(`BOOTH ${response.status}：想定外の転送のため停止します。転送先：${destination}（自動追従しません）`);
  }
  if (!response.ok) throw new Error(`BOOTH ${response.status}：取得を停止します。自動再試行しません。Retry-After=${response.headers.get('retry-after') ?? 'なし'}`);
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('HTML以外の応答のため停止します。');
  const html = await response.text();
  if (Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error('HTMLが試作の容量制限を超えています。');
  return html;
}
