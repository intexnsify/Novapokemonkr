export const origin = 'https://novapokemonkr1.netlify.app';
export const pages = {
  '/': ['포켓몬카드 매입 · PSA 등급카드 판매', '소장한 포켓몬카드의 매입 견적을 신청하고 NOVA 스토어에서 PSA 등급카드의 사진, 카드 번호, 가격과 판매 상태를 확인하세요.'],
  '/sell': ['포켓몬카드 매입 견적 신청', 'PSA 등급카드, 싱글카드, 미개봉 박스의 사진과 수량, 희망 가격을 보내 매입 가능 여부와 견적을 확인하세요.'],
  '/sell/psa': ['포켓몬카드 등급카드 매입 · PSA 10 매입 견적', '슬랩 앞뒤와 PSA 라벨이 보이는 사진을 준비해 주세요. 카드 번호와 언어, 등급을 함께 적으면 보유하신 카드의 견적을 확인하기 쉽습니다.'],
  '/sell/singles': ['포켓몬카드 싱글카드 매입', '카드 번호와 언어를 적고 앞뒤 사진을 첨부해 주세요. 모서리 눌림, 표면 흠집처럼 가격에 영향을 줄 수 있는 부분은 가까이 찍어 주세요.'],
  '/sell/sealed': ['포켓몬카드 미개봉 박스 매입', '제품명과 발매 언어, 박스 수량을 적어 주세요. 밀봉 상태와 모서리 눌림 여부를 확인할 수 있는 사진이 견적 검토에 도움이 됩니다.'],
  '/shop': ['포켓몬카드 스토어 · 등급카드 판매', '공개 판매 상품의 사진, 가격과 판매 상태를 확인하고 Instagram DM으로 문의하세요.'],
  '/shop/collections/psa': ['포켓몬카드 등급카드 판매 · PSA 컬렉션', 'PSA 등급과 카드 번호, 언어, 가격을 확인하고 판매 중인 상품의 실물을 확인하세요.'],
  '/shop/collections/ar-psa-10': ['포켓몬카드 AR PSA 10 판매', 'AR(아트 레어) PSA 10 등급으로 등록된 상품의 사진과 가격, 판매 상태를 확인하세요.'],
};
export function inCollection(path, p) {
  if (!path.includes('/collections/')) return true;
  const text = [p.grade, p.title].join(' ');
  return /PSA\s*\d+/i.test(text) && (!path.endsWith('ar-psa-10') ||
    (/PSA\s*10\b/i.test(text) && /(?:\bAR\b|아트\s*레어)/i.test(p.title)));
}
export function productDetail(p) {
  return [p.title, p.setCode, p.language, p.grade, Number(p.price).toLocaleString('ko-KR')+'원', p.status].filter(Boolean).join(' · ');
}
