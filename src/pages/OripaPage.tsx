import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Info, Lock, Package, Sparkles, Youtube } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKRW, isValidExternalUrl } from '../lib/utils';
import { OripaItem, OripaScheduleMode, OripaSlotStatus } from '../types/nova';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';

const SCHEDULE_LABELS: Record<OripaScheduleMode, string> = {
  scheduled: '사전 일정 안내',
  always: '상시 대기',
  ended: '종료됨',
};

const SLOT_LABELS: Record<OripaSlotStatus, string> = {
  available: '구매 가능',
  reserved: '예약 중',
  sold: '판매 완료',
  disabled: '판매 중지',
};

export const OripaPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { oripaItems, isPreviewDraft } = useSite();
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [fulfillmentChoice, setFulfillmentChoice] = useState<'live' | 'ship'>('live');

  useEffect(() => {
    trackAnalyticsEvent('page_view', id ? `/oripa/${id}` : '/oripa');
  }, [id]);

  const activePack: OripaItem | undefined = useMemo(() => {
    if (oripaItems.length === 0) return undefined;
    if (id) {
      const byParam = oripaItems.find((o) => o.id === id);
      if (byParam) return byParam;
    }
    if (selectedPackId) {
      const byState = oripaItems.find((o) => o.id === selectedPackId);
      if (byState) return byState;
    }
    return oripaItems[0];
  }, [oripaItems, id, selectedPackId]);

  useEffect(() => {
    setSelectedNumbers([]);
    if (activePack?.fulfillmentMode === 'ship_only') {
      setFulfillmentChoice('ship');
    } else {
      setFulfillmentChoice('live');
    }
  }, [activePack?.id, activePack?.fulfillmentMode]);

  const slotStats = useMemo(() => {
    if (!activePack) return { total: 0, available: 0, reserved: 0, sold: 0, disabled: 0 };
    const total = Math.max(1, Math.min(200, activePack.totalSlots || 50));
    let available = 0;
    let reserved = 0;
    let sold = 0;
    let disabled = 0;
    for (let i = 1; i <= total; i++) {
      const st = activePack.slotStatuses?.[String(i)] || 'available';
      if (st === 'available') available += 1;
      else if (st === 'reserved') reserved += 1;
      else if (st === 'sold') sold += 1;
      else disabled += 1;
    }
    return { total, available, reserved, sold, disabled };
  }, [activePack]);

  const toggleNumber = (num: number, status: OripaSlotStatus) => {
    if (status !== 'available') return;
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  if (!activePack) {
    return (
      <>
        <SeoManager
          title="ORIPA · 라이브 개봉 및 미개봉 오리파"
          description="NOVA 유튜브 라이브 연동 및 미개봉 배송 선택형 오리파 사전 안내."
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
          <p className="font-mono-tabular text-xs tracking-[0.2em] text-[#465C77] uppercase font-semibold">
            NOVA ORIPA · COMING SOON
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827]">
            현재 준비 중인 오리파 상품이 없습니다
          </h1>
          <p className="text-sm text-[#667085]">
            새로운 오리파 기획이 등록되면 이곳에서 번호판과 진행 일정을 확인하실 수 있습니다.
          </p>
          <Link
            to={`/shop${previewSuffix}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-sm font-semibold transition-colors"
          >
            NOVA 스토어 둘러보기
          </Link>
        </div>
      </>
    );
  }

  const hasLiveUrl = isValidExternalUrl(activePack.youtubeLiveUrl || '');
  const hasChannelUrl = isValidExternalUrl(activePack.youtubeChannelUrl || '');
  const estimatedTotal = selectedNumbers.length * activePack.pricePerSlot;
  const purchasingDisabled = activePack.purchasingDisabled !== false;

  return (
    <>
      <SeoManager
        title={`ORIPA · ${activePack.title}`}
        description={activePack.subtitle || activePack.description || 'NOVA 오리파 사전 체험 페이지'}
        image={activePack.imageUrl}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-9">
        {/* Header */}
        <header className="border-b border-[#E5E7EB] pb-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-[#465C77] font-semibold">
              NOVA ORIPA · LIVE &amp; SEALED PRE-LAUNCH
            </p>
            <span className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-[#F1F5F9] text-[11px] font-semibold text-[#465C77]">
              {purchasingDisabled ? '결제 · 주문 준비 중' : SCHEDULE_LABELS[activePack.scheduleMode]}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111827] text-balance">
            {activePack.title}
          </h1>

          {activePack.subtitle && (
            <p className="text-sm sm:text-base text-[#667085] max-w-2xl leading-relaxed">
              {activePack.subtitle}
            </p>
          )}

          {oripaItems.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {oripaItems.map((pack) => {
                const isCurr = pack.id === activePack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      isCurr
                        ? 'bg-[#111827] text-[#FFFFFF] border-[#111827]'
                        : 'bg-[#FFFFFF] text-[#667085] border-[#E5E7EB] hover:text-[#111827]'
                    }`}
                  >
                    {pack.title}
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-4 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] flex items-start gap-3 text-xs text-[#667085] leading-relaxed">
            <Info size={16} className="text-[#465C77] shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              {activePack.policyNote ||
                '현재 법적 검토 및 PG(결제대행) 심사 전까지 실제 결제·주문은 비활성화되어 있습니다. 아래 번호판과 수령 방식 선택 UI는 사전 체험 및 구조 미리보기 용도입니다.'}
            </p>
          </div>
        </header>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Pack Overview & Number Grid */}
          <div className="lg:col-span-8 space-y-6">
            {/* Overview Banner */}
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF] grid grid-cols-1 sm:grid-cols-12">
              <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto bg-[#F5F6F8] border-b sm:border-b-0 sm:border-r border-[#E5E7EB]">
                <SafeImage
                  src={activePack.imageUrl}
                  alt={activePack.title}
                  fallbackTitle="NOVA ORIPA"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                    <span className="font-semibold text-[#465C77]">
                      {SCHEDULE_LABELS[activePack.scheduleMode]}
                    </span>
                    {activePack.liveScheduleText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activePack.liveScheduleText}</span>
                      </>
                    )}
                  </div>
                  <p className="font-mono-tabular text-2xl font-semibold text-[#111827]">
                    {formatKRW(activePack.pricePerSlot)}{' '}
                    <span className="text-xs font-normal text-[#667085]">/ 1구 기준</span>
                  </p>
                  {activePack.description && (
                    <p className="text-xs sm:text-sm text-[#667085] leading-relaxed">
                      {activePack.description}
                    </p>
                  )}
                </div>

                {/* Slot Availability Summary */}
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-[#E5E7EB] text-center">
                  <div className="p-2 rounded bg-[#F5F6F8]">
                    <p className="text-[10px] text-[#667085]">전체</p>
                    <p className="font-mono-tabular text-sm font-semibold text-[#111827]">
                      {slotStats.total}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-[#ECF7F2]">
                    <p className="text-[10px] text-[#0F6B4B]">가능</p>
                    <p className="font-mono-tabular text-sm font-semibold text-[#0F6B4B]">
                      {slotStats.available}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-[#F1F5F9]">
                    <p className="text-[10px] text-[#465C77]">예약</p>
                    <p className="font-mono-tabular text-sm font-semibold text-[#465C77]">
                      {slotStats.reserved}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-[#F5F6F8]">
                    <p className="text-[10px] text-[#667085]">완료</p>
                    <p className="font-mono-tabular text-sm font-semibold text-[#667085]">
                      {slotStats.sold + slotStats.disabled}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive 1..N Number Board */}
            <section className="border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#FFFFFF] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#111827]">
                    번호판 선택 (1 ~ {slotStats.total}번)
                  </h2>
                  <p className="text-xs text-[#667085] mt-0.5">
                    원하는 번호를 여러 개 클릭하여 예상 구성을 미리 확인하실 수 있습니다.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#667085]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs border border-[#D1D5DB] bg-[#FFFFFF]" />
                    가능
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs border border-[#465C77] bg-[#465C77]" />
                    선택됨
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs border border-[#CBD5E1] bg-[#F1F5F9]" />
                    예약 중
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs border border-[#E5E7EB] bg-[#EEF0F4]" />
                    완료/중지
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {Array.from({ length: slotStats.total }, (_, idx) => {
                  const num = idx + 1;
                  const status: OripaSlotStatus =
                    activePack.slotStatuses?.[String(num)] || 'available';
                  const isSelected = selectedNumbers.includes(num);
                  const isAvailable = status === 'available';

                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => toggleNumber(num, status)}
                      title={`${num}번 · ${SLOT_LABELS[status]}`}
                      className={`min-h-[44px] rounded-md border font-mono-tabular text-xs font-semibold flex flex-col items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#465C77] text-[#FFFFFF] border-[#465C77]'
                          : isAvailable
                            ? 'bg-[#FFFFFF] text-[#111827] border-[#D1D5DB] hover:border-[#111827] hover:bg-[#F5F6F8]'
                            : status === 'reserved'
                              ? 'bg-[#F1F5F9] text-[#465C77] border-[#CBD5E1] cursor-not-allowed'
                              : 'bg-[#EEF0F4] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed line-through'
                      }`}
                    >
                      <span>{num}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right: Fulfillment Mode, YouTube & Locked Checkout Panel */}
          <aside className="lg:col-span-4 border border-[#E5E7EB] rounded-lg p-5 sm:p-6 bg-[#FFFFFF] space-y-6 lg:sticky lg:top-24">
            <div className="space-y-3">
              <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#465C77] font-semibold">
                FULFILLMENT OPTIONS
              </p>
              <h2 className="text-base font-semibold text-[#111827]">개봉 및 수령 방식 선택</h2>

              <div className="grid grid-cols-1 gap-2">
                {(activePack.fulfillmentMode === 'live_or_ship' ||
                  activePack.fulfillmentMode === 'live_only') && (
                  <button
                    type="button"
                    onClick={() => setFulfillmentChoice('live')}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      fulfillmentChoice === 'live'
                        ? 'border-[#111827] bg-[#F5F6F8]'
                        : 'border-[#E5E7EB] bg-[#FFFFFF] hover:border-[#D1D5DB]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                      <Youtube size={14} className="text-[#465C77]" />
                      <span>유튜브 라이브 개봉 후 배송</span>
                    </p>
                    <p className="text-[11px] text-[#667085] mt-1">
                      공식 유튜브 라이브에서 실시간으로 선택한 번호를 개봉한 뒤 안전 포장하여 발송합니다.
                    </p>
                  </button>
                )}

                {(activePack.fulfillmentMode === 'live_or_ship' ||
                  activePack.fulfillmentMode === 'ship_only') && (
                  <button
                    type="button"
                    onClick={() => setFulfillmentChoice('ship')}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      fulfillmentChoice === 'ship'
                        ? 'border-[#111827] bg-[#F5F6F8]'
                        : 'border-[#E5E7EB] bg-[#FFFFFF] hover:border-[#D1D5DB]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                      <Package size={14} className="text-[#465C77]" />
                      <span>미개봉 실물 배송</span>
                    </p>
                    <p className="text-[11px] text-[#667085] mt-1">
                      선택한 번호의 오리파 팩을 개봉하지 않고 밀봉 상태 그대로 배송해 드립니다.
                    </p>
                  </button>
                )}
              </div>
            </div>

            {/* Selected Summary */}
            <div className="border-t border-[#E5E7EB] pt-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#667085]">선택한 번호 ({selectedNumbers.length}개)</span>
                {selectedNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedNumbers([])}
                    className="text-[#667085] hover:text-[#111827] underline"
                  >
                    초기화
                  </button>
                )}
              </div>

              <div className="p-3 rounded-md bg-[#F5F6F8] border border-[#E5E7EB] min-h-[48px] flex items-center">
                {selectedNumbers.length === 0 ? (
                  <p className="text-xs text-[#667085]">왼쪽 번호판에서 번호를 선택해 주세요.</p>
                ) : (
                  <p className="font-mono-tabular text-xs font-medium text-[#111827] break-words">
                    {selectedNumbers.map((n) => `#${n}`).join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs text-[#667085]">예상 참여 금액</span>
                <span className="font-mono-tabular text-xl font-semibold text-[#111827]">
                  {formatKRW(estimatedTotal)}
                </span>
              </div>
            </div>

            {/* YouTube Channel / Live Links (only when real URL configured) */}
            {(hasLiveUrl || hasChannelUrl) && (
              <div className="border-t border-[#E5E7EB] pt-5 space-y-2">
                <p className="text-xs font-semibold text-[#111827]">YouTube 라이브 연동 채널</p>
                {hasLiveUrl && (
                  <a
                    href={activePack.youtubeLiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[40px] px-3.5 py-2 border border-[#E5E7EB] bg-[#F5F6F8] hover:border-[#111827] rounded-md text-xs font-semibold text-[#111827] inline-flex items-center justify-between transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Youtube size={14} className="text-[#465C77]" />
                      <span>라이브 방송 링크 열기</span>
                    </span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {hasChannelUrl && (
                  <a
                    href={activePack.youtubeChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[40px] px-3.5 py-2 border border-[#E5E7EB] bg-[#FFFFFF] hover:border-[#111827] rounded-md text-xs font-medium text-[#667085] hover:text-[#111827] inline-flex items-center justify-between transition-colors"
                  >
                    <span>NOVA 공식 YouTube 채널</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* Disabled Payment / Pre-launch Lock CTA */}
            <div className="border-t border-[#E5E7EB] pt-5 space-y-3">
              <button
                type="button"
                disabled
                className="w-full min-h-[48px] px-4 py-3 rounded-md bg-[#F5F6F8] border border-[#D1D5DB] text-[#667085] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock size={14} />
                <span>결제 · 주문 준비 중 (법적 검토 · PG 심사 후 오픈)</span>
              </button>

              <p className="text-[11px] text-[#667085] leading-relaxed">
                <Sparkles size={11} className="inline mr-1 text-[#465C77]" />
                정식 오픈 시 결제 연동과 함께 배송·환불 기준 및 구성 고지가 제공됩니다.{' '}
                <Link to={`/legal/shipping${previewSuffix}`} className="underline text-[#111827]">
                  배송·환불 정책 보기
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};
