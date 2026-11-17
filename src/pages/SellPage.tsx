import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, ImagePlus, Lock, Trash2 } from 'lucide-react';
import { trackAnalyticsEvent } from '../lib/analytics';
import { db } from '../lib/firebase';
import { uploadBuybackPhoto, validateImageFile } from '../lib/storage';
import { generateSafeId } from '../lib/utils';
import { CardLanguage } from '../types/nova';
import { SeoManager } from '../components/SeoManager';

const COOLDOWN_KEY = 'nova_sell_cooldown_until';
const COOLDOWN_SECONDS = 60;
const MAX_PHOTOS = 4;

interface PreviewFile {
  file: File;
  previewUrl: string;
}

export const SellPage: React.FC = () => {
  const [cardName, setCardName] = useState('');
  const [language, setLanguage] = useState<CardLanguage>('한국어');
  const [condition, setCondition] = useState('');
  const [desiredPrice, setDesiredPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState('');
  const [photos, setPhotos] = useState<PreviewFile[]>([]);

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

      // Set cooldown only on success
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_SECONDS * 1000));
      setCooldownLeft(COOLDOWN_SECONDS);

      // Revoke previews & reset form
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
      // Preserve all user inputs and attached photos on failure!
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
        title="카드 매입 신청"
        description="NOVA 비공개 Pokémon TCG 카드 매입 신청. 사진 첨부로 간편하게 견적을 받아보세요."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
        <div className="space-y-3 border-b border-[#303741] pb-6">
          <p className="font-brand text-xs tracking-[0.2em] text-[#929AA6]">PRIVATE BUYBACK</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F3F4F6]">카드 매입 신청</h1>
          <p className="text-sm text-[#929AA6] leading-relaxed">
            소장 중인 Pokémon TCG 싱글·등급 카드 및 미개봉 박스의 매입을 접수합니다.
          </p>
          <div className="flex items-start gap-2.5 pt-1 text-xs text-[#C5CBD3]">
            <Lock size={14} className="mt-0.5 shrink-0 text-[#8068BA]" />
            <span>
              제출된 카드 정보·사진·연락처는 보안 저장소에 암호화 보관되며 일반 방문자에게 절대 공개되지 않습니다.
            </span>
          </div>
        </div>

        {submittedId && (
          <div className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-3">
            <div className="flex items-center gap-2.5 text-[#F3F4F6]">
              <CheckCircle2 size={20} className="text-[#C5CBD3]" />
              <h2 className="text-base font-semibold">매입 신청이 안전하게 접수되었습니다</h2>
            </div>
            <p className="text-sm text-[#929AA6] leading-relaxed">
              접수 번호 <span className="font-mono-tabular text-[#F3F4F6]">{submittedId}</span> 로 저장되었습니다. 관리자 검토 후 기재하신 연락처 또는 Instagram을 통해 안내해 드립니다.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="text-xs font-medium text-[#C5CBD3] underline underline-offset-4 hover:text-[#F3F4F6]"
            >
              추가 카드 매입 신청하기
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="border border-red-400/50 rounded-lg p-4 bg-red-950/30 text-sm text-red-200 flex items-start gap-3"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-300" />
            <div className="space-y-1">
              <p className="font-medium">매입 신청을 완료하지 못했습니다</p>
              <p className="text-xs text-red-200/90 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="border border-[#303741] rounded-lg p-6 sm:p-8 bg-[#171C23] space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="cardName" className="block text-xs font-medium text-[#C5CBD3]">
                카드 / 상품 이름 <span className="text-[#8068BA]">*</span>
              </label>
              <input
                id="cardName"
                type="text"
                required
                maxLength={140}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="예: 블래키 VMAX SA (이브이 히어로즈)"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6]/60 focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="language" className="block text-xs font-medium text-[#C5CBD3]">
                언어 <span className="text-[#8068BA]">*</span>
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as CardLanguage)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] focus:outline-none focus:border-[#C5CBD3]"
              >
                <option value="한국어">한국어</option>
                <option value="일본어">일본어</option>
                <option value="영어">영어</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="condition" className="block text-xs font-medium text-[#C5CBD3]">
                등급 · 상태 <span className="text-[#8068BA]">*</span>
              </label>
              <input
                id="condition"
                type="text"
                required
                maxLength={100}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="예: PSA 10 / NM / 미세 백화"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6]/60 focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="desiredPrice" className="block text-xs font-medium text-[#C5CBD3]">
                희망 매입가 (선택)
              </label>
              <input
                id="desiredPrice"
                type="text"
                maxLength={80}
                value={desiredPrice}
                onChange={(e) => setDesiredPrice(e.target.value)}
                placeholder="예: 350,000원 또는 제안 희망"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6]/60 focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="quantity" className="block text-xs font-medium text-[#C5CBD3]">
                수량 <span className="text-[#8068BA]">*</span>
              </label>
              <input
                id="quantity"
                type="number"
                required
                min={1}
                max={9999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="contact" className="block text-xs font-medium text-[#C5CBD3]">
                연락처 (선택 · Instagram ID, 이메일 또는 전화번호)
              </label>
              <input
                id="contact"
                type="text"
                maxLength={140}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="회신받으실 Instagram @아이디 또는 연락처"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6]/60 focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="notes" className="block text-xs font-medium text-[#C5CBD3]">
                추가 설명 (선택)
              </label>
              <textarea
                id="notes"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="카드 하자 유무, 직거래/택배 희망 여부 등 참고 사항을 자유롭게 작성해 주세요."
                className="w-full px-3.5 py-2.5 text-sm bg-[#080A0D] border border-[#303741] rounded-md text-[#F3F4F6] placeholder:text-[#929AA6]/60 focus:outline-none focus:border-[#C5CBD3]"
              />
            </div>

            {/* Photo Upload (max 4, <= 5MB each) */}
            <div className="sm:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#C5CBD3]">
                  사진 첨부 (최대 {MAX_PHOTOS}장 · 장당 5MB 이하 이미지)
                </label>
                <span className="text-xs font-mono-tabular text-[#929AA6]">
                  {photos.length} / {MAX_PHOTOS}
                </span>
              </div>

              {photos.length < MAX_PHOTOS && (
                <label className="flex flex-col items-center justify-center min-h-[112px] border border-dashed border-[#303741] rounded-lg bg-[#11151A] hover:border-[#C5CBD3] cursor-pointer transition-colors p-4 text-center">
                  <ImagePlus size={22} className="text-[#C5CBD3] mb-2" />
                  <span className="text-xs font-medium text-[#F3F4F6]">
                    카드 앞·뒷면 또는 슬랩 사진 선택
                  </span>
                  <span className="text-[11px] text-[#929AA6] mt-1">
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
                      className="relative aspect-square rounded-md overflow-hidden border border-[#303741] bg-[#080A0D]"
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
                        className="absolute top-1.5 right-1.5 w-8 h-8 rounded bg-[#080A0D]/85 text-[#F3F4F6] flex items-center justify-center border border-[#303741] hover:border-[#C5CBD3]"
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
              className="w-full min-h-[48px] px-6 py-3 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold hover:bg-[#F3F4F6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </>
  );
};
