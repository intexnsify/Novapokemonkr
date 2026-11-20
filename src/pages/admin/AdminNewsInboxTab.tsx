import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  FileEdit,
  Globe,
  ImageIcon,
  Info,
  Pin,
  Plus,
  RefreshCw,
  Rss,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { db, explainFirestoreError } from '../../lib/firebase';
import {
  clearLocalDraft,
  getActiveEditingItemId,
  listDirtyLocalDraftIds,
  setActiveEditingItemId,
} from '../../lib/newsDraftStore';
import { sanitizeGalleryImages } from '../../lib/newsImages';
import {
  formatKST,
  generateSafeId,
  isValidExternalUrl,
  toDateSafe,
} from '../../lib/utils';
import {
  NewsInboxItem,
  NewsInboxStatus,
  NewsSource,
  NewsSourceType,
  NewsTcgCategory,
} from '../../types/nova';
import { SafeImage } from '../../components/SafeImage';
import firebaseConfig from '../../../firebase-applet-config.json';
import { useAdmin } from './AdminContext';
import { NewsArticleEditor } from './NewsArticleEditor';

interface ServerCapabilities {
  ok: boolean;
  aiDraftAvailable: boolean;
  cronAuthConfigured: boolean;
  netlifyBlobsAvailable?: boolean;
  runtime?: string;
}

interface SyncResponse {
  ok: boolean;
  trigger?: string;
  checkedSources?: number;
  newCount?: number;
  skippedDuplicates?: number;
  duplicateCandidateCount?: number;
  errorCount?: number;
  errors?: string[];
  error?: string;
  syncedAt?: string;
}

interface TestSourceResponse {
  ok: boolean;
  detectedType?: string;
  itemCount?: number;
  sampleTitles?: string[];
  error?: string;
}

interface ProbeComparisonRow {
  label: string;
  ok: boolean;
  status: string;
  detail?: string;
}

interface AuthDiagnosisReport {
  checkedAt: string;
  tokenSummary?: {
    present: boolean;
    length: number;
    jwtSegments: number;
    sameTokenUsedForRest: boolean;
    authHeaderFormatValid: boolean;
    uid: string;
    email: string;
    emailVerified: boolean;
    isBootstrapAdmin: boolean;
    projectId: string;
    databaseId: string;
  };
  webSdkProbes: ProbeComparisonRow[];
  serverRestProbes: ProbeComparisonRow[];
  error?: string;
}

interface FetchFeedsEntry {
  title: string;
  url: string;
  publishedAt: string;
  author: string;
  snippet: string;
  imageUrl: string;
  docId: string;
  canonicalUrlKey: string;
  tcgCategory: NewsTcgCategory;
}

interface FetchFeedsSourceResult {
  id: string;
  name: string;
  ok: boolean;
  status: 'ok' | 'error' | 'no_public_feed' | 'idle';
  detectedType?: 'rss' | 'atom' | 'json' | 'html_not_feed' | 'error';
  entries: FetchFeedsEntry[];
  error?: string;
}

const TCG_CATEGORIES: NewsTcgCategory[] = ['포켓몬 TCG', '원피스 TCG', '기타 TCG'];

const FALLBACK_BUILTIN_SOURCES: NewsSource[] = [
  {
    id: 'src_pokebeach',
    name: 'PokeBeach',
    siteUrl: 'https://www.pokebeach.com/',
    feedUrl: 'https://kaprestridge.github.io/pokebeach-news-feed/feed.xml',
    sourceType: 'rss',
    tcgCategory: '포켓몬 TCG',
    enabled: true,
    isBuiltIn: true,
    lastStatus: 'idle',
  },
  {
    id: 'src_pokemon_official',
    name: 'Pokémon 공식 뉴스',
    siteUrl: 'https://www.pokemon.com/us/pokemon-news',
    feedUrl: '',
    sourceType: 'manual_only',
    tcgCategory: '포켓몬 TCG',
    enabled: true,
    isBuiltIn: true,
    lastStatus: 'no_public_feed',
    lastError:
      '공식 사이트가 공개 RSS/Atom/JSON 피드를 제공하지 않습니다. 비인가 크롤링·우회를 수행하지 않으며, 공개 피드 URL을 확인하면 직접 연결할 수 있습니다.',
  },
  {
    id: 'src_onepiece_official',
    name: 'ONE PIECE 카드게임 공식 뉴스',
    siteUrl: 'https://en.onepiece-cardgame.com/topics/',
    feedUrl: '',
    sourceType: 'manual_only',
    tcgCategory: '원피스 TCG',
    enabled: true,
    isBuiltIn: true,
    lastStatus: 'no_public_feed',
    lastError:
      '공식 사이트가 공개 RSS/Atom/JSON 피드를 제공하지 않습니다. 비인가 크롤링·우회를 수행하지 않으며, 공개 피드 URL을 확인하면 직접 연결할 수 있습니다.',
  },
];

export const AdminNewsInboxTab: React.FC = () => {
  const { user, newsSources, newsInbox, newsSyncState, showToast } = useAdmin();

  const [subTab, setSubTab] = useState<'inbox' | 'sources'>('inbox');
  const [statusFilter, setStatusFilter] = useState<NewsInboxStatus>('pending');
  const [categoryFilter, setCategoryFilter] = useState<'전체' | NewsTcgCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  // Focused Single-Article Editor state (restored across refresh via storage)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() =>
    getActiveEditingItemId()
  );
  const [dirtyDraftIds, setDirtyDraftIds] = useState<Set<string>>(() =>
    listDirtyLocalDraftIds()
  );

  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncBanner, setLastSyncBanner] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisReport, setDiagnosisReport] = useState<AuthDiagnosisReport | null>(null);
  const [busyListItemId, setBusyListItemId] = useState<string | null>(null);

  // New source form
  const [newSrcName, setNewSrcName] = useState('');
  const [newSrcSiteUrl, setNewSrcSiteUrl] = useState('');
  const [newSrcFeedUrl, setNewSrcFeedUrl] = useState('');
  const [newSrcCategory, setNewSrcCategory] = useState<NewsTcgCategory>('포켓몬 TCG');
  const [testingFeed, setTestingFeed] = useState(false);
  const [testResult, setTestResult] = useState<TestSourceResponse | null>(null);
  const [savingSource, setSavingSource] = useState(false);

  // Inline feed URL edit for existing sources
  const [feedUrlDrafts, setFeedUrlDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetch('/api/news/capabilities')
      .then((r) => r.json())
      .then((data: ServerCapabilities) => {
        if (active && data?.ok) setCapabilities(data);
      })
      .catch(() => {
        // Non-fatal in static-only preview
      });
    return () => {
      active = false;
    };
  }, []);

  // Keep dirty draft badge indicators fresh when returning to the list or inbox updates
  useEffect(() => {
    setDirtyDraftIds(listDirtyLocalDraftIds());
  }, [newsInbox, selectedItemId]);

  const selectedItem = useMemo(
    () => (selectedItemId ? newsInbox.find((i) => i.id === selectedItemId) ?? null : null),
    [newsInbox, selectedItemId]
  );

  const handleOpenEditor = useCallback((item: NewsInboxItem) => {
    setSubTab('inbox');
    setSelectedItemId(item.id);
    setActiveEditingItemId(item.id);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setSelectedItemId(null);
    setActiveEditingItemId(null);
    setDirtyDraftIds(listDirtyLocalDraftIds());
  }, []);

  const displaySources = useMemo(() => {
    const byId = new Set(newsSources.map((s) => s.id));
    const missingBuiltIns = FALLBACK_BUILTIN_SOURCES.filter((b) => !byId.has(b.id));
    return [...newsSources, ...missingBuiltIns];
  }, [newsSources]);

  const counts = useMemo(() => {
    return {
      pending: newsInbox.filter((i) => i.status === 'pending').length,
      approved: newsInbox.filter((i) => i.status === 'approved').length,
      ignored: newsInbox.filter((i) => i.status === 'ignored').length,
    };
  }, [newsInbox]);

  const filteredInbox = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...newsInbox]
      .filter((item) => {
        if (item.status !== statusFilter) return false;
        if (categoryFilter !== '전체' && item.tcgCategory !== categoryFilter) return false;
        if (!q) return true;
        return (
          item.originalTitle.toLowerCase().includes(q) ||
          (item.koreanTitle || '').toLowerCase().includes(q) ||
          item.sourceName.toLowerCase().includes(q) ||
          (item.novaSummary || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const pa = toDateSafe(a.publishedAtSource)?.getTime() ?? toDateSafe(a.fetchedAt)?.getTime() ?? 0;
        const pb = toDateSafe(b.publishedAtSource)?.getTime() ?? toDateSafe(b.fetchedAt)?.getTime() ?? 0;
        return pb - pa;
      });
  }, [newsInbox, statusFilter, categoryFilter, searchQuery]);

  const runAuthAndPermissionDiagnosis = async (tokenOverride?: string): Promise<AuthDiagnosisReport | null> => {
    if (!user) return null;
    setDiagnosing(true);
    try {
      const token = tokenOverride || (await user.getIdToken(true));

      const webSdkProbes: ProbeComparisonRow[] = [];
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        webSdkProbes.push({
          label: `admins/${user.uid} 단일 문서 조회 (Web SDK)`,
          ok: adminSnap.exists(),
          status: adminSnap.exists() ? '200 OK' : '404 없음',
          detail: adminSnap.exists()
            ? `role=${String(adminSnap.data()?.role || '-')}`
            : 'admins 문서 없음 (부트스트랩 이메일 Fallback)',
        });
      } catch (err) {
        webSdkProbes.push({
          label: `admins/${user.uid} 단일 문서 조회 (Web SDK)`,
          ok: false,
          status: 'PERMISSION_DENIED',
          detail: err instanceof Error ? err.message : String(err),
        });
      }

      for (const colName of ['news_sources', 'news_inbox'] as const) {
        try {
          const snap = await getDocs(collection(db, colName));
          webSdkProbes.push({
            label: `${colName} 목록 조회 (Web SDK)`,
            ok: true,
            status: '200 OK',
            detail: `${snap.size}건 조회`,
          });
        } catch (err) {
          webSdkProbes.push({
            label: `${colName} 목록 조회 (Web SDK)`,
            ok: false,
            status: 'PERMISSION_DENIED',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }

      try {
        const pubSnap = await getDocs(
          query(collection(db, 'posts'), where('visibilityState', '==', 'published'))
        );
        webSdkProbes.push({
          label: 'posts 공개글 필터 조회 (Web SDK)',
          ok: true,
          status: '200 OK',
          detail: `${pubSnap.size}건 조회`,
        });
      } catch (err) {
        webSdkProbes.push({
          label: 'posts 공개글 필터 조회 (Web SDK)',
          ok: false,
          status: 'PERMISSION_DENIED',
          detail: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        const stateSnap = await getDoc(doc(db, 'news_sync_state', 'global'));
        webSdkProbes.push({
          label: 'news_sync_state/global 조회 (Web SDK)',
          ok: true,
          status: stateSnap.exists() ? '200 OK' : '404 초기 미생성(정상)',
          detail: `Web SDK 대상: ${firebaseConfig.projectId} / ${firebaseConfig.firestoreDatabaseId}`,
        });
      } catch (err) {
        webSdkProbes.push({
          label: 'news_sync_state/global 조회 (Web SDK)',
          ok: false,
          status: 'PERMISSION_DENIED',
          detail: err instanceof Error ? err.message : String(err),
        });
      }

      const res = await fetch('/api/news/diagnose-auth', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        tokenSummary?: AuthDiagnosisReport['tokenSummary'];
        probes?: Array<{
          label: string;
          method: string;
          endpoint: string;
          ok: boolean;
          status: number;
          count?: number;
          error?: string;
        }>;
      };

      const serverRestProbes: ProbeComparisonRow[] = Array.isArray(data.probes)
        ? data.probes.map((p) => ({
            label: `${p.label} [${p.method} ${p.endpoint}]`,
            ok: p.ok,
            status: `${p.status}`,
            detail: p.ok ? `${p.count ?? 0}건` : p.error || '오류',
          }))
        : [
            {
              label: '서버 진단 요청',
              ok: false,
              status: `${res.status}`,
              detail: data.error || '서버 진단 응답 실패',
            },
          ];

      const report: AuthDiagnosisReport = {
        checkedAt: new Date().toISOString(),
        tokenSummary: data.tokenSummary,
        webSdkProbes,
        serverRestProbes,
        error: !res.ok ? data.error : undefined,
      };
      setDiagnosisReport(report);
      return report;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const report: AuthDiagnosisReport = {
        checkedAt: new Date().toISOString(),
        webSdkProbes: [],
        serverRestProbes: [],
        error: msg,
      };
      setDiagnosisReport(report);
      return report;
    } finally {
      setDiagnosing(false);
    }
  };

  const syncViaWebSdkWithServerFeeds = async (token: string): Promise<SyncResponse> => {
    const [sourcesSnap, inboxSnap, publishedPostsSnap, stateSnap] = await Promise.all([
      getDocs(collection(db, 'news_sources')),
      getDocs(collection(db, 'news_inbox')),
      getDocs(query(collection(db, 'posts'), where('visibilityState', '==', 'published'))),
      getDoc(doc(db, 'news_sync_state', 'global')),
    ]);

    const existingSourceIds = new Set(sourcesSnap.docs.map((d) => d.id));
    const sourceMap = new Map<string, NewsSource>();
    for (const d of sourcesSnap.docs) {
      sourceMap.set(d.id, { id: d.id, ...(d.data() as Omit<NewsSource, 'id'>) });
    }
    for (const def of FALLBACK_BUILTIN_SOURCES) {
      if (!sourceMap.has(def.id)) {
        sourceMap.set(def.id, { ...def });
      }
    }

    const activeSources = Array.from(sourceMap.values()).filter((s) => s.enabled);

    const feedRes = await fetch('/api/news/fetch-feeds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sources: activeSources.map((s) => ({
          id: s.id,
          name: s.name,
          feedUrl: s.feedUrl || '',
          sourceType: s.sourceType,
          tcgCategory: s.tcgCategory,
          enabled: s.enabled,
          lastError: s.lastError || '',
        })),
      }),
    });
    const feedJson = (await feedRes.json()) as {
      ok?: boolean;
      error?: string;
      results?: FetchFeedsSourceResult[];
    };
    if (!feedRes.ok || !feedJson.ok || !Array.isArray(feedJson.results)) {
      throw new Error(feedJson.error || `피드 수집 API 오류 (${feedRes.status})`);
    }

    const knownUrlKeys = new Set<string>();
    const knownInboxIds = new Set<string>();
    const knownPublishedPostIds = new Set<string>();

    const normalizeClientUrl = (raw: string) => {
      try {
        const u = new URL(raw.trim());
        u.hash = '';
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        const p = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname;
        return `${u.protocol}//${host}${p}${u.search}`.slice(0, 480);
      } catch {
        return raw.trim().toLowerCase().slice(0, 480);
      }
    };

    const tokenizeTitle = (title: string): Set<string> => {
      const stop = new Set(['the', 'and', 'for', 'with', 'from', 'new', 'news', 'pokemon', 'pokémon', 'one', 'piece', 'tcg', 'card', 'cards']);
      return new Set(
        title
          .toLowerCase()
          .replace(/['’"]/g, '')
          .replace(/[^a-z0-9가-힣]+/g, ' ')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3 && !stop.has(t))
      );
    };

    interface PoolEntry {
      id: string;
      title: string;
      sourceId: string;
      sourceName: string;
      publishedMs: number;
      tokens: Set<string>;
    }
    const candidatePool: PoolEntry[] = [];

    for (const d of inboxSnap.docs) {
      knownInboxIds.add(d.id);
      const data = d.data() as Partial<NewsInboxItem>;
      if (data.canonicalUrlKey) knownUrlKeys.add(data.canonicalUrlKey);
      if (data.originalUrl) knownUrlKeys.add(normalizeClientUrl(data.originalUrl));
      if (data.publishedPostId) knownPublishedPostIds.add(data.publishedPostId);
      if (data.originalTitle) {
        candidatePool.push({
          id: d.id,
          title: data.originalTitle,
          sourceId: data.sourceId || '',
          sourceName: data.sourceName || '',
          publishedMs: data.publishedAtSource ? new Date(data.publishedAtSource).getTime() || 0 : 0,
          tokens: tokenizeTitle(data.originalTitle),
        });
      }
    }

    for (const d of publishedPostsSnap.docs) {
      if (knownPublishedPostIds.has(d.id)) continue;
      const data = d.data() as { sourceUrl?: string; title?: string; sourceName?: string; publishedAtSource?: string };
      if (data.sourceUrl) knownUrlKeys.add(normalizeClientUrl(data.sourceUrl));
      if (data.title) {
        candidatePool.push({
          id: d.id,
          title: data.title,
          sourceId: `post_${d.id}`,
          sourceName: data.sourceName || '기존 NOVA 게시물',
          publishedMs: data.publishedAtSource ? new Date(data.publishedAtSource).getTime() || 0 : 0,
          tokens: tokenizeTitle(data.title),
        });
      }
    }

    const findDupCandidate = (title: string, sourceId: string, publishedAt: string) => {
      const norm = title.trim().toLowerCase();
      const tokens = tokenizeTitle(title);
      const pubMs = publishedAt ? new Date(publishedAt).getTime() || 0 : 0;
      for (const ex of candidatePool) {
        if (ex.sourceId === sourceId) continue;
        if (pubMs > 0 && ex.publishedMs > 0 && Math.abs(pubMs - ex.publishedMs) > 14 * 86400_000) continue;
        if (ex.title.trim().toLowerCase() === norm) {
          return {
            id: ex.id,
            note: `중복 후보: '${ex.sourceName}'의 기존 기사("${ex.title.slice(0, 60)}")와 제목이 동일합니다.`,
          };
        }
        if (tokens.size < 2 || ex.tokens.size < 2) continue;
        let overlap = 0;
        for (const t of tokens) if (ex.tokens.has(t)) overlap += 1;
        const jaccard = overlap / (tokens.size + ex.tokens.size - overlap);
        if (jaccard >= 0.45 || overlap >= 3) {
          return {
            id: ex.id,
            note: `중복 후보: '${ex.sourceName}'의 기존 기사("${ex.title.slice(0, 60)}")와 유사한 주제입니다.`,
          };
        }
      }
      return null;
    };

    type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;
    const ops: BatchOp[] = [];
    const errors: string[] = [];
    let newCount = 0;
    let skippedDuplicates = 0;
    let duplicateCandidateCount = 0;

    for (const res of feedJson.results) {
      const src = sourceMap.get(res.id);
      if (!src) continue;
      const isNewSrc = !existingSourceIds.has(src.id);

      if (!res.ok) {
        if (res.status === 'error') {
          errors.push(`${src.name}: ${res.error || '피드 조회 실패'}`.slice(0, 390));
        }
        const ref = doc(db, 'news_sources', src.id);
        if (isNewSrc) {
          ops.push((b) =>
            b.set(ref, {
              name: src.name.slice(0, 100),
              siteUrl: src.siteUrl.slice(0, 500),
              feedUrl: (src.feedUrl || '').slice(0, 500),
              sourceType: src.sourceType,
              tcgCategory: src.tcgCategory,
              enabled: src.enabled,
              isBuiltIn: Boolean(src.isBuiltIn),
              lastCheckedAt: serverTimestamp(),
              lastSuccessAt: null,
              lastStatus: res.status,
              lastError: (res.error || '').slice(0, 490),
              lastFetchedCount: 0,
              lastNewCount: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          ops.push((b) =>
            b.update(ref, {
              lastCheckedAt: serverTimestamp(),
              lastStatus: res.status,
              lastError: (res.error || '').slice(0, 490),
              lastFetchedCount: 0,
              lastNewCount: 0,
              updatedAt: serverTimestamp(),
            })
          );
        }
        continue;
      }

      let sourceNew = 0;
      for (const entry of res.entries) {
        if (
          knownInboxIds.has(entry.docId) ||
          knownUrlKeys.has(entry.canonicalUrlKey) ||
          knownUrlKeys.has(normalizeClientUrl(entry.url))
        ) {
          skippedDuplicates += 1;
          continue;
        }
        knownInboxIds.add(entry.docId);
        knownUrlKeys.add(entry.canonicalUrlKey);
        knownUrlKeys.add(normalizeClientUrl(entry.url));

        const dup = findDupCandidate(entry.title, src.id, entry.publishedAt);
        if (dup) duplicateCandidateCount += 1;

        const inboxRef = doc(db, 'news_inbox', entry.docId);
        ops.push((b) =>
          b.set(inboxRef, {
            sourceId: src.id,
            sourceName: src.name.slice(0, 95),
            originalTitle: entry.title.slice(0, 290),
            originalUrl: entry.url.slice(0, 490),
            canonicalUrlKey: entry.canonicalUrlKey.slice(0, 490),
            publishedAtSource: (entry.publishedAt || '').slice(0, 75),
            tcgCategory: entry.tcgCategory,
            metadataAuthor: (entry.author || '').slice(0, 95),
            metadataSnippet: (entry.snippet || '').slice(0, 290),
            metadataImageUrl: (entry.imageUrl || '').slice(0, 490),
            duplicateCandidateOf: dup ? dup.id : '',
            duplicateSimilarityNote: dup ? dup.note.slice(0, 290) : '',
            koreanTitle: '',
            novaSummary: '',
            coverImage: '',
            isPinned: false,
            status: 'pending',
            publishedPostId: '',
            aiDraftGenerated: false,
            fetchedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        candidatePool.push({
          id: entry.docId,
          title: entry.title,
          sourceId: src.id,
          sourceName: src.name,
          publishedMs: entry.publishedAt ? new Date(entry.publishedAt).getTime() || 0 : 0,
          tokens: tokenizeTitle(entry.title),
        });
        sourceNew += 1;
        newCount += 1;
      }

      const ref = doc(db, 'news_sources', src.id);
      const nextType: NewsSourceType =
        res.detectedType === 'atom' || res.detectedType === 'json' ? res.detectedType : 'rss';
      if (isNewSrc) {
        ops.push((b) =>
          b.set(ref, {
            name: src.name.slice(0, 100),
            siteUrl: src.siteUrl.slice(0, 500),
            feedUrl: (src.feedUrl || '').slice(0, 500),
            sourceType: nextType,
            tcgCategory: src.tcgCategory,
            enabled: src.enabled,
            isBuiltIn: Boolean(src.isBuiltIn),
            lastCheckedAt: serverTimestamp(),
            lastSuccessAt: serverTimestamp(),
            lastStatus: 'ok',
            lastError: '',
            lastFetchedCount: res.entries.length,
            lastNewCount: sourceNew,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        ops.push((b) =>
          b.update(ref, {
            sourceType: nextType,
            lastCheckedAt: serverTimestamp(),
            lastSuccessAt: serverTimestamp(),
            lastStatus: 'ok',
            lastError: '',
            lastFetchedCount: res.entries.length,
            lastNewCount: sourceNew,
            updatedAt: serverTimestamp(),
          })
        );
      }
    }

    const stateRef = doc(db, 'news_sync_state', 'global');
    const statePayload = {
      lastSyncedAt: serverTimestamp(),
      lastTrigger: 'manual' as const,
      lastNewCount: newCount,
      lastCheckedSources: activeSources.length,
      lastErrorCount: errors.length,
      lastErrors: errors.slice(0, 20),
      updatedAt: serverTimestamp(),
    };
    if (stateSnap.exists()) {
      ops.push((b) => b.update(stateRef, statePayload));
    } else {
      ops.push((b) => b.set(stateRef, statePayload));
    }

    for (let i = 0; i < ops.length; i += 40) {
      const batch = writeBatch(db);
      for (const apply of ops.slice(i, i + 40)) {
        apply(batch);
      }
      await batch.commit();
    }

    return {
      ok: true,
      trigger: 'manual',
      checkedSources: activeSources.length,
      newCount,
      skippedDuplicates,
      duplicateCandidateCount,
      errorCount: errors.length,
      errors,
      syncedAt: new Date().toISOString(),
    };
  };

  const handleManualSync = async () => {
    if (!user) return;
    setSyncing(true);
    setLastSyncBanner(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/news/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await res.json()) as SyncResponse;

      if (res.ok && data.ok) {
        const msg = `동기화 완료 (서버 REST): ${data.checkedSources ?? 0}개 출처 확인 · 신규 ${data.newCount ?? 0}건 수집 · 중복 URL ${data.skippedDuplicates ?? 0}건 제외${
          data.errorCount ? ` · 오류 ${data.errorCount}건` : ''
        }`;
        setLastSyncBanner(msg);
        showToast(msg);
        return;
      }

      const restErr = data.error || `동기화 요청 실패 (${res.status})`;
      const isRestPermissionError =
        res.status === 403 ||
        restErr.includes('403') ||
        restErr.includes('PERMISSION_DENIED');

      if (!isRestPermissionError) {
        throw new Error(restErr);
      }

      await runAuthAndPermissionDiagnosis(token);
      const fallbackData = await syncViaWebSdkWithServerFeeds(token);
      const msg = `동기화 완료 (Web SDK 관리자 권한 저장): ${fallbackData.checkedSources ?? 0}개 출처 확인 · 신규 ${fallbackData.newCount ?? 0}건 수집 · 중복 URL ${fallbackData.skippedDuplicates ?? 0}건 제외${
        fallbackData.errorCount ? ` · 오류 ${fallbackData.errorCount}건` : ''
      } (참고: 서버 REST API가 403을 반환해 브라우저 Firebase Web SDK로 안전하게 저장했습니다.)`;
      setLastSyncBanner(msg);
      showToast(`신규 ${fallbackData.newCount ?? 0}건이 수집함에 저장되었습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastSyncBanner(`동기화 오류: ${msg}`);
      showToast(`동기화 오류: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetInboxStatus = async (item: NewsInboxItem, nextStatus: NewsInboxStatus) => {
    setBusyListItemId(item.id);
    try {
      await updateDoc(doc(db, 'news_inbox', item.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(
        nextStatus === 'ignored'
          ? '기사를 무시함 처리했습니다. 동일 URL은 재수집되지 않습니다.'
          : '승인 대기함으로 복원했습니다.'
      );
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`${explained.title}: ${explained.detail}`);
    } finally {
      setBusyListItemId(null);
    }
  };

  const handleDeleteInboxItem = async (item: NewsInboxItem): Promise<boolean> => {
    if (
      !window.confirm(
        '수집함에서 이 항목을 완전히 삭제할까요? (원문 피드에 아직 기사가 남아 있으면 다음 동기화 때 다시 수집될 수 있습니다. 다시 수집되지 않게 하려면 [무시]를 권장합니다.)'
      )
    ) {
      return false;
    }
    setBusyListItemId(item.id);
    try {
      await deleteDoc(doc(db, 'news_inbox', item.id));
      clearLocalDraft(item.id);
      if (selectedItemId === item.id) {
        handleCloseEditor();
      } else {
        setDirtyDraftIds(listDirtyLocalDraftIds());
      }
      showToast('수집함 항목이 삭제되었습니다.');
      return true;
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`삭제 실패 · ${explained.title}: ${explained.detail}`);
      return false;
    } finally {
      setBusyListItemId(null);
    }
  };

  const handleTestFeed = async (targetFeedUrl: string) => {
    if (!user || !targetFeedUrl.trim()) return;
    setTestingFeed(true);
    setTestResult(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch('/api/news/test-source', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedUrl: targetFeedUrl.trim() }),
      });
      const json = (await res.json()) as TestSourceResponse;
      setTestResult(json);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingFeed(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSrcName.trim() || !isValidExternalUrl(newSrcSiteUrl.trim())) {
      showToast('사이트 이름과 올바른 공식 홈페이지 URL(https://...)을 입력해 주세요.');
      return;
    }
    const cleanFeed = newSrcFeedUrl.trim();
    if (cleanFeed && !isValidExternalUrl(cleanFeed)) {
      showToast('올바른 RSS/Atom/JSON 피드 URL을 입력해 주세요.');
      return;
    }

    setSavingSource(true);
    const id = generateSafeId('src');
    const sourceType: NewsSourceType = cleanFeed
      ? testResult?.detectedType === 'atom'
        ? 'atom'
        : testResult?.detectedType === 'json'
          ? 'json'
          : 'rss'
      : 'manual_only';

    try {
      await setDoc(doc(db, 'news_sources', id), {
        name: newSrcName.trim().slice(0, 100),
        siteUrl: newSrcSiteUrl.trim().slice(0, 500),
        feedUrl: cleanFeed.slice(0, 500),
        sourceType,
        tcgCategory: newSrcCategory,
        enabled: true,
        isBuiltIn: false,
        lastCheckedAt: null,
        lastSuccessAt: null,
        lastStatus: cleanFeed ? 'idle' : 'no_public_feed',
        lastError: cleanFeed
          ? ''
          : '피드 URL 미입력 상태입니다. [지금 뉴스 확인] 전 공개 RSS/Atom/JSON URL을 연결해 주세요.',
        lastFetchedCount: 0,
        lastNewCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSrcName('');
      setNewSrcSiteUrl('');
      setNewSrcFeedUrl('');
      setTestResult(null);
      showToast('새 해외 TCG 뉴스 출처가 등록되었습니다.');
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`출처 등록 실패 · ${explained.title}: ${explained.detail}`);
    } finally {
      setSavingSource(false);
    }
  };

  const handleUpdateSourceFeed = async (src: NewsSource) => {
    const nextFeed = (feedUrlDrafts[src.id] ?? src.feedUrl ?? '').trim();
    if (nextFeed && !isValidExternalUrl(nextFeed)) {
      showToast('올바른 http:// 또는 https:// 피드 URL을 입력해 주세요.');
      return;
    }
    const sourceRef = doc(db, 'news_sources', src.id);
    try {
      const existingSnap = await getDoc(sourceRef);
      const nextType: NewsSourceType = nextFeed ? 'rss' : 'manual_only';
      const nextStatus = nextFeed ? 'idle' : 'no_public_feed';
      const nextError = nextFeed
        ? ''
        : '공개 피드 URL이 제거되어 수동 확인 상태로 전환되었습니다.';

      if (!existingSnap.exists()) {
        await setDoc(sourceRef, {
          name: src.name.slice(0, 100),
          siteUrl: src.siteUrl.slice(0, 500),
          feedUrl: nextFeed.slice(0, 500),
          sourceType: nextType,
          tcgCategory: src.tcgCategory,
          enabled: src.enabled,
          isBuiltIn: Boolean(src.isBuiltIn),
          lastCheckedAt: null,
          lastSuccessAt: null,
          lastStatus: nextStatus,
          lastError: nextError,
          lastFetchedCount: src.lastFetchedCount ?? 0,
          lastNewCount: src.lastNewCount ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(sourceRef, {
          feedUrl: nextFeed.slice(0, 500),
          sourceType: nextType,
          lastStatus: nextStatus,
          lastError: nextError,
          updatedAt: serverTimestamp(),
        });
      }
      showToast(`'${src.name}' 피드 URL이 저장되었습니다.`);
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`피드 URL 저장 실패 · ${explained.title}: ${explained.detail}`);
    }
  };

  const handleToggleSourceEnabled = async (src: NewsSource) => {
    const sourceRef = doc(db, 'news_sources', src.id);
    try {
      const existingSnap = await getDoc(sourceRef);
      if (!existingSnap.exists()) {
        await setDoc(sourceRef, {
          name: src.name.slice(0, 100),
          siteUrl: src.siteUrl.slice(0, 500),
          feedUrl: (src.feedUrl || '').slice(0, 500),
          sourceType: src.sourceType,
          tcgCategory: src.tcgCategory,
          enabled: !src.enabled,
          isBuiltIn: Boolean(src.isBuiltIn),
          lastCheckedAt: null,
          lastSuccessAt: null,
          lastStatus: src.lastStatus,
          lastError: (src.lastError || '').slice(0, 500),
          lastFetchedCount: src.lastFetchedCount ?? 0,
          lastNewCount: src.lastNewCount ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(sourceRef, {
          enabled: !src.enabled,
          updatedAt: serverTimestamp(),
        });
      }
      showToast(`'${src.name}' 수집이 ${!src.enabled ? '활성화' : '중지'}되었습니다.`);
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`출처 상태 변경 실패 · ${explained.title}: ${explained.detail}`);
    }
  };

  const handleDeleteSource = async (src: NewsSource) => {
    if (src.isBuiltIn) {
      showToast('기본 등록된 공식 출처는 삭제 대신 비활성화할 수 있습니다.');
      return;
    }
    if (!window.confirm(`'${src.name}' 출처를 삭제할까요?`)) return;
    try {
      await deleteDoc(doc(db, 'news_sources', src.id));
      showToast('출처가 삭제되었습니다.');
    } catch (err) {
      const explained = explainFirestoreError(err);
      showToast(`출처 삭제 실패 · ${explained.title}: ${explained.detail}`);
    }
  };

  // Focused Single-Article Editing Mode (Desktop split workspace / Mobile full-screen)
  if (subTab === 'inbox' && selectedItem) {
    return (
      <NewsArticleEditor
        key={selectedItem.id}
        item={selectedItem}
        user={user}
        aiDraftAvailable={Boolean(capabilities?.aiDraftAvailable)}
        netlifyBlobsAvailable={Boolean(capabilities?.netlifyBlobsAvailable)}
        onBack={handleCloseEditor}
        onNotify={showToast}
        onChangeStatus={handleSetInboxStatus}
        onDelete={handleDeleteInboxItem}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Manual Sync Action */}
      <div className="border-b border-[#303741] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#F3F4F6]">해외 TCG 뉴스 수집함</h1>
          <p className="text-xs text-[#929AA6] mt-1">
            목록에서 기사 1건을 선택하면 집중 편집 화면으로 전환됩니다. 작성 중인 초안은 브라우저에 자동 임시 저장됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={diagnosing}
            onClick={() => runAuthAndPermissionDiagnosis()}
            className="min-h-[42px] px-3.5 py-2 border border-[#303741] bg-[#171C23] text-[#E5E7EB] rounded-md text-xs font-medium hover:border-[#C5CBD3] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ShieldCheck size={14} />
            <span>{diagnosing ? '진단 중...' : '권한 진단'}</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={handleManualSync}
            className="min-h-[42px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded-md text-xs font-semibold hover:bg-[#F3F4F6] inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? '뉴스 확인 중...' : '지금 뉴스 확인'}</span>
          </button>
        </div>
      </div>

      {/* Sync Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-1">
          <p className="text-[11px] text-[#929AA6]">마지막 동기화 시각</p>
          <p className="font-mono-tabular text-sm font-semibold text-[#F3F4F6]">
            {newsSyncState?.lastSyncedAt ? `${formatKST(newsSyncState.lastSyncedAt)} KST` : '미실행'}
          </p>
          {newsSyncState?.lastTrigger && (
            <p className="text-[11px] text-[#929AA6]">
              방식: {newsSyncState.lastTrigger === 'cron' ? '1시간 자동 수집' : '수동 확인'}
            </p>
          )}
        </div>

        <div className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-1">
          <p className="text-[11px] text-[#929AA6]">최근 신규 수집</p>
          <p className="font-mono-tabular text-2xl font-semibold text-[#F3F4F6]">
            {newsSyncState?.lastNewCount ?? 0}
          </p>
        </div>

        <div className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-1">
          <p className="text-[11px] text-[#929AA6]">승인 대기 기사</p>
          <p className="font-mono-tabular text-2xl font-semibold text-[#C5CBD3]">{counts.pending}</p>
        </div>

        <div className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-1">
          <p className="text-[11px] text-[#929AA6]">미저장 로컬 초안</p>
          <p
            className={`font-mono-tabular text-2xl font-semibold ${
              dirtyDraftIds.size > 0 ? 'text-amber-300' : 'text-[#929AA6]'
            }`}
          >
            {dirtyDraftIds.size}
          </p>
        </div>
      </div>

      {lastSyncBanner && (
        <div className="border border-[#C5CBD3]/50 rounded-lg px-4 py-3 bg-[#171C23] text-xs text-[#F3F4F6]">
          {lastSyncBanner}
        </div>
      )}

      {diagnosisReport && (
        <div className="border border-[#303741] rounded-lg p-4 bg-[#0D1015] space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-[#F3F4F6] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#C5CBD3]" />
              <span>Firebase Web SDK vs 서버 REST API 권한 비교 진단</span>
            </p>
            <button
              type="button"
              onClick={() => setDiagnosisReport(null)}
              className="text-[11px] text-[#929AA6] hover:text-[#F3F4F6]"
            >
              닫기
            </button>
          </div>

          {diagnosisReport.tokenSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded bg-[#171C23] border border-[#303741] text-[11px] text-[#D1D5DB]">
              <p>
                토큰 전달: {diagnosisReport.tokenSummary.present ? '전달됨' : '누락'} (길이{' '}
                {diagnosisReport.tokenSummary.length}, JWT 세그먼트{' '}
                {diagnosisReport.tokenSummary.jwtSegments}개 · 동일 토큰 사용:{' '}
                {diagnosisReport.tokenSummary.sameTokenUsedForRest ? '예' : '아니오'})
              </p>
              <p>
                인증 계정: {diagnosisReport.tokenSummary.email} (email_verified=
                {String(diagnosisReport.tokenSummary.emailVerified)}, uid=
                {diagnosisReport.tokenSummary.uid})
              </p>
              <p>
                대상 DB: {diagnosisReport.tokenSummary.projectId} /{' '}
                {diagnosisReport.tokenSummary.databaseId}
              </p>
              <p>
                Bearer 헤더 형식:{' '}
                {diagnosisReport.tokenSummary.authHeaderFormatValid ? '정상' : '오류'}
              </p>
            </div>
          )}

          {diagnosisReport.error && (
            <p className="text-red-300 text-[11px]">진단 오류: {diagnosisReport.error}</p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="font-medium text-[#C5CBD3]">브라우저 Firebase Web SDK</p>
              {diagnosisReport.webSdkProbes.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#171C23] border border-[#303741] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[#F3F4F6] truncate">{p.label}</p>
                    {p.detail && <p className="text-[11px] text-[#929AA6] break-all">{p.detail}</p>}
                  </div>
                  <span
                    className={`shrink-0 font-mono-tabular ${
                      p.ok ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-[#C5CBD3]">서버 Firestore REST API</p>
              {diagnosisReport.serverRestProbes.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-[#171C23] border border-[#303741] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[#F3F4F6] break-all">{p.label}</p>
                    {p.detail && <p className="text-[11px] text-[#929AA6] break-all">{p.detail}</p>}
                  </div>
                  <span
                    className={`shrink-0 font-mono-tabular ${
                      p.ok ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {newsSyncState && newsSyncState.lastErrorCount > 0 && newsSyncState.lastErrors?.length > 0 && (
        <div className="border border-amber-400/40 bg-amber-950/25 rounded-lg p-4 space-y-1.5 text-xs">
          <p className="font-semibold text-amber-200 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            <span>최근 동기화 중 확인된 출처 오류</span>
          </p>
          <ul className="list-disc pl-5 text-amber-100/90 space-y-0.5">
            {newsSyncState.lastErrors.map((errMsg, idx) => (
              <li key={idx}>{errMsg}</li>
            ))}
          </ul>
        </div>
      )}

      {capabilities && (!capabilities.cronAuthConfigured || !capabilities.aiDraftAvailable) && (
        <div className="border border-[#303741] rounded-lg p-4 bg-[#11151A] text-xs text-[#929AA6] space-y-1.5">
          <p className="font-medium text-[#C5CBD3] flex items-center gap-1.5">
            <Info size={14} className="text-[#8068BA]" />
            <span>서버 환경설정 상태 안내</span>
          </p>
          {!capabilities.cronAuthConfigured && (
            <p>
              · <strong className="text-[#F3F4F6]">1시간 자동 스케줄 수집(Netlify Scheduled Function)</strong>은 서버 환경변수 <code className="font-mono-tabular text-[#C5CBD3]">FIREBASE_SERVICE_ACCOUNT_JSON</code> 설정 시 백그라운드에서 자동 실행됩니다.
            </p>
          )}
          {!capabilities.aiDraftAvailable && (
            <p>
              · <strong className="text-[#F3F4F6]">AI 한국어 제목·요약 자동 초안</strong>은 서버 환경변수 <code className="font-mono-tabular text-[#C5CBD3]">GEMINI_API_KEY</code>가 연결된 경우에만 활성화됩니다.
            </p>
          )}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#303741] pb-3">
        <button
          type="button"
          onClick={() => setSubTab('inbox')}
          className={`min-h-[38px] px-4 py-1.5 rounded text-xs font-semibold border transition-colors ${
            subTab === 'inbox'
              ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
              : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
          }`}
        >
          뉴스 수집함 ({counts.pending})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('sources')}
          className={`min-h-[38px] px-4 py-1.5 rounded text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
            subTab === 'sources'
              ? 'bg-[#C5CBD3] text-[#080A0D] border-[#C5CBD3]'
              : 'bg-[#11151A] text-[#929AA6] border-[#303741] hover:text-[#F3F4F6]'
          }`}
        >
          <Rss size={13} />
          <span>수집 출처 관리 ({displaySources.length})</span>
        </button>
      </div>

      {/* INBOX QUEUE LIST VIEW */}
      {subTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'pending', label: `승인 대기 (${counts.pending})` },
                  { id: 'approved', label: `게시 승인됨 (${counts.approved})` },
                  { id: 'ignored', label: `무시됨 (${counts.ignored})` },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`min-h-[36px] px-3 py-1 text-xs rounded border ${
                    statusFilter === st.id
                      ? 'bg-[#171C23] border-[#C5CBD3] text-[#F3F4F6] font-semibold'
                      : 'bg-[#11151A] border-[#303741] text-[#929AA6] hover:text-[#F3F4F6]'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              <span className="text-[#303741] hidden sm:inline">|</span>

              {(['전체', ...TCG_CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`min-h-[36px] px-3 py-1 text-xs rounded border ${
                    categoryFilter === cat
                      ? 'bg-[#8068BA]/20 border-[#8068BA] text-[#E3DCF7] font-semibold'
                      : 'bg-[#11151A] border-[#303741] text-[#929AA6] hover:text-[#F3F4F6]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929AA6]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="수집 기사 검색"
                className="w-full min-h-[38px] pl-9 pr-3 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
              />
            </div>
          </div>

          {filteredInbox.length === 0 ? (
            <div className="border border-[#303741] rounded-lg p-12 text-center bg-[#11151A] space-y-3">
              <p className="text-sm font-medium text-[#F3F4F6]">
                {statusFilter === 'pending'
                  ? '승인 대기 중인 해외 TCG 뉴스가 없습니다.'
                  : '해당 조건의 수집 기사가 없습니다.'}
              </p>
              <p className="text-xs text-[#929AA6]">
                상단의 [지금 뉴스 확인] 버튼을 눌러 PokeBeach 등 연결된 출처에서 최신 피드를 가져오세요.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#303741] border border-[#303741] rounded-lg bg-[#11151A] overflow-hidden">
              {filteredInbox.map((item) => {
                const galleryCount = sanitizeGalleryImages(item.galleryImages).length;
                const hasCover = Boolean(item.coverImage?.trim());
                const previewThumb = item.coverImage || item.metadataImageUrl || '';
                const hasLocalDirty = dirtyDraftIds.has(item.id);
                const isBusy = busyListItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 bg-[#171C23]/60 hover:bg-[#171C23] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {previewThumb ? (
                        <div className="w-20 h-16 sm:w-24 sm:h-18 rounded border border-[#303741] bg-[#080A0D] overflow-hidden shrink-0 flex items-center justify-center">
                          <SafeImage
                            src={previewThumb}
                            alt={item.koreanTitle || item.originalTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-16 sm:w-24 sm:h-18 rounded border border-dashed border-[#303741] bg-[#0D1015] shrink-0 flex flex-col items-center justify-center text-[10px] text-[#929AA6]">
                          <ImageIcon size={14} className="mb-1 opacity-60" />
                          <span>이미지 없음</span>
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Clean unboxed metadata row */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#929AA6] font-mono-tabular">
                          <span className="text-[#C5CBD3] font-medium font-sans">{item.sourceName}</span>
                          <span>·</span>
                          <span className="text-[#E3DCF7] font-sans">{item.tcgCategory}</span>
                          {item.publishedAtSource && (
                            <>
                              <span>·</span>
                              <span>{formatKST(item.publishedAtSource)} KST</span>
                            </>
                          )}
                          {item.isPinned && (
                            <>
                              <span>·</span>
                              <span className="text-[#8068BA] inline-flex items-center gap-0.5 font-sans">
                                <Pin size={11} /> 상단 고정
                              </span>
                            </>
                          )}
                          {item.duplicateCandidateOf && (
                            <>
                              <span>·</span>
                              <span className="text-amber-300 font-semibold font-sans">중복 후보</span>
                            </>
                          )}
                          {hasLocalDirty && (
                            <>
                              <span>·</span>
                              <span className="text-amber-300 font-semibold font-sans">
                                미저장 로컬 초안 있음
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-semibold text-[#F3F4F6] leading-snug break-words">
                          {item.koreanTitle?.trim() || item.originalTitle}
                        </h3>

                        {item.koreanTitle?.trim() && (
                          <p className="text-xs text-[#929AA6] truncate">
                            원문: {item.originalTitle}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#929AA6]">
                          <span>
                            한국어 요약: {item.novaSummary?.trim() ? `${item.novaSummary.trim().length}자 작성됨` : '미작성'}
                          </span>
                          <span>·</span>
                          <span className="font-mono-tabular">
                            이미지: {hasCover ? '대표 1장' : '대표 없음'} / 본문 {galleryCount}장
                          </span>
                          {item.publishedPostId && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-300 font-mono-tabular">
                                게시 ID: {item.publishedPostId}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Focused Row Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenEditor(item)}
                        className="min-h-[38px] px-4 py-1.5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold hover:bg-[#F3F4F6] inline-flex items-center gap-1.5"
                      >
                        <FileEdit size={14} />
                        <span>{hasLocalDirty ? '이어서 편집' : '편집하기'}</span>
                      </button>

                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 border border-[#303741] bg-[#11151A] text-xs text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] rounded inline-flex items-center gap-1"
                      >
                        <span>원문</span>
                        <ExternalLink size={12} />
                      </a>

                      {item.status !== 'ignored' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSetInboxStatus(item, 'ignored')}
                          className="min-h-[38px] px-3 py-1.5 text-xs border border-[#303741] bg-[#11151A] text-[#929AA6] hover:text-[#F3F4F6] rounded inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <EyeOff size={13} />
                          <span>무시</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSetInboxStatus(item, 'pending')}
                          className="min-h-[38px] px-3 py-1.5 text-xs border border-[#303741] bg-[#11151A] text-[#C5CBD3] hover:text-[#F3F4F6] rounded disabled:opacity-50"
                        >
                          대기 복원
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteInboxItem(item)}
                        className="min-h-[38px] px-2.5 py-1.5 text-xs border border-red-400/40 text-red-200 rounded hover:bg-red-950/30 inline-flex items-center justify-center disabled:opacity-50"
                        aria-label="항목 삭제"
                        title="수집함에서 삭제"
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

      {/* SOURCES MANAGEMENT VIEW */}
      {subTab === 'sources' && (
        <div className="space-y-6">
          <div className="space-y-3">
            {displaySources.map((src) => {
              const feedDraft = feedUrlDrafts[src.id] ?? src.feedUrl ?? '';
              return (
                <div
                  key={src.id}
                  className="border border-[#303741] rounded-lg p-5 bg-[#171C23] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#F3F4F6]">{src.name}</h3>
                        <span className="px-2 py-0.5 text-[11px] border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded">
                          {src.tcgCategory}
                        </span>
                        {src.lastStatus === 'ok' && (
                          <span className="px-2 py-0.5 text-[11px] border border-emerald-400/50 bg-emerald-950/30 text-emerald-200 rounded inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            정상 연결 ({src.sourceType.toUpperCase()})
                          </span>
                        )}
                        {src.lastStatus === 'no_public_feed' && (
                          <span className="px-2 py-0.5 text-[11px] border border-amber-400/50 bg-amber-950/30 text-amber-200 rounded inline-flex items-center gap-1">
                            <Info size={11} />
                            공개 RSS/API 미제공
                          </span>
                        )}
                        {src.lastStatus === 'error' && (
                          <span className="px-2 py-0.5 text-[11px] border border-red-400/50 bg-red-950/30 text-red-200 rounded inline-flex items-center gap-1">
                            <AlertCircle size={11} />
                            수집 오류
                          </span>
                        )}
                        {src.lastStatus === 'idle' && (
                          <span className="px-2 py-0.5 text-[11px] border border-[#303741] text-[#929AA6] rounded">
                            동기화 대기
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#929AA6]">
                        <a
                          href={src.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#C5CBD3] hover:text-[#F3F4F6] underline"
                        >
                          <Globe size={12} />
                          <span>공식 페이지 바로가기 ↗</span>
                        </a>
                        {Boolean(src.lastCheckedAt) && (
                          <span className="font-mono-tabular">
                            최근 확인: {formatKST(src.lastCheckedAt)} KST
                          </span>
                        )}
                        {typeof src.lastFetchedCount === 'number' && src.lastStatus === 'ok' && (
                          <span className="font-mono-tabular">
                            최근 조회 {src.lastFetchedCount}건 (신규 {src.lastNewCount ?? 0}건)
                          </span>
                        )}
                      </div>

                      {src.lastError && (
                        <p className="text-xs text-amber-200/90 pt-1 leading-relaxed">
                          {src.lastError}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSourceEnabled(src)}
                        className={`min-h-[34px] px-3 py-1 text-xs rounded border ${
                          src.enabled
                            ? 'border-emerald-400/40 text-emerald-200 bg-emerald-950/20'
                            : 'border-[#303741] text-[#929AA6] bg-[#11151A]'
                        }`}
                      >
                        {src.enabled ? '활성' : '중지됨'}
                      </button>
                      {!src.isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(src)}
                          className="p-2 border border-red-400/40 rounded text-red-200"
                          aria-label="출처 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#303741]/60">
                    <input
                      type="url"
                      value={feedDraft}
                      onChange={(e) =>
                        setFeedUrlDrafts((prev) => ({ ...prev, [src.id]: e.target.value }))
                      }
                      placeholder="공개 RSS / Atom / JSON Feed URL 입력 (선택)"
                      className="flex-1 min-h-[38px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                    />
                    <button
                      type="button"
                      disabled={testingFeed || !feedDraft.trim()}
                      onClick={() => handleTestFeed(feedDraft)}
                      className="min-h-[38px] px-3 text-xs border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] disabled:opacity-40"
                    >
                      연결 테스트
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSourceFeed(src)}
                      className="min-h-[38px] px-3.5 text-xs font-medium bg-[#11151A] border border-[#C5CBD3]/60 text-[#F3F4F6] rounded hover:bg-[#171C23]"
                    >
                      피드 저장
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Custom News Source */}
          <form
            onSubmit={handleAddSource}
            className="border border-[#303741] rounded-lg p-6 bg-[#171C23] space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[#F3F4F6] flex items-center gap-2">
                <Plus size={15} />
                <span>새 TCG 뉴스 사이트 추가</span>
              </h2>
              <p className="text-xs text-[#929AA6]">
                공개 RSS 2.0, Atom 또는 JSON Feed URL을 제공하는 TCG 뉴스 사이트를 추가할 수 있습니다. (HTML 무단 크롤링 불가)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newSrcName}
                onChange={(e) => setNewSrcName(e.target.value)}
                placeholder="출처 이름 * (예: PokéGuardian)"
                className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <select
                value={newSrcCategory}
                onChange={(e) => setNewSrcCategory(e.target.value as NewsTcgCategory)}
                className="min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              >
                {TCG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="url"
                required
                value={newSrcSiteUrl}
                onChange={(e) => setNewSrcSiteUrl(e.target.value)}
                placeholder="공식 사이트 URL * (https://...)"
                className="sm:col-span-2 min-h-[40px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <input
                type="url"
                value={newSrcFeedUrl}
                onChange={(e) => setNewSrcFeedUrl(e.target.value)}
                placeholder="공개 RSS / Atom / JSON 피드 URL (https://...)"
                className="sm:col-span-2 lg:col-span-3 min-h-[40px] px-3 text-xs font-mono-tabular bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
              />
              <button
                type="button"
                disabled={testingFeed || !newSrcFeedUrl.trim()}
                onClick={() => handleTestFeed(newSrcFeedUrl)}
                className="min-h-[40px] px-3 text-xs border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] disabled:opacity-40"
              >
                {testingFeed ? '확인 중...' : '피드 연결 테스트'}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded border text-xs space-y-1.5 ${
                  testResult.ok
                    ? 'border-emerald-400/50 bg-emerald-950/25 text-emerald-100'
                    : 'border-red-400/50 bg-red-950/25 text-red-100'
                }`}
              >
                {testResult.ok ? (
                  <>
                    <p className="font-semibold">
                      연결 성공: {testResult.detectedType?.toUpperCase()} 피드 · {testResult.itemCount ?? 0}개 항목 확인됨
                    </p>
                    {testResult.sampleTitles && testResult.sampleTitles.length > 0 && (
                      <ul className="list-disc pl-5 text-emerald-100/90 space-y-0.5">
                        {testResult.sampleTitles.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p>연결 실패: {testResult.error}</p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSource}
                className="min-h-[40px] px-5 bg-[#C5CBD3] text-[#080A0D] rounded text-xs font-semibold hover:bg-[#F3F4F6] disabled:opacity-50"
              >
                {savingSource ? '등록 중...' : '새 출처 등록'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
