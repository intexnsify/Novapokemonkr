import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, ShoppingBag, RefreshCw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatKRW } from '../lib/utils';
import { productImages } from '../lib/products';
import { Product } from '../types/nova';
import { SafeImage } from './SafeImage';
export const ShopProductCard: React.FC<{product:Product;previewSuffix?:string;onQuickView?:(p:Product)=>void}> = ({product,previewSuffix='',onQuickView}) => {
  const {addItem}=useCart();
  const [added,setAdded]=useState(false);
  const [image,setImage]=useState(0);
  const card=useRef<HTMLElement>(null);
  const frame=useRef(0);
  const images=productImages(product);
  const sold=product.status==='판매완료';
  const graded=product.category==='등급카드';
  useEffect(()=>{if(!added)return; const timer=setTimeout(()=>setAdded(false),1800);return()=>clearTimeout(timer);},[added]);
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  const reset=()=>{cancelAnimationFrame(frame.current);card.current?.style.setProperty('--rx','0deg');card.current?.style.setProperty('--ry','0deg');};
  const move=(e:React.PointerEvent)=>{
    if(!graded||sold||e.pointerType!=='mouse'||!matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover)').matches)return;
    const r=e.currentTarget.getBoundingClientRect(), x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{card.current?.style.setProperty('--rx',`${(0.5-y)*5}deg`);card.current?.style.setProperty('--ry',`${(x-0.5)*5}deg`);card.current?.style.setProperty('--shine',`${x*100}%`);});
  };
  return <article ref={card} className={`collection-card ${graded?'is-graded':''} ${sold?'is-sold':''}`} onPointerMove={move} onPointerLeave={reset}>
    <div className="collection-art">
      <Link to={`/shop/${product.id}${previewSuffix}`} className="collection-art-link"><SafeImage src={images[image]||images[0]} alt={product.title} fallbackTitle={product.category} loading="lazy" decoding="async" className="collection-image"/><span className="collection-shine"/></Link>
      <span className={`product-status status-${sold?'sold':product.status==='예약중'?'reserved':'available'}`}>{sold?'SOLD OUT':product.status}</span>
      {images.length>1 && <button className="collection-flip" aria-label="다른 등록 사진 보기" onClick={()=>setImage(i=>(i+1)%images.length)}><RefreshCw size={15}/></button>}
      <div className="collection-actions">
        {onQuickView && <button onClick={()=>onQuickView(product)} aria-label={`${product.title} 빠른 보기`}><Eye size={16}/><span>빠른 보기</span></button>}
        <button disabled={sold} onClick={()=>{if(addItem(product,1).ok)setAdded(true);}} aria-label={`${product.title} 장바구니 담기`} className="collection-add">{added?<Check size={16}/>:<ShoppingBag size={16}/>}<span aria-live="polite">{sold?'판매 완료':added?'담겼습니다':'담기'}</span></button>
      </div>
    </div>
    <div className="collection-caption"><p className="collection-meta">{[product.grade||product.category,product.language,product.setCode].filter(Boolean).join(' · ')}</p><Link to={`/shop/${product.id}${previewSuffix}`}><h3>{product.title}</h3></Link><p className="collection-price">{formatKRW(product.price)}</p></div>
  </article>;
};
