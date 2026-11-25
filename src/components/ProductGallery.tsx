import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Product } from '../types/nova';
import { productImages } from '../lib/products';
import { SafeImage } from './SafeImage';
export function ProductGallery({product, compact = false}: {product: Product; compact?: boolean}) {
  const images = productImages(product);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const swiped = useRef(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const move = (delta: number) => { setIndex(i => (i + delta + images.length) % images.length); setEnlarged(false); };
  useEffect(() => { setIndex(0); setZoom(false); }, [product.id]);
  useEffect(() => {
    if (!zoom) return;
    dialog.current?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.current?.close(); document.body.style.overflow = prev; };
  }, [zoom]);
  const image = <SafeImage src={images[index]} alt={`${product.title} 사진 ${index + 1}`} fallbackTitle={product.title} className="w-full h-full object-contain" decoding="async" />;
  return <div className={`product-gallery ${compact ? 'is-compact' : ''} ${product.category === '미개봉 박스' ? 'is-box' : ''}`}>
    <div className="product-gallery-stage" onTouchStart={e => {swiped.current=false;touch.current = e.touches.length === 1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY}:null;}} onTouchEnd={e => {const t=touch.current; touch.current=null; if(!t || images.length<2)return; const dx=e.changedTouches[0].clientX-t.x; const dy=e.changedTouches[0].clientY-t.y; if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)) {swiped.current=true;move(dx>0?-1:1);}}}>
      <button className="product-gallery-image" disabled={!images.length} onClick={() => {if(swiped.current){swiped.current=false;return;}setEnlarged(false);setZoom(true);}} aria-label="상품 이미지 크게 보기">{image}</button>
      {images.length>0 && <button className="gallery-expand" onClick={() => {setEnlarged(false);setZoom(true);}}><Maximize2 size={15}/> 확대 보기</button>}
      {images.length>1 && <><button className="gallery-arrow left-2" aria-label="이전 상품 사진" onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button className="gallery-arrow right-2" aria-label="다음 상품 사진" onClick={()=>move(1)}><ChevronRight size={20}/></button><span className="gallery-count">{index+1} / {images.length}</span></>}
    </div>
    {images.length>1 && <div className="gallery-thumbnails">{images.map((src,i)=><button key={`${src}-${i}`} aria-label={`상품 사진 ${i+1}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><SafeImage src={src} alt="" loading="lazy" className="w-full h-full object-contain"/></button>)}</div>}
    {zoom && <dialog ref={dialog} className="product-lightbox" aria-label="상품 원본 사진 확대" onCancel={()=>setZoom(false)} onClick={e=>{if(e.target===e.currentTarget)setZoom(false);}} onKeyDown={e=>{if(images.length>1 && e.key==='ArrowLeft')move(-1);if(images.length>1 && e.key==='ArrowRight')move(1);}}>
      <header><span>{index+1} / {images.length} · 원본 이미지</span><div className="flex gap-2"><button aria-label={enlarged?'축소':'확대'} onClick={()=>setEnlarged(v=>!v)}>{enlarged?<ZoomOut/>:<ZoomIn/>}</button><button autoFocus aria-label="이미지 확대 닫기" onClick={()=>setZoom(false)}><X/></button></div></header>
      <div className={`lightbox-scroll ${enlarged?'is-enlarged':''}`}><img src={images[index]} alt={product.title}/></div>
      <footer>{images.length>1 && <button onClick={()=>move(-1)} aria-label="이전 원본 사진"><ChevronLeft/></button>}<p>확대 버튼 또는 두 손가락으로 자세히 보기</p>{images.length>1 && <button onClick={()=>move(1)} aria-label="다음 원본 사진"><ChevronRight/></button>}</footer>
    </dialog>}
  </div>;
}
