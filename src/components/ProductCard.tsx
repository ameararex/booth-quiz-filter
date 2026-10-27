import { useState } from 'react';
import type { Catalog, Product } from '../lib/catalog.ts';
import { thumbnailFor } from '../lib/presentation.ts';

export function ProductCard({ product, mode, disabled, onHide }: {
  product: Product; mode: Catalog['mode']; disabled: boolean; onHide: (kind: 'items' | 'shops') => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail = thumbnailFor(product, mode);
  const image = <>
    {thumbnail && !imageFailed ? <img src={thumbnail} alt={`${product.name}の仮表紙`} width="360" height="360" loading="lazy" onError={() => setImageFailed(true)} /> : <span className="no-image">画像未取得</span>}
    {mode === 'sample' && <small>仮の表紙</small>}
  </>;

  return <article>
    {product.url ? <a className="thumbnail" href={product.url} target="_blank" rel="noopener noreferrer" aria-label={`${product.name}をBOOTHで確認`}>{image}</a> : <div className="thumbnail">{image}</div>}
    <div className="card-body">
      <div className="item-title">
        <p className="shop" title={product.shopName}>{product.shopName}</p>
        <h3 title={product.name}>{product.url ? <a href={product.url} target="_blank" rel="noopener noreferrer">{product.name}</a> : product.name}</h3>
      </div>
      <p className="price" title={product.priceLabel}>{product.priceLabel}</p>
      <div className="item-actions">
        <button className="hide-shop" disabled={disabled} onClick={() => onHide('shops')} aria-label={`ショップを非表示：${product.shopName}`}><span className="full-label">ショップを非表示</span><span className="short-label">非表示</span></button>
        <details className="secondary-actions"><summary aria-label={`${product.name}のその他の操作`} title="その他の操作">…</summary><button disabled={disabled} onClick={() => onHide('items')} aria-label={`商品を非表示：${product.name}`}>この商品を非表示</button></details>
      </div>
    </div>
  </article>;
}
