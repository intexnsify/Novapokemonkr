import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  CalendarClock,
  Camera,
  ChevronDown,
  ExternalLink,
  Info,
  Pin,
  Search,
  Sparkles,
} from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import {
  formatDropDateTime,
  formatDropPrice,
  getDropStatusInfo,
  isValidExternalUrl,
} from '../lib/utils';
import {
  DropCountry,
  DropSaleType,
  DropStatusLabel,
  DropTcgCategory,
  RetailCampaign,
  RetailDrop,
} from '../types/nova';
import { getButtonRadiusClass } from '../components/PublicLayout';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';
import { SponsorBanner } from '../components/SponsorBanner';

const SALE_TYPES: ('전체' | DropSaleType)[] = [
  '전체',
  '추첨 판매',
  '일반 정가 판매',
  '선착순 판매',
  '예약 판매',
];

const TCG_CATEGORIES: ('전체' | DropTcgCategory)[] = ['전체', '포켓몬', '원피스', '기타 TCG'];
const COUNTRIES: ('전체' | DropCountry)[] = ['전체', '한국', '일본', '미국'];

function getStatusTextClass(label: DropStatusLabel): string {
  switch (label) {
    case '응모 중':
    case '판매 확인':
    case '접수 중':
      return 'border-emerald-400/45 bg-emerald-950/35 text-emerald-200';
    case '마감 임박':
      return 'border-amber-400/55 bg-amber-950/40 text-amber-200';
    case '예정':
    case '시작 예정':
      return 'border-[#8068BA]/55 bg-[#8068BA]/15 text-[#E3DCF7]';
    case '재확인 필요':
    case '확인 필요':
      return 'border-[#C5CBD3]/40 bg-[#11151A] text-[#C5CBD3]';
    default:
      return 'border-[#303741] bg-[#080A0D] text-[#929AA6]';
  }
}

interface DropCardProps {
  drop: RetailDrop;
  hideCampaignConditions?: boolean;
  btnRadius: string;
  isAdminVerified?: boolean;
}

const DropCard: React.FC<DropCardProps> = ({
  drop,
  hideCampaignConditions,
  btnRadius,
  isAdminVerified,
}) => {
  const [condOpen, setCondOpen] = useState(false);
  const status = getDropStatusInfo(drop);
  const hasUrl = isValidExternalUrl(drop.officialUrl);
  const startText = drop.startAt ? formatDropDateTime(drop.startAt, drop.timezoneLabel) : '';
  const endText = drop.endAt ? formatDropDateTime(drop.endAt, drop.timezoneLabel) : '';
  const verifiedText = drop.verifiedAt
    ? formatDropDateTime(drop.verifiedAt, drop.timezoneLabel)
    : '미확인';

  return (
    <article
      className={`border rounded-lg overflow-hidden bg-[#171C23] flex flex-col justify-between transition-colors ${
        status.isEnded
          ? 'border-[#303741]/70 opacity-80'
          : drop.isPinned
            ? 'border-[#8068BA]/65 hover:border-[#C5CBD3]/70'
            : 'border-[#303741] hover:border-[#C5CBD3]/60'
      }`}
    >
      <div>
        {/* 1. Actual Product Photo (compact bounded height for mobile-first ergonomics) */}
        <div className="relative h-40 w-full bg-[#11151A] border-b border-[#303741]/70 overflow-hidden">
          {drop.imageUrl ? (
            <SafeImage
              src={drop.imageUrl}
              alt={drop.title}
              fallbackTitle={`${drop.tcg} · ${drop.title}`}
              className="w-full h-full object-contain p-2 bg-[#0D1015]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center px-4 text-center bg-gradient-to-br from-[#11151A] via-[#171C23] to-[#080A0D]">
              <p className="font-brand text-[10px] tracking-[0.2em] text-[#929AA6] uppercase mb-1">
                {drop.tcg} · {drop.country}
              </p>
              <p className="text-xs font-medium text-[#C5CBD3] line-clamp-2">{drop.title}</p>
              {isAdminVerified && (
                <Link
                  to="/admin?tab=drops"
                  className="mt-2.5 px-2.5 py-1 rounded border border-[#8068BA]/60 bg-[#8068BA]/15 text-[11px] text-[#E3DCF7] hover:border-[#C5CBD3] inline-flex items-center gap-1"
                >
                  <Camera size={11} />
                  <span>사진 등록</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* 2. Body: Mobile-first field order */}
        <div className="p-4 space-y-3">
          {/* Product Name & Source Metadata */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#929AA6] flex-wrap">
              <span className="text-[#C5CBD3] font-medium">{drop.tcg}</span>
              <span aria-hidden="true">·</span>
              <span>{drop.country}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{drop.retailer}</span>
            </div>
            <h3 className="text-base font-semibold text-[#F3F4F6] leading-snug line-clamp-2">
              {drop.title}
            </h3>
          </div>

          {/* 3. Sale Type & Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#929AA6]">
              <span className="font-medium text-[#C5CBD3]">{drop.saleType}</span>
              {drop.isPinned && (
                <span className="inline-flex items-center gap-0.5 text-[#C5CBD3]" title="상단 고정">
                  <Pin size={11} className="text-[#8068BA]" aria-hidden="true" />
                </span>
              )}
              {drop.isRecommended && (
                <span className="inline-flex items-center gap-0.5 text-[#C5CBD3]" title="추천">
                  <Sparkles size={11} className="text-[#C5CBD3]" aria-hidden="true" />
                  <span className="text-[11px]">추천</span>
                </span>
              )}
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold border rounded-sm ${getStatusTextClass(
                status.label
              )}`}
            >
              {status.label}
            </span>
          </div>

          {/* 4. Retail Price & Currency */}
          <div className="pt-2 border-t border-[#303741]/60 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-[#929AA6]">공식 정가</span>
            <span className="font-mono-tabular text-base font-semibold text-[#F3F4F6]">
              {formatDropPrice(drop.price, drop.currency)}
            </span>
          </div>

          {/* 5. Schedule / Deadline / Winner Window / Last Verified */}
          <div className="space-y-1 text-xs text-[#929AA6] bg-[#11151A] border border-[#303741]/70 rounded-md p-2.5">
            {startText && (
              <div className="flex items-center justify-between gap-2">
                <span>{drop.saleType === '추첨 판매' ? '응모 시작' : '판매 시작'}</span>
                <span className="font-mono-tabular text-[#C5CBD3]">{startText}</span>
              </div>
            )}
            {endText && (
              <div className="flex items-center justify-between gap-2">
                <span>{drop.saleType === '추첨 판매' ? '응모 마감' : '판매 종료'}</span>
                <span
                  className={`font-mono-tabular ${
                    status.isUrgent ? 'text-amber-200 font-semibold' : 'text-[#F3F4F6]'
                  }`}
                >
                  {endText}
                </span>
              </div>
            )}
            {!startText && !endText && (
              <div className="flex items-center justify-between gap-2">
                <span>판매 방식</span>
                <span className="text-[#C5CBD3]">상시/비정기 판매 (공식처 확인 필요)</span>
              </div>
            )}
            {drop.purchaseWindowText && !hideCampaignConditions && (
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-[#303741]/50">
                <span className="shrink-0">당첨 구매</span>
                <span className="font-mono-tabular text-right text-[#C5CBD3]">
                  {drop.purchaseWindowText}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#303741]/50 text-[11px]">
              <span>마지막 확인</span>
              <span className="font-mono-tabular">{verifiedText}</span>
            </div>
          </div>

          {/* Standalone conditions toggle (hidden when shown in parent Campaign block) */}
          {!hideCampaignConditions && drop.conditions && (
            <div>
              <button
                type="button"
                onClick={() => setCondOpen((v) => !v)}
                className="w-full py-1.5 text-xs text-[#C5CBD3] hover:text-[#F3F4F6] flex items-center justify-between"
              >
                <span>참여 조건 확인</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${condOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {condOpen && (
                <p className="mt-1 p-2.5 rounded bg-[#080A0D] border border-[#303741] text-[11px] text-[#929AA6] whitespace-pre-line leading-relaxed">
                  {drop.conditions}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Prominent Official Apply / Purchase Link CTA */}
      <div className="px-4 pb-4 pt-1">
        {hasUrl ? (
          <a
            href={drop.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackAnalyticsEvent('action_click', '/drops', {
                targetType: 'retail_drop_official',
                targetId: drop.id,
                targetLabel: `${drop.retailer} - ${drop.title}`,
              })
            }
            className={`min-h-[44px] w-full px-4 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${btnRadius} ${
              status.isEnded
                ? 'border border-[#303741] bg-[#11151A] text-[#C5CBD3] hover:border-[#C5CBD3]'
                : 'hover:opacity-90'
            }`}
            style={
              status.isEnded
                ? undefined
                : {
                    backgroundColor: 'var(--nova-silver)',
                    color: 'var(--nova-bg-main)',
                  }
            }
          >
            <span>
              {status.isEnded
                ? '공식 페이지 확인'
                : drop.saleType === '추첨 판매'
                  ? '공식 응모 페이지 바로가기'
                  : '공식 판매처 바로가기'}
            </span>
            <ExternalLink size={13} />
          </a>
        ) : (
          <span className="min-h-[44px] w-full px-4 py-2 text-xs border border-[#303741] text-[#929AA6] rounded flex items-center justify-center">
            공식 링크 준비 중
          </span>
        )}
      </div>
    </article>
  );
};

interface CampaignGroupBlockProps {
  campaign: RetailCampaign;
  items: RetailDrop[];
  btnRadius: string;
  isAdminVerified?: boolean;
}

const CampaignGroupBlock: React.FC<CampaignGroupBlockProps> = ({
  campaign,
  items,
  btnRadius,
  isAdminVerified,
}) => {
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const campaignStatus = getDropStatusInfo({
    id: campaign.id,
    title: campaign.title,
    tcg: '포켓몬',
    country: campaign.country,
    retailer: campaign.retailer,
    saleType: campaign.saleType,
    price: 0,
    currency: 'JPY',
    officialUrl: campaign.officialUrl || '',
    timezoneLabel: campaign.timezoneLabel,
    startAt: campaign.startAt,
    endAt: campaign.endAt,
    purchaseWindowText: campaign.purchaseWindowText,
    conditions: campaign.conditions,
    manualStatus: 'auto',
    verifiedAt: campaign.verifiedAt,
    isPinned: campaign.isPinned,
    isRecommended: campaign.isRecommended,
    archiveEnded: campaign.archiveEnded,
    order: 0,
    visibilityState: campaign.visibilityState,
  });

  return (
    <section className="border border-[#303741] rounded-lg bg-[#11151A] overflow-hidden">
      {/* Shared Campaign Header */}
      <div className="p-5 sm:p-6 border-b border-[#303741] bg-[#171C23] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#929AA6]">
              <span className="font-mono-tabular text-[#8068BA] font-semibold">CAMPAIGN GROUP</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#C5CBD3] font-medium">{campaign.retailer}</span>
              <span aria-hidden="true">·</span>
              <span>{campaign.country}</span>
              <span aria-hidden="true">·</span>
              <span>{campaign.saleType}</span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold border rounded-sm ${getStatusTextClass(
                  campaignStatus.label
                )}`}
              >
                {campaignStatus.label}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6] text-balance">
              {campaign.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="font-mono-tabular text-xs text-[#C5CBD3] px-3 py-1.5 rounded border border-[#303741] bg-[#11151A]">
              대상 상품 {items.length}종
            </span>
            {isAdminVerified && (
              <Link
                to="/admin?tab=drops"
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium border border-[#8068BA]/60 bg-[#8068BA]/15 text-[#E3DCF7] hover:border-[#C5CBD3] inline-flex items-center gap-1.5 ${btnRadius}`}
              >
                <Camera size={12} />
                <span>사진·상품 관리</span>
              </Link>
            )}
            {campaign.officialUrl && isValidExternalUrl(campaign.officialUrl) && (
              <a
                href={campaign.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium border border-[#303741] bg-[#080A0D] text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center gap-1.5 ${btnRadius}`}
              >
                <span>판매처 메인</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Shared Schedule Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded border border-[#303741] bg-[#11151A] space-y-1">
            <p className="text-[#929AA6]">응모 · 판매 시작</p>
            <p className="font-mono-tabular font-medium text-[#F3F4F6]">
              {campaign.startAt
                ? formatDropDateTime(campaign.startAt, campaign.timezoneLabel)
                : '-'}
            </p>
          </div>
          <div className="p-3 rounded border border-[#303741] bg-[#11151A] space-y-1">
            <p className="text-[#929AA6]">응모 마감</p>
            <p
              className={`font-mono-tabular font-semibold ${
                campaignStatus.isUrgent ? 'text-amber-200' : 'text-[#F3F4F6]'
              }`}
            >
              {campaign.endAt ? formatDropDateTime(campaign.endAt, campaign.timezoneLabel) : '-'}
            </p>
          </div>
          <div className="p-3 rounded border border-[#303741] bg-[#11151A] space-y-1">
            <p className="text-[#929AA6]">당첨자 구매 기간</p>
            <p className="font-mono-tabular font-medium text-[#C5CBD3]">
              {campaign.purchaseWindowText || '개별 상품 안내 참고'}
            </p>
          </div>
          <div className="p-3 rounded border border-[#303741] bg-[#11151A] space-y-1">
            <p className="text-[#929AA6]">마지막 정보 확인일</p>
            <p className="font-mono-tabular font-medium text-[#C5CBD3]">
              {campaign.verifiedAt
                ? formatDropDateTime(campaign.verifiedAt, campaign.timezoneLabel)
                : '-'}
            </p>
          </div>
        </div>

        {/* Shared Participation Rules */}
        {campaign.conditions && (
          <div className="border border-[#303741] rounded-md bg-[#080A0D]">
            <button
              type="button"
              onClick={() => setConditionsOpen((v) => !v)}
              aria-expanded={conditionsOpen}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-[#C5CBD3] hover:text-[#F3F4F6]"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={13} className="text-[#8068BA]" />
                <span>캠페인 공통 참여 조건 및 유의사항</span>
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform ${conditionsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {conditionsOpen && (
              <div className="px-4 pb-3.5 pt-1 text-xs text-[#929AA6] whitespace-pre-line leading-relaxed border-t border-[#303741]/60">
                {campaign.conditions}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Cards inside Campaign */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((drop) => (
          <DropCard
            key={drop.id}
            drop={drop}
            hideCampaignConditions={Boolean(campaign.conditions)}
            btnRadius={btnRadius}
            isAdminVerified={isAdminVerified}
          />
        ))}
      </div>
    </section>
  );
};

export const DropsPage: React.FC = () => {
  const { config, retailCampaigns, retailDrops, sponsors, isPreviewDraft, isAdminVerified } =
    useSite();
  const [saleTypeFilter, setSaleTypeFilter] = useState<'전체' | DropSaleType>('전체');
  const [tcgFilter, setTcgFilter] = useState<'전체' | DropTcgCategory>('전체');
  const [countryFilter, setCountryFilter] = useState<'전체' | DropCountry>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/drops');
  }, []);

  const btnRadius = getButtonRadiusClass(config.theme.buttonShape);
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  const dropsBannerSponsors = useMemo(
    () => sponsors.filter((s) => s.placement === 'drops_banner'),
    [sponsors]
  );

  const campaignMap = useMemo(
    () => new Map(retailCampaigns.map((c) => [c.id, c])),
    [retailCampaigns]
  );

  const filteredDrops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return retailDrops.filter((d) => {
      if (saleTypeFilter !== '전체' && d.saleType !== saleTypeFilter) return false;
      if (tcgFilter !== '전체' && d.tcg !== tcgFilter) return false;
      if (countryFilter !== '전체' && d.country !== countryFilter) return false;
      if (q) {
        const campTitle = d.campaignId ? campaignMap.get(d.campaignId)?.title || '' : '';
        const text = `${d.title} ${d.retailer} ${d.tcg} ${d.country} ${campTitle}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [retailDrops, saleTypeFilter, tcgFilter, countryFilter, searchQuery, campaignMap]);

  const { activeDrops, endedDrops } = useMemo(() => {
    const active: RetailDrop[] = [];
    const ended: RetailDrop[] = [];
    filteredDrops.forEach((drop) => {
      const status = getDropStatusInfo(drop);
      if (status.isEnded) {
        ended.push(drop);
      } else {
        active.push(drop);
      }
    });
    return { activeDrops: active, endedDrops: ended };
  }, [filteredDrops]);

  const groupDropsByCampaign = (list: RetailDrop[]) => {
    const campOrder: string[] = [];
    const byCamp = new Map<string, RetailDrop[]>();
    const standalone: RetailDrop[] = [];

    list.forEach((d) => {
      if (d.campaignId && campaignMap.has(d.campaignId)) {
        if (!byCamp.has(d.campaignId)) {
          byCamp.set(d.campaignId, []);
          campOrder.push(d.campaignId);
        }
        byCamp.get(d.campaignId)!.push(d);
      } else {
        standalone.push(d);
      }
    });

    // Sort campaigns: pinned first, then order
    campOrder.sort((a, b) => {
      const ca = campaignMap.get(a);
      const cb = campaignMap.get(b);
      if ((ca?.isPinned ?? false) !== (cb?.isPinned ?? false)) {
        return ca?.isPinned ? -1 : 1;
      }
      return 0;
    });

    return {
      campaigns: campOrder.map((cid) => ({
        campaign: campaignMap.get(cid)!,
        items: byCamp.get(cid)!,
      })),
      standalone,
    };
  };

  const activeGrouped = useMemo(() => groupDropsByCampaign(activeDrops), [activeDrops, campaignMap]);
  const endedGrouped = useMemo(() => {
    const visibleEnded = showArchived
      ? endedDrops
      : endedDrops.filter((d) => !d.archiveEnded);
    return groupDropsByCampaign(visibleEnded);
  }, [endedDrops, showArchived, campaignMap]);

  const archivedCount = endedDrops.filter((d) => d.archiveEnded).length;

  return (
    <>
      <SeoManager
        title="TCG 정가 구매·추첨 정보"
        description="한국·일본·미국 포켓몬·원피스 및 주요 TCG 공식 정가 판매, 추첨(래플), 선착순, 예약 판매 통합 안내."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
        {/* Page Header */}
        <header className="border-b border-[#303741] pb-6 space-y-3">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">
            RETAIL DROP &amp; RAFFLE HUB
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">
                정가 구매 · 추첨 통합 정보
              </h1>
              <p className="text-sm text-[#929AA6] max-w-2xl">
                국내외 공식 판매처의 추첨, 일반 정가 판매, 선착순, 예약 판매 일정과 참여 조건을 한눈에 확인하고 공식 페이지로 바로 이동할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-[#C5CBD3] shrink-0">
              <span>진행·예정 {activeDrops.length}건</span>
              <span aria-hidden="true" className="text-[#303741]">
                |
              </span>
              <span className="text-[#929AA6]">종료 {endedDrops.length}건</span>
              {isAdminVerified && (
                <Link
                  to="/admin?tab=drops"
                  className={`ml-1 px-3 py-1.5 font-sans text-xs font-medium border border-[#8068BA]/60 bg-[#8068BA]/15 text-[#E3DCF7] hover:border-[#C5CBD3] inline-flex items-center gap-1.5 ${btnRadius}`}
                >
                  <Camera size={12} />
                  <span>관리자 사진 등록</span>
                </Link>
              )}
            </div>
          </div>

          {/* Honest Platform Disclaimer */}
          <div className="mt-2 p-3.5 rounded-md border border-[#303741] bg-[#11151A] flex items-start gap-2.5 text-xs text-[#929AA6] leading-relaxed">
            <Info size={15} className="text-[#8068BA] shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              NOVA는 공식 판매·추첨 일정을 안내하는 정보 플랫폼이며 직접 응모를 접수하거나 대행하지 않습니다. 추첨 마감 상태는 등록된 기준 시각에 따라 자동 전환되며, 일반 정가 판매의 실시간 재고 여부는 반드시 공식 판매처 페이지에서 직접 확인해 주세요.
            </p>
          </div>
        </header>

        {/* Optional Drops Page Sponsor Banner (zero empty slots) */}
        {dropsBannerSponsors.length > 0 && (
          <div className="space-y-3">
            {dropsBannerSponsors.map((sp) => (
              <SponsorBanner
                key={sp.id}
                sponsor={sp}
                placement="drops_banner"
                path="/drops"
                variant="inline_ad"
                buttonRadiusClass={btnRadius}
                previewSuffix={previewSuffix}
              />
            ))}
          </div>
        )}

        {/* Filters */}
        <section
          aria-label="정가 구매 및 추첨 필터"
          className="border border-[#303741] rounded-lg p-4 sm:p-5 bg-[#11151A] space-y-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            {/* Sale Type */}
            <div className="lg:col-span-5 space-y-1.5">
              <p className="text-[11px] font-medium text-[#929AA6]">판매 유형</p>
              <div className="flex flex-wrap gap-1.5">
                {SALE_TYPES.map((type) => {
                  const active = saleTypeFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSaleTypeFilter(type)}
                      className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded border transition-colors ${
                        active
                          ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                          : 'bg-[#171C23] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TCG & Country */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="drops-tcg-filter" className="block text-[11px] font-medium text-[#929AA6]">
                  TCG 종류
                </label>
                <select
                  id="drops-tcg-filter"
                  value={tcgFilter}
                  onChange={(e) => setTcgFilter(e.target.value as '전체' | DropTcgCategory)}
                  className="w-full min-h-[36px] px-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {TCG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="drops-country-filter" className="block text-[11px] font-medium text-[#929AA6]">
                  국가
                </label>
                <select
                  id="drops-country-filter"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value as '전체' | DropCountry)}
                  className="w-full min-h-[36px] px-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="lg:col-span-3 space-y-1.5">
              <label htmlFor="drops-search" className="block text-[11px] font-medium text-[#929AA6]">
                검색
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929AA6]"
                  aria-hidden="true"
                />
                <input
                  id="drops-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제품명·판매처·캠페인..."
                  className="w-full min-h-[36px] pl-8 pr-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] placeholder:text-[#929AA6]/60"
                />
              </div>
            </div>
          </div>

          {archivedCount > 0 && (
            <div className="pt-3 border-t border-[#303741]/60 flex items-center justify-between text-xs">
              <span className="text-[#929AA6]">
                아카이브된 종료 추첨 {archivedCount}건이 숨김 처리되어 있습니다.
              </span>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 font-medium"
              >
                <Archive size={13} />
                <span>{showArchived ? '아카이브 숨기기' : '아카이브 기록 보기'}</span>
              </button>
            </div>
          )}
        </section>

        {/* Active / Upcoming Drops */}
        {activeDrops.length === 0 ? (
          <div className="border border-[#303741] rounded-lg p-10 text-center bg-[#11151A] space-y-2">
            <p className="text-sm font-medium text-[#F3F4F6]">
              선택한 조건에 해당하는 진행 중/예정 정보가 없습니다
            </p>
            <p className="text-xs text-[#929AA6]">
              필터를 전체로 초기화하거나 아래 종료·아카이브 기록을 확인해 보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {activeGrouped.campaigns.map(({ campaign, items }) => (
              <CampaignGroupBlock
                key={campaign.id}
                campaign={campaign}
                items={items}
                btnRadius={btnRadius}
                isAdminVerified={isAdminVerified}
              />
            ))}

            {activeGrouped.standalone.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">DIRECT DROPS</p>
                    <h2 className="text-lg sm:text-xl font-semibold text-[#F3F4F6]">
                      개별 정가 판매 · 추첨 정보
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {activeGrouped.standalone.map((drop) => (
                    <DropCard
                      key={drop.id}
                      drop={drop}
                      btnRadius={btnRadius}
                      isAdminVerified={isAdminVerified}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Ended / Archived History */}
        {(endedGrouped.campaigns.length > 0 || endedGrouped.standalone.length > 0) && (
          <section className="pt-6 border-t border-[#303741] space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.16em] text-[#929AA6] mb-1">ARCHIVED &amp; ENDED</p>
                <h2 className="text-lg font-semibold text-[#C5CBD3]">마감 · 아카이브 기록</h2>
              </div>
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-xs text-[#C5CBD3] hover:text-[#F3F4F6] border border-[#303741] px-3 py-1.5 rounded"
                >
                  {showArchived ? '아카이브 항목 접기' : `아카이브 항목 포함 (${archivedCount})`}
                </button>
              )}
            </div>

            {endedGrouped.campaigns.map(({ campaign, items }) => (
              <CampaignGroupBlock
                key={`ended_${campaign.id}`}
                campaign={campaign}
                items={items}
                btnRadius={btnRadius}
                isAdminVerified={isAdminVerified}
              />
            ))}

            {endedGrouped.standalone.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {endedGrouped.standalone.map((drop) => (
                  <DropCard
                    key={drop.id}
                    drop={drop}
                    btnRadius={btnRadius}
                    isAdminVerified={isAdminVerified}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
};
