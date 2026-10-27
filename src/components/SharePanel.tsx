import { useState } from 'react';
import { isRecord } from '../lib/filters.ts';
import type { HiddenList } from '../lib/filters.ts';
import { loadSharedList, shareIdFromUrl, shareRequest, SHARE_ID_PATTERN } from '../lib/sharing.ts';

type Owner = { id: string; deleteToken: string; expiresAt: string };
function parseOwner(value: unknown): Owner {
  if (!isRecord(value) || typeof value.id !== 'string' || !SHARE_ID_PATTERN.test(value.id) || typeof value.deleteToken !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(value.deleteToken) || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) throw new Error('共有リンクの管理情報が不正です。');
  return { id: value.id, deleteToken: value.deleteToken, expiresAt: value.expiresAt };
}

export function SharePanel({ list, onPreview, download }: {
  list: HiddenList; onPreview: (list: HiddenList, expiresAt: string) => void; download: (text: string, name: string) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [owner, setOwner] = useState<Owner | null>(null);
  const [urlText, setUrlText] = useState('');
  const shareUrl = owner ? new URL(`/?share=${owner.id}`, window.location.origin).href : '';

  async function createShare() {
    if (!agreed || !list.shops.length) return;
    setBusy(true); setStatus('');
    try {
      const result = parseOwner(await shareRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, shops: list.shops }) }));
      setOwner(result); setAgreed(false);
      setStatus('共有リンクを作成しました。7日で失効します。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '共有に失敗しました。'); }
    finally { setBusy(false); }
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

  async function deleteShare() {
    if (!owner) return;
    setBusy(true); setStatus('');
    try {
      await shareRequest(`/${owner.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${owner.deleteToken}` } });
      setOwner(null); setStatus('共有リンクを無効化しました。自分の非表示設定は変更していません。');
    } catch (error) { setStatus(error instanceof Error ? error.message : '削除できませんでした。'); }
    finally { setBusy(false); }
  }

  return <section className="panel share-panel">
    <h3>URLで移行・共有</h3>
    <p>ショップ設定のコピーを7日間保存し、短い共有リンクを作ります。リンクを知っている人は内容を取得できます。自動同期はしません。</p>
    <label className="share-consent"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />ショップ{list.shops.length}件のID・名前をサーバーへ保存する</label>
    <button className="primary" disabled={busy || !agreed || !list.shops.length} onClick={() => { void createShare(); }}>共有リンクを作る</button>
    <p className="muted">1件64KiBまで。サイト全体の作成上限は1日100リンクです。ショップ件数の200件制限ではありません。</p>
    {owner && <div className="share-output"><label htmlFor="share-output">共有URL</label><input id="share-output" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /><p>有効期限：{new Date(owner.expiresAt).toLocaleString('ja-JP')}</p><p>期限より前に削除したい場合は、管理情報を保管してください。管理情報は相手に渡さないでください。</p><div className="actions"><button onClick={() => download(JSON.stringify(owner, null, 2), 'booth-share-owner.json')}>削除用の管理情報を保存</button><button disabled={busy} onClick={() => { void deleteShare(); }}>この共有リンクを無効化</button></div></div>}
    <form className="share-import" onSubmit={(event) => { event.preventDefault(); void previewUrl(); }}><label htmlFor="share-import-url">共有URLから取り込む</label><div className="search-line"><input id="share-import-url" type="url" value={urlText} onChange={(event) => setUrlText(event.target.value)} placeholder="https://…/?share=…" required /><button disabled={busy || !urlText.trim()} type="submit">内容を確認</button></div></form>
    <details><summary>保管した管理情報で共有リンクを削除する</summary><label className="file-button">管理情報のJSONを選ぶ<input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > 4096) throw new Error('管理情報は4KiB以下です。'); setOwner(parseOwner(JSON.parse(await file.text()))); setStatus('管理情報を読み込みました。上の無効化ボタンで削除できます。'); } catch (error) { setStatus(error instanceof Error ? error.message : '読み込めませんでした。'); } }} /></label></details>
    {status && <p role="status">{status}</p>}
  </section>;
}
