import React, { useState } from 'react';
import { Check, Lock, Plus, RotateCcw, Save, Send, Trash2, Upload, Youtube } from 'lucide-react';
import { ASSET_IMAGES, DEFAULT_ORIPA_ITEMS } from '../../lib/defaults';
import { uploadPublicMedia } from '../../lib/storage';
import { formatKRW, generateSafeId } from '../../lib/utils';
import {
  OripaFulfillmentMode,
  OripaItem,
  OripaScheduleMode,
  OripaSlotStatus,
} from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
import { useAdmin } from './AdminContext';

const SLOT_BRUSH_LABELS: { id: OripaSlotStatus; label: string; badgeClass: string }[] = [
  { id: 'available', label: '선택 가능', badgeClass: 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200' },
  { id: 'reserved', label: '예약중', badgeClass: 'border-amber-400/50 bg-amber-950/50 text-amber-200' },
  { id: 'sold', label: '판매완료', badgeClass: 'border-[#4B5563] bg-[#080A0D] text-[#6B7280]' },
  { id: 'disabled', label: '비활성', badgeClass: 'border-red-400/40 bg-red-950/40 text-red-200' },
];

export const AdminOripaTab: React.FC = () => {
  const {
    draftConfig,
    setDraftConfig,
    setHasUnsavedChanges,
    saveDraftConfig,
    publishDraftToLive,
    savingConfig,
    publishingConfig,
    showToast,
  } = useAdmin();

  const oripaItems: OripaItem[] =
    draftConfig.eventsSettings?.oripaItems !== undefined
      ? [...draftConfig.eventsSettings.oripaItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : DEFAULT_ORIPA_ITEMS;

  const [selectedId, setSelectedId] = useState<string>(oripaItems[0]?.id || '');
  const [slotBrush, setSlotBrush] = useState<OripaSlotStatus>('sold');
  const [uploadingImage, setUploadingImage] = useState(false);

  const selectedPack = oripaItems.find((o) => o.id === selectedId) || oripaItems[0] || null;

  const commitLocalItems = (nextItems: OripaItem[]) => {
    const normalized = nextItems.map((item, idx) => ({
      ...item,
      purchasingDisabled: true, // 결제 심사/법적 검토 전까지 항상 잠금 유지
      order: idx,
    }));
    const nextConfig = {
      ...draftConfig,
      eventsSettings: {
        hideEndedEventsGlobally: draftConfig.eventsSettings?.hideEndedEventsGlobally ?? false,
        sponsorMeta: draftConfig.eventsSettings?.sponsorMeta ?? {},
        oripaItems: normalized,
      },
    };
    setDraftConfig(nextConfig);
    setHasUnsavedChanges(true);
    return nextConfig;
  };

  const updateSelectedPack = (patch: Partial<OripaItem>) => {
    if (!selectedPack) return;
    commitLocalItems(
      oripaItems.map((o) => (o.id === selectedPack.id ? { ...o, ...patch, purchasingDisabled: true } : o))
    );
  };

  const handleAddPack = () => {
    const newId = generateSafeId('oripa');
    const newPack: OripaItem = {
      id: newId,
      title: 'NOVA LIVE ORIPA 신규 기획전 (출시 준비 중)',
      subtitle: '유튜브 라이브 실시간 개봉 및 미개봉 배송 선택형',
      description:
        '정식 오픈 전 오리파 상품 구성 및 번호판 미리보기입니다. 법적 검토 및 결제 연동 완료 후 실제 구매가 열립니다.',
      pricePerSlot: 30000,
      totalSlots: 30,
      imageUrl: ASSET_IMAGES.gradedSlab,
      youtubeChannelUrl: draftConfig.brand.youtubeUrl || '',
      youtubeLiveUrl: '',
      liveScheduleText: '라이브 일정 추후 공지',
      fulfillmentMode: 'live_or_ship',
      scheduleMode: 'scheduled',
      visible: true,
      purchasingDisabled: true,
      slotStatuses: {},
      policyNote:
        '※ 현재 출시 준비 중인 기능으로 실제 결제 및 주문은 비활성화되어 있습니다.',
      adminMemo: '',
      order: oripaItems.length,
    };
    commitLocalItems([...oripaItems, newPack]);
    setSelectedId(newId);
    showToast('새 오리파 기획전이 초안에 추가되었습니다.');
  };

  const handleDeletePack = (id: string) => {
    const filtered = oripaItems.filter((o) => o.id !== id);
    commitLocalItems(filtered);
    setSelectedId(filtered[0]?.id || '');
    showToast('오리파 기획전이 목록에서 제거되었습니다. 저장 또는 게시를 눌러 반영하세요.');
  };

  const handleImageUpload = async (file?: File) => {
    if (!file || !selectedPack) return;
    setUploadingImage(true);
    try {
      const url = await uploadPublicMedia('brand', file);
      updateSelectedPack({ imageUrl: url });
      showToast('오리파 대표 이미지가 업로드되었습니다.');
    } catch (err) {
      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleToggleSlot = (slotNum: number) => {
    if (!selectedPack) return;
    const key = String(slotNum);
    const nextStatuses = { ...(selectedPack.slotStatuses || {}) };
    nextStatuses[key] = slotBrush;
    updateSelectedPack({ slotStatuses: nextStatuses });
  };

  const handleResetAllSlots = () => {
    if (!selectedPack) return;
    updateSelectedPack({ slotStatuses: {} });
    showToast('모든 슬롯을 [선택 가능] 상태로 초기화했습니다.');
  };

  const handleConvertReservedToSold = () => {
    if (!selectedPack) return;
    const nextStatuses: Record<string, OripaSlotStatus> = { ...(selectedPack.slotStatuses || {}) };
    Object.keys(nextStatuses).forEach((k) => {
      if (nextStatuses[k] === 'reserved') {
        nextStatuses[k] = 'sold';
      }
    });
    updateSelectedPack({ slotStatuses: nextStatuses });
    showToast('예약중 슬롯을 모두 [판매완료]로 변경했습니다.');
  };

  const getSlotCounts = (pack: OripaItem) => {
    let available = 0;
    let reserved = 0;
    let sold = 0;
    let disabled = 0;
    for (let i = 1; i <= pack.totalSlots; i += 1) {
      const st = pack.slotStatuses?.[String(i)] || 'available';
      if (st === 'available') available += 1;
      else if (st === 'reserved') reserved += 1;
      else if (st === 'sold') sold += 1;
      else disabled += 1;
    }
    return { available, reserved, sold, disabled };
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">오리파 · 유튜브 라이브 관리 (/oripa)</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            번호판 구성, 유튜브 라이브 링크, 수령 방식 및 슬롯 상태를 관리합니다. 실제 결제는 안전 정책상 잠금 유지됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddPack}
            className="min-h-[38px] px-3.5 py-2 bg-[#171C23] border border-[#303741] hover:border-[#C5CBD3] text-[#F3F4F6] rounded text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>오리파 추가</span>
          </button>
          <button
            type="button"
            disabled={savingConfig}
            onClick={() => saveDraftConfig()}
            className="min-h-[38px] px-3.5 py-2 bg-[#171C23] border border-[#303741] hover:border-[#C5CBD3] text-[#C5CBD3] rounded text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{savingConfig ? '저장 중...' : '초안 저장'}</span>
          </button>
          <button
            type="button"
            disabled={publishingConfig}
            onClick={() => publishDraftToLive()}
            className="min-h-[38px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] hover:bg-[#F3F4F6] rounded text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send size={14} />
            <span>{publishingConfig ? '게시 중...' : '실제 사이트에 게시'}</span>
          </button>
        </div>
      </div>

      {/* Permanent Pre-launch Security Lock Banner */}
      <div className="border border-amber-400/40 bg-amber-950/30 rounded-lg p-4 flex items-start gap-3 text-xs text-amber-100">
        <Lock size={16} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-semibold text-amber-200">
            사전 준비 모드 잠금 (실제 결제 · 주문 확정 비활성화)
          </p>
          <p className="text-amber-100/80">
            법적 검토 및 PG 결제 심사 완료 전까지 공개 페이지(/oripa)의 결제 버튼은 항상 비활성화(출시 준비 중) 상태로 고정됩니다.
            현재는 번호판 레이아웃, 유튜브 링크, 상품 설명 및 슬롯 상태 시뮬레이션을 미리 관리할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Pack Switcher */}
      <div className="flex flex-wrap gap-2">
        {oripaItems.map((pack) => {
          const active = selectedPack?.id === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => setSelectedId(pack.id)}
              className={`min-h-[38px] px-3.5 py-2 rounded text-xs font-medium border flex items-center gap-2 transition-colors ${
                active
                  ? 'border-[#C5CBD3] bg-[#171C23] text-[#F3F4F6]'
                  : 'border-[#303741] bg-[#11151A] text-[#929AA6] hover:text-[#F3F4F6]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${pack.visible ? 'bg-emerald-400' : 'bg-[#6B7280]'}`} />
              <span className="truncate max-w-[220px]">{pack.title}</span>
            </button>
          );
        })}
        {oripaItems.length === 0 && (
          <div className="text-xs text-[#929AA6] py-3">
            등록된 오리파 기획전이 없습니다. 상단의 [오리파 추가] 버튼을 눌러 시작하세요.
          </div>
        )}
      </div>

      {selectedPack && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Form */}
          <div className="xl:col-span-7 border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-[#303741] pb-3">
              <h2 className="text-sm font-semibold text-[#F3F4F6]">기획전 기본 정보 &amp; 방송 설정</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#C5CBD3] flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPack.visible}
                    onChange={(e) => updateSelectedPack({ visible: e.target.checked })}
                  />
                  <span>공개 페이지 노출</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleDeletePack(selectedPack.id)}
                  className="p-1.5 border border-red-400/40 rounded text-red-200 hover:bg-red-950/30"
                  aria-label="기획전 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">기획전 제목 *</label>
                <input
                  type="text"
                  value={selectedPack.title}
                  onChange={(e) => updateSelectedPack({ title: e.target.value })}
                  className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">부제목</label>
                <input
                  type="text"
                  value={selectedPack.subtitle || ''}
                  onChange={(e) => updateSelectedPack({ subtitle: e.target.value })}
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#929AA6]">1구좌 가격 (KRW)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={selectedPack.pricePerSlot}
                  onChange={(e) =>
                    updateSelectedPack({ pricePerSlot: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full min-h-[40px] px-3 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#929AA6]">총 슬롯(번호) 수 (최대 100)</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={selectedPack.totalSlots}
                  onChange={(e) =>
                    updateSelectedPack({
                      totalSlots: Math.min(100, Math.max(5, Number(e.target.value) || 10)),
                    })
                  }
                  className="w-full min-h-[40px] px-3 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#929AA6]">진행 상태</label>
                <select
                  value={selectedPack.scheduleMode}
                  onChange={(e) =>
                    updateSelectedPack({ scheduleMode: e.target.value as OripaScheduleMode })
                  }
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  <option value="scheduled">출시 / 라이브 예정</option>
                  <option value="always">상시 진행 안내</option>
                  <option value="ended">진행 종료</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-[#929AA6]">수령 / 개봉 방식</label>
                <select
                  value={selectedPack.fulfillmentMode}
                  onChange={(e) =>
                    updateSelectedPack({ fulfillmentMode: e.target.value as OripaFulfillmentMode })
                  }
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  <option value="live_or_ship">라이브 개봉 또는 미개봉 배송 선택</option>
                  <option value="live_only">유튜브 라이브 실시간 개봉 전용</option>
                  <option value="ship_only">미개봉 실물 배송 전용</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">대표 이미지 URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedPack.imageUrl || ''}
                    onChange={(e) => updateSelectedPack({ imageUrl: e.target.value })}
                    className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                  <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                    <Upload size={13} />
                    <span>{uploadingImage ? '업로드 중...' : '업로드'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>
                {selectedPack.imageUrl && (
                  <div className="w-36 aspect-[4/3] rounded border border-[#303741] overflow-hidden bg-[#080A0D] mt-2">
                    <SafeImage
                      src={selectedPack.imageUrl}
                      alt={selectedPack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                  <Youtube size={13} />
                  <span>YouTube 채널 URL (선택)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/@..."
                  value={selectedPack.youtubeChannelUrl || ''}
                  onChange={(e) => updateSelectedPack({ youtubeChannelUrl: e.target.value })}
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-[#929AA6]">
                  <Youtube size={13} />
                  <span>YouTube 라이브 / 다시보기 URL (선택)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={selectedPack.youtubeLiveUrl || ''}
                  onChange={(e) => updateSelectedPack({ youtubeLiveUrl: e.target.value })}
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">라이브 일정 안내 문구</label>
                <input
                  type="text"
                  placeholder="예: 매주 금요일 21:00 KST 유튜브 라이브 진행 예정"
                  value={selectedPack.liveScheduleText || ''}
                  onChange={(e) => updateSelectedPack({ liveScheduleText: e.target.value })}
                  className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">상세 설명</label>
                <textarea
                  rows={3}
                  value={selectedPack.description || ''}
                  onChange={(e) => updateSelectedPack({ description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">고지 및 정책 안내문</label>
                <textarea
                  rows={2}
                  value={selectedPack.policyNote || ''}
                  onChange={(e) => updateSelectedPack({ policyNote: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs text-[#929AA6]">관리자 내부 메모 (비공개)</label>
                <input
                  type="text"
                  value={selectedPack.adminMemo || ''}
                  onChange={(e) => updateSelectedPack({ adminMemo: e.target.value })}
                  className="w-full min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#929AA6]"
                />
              </div>
            </div>
          </div>

          {/* Right Slot Status Grid Editor */}
          <div className="xl:col-span-5 border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-5">
            {(() => {
              const counts = getSlotCounts(selectedPack);
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#303741] pb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F3F4F6]">
                        번호판 슬롯 상태 편집 ({selectedPack.totalSlots}칸)
                      </h2>
                      <p className="text-[11px] text-[#929AA6] mt-0.5">
                        1구좌 {formatKRW(selectedPack.pricePerSlot)} · 잔여 {counts.available} · 예약 {counts.reserved} · 완료 {counts.sold}
                      </p>
                    </div>
                  </div>

                  {/* Brush Palette */}
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#929AA6]">클릭 시 적용할 상태 선택 (브러시):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SLOT_BRUSH_LABELS.map((b) => {
                        const active = slotBrush === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSlotBrush(b.id)}
                            className={`min-h-[34px] px-2.5 py-1.5 rounded text-xs font-medium border flex items-center justify-center gap-1 transition-all ${
                              active
                                ? `${b.badgeClass} ring-1 ring-[#F3F4F6]`
                                : 'border-[#303741] bg-[#080A0D] text-[#929AA6]'
                            }`}
                          >
                            {active && <Check size={12} />}
                            <span>{b.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Batch Helpers */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleResetAllSlots}
                      className="min-h-[32px] px-3 py-1 rounded border border-[#303741] bg-[#11151A] text-[11px] text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      <span>전체 선택 가능으로 초기화</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConvertReservedToSold}
                      className="min-h-[32px] px-3 py-1 rounded border border-[#303741] bg-[#11151A] text-[11px] text-[#C5CBD3] hover:border-[#C5CBD3]"
                    >
                      예약중 → 판매완료 일괄 전환
                    </button>
                  </div>

                  {/* Interactive Grid */}
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {Array.from({ length: selectedPack.totalSlots }, (_, idx) => idx + 1).map((num) => {
                      const status = selectedPack.slotStatuses?.[String(num)] || 'available';
                      const cls =
                        status === 'available'
                          ? 'border-emerald-400/50 bg-emerald-950/40 text-emerald-200 hover:border-emerald-300'
                          : status === 'reserved'
                            ? 'border-amber-400/50 bg-amber-950/40 text-amber-200'
                            : status === 'disabled'
                              ? 'border-red-400/40 bg-red-950/30 text-red-300/60 line-through'
                              : 'border-[#303741] bg-[#080A0D] text-[#6B7280] line-through';

                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleToggleSlot(num)}
                          className={`h-10 rounded border font-mono-tabular text-xs font-medium transition-colors ${cls}`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
