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
      setShowManualCopy(true);
    }
  };

  return (
    <section
      id="work-with-nova"
      className="border-t border-[#E5E7EB] bg-[#F5F6F8]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="border border-[#E5E7EB] bg-[#FFFFFF] p-6 sm:p-8 md:p-10 rounded-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <p className="font-mono-tabular text-[11px] tracking-[0.2em] uppercase text-[#465C77] font-semibold">
                PARTNERSHIP &amp; MEDIA INQUIRY
              </p>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-[#111827] text-balance">
                공식 협찬 · 배너 광고 · 콘텐츠 협업 문의
              </h2>
              <p className="text-sm leading-relaxed text-[#667085]">
                메인 스폰서 배너 입점, 포켓몬카드 발매·추첨 파트너십, 언박싱 영상 협업 및 오프라인 행사 제휴 문의를 환영합니다.
                담당 이메일 또는 공식 Instagram DM으로 제안서를 보내주세요.
              </p>
              <p className="font-mono-tabular text-sm pt-1 text-[#111827] font-medium">
                {email}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[420px]">
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('[NOVA 협업 문의]')}`}
                onClick={() =>
                  trackAnalyticsEvent('email_click', '/', {
                    targetType: 'mailto',
                    targetLabel: email,
                  })
                }
                className={`min-h-[44px] px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] transition-colors whitespace-nowrap ${btnRadius}`}
              >
                <Mail size={16} />
                <span>이메일 작성</span>
              </a>

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
                className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border border-[#E5E7EB] bg-[#F5F6F8] text-[#111827] hover:border-[#D1D5DB] transition-colors whitespace-nowrap ${btnRadius}`}
              >
                <ExternalLink size={16} />
                <span>Gmail에서 작성</span>
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                className={`min-h-[44px] px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border border-[#E5E7EB] bg-[#F5F6F8] text-[#111827] hover:border-[#D1D5DB] transition-colors whitespace-nowrap ${btnRadius}`}
              >
                {copied ? <Check size={16} className="text-[#465C77]" /> : <Copy size={16} />}
                <span>{copied ? '이메일 복사됨' : '이메일 주소 복사'}</span>
              </button>

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
                  className={`min-h-[44px] px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border border-[#465C77] bg-[#465C77] text-[#FFFFFF] hover:bg-[#374A61] transition-colors whitespace-nowrap ${btnRadius}`}
                >
                  <MessageCircle size={16} />
                  <span>Instagram DM 문의</span>
                </a>
              )}
            </div>
          </div>

          {showManualCopy && (
            <div className="mt-6 pt-5 border-t border-[#E5E7EB] space-y-2">
              <p className="text-xs text-[#667085]">
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
                  className="w-full min-h-[44px] px-3 py-2 text-sm font-mono-tabular bg-[#F5F6F8] border border-[#E5E7EB] rounded text-[#111827] focus:outline-none focus:border-[#465C77]"
                />
                <button
                  type="button"
                  onClick={() => setShowManualCopy(false)}
                  className="min-h-[44px] px-3 text-xs border border-[#E5E7EB] rounded text-[#667085] hover:text-[#111827] shrink-0"
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
