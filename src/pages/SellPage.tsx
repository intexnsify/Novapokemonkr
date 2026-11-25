import { pages, inCollection } from '../seo/catalog.js';
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, CheckCircle2, ImagePlus, Lock, Maximize2, Trash2 } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { trackAnalyticsEvent } from '../lib/analytics';
import { db } from '../lib/firebase';
import { uploadBuybackPhoto, validateImageFile } from '../lib/storage';
import { generateSafeId } from '../lib/utils';
import { CardLanguage } from '../types/nova';
import { NewsImageLightbox } from '../components/NewsImageLightbox';
import { SafeImage } from '../components/SafeImage';
import { SeoManager } from '../components/SeoManager';

const COOLDOWN_KEY = 'nova_sell_cooldown_until';
const COOLDOWN_SECONDS = 60;
const MAX_PHOTOS = 4;

interface PreviewFile {
  file: File;
  previewUrl: string;
}

export const SellPage: React.FC = () => {
  const path = useLocation().pathname.replace(/\/$/, '') || '/sell';
  const meta = pages[path as keyof typeof pages] || pages['/sell'];
  const { config, isPreviewDraft, buybackGuideImageUrl } = useSite();
  const previewSuffix = isPreviewDraft ? '?preview=draft' : '';

  const [cardName, setCardName] = useState('');
  const [language, setLanguage] = useState<CardLanguage>('한국어');
  const [condition, setCondition] = useState('');
  const [desiredPrice, setDesiredPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState('');
  const [photos, setPhotos] = useState<PreviewFile[]>([]);
  const [guideLightboxIdx, setGuideLightboxIdx] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    trackAnalyticsEvent('page_view', '/sell');
  }, []);

  useEffect(() => {
    const checkCooldown = () => {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || '0');
      const diff = Math.ceil((until - Date.now()) / 1000);
      setCooldownLeft(diff > 0 ? diff : 0);
    };
    checkCooldown();
    const timer = window.setInterval(checkCooldown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      setErrorMsg(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      e.target.value = '';
      return;
    }

    const validated: PreviewFile[] = [];
    for (const file of files) {
      const err = validateImageFile(file);
      if (err) {
        setErrorMsg(err);
        e.target.value = '';
        return;
      }
      validated.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setPhotos((prev) => [...prev, ...validated]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cooldownLeft > 0) {
      setErrorMsg(`연속 접수를 방지하기 위해 ${cooldownLeft}초 후 다시 시도해 주세요.`);
      return;
    }

    const cleanName = cardName.trim();
    const cleanCondition = condition.trim();
    const qtyNum = Number(quantity);

    if (!cleanName || cleanName.length > 140) {
      setErrorMsg('카드 이름을 1~140자 이내로 입력해 주세요.');
      return;
    }
    if (!cleanCondition || cleanCondition.length > 100) {
      setErrorMsg('등급 또는 상태(예: PSA 10, A급, 미개봉 등)를 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1 || qtyNum > 9999) {
      setErrorMsg('수량은 1 이상의 올바른 숫자로 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    const submissionId = generateSafeId('buyback');

    try {
      const photoUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const url = await uploadBuybackPhoto(submissionId, photos[i].file, i);
        photoUrls.push(url);
      }

      await setDoc(doc(db, 'buyback_requests', submissionId), {
        cardName: cleanName,
        language,
        condition: cleanCondition,
        desiredPrice: desiredPrice.trim().slice(0, 80),
        quantity: Math.round(qtyNum),
        notes: notes.trim().slice(0, 2000),
        contact: contact.trim().slice(0, 140),
        photoUrls,
        status: '신규',
        offerPrice: '',
        adminMemo: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      void trackAnalyticsEvent('action_click', path, {targetType:'buyback_submit_success'});
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_SECONDS * 1000));
      setCooldownLeft(COOLDOWN_SECONDS);

      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);
      setCardName('');
      setCondition('');
      setDesiredPrice('');
      setQuantity('1');
      setNotes('');
      setContact('');
      setSubmittedId(submissionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(
        `접수 중 오류가 발생했습니다 (${msg}). 입력하신 내용과 사진은 그대로 유지되니 확인 후 다시 시도해 주세요.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoManager
        title={meta[0]} description={meta[1]}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="space-y-4 border-b border-[#E5E7EB] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-[#465C77] font-semibold">
              NOVA MARKET · PRIVATE BUYBACK
            </p>
            <Link
              to={`/shop${previewSuffix}`}
              className="text-xs font-medium text-[#667085] hover:text-[#111827] inline-flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>스토어 카탈로그 보기</span>
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#111827]">
            {meta[0]}
          </h1>
          <p className="text-sm sm:text-base text-[#667085] leading-relaxed">
            {meta[1]}
          </p>
          <div className="flex items-start gap-2.5 p-3.5 rounded-md border border-[#E5E7EB] bg-[#F5F6F8] text-xs text-[#667085]">
            <Lock size={14} className="mt-0.5 shrink-0 text-[#465C77]" />
            <span>
              제출된 카드 정보·사진·연락처는 보안 저장소에 보관되며 일반 방문자에게 절대 공개되지 않습니다.
            </span>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-3"><a href="#quote" className="inline-flex min-h-12 items-center bg-slate-900 text-white rounded px-5">매입 견적 신청하기</a>{['/sell/psa','/sell/singles','/sell/sealed'].map((u,i)=><Link key={u} className="text-sm underline" to={u+previewSuffix}>{['PSA 등급카드','싱글카드','미개봉 박스'][i]} 매입</Link>)}</nav>
        {Boolean(config.eventsSettings?.buybackPrices?.length) && <section><h2 className="font-bold">매입 기준 가격표</h2><dl>{(config.eventsSettings?.buybackPrices || []).filter(r=>r.name && r.price>0).map((r,i)=><div key={i} className="flex justify-between py-2 border-b"><dt>{r.name}</dt><dd>{r.price.toLocaleString('ko-KR')}원</dd></div>)}</dl></section>}
        <section className="space-y-3"><h2 className="text-xl font-semibold">매입 절차와 자주 묻는 질문</h2><p>사진과 수량 제출 → 상태 검토 및 견적 안내 → 거래 조건 확인</p><details><summary>포켓몬카드 고가매입 견적은 어떻게 결정되나요?</summary><p>카드 번호, 언어, 등급, 보관 상태를 확인합니다. 희망 가격을 함께 적어 주세요. 최종 금액은 개별 안내를 통해 확인하세요.</p></details><details><summary>포켓몬카드 현금매입과 정산 방법을 확인하고 싶어요.</summary><p>희망하는 정산 방법을 요청사항에 남겨 주세요. 발송 전에 매입 가능 여부와 지급 방식, 시점을 담당자와 확인하세요.</p></details></section>
        {/* Dedicated Buyback Guide Card (Relocated exclusively from Home Hero) */}
        {buybackGuideImageUrl && (
          <section className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-[#FFFFFF]">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F5F6F8] flex items-center justify-between gap-3">
              <div>
                <p className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#465C77] font-semibold">
                  BUYBACK GUIDE
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-[#111827]">
                  포켓몬 카드 매입 안내 및 기준 가이드
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideLightboxIdx(0)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] rounded-md hover:border-[#111827] inline-flex items-center gap-1.5 transition-colors"
              >
                <Maximize2 size={13} />
                <span>크게 보기</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setGuideLightboxIdx(0)}
              aria-label="매입 안내표 확대 보기"
              className="w-full bg-[#F5F6F8] p-3 sm:p-4 flex items-center justify-center cursor-zoom-in"
            >
              <SafeImage
                src={buybackGuideImageUrl}
                alt="포켓몬 카드 매입 안내 및 기준 가이드"
                fallbackTitle="매입 안내 가이드"
                className="max-h-[420px] w-auto object-contain rounded border border-[#E5E7EB]"
              />
            </button>
          </section>
        )}

        {submittedId && (
          <div className="border border-[#B6DFCE] rounded-lg p-6 bg-[#ECF7F2] space-y-3">
            <div className="flex items-center gap-2.5 text-[#0F6B4B]">
              <CheckCircle2 size={20} />
              <h2 className="text-base font-semibold">매입 신청이 안전하게 접수되었습니다</h2>
            </div>
            <p className="text-sm text-[#111827] leading-relaxed">
              접수 번호 <span className="font-mono-tabular font-semibold">{submittedId}</span> 로 저장되었습니다. 관리자 검토 후 기재하신 연락처 또는 Instagram을 통해 안내해 드립니다.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="text-xs font-semibold text-[#0F6B4B] underline underline-offset-4 hover:opacity-80"
            >
              추가 카드 매입 신청하기
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="border border-red-300 rounded-lg p-4 bg-red-50 text-sm text-red-900 flex items-start gap-3"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
            <div className="space-y-1">
              <p className="font-semibold">매입 신청을 완료하지 못했습니다</p>
              <p className="text-xs text-red-800 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        <form id="quote" style={{scrollMarginTop:90}}
          onSubmit={handleSubmit}
          className="border border-[#E5E7EB] rounded-lg p-6 sm:p-8 bg-[#FFFFFF] space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="cardName" className="block text-xs font-semibold text-[#111827]">
                카드 / 상품 이름 <span className="text-[#465C77]">*</span>
              </label>
              <input
                id="cardName"
                type="text"
                required
                maxLength={140}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="예: 블래키 VMAX SA (이브이 히어로즈)"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="language" className="block text-xs font-semibold text-[#111827]">
                언어 <span className="text-[#465C77]">*</span>
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as CardLanguage)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] focus:outline-none focus:border-[#465C77]"
              >
                <option value="한국어">한국어</option>
                <option value="일본어">일본어</option>
                <option value="영어">영어</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="condition" className="block text-xs font-semibold text-[#111827]">
                등급 · 상태 <span className="text-[#465C77]">*</span>
              </label>
              <input
                id="condition"
                type="text"
                required
                maxLength={100}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="예: PSA 10 / NM / 미세 백화"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="desiredPrice" className="block text-xs font-semibold text-[#111827]">
                희망 매입가 (선택)
              </label>
              <input
                id="desiredPrice"
                type="text"
                maxLength={80}
                value={desiredPrice}
                onChange={(e) => setDesiredPrice(e.target.value)}
                placeholder="예: 350,000원 또는 제안 희망"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="quantity" className="block text-xs font-semibold text-[#111827]">
                수량 <span className="text-[#465C77]">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                required
                min={1}
                max={9999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="contact" className="block text-xs font-semibold text-[#111827]">
                연락처 (선택 · Instagram ID, 이메일 또는 전화번호)
              </label>
              <input
                id="contact"
                type="text"
                maxLength={140}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="회신받으실 Instagram @아이디 또는 연락처"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="notes" className="block text-xs font-semibold text-[#111827]">
                추가 설명 (선택)
              </label>
              <textarea
                id="notes"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="카드 하자 유무, 직거래/택배 희망 여부 등 참고 사항을 자유롭게 작성해 주세요."
                className="w-full px-3.5 py-2.5 text-sm bg-[#F5F6F8] border border-[#E5E7EB] rounded-md text-[#111827] placeholder:text-[#667085] focus:outline-none focus:border-[#465C77]"
              />
            </div>

            <div className="sm:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#111827]">
                  사진 첨부 (최대 {MAX_PHOTOS}장 · 장당 5MB 이하 이미지)
                </label>
                <span className="text-xs font-mono-tabular text-[#667085]">
                  {photos.length} / {MAX_PHOTOS}
                </span>
              </div>

              {photos.length < MAX_PHOTOS && (
                <label className="flex flex-col items-center justify-center min-h-[116px] border border-dashed border-[#D1D5DB] rounded-lg bg-[#F5F6F8] hover:border-[#465C77] cursor-pointer transition-colors p-4 text-center">
                  <ImagePlus size={22} className="text-[#465C77] mb-2" />
                  <span className="text-xs font-semibold text-[#111827]">
                    카드 앞·뒷면 또는 슬랩 사진 선택
                  </span>
                  <span className="text-[11px] text-[#667085] mt-1">
                    JPG, PNG, WEBP 지원 (5MB 이하)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-md overflow-hidden border border-[#E5E7EB] bg-[#F5F6F8]"
                    >
                      <img
                        src={p.previewUrl}
                        alt={`첨부 사진 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        aria-label={`사진 ${idx + 1} 삭제`}
                        className="absolute top-1.5 right-1.5 w-8 h-8 rounded bg-[#FFFFFF]/90 text-[#111827] flex items-center justify-center border border-[#E5E7EB] hover:border-red-500 hover:text-red-600 shadow-sm"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={submitting || cooldownLeft > 0}
              className="w-full min-h-[48px] px-6 py-3 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? '사진 업로드 및 매입 접수 중...'
                : cooldownLeft > 0
                  ? `${cooldownLeft}초 후 다시 신청 가능`
                  : '비공개 매입 신청 제출하기'}
            </button>
          </div>
        </form>
      </div>

      {buybackGuideImageUrl && (
        <NewsImageLightbox
          images={[
            {
              url: buybackGuideImageUrl,
              alt: '포켓몬 카드 매입 안내 및 기준 가이드',
              caption: '포켓몬 카드 매입 안내 및 기준 가이드',
            },
          ]}
          activeIndex={guideLightboxIdx}
          onClose={() => setGuideLightboxIdx(null)}
          onChangeIndex={setGuideLightboxIdx}
        />
      )}
    </>
  );
};
