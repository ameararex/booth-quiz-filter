import { useRef, useState } from 'react';
import { isRecord } from '../lib/filters.ts';
import type { HiddenList } from '../lib/filters.ts';
import { loadSharedList, shareIdFromUrl, shareRequest, SHARE_ID_PATTERN } from '../lib/sharing.ts';

type Share = { id: string; expiresAt: string };
function parseShare(value: unknown): Share {
  if (!isRecord(value) || typeof value.id !== 'string' || !SHARE_ID_PATTERN.test(value.id) || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('共有リンクを確認できません。');
  return { id: value.id, expiresAt: value.expiresAt };
}

export function SharePanel({ list, onPreview }: {
  list: HiddenList; onPreview: (list: HiddenList, expiresAt: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [share, setShare] = useState<Share | null>(null);
  const [urlText, setUrlText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const outputRef = useRef<HTMLInputElement>(null);
  const shareUrl = share ? new URL(`/?share=${share.id}`, window.location.origin).href : '';

  async function createShare() {
    if (busy || !list.shops.length) return;
    setBusy(true); setStatus(''); setCopyStatus('');
    try {
      const result = parseShare(await shareRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, shops: list.shops }) }));
      setShare(result);
      setStatus('共有リンクを作成しました。7日で失効します。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '共有に失敗しました。'); }
    finally { setBusy(false); }
  }

  async function copyUrl() {
    if (!shareUrl || copying) return;
    setCopying(true); setCopyStatus('');
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('URLをコピーしました。');
    } catch {
      outputRef.current?.focus();
      outputRef.current?.select();
      setCopyStatus('コピーできませんでした。選択したURLを手動でコピーしてください。');
    } finally { setCopying(false); }
  }

  async function previewUrl() {
    setBusy(true); setStatus('');
    try {
      const incoming = await loadSharedList(shareIdFromUrl(urlText));
      onPreview(incoming.list, incoming.expiresAt);
      setStatus('取り込む内容を確認してください。まだ既存設定は変更していません。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '共有データを取得できません。'); }
    finally { setBusy(false); }
  }

  return <section className="share-panel">
    <h3>URLで移行・共有</h3>
    <p>非表示ショップのリストをサーバーに保存し、共有URLを作ります。URLを知っている人はリストを取り込めます。有効期限は7日間です。</p>
    <button className="primary" disabled={busy || !list.shops.length} onClick={() => { void createShare(); }}>共有リンクを作る</button>
    {share && <div className="share-output"><label htmlFor="share-output">共有URL</label><div className="share-output-row"><input ref={outputRef} id="share-output" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /><button type="button" disabled={copying} onClick={() => { void copyUrl(); }}>URLをコピー</button></div><p className="copy-status" role="status">{copyStatus}</p><p>有効期限：{new Date(share.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST</p></div>}
    <form className="share-import" onSubmit={(event) => { event.preventDefault(); void previewUrl(); }}><label htmlFor="share-import-url">共有URLから取り込む</label><div className="search-line"><input id="share-import-url" type="url" value={urlText} onChange={(event) => setUrlText(event.target.value)} placeholder="https://…/?share=…" required /><button disabled={busy || !urlText.trim()} type="submit">内容を確認</button></div></form>
    {status && <p role="status">{status}</p>}
  </section>;
}
