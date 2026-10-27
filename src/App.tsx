import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { loadCatalog } from './lib/catalog.ts';
import type { Catalog, Product } from './lib/catalog.ts';
import { combineLists, matchesSearch, MAX_IMPORT_BYTES, parseList } from './lib/filters.ts';
import type { HiddenEntry, HiddenList, ImportMode } from './lib/filters.ts';
import { useHiddenList } from './hooks/useHiddenList.ts';

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
  const [notice, setNotice] = useState('');
  const [incoming, setIncoming] = useState<HiddenList | null>(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
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
  const results = available.filter((product) => matchesSearch(product.name, product.shopName, query));
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
      <a className="brand" href="/" aria-label="BOOTHクイズ検索 ホーム"><span className="brand-mark" aria-hidden="true">Q</span><span>BOOTHクイズ検索<small>非公式の検索補助サイト・試作版</small></span></a>
      <span className="prototype-tag">PROTOTYPE</span>
    </div></header>

    <div className="shell layout">
      <aside className="sidebar">
        <p className="eyebrow">自分に合う一冊を</p>
        <h1>クイズを探す。<br />好みで整える。</h1>
        <p className="sidebar-copy">気になる商品を探しながら、表示する商品を自分の好みに合わせて整理できます。</p>
        <nav className="view-nav" aria-label="表示の切り替え">
          <button aria-pressed={view === 'catalog'} onClick={() => setView('catalog')}>商品を探す<span aria-hidden="true">→</span></button>
          <button aria-pressed={view === 'settings'} onClick={() => setView('settings')}>非表示の管理<span className="nav-count">{hidden.list.items.length + hidden.list.shops.length}</span></button>
        </nav>
        <div className="sidebar-note"><strong>非表示は、あなたの好みです。</strong><p>商品の品質を評価するものではありません。いつでも解除できます。</p></div>
      </aside>

      <main id="main" tabIndex={-1}>
        <div className="sample-banner"><span className="badge">サンプル版</span><p>現在は架空の商品で操作を試せます。BOOTHから取得した商品情報ではありません。</p></div>
        <div className={`save-status ${hidden.saved ? '' : 'warning'}`} role="status">{hidden.status}</div>
        {hidden.blocked && <div className="panel recovery" role="alert">
          <h2>保存済み設定を保護しています</h2><p>元のデータを自動で上書きしません。必要なら元データを書き出した後、保存領域を初期化してください。</p>
          <div className="actions">{hidden.raw !== null && <button onClick={() => download(hidden.raw!, 'booth-quiz-filter-recovery.json')}>元データを書き出す</button>}
          <button onClick={() => { if (window.confirm('読み込めなかった保存済み設定を削除し、空のリストから始めますか？')) hidden.recover(); }}>保存領域を初期化</button></div>
        </div>}
        <p className="announcement" role="status">{notice}</p>

        {view === 'catalog' ? <>
          <div className="section-heading"><div><p className="eyebrow">CATALOG</p><h2>商品を探す</h2></div><span className="muted">{catalog?.orderLabel ?? 'サンプルの表示順'}</span></div>
          <div className="search-panel panel"><label htmlFor="search">商品名・ショップ名で検索</label><div className="search-row"><input ref={searchRef} id="search" type="search" placeholder="例：大会記録、文学、ショップ名" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><button disabled={!query} onClick={() => { setQuery(''); setPage(1); searchRef.current?.focus(); }}>クリア</button></div><p className="muted">スペースで区切ると、すべての語を含む商品を表示します。全角・半角、英字の大小を区別しません。</p></div>
          {!catalog && !error && <div className="empty panel" role="status">商品データを読み込んでいます…</div>}
          {error && <div className="empty panel" role="alert"><h3>商品データを読み込めませんでした</h3><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>もう一度読み込む</button></div>}
          {catalog && <>
            <div className="result-summary" role="status"><span><strong>{results.length}</strong> 件表示 <span className="muted">/ 全{catalog.products.length}件</span></span><span className="muted">非表示 {catalog.products.length - available.length}件</span></div>
            {results.length === 0 ? <div className="empty panel"><h3>表示できる商品がありません</h3><p>検索語を変えるか、非表示の設定を確認してください。</p><div className="actions"><button onClick={() => { setQuery(''); setPage(1); }}>検索を解除</button><button onClick={() => setView('settings')}>非表示を確認</button></div></div> : <div className="product-grid">{visible.map((product, index) => <article className="product-card" key={product.id}>
              <div className="card-top"><span className="card-number">{String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</span><span className="sample-label">架空の商品</span></div>
              <p className="shop-name">{product.shopName}</p><h3>{product.name}</h3><p className="price">{product.priceLabel}</p>
              {product.url ? <a className="product-link" href={product.url} target="_blank" rel="noopener noreferrer">BOOTHで確認 ↗</a> : <p className="sample-link-note">サンプルのため購入リンクはありません</p>}
              <div className="card-actions"><button disabled={hidden.blocked} onClick={() => hide(product, 'items')}>この商品を非表示</button><button disabled={hidden.blocked} onClick={() => hide(product, 'shops')}>ショップを非表示</button></div>
            </article>)}</div>}
            {pages > 1 && <nav className="pagination" aria-label="商品一覧のページ"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>前へ</button><span>{currentPage} / {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>次へ</button></nav>}
            <div className="source-note"><strong>データについて</strong><p>{catalog.coverage}</p><p>取得元：{catalog.sourceUrl ? <a href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer">BOOTH公開ページ</a> : '架空のサンプルデータ'}<br />最終取得日時：{catalog.fetchedAt ? new Date(catalog.fetchedAt).toLocaleString('ja-JP') : '該当なし（未取得）'}</p><p>実データ公開後も、価格や販売状況の最終確認・購入はBOOTHの商品ページで行ってください。</p></div>
          </>}
        </> : <>
          <div className="section-heading"><div><p className="eyebrow">YOUR PREFERENCES</p><h2>非表示の管理</h2></div></div>
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
    </div>
    <footer className="shell footer"><strong>BOOTHクイズ検索（仮）</strong><p>BOOTH・ピクシブ株式会社の公式サービスではありません。現在はサンプルデータでの試作段階です。</p></footer>
  </>;
}
