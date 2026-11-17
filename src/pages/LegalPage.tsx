import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { SeoManager } from '../components/SeoManager';

type LegalTab = 'privacy' | 'terms' | 'shipping' | 'business';

export const LegalPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const { config } = useSite();

  const activeTab: LegalTab =
    tab === 'terms' || tab === 'shipping' || tab === 'business' ? tab : 'privacy';

  useEffect(() => {
    trackAnalyticsEvent('page_view', `/legal/${activeTab}`);
  }, [activeTab]);

  const tabs: { id: LegalTab; label: string }[] = [
    { id: 'privacy', label: '개인정보처리방침' },
    { id: 'terms', label: '이용 안내' },
    { id: 'shipping', label: '배송·환불 안내' },
    { id: 'business', label: '사업자 정보' },
  ];

  const biz = config.legal.businessInfo;
  const hasAnyBizInfo = Boolean(
    biz.companyName || biz.representative || biz.registrationNumber || biz.ecommerceNumber || biz.address
  );

  return (
    <>
      <SeoManager
        title={tabs.find((t) => t.id === activeTab)?.label || '운영 및 약관'}
        description="NOVA 개인정보처리방침, 이용 안내, 배송·환불 안내 및 사업자 정보."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="border-b border-[#303741] pb-6 space-y-2">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">LEGAL &amp; POLICY</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">운영 정책 및 안내</h1>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              to={`/legal/${t.id}`}
              className={`min-h-[40px] px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 border transition-colors ${
                activeTab === t.id
                  ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                  : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="border border-[#303741] rounded-lg p-6 sm:p-8 bg-[#171C23]">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#F3F4F6]">개인정보처리방침</h2>
              <p className="text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
                {config.legal.privacyPolicy}
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#F3F4F6]">이용 안내</h2>
              <p className="text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
                {config.legal.termsOfUse}
              </p>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#F3F4F6]">배송·환불 안내</h2>
              <p className="text-sm text-[#929AA6] leading-relaxed whitespace-pre-line">
                {config.legal.shippingRefundPolicy}
              </p>
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[#F3F4F6]">사업자 정보</h2>
              {!hasAnyBizInfo ? (
                <div className="border border-[#303741] rounded-md p-5 bg-[#11151A] space-y-2">
                  <p className="text-sm font-medium text-[#F3F4F6]">사업자 정보 등록 예정</p>
                  <p className="text-xs text-[#929AA6] leading-relaxed">
                    현재 공식 사업자 정보 슬롯이 미등록 상태입니다. 관리자 설정에서 실제 사업자 정보를 입력하면 이 영역에 자동으로 반영됩니다.
                  </p>
                  {biz.supportContact && (
                    <p className="text-xs font-mono-tabular text-[#C5CBD3] pt-1">
                      공식 문의 이메일: {biz.supportContact}
                    </p>
                  )}
                </div>
              ) : (
                <dl className="divide-y divide-[#303741] text-sm">
                  {biz.companyName && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">상호명</dt>
                      <dd className="text-[#F3F4F6] font-medium">{biz.companyName}</dd>
                    </div>
                  )}
                  {biz.representative && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">대표자</dt>
                      <dd className="text-[#F3F4F6] font-medium">{biz.representative}</dd>
                    </div>
                  )}
                  {biz.registrationNumber && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">사업자등록번호</dt>
                      <dd className="font-mono-tabular text-[#F3F4F6]">{biz.registrationNumber}</dd>
                    </div>
                  )}
                  {biz.ecommerceNumber && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">통신판매업신고번호</dt>
                      <dd className="font-mono-tabular text-[#F3F4F6]">{biz.ecommerceNumber}</dd>
                    </div>
                  )}
                  {biz.address && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">사업장 소재지</dt>
                      <dd className="text-[#F3F4F6]">{biz.address}</dd>
                    </div>
                  )}
                  {biz.supportContact && (
                    <div className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-[#929AA6]">고객 문의</dt>
                      <dd className="font-mono-tabular text-[#C5CBD3]">{biz.supportContact}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
