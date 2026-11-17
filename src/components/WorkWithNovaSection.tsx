import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Mail, MessageCircle } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { copyToClipboardSafe, getGmailComposeUrl, getInstagramDmUrl } from '../lib/utils';
import { getButtonRadiusClass } from './PublicLayout';

export const WorkWithNovaSection: React.FC = () => {
  const { config } = useSite();
  const [copied, setCopied] = useState(false);
  const [showManualCopy, setShowManualCopy] = useState(false);

  const email = config.brand.email || 'Jwkim9633@gmail.com';
  const dmUrl = getInstagramDmUrl(config.brand.instagramUrl);
  const gmailUrl = getGmailComposeUrl(
    email,
    '[NOVA 협업 문의] 광고 · 콘텐츠 · 행사 · 파트너십',
    '안녕하세요 NOVA 팀,\n\n문의 내용:\n연락처:\n'
  );
  const btnRadius = getButtonRadiusClass(config.theme.buttonShape);

  const handleCopyEmail = async () => {
    trackAnalyticsEvent('email_click', '/', {
      targetType: 'copy_email',
      targetLabel: email,
    });
    const ok = await copyToClipboardSafe(email);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // Fallback for strict Instagram/iOS in-app browsers
      setShowManualCopy(true);
    }
  };

  return (
    <section
      id="work-with-nova"
      className="border-t"
      style={{
        backgroundColor: 'var(--nova-bg-secondary)',
        borderColor: 'var(--nova-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <div
          className="border p-6 sm:p-10 md:p-12 rounded-lg"
          style={{
            backgroundColor: 'var(--nova-bg-card)',
            borderColor: 'var(--nova-border)',
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <p className="font-brand text-xs tracking-[0.22em]" style={{ color: 'var(--nova-silver)' }}>
                WORK WITH NOVA
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: 'var(--nova-text-primary)' }}>
                광고 · 콘텐츠 협업 · 행사 · 파트너십 문의
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--nova-text-secondary)' }}>
                브랜드 스폰서십, 카드 언박싱 및 컬렉션 콘텐츠, 오프라인 팝업·대회 협업 문의를 환영합니다.
                담당 이메일 또는 공식 Instagram DM으로 편하게 연락해 주세요.
              </p>
              <p className="font-mono-tabular text-sm pt-1" style={{ color: 'var(--nova-silver)' }}>
                {email}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[420px]">
              {/* 1. mailto */}
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('[NOVA 협업 문의]')}`}
                onClick={() =>
                  trackAnalyticsEvent('email_click', '/', {
                    targetType: 'mailto',
                    targetLabel: email,
                  })
                }
                className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border nova-transition whitespace-nowrap ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-silver)',
                  color: 'var(--nova-bg-main)',
                  borderColor: 'var(--nova-silver)',
                }}
              >
                <Mail size={16} />
                <span>이메일 작성</span>
              </a>

              {/* 2. Gmail compose */}
              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackAnalyticsEvent('email_click', '/', {
                    targetType: 'gmail_compose',
                    targetLabel: email,
                  })
                }
                className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border nova-transition whitespace-nowrap hover:border-[#C5CBD3] ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-bg-secondary)',
                  color: 'var(--nova-text-primary)',
                  borderColor: 'var(--nova-border)',
                }}
              >
                <ExternalLink size={16} />
                <span>Gmail에서 작성</span>
              </a>

              {/* 3. Copy email with in-app browser fallback */}
              <button
                type="button"
                onClick={handleCopyEmail}
                className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border nova-transition whitespace-nowrap hover:border-[#C5CBD3] ${btnRadius}`}
                style={{
                  backgroundColor: 'var(--nova-bg-secondary)',
                  color: 'var(--nova-text-primary)',
                  borderColor: 'var(--nova-border)',
                }}
              >
                {copied ? <Check size={16} className="text-[#C5CBD3]" /> : <Copy size={16} />}
                <span>{copied ? '이메일 복사됨' : '이메일 주소 복사'}</span>
              </button>

              {/* 4. Instagram DM */}
              {dmUrl && (
                <a
                  href={dmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackAnalyticsEvent('dm_click', '/', {
                      targetType: 'work_with_nova_dm',
                      targetLabel: 'Instagram DM',
                    })
                  }
                  className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border nova-transition whitespace-nowrap hover:opacity-90 ${btnRadius}`}
                  style={{
                    backgroundColor: 'var(--nova-accent)',
                    color: '#F3F4F6',
                    borderColor: 'var(--nova-accent)',
                  }}
                >
                  <MessageCircle size={16} />
                  <span>Instagram DM 문의</span>
                </a>
              )}
            </div>
          </div>

          {/* Fallback manual copy input for strict in-app browsers */}
          {showManualCopy && (
            <div className="mt-6 pt-5 border-t border-[#303741] space-y-2">
              <p className="text-xs text-[#929AA6]">
                인앱 브라우저 환경에서 자동 복사가 제한되었습니다. 아래 주소를 길게 눌러 직접 복사해 주세요.
              </p>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  readOnly
                  value={email}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  aria-label="NOVA 문의 이메일 주소"
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] focus:outline-none focus:border-[#C5CBD3]"
                />
                <button
                  type="button"
                  onClick={() => setShowManualCopy(false)}
                  className="min-h-[44px] px-3 text-xs border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6] shrink-0"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
