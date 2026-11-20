import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSite } from '../context/SiteContext';
import { formatKRW, getInstagramDmUrl } from '../lib/utils';
import { CartDrawer } from './CartDrawer';
import { SafeImage } from './SafeImage';

export function getButtonRadiusClass(shape: 'sharp' | 'rounded' | 'pill' | undefined): string {
  if (shape === 'sharp') return 'rounded-none';
  if (shape === 'pill') return 'rounded-full';
  return 'rounded-md';
}

export function getSectionSpacingClass(spacing: 'compact' | 'normal' | 'relaxed' | undefined): string {
  if (spacing === 'compact') return 'py-8 md:py-11';
  if (spacing === 'relaxed') return 'py-14 md:py-20';
  return 'py-11 md:py-16';
}

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    config,
    isPreviewDraft,
    connectionError,
    retryConnection,
    products,
    posts,
    retailDrops,
  } = useSite();
  const { totalCount, openCart } = useCart();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const moreRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const btnRadius = getButtonRadiusClass(config.theme.buttonShape);
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => searchInputRef.current?.focus(), 40);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [searchOpen]);

  const primaryNav = [
    { label: 'NEWS', sub: '뉴스', to: '/news', matchPaths: ['/news'] },
    { label: 'DROPS', sub: '정가·추첨', to: '/drops', matchPaths: ['/drops'] },
    { label: 'SHOP', sub: '스토어', to: '/shop', matchPaths: ['/shop', '/market'] },
    { label: 'ORIPA', sub: '오리파', to: '/oripa', matchPaths: ['/oripa'] },
    { label: 'PARTNERS', sub: '협찬·광고', to: '/sponsors', matchPaths: ['/sponsors', '/partners'] },
  ];

  const moreNavItems = [
    { label: '카드 매입 안내 · 신청', desc: '매입 시세 가이드 및 비공개 접수', to: '/sell' },
    { label: '라이브 & 이벤트', desc: '커뮤니티 일정 및 라이브 안내', to: '/events' },
    { label: '이용·배송·운영 정책', desc: '이용 약관, 배송·환불, 사업자 정보', to: '/legal' },
    { label: '관리자 콘솔', desc: '운영진 전용 콘텐츠·스토어 관리', to: '/admin' },
  ];

  const isNavActive = (paths: string[]) =>
    paths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  const isMoreActive = isNavActive(['/events', '/legal', '/sell']);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        products: products.slice(0, 4),
        posts: posts.slice(0, 3),
        drops: retailDrops.slice(0, 3),
      };
    }
    return {
      products: products
        .filter((p) =>
          [p.title, p.category, p.grade, p.setCode, p.language]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 5),
      posts: posts
        .filter((p) =>
          [p.title, p.category, p.tcgCategory, p.summary]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 4),
      drops: retailDrops
        .filter((d) =>
          [d.title, d.retailer, d.tcg, d.country].filter(Boolean).join(' ').toLowerCase().includes(q)
        )
        .slice(0, 4),
    };
  }, [searchQuery, products, posts, retailDrops]);

  return (
    <div className="nova-public-shell min-h-screen flex flex-col overflow-x-hidden bg-[#FFFFFF] text-[#111827]">
      {/* Draft preview bar (verified admins only) */}
      {isPreviewDraft && (
        <div className="w-full min-h-[38px] px-4 py-1 flex items-center justify-between text-xs bg-[#465C77] text-[#FFFFFF] border-b border-[#374A61] z-50">
          <span className="font-medium truncate">초안 미리보기 모드 · 게시 전 변경사항 확인 중</span>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-3 py-1 bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            관리자로 돌아가기
          </button>
        </div>
      )}

      {/* Connection notice */}
      {connectionError && (
        <div className="w-full px-4 py-2.5 bg-[#F5F6F8] border-b border-[#E5E7EB] text-xs flex items-center justify-between gap-4">
          <span className="text-[#111827]">{connectionError}</span>
          <button
            type="button"
            onClick={retryConnection}
            className="px-3 py-1 border border-[#D1D5DB] bg-[#FFFFFF] text-[#111827] rounded hover:border-[#111827] whitespace-nowrap shrink-0 transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-[#FFFFFF]/95 backdrop-blur-md safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand wordmark */}
          <Link
            to={`/${previewSuffix}`}
            onClick={handleNavClick}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
          >
            <span className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#111827]/12 bg-[#F5F6F8] shrink-0 block">
              <SafeImage
                key={config.brand.logoUrl}
                src={config.brand.logoUrl}
                alt=""
                fallbackTitle="N"
                className="w-full h-full object-cover scale-[1.08]"
              />
            </span>
            <span className="font-brand text-base sm:text-lg font-bold tracking-[0.22em] text-[#111827]">
              {config.brand.name}
            </span>
          </Link>

          {/* Zone 2: Clean single-line Navigation */}
          <nav aria-label="주요 메뉴" className="hidden lg:flex items-center gap-6 text-[13px]">
            {primaryNav.map((item) => {
              const active = isNavActive(item.matchPaths);
              return (
                <Link
                  key={item.to}
                  to={`${item.to}${previewSuffix}`}
                  className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors tracking-[0.06em] ${
                    active
                      ? 'text-[#111827] font-semibold border-[#465C77]'
                      : 'text-[#667085] font-medium border-transparent hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 inline-flex items-center gap-1 transition-colors tracking-[0.06em] ${
                  isMoreActive || moreOpen
                    ? 'text-[#111827] font-semibold border-[#465C77]'
                    : 'text-[#667085] font-medium border-transparent hover:text-[#111827]'
                }`}
              >
                <span>MORE</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-64 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] shadow-lg py-2 z-50"
                >
                  {moreNavItems.map((sub) => (
                    <Link
                      key={sub.to}
                      role="menuitem"
                      to={sub.to === '/admin' ? '/admin' : `${sub.to}${previewSuffix}`}
                      onClick={handleNavClick}
                      className="block px-4 py-2.5 hover:bg-[#F5F6F8] transition-colors"
                    >
                      <p className="text-sm font-medium text-[#111827]">{sub.label}</p>
                      <p className="text-xs text-[#667085] mt-0.5">{sub.desc}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Search, Cart Drawer trigger, Primary CTA & Mobile Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="통합 검색"
              className="w-10 h-10 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8] transition-colors"
            >
              <Search size={17} />
            </button>

            <button
              type="button"
              onClick={openCart}
              aria-label={`장바구니 열기 (${totalCount}개)`}
              className="relative min-w-[40px] h-10 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8] transition-colors"
            >
              <ShoppingBag size={17} />
              {totalCount > 0 && (
                <span className="font-mono-tabular text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#465C77] text-[#FFFFFF] leading-none">
                  {totalCount}
                </span>
              )}
            </button>

            <Link
              to={`/sell${previewSuffix}`}
              className={`hidden sm:inline-flex items-center justify-center min-h-[40px] px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] transition-colors ${btnRadius}`}
            >
              매입 문의
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F5F6F8] transition-colors"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5E7EB] bg-[#FFFFFF] px-4 py-5 space-y-5 max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-mono-tabular tracking-[0.16em] text-[#667085] uppercase pb-1">
                PLATFORMS
              </p>
              {primaryNav.map((item) => {
                const active = isNavActive(item.matchPaths);
                return (
                  <Link
                    key={item.to}
                    to={`${item.to}${previewSuffix}`}
                    onClick={handleNavClick}
                    className={`flex items-center justify-between min-h-[46px] px-3 rounded-md transition-colors ${
                      active
                        ? 'bg-[#F5F6F8] border border-[#E5E7EB] text-[#111827] font-semibold'
                        : 'text-[#667085] hover:text-[#111827]'
                    }`}
                  >
                    <span className="text-sm tracking-[0.04em]">{item.label}</span>
                    <span className="text-xs text-[#667085]">{item.sub}</span>
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-[#E5E7EB] pt-4 space-y-1">
              <p className="px-3 text-[11px] font-mono-tabular tracking-[0.16em] text-[#667085] uppercase pb-1">
                MORE
              </p>
              {moreNavItems.map((sub) => (
                <Link
                  key={sub.to}
                  to={sub.to === '/admin' ? '/admin' : `${sub.to}${previewSuffix}`}
                  onClick={handleNavClick}
                  className="flex items-center justify-between min-h-[44px] px-3 rounded-md text-sm text-[#667085] hover:text-[#111827] hover:bg-[#F5F6F8] transition-colors"
                >
                  <span>{sub.label}</span>
                  <span className="text-xs text-[#667085]">→</span>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Link
                to={`/sell${previewSuffix}`}
                onClick={handleNavClick}
                className={`flex items-center justify-center min-h-[44px] text-xs font-semibold border border-[#111827] text-[#111827] ${btnRadius}`}
              >
                카드 매입 문의
              </Link>
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleNavClick}
                  className={`flex items-center justify-center min-h-[44px] text-xs font-semibold bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] transition-colors ${btnRadius}`}
                >
                  Instagram DM
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Search Overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/55 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="사이트 통합 검색"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg shadow-2xl overflow-hidden nova-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#E5E7EB] flex items-center gap-3">
              <Search size={18} className="text-[#667085] shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="카드명, 세트 코드, TCG 뉴스, 정가·추첨처 검색..."
                className="flex-1 text-sm text-[#111827] placeholder-[#667085] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="검색 닫기"
                className="w-9 h-9 inline-flex items-center justify-center rounded-md text-[#667085] hover:text-[#111827] hover:bg-[#F5F6F8]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[65dvh] overflow-y-auto space-y-5">
              {/* Products */}
              <div className="space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#667085]">
                  SHOP · 스토어 상품 ({searchResults.products.length})
                </p>
                {searchResults.products.length === 0 ? (
                  <p className="text-xs text-[#667085]">일치하는 상품이 없습니다.</p>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-md">
                    {searchResults.products.map((p) => (
                      <Link
                        key={p.id}
                        to={`/shop/${p.id}${previewSuffix}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[#F5F6F8] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{p.title}</p>
                          <p className="text-xs text-[#667085]">
                            {p.category}
                            {p.grade ? ` · ${p.grade}` : ''} · {p.status}
                          </p>
                        </div>
                        <span className="font-mono-tabular text-xs font-semibold text-[#111827] shrink-0">
                          {formatKRW(p.price)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* News */}
              <div className="space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#667085]">
                  NEWS · TCG 뉴스 ({searchResults.posts.length})
                </p>
                {searchResults.posts.length === 0 ? (
                  <p className="text-xs text-[#667085]">일치하는 뉴스 기사가 없습니다.</p>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-md">
                    {searchResults.posts.map((post) => (
                      <Link
                        key={post.id}
                        to={`/news/${post.slug || post.id}${previewSuffix}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[#F5F6F8] transition-colors"
                      >
                        <p className="text-sm font-medium text-[#111827] truncate">{post.title}</p>
                        <span className="text-xs text-[#667085] shrink-0">
                          {post.tcgCategory || post.category}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Drops */}
              <div className="space-y-2">
                <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#667085]">
                  DROPS · 정가 구매·추첨 ({searchResults.drops.length})
                </p>
                {searchResults.drops.length === 0 ? (
                  <p className="text-xs text-[#667085]">일치하는 발매·추첨 정보가 없습니다.</p>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-md">
                    {searchResults.drops.map((d) => (
                      <Link
                        key={d.id}
                        to={`/drops${previewSuffix}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[#F5F6F8] transition-colors"
                      >
                        <p className="text-sm font-medium text-[#111827] truncate">{d.title}</p>
                        <span className="text-xs text-[#667085] shrink-0">{d.retailer}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full">{children}</main>

      {/* Store Footer */}
      <footer className="border-t border-[#E5E7EB] bg-[#F5F6F8] mt-10 safe-bottom">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
            <div className="space-y-3 max-w-sm">
              <p className="font-brand text-base font-bold tracking-[0.22em] text-[#111827]">
                {config.brand.name}
              </p>
              <p className="text-[11px] tracking-[0.14em] text-[#667085] uppercase">
                {config.brand.tagline}
              </p>
              <p className="text-sm text-[#667085] leading-relaxed">
                {config.brand.headline}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div className="space-y-3">
                <p className="font-semibold tracking-[0.08em] text-[#111827] uppercase">
                  PLATFORM
                </p>
                <ul className="space-y-2.5 text-[#667085]">
                  <li>
                    <Link to={`/news${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      NEWS · TCG 뉴스
                    </Link>
                  </li>
                  <li>
                    <Link to={`/drops${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      DROPS · 정가·추첨
                    </Link>
                  </li>
                  <li>
                    <Link to={`/shop${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      SHOP · 스토어
                    </Link>
                  </li>
                  <li>
                    <Link to={`/oripa${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      ORIPA · 오리파
                    </Link>
                  </li>
                  <li>
                    <Link to={`/sell${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      SELL · 카드 매입
                    </Link>
                  </li>
                  <li>
                    <Link to={`/sponsors${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      PARTNERS · 협찬·광고
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="font-semibold tracking-[0.08em] text-[#111827] uppercase">
                  MORE &amp; POLICY
                </p>
                <ul className="space-y-2.5 text-[#667085]">
                  <li>
                    <Link to={`/events${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      라이브 &amp; 이벤트
                    </Link>
                  </li>
                  <li>
                    <Link to={`/legal/privacy${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      개인정보처리방침
                    </Link>
                  </li>
                  <li>
                    <Link to={`/legal/terms${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      이용 안내
                    </Link>
                  </li>
                  <li>
                    <Link to={`/legal/shipping${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      배송·환불 안내
                    </Link>
                  </li>
                  <li>
                    <Link to={`/legal/business${previewSuffix}`} className="hover:text-[#111827] transition-colors">
                      사업자 정보
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 col-span-2 sm:col-span-1">
                <p className="font-semibold tracking-[0.08em] text-[#111827] uppercase">
                  CONTACT
                </p>
                <ul className="space-y-2.5 text-[#667085]">
                  {config.brand.email && (
                    <li>
                      <a
                        href={`mailto:${config.brand.email}`}
                        className="hover:text-[#111827] transition-colors break-all"
                      >
                        {config.brand.email}
                      </a>
                    </li>
                  )}
                  {config.brand.instagramUrl && (
                    <li>
                      <a
                        href={config.brand.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#111827] transition-colors"
                      >
                        Instagram @novapokemonkr
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#667085]">
            <p>© {new Date().getFullYear()} {config.brand.name}. All rights reserved.</p>
            <Link to="/admin" className="hover:text-[#111827] transition-colors">
              관리자 콘솔
            </Link>
          </div>
        </div>
      </footer>

      {/* Persistent Slide-Over Cart Drawer */}
      <CartDrawer />
    </div>
  );
};
