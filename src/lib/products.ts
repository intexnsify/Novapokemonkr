import { Product } from '../types/nova';
export const productImages = (p: Product) => (p.images || []).filter((s) => typeof s === 'string' && s.trim());
export function productTime(p: Product): number {
  const v = p.createdAt as { toMillis?: () => number; seconds?: number } | string | number | undefined;
  if (v && typeof v === 'object') return v.toMillis?.() || (v.seconds || 0) * 1000;
  const n = v ? new Date(v as string | number).getTime() : 0;
  return Number.isFinite(n) ? n : 0;
}
export const newestFirst = (a: Product, b: Product) => productTime(b) - productTime(a) || a.order - b.order;
export const availabilityRank = (p: Product) => p.status === '판매중' ? 0 : p.status === '예약중' ? 1 : 2;
export const productSpecs = (p: Product) => [
  { label: '등급 / 상품 상태', value: p.grade },
  { label: '세트 / 카드 번호', value: p.setCode },
  { label: '언어', value: p.language },
].filter((s) => s.value);
export function productCollections(products: Product[]) {
  return [
    { id: 'new', title: '신규 입고', subtitle: 'NEW ARRIVALS', products: [...products].sort(newestFirst).slice(0, 8) },
    { id: 'psa', title: 'PSA 10 등급카드', subtitle: 'GRADED COLLECTION', products: products.filter(p => /PSA\s*10\b/i.test(p.grade || '')) },
    { id: 'premium', title: '프리미엄 컬렉션', subtitle: '₩1,000,000 & ABOVE', products: products.filter(p => p.price >= 1000000) },
    ...(['싱글카드', '미개봉 박스', '팩'] as const).map(category => ({id: category, title: category === '팩' ? '부스터 팩' : category, subtitle: 'EXPLORE THE COLLECTION', products: products.filter(p => p.category === category)})),
  ].filter(c => c.products.length > 0);
}
