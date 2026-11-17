import React, { useMemo, useState } from 'react';
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  Archive,
  CheckCircle2,
  Database,
  ExternalLink,
  Layers,
  ListPlus,
  Pin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { RAKUTEN_NOV_2026_CAMPAIGN_ID } from '../../lib/defaults';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { seedRakutenNovemberCampaign } from '../../lib/seed';
import { uploadDropImageWithFallback } from '../../lib/storage';
import {
  formatDropDateTime,
  formatDropPrice,
  fromKSTDatetimeLocalInput,
  generateSafeId,
  getDropStatusInfo,
  resolveEffectiveDrop,
  toKSTDatetimeLocalInput,
} from '../../lib/utils';
import {
  DropCountry,
  DropCurrency,
  DropSaleType,
  DropStatusOverride,
  DropTcgCategory,
  RetailCampaign,
  RetailDrop,
  VisibilityState,
} from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
import { useAdmin } from './AdminContext';

const SALE_TYPES: DropSaleType[] = ['추첨 판매', '일반 정가 판매', '선착순 판매', '예약 판매'];
const TCG_OPTIONS: DropTcgCategory[] = ['포켓몬', '원피스', '기타 TCG'];
const COUNTRY_OPTIONS: DropCountry[] = ['한국', '일본', '미국'];
const CURRENCY_OPTIONS: DropCurrency[] = ['KRW', 'JPY', 'USD'];

const STATUS_OPTIONS_BY_SALE_TYPE: Record<DropSaleType, DropStatusOverride[]> = {
  '추첨 판매': ['auto', '예정', '응모 중', '마감 임박', '응모 종료'],
  '일반 정가 판매': ['재확인 필요', '판매 확인', '품절 확인'],
  '선착순 판매': ['auto', '시작 예정', '접수 중', '종료', '확인 필요'],
  '예약 판매': ['auto', '시작 예정', '접수 중', '종료', '확인 필요'],
};

type DropsSubTab = 'drops' | 'campaigns' | 'bulk';

export const DropsTab: React.FC = () => {
  const { retailCampaigns, retailDrops, showToast } = useAdmin();
  const [subTab, setSubTab] = useState<DropsSubTab>('drops');
  const [busy, setBusy] = useState(false);

  const activeCampaigns = useMemo(
    () => retailCampaigns.filter((c) => c.visibilityState !== 'trashed'),
    [retailCampaigns]
  );
  const activeDrops = useMemo(
    () => retailDrops.filter((d) => d.visibilityState !== 'trashed'),
    [retailDrops]
  );

  const campaignMap = useMemo(
    () => new Map(activeCampaigns.map((c) => [c.id, c])),
    [activeCampaigns]
  );

  const rakutenExists = retailCampaigns.some((c) => c.id === RAKUTEN_NOV_2026_CAMPAIGN_ID);

  // Drop filters
  const [filterCampaignId, setFilterCampaignId] = useState<string>('all');
  const [filterSaleType, setFilterSaleType] = useState<'all' | DropSaleType>('all');

  // Drop editor state
  const [editingDrop, setEditingDrop] = useState<Partial<RetailDrop> | null>(null);
  const [dropStartLocal, setDropStartLocal] = useState('');
  const [dropEndLocal, setDropEndLocal] = useState('');
  const [refreshDropVerified, setRefreshDropVerified] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [quickUploadingId, setQuickUploadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Campaign editor state
  const [editingCampaign, setEditingCampaign] = useState<Partial<RetailCampaign> | null>(null);
  const [campStartLocal, setCampStartLocal] = useState('');
  const [campEndLocal, setCampEndLocal] = useState('');
  const [refreshCampVerified, setRefreshCampVerified] = useState(true);

  // Bulk register state
  const [bulkCampaignId, setBulkCampaignId] = useState('');
  const [bulkTcg, setBulkTcg] = useState<DropTcgCategory>('포켓몬');
  const [bulkCountry, setBulkCountry] = useState<DropCountry>('일본');
  const [bulkRetailer, setBulkRetailer] = useState('');
  const [bulkSaleType, setBulkSaleType] = useState<DropSaleType>('추첨 판매');
  const [bulkCurrency, setBulkCurrency] = useState<DropCurrency>('JPY');
  const [bulkTimezone, setBulkTimezone] = useState('JST');
  const [bulkStartLocal, setBulkStartLocal] = useState('');
  const [bulkEndLocal, setBulkEndLocal] = useState('');
  const [bulkPurchaseWindow, setBulkPurchaseWindow] = useState('');
  const [bulkConditions, setBulkConditions] = useState('');
  const [bulkVisibility, setBulkVisibility] = useState<VisibilityState>('published');
  const [bulkRawText, setBulkRawText] = useState('');

  const handleQuickRowImageUpload = async (dropId: string, file?: File) => {
    if (!file) return;
    setActionError(null);
    setQuickUploadingId(dropId);
    try {
      const { url, mode } = await uploadDropImageWithFallback(file);
      if (url.length > 200000) {
        throw new Error('이미지 크기가 너무 큽니다. 더 작은 이미지를 선택하거나 이미지 URL을 입력해 주세요.');
      }
      await updateDoc(doc(db, 'retail_drops', dropId), {
        imageUrl: url,
        updatedAt: serverTimestamp(),
      });
      showToast(
        mode === 'inline'
          ? '상품 사진이 최적화되어 저장되었습니다. 메인 페이지와 /drops에 즉시 반영됩니다.'
          : '상품 사진이 업로드되어 메인 페이지와 /drops에 반영되었습니다.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`사진 등록 실패: ${msg}`);
      showToast(`사진 업로드 오류: ${msg}`);
    } finally {
      setQuickUploadingId(null);
    }
  };

  const handleSeedRakuten = async () => {
    setBusy(true);
    try {
      const res = await seedRakutenNovemberCampaign();
      showToast(
        res.created > 0
          ? `라쿠텐북스 2026년 11월 추첨 캠페인 및 상품 총 ${res.created}건이 Firestore에 등록되었습니다.`
          : '라쿠텐북스 2026년 11월 캠페인이 이미 등록되어 있습니다.'
      );
    } catch (err) {
      showToast(`등록 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveEndedRaffles = async () => {
    const targets = activeDrops.filter((d) => {
      const effective = resolveEffectiveDrop(
        d,
        d.campaignId ? campaignMap.get(d.campaignId) : undefined
      );
      const status = getDropStatusInfo(effective);
      return status.isEnded && !d.archiveEnded;
    });

    if (targets.length === 0) {
      showToast('아카이브할 종료된 추첨/판매 항목이 없습니다.');
      return;
    }

    setBusy(true);
    try {
      const batch = writeBatch(db);
      targets.forEach((d) => {
        batch.update(doc(db, 'retail_drops', d.id), {
          archiveEnded: true,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showToast(`종료된 ${targets.length}건이 자동 아카이브 처리되었습니다.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'retail_drops_archive');
    } finally {
      setBusy(false);
    }
  };

  const openDropEditor = (drop?: RetailDrop) => {
    if (drop) {
      setEditingDrop(drop);
      setDropStartLocal(toKSTDatetimeLocalInput(drop.startAt));
      setDropEndLocal(toKSTDatetimeLocalInput(drop.endAt));
      setRefreshDropVerified(false);
    } else {
      setEditingDrop({
        id: '',
        campaignId: '',
        title: '',
        tcg: '포켓몬',
        country: '한국',
        retailer: '',
        saleType: '추첨 판매',
        price: 0,
        currency: 'KRW',
        imageUrl: '',
        officialUrl: '',
        timezoneLabel: 'KST',
        purchaseWindowText: '',
        conditions: '',
        manualStatus: 'auto',
        isPinned: false,
        isRecommended: false,
        archiveEnded: false,
        order: activeDrops.length + 1,
        visibilityState: 'published',
      });
      setDropStartLocal('');
      setDropEndLocal('');
      setRefreshDropVerified(true);
    }
  };

  const handleCampaignSelectForDrop = (campaignId: string) => {
    if (!editingDrop) return;
    if (!campaignId) {
      setEditingDrop({ ...editingDrop, campaignId: '' });
      return;
    }
    const camp = campaignMap.get(campaignId);
    if (!camp) return;
    setEditingDrop({
      ...editingDrop,
      campaignId: camp.id,
      retailer: camp.retailer,
      country: camp.country,
      saleType: camp.saleType,
      timezoneLabel: camp.timezoneLabel || 'KST',
      purchaseWindowText: camp.purchaseWindowText || '',
      conditions: camp.conditions || '',
      currency: camp.country === '일본' ? 'JPY' : camp.country === '미국' ? 'USD' : 'KRW',
      manualStatus: camp.saleType === '일반 정가 판매' ? '재확인 필요' : 'auto',
    });
    setDropStartLocal(toKSTDatetimeLocalInput(camp.startAt));
    setDropEndLocal(toKSTDatetimeLocalInput(camp.endAt));
  };

  const handleUploadDropImage = async (file?: File) => {
    if (!file || !editingDrop) return;
    setActionError(null);
    setUploadingImage(true);
    try {
      const { url, mode } = await uploadDropImageWithFallback(file);
      if (url.length > 200000) {
        throw new Error('이미지 크기가 너무 큽니다. 더 작은 이미지를 선택하거나 이미지 URL을 입력해 주세요.');
      }
      setEditingDrop({ ...editingDrop, imageUrl: url });
      showToast(
        mode === 'inline'
          ? '상품 이미지가 최적화되어 입력되었습니다. 아래 [상품 저장]을 눌러 반영하세요.'
          : '상품 이미지가 업로드되었습니다. 아래 [상품 저장]을 눌러 반영하세요.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(`사진 업로드 실패: ${msg}`);
      showToast(`업로드 오류: ${msg}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!editingDrop || !editingDrop.title?.trim() || !editingDrop.retailer?.trim() || !editingDrop.officialUrl?.trim()) {
      showToast('제품명, 판매처, 공식 링크를 입력해 주세요.');
      return;
    }
    const trimmedImageUrl = (editingDrop.imageUrl || '').trim();
    if (trimmedImageUrl.length > 200000) {
      const msg = '이미지 데이터/URL 길이가 너무 큽니다(최대 200,000자). 파일을 다시 업로드하거나 짧은 URL을 입력해 주세요.';
      setActionError(msg);
      showToast(msg);
      return;
    }

    setBusy(true);
    const id = editingDrop.id || generateSafeId('drop');
    const isNew = !editingDrop.id;
    const sDate = fromKSTDatetimeLocalInput(dropStartLocal);
    const eDate = fromKSTDatetimeLocalInput(dropEndLocal);
    const saleType = (editingDrop.saleType || '추첨 판매') as DropSaleType;

    let manualStatus = (editingDrop.manualStatus || 'auto') as DropStatusOverride;
    if (saleType === '일반 정가 판매' && manualStatus === 'auto') {
      manualStatus = '재확인 필요';
    }

    try {
      const payload = {
        campaignId: (editingDrop.campaignId || '').trim().slice(0, 128),
        title: editingDrop.title.trim().slice(0, 160),
        tcg: (editingDrop.tcg || '포켓몬') as DropTcgCategory,
        country: (editingDrop.country || '한국') as DropCountry,
        retailer: editingDrop.retailer.trim().slice(0, 100),
        saleType,
        price: Math.max(0, Number(editingDrop.price ?? 0)),
        currency: (editingDrop.currency || 'KRW') as DropCurrency,
        imageUrl: trimmedImageUrl,
        officialUrl: editingDrop.officialUrl.trim().slice(0, 500),
        timezoneLabel: (editingDrop.timezoneLabel || 'KST').trim().slice(0, 40),
        startAt: sDate ? Timestamp.fromDate(sDate) : null,
        endAt: eDate ? Timestamp.fromDate(eDate) : null,
        purchaseWindowText: (editingDrop.purchaseWindowText || '').trim().slice(0, 200),
        conditions: (editingDrop.conditions || '').trim().slice(0, 4000),
        manualStatus,
        verifiedAt: refreshDropVerified
          ? serverTimestamp()
          : editingDrop.verifiedAt ?? null,
        isPinned: Boolean(editingDrop.isPinned),
        isRecommended: Boolean(editingDrop.isRecommended),
        archiveEnded: Boolean(editingDrop.archiveEnded),
        order: Number(editingDrop.order ?? activeDrops.length + 1),
        visibilityState: (editingDrop.visibilityState || 'published') as VisibilityState,
        updatedAt: serverTimestamp(),
      };

      if (isNew) {
        await setDoc(doc(db, 'retail_drops', id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'retail_drops', id), payload);
      }

      setEditingDrop(null);
      showToast('정가·추첨 상품이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `retail_drops/${id}`);
    } finally {
      setBusy(false);
    }
  };

  const openCampaignEditor = (camp?: RetailCampaign) => {
    if (camp) {
      setEditingCampaign(camp);
      setCampStartLocal(toKSTDatetimeLocalInput(camp.startAt));
      setCampEndLocal(toKSTDatetimeLocalInput(camp.endAt));
      setRefreshCampVerified(false);
    } else {
      setEditingCampaign({
        id: '',
        title: '',
        retailer: '',
        country: '한국',
        saleType: '추첨 판매',
        timezoneLabel: 'KST',
        purchaseWindowText: '',
        conditions: '',
        officialUrl: '',
        isPinned: false,
        isRecommended: false,
        archiveEnded: false,
        visibilityState: 'published',
      });
      setCampStartLocal('');
      setCampEndLocal('');
      setRefreshCampVerified(true);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editingCampaign.title?.trim() || !editingCampaign.retailer?.trim()) {
      showToast('캠페인명과 판매처를 입력해 주세요.');
      return;
    }
    setBusy(true);
    const id = editingCampaign.id || generateSafeId('campaign');
    const isNew = !editingCampaign.id;
    const sDate = fromKSTDatetimeLocalInput(campStartLocal);
    const eDate = fromKSTDatetimeLocalInput(campEndLocal);
    try {
      const payload = {
        title: editingCampaign.title.trim().slice(0, 160),
        retailer: editingCampaign.retailer.trim().slice(0, 100),
        country: (editingCampaign.country || '한국') as DropCountry,
        saleType: (editingCampaign.saleType || '추첨 판매') as DropSaleType,
        timezoneLabel: (editingCampaign.timezoneLabel || 'KST').trim().slice(0, 40),
        startAt: sDate ? Timestamp.fromDate(sDate) : null,
        endAt: eDate ? Timestamp.fromDate(eDate) : null,
        purchaseWindowText: (editingCampaign.purchaseWindowText || '').trim().slice(0, 200),
        conditions: (editingCampaign.conditions || '').trim().slice(0, 4000),
        officialUrl: (editingCampaign.officialUrl || '').trim().slice(0, 500),
        verifiedAt: refreshCampVerified
          ? serverTimestamp()
          : editingCampaign.verifiedAt ?? null,
        isPinned: Boolean(editingCampaign.isPinned),
        isRecommended: Boolean(editingCampaign.isRecommended),
        archiveEnded: Boolean(editingCampaign.archiveEnded),
        visibilityState: (editingCampaign.visibilityState || 'published') as VisibilityState,
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        await setDoc(doc(db, 'retail_campaigns', id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'retail_campaigns', id), payload);
      }
      setEditingCampaign(null);
      showToast('추첨/판매 캠페인 그룹이 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `retail_campaigns/${id}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSyncCampaignToDrops = async (camp: RetailCampaign) => {
    const children = activeDrops.filter((d) => d.campaignId === camp.id);
    if (children.length === 0) {
      showToast('이 캠페인에 연결된 상품이 없습니다.');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      children.forEach((child) => {
        batch.update(doc(db, 'retail_drops', child.id), {
          retailer: camp.retailer,
          country: camp.country,
          saleType: camp.saleType,
          timezoneLabel: camp.timezoneLabel || 'KST',
          startAt: camp.startAt ?? null,
          endAt: camp.endAt ?? null,
          purchaseWindowText: camp.purchaseWindowText || '',
          conditions: camp.conditions || '',
          verifiedAt: camp.verifiedAt ?? serverTimestamp(),
          archiveEnded: Boolean(camp.archiveEnded),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      showToast(`소속 상품 ${children.length}건에 캠페인 일정 및 조건을 일괄 동기화했습니다.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `retail_campaigns/${camp.id}/sync`);
    } finally {
      setBusy(false);
    }
  };

  const parsedBulkLines = useMemo(() => {
    return bulkRawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const title = parts[0] || '';
        const priceNum = Number((parts[1] || '0').replace(/[^0-9.]/g, '')) || 0;
        const officialUrl = parts[2] || '';
        const imageUrl = parts[3] || '';
        const rawTcg = parts[4] || '';
        const tcg: DropTcgCategory =
          rawTcg === '원피스' || rawTcg === '포켓몬' || rawTcg === '기타 TCG'
            ? rawTcg
            : bulkTcg;
        return { title, price: priceNum, officialUrl, imageUrl, tcg };
      })
      .filter((item) => item.title && item.officialUrl);
  }, [bulkRawText, bulkTcg]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkLines.length === 0) {
      showToast('등록 가능한 줄이 없습니다. "제품명 | 가격 | 공식URL" 형식을 확인해 주세요.');
      return;
    }
    const selectedCamp = bulkCampaignId ? campaignMap.get(bulkCampaignId) : undefined;
    const retailer = (selectedCamp?.retailer || bulkRetailer).trim();
    if (!retailer) {
      showToast('판매처를 입력하거나 캠페인 그룹을 선택해 주세요.');
      return;
    }

    setBusy(true);
    try {
      const batch = writeBatch(db);
      const sDate = selectedCamp ? null : fromKSTDatetimeLocalInput(bulkStartLocal);
      const eDate = selectedCamp ? null : fromKSTDatetimeLocalInput(bulkEndLocal);
      const effectiveSaleType = selectedCamp?.saleType || bulkSaleType;
      const baseOrder = activeDrops.length + 1;

      parsedBulkLines.forEach((item, idx) => {
        const ref = doc(collection(db, 'retail_drops'), generateSafeId(`drop_${idx + 1}`));
        batch.set(ref, {
          campaignId: selectedCamp?.id || '',
          title: item.title.slice(0, 160),
          tcg: item.tcg,
          country: selectedCamp?.country || bulkCountry,
          retailer: retailer.slice(0, 100),
          saleType: effectiveSaleType,
          price: Math.max(0, item.price),
          currency: bulkCurrency,
          imageUrl: item.imageUrl.slice(0, 200000),
          officialUrl: item.officialUrl.slice(0, 500),
          timezoneLabel: (selectedCamp?.timezoneLabel || bulkTimezone || 'KST').slice(0, 40),
          startAt: selectedCamp ? selectedCamp.startAt ?? null : sDate ? Timestamp.fromDate(sDate) : null,
          endAt: selectedCamp ? selectedCamp.endAt ?? null : eDate ? Timestamp.fromDate(eDate) : null,
          purchaseWindowText: (selectedCamp?.purchaseWindowText || bulkPurchaseWindow || '').slice(0, 200),
          conditions: (selectedCamp?.conditions || bulkConditions || '').slice(0, 4000),
          manualStatus: effectiveSaleType === '일반 정가 판매' ? '재확인 필요' : 'auto',
          verifiedAt: serverTimestamp(),
          isPinned: false,
          isRecommended: false,
          archiveEnded: false,
          order: baseOrder + idx,
          visibilityState: bulkVisibility,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setBulkRawText('');
      setSubTab('drops');
      showToast(`${parsedBulkLines.length}개 정가·추첨 상품이 일괄 등록되었습니다.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'retail_drops_bulk');
    } finally {
      setBusy(false);
    }
  };

  const displayedDrops = useMemo(() => {
    return activeDrops.filter((d) => {
      if (filterCampaignId === 'standalone' && d.campaignId) return false;
      if (filterCampaignId !== 'all' && filterCampaignId !== 'standalone' && d.campaignId !== filterCampaignId) {
        return false;
      }
      if (filterSaleType !== 'all' && d.saleType !== filterSaleType) return false;
      return true;
    });
  }, [activeDrops, filterCampaignId, filterSaleType]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">정가 구매 · 추첨 통합 관리</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            추첨·일반 정가·선착순·예약 판매 게시글 및 캠페인 그룹, 일괄 등록, 종료 아카이브를 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleArchiveEndedRaffles}
            className="min-h-[38px] px-3 py-1.5 bg-[#171C23] border border-[#303741] rounded text-xs text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Archive size={13} />
            <span>종료 건 자동 아카이브</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSubTab('drops');
              openDropEditor();
            }}
            className="min-h-[38px] px-4 py-1.5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>새 상품 등록</span>
          </button>
        </div>
      </div>

      {/* Persistent action error banner */}
      {actionError && (
        <div className="border border-red-400/50 bg-red-950/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-xs text-red-200">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-200 hover:text-white shrink-0 underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* First real campaign quick DB registration banner */}
      {!rakutenExists && (
        <div className="border border-[#8068BA]/60 rounded-lg p-5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono-tabular text-[#8068BA]">FIRST CAMPAIGN SEED READY</p>
            <h2 className="text-sm font-semibold text-[#F3F4F6]">
              2026년 11월 라쿠텐북스 포켓몬·원피스 TCG 추첨 (11종)
            </h2>
            <p className="text-xs text-[#929AA6]">
              버튼을 클릭하면 캠페인 1건과 포켓몬 8종·원피스 3종 상품 및 공식 응모 링크가 기존 Firestore DB에 즉시 등록됩니다.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleSeedRakuten}
            className="min-h-[42px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 hover:bg-[#F3F4F6] disabled:opacity-50"
          >
            <Database size={14} />
            <span>라쿠텐북스 11종 DB 등록</span>
          </button>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'drops', label: `상품 목록 (${activeDrops.length})`, icon: <Pin size={13} /> },
            { id: 'campaigns', label: `캠페인 그룹 (${activeCampaigns.length})`, icon: <Layers size={13} /> },
            { id: 'bulk', label: '여러 상품 일괄 등록', icon: <ListPlus size={13} /> },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`min-h-[38px] px-4 py-1.5 rounded border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
              subTab === tab.id
                ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ================= SUBTAB 1: DROPS LIST & EDITOR ================= */}
      {subTab === 'drops' && (
        <div className="space-y-5">
          {editingDrop && (
            <form
              onSubmit={handleSaveDrop}
              className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F3F4F6]">
                  {editingDrop.id ? '정가·추첨 상품 수정' : '새 정가·추첨 상품 등록'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingDrop(null)}
                  className="text-xs text-[#929AA6] hover:text-[#F3F4F6]"
                >
                  닫기
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] text-[#929AA6] mb-1">
                    캠페인 그룹 연결 (선택 시 판매처·국가·유형·일정·참여조건이 자동 채워집니다)
                  </label>
                  <select
                    value={editingDrop.campaignId || ''}
                    onChange={(e) => handleCampaignSelectForDrop(e.target.value)}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    <option value="">연결 안 함 (단독 등록)</option>
                    {activeCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.retailer})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  required
                  placeholder="제품명 *"
                  value={editingDrop.title || ''}
                  onChange={(e) => setEditingDrop({ ...editingDrop, title: e.target.value })}
                  className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="text"
                  required
                  placeholder="판매처 * (예: 일본 라쿠텐북스, 포켓몬스토어)"
                  value={editingDrop.retailer || ''}
                  onChange={(e) => setEditingDrop({ ...editingDrop, retailer: e.target.value })}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />

                <select
                  value={editingDrop.tcg || '포켓몬'}
                  onChange={(e) =>
                    setEditingDrop({ ...editingDrop, tcg: e.target.value as DropTcgCategory })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {TCG_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={editingDrop.country || '한국'}
                  onChange={(e) =>
                    setEditingDrop({ ...editingDrop, country: e.target.value as DropCountry })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={editingDrop.saleType || '추첨 판매'}
                  onChange={(e) => {
                    const nextType = e.target.value as DropSaleType;
                    setEditingDrop({
                      ...editingDrop,
                      saleType: nextType,
                      manualStatus: nextType === '일반 정가 판매' ? '재확인 필요' : 'auto',
                    });
                  }}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {SALE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    placeholder="정가"
                    value={editingDrop.price ?? 0}
                    onChange={(e) => setEditingDrop({ ...editingDrop, price: Number(e.target.value) })}
                    className="flex-1 min-h-[40px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                  <select
                    value={editingDrop.currency || 'KRW'}
                    onChange={(e) =>
                      setEditingDrop({ ...editingDrop, currency: e.target.value as DropCurrency })
                    }
                    className="w-24 min-h-[40px] px-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    {CURRENCY_OPTIONS.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="url"
                  required
                  placeholder="공식 페이지 URL * (https://...)"
                  value={editingDrop.officialUrl || ''}
                  onChange={(e) => setEditingDrop({ ...editingDrop, officialUrl: e.target.value })}
                  className="sm:col-span-2 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />

                {/* Image upload + URL */}
                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="상품 이미지 URL (직접 입력 또는 업로드)"
                    value={editingDrop.imageUrl || ''}
                    onChange={(e) => setEditingDrop({ ...editingDrop, imageUrl: e.target.value })}
                    className="flex-1 min-w-[200px] min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                  <label className="min-h-[40px] px-3 bg-[#11151A] border border-[#303741] rounded text-xs text-[#C5CBD3] inline-flex items-center gap-1.5 cursor-pointer hover:border-[#C5CBD3]">
                    <Upload size={13} />
                    <span>{uploadingImage ? '업로드 중...' : '사진 업로드'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadDropImage(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                  {editingDrop.imageUrl && (
                    <div className="w-10 h-10 rounded border border-[#303741] overflow-hidden shrink-0">
                      <SafeImage
                        src={editingDrop.imageUrl}
                        alt="미리보기"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">
                    시작 일시 (KST/JST 기준 입력)
                  </label>
                  <input
                    type="datetime-local"
                    value={dropStartLocal}
                    onChange={(e) => setDropStartLocal(e.target.value)}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">
                    마감 일시 (KST/JST 기준 입력)
                  </label>
                  <input
                    type="datetime-local"
                    value={dropEndLocal}
                    onChange={(e) => setDropEndLocal(e.target.value)}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">표기 시간대 라벨</label>
                  <select
                    value={editingDrop.timezoneLabel || 'KST'}
                    onChange={(e) => setEditingDrop({ ...editingDrop, timezoneLabel: e.target.value })}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    <option value="KST">KST (한국)</option>
                    <option value="JST">JST (일본)</option>
                    <option value="EST">EST / ET (미국)</option>
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="당첨자 구매 기간 / 배송 메모 (선택)"
                  value={editingDrop.purchaseWindowText || ''}
                  onChange={(e) =>
                    setEditingDrop({ ...editingDrop, purchaseWindowText: e.target.value })
                  }
                  className="sm:col-span-2 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">상태 설정</label>
                  <select
                    value={editingDrop.manualStatus || 'auto'}
                    onChange={(e) =>
                      setEditingDrop({
                        ...editingDrop,
                        manualStatus: e.target.value as DropStatusOverride,
                      })
                    }
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    {STATUS_OPTIONS_BY_SALE_TYPE[(editingDrop.saleType || '추첨 판매') as DropSaleType].map(
                      (st) => (
                        <option key={st} value={st}>
                          {st === 'auto' ? '자동 (시간 기준 전환)' : st}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <textarea
                  rows={3}
                  placeholder="참여 조건 및 유의사항 (선택 · 캠페인 연결 시 공통 조건과 연동 가능)"
                  value={editingDrop.conditions || ''}
                  onChange={(e) => setEditingDrop({ ...editingDrop, conditions: e.target.value })}
                  className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />

                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-4 text-xs text-[#C5CBD3] pt-1">
                  <select
                    value={editingDrop.visibilityState || 'published'}
                    onChange={(e) =>
                      setEditingDrop({
                        ...editingDrop,
                        visibilityState: e.target.value as VisibilityState,
                      })
                    }
                    className="min-h-[36px] px-2.5 bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    <option value="published">공개</option>
                    <option value="draft">비공개(초안)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="정렬 순서"
                    value={editingDrop.order ?? 1}
                    onChange={(e) => setEditingDrop({ ...editingDrop, order: Number(e.target.value) })}
                    className="w-24 min-h-[36px] px-2.5 bg-[#080A0D] border border-[#303741] rounded font-mono-tabular text-[#F3F4F6]"
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingDrop.isPinned)}
                      onChange={(e) => setEditingDrop({ ...editingDrop, isPinned: e.target.checked })}
                    />
                    <span>상단 고정</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingDrop.isRecommended)}
                      onChange={(e) =>
                        setEditingDrop({ ...editingDrop, isRecommended: e.target.checked })
                      }
                    />
                    <span>추천 게시글</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingDrop.archiveEnded)}
                      onChange={(e) =>
                        setEditingDrop({ ...editingDrop, archiveEnded: e.target.checked })
                      }
                    />
                    <span>종료 시 아카이브 숨김</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refreshDropVerified}
                      onChange={(e) => setRefreshDropVerified(e.target.checked)}
                    />
                    <span>확인일 현재 시각으로 갱신</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDrop(null)}
                  className="px-4 py-2 text-xs border border-[#303741] rounded text-[#929AA6]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded disabled:opacity-50"
                >
                  {busy ? '저장 중...' : '상품 저장'}
                </button>
              </div>
            </form>
          )}

          {/* List Filter Controls */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterCampaignId}
              onChange={(e) => setFilterCampaignId(e.target.value)}
              className="min-h-[36px] px-3 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="all">모든 캠페인 / 단독 상품</option>
              <option value="standalone">단독 상품만</option>
              {activeCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  캠페인: {c.title}
                </option>
              ))}
            </select>
            <select
              value={filterSaleType}
              onChange={(e) => setFilterSaleType(e.target.value as 'all' | DropSaleType)}
              className="min-h-[36px] px-3 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="all">모든 판매 유형</option>
              {SALE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Drops Table/List */}
          {displayedDrops.length === 0 ? (
            <div className="border border-[#303741] rounded-lg p-8 bg-[#171C23] text-center space-y-3">
              <p className="text-sm text-[#F3F4F6]">아직 DB에 등록된 정가·추첨 상품이 없습니다.</p>
              <p className="text-xs text-[#929AA6]">
                공개 페이지에 표시 중인 라쿠텐북스 11종에 사진을 넣으려면 먼저 아래 버튼을 눌러 DB에 등록해 주세요.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {!rakutenExists && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSeedRakuten}
                    className="min-h-[38px] px-4 py-1.5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Database size={13} />
                    <span>라쿠텐북스 11종 DB 등록</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openDropEditor()}
                  className="min-h-[38px] px-4 py-1.5 border border-[#303741] rounded text-xs text-[#F3F4F6]"
                >
                  새 상품 등록
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#171C23]">
              {displayedDrops.map((d) => {
                const eff = resolveEffectiveDrop(
                  d,
                  d.campaignId ? campaignMap.get(d.campaignId) : undefined
                );
                const status = getDropStatusInfo(eff);
                return (
                  <div
                    key={d.id}
                    className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0">
                        <SafeImage
                          src={d.imageUrl}
                          alt={d.title}
                          fallbackTitle={d.tcg}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#929AA6]">
                          <span className="text-[#C5CBD3] font-medium">{d.tcg}</span>
                          <span>·</span>
                          <span>{d.country}</span>
                          <span>·</span>
                          <span>{eff.retailer}</span>
                          <span>·</span>
                          <span className="text-[#F3F4F6] font-medium">{eff.saleType}</span>
                          <span>·</span>
                          <span className="text-[#C5CBD3]">{status.label}</span>
                          {d.isPinned && <Pin size={11} className="text-[#8068BA]" />}
                          {d.isRecommended && <Sparkles size={11} className="text-[#C5CBD3]" />}
                          {d.visibilityState === 'draft' && (
                            <span className="text-amber-300">· 비공개</span>
                          )}
                          {d.archiveEnded && <span className="text-[#929AA6]">· 아카이브</span>}
                        </div>
                        <p className="text-sm font-semibold text-[#F3F4F6] truncate">{d.title}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#929AA6] font-mono-tabular">
                          <span className="text-[#C5CBD3] font-semibold">
                            {formatDropPrice(d.price, d.currency)}
                          </span>
                          {Boolean(eff.endAt) && (
                            <span>마감: {formatDropDateTime(eff.endAt, eff.timezoneLabel)}</span>
                          )}
                          <span>
                            확인:{' '}
                            {eff.verifiedAt
                              ? formatDropDateTime(eff.verifiedAt, eff.timezoneLabel)
                              : '미확인'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={d.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-[#303741] rounded text-[#C5CBD3] hover:border-[#C5CBD3]"
                        title="공식 페이지"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <label className="px-2.5 py-1.5 text-xs border border-[#8068BA]/55 bg-[#8068BA]/15 rounded text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center gap-1 cursor-pointer">
                        <Upload size={12} />
                        <span>{quickUploadingId === d.id ? '올리는 중...' : d.imageUrl ? '사진 변경' : '사진 넣기'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={quickUploadingId === d.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handleQuickRowImageUpload(d.id, f);
                          }}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateDoc(doc(db, 'retail_drops', d.id), {
                            verifiedAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                          }).then(() => showToast('마지막 정보 확인일이 갱신되었습니다.'))
                        }
                        className="px-2.5 py-1.5 text-xs border border-[#303741] rounded text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-1"
                        title="지금 확인으로 갱신"
                      >
                        <CheckCircle2 size={12} />
                        <span>확인 갱신</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateDoc(doc(db, 'retail_drops', d.id), {
                            visibilityState:
                              d.visibilityState === 'published' ? 'draft' : 'published',
                            updatedAt: serverTimestamp(),
                          })
                        }
                        className="px-2.5 py-1.5 text-xs border border-[#303741] rounded text-[#C5CBD3]"
                      >
                        {d.visibilityState === 'published' ? '비공개' : '공개'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openDropEditor(d)}
                        className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6] hover:border-[#C5CBD3]"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateDoc(doc(db, 'retail_drops', d.id), {
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= SUBTAB 2: CAMPAIGN GROUPS ================= */}
      {subTab === 'campaigns' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openCampaignEditor()}
              className="min-h-[38px] px-4 py-1.5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>새 캠페인 그룹</span>
            </button>
          </div>

          {editingCampaign && (
            <form
              onSubmit={handleSaveCampaign}
              className="border border-[#C5CBD3]/50 rounded-lg p-6 bg-[#171C23] space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F3F4F6]">
                  {editingCampaign.id ? '캠페인 그룹 수정' : '새 캠페인 그룹 생성'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="text-xs text-[#929AA6] hover:text-[#F3F4F6]"
                >
                  닫기
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="캠페인명 * (예: 2026년 11월 라쿠텐북스 포켓몬·원피스 TCG 추첨)"
                  value={editingCampaign.title || ''}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, title: e.target.value })
                  }
                  className="sm:col-span-2 min-h-[40px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="text"
                  required
                  placeholder="판매처 * (예: 일본 라쿠텐북스)"
                  value={editingCampaign.retailer || ''}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, retailer: e.target.value })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <select
                  value={editingCampaign.country || '한국'}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      country: e.target.value as DropCountry,
                    })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={editingCampaign.saleType || '추첨 판매'}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      saleType: e.target.value as DropSaleType,
                    })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {SALE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={editingCampaign.timezoneLabel || 'KST'}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, timezoneLabel: e.target.value })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  <option value="KST">KST</option>
                  <option value="JST">JST</option>
                  <option value="EST">EST / ET</option>
                </select>
                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">
                    응모·판매 시작 (KST/JST)
                  </label>
                  <input
                    type="datetime-local"
                    value={campStartLocal}
                    onChange={(e) => setCampStartLocal(e.target.value)}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#929AA6] mb-1">
                    응모 마감 (KST/JST)
                  </label>
                  <input
                    type="datetime-local"
                    value={campEndLocal}
                    onChange={(e) => setCampEndLocal(e.target.value)}
                    className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  />
                </div>
                <input
                  type="url"
                  placeholder="판매처 메인 URL (선택)"
                  value={editingCampaign.officialUrl || ''}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, officialUrl: e.target.value })
                  }
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] self-end"
                />
                <input
                  type="text"
                  placeholder="당첨자 구매 기간 (예: 2026-11-29 10:00 ~ 2026-12-03 23:59 JST)"
                  value={editingCampaign.purchaseWindowText || ''}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      purchaseWindowText: e.target.value,
                    })
                  }
                  className="sm:col-span-2 lg:col-span-3 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <textarea
                  rows={5}
                  placeholder="공통 참여 조건 및 유의사항"
                  value={editingCampaign.conditions || ''}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, conditions: e.target.value })
                  }
                  className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />

                <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-4 text-xs text-[#C5CBD3]">
                  <select
                    value={editingCampaign.visibilityState || 'published'}
                    onChange={(e) =>
                      setEditingCampaign({
                        ...editingCampaign,
                        visibilityState: e.target.value as VisibilityState,
                      })
                    }
                    className="min-h-[36px] px-2.5 bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                  >
                    <option value="published">공개</option>
                    <option value="draft">비공개</option>
                  </select>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCampaign.isPinned)}
                      onChange={(e) =>
                        setEditingCampaign({ ...editingCampaign, isPinned: e.target.checked })
                      }
                    />
                    <span>상단 고정</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCampaign.archiveEnded)}
                      onChange={(e) =>
                        setEditingCampaign({
                          ...editingCampaign,
                          archiveEnded: e.target.checked,
                        })
                      }
                    />
                    <span>종료 시 아카이브</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refreshCampVerified}
                      onChange={(e) => setRefreshCampVerified(e.target.checked)}
                    />
                    <span>확인일 현재 시각으로 갱신</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="px-4 py-2 text-xs border border-[#303741] rounded text-[#929AA6]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded disabled:opacity-50"
                >
                  캠페인 저장
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {activeCampaigns.map((camp) => {
              const linkedCount = activeDrops.filter((d) => d.campaignId === camp.id).length;
              return (
                <div
                  key={camp.id}
                  className="border border-[#303741] rounded-lg p-5 bg-[#171C23] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#929AA6]">
                      <span className="text-[#C5CBD3] font-medium">{camp.retailer}</span>
                      <span>·</span>
                      <span>{camp.country}</span>
                      <span>·</span>
                      <span>{camp.saleType}</span>
                      <span>·</span>
                      <span className="font-mono-tabular text-[#C5CBD3]">연결 상품 {linkedCount}종</span>
                      {camp.isPinned && <Pin size={12} className="text-[#8068BA]" />}
                    </div>
                    <h3 className="text-base font-semibold text-[#F3F4F6] truncate">{camp.title}</h3>
                    <p className="text-xs font-mono-tabular text-[#929AA6]">
                      기간: {formatDropDateTime(camp.startAt, camp.timezoneLabel)} ~{' '}
                      {formatDropDateTime(camp.endAt, camp.timezoneLabel)}
                      {camp.purchaseWindowText ? ` · 구매: ${camp.purchaseWindowText}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSyncCampaignToDrops(camp)}
                      className="px-3 py-1.5 text-xs border border-[#8068BA]/60 bg-[#8068BA]/15 rounded text-[#F3F4F6] inline-flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} />
                      <span>소속 상품 일괄 동기화</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCampaignEditor(camp)}
                      className="px-3 py-1.5 text-xs border border-[#303741] rounded text-[#F3F4F6]"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDoc(doc(db, 'retail_campaigns', camp.id), {
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
          </div>
        </div>
      )}

      {/* ================= SUBTAB 3: BULK IMPORT ================= */}
      {subTab === 'bulk' && (
        <form
          onSubmit={handleBulkSubmit}
          className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-[#F3F4F6]">여러 상품 일괄 등록</h2>
            <p className="text-xs text-[#929AA6] mt-1">
              한 줄에 하나씩 <code className="text-[#C5CBD3]">제품명 | 가격 | 공식URL | 이미지URL(선택) | TCG(선택)</code> 형식으로 입력하면 한 번에 등록됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[11px] text-[#929AA6] mb-1">
                대상 캠페인 그룹 (선택 시 일정·조건 상속)
              </label>
              <select
                value={bulkCampaignId}
                onChange={(e) => setBulkCampaignId(e.target.value)}
                className="w-full min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                <option value="">캠페인 없이 개별 조건으로 일괄 등록</option>
                {activeCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.retailer})
                  </option>
                ))}
              </select>
            </div>

            <select
              value={bulkTcg}
              onChange={(e) => setBulkTcg(e.target.value as DropTcgCategory)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              {TCG_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  기본 TCG: {t}
                </option>
              ))}
            </select>
            <select
              value={bulkCurrency}
              onChange={(e) => setBulkCurrency(e.target.value as DropCurrency)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  통화: {c}
                </option>
              ))}
            </select>
            <select
              value={bulkVisibility}
              onChange={(e) => setBulkVisibility(e.target.value as VisibilityState)}
              className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
            >
              <option value="published">즉시 공개</option>
              <option value="draft">초안으로 저장</option>
            </select>

            {!bulkCampaignId && (
              <>
                <input
                  type="text"
                  required
                  placeholder="판매처 * (예: 포켓몬스토어 코리아)"
                  value={bulkRetailer}
                  onChange={(e) => setBulkRetailer(e.target.value)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <select
                  value={bulkCountry}
                  onChange={(e) => setBulkCountry(e.target.value as DropCountry)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      국가: {c}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkSaleType}
                  onChange={(e) => setBulkSaleType(e.target.value as DropSaleType)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  {SALE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={bulkStartLocal}
                  onChange={(e) => setBulkStartLocal(e.target.value)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <input
                  type="datetime-local"
                  value={bulkEndLocal}
                  onChange={(e) => setBulkEndLocal(e.target.value)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <select
                  value={bulkTimezone}
                  onChange={(e) => setBulkTimezone(e.target.value)}
                  className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                >
                  <option value="KST">KST</option>
                  <option value="JST">JST</option>
                  <option value="EST">EST / ET</option>
                </select>
                <input
                  type="text"
                  placeholder="당첨 구매 기간 (선택)"
                  value={bulkPurchaseWindow}
                  onChange={(e) => setBulkPurchaseWindow(e.target.value)}
                  className="sm:col-span-2 lg:col-span-3 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
                <textarea
                  rows={2}
                  placeholder="공통 참여 조건 (선택)"
                  value={bulkConditions}
                  onChange={(e) => setBulkConditions(e.target.value)}
                  className="sm:col-span-2 lg:col-span-3 px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />
              </>
            )}
          </div>

          <textarea
            rows={7}
            value={bulkRawText}
            onChange={(e) => setBulkRawText(e.target.value)}
            placeholder={`예시:\n30th CELEBRATION BOX | 7216 | https://books.rakuten.co.jp/rb/18595282/ | | 포켓몬\nOP-17 세계 최강의 전사 | 5781 | https://books.rakuten.co.jp/rb/18669675/ | | 원피스`}
            className="w-full px-3 py-2.5 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#303741]">
            <p className="text-xs text-[#C5CBD3]">
              인식된 상품: <span className="font-mono-tabular font-semibold">{parsedBulkLines.length}</span>건
            </p>
            <button
              type="submit"
              disabled={busy || parsedBulkLines.length === 0}
              className="min-h-[42px] px-5 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold disabled:opacity-40"
            >
              {busy ? '등록 중...' : `${parsedBulkLines.length}개 상품 일괄 등록`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
