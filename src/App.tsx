import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { loadCatalog } from './lib/catalog.ts';
import type { Catalog, Product } from './lib/catalog.ts';
import { combineLists, matchesSearch, MAX_IMPORT_BYTES, parseList } from './lib/filters.ts';
import type { HiddenEntry, HiddenList, ImportMode } from './lib/filters.ts';
import { useHiddenList } from './hooks/useHiddenList.ts';
import { ProductCard } from './components/ProductCard.tsx';
import { ViewToggle } from './components/ViewToggle.tsx';
import { sortProducts } from './lib/presentation.ts';
import type { SortOrder } from './lib/presentation.ts';

const PAGE_SIZE = 12;

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
  return <section className="panel removed-section">
    <h3>{title}<span className="count">{entries.length}</span></h3>
    {entries.length === 0 ? <p className="muted">まだ登録されていません。</p> :
      <ul className="removed-list">{entries.map((entry) => <li key={entry.id}>
        <div><strong>{entry.name}</strong><small>{entry.id}</small></div>
        <button disabled={disabled} onClick={() => onRestore(entry.id)} aria-label={`${entry.name}の非表示を解除`}>解除</button>
      </li>)}</ul>}
  </section>;
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
  const [incoming, setIncoming] = useState<HiddenList | null>(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const importSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setCatalog(null);
    loadCatalog(controller.signal).then(setCatalog).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '商品データを取得できませんでした。');
    });
    return () => controller.abort();
  }, [reload]);

  const hiddenItems = new Set(hidden.list.items.map((entry) => entry.id));
  const hiddenShops = new Set(hidden.list.shops.map((entry) => entry.id));
  const available = catalog?.products.filter((product) => !hiddenItems.has(product.id) && !hiddenShops.has(product.shopId)) ?? [];
  const results = sortProducts(available.filter((product) => matchesSearch(product.name, product.shopName, query)), catalog?.mode ?? 'sample', sortOrder);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const preview = incoming ? combineLists(hidden.list, incoming, importMode) : null;
  const addedItems = incoming?.items.filter((entry) => !hiddenItems.has(entry.id)).length ?? 0;
  const addedShops = incoming?.shops.filter((entry) => !hiddenShops.has(entry.id)).length ?? 0;
  const removedItems = incoming ? hidden.list.items.filter((entry) => !incoming.items.some((candidate) => candidate.id === entry.id)).length : 0;
  const removedShops = incoming ? hidden.list.shops.filter((entry) => !incoming.shops.some((candidate) => candidate.id === entry.id)).length : 0;

  function hide(product: Product, kind: 'items' | 'shops') {
    const entry = kind === 'items' ? { id: product.id, name: product.name } : { id: product.shopId, name: product.shopName };
    if (hidden.list[kind].some((candidate) => candidate.id === entry.id)) return;
    if (hidden.update({ ...hidden.list, [kind]: [...hidden.list[kind], entry] })) {
      setNotice(`「${entry.name}」を非表示にしました。非表示の管理から解除できます。`);
      searchRef.current?.focus();
    }
  }

  function restore(id: string, kind: 'items' | 'shops') {
    if (hidden.update({ ...hidden.list, [kind]: hidden.list[kind].filter((entry) => entry.id !== id) })) {
      setNotice('非表示を解除しました。ショップまたは商品が別途非表示の場合は、そちらの解除も必要です。');
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
      if (file.size > MAX_IMPORT_BYTES) throw new Error('ファイルは2MiB以下にしてください。');
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
      <h1>クイズ検索<span>BOOTHの非公式検索補助</span></h1>
      <nav aria-label="メニュー"><button aria-pressed={view === 'settings'} onClick={() => { setView(view === 'settings' ? 'catalog' : 'settings'); setNotice(''); }}>{view === 'settings' ? '商品一覧に戻る' : <>非表示リスト <span>{hidden.list.items.length + hidden.list.shops.length}</span></>}</button><a className="mock-link" href="/mockups/catalog.html">デザインモック</a></nav>
    </div></header>
    <div className="mock-notice"><div className="shell">{catalog?.mode === 'live' ? '掲載情報は取得時点のものです。価格・販売状況はBOOTHで最終確認してください。' : 'サンプル版：商品・表紙画像はすべて架空です。BOOTHから取得した情報ではありません。'}</div></div>
      <main className="shell" id="main" tabIndex={-1}>
        <div className={`save-status ${hidden.saved ? '' : 'warning'}`} role="status">{hidden.status}</div>
        {hidden.blocked && <div className="panel recovery" role="alert">
          <h2>保存済み設定を保護しています</h2><p>元のデータを自動で上書きしません。必要なら元データを書き出した後、保存領域を初期化してください。</p>
          <div className="actions">{hidden.raw !== null && <button onClick={() => download(hidden.raw!, 'booth-quiz-filter-recovery.json')}>元データを書き出す</button>}
          <button onClick={() => { if (window.confirm('読み込めなかった保存済み設定を削除し、空のリストから始めますか？')) hidden.recover(); }}>保存領域を初期化</button></div>
        </div>}
        <p className="announcement" role="status">{notice}</p>

        {view === 'catalog' ? <>
          <h2 className="sr-only">商品を探す</h2>
          <form className="search-panel" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); }}><label htmlFor="search">商品名・ショップ名</label><div className="search-line"><input ref={searchRef} id="search" type="search" placeholder="検索する言葉を入力" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><button type="submit" className="solid">検索</button></div><p className="search-help">スペース区切りでAND検索。全角・半角、英字の大小を区別しません。</p></form>
          {!catalog && !error && <div className="empty panel" role="status">商品データを読み込んでいます…</div>}
          {error && <div className="empty panel" role="alert"><h3>商品データを読み込めませんでした</h3><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>もう一度読み込む</button></div>}
          {catalog && <>
            <div className="toolbar"><p className="result-summary" role="status"><strong>{results.length}</strong>件<span className="hidden-summary">非表示 {catalog.products.length - available.length}件</span></p><div className="display-controls"><select aria-label="並び順" value={catalog.mode === 'sample' ? sortOrder : 'source'} onChange={(event) => { setSortOrder(event.target.value as SortOrder); setPage(1); }}>{catalog.mode === 'sample' ? <><option value="new">新着順（仮）</option><option value="popular">人気順（仮）</option></> : <option value="source">{catalog.orderLabel}</option>}</select><ViewToggle value={display} onChange={setDisplay} /></div></div>
            {catalog.mode === 'sample' && <p className="order-note">並び順は操作確認用の仮設定です。BOOTHの新着順・人気順を再現したものではありません。</p>}
            {results.length === 0 ? <div className="empty panel"><h3>表示できる商品がありません</h3><p>検索語を変えるか、非表示の設定を確認してください。</p><div className="actions"><button onClick={() => { setQuery(''); setPage(1); }}>検索を解除</button><button onClick={() => setView('settings')}>非表示を確認</button></div></div> : <div className={`products ${display === 'list' ? 'list' : ''}`}>{visible.map((product) => <ProductCard key={product.id} product={product} mode={catalog.mode} disabled={hidden.blocked} onHide={(kind) => hide(product, kind)} />)}</div>}
            {pages > 1 && <nav className="pagination" aria-label="商品一覧のページ"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>前へ</button><span>{currentPage} / {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>次へ</button></nav>}
            <div className="source-note"><strong>データについて</strong><p>{catalog.coverage}</p><p>取得元：{catalog.sourceUrl ? <a href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer">BOOTH公開ページ</a> : '架空のサンプルデータ'}<br />最終取得日時：{catalog.fetchedAt ? new Date(catalog.fetchedAt).toLocaleString('ja-JP') : '該当なし（未取得）'}</p><p>実データ公開後も、価格や販売状況の最終確認・購入はBOOTHの商品ページで行ってください。</p></div>
          </>}
        </> : <>
          <div className="section-heading"><h2 ref={settingsHeadingRef} tabIndex={-1}>非表示の管理</h2></div>
          <div className="device-note panel"><h3>このブラウザだけの設定です</h3><p>BOOTH公式の非表示リストとは別です。端末・ブラウザ間では自動同期されず、ブラウザのデータ消去などで失われることがあります。</p><p>PC・iPhone・iPad間の移行やバックアップには、JSONの書き出し・取り込みを使ってください。固定の200件制限はありませんが、保存容量は有限です。</p></div>
          <RemovedEntries title="非表示の商品" entries={hidden.list.items} disabled={hidden.blocked} onRestore={(id) => restore(id, 'items')} />
          <RemovedEntries title="非表示のショップ" entries={hidden.list.shops} disabled={hidden.blocked} onRestore={(id) => restore(id, 'shops')} />
          <section className="panel transfer"><h3>バックアップ・端末間の移行</h3><p>バージョン1のJSONファイルで移行します。サンプルの商品・ショップ設定も含まれます。</p>
            <div className="actions"><button className="primary" onClick={() => download(JSON.stringify(hidden.list, null, 2), 'booth-quiz-filter-hidden-v1.json')}>JSONを書き出す</button><label className={`file-button ${hidden.blocked ? 'disabled' : ''}`}>JSONを選んで取り込む<input type="file" accept="application/json,.json" disabled={hidden.blocked} onChange={(event) => { void readImport(event); }} /></label></div>
            <p className="muted">ファイル容量は2MiBまで。選んだだけでは既存設定を変更しません。</p>
            {importBusy && <p role="status">ファイルを確認しています…</p>}{importError && <p className="error-text" role="alert">{importError} 既存設定は変更していません。</p>}
            {incoming && preview && <div className="import-preview"><h4>取り込む内容を確認</h4><p>重複除去後：商品{incoming.items.length}件・ショップ{incoming.shops.length}件</p><fieldset><legend>既存リストの扱い</legend><label><input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => { setImportMode('merge'); setReplaceConfirmed(false); }} />追加する（既存設定を残す）</label><label><input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => { setImportMode('replace'); setReplaceConfirmed(false); }} />置き換える</label></fieldset>
              {importMode === 'merge' ? <p>新しく追加：商品{addedItems}件・ショップ{addedShops}件。既存IDとの重複は追加しません。</p> : <p className="error-text">既存リストから外れる設定：商品{removedItems}件・ショップ{removedShops}件。</p>}
              <p><strong>適用後：商品{preview.items.length}件・ショップ{preview.shops.length}件</strong></p>
              <details><summary>名前とIDを確認する</summary><ul className="preview-list">{incoming.items.map((entry) => <li key={`item-${entry.id}`}>商品：{entry.name} <small>({entry.id})</small></li>)}{incoming.shops.map((entry) => <li key={`shop-${entry.id}`}>ショップ：{entry.name} <small>({entry.id})</small></li>)}</ul></details>
              {importMode === 'replace' && <label className="replace-confirm"><input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />既存のうち商品{removedItems}件・ショップ{removedShops}件が外れることを確認しました</label>}
              <div className="actions"><button className="primary" disabled={hidden.blocked || (importMode === 'replace' && !replaceConfirmed)} onClick={applyImport}>この内容で取り込む</button><button onClick={() => setIncoming(null)}>キャンセル</button></div>
            </div>}
          </section>
        </>}
      </main>
    <footer className="shell footer"><strong>BOOTHクイズ検索（仮）</strong><p>BOOTH・ピクシブ株式会社の公式サービスではありません。現在はサンプルデータでの試作段階です。</p></footer>
  </>;
}
