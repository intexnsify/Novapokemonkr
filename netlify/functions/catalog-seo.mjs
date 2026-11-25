import { readFile } from 'node:fs/promises';
import firebase from '../../firebase-applet-config.json' with {type:'json'};
import {pages, origin, productDetail, inCollection} from '../../src/seo/catalog.js';
const db = 'https://firestore.googleapis.com/v1/projects/'+firebase.projectId+'/databases/'+firebase.firestoreDatabaseId+'/documents';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function product(d) {
  const f=d.fields;
  const str=k=>f[k]?.stringValue || '';
  return {id:d.name.split('/').pop(),title:str('title'),category:str('category'),language:str('language'),grade:str('grade'),setCode:str('setCode'),status:str('status'),price:Number(f.price?.integerValue ?? f.price?.doubleValue),images:(f.images?.arrayValue?.values || []).map(x=>x.stringValue).filter(x=>/^https?:\/\//.test(x)), description:str('description')};
}
async function inventory() {
  const query={from:[{collectionId:'products'}],where:{fieldFilter:{field:{fieldPath:'visibilityState'},op:'EQUAL',value:{stringValue:'published'}}}};
  const res=await fetch(db+':runQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query}),signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error('Inventory unavailable');
  return (await res.json()).filter(x=>x.document).map(x=>product(x.document));
}
function buybackGuide(path) {
  if (!path.startsWith('/sell')) return '';
  return `<section>
    <h2>매입 절차와 자주 묻는 질문</h2>
    <p>사진과 수량 제출 → 상태 검토 및 견적 안내 → 거래 조건 확인</p>
    <details><summary>포켓몬카드 고가매입 견적은 어떻게 결정되나요?</summary><p>카드 번호, 언어, 등급, 보관 상태를 확인합니다. 희망 가격을 함께 적어 주세요. 최종 금액은 개별 안내를 통해 확인하세요.</p></details>
    <details><summary>포켓몬카드 현금매입과 정산 방법을 확인하고 싶어요.</summary><p>희망하는 정산 방법을 요청사항에 남겨 주세요. 발송 전에 매입 가능 여부와 지급 방식, 시점을 담당자와 확인하세요.</p></details>
  </section>`;
}

function listingLink(product) {
  const label = escape(productDetail(product));
  const image = product.images[0];
  const thumbnail = image
    ? '<img loading="lazy" height="120" src="' + escape(image) + '" alt="' + escape(product.title) + '">'
    : '';
  return '<p><a href="' + productPath(product) + '">' + thumbnail + label + '</a></p>';
}

const productPath=p=>'/shop/'+encodeURIComponent(p.id);
export default async function handle(request) {
 const path=new URL(request.url).pathname.replace(/\/$/,'') || '/';
 const headers={'Netlify-CDN-Cache-Control':'public, s-maxage=120','Content-Type':'text/html; charset=utf-8'};
 const preview=new URL(request.url).origin!==origin;
 if(preview)headers['X-Robots-Tag']='noindex, nofollow';
 if(path==='/robots.txt')return new Response(preview?'User-agent: *\nDisallow: /':'User-agent: *\nDisallow: /admin\nSitemap: '+origin+'/sitemap.xml',{headers:{...headers,'Content-Type':'text/plain'}});
 let list=[];
 try {
  if(path.startsWith('/shop') || path==='/sitemap.xml')list=await inventory();
 } catch {return new Response('상품 목록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',{status:503,headers:{'Retry-After':'60'}});}
 if(path==='/sitemap.xml'){
  const entry=(path,images=[])=>'<url><loc>'+escape(origin+path)+'</loc>'+images.map(url=>'<image:image><image:loc>'+escape(url)+'</image:loc></image:image>').join('')+'</url>';
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+Object.keys(pages).map(p=>entry(p)).join('')+list.map(p=>entry(productPath(p),p.images)).join('')+'</urlset>',{headers:{...headers,'Content-Type':'application/xml'}});
 }
 const item=list.find(p=>productPath(p)===path);
 if(!item && !pages[path])return new Response('상품을 찾을 수 없습니다.',{status:404});
 const [title,desc]=item?[item.title,productDetail(item)]:pages[path];
 const canonical=origin+path;
 const img=item?.images[0];
 const links=Object.entries(pages).map(([p,[name]])=>'<a href="'+p+'">'+escape(name)+'</a>').join(' · ');
 const schema=item?{'@context':'https://schema.org','@type':'Product',name:item.title,sku:item.id,description:desc,image:item.images,additionalProperty:[['카드 번호',item.setCode],['언어',item.language],['등급',item.grade],['판매 상태',item.status]].filter(([,v])=>v).map(([name,value])=>({'@type':'PropertyValue',name,value})),offers:{'@type':'Offer',url:canonical,price:item.price,priceCurrency:'KRW',availability:'https://schema.org/'+({'판매중':'InStock','판매완료':'SoldOut','예약중':'LimitedAvailability'}[item.status]||'LimitedAvailability')}}:null;
 const token=process.env.GOOGLE_SITE_VERIFICATION;
 const head='<link rel="canonical" href="'+escape(canonical)+'">'+(token?'<meta name="google-site-verification" content="'+escape(token)+'">':'')+(img?'<meta property="og:image" content="'+escape(img)+'">':'')+(schema?'<script id="product-schema" type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>':'');
 const body='<main><h1>'+escape(title)+'</h1><p>'+escape(desc)+'</p>'+buybackGuide(path)+(img?'<img src="'+escape(img)+'" alt="'+escape(item.title+' '+item.setCode)+'">':'')+(item?'<p>'+escape(item.description)+'</p>':list.filter(p=>inCollection(path,p)).map(listingLink).join(''))+'<nav>'+links+'</nav></main>';
 const template=await readFile('dist/index.html','utf8');
 const html=template.replace(/<title>.*?<\/title>/s,()=>'<title>'+escape(title)+' | NOVA</title>').replace(/(<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content=")[^"]*/g,(_,prefix)=>prefix+escape(desc)).replace(/(<meta\s+(?:name|property)="(?:og:title|twitter:title)"\s+content=")[^"]*/g,(_,prefix)=>prefix+escape(title)+' | NOVA').replace('</head>',()=>head+'</head>').replace('<div id="root"></div>',()=>'<div id="root">'+body+'</div>');
 return new Response(html,{headers});
}
export const config = {path:['/', '/sell','/sell/psa','/sell/singles','/sell/sealed','/shop','/shop/:id','/shop/collections/:category','/robots.txt','/sitemap.xml'],preferStatic:false};
