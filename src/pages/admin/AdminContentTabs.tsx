import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  ImagePlus,
  Pause,
  Pin,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { db, explainFirestoreError, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  uploadDropImageWithFallback,
  uploadPostImageWithFallback,
  uploadPublicMedia,
} from '../../lib/storage';
import { buildArticleSegments, sanitizeGalleryImages } from '../../lib/newsImages';
import {
  formatKRW,
  formatKST,
  fromKSTDatetimeLocalInput,
  generateSafeId,
  getEventStatus,
  sanitizeSlug,
  toDateSafe,
  toKSTDatetimeLocalInput,
} from '../../lib/utils';
import {
  BuybackRequest,
  BuybackStatus,
  EventItem,
  FaqItem,
  NewsTcgCategory,
  Notice,
  Post,
  Product,
  ProductCategory,
  ProductStatus,
  Review,
  Sponsor,
  SponsorExtendedMeta,
  SponsorPlacement,
  VisibilityState,
} from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
import { NewsGalleryEditor } from '../../components/admin/NewsGalleryEditor';
import { useAdmin } from './AdminContext';

/* ============================================================================
   6. 상품 관리 (추가/수정/복제/삭제/드래그 정렬/이미지 업로드)
============================================================================ */
export const ProductsTab: React.FC = () => {
  const { products, showToast } = useAdmin();
  const activeProducts = products.filter((p) => p.visibilityState !== 'trashed');

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing({
      id: '',
      title: '',
      category: '등급카드',
      price: 0,
      currency: 'KRW',
      status: '판매중',
      language: '한국어',
      grade: '',
      setCode: '',
      description: '',
      images: [],
      dmPrompt: '',
      order: activeProducts.length,
      isFeatured: true,
      isSample: false,
      visibilityState: 'published',
    });
  };

  const handleUploadImage = async (file?: File) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await uploadPublicMedia('products', file);
      setEditing((prev) => (prev ? { ...prev, images: [...(prev.images || []), url] } : prev));
      showToast('상품 이미지가 업로드되었습니다.');
    } catch (err) {
      showToast(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title?.trim()) return;
    setSaving(true);
    const id = editing.id || generateSafeId('prod');
    const isNew = !editing.id;
    try {
      const payload = {
        title: editing.title.trim().slice(0, 140),
        category: (editing.category || '기타') as ProductCategory,
        price: Math.max(0, Number(editing.price) || 0),
        currency: 'KRW' as const,
        status: (editing.status || '판매중') as ProductStatus,
        language: (editing.language || '').trim().slice(0, 40),
        grade: (editing.grade || '').trim().slice(0, 60),
        setCode: (editing.setCode || '').trim().slice(0, 60),
        description: (editing.description || '').trim().slice(0, 4000),
        images: (editing.images || []).slice(0, 8),
        dmPrompt: (editing.dmPrompt || '').trim().slice(0, 300),
        order: Number(editing.order ?? activeProducts.length),
        isFeatured: Boolean(editing.isFeatured),
        isSample: Boolean(editing.isSample),
        visibilityState: (editing.visibilityState || 'published') as VisibilityState,
        updatedAt: serverTimestamp(),
      };

      if (isNew) {
        await setDoc(doc(db, 'products', id), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'products', id), payload);
      }
      setEditing(null);
      showToast('상품이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (p: Product) => {
    const newId = generateSafeId('prod');
    try {
      await setDoc(doc(db, 'products', newId), {
        title: `${p.title} (복사본)`.slice(0, 140),
        category: p.category,
        price: p.price,
        currency: 'KRW',
        status: p.status,
        language: p.language || '',
        grade: p.grade || '',
        setCode: p.setCode || '',
        description: p.description || '',
        images: p.images || [],
        dmPrompt: p.dmPrompt || '',
        order: activeProducts.length,
        isFeatured: Boolean(p.isFeatured),
        isSample: Boolean(p.isSample),
        visibilityState: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('상품이 초안으로 복제되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `products/${newId}`);
    }
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'products', id), {
        visibilityState: 'trashed',
        updatedAt: serverTimestamp(),
      });
      showToast('상품이 휴지통으로 이동되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
    }
  };

  const reorderProducts = async (from: number, to: number) => {
    if (to < 0 || to >= activeProducts.length) return;
    const copy = [...activeProducts];
    const [picked] = copy.splice(from, 1);
    copy.splice(to, 0, picked);
    try {
      const batch = writeBatch(db);
      copy.forEach((item, idx) => {
        batch.update(doc(db, 'products', item.id), {
          order: idx,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showToast('상품 순서가 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'products/reorder');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">상품 관리 ({activeProducts.length})</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            드래그&amp;드롭으로 카탈로그 노출 순서를 조정하고 상품을 추가·복제·관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>상품 추가</span>
        </button>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              {editing.id ? '상품 수정' : '새 상품 등록'}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-[#929AA6] hover:text-[#F3F4F6]"
            >
              닫기
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="상품명 *"
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <select
              value={editing.category || '등급카드'}
              onChange={(e) => setEditing({ ...editing, category: e.target.value as ProductCategory })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="싱글카드">싱글카드</option>
              <option value="등급카드">등급카드</option>
              <option value="미개봉 박스">미개봉 박스</option>
              <option value="팩">팩</option>
              <option value="기타">기타</option>
            </select>
            <input
              type="number"
              min={0}
              required
              placeholder="가격 (KRW) *"
              value={editing.price ?? 0}
              onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              className="min-h-[40px] px-3 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <select
              value={editing.status || '판매중'}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductStatus })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="판매중">판매중</option>
              <option value="예약중">예약중</option>
              <option value="판매완료">판매완료</option>
            </select>
            <select
              value={editing.visibilityState || 'published'}
              onChange={(e) =>
                setEditing({ ...editing, visibilityState: e.target.value as VisibilityState })
              }
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="published">공개 (Published)</option>
              <option value="draft">임시저장 (Draft)</option>
            </select>
            <input
              type="text"
              placeholder="언어 (예: 한국어, 일본어)"
              value={editing.language || ''}
              onChange={(e) => setEditing({ ...editing, language: e.target.value })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="등급 / 상태 (예: PSA 10, 슈링크 밀봉)"
              value={editing.grade || ''}
              onChange={(e) => setEditing({ ...editing, grade: e.target.value })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="세트 코드 (예: SV3 134/108)"
              value={editing.setCode || ''}
              onChange={(e) => setEditing({ ...editing, setCode: e.target.value })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <textarea
              rows={3}
              placeholder="상세 설명"
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="Instagram DM 기본 문의 문구 (선택)"
              value={editing.dmPrompt || ''}
              onChange={(e) => setEditing({ ...editing, dmPrompt: e.target.value })}
              className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <label className="flex items-center gap-2 text-xs text-[#C5CBD3] cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editing.isSample)}
                onChange={(e) => setEditing({ ...editing, isSample: e.target.checked })}
              />
              <span>SAMPLE 배지 표시</span>
            </label>
          </div>

          {/* Images */}
          <div className="space-y-3 pt-2 border-t border-[#303741]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#929AA6]">상품 이미지 ({editing.images?.length || 0}/8)</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="이미지 URL 붙여넣기"
                    className="min-h-[34px] px-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] w-44"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = imageUrlInput.trim();
                      if (!clean) return;
                      if ((editing.images?.length || 0) >= 8) {
                        showToast('이미지는 최대 8장까지 등록할 수 있습니다.');
                        return;
                      }
                      setEditing({ ...editing, images: [...(editing.images || []), clean] });
                      setImageUrlInput('');
                    }}
                    className="min-h-[34px] px-2.5 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] hover:border-[#C5CBD3]"
                  >
                    URL 추가
                  </button>
                </div>
                <label className="min-h-[34px] px-3 py-1 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3]">
                  <Upload size={13} />
                  <span>{uploading ? '업로드 중...' : '파일 업로드'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUploadImage(e.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editing.images || []).map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded border border-[#303741] overflow-hidden">
                  <SafeImage src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        images: (editing.images || []).filter((_, idx) => idx !== i),
                      })
                    }
                    className="absolute top-1 right-1 w-6 h-6 bg-[#080A0D]/80 text-[#F3F4F6] rounded flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-[40px] px-4 text-xs border border-[#303741] rounded text-[#929AA6]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold"
            >
              {saving ? '저장 중...' : '상품 저장'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {activeProducts.map((p, idx) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== idx) reorderProducts(dragIdx, idx);
              setDragIdx(null);
            }}
            className="border border-[#303741] rounded-lg p-3.5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-grab"
          >
            <div className="flex items-center gap-3 min-w-0">
              <GripVertical size={16} className="text-[#929AA6] shrink-0" />
              <div className="w-14 h-12 rounded overflow-hidden border border-[#303741] shrink-0">
                <SafeImage src={p.images?.[0]} alt={p.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                  <span>{p.category}</span>
                  <span>·</span>
                  <span>{p.status}</span>
                  <span>·</span>
                  <span>{p.visibilityState === 'published' ? '공개' : '초안'}</span>
                  {p.isSample && <span className="font-mono-tabular text-[#C5CBD3]">· SAMPLE</span>}
                </div>
                <p className="text-sm font-medium text-[#F3F4F6] truncate">{p.title}</p>
                <p className="text-xs font-mono-tabular text-[#C5CBD3]">{formatKRW(p.price)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => reorderProducts(idx, idx - 1)}
                className="p-2 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                aria-label="위로"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => reorderProducts(idx, idx + 1)}
                className="p-2 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
                aria-label="아래로"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6] hover:border-[#C5CBD3]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => handleDuplicate(p)}
                className="p-2 border border-[#303741] rounded text-[#C5CBD3] hover:border-[#C5CBD3]"
                aria-label="복제"
              >
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleSoftDelete(p.id)}
                className="p-2 border border-red-400/40 rounded text-red-200"
                aria-label="휴지통으로 이동"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   7. 매입 신청 관리 (비공개 열람 + 상태/제안가/메모 저장)
============================================================================ */
export const BuybacksTab: React.FC = () => {
  const { buybacks, showToast } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<'전체' | BuybackStatus>('전체');
  const [selected, setSelected] = useState<BuybackRequest | null>(null);
  const [editStatus, setEditStatus] = useState<BuybackStatus>('신규');
  const [offerPrice, setOfferPrice] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const sorted = [...buybacks]
    .filter((b) => statusFilter === '전체' || b.status === statusFilter)
    .sort((a, b) => {
      const ta = toDateSafe(a.createdAt)?.getTime() ?? 0;
      const tb = toDateSafe(b.createdAt)?.getTime() ?? 0;
      return tb - ta;
    });

  const openDetail = (req: BuybackRequest) => {
    setSelected(req);
    setEditStatus(req.status);
    setOfferPrice(req.offerPrice || '');
    setAdminMemo(req.adminMemo || '');
  };

  const handleSaveBuyback = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'buyback_requests', selected.id), {
        status: editStatus,
        offerPrice: offerPrice.trim().slice(0, 80),
        adminMemo: adminMemo.trim().slice(0, 2000),
        updatedAt: serverTimestamp(),
      });
      setSelected({
        ...selected,
        status: editStatus,
        offerPrice,
        adminMemo,
      });
      showToast('매입 검토 상태와 제안 금액이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `buyback_requests/${selected.id}`);
    } finally {
      setSaving(false);
    }
  };

  const statuses: ('전체' | BuybackStatus)[] = [
    '전체',
    '신규',
    '검토 중',
    '가격 제안',
    '협의 완료',
    '거래 완료',
    '거절',
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">매입 신청 관리 (비공개 열람)</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          방문자가 제출한 사진과 연락처는 관리자 인증 후 이 화면에서만 열람할 수 있습니다.
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {statuses.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`min-h-[36px] px-3 py-1 text-xs rounded border whitespace-nowrap shrink-0 ${
              statusFilter === st
                ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3] font-semibold'
                : 'bg-[#11151A] text-[#929AA6] border-[#303741]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-2.5">
          {sorted.length === 0 ? (
            <div className="border border-[#303741] rounded-lg p-10 text-center text-xs text-[#929AA6] bg-[#11151A]">
              접수된 매입 신청 내역이 없습니다.
            </div>
          ) : (
            sorted.map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => openDetail(req)}
                className={`w-full text-left border rounded-lg p-4 bg-[#171C23] space-y-1.5 transition-colors ${
                  selected?.id === req.id ? 'border-[#C5CBD3]' : 'border-[#303741] hover:border-[#929AA6]'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-[#929AA6]">
                  <span className="font-medium text-[#C5CBD3]">{req.status}</span>
                  <span className="font-mono-tabular">{formatKST(req.createdAt)}</span>
                </div>
                <p className="text-sm font-semibold text-[#F3F4F6]">{req.cardName}</p>
                <p className="text-xs text-[#929AA6]">
                  {req.language} · {req.condition} · 수량 {req.quantity} · 사진 {req.photoUrls?.length || 0}장
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-6">
          {selected ? (
            <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-5 sticky top-20">
              <div className="space-y-1 border-b border-[#303741] pb-4">
                <p className="font-mono-tabular text-xs text-[#929AA6]">{selected.id}</p>
                <h2 className="text-lg font-semibold text-[#F3F4F6]">{selected.cardName}</h2>
                <p className="text-xs text-[#929AA6]">
                  {selected.language} · {selected.condition} · 수량 {selected.quantity}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#929AA6]">희망 매입가</span>
                  <span className="text-[#F3F4F6]">{selected.desiredPrice || '미기재'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#929AA6]">연락처</span>
                  <span className="text-[#C5CBD3]">{selected.contact || '미기재'}</span>
                </div>
                {selected.notes && (
                  <div className="pt-2 border-t border-[#303741]/60">
                    <p className="text-[#929AA6] mb-1">신청자 메모</p>
                    <p className="text-[#F3F4F6] whitespace-pre-line">{selected.notes}</p>
                  </div>
                )}
              </div>

              {selected.photoUrls?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[#929AA6]">첨부 사진</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {selected.photoUrls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded border border-[#303741] overflow-hidden bg-[#080A0D]"
                      >
                        <SafeImage src={url} alt={`첨부 ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-[#303741] pt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#929AA6]">진행 상태</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as BuybackStatus)}
                      className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                    >
                      {statuses
                        .filter((s) => s !== '전체')
                        .map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#929AA6]">제안 금액</label>
                    <input
                      type="text"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="예: 320,000원"
                      className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-[#929AA6]">관리자 내부 메모</label>
                  <textarea
                    rows={3}
                    value={adminMemo}
                    onChange={(e) => setAdminMemo(e.target.value)}
                    placeholder="감정 확인, 연락 기록 등"
                    className="w-full px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveBuyback}
                  className="w-full min-h-[42px] bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold hover:bg-[#F3F4F6]"
                >
                  {saving ? '저장 중...' : '매입 상태 및 메모 저장'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[#303741] rounded-lg p-12 text-center text-xs text-[#929AA6] bg-[#11151A]">
              왼쪽 목록에서 매입 신청 건을 선택해 상세 사진과 연락처를 확인하세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   8. 게시글/뉴스 관리 (마크다운 + 이미지 삽입 + 미리보기 + 예약 + SEO)
============================================================================ */
export const PostsTab: React.FC = () => {
  const { user, posts, showToast } = useAdmin();
  const activePosts = posts.filter((p) => p.visibilityState !== 'trashed');

  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const openEditor = (p?: Post) => {
    if (p) {
      setEditing({
        ...p,
        galleryImages: sanitizeGalleryImages(p.galleryImages),
      });
      setScheduledLocal(toKSTDatetimeLocalInput(p.scheduledAt));
    } else {
      setEditing({
        id: '',
        title: '',
        slug: '',
        category: 'TCG 뉴스',
        tcgCategory: '',
        sourceName: '',
        sourceUrl: '',
        publishedAtSource: '',
        inboxItemId: '',
        summary: '',
        content: '',
        coverImage: '',
        galleryImages: [],
        isPinned: false,
        isSample: false,
        seoTitle: '',
        seoDescription: '',
        visibilityState: 'draft',
      });
      setScheduledLocal('');
    }
    setPreviewMode(false);
  };

  const insertMarkerIntoContent = (marker: string, afterParagraphIndex?: number) => {
    const el = contentTextareaRef.current;
    const cursorStart = el && !previewMode ? el.selectionStart : undefined;
    const cursorEnd = el && !previewMode ? el.selectionEnd : undefined;

    setEditing((prev) => {
      if (!prev) return prev;
      const currentText = prev.content || '';
      if (typeof afterParagraphIndex === 'number') {
        const blocks = currentText.split(/\n{2,}/);
        if (blocks.length === 0 || (blocks.length === 1 && !blocks[0].trim())) {
          return { ...prev, content: `${marker}\n` };
        }
        const idx = Math.max(0, Math.min(afterParagraphIndex, blocks.length - 1));
        const nextBlocks = [...blocks.slice(0, idx + 1), marker, ...blocks.slice(idx + 1)];
        return { ...prev, content: nextBlocks.join('\n\n').slice(0, 30000) };
      }

      if (cursorStart === undefined || cursorEnd === undefined) {
        return {
          ...prev,
          content: currentText ? `${currentText}\n\n${marker}\n` : `${marker}\n`,
        };
      }

      const prefix = currentText.slice(0, cursorStart);
      const suffix = currentText.slice(cursorEnd);
      const insertBlock = `${prefix && !prefix.endsWith('\n') ? '\n\n' : ''}${marker}${
        suffix && !suffix.startsWith('\n') ? '\n\n' : '\n'
      }`;
      return {
        ...prev,
        content: `${prefix}${insertBlock}${suffix}`.slice(0, 30000),
      };
    });
    showToast(
      typeof afterParagraphIndex === 'number'
        ? `${afterParagraphIndex + 1}번째 문단 아래에 이미지가 삽입되었습니다.`
        : '본문에 이미지가 삽입되었습니다.'
    );
  };

  const handleUploadCover = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadPostImageWithFallback(file);
      setEditing((prev) => (prev ? { ...prev, coverImage: res.url } : prev));
      showToast(
        res.mode === 'storage'
          ? '대표 이미지가 업로드되었습니다.'
          : '대표 이미지가 최적화되어 등록되었습니다.'
      );
    } catch (err) {
      showToast(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleInsertInlineImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadPostImageWithFallback(file);
      insertMarkerIntoContent(`![이미지 설명](${res.url})`);
    } catch (err) {
      showToast(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title?.trim() || !editing.content?.trim()) return;
    setSaving(true);
    const id = editing.id || generateSafeId('post');
    const isNew = !editing.id;
    const schedDate = fromKSTDatetimeLocalInput(scheduledLocal);
    try {
      const payload = {
        title: editing.title.trim().slice(0, 160),
        slug: sanitizeSlug(editing.slug || editing.title).slice(0, 128),
        category: (editing.category || 'TCG 뉴스').trim().slice(0, 50),
        tcgCategory: (editing.tcgCategory || '').trim().slice(0, 40),
        sourceName: (editing.sourceName || '').trim().slice(0, 100),
        sourceUrl: (editing.sourceUrl || '').trim().slice(0, 500),
        publishedAtSource: (editing.publishedAtSource || '').trim().slice(0, 80),
        inboxItemId: (editing.inboxItemId || '').trim().slice(0, 128),
        summary: (editing.summary || '').trim().slice(0, 400),
        content: editing.content.slice(0, 30000),
        coverImage: (editing.coverImage || '').trim().slice(0, 200000),
        galleryImages: sanitizeGalleryImages(editing.galleryImages),
        isPinned: Boolean(editing.isPinned),
        isSample: Boolean(editing.isSample),
        scheduledAt: schedDate ? Timestamp.fromDate(schedDate) : null,
        seoTitle: (editing.seoTitle || '').trim().slice(0, 120),
        seoDescription: (editing.seoDescription || '').trim().slice(0, 300),
        visibilityState: (editing.visibilityState || 'draft') as VisibilityState,
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        await setDoc(doc(db, 'posts', id), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'posts', id), payload);
      }
      setEditing(null);
      showToast('게시글이 저장되었습니다.');
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`게시글 저장 실패 · ${explained.title}: ${explained.detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">게시글 / 뉴스 관리 ({activePosts.length})</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            마크다운 에디터, 본문 이미지 삽입, 예약 게시(KST), 대표 고정 및 SEO 메타데이터를 지원합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>새 게시글</span>
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              {editing.id ? '게시글 수정' : '새 게시글 작성'}
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewMode((v) => !v)}
                className="px-3 py-1 text-xs border border-[#303741] rounded text-[#C5CBD3] inline-flex items-center gap-1.5"
              >
                <Eye size={13} />
                <span>{previewMode ? '에디터 보기' : '마크다운 미리보기'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs text-[#929AA6] hover:text-[#F3F4F6]"
              >
                닫기
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="제목 *"
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="슬러그 (영문/숫자/-)"
              value={editing.slug || ''}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="min-h-[40px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="카테고리 (예: 정가 구매·추첨, TCG 뉴스)"
                value={editing.category || ''}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <div className="flex flex-wrap gap-1.5">
                {['정가 구매·추첨', 'TCG 뉴스', '컬렉팅 가이드'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditing({ ...editing, category: preset })}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      editing.category === preset
                        ? 'border-[#C5CBD3] bg-[#C5CBD3]/15 text-[#F3F4F6]'
                        : 'border-[#303741] bg-[#11151A] text-[#929AA6] hover:text-[#F3F4F6]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <select
              value={editing.visibilityState || 'draft'}
              onChange={(e) =>
                setEditing({ ...editing, visibilityState: e.target.value as VisibilityState })
              }
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="published">공개 (또는 예약시각 후 공개)</option>
              <option value="draft">임시저장</option>
            </select>
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)}
              title="예약 게시 시각 (KST)"
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="요약 문구"
              value={editing.summary || ''}
              onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
              className="sm:col-span-2 lg:col-span-3 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <select
              value={editing.tcgCategory || ''}
              onChange={(e) =>
                setEditing({ ...editing, tcgCategory: e.target.value as NewsTcgCategory | '' })
              }
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="">TCG 분류 (선택)</option>
              <option value="포켓몬 TCG">포켓몬 TCG</option>
              <option value="원피스 TCG">원피스 TCG</option>
              <option value="기타 TCG">기타 TCG</option>
            </select>
            <input
              type="text"
              placeholder="원문 출처 이름 (예: PokeBeach)"
              value={editing.sourceName || ''}
              onChange={(e) => setEditing({ ...editing, sourceName: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="url"
              placeholder="원문 URL (https://...)"
              value={editing.sourceUrl || ''}
              onChange={(e) => setEditing({ ...editing, sourceUrl: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div className="sm:col-span-2 flex gap-2">
              <input
                type="text"
                placeholder="대표 이미지 URL"
                value={editing.coverImage || ''}
                onChange={(e) => setEditing({ ...editing, coverImage: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] flex items-center gap-1.5 cursor-pointer shrink-0">
                <Upload size={13} />
                <span>{uploading ? '중...' : '커버 업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = '';
                    handleUploadCover(f);
                  }}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#C5CBD3]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isPinned)}
                  onChange={(e) => setEditing({ ...editing, isPinned: e.target.checked })}
                />
                <span>대표 고정</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isSample)}
                  onChange={(e) => setEditing({ ...editing, isSample: e.target.checked })}
                />
                <span>SAMPLE</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#929AA6]">본문 (Markdown)</span>
              <label className="px-3 py-1 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer">
                <ImagePlus size={13} />
                <span>본문 이미지 삽입</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = '';
                    handleInsertInlineImage(f);
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {previewMode ? (
              <div className="min-h-[240px] p-5 border border-[#303741] rounded bg-[#080A0D] text-sm text-[#F3F4F6] space-y-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                {buildArticleSegments(editing.content || '', editing.galleryImages || []).map(
                  (seg, segIdx) => {
                    if (seg.type === 'markdown') {
                      return <ReactMarkdown key={segIdx}>{seg.text}</ReactMarkdown>;
                    }
                    if (seg.type === 'image') {
                      return (
                        <figure
                          key={`${seg.image.id}-${segIdx}`}
                          className="rounded-lg border border-[#303741] bg-[#11151A] overflow-hidden"
                        >
                          <div className="p-2 flex justify-center bg-[#080A0D]">
                            <SafeImage
                              src={seg.image.url}
                              alt={seg.image.caption || `이미지 ${seg.orderIndex + 1}`}
                              className="max-w-full max-h-[360px] w-auto h-auto object-contain rounded"
                            />
                          </div>
                          {(seg.image.caption || seg.image.source || seg.image.rights) && (
                            <figcaption className="px-3 py-2 text-xs text-[#929AA6] border-t border-[#303741]/60 space-y-0.5">
                              {seg.image.caption && (
                                <p className="text-[#F3F4F6]">{seg.image.caption}</p>
                              )}
                              <p className="text-[11px]">
                                {[
                                  seg.image.source ? `출처: ${seg.image.source}` : '',
                                  seg.image.rights ? `권한: ${seg.image.rights}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </figcaption>
                          )}
                        </figure>
                      );
                    }
                    return (
                      <div key={`grp-${segIdx}`} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {seg.images.map(({ image, orderIndex }) => (
                          <figure
                            key={image.id}
                            className="rounded-lg border border-[#303741] bg-[#11151A] overflow-hidden"
                          >
                            <div className="p-2 flex justify-center bg-[#080A0D]">
                              <SafeImage
                                src={image.url}
                                alt={image.caption || `이미지 ${orderIndex + 1}`}
                                className="max-w-full max-h-[260px] w-auto h-auto object-contain rounded"
                              />
                            </div>
                            {(image.caption || image.source || image.rights) && (
                              <figcaption className="px-3 py-2 text-[11px] text-[#929AA6] border-t border-[#303741]/60">
                                {image.caption && (
                                  <p className="text-xs text-[#F3F4F6]">{image.caption}</p>
                                )}
                                {[
                                  image.source ? `출처: ${image.source}` : '',
                                  image.rights ? `권한: ${image.rights}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </figcaption>
                            )}
                          </figure>
                        ))}
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <textarea
                ref={contentTextareaRef}
                required
                rows={10}
                value={editing.content || ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                placeholder="## 소제목&#10;본문 내용을 마크다운으로 작성하세요. 아래 추가 이미지에서 [본문 커서 위치에 삽입]을 누르면 원하는 문단 사이에 사진이 배치됩니다."
                className="w-full px-3 py-2.5 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
            )}
          </div>

          <NewsGalleryEditor
            images={editing.galleryImages || []}
            onFunctionalChange={(updater) =>
              setEditing((prev) =>
                prev ? { ...prev, galleryImages: updater(prev.galleryImages || []) } : prev
              )
            }
            articleText={editing.content || ''}
            onInsertMarker={(marker) => insertMarkerIntoContent(marker)}
            onInsertAtParagraph={(marker, idx) => insertMarkerIntoContent(marker, idx)}
            defaultSource={editing.sourceName || ''}
            onNotify={showToast}
            getIdToken={user ? () => user.getIdToken() : undefined}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#303741]">
            <input
              type="text"
              placeholder="SEO 제목 (선택)"
              value={editing.seoTitle || ''}
              onChange={(e) => setEditing({ ...editing, seoTitle: e.target.value })}
              className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="SEO 설명 (선택)"
              value={editing.seoDescription || ''}
              onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
              className="min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold"
            >
              {saving ? '저장 중...' : '게시글 저장'}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
        {activePosts.map((p) => (
          <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                {p.isPinned && <Pin size={12} className="text-[#8068BA]" />}
                <span>{p.category}</span>
                <span>·</span>
                <span>{p.visibilityState === 'published' ? '공개' : '임시저장'}</span>
                {Boolean(p.scheduledAt) && <span>· 예약: {formatKST(p.scheduledAt)}</span>}
                {(p.galleryImages?.length ?? 0) > 0 && (
                  <span className="font-mono-tabular text-[#C5CBD3]">
                    · 추가 이미지 {p.galleryImages?.length}장
                  </span>
                )}
                {p.isSample && <span className="font-mono-tabular text-[#C5CBD3]">· SAMPLE</span>}
              </div>
              <p className="text-sm font-medium text-[#F3F4F6] truncate">{p.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEditor(p)}
                className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'posts', p.id), {
                    visibilityState: 'trashed',
                    updatedAt: serverTimestamp(),
                  })
                }
                className="p-2 border border-red-400/40 rounded text-red-200"
                aria-label="삭제"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   9. 공지사항 관리
============================================================================ */
export const NoticesTab: React.FC = () => {
  const { notices, showToast } = useAdmin();
  const activeNotices = notices.filter((n) => n.visibilityState !== 'trashed');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [vis, setVis] = useState<VisibilityState>('published');
  const [sched, setSched] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const id = editId || generateSafeId('notice');
    const schedDate = fromKSTDatetimeLocalInput(sched);
    try {
      const payload = {
        title: title.trim().slice(0, 160),
        content: content.trim().slice(0, 4000),
        isPinned,
        isSample,
        scheduledAt: schedDate ? Timestamp.fromDate(schedDate) : null,
        visibilityState: vis,
        updatedAt: serverTimestamp(),
      };
      if (editId) {
        await updateDoc(doc(db, 'notices', id), payload);
      } else {
        await setDoc(doc(db, 'notices', id), { ...payload, createdAt: serverTimestamp() });
      }
      setEditId(null);
      setTitle('');
      setContent('');
      setIsPinned(false);
      setIsSample(false);
      setSched('');
      showToast('공지사항이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notices/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">공지사항 관리</h1>
      </div>

      <form onSubmit={handleSave} className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-3">
        <input
          type="text"
          required
          placeholder="공지 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
        />
        <textarea
          required
          rows={3}
          placeholder="공지 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
        />
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#C5CBD3]">
          <select
            value={vis}
            onChange={(e) => setVis(e.target.value as VisibilityState)}
            className="min-h-[36px] px-3 bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          >
            <option value="published">공개</option>
            <option value="draft">임시저장</option>
          </select>
          <input
            type="datetime-local"
            value={sched}
            onChange={(e) => setSched(e.target.value)}
            className="min-h-[36px] px-3 bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
            <span>상단 고정</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} />
            <span>SAMPLE</span>
          </label>
          <button
            type="submit"
            className="ml-auto min-h-[38px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded font-semibold"
          >
            {editId ? '수정 저장' : '공지 등록'}
          </button>
        </div>
      </form>

      <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
        {activeNotices.map((n) => (
          <div key={n.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[#929AA6]">
                {n.isPinned ? '고정 · ' : ''}
                {n.visibilityState === 'published' ? '공개' : '초안'}
                {n.isSample ? ' · SAMPLE' : ''}
              </p>
              <p className="text-sm font-medium text-[#F3F4F6] truncate">{n.title}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditId(n.id);
                  setTitle(n.title);
                  setContent(n.content);
                  setIsPinned(n.isPinned);
                  setIsSample(n.isSample);
                  setVis(n.visibilityState);
                  setSched(toKSTDatetimeLocalInput(n.scheduledAt));
                }}
                className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'notices', n.id), {
                    visibilityState: 'trashed',
                    updatedAt: serverTimestamp(),
                  })
                }
                className="p-2 border border-red-400/40 rounded text-red-200"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   10. 배너 및 협찬 관리 (REPACK 포함, 위치/기간/우선순위/클릭수/캠페인 메타)
============================================================================ */
const PLACEMENT_ORDER: SponsorPlacement[] = [
  'home_banner',
  'news_inline',
  'drops_banner',
  'home_partners',
  'shop_banner',
];

const PLACEMENT_LABELS: Record<Sponsor['placement'], string> = {
  home_banner: '메인 스폰서 배너 (홈 상단)',
  news_inline: '뉴스 · 추첨 내 인라인 광고',
  home_partners: '공식 파트너 로고 그리드 (홈 중단)',
  shop_banner: '스토어 상단 배너 (/shop)',
  drops_banner: '정가·추첨 페이지 배너 (/drops)',
};

type SponsorFilterStatus = 'all' | 'active' | 'paused' | 'scheduled' | 'ended' | 'draft';

function getSponsorRuntimeStatus(
  s: Sponsor,
  meta?: SponsorExtendedMeta
): Exclude<SponsorFilterStatus, 'all'> {
  if (s.visibilityState !== 'published') return 'draft';
  if (meta?.isPaused) return 'paused';
  const now = Date.now();
  const start = toDateSafe(s.startAt)?.getTime();
  const end = toDateSafe(s.endAt)?.getTime();
  if (start && now < start) return 'scheduled';
  if (end && now > end) return 'ended';
  return 'active';
}

export const SponsorsTab: React.FC = () => {
  const {
    user,
    sponsors,
    analyticsEvents,
    draftConfig,
    setDraftConfig,
    saveDraftConfig,
    showToast,
  } = useAdmin();
  const activeSponsors = sponsors.filter((s) => s.visibilityState !== 'trashed');
  const sponsorMetaMap = draftConfig.eventsSettings?.sponsorMeta ?? {};

  const [editing, setEditing] = useState<Partial<Sponsor> | null>(null);
  const [editingMeta, setEditingMeta] = useState<SponsorExtendedMeta>({});
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [placementFilter, setPlacementFilter] = useState<SponsorPlacement | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SponsorFilterStatus>('all');
  const [savingSponsor, setSavingSponsor] = useState(false);

  const getImpressionCount = (sponsorId: string) =>
    analyticsEvents.filter((e) => e.eventType === 'sponsor_impression' && e.targetId === sponsorId).length;

  const getClickCount = (sponsorId: string) =>
    analyticsEvents.filter((e) => e.eventType === 'sponsor_click' && e.targetId === sponsorId).length;

  const formatCtr = (impressions: number, clicks: number) =>
    impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '-';

  const persistSponsorMeta = async (sponsorId: string, nextMeta: SponsorExtendedMeta) => {
    const cleanedMeta: SponsorExtendedMeta = {
      ...(nextMeta.campaignName?.trim() ? { campaignName: nextMeta.campaignName.trim().slice(0, 120) } : {}),
      ...(nextMeta.headline?.trim() ? { headline: nextMeta.headline.trim().slice(0, 180) } : {}),
      ...(nextMeta.videoUrl?.trim() ? { videoUrl: nextMeta.videoUrl.trim().slice(0, 500) } : {}),
      ...(nextMeta.memo?.trim() ? { memo: nextMeta.memo.trim().slice(0, 500) } : {}),
      ...(nextMeta.isPaused ? { isPaused: true } : {}),
    };
    const nextMap = { ...sponsorMetaMap };
    if (Object.keys(cleanedMeta).length > 0) {
      nextMap[sponsorId] = cleanedMeta;
    } else {
      delete nextMap[sponsorId];
    }
    const nextConfig = {
      ...draftConfig,
      eventsSettings: {
        hideEndedEventsGlobally: draftConfig.eventsSettings?.hideEndedEventsGlobally ?? false,
        oripaItems: draftConfig.eventsSettings?.oripaItems,
        sponsorMeta: nextMap,
      },
    };
    setDraftConfig(nextConfig);
    await saveDraftConfig(nextConfig);
    if (user) {
      try {
        await updateDoc(doc(db, 'site_config', 'published'), {
          'eventsSettings.sponsorMeta': nextMap,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch {
        // published 문서가 아직 없다면 초안 게시 시 함께 반영됩니다.
      }
    }
  };

  const openEditor = (s?: Sponsor) => {
    if (s) {
      setEditing(s);
      setEditingMeta(sponsorMetaMap[s.id] || {});
      setStartLocal(toKSTDatetimeLocalInput(s.startAt));
      setEndLocal(toKSTDatetimeLocalInput(s.endAt));
    } else {
      setEditing({
        id: '',
        name: '',
        description: '',
        url: '',
        logoUrl: '',
        desktopBannerUrl: '',
        mobileBannerUrl: '',
        ctaLabel: '',
        placement: placementFilter !== 'all' ? placementFilter : 'home_partners',
        badgeLabel: '협찬',
        priority: activeSponsors.length + 1,
        isSponsored: true,
        visibilityState: 'published',
      });
      setEditingMeta({});
      setStartLocal('');
      setEndLocal('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name?.trim() || !editing.url?.trim()) return;
    setSavingSponsor(true);
    const id = editing.id || generateSafeId('sponsor');
    const isNew = !editing.id;
    const sDate = fromKSTDatetimeLocalInput(startLocal);
    const eDate = fromKSTDatetimeLocalInput(endLocal);
    try {
      const payload = {
        name: editing.name.trim().slice(0, 100),
        description: (editing.description || '').trim().slice(0, 600),
        url: editing.url.trim().slice(0, 500),
        logoUrl: (editing.logoUrl || '').trim().slice(0, 600),
        desktopBannerUrl: (editing.desktopBannerUrl || '').trim().slice(0, 600),
        mobileBannerUrl: (editing.mobileBannerUrl || '').trim().slice(0, 600),
        ctaLabel: (editing.ctaLabel || '').trim().slice(0, 40),
        placement: (editing.placement || 'home_partners') as Sponsor['placement'],
        badgeLabel: (editing.badgeLabel || '협찬').trim().slice(0, 30),
        priority: Number(editing.priority ?? 1),
        startAt: sDate ? Timestamp.fromDate(sDate) : null,
        endAt: eDate ? Timestamp.fromDate(eDate) : null,
        isSponsored: Boolean(editing.isSponsored),
        visibilityState: (editing.visibilityState || 'published') as VisibilityState,
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        await setDoc(doc(db, 'sponsors', id), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'sponsors', id), payload);
      }
      await persistSponsorMeta(id, editingMeta);
      setEditing(null);
      showToast('협찬 / 광고 상품과 캠페인 설정이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sponsors/${id}`);
    } finally {
      setSavingSponsor(false);
    }
  };

  const handleTogglePause = async (s: Sponsor) => {
    const current = sponsorMetaMap[s.id] || {};
    const nextPaused = !current.isPaused;
    try {
      await persistSponsorMeta(s.id, { ...current, isPaused: nextPaused });
      showToast(nextPaused ? `${s.name} 노출을 일시중지했습니다.` : `${s.name} 노출을 재개했습니다.`);
    } catch (err) {
      showToast(`상태 변경 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const filteredSponsors = activeSponsors.filter((s) => {
    if (placementFilter !== 'all' && s.placement !== placementFilter) return false;
    if (statusFilter !== 'all') {
      const rt = getSponsorRuntimeStatus(s, sponsorMetaMap[s.id]);
      if (rt !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">배너 및 협찬 광고 관리</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            5개 고정 슬롯별 운영 현황, 일시중지/재개, 캠페인 영상·헤드라인 및 노출수·클릭수·CTR을 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>협찬 · 광고 추가</span>
        </button>
      </div>

      {/* Placement Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {PLACEMENT_ORDER.map((pl) => {
          const items = activeSponsors.filter((s) => s.placement === pl);
          const activeCount = items.filter(
            (s) => getSponsorRuntimeStatus(s, sponsorMetaMap[s.id]) === 'active'
          ).length;
          const pausedCount = items.filter(
            (s) => getSponsorRuntimeStatus(s, sponsorMetaMap[s.id]) === 'paused'
          ).length;
          const isSelected = placementFilter === pl;
          return (
            <button
              key={pl}
              type="button"
              onClick={() => setPlacementFilter((prev) => (prev === pl ? 'all' : pl))}
              className={`text-left p-3.5 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-[#C5CBD3] bg-[#171C23]'
                  : 'border-[#303741] bg-[#11151A] hover:border-[#4B5563]'
              }`}
            >
              <p className="text-[11px] text-[#929AA6] truncate">{PLACEMENT_LABELS[pl]}</p>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-lg font-mono-tabular font-semibold text-[#F3F4F6]">
                  {activeCount}건 노출
                </span>
                <span className="text-[11px] font-mono-tabular text-[#929AA6]">
                  {pausedCount > 0 ? `중지 ${pausedCount}` : items.length === 0 ? '빈 슬롯' : `총 ${items.length}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'active', label: '노출중' },
              { id: 'paused', label: '일시중지' },
              { id: 'scheduled', label: '예약중' },
              { id: 'ended', label: '종료됨' },
              { id: 'draft', label: '비공개' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`min-h-[32px] px-3 py-1 rounded text-xs border transition-colors ${
                statusFilter === f.id
                  ? 'border-[#C5CBD3] bg-[#171C23] text-[#F3F4F6] font-medium'
                  : 'border-[#303741] bg-[#080A0D] text-[#929AA6] hover:text-[#F3F4F6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {placementFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setPlacementFilter('all')}
            className="text-xs text-[#C5CBD3] underline underline-offset-4"
          >
            위치 필터 해제 ({PLACEMENT_LABELS[placementFilter]})
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-5">
          <div className="flex items-center justify-between border-b border-[#303741] pb-3">
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              {editing.id ? '협찬 / 광고 수정' : '새 협찬 / 광고 등록'}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-[#929AA6] hover:text-[#F3F4F6]"
            >
              닫기
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="파트너 / 브랜드명 *"
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="url"
              required
              placeholder="랜딩 URL *"
              value={editing.url || ''}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="캠페인명 (예: 2026 겨울 컬렉션 파트너십 · 선택)"
              value={editingMeta.campaignName || ''}
              onChange={(e) => setEditingMeta({ ...editingMeta, campaignName: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="배너 헤드라인 문구 (미입력 시 브랜드명 표시 · 선택)"
              value={editingMeta.headline || ''}
              onChange={(e) => setEditingMeta({ ...editingMeta, headline: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <select
              value={editing.placement || 'home_partners'}
              onChange={(e) =>
                setEditing({ ...editing, placement: e.target.value as Sponsor['placement'] })
              }
              aria-label="광고 노출 위치"
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="home_banner">메인 스폰서 배너 (홈 상단)</option>
              <option value="news_inline">뉴스 · 추첨 내 인라인 광고</option>
              <option value="home_partners">공식 파트너 로고 그리드 (홈 중단)</option>
              <option value="shop_banner">스토어 상단 배너 (/shop)</option>
              <option value="drops_banner">정가·추첨 페이지 배너 (/drops)</option>
            </select>
            <input
              type="number"
              placeholder="우선순위 (낮을수록 우선)"
              value={editing.priority ?? 1}
              onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
              className="min-h-[40px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div>
              <label className="block text-[11px] text-[#929AA6] mb-1">노출 시작일시 (선택)</label>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#929AA6] mb-1">노출 종료일시 (선택)</label>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
            </div>

            <input
              type="text"
              placeholder="배지 문구 (예: 협찬, 공식 파트너)"
              value={editing.badgeLabel || ''}
              onChange={(e) => setEditing({ ...editing, badgeLabel: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="버튼 문구 (미입력 시 '공식 사이트')"
              value={editing.ctaLabel || ''}
              onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />

            <input
              type="url"
              placeholder="캠페인 영상 URL (YouTube / MP4 · 선택)"
              value={editingMeta.videoUrl || ''}
              onChange={(e) => setEditingMeta({ ...editingMeta, videoUrl: e.target.value })}
              className="sm:col-span-2 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />

            {/* Brand Logo */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="브랜드 로고 이미지 URL (선택)"
                value={editing.logoUrl || ''}
                onChange={(e) => setEditing({ ...editing, logoUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={13} />
                <span>{uploadingLogo ? '업로드 중...' : '로고 업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingLogo(true);
                    try {
                      const url = await uploadPublicMedia('sponsors', file);
                      setEditing({ ...editing, logoUrl: url });
                      showToast('파트너 로고가 업로드되었습니다.');
                    } catch (err) {
                      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  className="sr-only"
                />
              </label>
              {editing.logoUrl && (
                <div className="w-10 h-10 rounded border border-[#303741] overflow-hidden shrink-0">
                  <SafeImage src={editing.logoUrl} alt="로고" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* PC Banner Image */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="PC용 홍보 배너 이미지 URL (미입력 시 텍스트형 배너)"
                value={editing.desktopBannerUrl || ''}
                onChange={(e) => setEditing({ ...editing, desktopBannerUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={13} />
                <span>{uploadingDesktop ? '업로드 중...' : 'PC 배너 업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingDesktop(true);
                    try {
                      const url = await uploadPublicMedia('sponsors', file);
                      setEditing({ ...editing, desktopBannerUrl: url });
                      showToast('PC용 배너 이미지가 업로드되었습니다.');
                    } catch (err) {
                      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setUploadingDesktop(false);
                    }
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Mobile Banner Image */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="모바일용 홍보 배너 이미지 URL (선택)"
                value={editing.mobileBannerUrl || ''}
                onChange={(e) => setEditing({ ...editing, mobileBannerUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={13} />
                <span>{uploadingMobile ? '업로드 중...' : '모바일 배너 업로드'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploadingMobile(true);
                    try {
                      const url = await uploadPublicMedia('sponsors', file);
                      setEditing({ ...editing, mobileBannerUrl: url });
                      showToast('모바일용 배너 이미지가 업로드되었습니다.');
                    } catch (err) {
                      showToast(`업로드 실패: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setUploadingMobile(false);
                    }
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            <textarea
              rows={2}
              placeholder="소개 문구"
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="sm:col-span-2 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />

            <input
              type="text"
              placeholder="관리자 내부 메모 (비공개 · 선택)"
              value={editingMeta.memo || ''}
              onChange={(e) => setEditingMeta({ ...editingMeta, memo: e.target.value })}
              className="sm:col-span-2 min-h-[38px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#929AA6]"
            />

            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-xs text-[#C5CBD3]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isSponsored)}
                  onChange={(e) => setEditing({ ...editing, isSponsored: e.target.checked })}
                />
                <span>협찬/SPONSORED 배지 표시</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editingMeta.isPaused)}
                  onChange={(e) => setEditingMeta({ ...editingMeta, isPaused: e.target.checked })}
                />
                <span>노출 일시중지</span>
              </label>
              <select
                value={editing.visibilityState || 'published'}
                onChange={(e) =>
                  setEditing({ ...editing, visibilityState: e.target.value as VisibilityState })
                }
                className="min-h-[34px] px-2 bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="published">공개</option>
                <option value="draft">비공개</option>
              </select>
            </div>
          </div>

          {/* Live PC vs Mobile Banner Preview */}
          {(editing.desktopBannerUrl || editing.mobileBannerUrl || editingMeta.headline || editing.name) && (
            <div className="border-t border-[#303741] pt-4 space-y-2.5">
              <p className="text-[11px] font-medium text-[#929AA6]">PC / 모바일 배너 실시간 미리보기</p>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 rounded border border-[#303741] bg-white text-[#111827] overflow-hidden">
                  <div className="px-3 py-1.5 bg-[#F5F6F8] border-b border-[#E5E7EB] text-[10px] text-[#667085]">
                    PC 뷰 ({PLACEMENT_LABELS[editing.placement || 'home_partners']})
                  </div>
                  {editing.desktopBannerUrl ? (
                    <div className="aspect-[16/5] bg-[#F5F6F8] overflow-hidden">
                      <SafeImage
                        src={editing.desktopBannerUrl}
                        alt="PC 미리보기"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-[#465C77] uppercase tracking-wider">
                          {editing.badgeLabel || 'SPONSORED'}
                          {editingMeta.campaignName ? ` · ${editingMeta.campaignName}` : ''}
                        </span>
                        <p className="text-sm font-semibold truncate mt-0.5">
                          {editingMeta.headline || editing.name || '브랜드명'}
                        </p>
                        {editing.description && (
                          <p className="text-xs text-[#667085] truncate">{editing.description}</p>
                        )}
                      </div>
                      <span className="px-3 py-1.5 rounded bg-[#111827] text-white text-[11px] shrink-0">
                        {editing.ctaLabel || '공식 사이트'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 rounded border border-[#303741] bg-white text-[#111827] overflow-hidden">
                  <div className="px-3 py-1.5 bg-[#F5F6F8] border-b border-[#E5E7EB] text-[10px] text-[#667085]">
                    모바일 뷰
                  </div>
                  {editing.mobileBannerUrl || editing.desktopBannerUrl ? (
                    <div className="aspect-[4/3] bg-[#F5F6F8] overflow-hidden">
                      <SafeImage
                        src={editing.mobileBannerUrl || editing.desktopBannerUrl || ''}
                        alt="모바일 미리보기"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="p-3 space-y-1.5">
                      <span className="text-[10px] font-semibold text-[#465C77]">
                        {editing.badgeLabel || 'SPONSORED'}
                      </span>
                      <p className="text-xs font-semibold truncate">
                        {editingMeta.headline || editing.name || '브랜드명'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-xs border border-[#303741] rounded text-[#929AA6]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={savingSponsor}
              className="px-5 py-2 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded disabled:opacity-50"
            >
              {savingSponsor ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {filteredSponsors.map((s) => {
          const meta = sponsorMetaMap[s.id];
          const rtStatus = getSponsorRuntimeStatus(s, meta);
          const impressions = getImpressionCount(s.id);
          const clicks = getClickCount(s.id);
          const statusBadge =
            rtStatus === 'active'
              ? { label: '노출중', cls: 'text-emerald-300' }
              : rtStatus === 'paused'
                ? { label: '일시중지', cls: 'text-amber-300' }
                : rtStatus === 'scheduled'
                  ? { label: '예약중', cls: 'text-sky-300' }
                  : rtStatus === 'ended'
                    ? { label: '종료됨', cls: 'text-[#929AA6]' }
                    : { label: '비공개', cls: 'text-[#929AA6]' };

          return (
            <div
              key={s.id}
              className="border border-[#303741] rounded-lg p-5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {s.logoUrl ? (
                  <div className="w-11 h-11 rounded border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
                    <SafeImage src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded border border-[#303741] bg-[#080A0D] flex items-center justify-center shrink-0">
                    <span className="font-brand text-xs font-bold text-[#C5CBD3]">
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#929AA6]">
                    <span>우선순위 {s.priority}</span>
                    <span>·</span>
                    <span className="text-[#C5CBD3]">{PLACEMENT_LABELS[s.placement] || s.placement}</span>
                    <span>·</span>
                    <span className={statusBadge.cls}>{statusBadge.label}</span>
                    {(s.desktopBannerUrl || s.mobileBannerUrl) && (
                      <>
                        <span>·</span>
                        <span className="text-[#C5CBD3]">이미지 배너</span>
                      </>
                    )}
                    {meta?.videoUrl && (
                      <>
                        <span>·</span>
                        <span className="text-[#C5CBD3]">영상 포함</span>
                      </>
                    )}
                  </div>
                  <p className="text-base font-semibold text-[#F3F4F6]">
                    {s.name}
                    {meta?.campaignName && (
                      <span className="ml-2 text-xs font-normal text-[#929AA6]">
                        — {meta.campaignName}
                      </span>
                    )}
                  </p>
                  {meta?.headline && (
                    <p className="text-xs text-[#C5CBD3]">{meta.headline}</p>
                  )}
                  <p className="text-xs text-[#929AA6] truncate">{s.url}</p>
                  {meta?.memo && (
                    <p className="text-[11px] text-[#929AA6]">메모: {meta.memo}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono-tabular text-[#C5CBD3]">
                    <span>노출 {impressions}회</span>
                    <span>·</span>
                    <span>클릭 {clicks}회</span>
                    <span>·</span>
                    <span>CTR {formatCtr(impressions, clicks)}</span>
                    {Boolean(s.startAt || s.endAt) && (
                      <>
                        <span>·</span>
                        <span className="text-[#929AA6]">
                          기간 {s.startAt ? formatKST(s.startAt, false) : '즉시'} ~{' '}
                          {s.endAt ? formatKST(s.endAt, false) : '상시'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTogglePause(s)}
                  className={`px-3 py-1.5 text-xs border rounded inline-flex items-center gap-1 ${
                    meta?.isPaused
                      ? 'border-emerald-400/50 text-emerald-200 hover:bg-emerald-950/30'
                      : 'border-amber-400/40 text-amber-200 hover:bg-amber-950/30'
                  }`}
                >
                  {meta?.isPaused ? <Play size={12} /> : <Pause size={12} />}
                  <span>{meta?.isPaused ? '재개' : '일시중지'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditor(s)}
                  className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDoc(doc(db, 'sponsors', s.id), {
                      visibilityState: 'trashed',
                      updatedAt: serverTimestamp(),
                    })
                  }
                  className="p-2 border border-red-400/40 rounded text-red-200"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredSponsors.length === 0 && (
          <div className="border border-dashed border-[#303741] rounded-lg p-8 text-center text-xs text-[#929AA6]">
            선택된 조건에 해당하는 협찬 · 광고 항목이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   11. 라이브 / 이벤트 관리
============================================================================ */
export const EventsTab: React.FC = () => {
  const { events, draftConfig, setDraftConfig, setHasUnsavedChanges, showToast } = useAdmin();
  const activeEvents = events.filter((e) => e.visibilityState !== 'trashed');

  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');

  const openEditor = (ev?: EventItem) => {
    if (ev) {
      setEditing(ev);
      setStartLocal(toKSTDatetimeLocalInput(ev.startAt));
      setEndLocal(toKSTDatetimeLocalInput(ev.endAt));
    } else {
      setEditing({
        id: '',
        title: '',
        description: '',
        locationOrPlatform: 'Instagram Live (@novapokemonkr)',
        externalUrl: 'https://www.instagram.com/novapokemonkr/',
        hideWhenEnded: true,
        isSample: false,
        visibilityState: 'published',
      });
      setStartLocal('');
      setEndLocal('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title?.trim()) return;
    const sDate = fromKSTDatetimeLocalInput(startLocal) || new Date();
    const eDate = fromKSTDatetimeLocalInput(endLocal) || new Date(sDate.getTime() + 3600 * 1000);
    const id = editing.id || generateSafeId('event');
    const isNew = !editing.id;
    try {
      const payload = {
        title: editing.title.trim().slice(0, 160),
        description: (editing.description || '').trim().slice(0, 2000),
        startAt: Timestamp.fromDate(sDate),
        endAt: Timestamp.fromDate(eDate),
        locationOrPlatform: (editing.locationOrPlatform || '').trim().slice(0, 120),
        externalUrl: (editing.externalUrl || '').trim().slice(0, 500),
        hideWhenEnded: Boolean(editing.hideWhenEnded),
        isSample: Boolean(editing.isSample),
        visibilityState: (editing.visibilityState || 'published') as VisibilityState,
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        await setDoc(doc(db, 'events', id), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'events', id), payload);
      }
      setEditing(null);
      showToast('일정이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `events/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">라이브 &amp; 이벤트 (KST)</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            종료 시간이 지나면 자동으로 종료됨 상태가 되며, 설정에 따라 자동 숨김 처리됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#C5CBD3] flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={Boolean(draftConfig.eventsSettings?.hideEndedEventsGlobally)}
              onChange={(e) => {
                setDraftConfig((prev) => ({
                  ...prev,
                  eventsSettings: {
                    ...prev.eventsSettings,
                    hideEndedEventsGlobally: e.target.checked,
                  },
                }));
                setHasUnsavedChanges(true);
              }}
            />
            <span>종료 일정 전체 자동 숨김</span>
          </label>
          <button
            type="button"
            onClick={() => openEditor()}
            className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="이벤트 제목 *"
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="datetime-local"
              required
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="datetime-local"
              required
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="text"
              placeholder="플랫폼 / 장소"
              value={editing.locationOrPlatform || ''}
              onChange={(e) => setEditing({ ...editing, locationOrPlatform: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="url"
              placeholder="외부 링크"
              value={editing.externalUrl || ''}
              onChange={(e) => setEditing({ ...editing, externalUrl: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <textarea
              rows={2}
              placeholder="설명"
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="sm:col-span-2 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div className="flex items-center gap-4 text-xs text-[#C5CBD3]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editing.hideWhenEnded)}
                  onChange={(e) => setEditing({ ...editing, hideWhenEnded: e.target.checked })}
                />
                <span>종료 시 숨김</span>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isSample)}
                  onChange={(e) => setEditing({ ...editing, isSample: e.target.checked })}
                />
                <span>SAMPLE</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-xs border border-[#303741] rounded text-[#929AA6]"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded"
            >
              저장
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
        {activeEvents.map((ev) => (
          <div key={ev.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[#929AA6]">
                {getEventStatus(ev.startAt, ev.endAt)} · {formatKST(ev.startAt)} KST
                {ev.isSample ? ' · SAMPLE' : ''}
              </p>
              <p className="text-sm font-medium text-[#F3F4F6] truncate">{ev.title}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEditor(ev)}
                className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'events', ev.id), {
                    visibilityState: 'trashed',
                    updatedAt: serverTimestamp(),
                  })
                }
                className="p-2 border border-red-400/40 rounded text-red-200"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   12. 후기 관리 (관리자 승인 항목만 노출)
============================================================================ */
export const ReviewsTab: React.FC = () => {
  const { reviews, showToast } = useAdmin();
  const activeReviews = reviews.filter((r) => r.visibilityState !== 'trashed');

  const [authorName, setAuthorName] = useState('');
  const [context, setContext] = useState('');
  const [content, setContent] = useState('');
  const [isApproved, setIsApproved] = useState(true);
  const [isSample, setIsSample] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    const id = generateSafeId('rev');
    try {
      await setDoc(doc(db, 'reviews', id), {
        authorName: authorName.trim().slice(0, 80),
        context: context.trim().slice(0, 100),
        content: content.trim().slice(0, 1000),
        isApproved,
        isSample,
        visibilityState: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAuthorName('');
      setContext('');
      setContent('');
      showToast('후기가 등록되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">후기 관리</h1>
        <p className="text-xs text-[#929AA6] mt-1">관리자 승인이 켜진 후기만 공개 화면에 노출됩니다.</p>
      </div>

      <form onSubmit={handleAdd} className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="작성자 (예: 컬렉터 K***)"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            placeholder="거래 맥락 (예: PSA 10 등급카드 구매)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
        <textarea
          required
          rows={3}
          placeholder="실제 후기 내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
        />
        <div className="flex items-center justify-between text-xs text-[#C5CBD3]">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isApproved} onChange={(e) => setIsApproved(e.target.checked)} />
              <span>승인 (즉시 노출)</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} />
              <span>SAMPLE</span>
            </label>
          </div>
          <button type="submit" className="min-h-[38px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded font-semibold">
            후기 등록
          </button>
        </div>
      </form>

      <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
        {activeReviews.map((r) => (
          <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-[#929AA6]">
                {r.authorName} {r.context ? `· ${r.context}` : ''}
                {r.isSample ? ' · SAMPLE' : ''}
              </p>
              <p className="text-sm text-[#F3F4F6]">{r.content}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'reviews', r.id), {
                    isApproved: !r.isApproved,
                    updatedAt: serverTimestamp(),
                  })
                }
                className={`px-3 py-1.5 text-xs rounded border ${
                  r.isApproved
                    ? 'border-[#C5CBD3] text-[#C5CBD3]'
                    : 'border-[#303741] text-[#929AA6]'
                }`}
              >
                {r.isApproved ? '승인됨' : '미승인'}
              </button>
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'reviews', r.id), {
                    isApproved: false,
                    visibilityState: 'trashed',
                    updatedAt: serverTimestamp(),
                  })
                }
                className="p-2 border border-red-400/40 rounded text-red-200"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   13. FAQ 관리
============================================================================ */
export const FaqsTab: React.FC = () => {
  const { faqs, showToast } = useAdmin();
  const activeFaqs = faqs.filter((f) => f.visibilityState !== 'trashed');

  const [editId, setEditId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    const id = editId || generateSafeId('faq');
    try {
      if (editId) {
        await updateDoc(doc(db, 'faqs', id), {
          question: question.trim().slice(0, 200),
          answer: answer.trim().slice(0, 2000),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'faqs', id), {
          question: question.trim().slice(0, 200),
          answer: answer.trim().slice(0, 2000),
          order: activeFaqs.length,
          visibilityState: 'published',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setEditId(null);
      setQuestion('');
      setAnswer('');
      showToast('FAQ가 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `faqs/${id}`);
    }
  };

  const moveFaq = async (from: number, to: number) => {
    if (to < 0 || to >= activeFaqs.length) return;
    const copy = [...activeFaqs];
    const [picked] = copy.splice(from, 1);
    copy.splice(to, 0, picked);
    const batch = writeBatch(db);
    copy.forEach((f, idx) =>
      batch.update(doc(db, 'faqs', f.id), { order: idx, updatedAt: serverTimestamp() })
    );
    await batch.commit();
    showToast('FAQ 순서가 변경되었습니다.');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">FAQ 관리</h1>
      </div>

      <form onSubmit={handleSave} className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-3">
        <input
          type="text"
          required
          placeholder="질문 (Q)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
        />
        <textarea
          required
          rows={3}
          placeholder="답변 (A)"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
        />
        <div className="flex justify-end gap-2">
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setQuestion('');
                setAnswer('');
              }}
              className="px-4 py-2 text-xs border border-[#303741] rounded text-[#929AA6]"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="min-h-[38px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold"
          >
            {editId ? 'FAQ 수정 저장' : 'FAQ 추가'}
          </button>
        </div>
      </form>

      <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
        {activeFaqs.map((f, idx) => (
          <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-[#F3F4F6]">Q. {f.question}</p>
              <p className="text-xs text-[#929AA6] line-clamp-2">{f.answer}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => moveFaq(idx, idx - 1)}
                className="p-1.5 border border-[#303741] rounded text-[#929AA6]"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => moveFaq(idx, idx + 1)}
                className="p-1.5 border border-[#303741] rounded text-[#929AA6]"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditId(f.id);
                  setQuestion(f.question);
                  setAnswer(f.answer);
                }}
                className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() =>
                  updateDoc(doc(db, 'faqs', f.id), {
                    visibilityState: 'trashed',
                    updatedAt: serverTimestamp(),
                  })
                }
                className="p-2 border border-red-400/40 rounded text-red-200"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
