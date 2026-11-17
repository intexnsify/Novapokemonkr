import React, { useState } from 'react';
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
  Pin,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { uploadPublicMedia } from '../../lib/storage';
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
  Notice,
  Post,
  Product,
  ProductCategory,
  ProductStatus,
  Review,
  Sponsor,
  VisibilityState,
} from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
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
  const { posts, showToast } = useAdmin();
  const activePosts = posts.filter((p) => p.visibilityState !== 'trashed');

  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEditor = (p?: Post) => {
    if (p) {
      setEditing(p);
      setScheduledLocal(toKSTDatetimeLocalInput(p.scheduledAt));
    } else {
      setEditing({
        id: '',
        title: '',
        slug: '',
        category: 'TCG 뉴스',
        summary: '',
        content: '',
        coverImage: '',
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

  const handleUploadCover = async (file?: File) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await uploadPublicMedia('posts', file);
      setEditing({ ...editing, coverImage: url });
      showToast('대표 이미지가 업로드되었습니다.');
    } catch (err) {
      showToast(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleInsertInlineImage = async (file?: File) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await uploadPublicMedia('posts', file);
      setEditing({
        ...editing,
        content: `${editing.content || ''}\n\n![이미지 설명](${url})\n`,
      });
      showToast('본문에 이미지 마크다운이 삽입되었습니다.');
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
        slug: sanitizeSlug(editing.slug || editing.title),
        category: (editing.category || 'TCG 뉴스').trim().slice(0, 50),
        summary: (editing.summary || '').trim().slice(0, 400),
        content: editing.content.slice(0, 30000),
        coverImage: (editing.coverImage || '').trim().slice(0, 600),
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
      handleFirestoreError(err, OperationType.WRITE, `posts/${id}`);
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
            <input
              type="text"
              placeholder="카테고리 (예: 컬렉팅 가이드)"
              value={editing.category || ''}
              onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
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
                  onChange={(e) => handleUploadCover(e.target.files?.[0])}
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
                  onChange={(e) => handleInsertInlineImage(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>

            {previewMode ? (
              <div className="min-h-[240px] p-5 border border-[#303741] rounded bg-[#080A0D] text-sm text-[#F3F4F6] space-y-3 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown>{editing.content || ''}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                required
                rows={10}
                value={editing.content || ''}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                placeholder="## 소제목&#10;본문 내용을 마크다운으로 작성하세요."
                className="w-full px-3 py-2.5 text-sm font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
            )}
          </div>

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
   10. 배너 및 협찬 관리 (REPACK 포함, 위치/기간/우선순위/클릭수)
============================================================================ */
export const SponsorsTab: React.FC = () => {
  const { sponsors, analyticsEvents, showToast } = useAdmin();
  const activeSponsors = sponsors.filter((s) => s.visibilityState !== 'trashed');

  const [editing, setEditing] = useState<Partial<Sponsor> | null>(null);
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const getClickCount = (sponsorId: string) =>
    analyticsEvents.filter((e) => e.eventType === 'sponsor_click' && e.targetId === sponsorId).length;

  const openEditor = (s?: Sponsor) => {
    if (s) {
      setEditing(s);
      setStartLocal(toKSTDatetimeLocalInput(s.startAt));
      setEndLocal(toKSTDatetimeLocalInput(s.endAt));
    } else {
      setEditing({
        id: '',
        name: '',
        description: '',
        url: '',
        logoUrl: '',
        placement: 'home_partners',
        badgeLabel: '협찬',
        priority: activeSponsors.length + 1,
        isSponsored: true,
        visibilityState: 'published',
      });
      setStartLocal('');
      setEndLocal('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name?.trim() || !editing.url?.trim()) return;
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
      setEditing(null);
      showToast('협찬 / 배너가 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sponsors/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">배너 및 협찬 관리</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            REPACK 등 공식 협찬 파트너의 노출 위치, 기간, 우선순위 및 실제 클릭수를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>협찬 추가</span>
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="파트너/배너명 *"
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
            <select
              value={editing.placement || 'home_partners'}
              onChange={(e) =>
                setEditing({ ...editing, placement: e.target.value as Sponsor['placement'] })
              }
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="home_partners">메인 협찬 파트너 섹션</option>
              <option value="home_banner">메인 배너</option>
              <option value="shop_banner">스토어 상단 배너</option>
            </select>
            <input
              type="number"
              placeholder="우선순위 (낮을수록 우선)"
              value={editing.priority ?? 1}
              onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
              className="min-h-[40px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="파트너 로고 이미지 URL (선택)"
                value={editing.logoUrl || ''}
                onChange={(e) => setEditing({ ...editing, logoUrl: e.target.value })}
                className="flex-1 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3] shrink-0">
                <Upload size={13} />
                <span>{uploadingLogo ? '중...' : '로고 업로드'}</span>
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
            <textarea
              rows={2}
              placeholder="설명 문구"
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              className="sm:col-span-2 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            />
            <div className="flex items-center gap-4 text-xs text-[#C5CBD3]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isSponsored)}
                  onChange={(e) => setEditing({ ...editing, isSponsored: e.target.checked })}
                />
                <span>협찬 배지 표시</span>
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

      <div className="space-y-3">
        {activeSponsors.map((s) => (
          <div
            key={s.id}
            className="border border-[#303741] rounded-lg p-5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#929AA6]">
                <span>우선순위 {s.priority}</span>
                <span>·</span>
                <span>{s.placement}</span>
                <span>·</span>
                <span className="font-mono-tabular text-[#C5CBD3]">
                  클릭수 {getClickCount(s.id)}회
                </span>
              </div>
              <p className="text-base font-semibold text-[#F3F4F6]">{s.name}</p>
              <p className="text-xs text-[#929AA6] truncate">{s.url}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
        ))}
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
                  eventsSettings: { hideEndedEventsGlobally: e.target.checked },
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
