import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Instagram, Mail, MessageCircle, Youtube } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKST, isValidExternalUrl } from '../lib/utils';
import { PartnerMediaSlot } from '../components/PartnerMediaSlot';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { WorkWithNovaSection } from '../components/WorkWithNovaSection';

const PLACEMENT_LABELS: Record<string, string> = {
  home_banner: '홈 메인 배너',
  home_partners: '공식 파트너 그리드',
  news_inline: '뉴스 인라인 스폰서',
  shop_banner: '스토어 상단 배너',
  drops_banner: '정가·추첨 상단 배너',
};

const AD_PRODUCTS = [
  {
    code: '01',
    name: '메인 스폰서 배너 (홈 상단)',
    placement: 'home_banner',
    summary:
      '홈페이지 메인 비주얼 직하단에 노출되는 대표 광고 구좌입니다. PC와 모바일 전용 배너 이미지를 분리 등록하거나 영상 캠페인으로 운영할 수 있습니다.',
    target: '전면 브랜드 인지도 · 신규 드롭/스토어 유입',
  },
  {
    code: '02',
    name: '뉴스 인라인 스폰서',
    placement: 'news_inline',
    summary:
      '전 세계 TCG 최신 뉴스를 소비하는 독자 흐름 사이에 "SPONSORED" 표기와 함께 명확히 분리되어 배치되는 네이티브 구좌입니다.',
    target: '구매 의향이 높은 TCG 코어 컬렉터 타깃',
  },
  {
    code: '03',
    name: '공식 파트너 브랜드 그리드',
    placement: 'home_partners',
    summary:
      '홈페이지 공식 파트너십 섹션에 브랜드 로고·공식 도메인·협찬 표기와 함께 상시 노출되며, 복수 파트너 입점 시 자동으로 확장됩니다.',
    target: '장기 브랜드 파트너십 · 공식 제휴 신뢰도 구축',
  },
  {
    code: '04',
    name: '스토어 상단 배너 (/shop)',
    placement: 'shop_banner',
    summary:
      '싱글카드·등급카드·미개봉 박스 카탈로그 상단에 노출되어 카드 구매 및 시세 탐색 사용자에게 직접 도달하는 배너 구좌입니다.',
    target: '실거래·컬렉팅 수요 직접 전환',
  },
  {
    code: '05',
    name: '정가·추첨 페이지 배너 (/drops)',
    placement: 'drops_banner',
    summary:
      '포켓몬·원피스 정가 구매 및 공식 추첨 통합 페이지 상단에 노출되어 정가 구매 관심도가 높은 컬렉터에게 도달하는 구좌입니다.',
    target: '공식 발매·드롭 참여 활성 컬렉터 타깃',
  },
];

const COLLABORATION_FORMATS = [
  {
    index: '01',
    title: '디스플레이 배너 스폰서십',
    description:
      '메인 스폰서, 뉴스 인라인, 공식 파트너 그리드 등 기간별(시작일~종료일) 예약 집행 및 노출·클릭 실측 리포트 제공',
  },
  {
    index: '02',
    title: '콘텐츠 · 영상 쇼케이스 협업',
    description:
      '신규 확장팩, 컬렉터블 굿즈, 리팩/그레이딩 서비스 소개 아티클 및 공식 Instagram 릴스·YouTube 영상 협업 제작',
  },
  {
    index: '03',
    title: '라이브 · 오프라인 행사 파트너십',
    description:
      '라이브 방송 공동 진행, 팝업·대회 현장 안내 연동 및 정가·추첨 프로모션 공동 홍보',
  },
];

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const SponsorsPage: React.FC = () => {
  const { config, sponsors, endedSponsors, sponsorMeta, isPreviewDraft } = useSite();

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

  const visualCampaigns = sponsors.filter((sp) => {
    const meta = sponsorMeta[sp.id];
    return Boolean(
      sp.desktopBannerUrl?.trim() || sp.mobileBannerUrl?.trim() || meta?.videoUrl?.trim()
    );
  });

  return (
    <>
      <SeoManager
        title="PARTNERS · 브랜드 협업 및 광고 안내"
        description="NOVA Pokémon TCG 플랫폼의 공식 파트너 브랜드, 진행 중인 캠페인, 광고 구좌 및 파트너십 문의 안내."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-12">
        <header className="border-b border-[#E5E7EB] pb-8 space-y-4">
          <p className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-[#465C77] font-semibold">
            NOVA PARTNERS · BRAND COLLABORATIONS &amp; MEDIA
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827] text-balance">
                공식 브랜드 파트너십 · 광고 캠페인
              </h1>
              <p className="text-sm sm:text-base text-[#667085] leading-relaxed">
                NOVA는 포켓몬카드 온라인 스토어와 정가 구매·추첨 정보, 글로벌 TCG 뉴스를 운영하는 플랫폼입니다.
                모든 스폰서십 및 광고 집행은 일반 뉴스·자체 상품과 엄격히 분리되어 명확한 표기와 함께 운영됩니다.
              </p>
            </div>
            <a
              href="#work-with-nova"
              className="min-h-[44px] px-5 py-2.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap self-start lg:self-end transition-colors"
            >
              <span>협업 · 입점 문의하기</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </header>

        {sponsors.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#465C77] font-semibold mb-1">
                  ACTIVE PARTNERSHIPS
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">
                  현재 함께하는 공식 파트너 · 진행 캠페인
                </h2>
              </div>
              <Link
                to={`/${previewSuffix}`}
                className="text-xs font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1"
              >
                <span>홈으로</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div
              className={`grid gap-5 ${
                sponsors.length === 1
                  ? 'grid-cols-1'
                  : sponsors.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {sponsors.map((sp) => {
                const meta = sponsorMeta[sp.id];
                return (
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
                    className="group border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] flex flex-col justify-between gap-5 nova-card-hover hover:border-[#465C77]/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        {sp.logoUrl ? (
                          <div className="w-14 h-14 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] overflow-hidden shrink-0">
                            <SafeImage
                              src={sp.logoUrl}
                              alt={sp.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] flex items-center justify-center shrink-0">
                            <span className="font-brand text-sm font-bold text-[#111827]">
                              {sp.name.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-brand text-base font-bold tracking-[0.14em] text-[#111827] truncate">
                              {sp.name}
                            </span>
                            {sp.isSponsored && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold border border-[#CBD5E1] bg-[#F1F5F9] text-[#465C77] rounded-sm shrink-0">
                                {sp.badgeLabel || '협찬'}
                              </span>
                            )}
                          </div>
                          <p className="font-mono-tabular text-[11px] text-[#667085] truncate">
                            {getDomain(sp.url)} · {PLACEMENT_LABELS[sp.placement] || sp.placement}
                          </p>
                          {meta?.campaignName && (
                            <p className="text-xs font-medium text-[#465C77] truncate">
                              {meta.campaignName}
                            </p>
                          )}
                        </div>
                      </div>
                      <ExternalLink
                        size={16}
                        className="text-[#667085] shrink-0 group-hover:text-[#465C77] group-hover:translate-x-0.5 transition-all"
                      />
                    </div>

                    {(meta?.headline || sp.description) && (
                      <div className="space-y-1">
                        {meta?.headline && (
                          <p className="text-sm font-semibold text-[#111827]">{meta.headline}</p>
                        )}
                        {sp.description && (
                          <p className="text-sm text-[#667085] leading-relaxed">{sp.description}</p>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#667085]">
                      <span className="font-semibold text-[#111827] group-hover:text-[#465C77]">
                        {sp.ctaLabel || '공식 사이트 방문'} →
                      </span>
                      {Boolean(sp.endAt) ? (
                        <span className="font-mono-tabular">~ {formatKST(sp.endAt, false)}</span>
                      ) : (
                        <span className="font-mono-tabular text-[#0F6B4B]">집행 중</span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div>
            <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085] font-semibold mb-1">
              CAMPAIGN MEDIA &amp; VIDEO SHOWCASE
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">
              캠페인 비주얼 · 영상 쇼케이스
            </h2>
          </div>

          {visualCampaigns.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visualCampaigns.map((sp) => {
                const meta = sponsorMeta[sp.id];
                return (
                  <div key={`media_${sp.id}`} className="space-y-2.5">
                    <PartnerMediaSlot
                      title={meta?.headline || `${sp.name} 캠페인 비주얼`}
                      brandName={sp.name}
                      imageUrl={sp.desktopBannerUrl}
                      mobileImageUrl={sp.mobileBannerUrl}
                      videoUrl={meta?.videoUrl}
                      caption={`${sp.name} · ${meta?.campaignName || PLACEMENT_LABELS[sp.placement] || sp.placement}`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center border border-[#E5E7EB] rounded-lg p-6 sm:p-8 bg-[#FFFFFF]">
              <div className="lg:col-span-7">
                <PartnerMediaSlot
                  title="브랜드 캠페인 비주얼 · 영상 쇼케이스 슬롯"
                  brandName={sponsors[0]?.name || 'NOVA PARTNERS'}
                />
              </div>
              <div className="lg:col-span-5 space-y-3">
                <p className="font-mono-tabular text-[11px] tracking-[0.16em] uppercase text-[#465C77] font-semibold">
                  MEDIA READY ARCHITECTURE
                </p>
                <h3 className="text-lg sm:text-xl font-semibold text-[#111827]">
                  브랜드 비주얼 · 영상 캠페인 확장 슬롯
                </h3>
                <p className="text-sm text-[#667085] leading-relaxed">
                  고해상도 캠페인 배너(PC·모바일 분리)와 파트너 홍보 영상(YouTube · MP4/WebM)을 자연스럽게 임베드할 수 있는 전용 쇼케이스 구조입니다.
                </p>
              </div>
            </div>
          )}
        </section>

        {endedSponsors.length > 0 && (
          <section className="space-y-4">
            <div>
              <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085] font-semibold mb-1">
                PAST CAMPAIGN ARCHIVE
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">
                지난 파트너 캠페인 기록
              </h2>
            </div>

            <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg bg-[#FFFFFF] overflow-hidden">
              {endedSponsors.map((sp) => (
                <div
                  key={`ended_${sp.id}`}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#667085]">
                      <span className="font-brand font-bold tracking-[0.12em] text-[#111827]">
                        {sp.name}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{PLACEMENT_LABELS[sp.placement] || sp.placement}</span>
                      {Boolean(sp.endAt) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            종료 {formatKST(sp.endAt, false)}
                          </span>
                        </>
                      )}
                    </div>
                    {sp.description && (
                      <p className="text-xs text-[#667085] line-clamp-1">{sp.description}</p>
                    )}
                  </div>
                  {isValidExternalUrl(sp.url) && (
                    <a
                      href={sp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1 shrink-0"
                    >
                      <span>브랜드 사이트</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div>
            <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085] font-semibold mb-1">
              AD PLACEMENTS
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">광고 위치별 상품 소개</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {AD_PRODUCTS.map((item) => (
              <div
                key={item.placement}
                className="border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <p className="font-mono-tabular text-xs font-semibold text-[#465C77]">{item.code}.</p>
                  <h3 className="text-base sm:text-lg font-semibold text-[#111827]">{item.name}</h3>
                  <p className="text-sm text-[#667085] leading-relaxed">{item.summary}</p>
                </div>
                <p className="text-xs text-[#111827] font-medium pt-3 border-t border-[#E5E7EB]">
                  권장 목적: <span className="text-[#667085] font-normal">{item.target}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085] font-semibold mb-1">
              VERIFIED CHANNELS &amp; REPORTING
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">
              공식 운영 채널 및 성과 측정 기준
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] space-y-4">
              <h3 className="text-sm font-semibold text-[#111827]">실제 운영 중인 공식 채널</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
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
                      className="flex items-center justify-between gap-3 p-3.5 rounded border border-[#E5E7EB] bg-[#F5F6F8] hover:border-[#D1D5DB] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={16} className="text-[#111827] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{ch.label}</p>
                          <p className="text-xs text-[#667085] truncate">{ch.note}</p>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-[#667085] shrink-0" />
                    </a>
                  );
                })}
                {config.brand.email && (
                  <a
                    href={`mailto:${config.brand.email}`}
                    className="flex items-center justify-between gap-3 p-3.5 rounded border border-[#E5E7EB] bg-[#F5F6F8] hover:border-[#D1D5DB] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail size={16} className="text-[#111827] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">
                          공식 미디어 문의 이메일
                        </p>
                        <p className="font-mono-tabular text-xs text-[#667085] truncate">
                          {config.brand.email}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#667085] shrink-0" />
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 border border-[#E5E7EB] rounded-lg p-6 bg-[#F5F6F8] flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#111827]">실측 기반 광고 성과 리포트</h3>
                <p className="text-xs text-[#667085] leading-relaxed">
                  집행되는 모든 배너 및 파트너 슬롯은 웹사이트 내 실제 노출 수(Impression)와 클릭 수(Click)를 Firebase 실측 이벤트로 집계합니다.
                </p>
                <ul className="space-y-2 text-xs text-[#111827] pt-1">
                  <li>· 배너 뷰포트 노출 시 세션 단위 중복 제거 집계</li>
                  <li>· 광고 구좌 및 브랜드별 클릭 수 실시간 기록</li>
                  <li>· PC / 모바일 전용 배너 이미지 분리 운영 지원</li>
                  <li>· 시작일 · 종료일 기간 예약 및 일시중지 지원</li>
                </ul>
              </div>
              <a
                href="#work-with-nova"
                className="text-xs font-semibold text-[#465C77] hover:text-[#111827] inline-flex items-center gap-1.5 pt-3 border-t border-[#E5E7EB]"
              >
                <span>실측 리포트 및 단가 문의하기</span>
                <ArrowRight size={13} />
              </a>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="font-mono-tabular text-[11px] tracking-[0.18em] uppercase text-[#667085] font-semibold mb-1">
              COLLABORATION
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#111827]">협업 형태</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {COLLABORATION_FORMATS.map((fmt) => (
              <div
                key={fmt.title}
                className="border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] space-y-2.5"
              >
                <p className="font-mono-tabular text-xs font-semibold text-[#465C77]">{fmt.index}.</p>
                <h3 className="text-base font-semibold text-[#111827]">{fmt.title}</h3>
                <p className="text-xs sm:text-sm text-[#667085] leading-relaxed">{fmt.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <WorkWithNovaSection />
    </>
  );
};
