import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { loadCatalog, SORT_OPTIONS } from './lib/catalog.ts';

import type { Catalog, Product } from './lib/catalog.ts';
import { combineLists, matchesSearch, MAX_IMPORT_BYTES, parseList } from './lib/filters.ts';
import type { HiddenEntry, HiddenList, ImportMode } from './lib/filters.ts';
import { useHiddenList } from './hooks/useHiddenList.ts';
import { ProductCard } from './components/ProductCard.tsx';
import { ViewToggle } from './components/ViewToggle.tsx';
import { SharePanel } from './components/SharePanel.tsx';
import { loadSharedList, SHARE_ID_PATTERN } from './lib/sharing.ts';
import { sortProducts } from './lib/presentation.ts';
import type { SortOrder } from './lib/presentation.ts';

const PAGE_SIZE = 60;

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RemovedEntries({ title, entries, onRestore, disabled }: {
  title: string; entries: HiddenEntry[]; onRestore: (id: string) => void; disabled: boolean;
}) {
  return <details className="panel removed-section">
    <summary><h3>{title}<span className="count">{entries.length}</span></h3></summary>
    {entries.length === 0 ? <p className="muted">まだ登録されていません。</p> :
      <ul className="removed-list">{entries.map((entry) => <li key={entry.id}>
        <div><strong>{entry.name}</strong><small>{entry.id}</small></div>
        <button disabled={disabled} onClick={() => onRestore(entry.id)} aria-label={`${entry.name}の非表示を解除`}>解除</button>
      </li>)}</ul>}
  </details>;
}

export function App() {
  const hidden = useHiddenList();
  const [view, setView] = useState<'catalog' | 'settings'>('catalog');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<SortOrder>('new');
  const [notice, setNotice] = useState('');
  const [pendingHide, setPendingHide] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [incoming, setIncoming] = useState<HiddenList | null>(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const importSequence = useRef(0);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const scrollAfterHide = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const position = scrollAfterHide.current;
    if (position && !pendingHide) {
      window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
      scrollAfterHide.current = null;
    }
  }, [hidden.list, pendingHide]);

  useEffect(() => {
    if (!pendingHide) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const timer = window.setTimeout(() => {
      scrollAfterHide.current = { x: window.scrollX, y: window.scrollY };
      setPendingHide(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pendingHide]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function previewShare(list: HiddenList, expiresAt: string) {
    setIncoming(list); setImportMode('merge'); setReplaceConfirmed(false); setImportError('');
    setView('settings');
    setNotice(`共有リストの内容を確認してください。有効期限：${new Date(expiresAt).toLocaleString('ja-JP')}。まだ既存設定は変更していません。`);
  }

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get('share');
    if (!id) return;
    const controller = new AbortController();
    setView('settings');
    if (!SHARE_ID_PATTERN.test(id)) { setNotice('共有URLの形式が正しくありません。既存設定は変更していません。'); return; }
    setNotice('共有リストを読み込んでいます…');
    loadSharedList(id, controller.signal).then((shared) => { if (!controller.signal.aborted) previewShare(shared.list, shared.expiresAt); }).catch((error: unknown) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '共有リストを読み込めません。'); });
    return () => controller.abort();
  }, []);

  useEffect(() => { if (incoming) previewHeadingRef.current?.focus(); }, [incoming]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setCatalog(null);
    loadCatalog(controller.signal).then(setCatalog).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '商品データを取得できませんでした。');
    });
    return () => controller.abort();
  }, [reload]);

  const hiddenShops = new Set(hidden.list.shops.map((entry) => entry.id));
  const scopedProducts = catalog ? sortProducts(catalog.products, catalog.mode, sortOrder, catalog.sorts) : [];
  // 保存は即時に行い、消えるアニメーションの間だけ対象ショップの商品を残す。
  const available = scopedProducts.filter((product) => !hiddenShops.has(product.shopId) || product.shopId === pendingHide);
  const results = available.filter((product) => matchesSearch(product.name, product.shopName, query));
  const activeSnapshot = catalog?.sorts?.new;
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const preview = incoming ? combineLists(hidden.list, incoming, importMode) : null;
  const addedShops = incoming?.shops.filter((entry) => !hiddenShops.has(entry.id)).length ?? 0;
  const removedShops = incoming ? hidden.list.shops.filter((entry) => !incoming.shops.some((candidate) => candidate.id === entry.id)).length : 0;

  function hide(product: Product) {
    const entry = { id: product.shopId, name: product.shopName };
    if (hidden.blocked || pendingHide || hiddenShops.has(entry.id)) return;
    setPendingHide(entry.id);
    scrollAfterHide.current = { x: window.scrollX, y: window.scrollY };
    if (hidden.update({ ...hidden.list, shops: [...hidden.list.shops, entry] })) {
      setNotice('');
      setToast({ id: Date.now(), message: `「${entry.name}」を非表示にしました` });
      searchRef.current?.focus({ preventScroll: true });
    } else { scrollAfterHide.current = null; setPendingHide(null); }
  }

  function restore(id: string) {
    if (hidden.update({ ...hidden.list, shops: hidden.list.shops.filter((entry) => entry.id !== id) })) {
      setNotice('ショップの非表示を解除しました。');
      settingsHeadingRef.current?.focus();
    }
  }

  async function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const sequence = ++importSequence.current;
    setImportBusy(true);
    setImportError('');
    setIncoming(null);
    setImportMode('merge');
    setReplaceConfirmed(false);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('ファイルは2MB以下にしてください。');
      const next = parseList(await file.text());
      if (sequence === importSequence.current) setIncoming(next);
    } catch (reason) {
      if (sequence === importSequence.current) setImportError(reason instanceof Error ? reason.message : 'ファイルを読み込めませんでした。');
    } finally { if (sequence === importSequence.current) setImportBusy(false); }
  }

  function applyImport() {
    if (!preview || hidden.blocked) return;
    if (importMode === 'replace' && !replaceConfirmed) return;
    if (hidden.update(preview)) {
      setIncoming(null);
      setNotice('リストを取り込みました。保存状態も確認してください。');
    }
  }

  return <>
    <a className="skip-link" href="#main">本文へ移動</a>
    <header className="site-header"><div className="shell header-inner">
      <h1><a className="site-title" href="/">Que-Fil</a><span className="site-subtitle">キューフィル<span className="subtitle-separator"> </span><br className="mobile-break" />クイズプレイヤーのためのBOOTH検索サービス</span></h1>
      <nav aria-label="メニュー"><button aria-pressed={view === 'settings'} onClick={() => { setView(view === 'settings' ? 'catalog' : 'settings'); setNotice(''); }}>{view === 'settings' ? '商品一覧に戻る' : <>非表示リスト <span>{hidden.list.shops.length}</span></>}</button></nav>
    </div></header>
    <div className="catalog-notice"><div className="shell">掲載情報は取得時点のものです。<br className="mobile-break" />価格・販売状況はBOOTHで最終確認してください。</div></div>
      <main className="shell" id="main" tabIndex={-1}>
        {hidden.status && (view === 'settings' || !hidden.saved) && <div className={`save-status ${hidden.saved ? '' : 'warning'}`} role="status">{hidden.status}</div>}
        {hidden.blocked && <div className="panel recovery" role="alert">
          <h2>保存済み設定を保護しています</h2><p>元のデータを自動で上書きしません。必要なら元データを書き出した後、保存領域を初期化してください。</p>
          <div className="actions">{hidden.raw !== null && <button onClick={() => download(hidden.raw!, 'booth-quiz-filter-recovery.json')}>元データを書き出す</button>}
          <button onClick={() => { if (window.confirm('読み込めなかった保存済み設定を削除し、空のリストから始めますか？')) hidden.recover(); }}>保存領域を初期化</button></div>
        </div>}
        <p className="announcement" role="status">{notice}</p>

        {view === 'catalog' ? <>
          <h2 className="sr-only">商品を探す</h2>
          <form className="search-panel" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); }}><div className="search-label-row"><div className="search-label-group"><label htmlFor="search">商品名・ショップ名</label><span className="search-scope">（「タグ：クイズ」の商品が検索できます）</span></div><span className="last-updated">最終更新：{catalog?.fetchedAt ? <time dateTime={catalog.fetchedAt}>{new Date(catalog.fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST</time> : catalog?.mode === 'sample' ? '未取得（サンプル）' : error ? '取得できません' : '読み込み中'}</span></div><div className="search-line"><input ref={searchRef} id="search" type="search" placeholder="検索する言葉を入力" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><button type="submit" className="solid">検索</button></div><p className="search-help">スペース区切りでAND検索。全角・半角、英字の大小を区別しません。</p></form>
          {!catalog && !error && <div className="empty panel" role="status">商品データを読み込んでいます…</div>}
          {error && <div className="empty panel" role="alert"><h3>商品データを読み込めませんでした</h3><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>もう一度読み込む</button></div>}
          {catalog && <>
            <div className="toolbar"><p className="result-summary" role="status"><strong>{results.length}</strong>件<span className="hidden-summary">非表示 {scopedProducts.length - available.length}件</span></p><div className="display-controls"><select aria-label="並び順" value={catalog.mode === 'sample' || catalog.sorts ? sortOrder : 'source'} onChange={(event) => { setSortOrder(event.target.value as SortOrder); setPage(1); }}>{catalog.mode === 'sample' || catalog.sorts ? Object.entries(SORT_OPTIONS).map(([key, label]) => <option key={key} value={key} disabled={key === 'wish_lists' ? !catalog.products.some((product) => product.likes != null) : key.startsWith('price_') ? !catalog.products.some((product) => product.priceYen != null) : false}>{label}{catalog.mode === 'sample' ? '（仮）' : ''}</option>) : <option value="source">{catalog.orderLabel}</option>}</select><ViewToggle value={display} onChange={setDisplay} /></div></div>
            {activeSnapshot && <p className="order-note">{activeSnapshot.hasMore ? `BOOTHで取得した${activeSnapshot.label}の先頭${activeSnapshot.ids.length}件が対象です。検索はこの範囲内のみです。続きの商品は未取得です。` : `${activeSnapshot.label}で最後のページまで取得した${activeSnapshot.ids.length}件が対象です。取得中の変更は反映が前後する場合があります。`} <a href={activeSnapshot.url} target="_blank" rel="noopener noreferrer">BOOTHで確認 ↗</a></p>}
            {sortOrder !== 'new' && sortOrder !== 'source' && <p className="sort-help">価格は表示の最低額で比較します。同じ価格・スキ数の商品は新着順、不明な値は末尾に表示します。</p>}
            {results.length === 0 ? <div className="empty panel"><h3>表示できる商品がありません</h3><p>検索語を変えるか、非表示の設定を確認してください。</p><div className="actions"><button onClick={() => { setQuery(''); setPage(1); }}>検索を解除</button><button onClick={() => setView('settings')}>非表示を確認</button></div></div> : <div className={`products ${display === 'list' ? 'list' : ''}`}>{visible.map((product) => <ProductCard key={product.id} product={product} mode={catalog.mode} hiding={pendingHide === product.shopId} disabled={hidden.blocked || Boolean(pendingHide)} onHide={() => hide(product)} />)}</div>}
            {pages > 1 && <nav className="pagination" aria-label="商品一覧のページ"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>前へ</button><span>{currentPage} / {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>次へ</button></nav>}
          </>}
        </> : <>
          <div className="section-heading"><h2 ref={settingsHeadingRef} tabIndex={-1}>非表示の管理</h2></div>
          <div className="device-note panel"><h3>このブラウザだけの設定です</h3><p>BOOTH公式の非表示リストとは別です。端末・ブラウザ間では自動同期されず、ブラウザのデータ消去などで失われることがあります。</p><p>PC・iPhone・iPad間の移行には、共有URLまたはJSONファイルが使えます。バックアップとして保管する場合は、JSONファイルを書き出してください。</p></div>
          <RemovedEntries title="非表示のショップ" entries={hidden.list.shops} disabled={hidden.blocked} onRestore={restore} />
          <SharePanel list={hidden.list} onPreview={previewShare} />
          <section className="panel transfer"><h3>バックアップ・端末間の移行</h3><p>非表示にしたショップをファイルに保存して、バックアップや別の端末への移行に使えます。</p>
            <div className="actions"><button className="primary" onClick={() => download(JSON.stringify(hidden.list, null, 2), 'booth-quiz-filter-hidden-v1.json')}>JSONを書き出す</button><label className={`file-button ${hidden.blocked ? 'disabled' : ''}`}>JSONを選んで取り込む<input type="file" accept="application/json,.json" disabled={hidden.blocked} onChange={(event) => { void readImport(event); }} /></label></div>
            <p className="muted">ファイル容量は2MBまで。選んだだけでは既存設定を変更しません。</p>
            {importBusy && <p role="status">ファイルを確認しています…</p>}{importError && <p className="error-text" role="alert">{importError} 既存設定は変更していません。</p>}
            {incoming && preview && <div className="import-preview"><h4 ref={previewHeadingRef} tabIndex={-1}>取り込む内容を確認</h4><p>取り込むショップ：{incoming.shops.length}件</p><fieldset><legend>既存リストの扱い</legend><label><input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => { setImportMode('merge'); setReplaceConfirmed(false); }} />追加する（既存設定を残す）</label><label><input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => { setImportMode('replace'); setReplaceConfirmed(false); }} />置き換える</label></fieldset>
              {importMode === 'merge' ? <p>新しく追加：ショップ{addedShops}件。登録済みのショップは追加しません。</p> : <p className="error-text">現在のリストから外れるショップ：{removedShops}件。</p>}
              <p><strong>適用後：ショップ{preview.shops.length}件</strong></p>
              <details><summary>名前とIDを確認する</summary><ul className="preview-list">{incoming.shops.map((entry) => <li key={`shop-${entry.id}`}>ショップ：{entry.name} <small>({entry.id})</small></li>)}</ul></details>
              {importMode === 'replace' && <label className="replace-confirm"><input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />現在のリストからショップ{removedShops}件が外れることを確認しました</label>}
              <div className="actions"><button className="primary" disabled={hidden.blocked || (importMode === 'replace' && !replaceConfirmed)} onClick={applyImport}>この内容で取り込む</button><button onClick={() => setIncoming(null)}>キャンセル</button></div>
            </div>}
          </section>
        </>}
      </main>
    <footer className="shell footer"><strong>Que-Fil（キューフィル）</strong><p>BOOTH・ピクシブ株式会社の公式サービスではありません。</p>
      <details className="disclaimer"><summary>掲載情報・運営方針・免責事項</summary>
        {catalog && <><p>取得元：{catalog.sourceUrl ? <a href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer">BOOTH公開ページ</a> : '架空のサンプルデータ'}</p><p>{catalog.coverage}</p></>}
        <p>本サービスは、<a href="https://booth.pm/guidelines" target="_blank" rel="noopener noreferrer">BOOTHのガイドライン</a>に従って運営する方針です。BOOTH運営から本サービスに関する指摘を受けた場合は、直ちにサービスを閉鎖し、情報の収集・提供を停止します。</p>
        <p>掲載情報は取得時点のもので、最新の情報ではない場合があります。正確性・完全性・最新性を保証するものではありません。価格、販売状況、商品内容などの最終確認と購入は、BOOTHの商品ページで行ってください。</p>
        <p>商品画像・商品名などの権利は、それぞれの権利者に帰属します。非表示設定は利用者個人の好みを整理するためのもので、商品やショップの品質を評価・断定するものではありません。</p>
        <p>本サービスは、予告なく内容の変更・提供の中断・終了を行うことがあります。</p>
      </details>
    </footer>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast && <div className="toast" key={toast.id}>{toast.message}{!hidden.saved && <span>保存できませんでした。JSONを書き出して保管してください。</span>}</div>}</div>
  </>;
}
