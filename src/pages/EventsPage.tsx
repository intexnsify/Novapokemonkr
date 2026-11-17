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
        <div className="border-b border-[#303741] pb-6 space-y-2">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">SCHEDULE · ASIA/SEOUL (KST)</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">라이브 &amp; 이벤트</h1>
          <p className="text-sm text-[#929AA6]">
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
                  ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                  : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-[#303741] rounded-lg p-12 text-center bg-[#11151A] space-y-2">
            <Calendar size={24} className="mx-auto text-[#929AA6]" />
            <p className="text-base font-medium text-[#F3F4F6]">해당 상태의 일정이 없습니다</p>
            <p className="text-sm text-[#929AA6]">새로운 라이브 및 오프라인 행사가 곧 안내됩니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ev) => {
              const status = getEventStatus(ev.startAt, ev.endAt);
              return (
                <div
                  key={ev.id}
                  className="border border-[#303741] rounded-lg p-6 bg-[#171C23] flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                      <span
                        className={
                          status === '진행 중'
                            ? 'text-[#C5CBD3] font-semibold'
                            : status === '예정'
                              ? 'text-[#8068BA] font-medium'
                              : 'text-[#929AA6]'
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
                      {ev.isSample && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#C5CBD3]">SAMPLE</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-[#F3F4F6]">{ev.title}</h2>
                    {ev.description && (
                      <p className="text-sm text-[#929AA6] leading-relaxed">{ev.description}</p>
                    )}
                    <p className="text-xs font-mono-tabular text-[#C5CBD3] pt-1">
                      {formatKST(ev.startAt)} ~ {formatKST(ev.endAt)} (KST)
                    </p>
                  </div>

                  {ev.externalUrl && isValidExternalUrl(ev.externalUrl) && (
                    <a
                      href={ev.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 border border-[#303741] bg-[#11151A] text-xs font-medium text-[#F3F4F6] rounded-md inline-flex items-center justify-center gap-2 hover:border-[#C5CBD3] shrink-0 whitespace-nowrap"
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
