import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { getInstagramDmUrl } from '../lib/utils';
import { SafeImage } from './SafeImage';

export function getButtonRadiusClass(shape: 'sharp' | 'rounded' | 'pill' | undefined): string {
  if (shape === 'sharp') return 'rounded-none';
  if (shape === 'pill') return 'rounded-full';
  return 'rounded-md';
}

export function getSectionSpacingClass(spacing: 'compact' | 'normal' | 'relaxed' | undefined): string {
  if (spacing === 'compact') return 'py-10 md:py-12';
  if (spacing === 'relaxed') return 'py-16 md:py-24';
  return 'py-12 md:py-16';
}

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, isPreviewDraft, connectionError, retryConnection } = useSite();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const btnRadius = getButtonRadiusClass(config.theme.buttonShape);
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);

  const navItems = [
    { label: '스토어', to: '/shop' },
    { label: '매입 신청', to: '/sell' },
    { label: '뉴스', to: '/news' },
    { label: '이벤트', to: '/events' },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{
        backgroundColor: 'var(--nova-bg-main)',
        color: 'var(--nova-text-primary)',
      }}
    >
      {/* Draft preview bar (only shown to verified admins previewing draft) */}
      {isPreviewDraft && (
        <div
          className="w-full h-10 px-4 flex items-center justify-between text-xs border-b z-50"
          style={{
            backgroundColor: 'var(--nova-accent)',
            color: '#F3F4F6',
            borderColor: 'var(--nova-border)',
          }}
        >
          <span className="font-medium truncate">초안 미리보기 모드 · 게시 전 변경사항 확인 중</span>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-3 py-1 bg-[#080A0D]/80 text-[#F3F4F6] rounded text-xs font-medium whitespace-nowrap shrink-0 hover:bg-[#080A0D] transition-colors"
          >
            관리자로 돌아가기
          </button>
        </div>
      )}

      {/* Connection error notice if offline */}
      {connectionError && (
        <div className="w-full px-4 py-2.5 bg-[#171C23] border-b border-[#303741] text-xs flex items-center justify-between gap-4">
          <span className="text-[#F3F4F6]">{connectionError}</span>
          <button
            type="button"
            onClick={retryConnection}
            className="px-3 py-1 border border-[#C5CBD3]/40 text-[#C5CBD3] rounded hover:border-[#F3F4F6] whitespace-nowrap shrink-0"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Top Navigation Bar: Strict 3-zone contract */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md safe-top"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--nova-bg-main) 88%, transparent)',
          borderColor: 'var(--nova-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Lockup */}
          <Link
            to={isPreviewDraft ? '/?preview=draft' : '/'}
            onClick={handleNavClick}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 hover:opacity-85 transition-opacity"
            style={{ color: 'var(--nova-text-primary)' }}
          >
            <span
              className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#8068BA]/30 shrink-0 block"
              style={{ backgroundColor: 'var(--nova-bg-main)' }}
            >
              <SafeImage
                key={config.brand.logoUrl}
                src={config.brand.logoUrl}
                alt=""
                fallbackTitle="N"
                className="w-full h-full object-cover scale-[1.08]"
              />
            </span>
            <span className="font-brand text-base sm:text-lg font-bold tracking-[0.22em]">
              {config.brand.name}
            </span>
          </Link>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={isPreviewDraft ? `${item.to}?preview=draft` : item.to}
                className="whitespace-nowrap shrink-0 py-1 border-b transition-colors"
                style={{
                  color: isActive(item.to)
                    ? 'var(--nova-text-primary)'
                    : 'var(--nova-text-secondary)',
                  borderColor: isActive(item.to) ? 'var(--nova-silver)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Zone 3: Single primary action (desktop) + Mobile toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {dmUrl ? (
              <a
                href={dmUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackAnalyticsEvent('dm_click', location.pathname, {
                    targetType: 'header_dm',
                    targetLabel: 'Instagram DM',
                  })
                }
                className={`hidden md:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 nova-transition border ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-silver)',
                  color: 'var(--nova-bg-main)',
                  borderColor: 'var(--nova-silver)',
                }}
              >
                DM 문의
              </a>
            ) : (
              <Link
                to="/sell"
                className={`hidden md:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 nova-transition ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-silver)',
                  color: 'var(--nova-bg-main)',
                }}
              >
                매입 문의
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden w-11 h-11 flex items-center justify-center rounded-md border border-[#303741] text-[#F3F4F6] hover:border-[#C5CBD3] transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div
            className="md:hidden border-t px-4 py-4 space-y-2"
            style={{
              backgroundColor: 'var(--nova-bg-secondary)',
              borderColor: 'var(--nova-border)',
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={isPreviewDraft ? `${item.to}?preview=draft` : item.to}
                onClick={handleNavClick}
                className="flex items-center justify-between min-h-[44px] px-3 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive(item.to) ? 'var(--nova-bg-card)' : 'transparent',
                  color: isActive(item.to)
                    ? 'var(--nova-text-primary)'
                    : 'var(--nova-text-secondary)',
                }}
              >
                <span>{item.label}</span>
              </Link>
            ))}
            {dmUrl && (
              <a
                href={dmUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackAnalyticsEvent('dm_click', location.pathname, {
                    targetType: 'mobile_menu_dm',
                    targetLabel: 'Instagram DM',
                  });
                  handleNavClick();
                }}
                className={`flex items-center justify-center min-h-[44px] w-full mt-2 text-sm font-semibold ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-silver)',
                  color: 'var(--nova-bg-main)',
                }}
              >
                Instagram DM 문의
              </a>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">{children}</main>

      {/* Footer */}
      <footer
        className="border-t mt-16 safe-bottom"
        style={{
          backgroundColor: 'var(--nova-bg-secondary)',
          borderColor: 'var(--nova-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="space-y-2 max-w-md">
              <p className="font-brand text-base font-bold tracking-[0.2em]" style={{ color: 'var(--nova-text-primary)' }}>
                {config.brand.name}
              </p>
              <p className="text-xs tracking-[0.12em]" style={{ color: 'var(--nova-text-secondary)' }}>
                {config.brand.tagline}
              </p>
              <p className="text-sm leading-relaxed pt-1" style={{ color: 'var(--nova-text-secondary)' }}>
                {config.brand.headline}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div className="space-y-2.5">
                <p className="font-semibold" style={{ color: 'var(--nova-silver)' }}>
                  서비스
                </p>
                <ul className="space-y-2" style={{ color: 'var(--nova-text-secondary)' }}>
                  <li>
                    <Link to="/shop" className="hover:text-[#F3F4F6] transition-colors">
                      카드 구매하기
                    </Link>
                  </li>
                  <li>
                    <Link to="/sell" className="hover:text-[#F3F4F6] transition-colors">
                      카드 매입 신청
                    </Link>
                  </li>
                  <li>
                    <Link to="/news" className="hover:text-[#F3F4F6] transition-colors">
                      TCG 뉴스
                    </Link>
                  </li>
                  <li>
                    <Link to="/events" className="hover:text-[#F3F4F6] transition-colors">
                      라이브 &amp; 이벤트
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <p className="font-semibold" style={{ color: 'var(--nova-silver)' }}>
                  운영 및 안내
                </p>
                <ul className="space-y-2" style={{ color: 'var(--nova-text-secondary)' }}>
                  <li>
                    <Link to="/legal/privacy" className="hover:text-[#F3F4F6] transition-colors">
                      개인정보처리방침
                    </Link>
                  </li>
                  <li>
                    <Link to="/legal/terms" className="hover:text-[#F3F4F6] transition-colors">
                      이용 안내
                    </Link>
                  </li>
                  <li>
                    <Link to="/legal/shipping" className="hover:text-[#F3F4F6] transition-colors">
                      배송·환불 안내
                    </Link>
                  </li>
                  <li>
                    <Link to="/legal/business" className="hover:text-[#F3F4F6] transition-colors">
                      사업자 정보
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5 col-span-2 sm:col-span-1">
                <p className="font-semibold" style={{ color: 'var(--nova-silver)' }}>
                  연락처
                </p>
                <ul className="space-y-2" style={{ color: 'var(--nova-text-secondary)' }}>
                  {config.brand.email && (
                    <li>
                      <a
                        href={`mailto:${config.brand.email}`}
                        className="hover:text-[#F3F4F6] transition-colors break-all"
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
                        className="hover:text-[#F3F4F6] transition-colors"
                      >
                        Instagram @novapokemonkr
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div
            className="pt-6 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            style={{
              borderColor: 'var(--nova-border)',
              color: 'var(--nova-text-secondary)',
            }}
          >
            <p>© {new Date().getFullYear()} {config.brand.name}. All rights reserved.</p>
            <Link to="/admin" className="hover:text-[#F3F4F6] transition-colors">
              관리자 콘솔
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
