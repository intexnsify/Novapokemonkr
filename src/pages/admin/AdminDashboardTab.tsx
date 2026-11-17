import React, { useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Database,
  Download,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { deleteAllSampleData, hardDeleteDocument, seedInitialData } from '../../lib/seed';
import { formatKST, getKSTDateKey, toDateSafe } from '../../lib/utils';
import { useAdmin } from './AdminContext';

/* ============================================================================
   1. 대시보드 (요약 + 초기데이터 세팅 + SAMPLE 일괄 삭제)
============================================================================ */
export const DashboardTab: React.FC = () => {
  const {
    user,
    products,
    buybacks,
    posts,
    notices,
    events,
    sponsors,
    reviews,
    retailDrops,
    analyticsEvents,
    setActiveMenu,
    showToast,
  } = useAdmin();
  const [busy, setBusy] = useState(false);

  const todayKey = getKSTDateKey();
  const todayVisits = analyticsEvents.filter(
    (e) => e.eventType === 'page_view' && e.dateKey === todayKey
  ).length;
  const pendingBuybacks = buybacks.filter((b) => b.status === '신규' || b.status === '검토 중').length;

  const sampleCount =
    products.filter((p) => p.isSample && p.visibilityState !== 'trashed').length +
    posts.filter((p) => p.isSample && p.visibilityState !== 'trashed').length +
    notices.filter((n) => n.isSample && n.visibilityState !== 'trashed').length +
    events.filter((e) => e.isSample && e.visibilityState !== 'trashed').length +
    reviews.filter((r) => r.isSample && r.visibilityState !== 'trashed').length;

  const handleSeed = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await seedInitialData(user.uid, true);
      showToast(`초기 데이터 세팅 완료 (${res.created}개 항목 생성됨).`);
    } catch (err) {
      showToast(`세팅 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSamples = async () => {
    if (
      !window.confirm(
        `현재 SAMPLE로 표시된 ${sampleCount}개 예시 항목만 일괄 삭제합니다. REPACK 협찬 및 직접 등록한 데이터는 유지됩니다. 진행할까요?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await deleteAllSampleData();
      showToast(`SAMPLE 데이터 ${res.deleted}건이 삭제되었습니다.`);
    } catch (err) {
      showToast(`삭제 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    {
      label: '공개 상품',
      value: products.filter((p) => p.visibilityState === 'published').length,
      menu: 'products' as const,
    },
    {
      label: '대기 중인 매입 신청',
      value: pendingBuybacks,
      menu: 'buybacks' as const,
    },
    {
      label: '게시된 뉴스',
      value: posts.filter((p) => p.visibilityState === 'published').length,
      menu: 'posts' as const,
    },
    {
      label: '공지사항',
      value: notices.filter((n) => n.visibilityState === 'published').length,
      menu: 'notices' as const,
    },
    {
      label: '활성 정가·추첨',
      value: retailDrops.filter((d) => d.visibilityState === 'published').length,
      menu: 'drops' as const,
    },
    {
      label: '활성 협찬/배너',
      value: sponsors.filter((s) => s.visibilityState === 'published').length,
      menu: 'sponsors' as const,
    },
    {
      label: '오늘 페이지 조회 (KST)',
      value: todayVisits,
      menu: 'analytics' as const,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#303741] pb-5">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">관리자 대시보드</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            실시간 Firestore 데이터를 기준으로 요약 현황을 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleSeed}
            className="min-h-[40px] px-4 py-2 text-xs font-medium bg-[#171C23] border border-[#303741] rounded-md text-[#F3F4F6] hover:border-[#C5CBD3] inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Database size={14} />
            <span>초기 데이터 세팅 (REPACK · FAQ · SAMPLE)</span>
          </button>
          <button
            type="button"
            disabled={busy || sampleCount === 0}
            onClick={handleDeleteSamples}
            className="min-h-[40px] px-4 py-2 text-xs font-medium bg-red-950/40 border border-red-400/40 rounded-md text-red-200 hover:border-red-300 inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Trash2 size={14} />
            <span>SAMPLE 일괄 삭제 ({sampleCount})</span>
          </button>
        </div>
      </div>

      <div className="border border-[#8068BA]/55 rounded-lg p-5 bg-[#171C23] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono-tabular text-[#8068BA]">QUICK ACTION · 정가·추첨 사진 넣기</p>
          <p className="text-sm font-semibold text-[#F3F4F6]">
            포켓몬·원피스 정가/추첨 카드에 상품 사진 등록하기
          </p>
          <p className="text-xs text-[#929AA6]">
            [18. 정가·추첨 관리]에서 라쿠텐북스 11종을 등록하고 각 상품 옆 [사진 넣기] 버튼으로 바로 이미지를 올릴 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveMenu('drops')}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-[#F3F4F6]"
        >
          정가·추첨 사진 관리 열기 →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setActiveMenu(c.menu)}
            className="text-left border border-[#303741] rounded-lg p-5 bg-[#171C23] hover:border-[#C5CBD3]/60 transition-colors space-y-2"
          >
            <p className="text-xs text-[#929AA6]">{c.label}</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#F3F4F6]">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="border border-[#303741] rounded-lg p-5 bg-[#11151A] space-y-2">
        <p className="text-sm font-medium text-[#F3F4F6]">편집 및 게시 안내</p>
        <p className="text-xs text-[#929AA6] leading-relaxed">
          브랜드·테마·메인 구성·커뮤니티·SEO 설정을 수정한 뒤 상단의 [초안 저장]을 누르면 새로고침해도 유지됩니다. [공개 전 미리보기]로 확인한 후 [변경사항 게시]를 클릭하면 공개 사이트에 즉시 반영됩니다.
        </p>
      </div>
    </div>
  );
};

/* ============================================================================
   14. 방문 및 클릭 통계 (실제 Firestore 이벤트 기반)
============================================================================ */
export const AnalyticsTab: React.FC = () => {
  const { analyticsEvents } = useAdmin();
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
  const [customStart, setCustomStart] = useState(getKSTDateKey());
  const [customEnd, setCustomEnd] = useState(getKSTDateKey());

  const { startKey, endKey } = useMemo(() => {
    const now = new Date();
    const end = getKSTDateKey(now);
    if (range === 'today') return { startKey: end, endKey: end };
    if (range === '7d') {
      const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { startKey: getKSTDateKey(d), endKey: end };
    }
    if (range === '30d') {
      const d = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { startKey: getKSTDateKey(d), endKey: end };
    }
    return { startKey: customStart || end, endKey: customEnd || end };
  }, [range, customStart, customEnd]);

  const filteredEvents = useMemo(
    () =>
      analyticsEvents.filter((ev) => {
        if (!ev.dateKey) return false;
        return ev.dateKey >= startKey && ev.dateKey <= endKey;
      }),
    [analyticsEvents, startKey, endKey]
  );

  const pageViews = filteredEvents.filter((e) => e.eventType === 'page_view');
  const sponsorImpressions = filteredEvents.filter((e) => e.eventType === 'sponsor_impression');
  const sponsorClicks = filteredEvents.filter((e) => e.eventType === 'sponsor_click');
  const dmClicks = filteredEvents.filter((e) => e.eventType === 'dm_click');
  const emailClicks = filteredEvents.filter((e) => e.eventType === 'email_click');
  const actionClicks = filteredEvents.filter((e) => e.eventType === 'action_click');

  const pathBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    pageViews.forEach((e) => {
      map.set(e.path, (map.get(e.path) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [pageViews]);

  const sponsorBreakdown = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    sponsorImpressions.forEach((e) => {
      const label = e.targetLabel || e.targetId || '기타';
      const cur = map.get(label) || { impressions: 0, clicks: 0 };
      cur.impressions += 1;
      map.set(label, cur);
    });
    sponsorClicks.forEach((e) => {
      const label = e.targetLabel || e.targetId || '기타';
      const cur = map.get(label) || { impressions: 0, clicks: 0 };
      cur.clicks += 1;
      map.set(label, cur);
    });
    return Array.from(map.entries()).sort(
      (a, b) => b[1].clicks - a[1].clicks || b[1].impressions - a[1].impressions
    );
  }, [sponsorImpressions, sponsorClicks]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#303741] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">방문 및 클릭 통계</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            Firestore `analytics_events` 실측 기록 기반 (KST: {startKey} ~ {endKey})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: '오늘' },
              { id: '7d', label: '최근 7일' },
              { id: '30d', label: '최근 30일' },
              { id: 'custom', label: '사용자 지정' },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                range === r.id
                  ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
                  : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-4 border border-[#303741] rounded-lg bg-[#11151A]">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="min-h-[38px] px-3 py-1 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <span className="text-xs text-[#929AA6]">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="min-h-[38px] px-3 py-1 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: '페이지 조회', value: pageViews.length },
          { label: '협찬 배너 노출', value: sponsorImpressions.length },
          { label: '협찬 배너 클릭', value: sponsorClicks.length },
          { label: 'Instagram DM 클릭', value: dmClicks.length },
          { label: '이메일 문의 클릭', value: emailClicks.length },
          { label: '액션/커뮤니티 클릭', value: actionClicks.length },
        ].map((stat) => (
          <div key={stat.label} className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-1">
            <p className="text-xs text-[#929AA6]">{stat.label}</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#F3F4F6]">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-4">
          <h2 className="text-sm font-semibold text-[#F3F4F6]">경로별 방문 수</h2>
          {pathBreakdown.length === 0 ? (
            <p className="text-xs text-[#929AA6] py-6 text-center">선택한 기간에 데이터 없음</p>
          ) : (
            <div className="divide-y divide-[#303741] text-xs">
              {pathBreakdown.map(([p, count]) => (
                <div key={p} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="font-mono-tabular text-[#F3F4F6] truncate">{p}</span>
                  <span className="font-mono-tabular text-[#C5CBD3] font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#F3F4F6]">협찬 &amp; 파트너 성과 (실측)</h2>
            <span className="text-[11px] text-[#929AA6]">노출 · 클릭 · CTR</span>
          </div>
          {sponsorBreakdown.length === 0 ? (
            <p className="text-xs text-[#929AA6] py-6 text-center">선택한 기간에 데이터 없음</p>
          ) : (
            <div className="divide-y divide-[#303741] text-xs">
              {sponsorBreakdown.map(([label, stats]) => {
                const ctr =
                  stats.impressions > 0
                    ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)}%`
                    : '-';
                return (
                  <div key={label} className="py-2.5 flex items-center justify-between gap-4">
                    <span className="text-[#F3F4F6] truncate">{label}</span>
                    <div className="flex items-center gap-3 font-mono-tabular shrink-0">
                      <span className="text-[#929AA6]">노출 {stats.impressions}</span>
                      <span className="text-[#C5CBD3] font-semibold">클릭 {stats.clicks}</span>
                      <span className="text-[#929AA6]">CTR {ctr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   16. 백업 및 데이터 관리 (JSON 내보내기/복원 + 휴지통 복구)
============================================================================ */
export const BackupTab: React.FC = () => {
  const {
    user,
    draftConfig,
    products,
    posts,
    notices,
    events,
    sponsors,
    reviews,
    faqs,
    retailCampaigns,
    retailDrops,
    showToast,
  } = useAdmin();
  const [busy, setBusy] = useState(false);

  const trashedItems = useMemo(() => {
    const items: { collection: string; id: string; title: string; updatedAt: unknown }[] = [];
    products
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'products', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    posts
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'posts', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    notices
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'notices', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    events
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'events', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    sponsors
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'sponsors', id: i.id, title: i.name, updatedAt: i.updatedAt }));
    reviews
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'reviews', id: i.id, title: i.authorName, updatedAt: i.updatedAt }));
    faqs
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'faqs', id: i.id, title: i.question, updatedAt: i.updatedAt }));
    retailCampaigns
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'retail_campaigns', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    retailDrops
      .filter((i) => i.visibilityState === 'trashed')
      .forEach((i) => items.push({ collection: 'retail_drops', id: i.id, title: i.title, updatedAt: i.updatedAt }));
    return items;
  }, [products, posts, notices, events, sponsors, reviews, faqs, retailCampaigns, retailDrops]);

  const serializeDocs = (arr: Record<string, unknown>[]) =>
    arr.map((item) => {
      const copy: Record<string, unknown> = { ...item };
      ['createdAt', 'updatedAt', 'scheduledAt', 'startAt', 'endAt', 'verifiedAt'].forEach((k) => {
        const d = toDateSafe(copy[k]);
        if (d) copy[k] = d.toISOString();
      });
      return copy;
    });

  const handleExportJson = async () => {
    setBusy(true);
    try {
      const buybackSnap = await getDocs(collection(db, 'buyback_requests'));
      const buybackList = buybackSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const payload = {
        exportedAt: new Date().toISOString(),
        version: 'nova-backup-v1',
        siteConfigDraft: draftConfig,
        collections: {
          products: serializeDocs(products as unknown as Record<string, unknown>[]),
          posts: serializeDocs(posts as unknown as Record<string, unknown>[]),
          notices: serializeDocs(notices as unknown as Record<string, unknown>[]),
          events: serializeDocs(events as unknown as Record<string, unknown>[]),
          sponsors: serializeDocs(sponsors as unknown as Record<string, unknown>[]),
          reviews: serializeDocs(reviews as unknown as Record<string, unknown>[]),
          faqs: serializeDocs(faqs as unknown as Record<string, unknown>[]),
          retail_campaigns: serializeDocs(retailCampaigns as unknown as Record<string, unknown>[]),
          retail_drops: serializeDocs(retailDrops as unknown as Record<string, unknown>[]),
          buyback_requests: serializeDocs(buybackList),
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nova-backup-${getKSTDateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('전체 데이터 JSON 백업 파일을 다운로드했습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'backup_export');
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;

    if (!window.confirm('선택한 JSON 백업 파일로 데이터를 복원/덮어쓰기 합니다. 계속할까요?')) {
      return;
    }

    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.collections || typeof parsed.collections !== 'object') {
        throw new Error('올바른 NOVA 백업 JSON 형식이 아닙니다.');
      }

      if (parsed.siteConfigDraft) {
        await setDoc(doc(db, 'site_config', 'draft'), {
          ...parsed.siteConfigDraft,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }

      const restoreCollection = async (colName: string, list: Record<string, unknown>[]) => {
        for (const item of list) {
          const { id, ...rest } = item;
          if (typeof id !== 'string' || !id) continue;
          const payload: Record<string, unknown> = { ...rest };
          ['scheduledAt', 'startAt', 'endAt', 'verifiedAt'].forEach((k) => {
            if (typeof payload[k] === 'string') {
              const d = new Date(payload[k] as string);
              if (!Number.isNaN(d.getTime())) payload[k] = Timestamp.fromDate(d);
            }
          });
          payload.createdAt = serverTimestamp();
          payload.updatedAt = serverTimestamp();
          await setDoc(doc(db, colName, id), payload);
        }
      };

      const cols = parsed.collections;
      if (Array.isArray(cols.products)) await restoreCollection('products', cols.products);
      if (Array.isArray(cols.posts)) await restoreCollection('posts', cols.posts);
      if (Array.isArray(cols.notices)) await restoreCollection('notices', cols.notices);
      if (Array.isArray(cols.events)) await restoreCollection('events', cols.events);
      if (Array.isArray(cols.sponsors)) await restoreCollection('sponsors', cols.sponsors);
      if (Array.isArray(cols.reviews)) await restoreCollection('reviews', cols.reviews);
      if (Array.isArray(cols.faqs)) await restoreCollection('faqs', cols.faqs);
      if (Array.isArray(cols.retail_campaigns)) {
        await restoreCollection('retail_campaigns', cols.retail_campaigns);
      }
      if (Array.isArray(cols.retail_drops)) {
        await restoreCollection('retail_drops', cols.retail_drops);
      }

      showToast('JSON 백업 데이터 복원이 완료되었습니다. 필요 시 [변경사항 게시]를 눌러주세요.');
    } catch (err) {
      showToast(`복원 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreTrash = async (colName: string, id: string) => {
    try {
      await updateDoc(doc(db, colName, id), {
        visibilityState: 'draft',
        updatedAt: serverTimestamp(),
      });
      showToast('항목이 초안(Draft) 상태로 복구되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${colName}/${id}`);
    }
  };

  const handlePermanentDelete = async (colName: string, id: string) => {
    if (!window.confirm('영구 삭제하면 복구할 수 없습니다. 진행할까요?')) return;
    await hardDeleteDocument(colName, id);
    showToast('영구 삭제되었습니다.');
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">백업 및 데이터 관리</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          JSON 데이터 내보내기/복원 및 휴지통 삭제 항목 복구를 관리합니다.
        </p>
      </div>

      {/* Data vs Image Backup Explanation */}
      <div className="border border-[#303741] rounded-lg p-5 bg-[#11151A] flex items-start gap-3">
        <AlertTriangle size={18} className="text-[#8068BA] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#929AA6] leading-relaxed">
          <p className="text-sm font-medium text-[#F3F4F6]">데이터 백업과 이미지 파일 백업의 차이 안내</p>
          <p>
            JSON 내보내기는 텍스트, 가격, 설정 구조, 그리고 Firebase Storage 이미지의 다운로드 URL을 백업합니다. 업로드된 원본 이미지 바이너리 파일 자체는 Firebase Storage 버킷에 보관되므로, Storage 파일을 삭제하면 기존 JSON의 URL이 깨질 수 있습니다.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={handleExportJson}
          className="min-h-[44px] px-5 py-2.5 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#F3F4F6] disabled:opacity-50"
        >
          <Download size={16} />
          <span>전체 JSON 백업 다운로드</span>
        </button>

        <label className="min-h-[44px] px-5 py-2.5 bg-[#171C23] border border-[#303741] text-[#F3F4F6] rounded-md text-sm font-medium inline-flex items-center gap-2 hover:border-[#C5CBD3] cursor-pointer">
          <Upload size={16} />
          <span>JSON 백업 파일에서 복원</span>
          <input type="file" accept="application/json" onChange={handleImportJson} className="sr-only" />
        </label>
      </div>

      {/* Trash Recovery */}
      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#F3F4F6]">휴지통 ({trashedItems.length})</h2>
          <span className="text-xs text-[#929AA6]">삭제된 항목을 초안 상태로 복구하거나 영구 삭제합니다</span>
        </div>

        {trashedItems.length === 0 ? (
          <p className="text-xs text-[#929AA6] py-6 text-center">휴지통이 비어 있습니다.</p>
        ) : (
          <div className="divide-y divide-[#303741]">
            {trashedItems.map((item) => (
              <div
                key={`${item.collection}_${item.id}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#929AA6]">
                    {item.collection} · {formatKST(item.updatedAt)}
                  </p>
                  <p className="text-sm font-medium text-[#F3F4F6] truncate">{item.title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestoreTrash(item.collection, item.id)}
                    className="min-h-[36px] px-3 py-1.5 text-xs border border-[#303741] rounded text-[#C5CBD3] hover:border-[#C5CBD3] inline-flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>복구</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(item.collection, item.id)}
                    className="min-h-[36px] px-3 py-1.5 text-xs border border-red-400/40 rounded text-red-200 hover:border-red-300 inline-flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>영구 삭제</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   17. 관리자 설정 (UID 기반 관리자 허용 목록)
============================================================================ */
export const AdminsTab: React.FC = () => {
  const { user, admins, showToast } = useAdmin();
  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanUid = newUid.trim();
    const cleanEmail = newEmail.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
      showToast('올바른 Firebase Auth UID 형식을 입력해 주세요 (영문/숫자/_/-).');
      return;
    }
    if (!cleanEmail) {
      showToast('관리자 참고용 이메일을 입력해 주세요.');
      return;
    }

    setBusy(true);
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: cleanEmail,
        label: newLabel.trim() || '운영 관리자',
        role: 'admin',
        addedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewUid('');
      setNewEmail('');
      setNewLabel('');
      showToast('새 관리자 UID가 허용 목록에 추가되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `admins/${cleanUid}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAdmin = async (targetUid: string) => {
    if (targetUid === user?.uid) {
      showToast('현재 로그인한 본인 계정은 보안상 제거할 수 없습니다.');
      return;
    }
    if (!window.confirm(`UID(${targetUid})의 관리자 권한을 회수할까요?`)) return;
    try {
      await deleteDoc(doc(db, 'admins', targetUid));
      showToast('관리자 권한이 제거되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${targetUid}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-[#303741] pb-4">
        <h1 className="text-xl font-semibold text-[#F3F4F6]">관리자 설정 (UID 허용 목록)</h1>
        <p className="text-xs text-[#929AA6] mt-1">
          Firestore `admins/&#123;uid&#125;` 문서 존재 여부로 서버 측 보안 규칙(firestore.rules)에서 직접 권한을 검증합니다.
        </p>
      </div>

      <form
        onSubmit={handleAddAdmin}
        className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4"
      >
        <h2 className="text-sm font-semibold text-[#F3F4F6] flex items-center gap-2">
          <UserPlus size={16} />
          <span>새 관리자 UID 등록</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            required
            value={newUid}
            onChange={(e) => setNewUid(e.target.value)}
            placeholder="Firebase Auth UID"
            className="min-h-[42px] px-3 py-2 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="이메일 (참고 표기용)"
            className="min-h-[42px] px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="메모 (예: 매입 담당자)"
            className="min-h-[42px] px-3 py-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[40px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F3F4F6] disabled:opacity-50"
        >
          <Plus size={14} />
          <span>관리자 추가</span>
        </button>
      </form>

      <div className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">등록된 관리자 목록 ({admins.length})</h2>
        <div className="divide-y divide-[#303741]">
          {admins.map((a) => (
            <div
              key={a.uid}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#F3F4F6]">{a.email}</span>
                  {a.uid === user?.uid && (
                    <span className="text-[11px] font-mono-tabular text-[#8068BA]">현재 로그인</span>
                  )}
                </div>
                <p className="text-xs font-mono-tabular text-[#929AA6] truncate">
                  UID: {a.uid} {a.label ? `· ${a.label}` : ''}
                </p>
              </div>
              {a.uid !== user?.uid && (
                <button
                  type="button"
                  onClick={() => handleRemoveAdmin(a.uid)}
                  className="min-h-[36px] px-3 py-1.5 text-xs border border-red-400/40 rounded text-red-200 hover:border-red-300 shrink-0"
                >
                  권한 제거
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
