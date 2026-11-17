import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Instagram, Mail, MessageCircle, Youtube } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { isValidExternalUrl } from '../lib/utils';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { WorkWithNovaSection } from '../components/WorkWithNovaSection';

const AD_PRODUCTS = [
  {
    code: '01',
    name: '메인 스폰서 배너 (홈 상단)',
    placement: 'home_banner',
    summary:
      '홈페이지 메인 비주얼 직하단 및 정가·추첨 정보 인접 영역에 노출되는 대표 광고 구좌입니다. PC와 모바일 전용 배너 이미지를 분리 등록하거나 텍스트형 프리미엄 배너로 운영할 수 있습니다.',
    target: '전면 브랜드 인지도 · 신규 드롭/스토어 유입',
  },
  {
    code: '02',
    name: '뉴스 · 추첨 인라인 광고',
    placement: 'news_inline',
    summary:
      '정가 구매·추첨 정보와 전 세계 TCG 최신 뉴스를 소비하는 핵심 독자 흐름 사이에 자연스럽게 배치되는 네이티브 광고 구좌입니다.',
    target: '구매 의향이 높은 TCG 코어 컬렉터 타깃',
  },
  {
    code: '03',
    name: '공식 파트너 로고 그리드',
    placement: 'home_partners',
    summary:
      '홈페이지 공식 파트너십 섹션에 브랜드 로고·공식 도메인·협찬 표기와 함께 상시 노출되며, 복수 파트너 입점 시 자동으로 그리드가 확장됩니다.',
    target: '장기 브랜드 파트너십 · 공식 제휴 신뢰도 구축',
  },
  {
    code: '04',
    name: '스토어 상단 배너',
    placement: 'shop_banner',
    summary:
      '싱글카드·등급카드·미개봉 박스 카탈로그(/shop) 상단에 노출되어 카드 구매 및 시세 탐색 사용자에게 직접 도달하는 배너 구좌입니다.',
    target: '실거래·컬렉팅 수요 직접 전환',
  },
  {
    code: '05',
    name: '정가·추첨 페이지 배너 (/drops)',
    placement: 'drops_banner',
    summary:
      '포켓몬·원피스 정가 구매 및 공식 추첨 통합 페이지(/drops) 상단에 노출되어 정가 구매 관심도가 높은 컬렉터에게 직접 도달하는 광고 구좌입니다.',
    target: '공식 발매·드롭 참여 활성 컬렉터 타깃',
  },
];

const COLLABORATION_FORMATS = [
  {
    title: '디스플레이 배너 스폰서십',
    description:
      '메인 스폰서, 뉴스·추첨 인라인, 공식 파트너 그리드 등 기간별(시작일~종료일) 예약 집행 및 노출·클릭 실측 리포트 제공',
  },
  {
    title: '콘텐츠 · 언박싱 협업',
    description:
      '신규 확장팩, 컬렉터블 굿즈, 리팩/그레이딩 서비스 소개 아티클 및 공식 Instagram 릴스·피드 콘텐츠 제작',
  },
  {
    title: '라이브 · 오프라인 행사 파트너십',
    description:
      '라이브 방송 공동 진행, 팝업·대회 현장 안내 연동 및 정가·추첨 프로모션 공동 홍보',
  },
];

export const SponsorsPage: React.FC = () => {
  const { config, sponsors, isPreviewDraft } = useSite();

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/sponsors');
  }, []);

  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';
  const officialChannels = [
    {
      label: 'Instagram (@novapokemonkr)',
      url: config.brand.instagramUrl,
      icon: Instagram,
      note: '공식 피드 · 릴스 · DM 실시간 소통 채널',
    },
    {
      label: 'YouTube',
      url: config.brand.youtubeUrl,
      icon: Youtube,
      note: '영상 아카이브 및 콘텐츠 협업 채널',
    },
    {
      label: 'TikTok',
      url: config.brand.tiktokUrl,
      icon: MessageCircle,
      note: '숏폼 TCG 소식 및 언박싱 채널',
    },
  ].filter((c) => isValidExternalUrl(c.url));

  return (
    <>
      <SeoManager
        title="협찬 및 광고 안내"
        description="NOVA Pokémon TCG 미디어 플랫폼의 광고 위치별 상품 소개, 공식 운영 채널 및 파트너십 문의 안내."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-10">
        {/* Intro */}
        <div className="border-b border-[#303741] pb-6 space-y-3">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">
            SPONSORSHIP &amp; MEDIA PARTNERSHIP
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6] text-balance">
            NOVA 공식 협찬 및 광고 상품 안내
          </h1>
          <p className="text-sm sm:text-base text-[#929AA6] max-w-2xl leading-relaxed">
            NOVA는 포켓몬카드 정가 구매·추첨 정보와 전 세계 TCG 최신 뉴스를 중심으로 운영되는 프리미엄 TCG 미디어 플랫폼입니다.
            검증된 컬렉터 오디언스에게 브랜드를 가장 자연스럽고 신뢰도 높게 연결합니다.
          </p>
        </div>

        {/* Active Official Partners (only shown if active sponsors exist; zero empty slots) */}
        {sponsors.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">ACTIVE PARTNERS</p>
                <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">
                  현재 함께하는 공식 파트너
                </h2>
              </div>
              <Link
                to={`/${previewSuffix}`}
                className="text-xs text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1"
              >
                <span>홈으로</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div
              className={`grid gap-4 ${
                sponsors.length === 1
                  ? 'grid-cols-1'
                  : sponsors.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {sponsors.map((sp) => (
                <a
                  key={sp.id}
                  href={sp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent('sponsor_click', '/sponsors', {
                      targetType: 'sponsors_page',
                      targetId: sp.id,
                      targetLabel: sp.name,
                    })
                  }
                  className="group border border-[#303741] rounded-lg p-5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#C5CBD3]/60 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {sp.logoUrl ? (
                      <div className="w-12 h-12 rounded border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
                        <SafeImage src={sp.logoUrl} alt={sp.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded border border-[#303741] bg-[#080A0D] flex items-center justify-center shrink-0">
                        <span className="font-brand text-xs font-bold text-[#C5CBD3]">
                          {sp.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-brand text-sm sm:text-base font-bold tracking-[0.14em] text-[#F3F4F6] truncate">
                          {sp.name}
                        </span>
                        {sp.isSponsored && (
                          <span className="px-1.5 py-0.5 text-[10px] border border-[#8068BA]/60 bg-[#8068BA]/15 text-[#C5CBD3] rounded-sm shrink-0">
                            {sp.badgeLabel || '협찬'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#929AA6] line-clamp-2">{sp.description}</p>
                    </div>
                  </div>
                  <ExternalLink size={15} className="text-[#C5CBD3] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Ad Placement Guide */}
        <section className="space-y-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">AD PLACEMENTS</p>
            <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">광고 위치별 상품 소개</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AD_PRODUCTS.map((item) => (
              <div
                key={item.placement}
                className="border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <p className="font-mono-tabular text-xs text-[#8068BA]">{item.code}.</p>
                  <h3 className="text-base sm:text-lg font-semibold text-[#F3F4F6]">{item.name}</h3>
                  <p className="text-sm text-[#929AA6] leading-relaxed">{item.summary}</p>
                </div>
                <p className="text-xs text-[#C5CBD3] pt-3 border-t border-[#303741]/60">
                  권장 목적: {item.target}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Official Channels & Measurement Policy (No fabricated numbers) */}
        <section className="space-y-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">VERIFIED CHANNELS &amp; REPORTING</p>
            <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">
              공식 운영 채널 및 성과 측정 기준
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
              <h3 className="text-sm font-semibold text-[#F3F4F6]">실제 운영 중인 공식 채널</h3>
              <p className="text-xs text-[#929AA6] leading-relaxed">
                허위 수치나 과장된 지표를 기재하지 않습니다. 아래 공식 채널을 방문해 실제 팔로워, 최근 게시물 및 커뮤니티 반응을 직접 확인하실 수 있습니다.
              </p>
              <div className="space-y-2.5">
                {officialChannels.map((ch) => {
                  const Icon = ch.icon;
                  return (
                    <a
                      key={ch.label}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 p-3.5 rounded border border-[#303741] bg-[#11151A] hover:border-[#C5CBD3]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={16} className="text-[#C5CBD3] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F3F4F6] truncate">{ch.label}</p>
                          <p className="text-xs text-[#929AA6] truncate">{ch.note}</p>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-[#929AA6] shrink-0" />
                    </a>
                  );
                })}
                {config.brand.email && (
                  <a
                    href={`mailto:${config.brand.email}`}
                    className="flex items-center justify-between gap-3 p-3.5 rounded border border-[#303741] bg-[#11151A] hover:border-[#C5CBD3]/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail size={16} className="text-[#C5CBD3] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F3F4F6] truncate">
                          공식 미디어 문의 이메일
                        </p>
                        <p className="font-mono-tabular text-xs text-[#929AA6] truncate">
                          {config.brand.email}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#929AA6] shrink-0" />
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 border border-[#303741] rounded-lg p-6 bg-[#11151A] flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-[#F3F4F6]">실측 기반 광고 성과 리포트</h3>
                <p className="text-xs text-[#929AA6] leading-relaxed">
                  집행되는 모든 배너 및 파트너 슬롯은 웹사이트 내 실제 노출 수(Impression)와 클릭 수(Click)를 Firebase 실측 이벤트로 집계합니다.
                </p>
                <ul className="space-y-1.5 text-xs text-[#C5CBD3] pt-1">
                  <li>· 배너 뷰포트 노출 시 세션 단위 중복 제거 집계</li>
                  <li>· 광고 구좌 및 브랜드별 클릭 수 실시간 기록</li>
                  <li>· PC / 모바일 전용 배너 이미지 분리 운영 지원</li>
                  <li>· 시작일 · 종료일 기간 예약 게시 지원</li>
                </ul>
              </div>
              <a
                href="#work-with-nova"
                className="text-xs font-semibold text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 pt-3 border-t border-[#303741]/60"
              >
                <span>실측 리포트 및 단가 문의하기</span>
                <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </section>

        {/* Collaboration Formats */}
        <section className="space-y-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">COLLABORATION</p>
            <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">협업 형태</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLLABORATION_FORMATS.map((fmt) => (
              <div
                key={fmt.title}
                className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-2"
              >
                <h3 className="text-base font-semibold text-[#F3F4F6]">{fmt.title}</h3>
                <p className="text-xs sm:text-sm text-[#929AA6] leading-relaxed">{fmt.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Contact / Inquiry Tools */}
      <WorkWithNovaSection />
    </>
  );
};
