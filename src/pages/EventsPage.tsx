import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatKST, getEventStatus, isValidExternalUrl } from '../lib/utils';
import { SeoManager } from '../components/SeoManager';

export const EventsPage: React.FC = () => {
  const { events } = useSite();
  const [filter, setFilter] = useState<'전체' | '예정' | '진행 중' | '종료됨'>('전체');

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/events');
  }, []);

  const filtered = useMemo(() => {
    if (filter === '전체') return events;
    return events.filter((ev) => getEventStatus(ev.startAt, ev.endAt) === filter);
  }, [events, filter]);

  return (
    <>
      <SeoManager
        title="라이브 & 이벤트"
        description="NOVA 라이브 방송 및 컬렉터 이벤트 일정 (Asia/Seoul KST 기준)."
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="border-b border-[#E5E7EB] pb-6 space-y-2">
          <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#465C77] font-semibold">
            COMMUNITY · SCHEDULE (KST)
          </p>
          <h1 className="text-3xl font-semibold text-[#111827]">라이브 &amp; 이벤트</h1>
          <p className="text-sm text-[#667085]">
            모든 일정은 한국 표준시(Asia/Seoul) 기준으로 표시되며 종료 시 상태가 자동으로 전환됩니다.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['전체', '진행 중', '예정', '종료됨'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 border transition-colors ${
                filter === tab
                  ? 'bg-[#111827] text-[#FFFFFF] border-[#111827]'
                  : 'bg-[#FFFFFF] text-[#667085] border-[#E5E7EB] hover:text-[#111827]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-[#E5E7EB] rounded-lg p-12 text-center bg-[#FFFFFF] space-y-2">
            <Calendar size={24} className="mx-auto text-[#667085]" />
            <p className="text-base font-medium text-[#111827]">해당 상태의 일정이 없습니다</p>
            <p className="text-sm text-[#667085]">새로운 라이브 및 오프라인 행사가 곧 안내됩니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ev) => {
              const status = getEventStatus(ev.startAt, ev.endAt);
              return (
                <div
                  key={ev.id}
                  className="border border-[#E5E7EB] rounded-lg p-6 bg-[#FFFFFF] flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 text-xs text-[#667085]">
                      <span
                        className={
                          status === '진행 중'
                            ? 'text-[#0F6B4B] font-semibold'
                            : status === '예정'
                              ? 'text-[#465C77] font-semibold'
                              : 'text-[#667085]'
                        }
                      >
                        {status}
                      </span>
                      {ev.locationOrPlatform && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{ev.locationOrPlatform}</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-[#111827]">{ev.title}</h2>
                    {ev.description && (
                      <p className="text-sm text-[#667085] leading-relaxed">{ev.description}</p>
                    )}
                    <p className="text-xs font-mono-tabular text-[#111827] pt-1">
                      {formatKST(ev.startAt)} ~ {formatKST(ev.endAt)} (KST)
                    </p>
                  </div>

                  {ev.externalUrl && isValidExternalUrl(ev.externalUrl) && (
                    <a
                      href={ev.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 border border-[#E5E7EB] bg-[#F5F6F8] text-xs font-semibold text-[#111827] rounded-md inline-flex items-center justify-center gap-2 hover:border-[#111827] shrink-0 whitespace-nowrap transition-colors"
                    >
                      <span>채널 이동</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
