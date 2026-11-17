import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { ASSET_IMAGES, DEFAULT_THEME } from '../../lib/defaults';
import { uploadPublicMedia } from '../../lib/storage';
import { generateSafeId } from '../../lib/utils';
import { CommunityLinkItem, HomeActionItem, SiteConfig } from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
import { useAdmin } from './AdminContext';

/* ============================================================================
   2. 브랜드 설정 (로고, 텍스트, SNS, 사업자/정책 편집)
============================================================================ */
export const BrandSettingsTab: React.FC = () => {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges, showToast } = useAdmin();
  const [uploading, setUploading] = useState<'logo' | 'hero' | null>(null);

  const updateBrand = (patch: Partial<SiteConfig['brand']>) => {
    setDraftConfig((prev) => ({
      ...prev,
      brand: { ...prev.brand, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const updateLegal = (patch: Partial<SiteConfig['legal']>) => {
    setDraftConfig((prev) => ({
      ...prev,
      legal: { ...prev.legal, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const updateBiz = (patch: Partial<SiteConfig['legal']['businessInfo']>) => {
    setDraftConfig((prev) => ({
      ...prev,
      legal: {
        ...prev.legal,
        businessInfo: { ...prev.legal.businessInfo, ...patch },
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleUpload = async (type: 'logo' | 'hero', file?: File) => {
    if (!file) return;
    setUploading(type);
    try {
      const url = await uploadPublicMedia('brand', file);
      updateBrand(type === 'logo' ? { logoUrl: url } : { heroImageUrl: url });
      showToast('이미지가 업로드되었습니다. [초안 저장] 또는 [변경사항 게시]를 눌러주세요.');
    } catch (err) {
      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">브랜드 · SNS · 법적 정보 설정</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          SNS URL을 비워두면 공개 페이지에서 해당 아이콘이 자동으로 숨겨집니다.
        </p>
      </div>

      {/* Brand Identity */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-5">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">기본 브랜드 &amp; 히어로 텍스트</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">브랜드명</label>
            <input
              type="text"
              value={draftConfig.brand.name}
              onChange={(e) => updateBrand({ name: e.target.value })}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">서브 태그라인</label>
            <input
              type="text"
              value={draftConfig.brand.tagline}
              onChange={(e) => updateBrand({ tagline: e.target.value })}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs text-[#929AA6]">히어로 헤드라인</label>
            <input
              type="text"
              value={draftConfig.brand.headline}
              onChange={(e) => updateBrand({ headline: e.target.value })}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs text-[#929AA6]">브랜드 소개문</label>
            <textarea
              rows={3}
              value={draftConfig.brand.description}
              onChange={(e) => updateBrand({ description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs text-[#929AA6]">로고 이미지 URL</label>
              <button
                type="button"
                onClick={() => updateBrand({ logoUrl: ASSET_IMAGES.logo })}
                className="text-[11px] text-[#929AA6] hover:text-[#C5CBD3]"
              >
                기본 로고 복원
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftConfig.brand.logoUrl}
                onChange={(e) => updateBrand({ logoUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={14} />
                <span>{uploading === 'logo' ? '중...' : '업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUpload('logo', e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="w-16 h-16 rounded-full ring-1 ring-[#8068BA]/35 overflow-hidden bg-[#080A0D]">
              <SafeImage
                key={draftConfig.brand.logoUrl}
                src={draftConfig.brand.logoUrl}
                alt="로고 미리보기"
                className="w-full h-full object-cover scale-[1.08]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs text-[#929AA6]">히어로 비주얼 이미지 URL</label>
              <button
                type="button"
                onClick={() => updateBrand({ heroImageUrl: ASSET_IMAGES.hero })}
                className="text-[11px] text-[#929AA6] hover:text-[#C5CBD3]"
              >
                기본 이미지 복원
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftConfig.brand.heroImageUrl}
                onChange={(e) => updateBrand({ heroImageUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={14} />
                <span>{uploading === 'hero' ? '중...' : '업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUpload('hero', e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="w-40 aspect-[16/9] rounded border border-[#303741] overflow-hidden bg-[#080A0D]">
              <SafeImage src={draftConfig.brand.heroImageUrl} alt="히어로 미리보기" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* SNS */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">공식 SNS 및 이메일</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">Instagram URL</label>
            <input
              type="url"
              value={draftConfig.brand.instagramUrl}
              onChange={(e) => updateBrand({ instagramUrl: e.target.value })}
              placeholder="https://www.instagram.com/novapokemonkr/"
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">공식 이메일</label>
            <input
              type="email"
              value={draftConfig.brand.email}
              onChange={(e) => updateBrand({ email: e.target.value })}
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">TikTok URL (미등록 시 자동 숨김)</label>
            <input
              type="url"
              value={draftConfig.brand.tiktokUrl}
              onChange={(e) => updateBrand({ tiktokUrl: e.target.value })}
              placeholder="https://www.tiktok.com/@..."
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">YouTube URL (미등록 시 자동 숨김)</label>
            <input
              type="url"
              value={draftConfig.brand.youtubeUrl}
              onChange={(e) => updateBrand({ youtubeUrl: e.target.value })}
              placeholder="https://www.youtube.com/@..."
              className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>
        </div>
      </div>

      {/* Business Info Slot */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">사업자 정보 슬롯 (미입력 시 비공개/등록 예정 표시)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="상호명"
            value={draftConfig.legal.businessInfo.companyName}
            onChange={(e) => updateBiz({ companyName: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="대표자명"
            value={draftConfig.legal.businessInfo.representative}
            onChange={(e) => updateBiz({ representative: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="사업자등록번호"
            value={draftConfig.legal.businessInfo.registrationNumber}
            onChange={(e) => updateBiz({ registrationNumber: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="통신판매업신고번호"
            value={draftConfig.legal.businessInfo.ecommerceNumber}
            onChange={(e) => updateBiz({ ecommerceNumber: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="사업장 소재지"
            value={draftConfig.legal.businessInfo.address}
            onChange={(e) => updateBiz({ address: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="고객센터 연락처"
            value={draftConfig.legal.businessInfo.supportContact}
            onChange={(e) => updateBiz({ supportContact: e.target.value })}
            className="min-h-[40px] px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
      </div>

      {/* Policies */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">법적 / 운영 정책 텍스트</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">개인정보처리방침</label>
            <textarea
              rows={5}
              value={draftConfig.legal.privacyPolicy}
              onChange={(e) => updateLegal({ privacyPolicy: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">이용 안내</label>
            <textarea
              rows={4}
              value={draftConfig.legal.termsOfUse}
              onChange={(e) => updateLegal({ termsOfUse: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">배송 · 환불 안내</label>
            <textarea
              rows={4}
              value={draftConfig.legal.shippingRefundPolicy}
              onChange={(e) => updateLegal({ shippingRefundPolicy: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   3. 디자인/테마 설정 (실시간 미리보기 + 기본 블랙·실버 복원)
============================================================================ */
export const ThemeSettingsTab: React.FC = () => {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges, showToast } = useAdmin();
  const t = draftConfig.theme;

  const updateTheme = (patch: Partial<SiteConfig['theme']>) => {
    setDraftConfig((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const restoreDefaultTheme = () => {
    updateTheme({ ...DEFAULT_THEME });
    showToast('기본 블랙·실버 테마(#080A0D / #C5CBD3)로 복원되었습니다.');
  };

  const colorFields: { key: keyof SiteConfig['theme']; label: string }[] = [
    { key: 'mainBg', label: '메인 배경' },
    { key: 'secondaryBg', label: '보조 배경' },
    { key: 'cardBg', label: '카드 배경' },
    { key: 'silver', label: '메탈릭 실버' },
    { key: 'primaryText', label: '주요 텍스트' },
    { key: 'secondaryText', label: '보조 텍스트' },
    { key: 'border', label: '구분선' },
    { key: 'accent', label: '포인트 컬러' },
  ];

  const previewRadius =
    t.buttonShape === 'sharp' ? '0px' : t.buttonShape === 'pill' ? '9999px' : '6px';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#303741] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">디자인 / 테마 설정</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            컬러, 폰트 크기, 버튼 곡률, 섹션 간격을 실시간 미리보기로 확인하며 조정합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={restoreDefaultTheme}
          className="min-h-[40px] px-4 py-2 text-xs font-medium bg-[#171C23] border border-[#303741] rounded-md text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-2 shrink-0"
        >
          <RotateCcw size={14} />
          <span>기본 블랙·실버로 복원</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {colorFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="block text-xs text-[#929AA6]">{f.label}</label>
                <div className="flex items-center gap-2 bg-[#080A0D] border border-[#303741] rounded px-2 py-1.5">
                  <input
                    type="color"
                    value={String(t[f.key])}
                    onChange={(e) => updateTheme({ [f.key]: e.target.value })}
                    className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={String(t[f.key])}
                    onChange={(e) => updateTheme({ [f.key]: e.target.value })}
                    className="w-full text-[11px] font-mono-tabular bg-transparent text-[#F3F4F6] focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#303741]">
            <div className="space-y-1.5">
              <label className="block text-xs text-[#929AA6]">글자 크기</label>
              <select
                value={t.fontScale}
                onChange={(e) => updateTheme({ fontScale: e.target.value as 'sm' | 'md' | 'lg' })}
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="sm">작게 (0.94x)</option>
                <option value="md">표준 (1.0x)</option>
                <option value="lg">크게 (1.06x)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-[#929AA6]">버튼 모양</label>
              <select
                value={t.buttonShape}
                onChange={(e) =>
                  updateTheme({ buttonShape: e.target.value as 'sharp' | 'rounded' | 'pill' })
                }
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="sharp">직각 (Sharp)</option>
                <option value="rounded">라운드 (Rounded)</option>
                <option value="pill">캡슐 (Pill)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-[#929AA6]">섹션 간격</label>
              <select
                value={t.sectionSpacing}
                onChange={(e) =>
                  updateTheme({ sectionSpacing: e.target.value as 'compact' | 'normal' | 'relaxed' })
                }
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="compact">컴팩트</option>
                <option value="normal">표준</option>
                <option value="relaxed">여유롭게</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Theme Preview */}
        <div
          className="lg:col-span-5 rounded-lg p-6 border flex flex-col justify-between gap-6"
          style={{
            backgroundColor: t.mainBg,
            borderColor: t.border,
            color: t.primaryText,
          }}
        >
          <div className="space-y-2">
            <p className="text-xs tracking-[0.2em]" style={{ color: t.silver }}>
              REAL-TIME PREVIEW
            </p>
            <p className="font-brand text-xl font-bold tracking-[0.18em]">NOVA</p>
            <p className="text-xs" style={{ color: t.secondaryText }}>
              선택하신 컬러와 버튼 곡률이 실제 방문자 화면에 적용되는 모습을 미리 봅니다.
            </p>
          </div>

          <div
            className="p-4 rounded border space-y-3"
            style={{ backgroundColor: t.cardBg, borderColor: t.border }}
          >
            <p className="text-sm font-semibold">리자몽 ex SAR PSA 10</p>
            <p className="text-xs" style={{ color: t.secondaryText }}>
              등급카드 · 판매중
            </p>
            <div className="flex gap-2 pt-1">
              <span
                className="px-4 py-2 text-xs font-semibold inline-block"
                style={{
                  backgroundColor: t.silver,
                  color: t.mainBg,
                  borderRadius: previewRadius,
                }}
              >
                구매 문의
              </span>
              <span
                className="px-4 py-2 text-xs font-medium inline-block"
                style={{
                  backgroundColor: t.accent,
                  color: '#F3F4F6',
                  borderRadius: previewRadius,
                }}
              >
                협찬 배지
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   4. 메인 화면 구성 (액션 카드 + 섹션 드래그&드롭 순서 변경)
============================================================================ */
export const HomeLayoutTab: React.FC = () => {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges } = useAdmin();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const actions = [...draftConfig.homeActions].sort((a, b) => a.order - b.order);
  const sections = [...draftConfig.homeSections].sort((a, b) => a.order - b.order);

  const updateActions = (next: HomeActionItem[]) => {
    const normalized = next.map((item, idx) => ({ ...item, order: idx }));
    setDraftConfig((prev) => ({ ...prev, homeActions: normalized }));
    setHasUnsavedChanges(true);
  };

  const addAction = () => {
    updateActions([
      ...actions,
      {
        id: generateSafeId('action'),
        title: '새 액션 카드',
        subtitle: '설명을 입력하세요',
        ctaLabel: '바로가기',
        url: '/shop',
        visible: true,
        order: actions.length,
      },
    ]);
  };

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const copy = [...sections];
    const [picked] = copy.splice(from, 1);
    copy.splice(to, 0, picked);
    const normalized = copy.map((s, idx) => ({ ...s, order: idx }));
    setDraftConfig((prev) => ({ ...prev, homeSections: normalized }));
    setHasUnsavedChanges(true);
  };

  const updateSectionField = (idx: number, patch: Partial<(typeof sections)[number]>) => {
    const copy = sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setDraftConfig((prev) => ({ ...prev, homeSections: copy }));
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">메인 화면 구성</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          대형 액션 카드와 홈페이지 섹션 노출, 개수, 드래그&amp;드롭 순서를 관리합니다.
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#F3F4F6]">주요 액션 카드 ({actions.length})</h2>
          <button
            type="button"
            onClick={addAction}
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>카드 추가</span>
          </button>
        </div>

        <div className="space-y-3">
          {actions.map((act, idx) => (
            <div
              key={act.id}
              className="border border-[#303741] rounded-md p-4 bg-[#11151A] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono-tabular text-[#929AA6]">#{idx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (idx === 0) return;
                      const copy = [...actions];
                      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                      updateActions(copy);
                    }}
                    className="p-1.5 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                    aria-label="위로 이동"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (idx === actions.length - 1) return;
                      const copy = [...actions];
                      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                      updateActions(copy);
                    }}
                    className="p-1.5 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                    aria-label="아래로 이동"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = actions.map((a, i) =>
                        i === idx ? { ...a, visible: !a.visible } : a
                      );
                      updateActions(copy);
                    }}
                    className="px-2.5 py-1 border border-[#303741] rounded text-xs text-[#C5CBD3]"
                  >
                    {act.visible ? '노출중' : '숨김'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActions(actions.filter((_, i) => i !== idx))}
                    className="p-1.5 border border-red-400/40 rounded text-red-200"
                    aria-label="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={act.title}
                  onChange={(e) =>
                    updateActions(
                      actions.map((a, i) => (i === idx ? { ...a, title: e.target.value } : a))
                    )
                  }
                  placeholder="제목"
                  className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="text"
                  value={act.url}
                  onChange={(e) =>
                    updateActions(
                      actions.map((a, i) => (i === idx ? { ...a, url: e.target.value } : a))
                    )
                  }
                  placeholder="URL (/shop, /sell 또는 https://...)"
                  className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="text"
                  value={act.subtitle}
                  onChange={(e) =>
                    updateActions(
                      actions.map((a, i) => (i === idx ? { ...a, subtitle: e.target.value } : a))
                    )
                  }
                  placeholder="부제목"
                  className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="text"
                  value={act.ctaLabel}
                  onChange={(e) =>
                    updateActions(
                      actions.map((a, i) => (i === idx ? { ...a, ctaLabel: e.target.value } : a))
                    )
                  }
                  placeholder="버튼 문구"
                  className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Homepage Sections Drag & Drop Ordering */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">섹션 순서 (드래그&amp;드롭) 및 노출 개수</h2>
        <div className="space-y-2">
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== idx) {
                  moveSection(dragIdx, idx);
                }
                setDragIdx(null);
              }}
              className="border border-[#303741] rounded-md p-3.5 bg-[#11151A] flex flex-wrap items-center justify-between gap-3 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-3">
                <GripVertical size={16} className="text-[#929AA6]" />
                <span className="font-mono-tabular text-xs text-[#929AA6]">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-medium text-[#F3F4F6]">{sec.label}</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-[#929AA6] flex items-center gap-1.5">
                  <span>노출수</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sec.limit}
                    onChange={(e) =>
                      updateSectionField(idx, { limit: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-14 min-h-[32px] px-2 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => moveSection(idx, idx - 1)}
                  className="p-1.5 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                  aria-label="위로"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, idx + 1)}
                  className="p-1.5 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                  aria-label="아래로"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => updateSectionField(idx, { visible: !sec.visible })}
                  className={`min-h-[32px] px-2.5 text-xs rounded border inline-flex items-center gap-1 ${
                    sec.visible
                      ? 'border-[#C5CBD3]/60 text-[#F3F4F6]'
                      : 'border-[#303741] text-[#929AA6]'
                  }`}
                >
                  {sec.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{sec.visible ? '노출' : '숨김'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   5. 링크 및 커뮤니티
============================================================================ */
export const CommunityLinksTab: React.FC = () => {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges } = useAdmin();
  const links = [...draftConfig.communityLinks].sort((a, b) => a.order - b.order);

  const updateLinks = (next: CommunityLinkItem[]) => {
    setDraftConfig((prev) => ({
      ...prev,
      communityLinks: next.map((item, i) => ({ ...item, order: i })),
    }));
    setHasUnsavedChanges(true);
  };

  const addLink = () => {
    updateLinks([
      ...links,
      {
        id: generateSafeId('comm'),
        name: '새 커뮤니티 채널',
        description: '채널 소개를 입력하세요',
        url: '',
        platform: 'other',
        visible: true,
        order: links.length,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">링크 및 커뮤니티 관리</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            실제 URL이 비어 있는 채널은 방문자 화면에 자동으로 숨겨집니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addLink}
          className="min-h-[38px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>채널 추가</span>
        </button>
      </div>

      <div className="space-y-4">
        {links.map((ch, idx) => (
          <div
            key={ch.id}
            className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono-tabular text-[#929AA6]">채널 #{idx + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateLinks(
                      links.map((item, i) =>
                        i === idx ? { ...item, visible: !item.visible } : item
                      )
                    )
                  }
                  className="px-2.5 py-1 border border-[#303741] rounded text-xs text-[#C5CBD3]"
                >
                  {ch.visible ? '노출중' : '숨김'}
                </button>
                <button
                  type="button"
                  onClick={() => updateLinks(links.filter((_, i) => i !== idx))}
                  className="p-1.5 border border-red-400/40 rounded text-red-200"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={ch.name}
                onChange={(e) =>
                  updateLinks(
                    links.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                  )
                }
                placeholder="채널 이름"
                className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <select
                value={ch.platform}
                onChange={(e) =>
                  updateLinks(
                    links.map((item, i) =>
                      i === idx
                        ? { ...item, platform: e.target.value as CommunityLinkItem['platform'] }
                        : item
                    )
                  )
                }
                className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="instagram">Instagram</option>
                <option value="discord">Discord</option>
                <option value="kakao">카카오 오픈채팅</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="other">기타</option>
              </select>
              <input
                type="url"
                value={ch.url}
                onChange={(e) =>
                  updateLinks(
                    links.map((item, i) => (i === idx ? { ...item, url: e.target.value } : item))
                  )
                }
                placeholder="https://... (비워두면 숨김)"
                className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <input
                type="text"
                value={ch.description}
                onChange={(e) =>
                  updateLinks(
                    links.map((item, i) =>
                      i === idx ? { ...item, description: e.target.value } : item
                    )
                  )
                }
                placeholder="채널 설명"
                className="sm:col-span-3 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   15. SEO 및 공유 설정
============================================================================ */
export const SeoSettingsTab: React.FC = () => {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges, showToast } = useAdmin();
  const [uploading, setUploading] = useState(false);

  const updateSeo = (patch: Partial<SiteConfig['seo']>) => {
    setDraftConfig((prev) => ({
      ...prev,
      seo: { ...prev.seo, ...patch },
    }));
    setHasUnsavedChanges(true);
  };

  const handleOgUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPublicMedia('seo', file);
      updateSeo({ ogImageUrl: url });
      showToast('OG 이미지가 업로드되었습니다.');
    } catch (err) {
      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">SEO 및 소셜 공유 설정</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          검색 엔진 메타 태그와 카카오톡·Discord·X 링크 공유 카드를 설정합니다.
        </p>
      </div>

      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs text-[#929AA6]">기본 사이트 제목 (Title)</label>
          <input
            type="text"
            value={draftConfig.seo.siteTitle}
            onChange={(e) => updateSeo({ siteTitle: e.target.value })}
            className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs text-[#929AA6]">메타 설명 (Meta Description)</label>
          <textarea
            rows={3}
            value={draftConfig.seo.metaDescription}
            onChange={(e) => updateSeo({ metaDescription: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs text-[#929AA6]">OG 공유 이미지 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={draftConfig.seo.ogImageUrl}
                onChange={(e) => updateSeo({ ogImageUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={14} />
                <span>{uploading ? '중...' : '업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleOgUpload(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>
            {draftConfig.seo.ogImageUrl && (
              <div className="w-40 aspect-[16/9] rounded border border-[#303741] overflow-hidden bg-[#080A0D]">
                <SafeImage src={draftConfig.seo.ogImageUrl} alt="OG 미리보기" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#929AA6]">Twitter / X 카드 타입</label>
            <select
              value={draftConfig.seo.twitterCard}
              onChange={(e) =>
                updateSeo({ twitterCard: e.target.value as 'summary' | 'summary_large_image' })
              }
              className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="summary_large_image">큰 이미지 카드 (summary_large_image)</option>
              <option value="summary">요약 카드 (summary)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs text-[#929AA6]">키워드 (쉼표 구분)</label>
          <input
            type="text"
            value={draftConfig.seo.keywords}
            onChange={(e) => updateSeo({ keywords: e.target.value })}
            className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
      </div>
    </div>
  );
};
