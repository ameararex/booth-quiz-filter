import { useState } from 'react';
import type { Catalog, Product } from '../lib/catalog.ts';
import { thumbnailFor } from '../lib/presentation.ts';

export function ProductCard({ product, mode, disabled, hiding = false, onHide }: {
  product: Product; mode: Catalog['mode']; disabled: boolean; hiding?: boolean; onHide: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail = thumbnailFor(product, mode);
  const image = <>
    {thumbnail && !imageFailed ? <img src={thumbnail} alt={`${product.name}${mode === 'sample' ? 'の仮表紙' : 'のサムネイル'}`} width="360" height="360" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <span className="no-image">{imageFailed ? '画像を表示できません' : '画像未取得'}</span>}
    {mode === 'sample' && <small>仮の表紙</small>}
  </>;

  return <article className={hiding ? 'is-hiding' : undefined}>
    {product.url ? <a className="thumbnail" href={product.url} target="_blank" rel="noopener noreferrer" aria-label={`${product.name}をBOOTHで確認`}>{image}</a> : <div className="thumbnail">{image}</div>}
    <div className="card-body">
      <div className="item-title">
        <p className="shop" title={product.shopName}>{product.shopName}</p>
        <h3 title={product.name}>{product.url ? <a href={product.url} target="_blank" rel="noopener noreferrer">{product.name}</a> : product.name}</h3>
      </div>
      <p className="price" title={product.priceYen != null ? `${product.priceLabel}（価格順は表示価格の最小額で比較）` : product.priceLabel}>{product.priceLabel}{product.likes != null && <span className="likes" aria-label={`スキ ${product.likes}件`}>♡ {product.likes.toLocaleString('ja-JP')}</span>}</p>
      <div className="item-actions">
        <button className="hide-shop" disabled={disabled} onClick={onHide} aria-label={`ショップを非表示：${product.shopName}`}><span className="full-label">ショップを非表示</span><span className="short-label">非表示</span></button>
      </div>
    </div>
  </article>;
}
