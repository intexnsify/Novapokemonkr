import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ASSET_IMAGES,
  DEFAULT_SITE_CONFIG,
  INITIAL_FAQS_SEED,
  INITIAL_SAMPLE_EVENTS,
  INITIAL_SAMPLE_NOTICES,
  INITIAL_SAMPLE_POSTS,
  INITIAL_SAMPLE_PRODUCTS,
  INITIAL_SAMPLE_REVIEWS,
  INITIAL_SPONSORS_SEED,
  LEGACY_DEFAULT_LOGO,
} from '../lib/defaults';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { getEventStatus, isScheduledVisible, toDateSafe } from '../lib/utils';
import {
  EventItem,
  FaqItem,
  Notice,
  Post,
  Product,
  Review,
  SiteConfig,
  Sponsor,
} from '../types/nova';

interface SiteContextValue {
  config: SiteConfig;
  isConfigInitialized: boolean;
  isPreviewDraft: boolean;
  loading: boolean;
  connectionError: string | null;
  retryConnection: () => void;
  products: Product[];
  posts: Post[];
  notices: Notice[];
  events: EventItem[];
  sponsors: Sponsor[];
  reviews: Review[];
  faqs: FaqItem[];
  currentUser: User | null;
  isAdminVerified: boolean;
  authReady: boolean;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [isConfigInitialized, setIsConfigInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [rawNotices, setRawNotices] = useState<Notice[]>([]);
  const [rawEvents, setRawEvents] = useState<EventItem[]>([]);
  const [rawSponsors, setRawSponsors] = useState<Sponsor[]>([]);
  const [rawReviews, setRawReviews] = useState<Review[]>([]);
  const [rawFaqs, setRawFaqs] = useState<FaqItem[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const isPreviewDraft = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === 'draft';
  }, []);

  const retryConnection = useCallback(() => {
    setConnectionError(null);
    setLoading(true);
    setRetryTick((n) => n + 1);
  }, []);

  // Auth listener & Firestore UID allowlist check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setIsAdminVerified(false);
        setAuthReady(true);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        const isAllowed =
          adminDoc.exists() ||
          (user.emailVerified && user.email?.toLowerCase() === 'jwkim9633@gmail.com');
        setIsAdminVerified(isAllowed);
      } catch {
        setIsAdminVerified(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Connection test & public Firestore subscriptions
  useEffect(() => {
    let active = true;
    const unsubs: (() => void)[] = [];

    async function init() {
      const conn = await testConnection();
      if (!active) return;
      if (!conn.ok && conn.error?.includes('offline')) {
        setConnectionError('Firebase Firestore 연결에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.');
        setLoading(false);
        return;
      }

      const configDocId = isPreviewDraft && isAdminVerified ? 'draft' : 'published';

      unsubs.push(
        onSnapshot(
          doc(db, 'site_config', configDocId),
          (snap) => {
            if (!active) return;
            if (snap.exists()) {
              const data = snap.data() as Partial<SiteConfig>;
              const mergedBrand = { ...DEFAULT_SITE_CONFIG.brand, ...(data.brand || {}) };
              if (!mergedBrand.logoUrl || mergedBrand.logoUrl === LEGACY_DEFAULT_LOGO) {
                mergedBrand.logoUrl = ASSET_IMAGES.logo;
              }
              setConfig({
                ...DEFAULT_SITE_CONFIG,
                ...data,
                brand: mergedBrand,
                theme: { ...DEFAULT_SITE_CONFIG.theme, ...(data.theme || {}) },
                seo: { ...DEFAULT_SITE_CONFIG.seo, ...(data.seo || {}) },
                legal: {
                  ...DEFAULT_SITE_CONFIG.legal,
                  ...(data.legal || {}),
                  businessInfo: {
                    ...DEFAULT_SITE_CONFIG.legal.businessInfo,
                    ...(data.legal?.businessInfo || {}),
                  },
                },
                eventsSettings: {
                  hideEndedEventsGlobally:
                    data.eventsSettings?.hideEndedEventsGlobally ??
                    DEFAULT_SITE_CONFIG.eventsSettings?.hideEndedEventsGlobally ??
                    false,
                },
              });
              setIsConfigInitialized(true);
            } else {
              setIsConfigInitialized(false);
            }
            setLoading(false);
          },
          (err) => {
            if (configDocId === 'draft') {
              // If draft preview fails for non-admin, ignore gracefully
              setLoading(false);
              return;
            }
            setConnectionError('사이트 설정을 불러오지 못했습니다.');
            setLoading(false);
            handleFirestoreError(err, OperationType.GET, `site_config/${configDocId}`);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'products'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'products')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'posts'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'notices'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notices')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'events'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'events')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'sponsors'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'sponsors')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'reviews'), where('isApproved', '==', true)),
          (snap) => {
            if (!active) return;
            setRawReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'faqs'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawFaqs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FaqItem)));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'faqs')
        )
      );
    }

    init();
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [isPreviewDraft, isAdminVerified, retryTick]);

  // Apply dynamic theme CSS variables
  useEffect(() => {
    const t = config.theme;
    const root = document.documentElement;
    root.style.setProperty('--nova-bg-main', t.mainBg || '#080A0D');
    root.style.setProperty('--nova-bg-secondary', t.secondaryBg || '#11151A');
    root.style.setProperty('--nova-bg-card', t.cardBg || '#171C23');
    root.style.setProperty('--nova-silver', t.silver || '#C5CBD3');
    root.style.setProperty('--nova-text-primary', t.primaryText || '#F3F4F6');
    root.style.setProperty('--nova-text-secondary', t.secondaryText || '#929AA6');
    root.style.setProperty('--nova-border', t.border || '#303741');
    root.style.setProperty('--nova-accent', t.accent || '#8068BA');
    const scaleMap = { sm: '0.94', md: '1', lg: '1.06' };
    root.style.setProperty('--nova-font-scale', scaleMap[t.fontScale || 'md'] || '1');
  }, [config.theme]);

  // Derived sorted & scheduled-filtered collections (with pre-seed fallback ONLY before DB is initialized)
  const products = useMemo(() => {
    const list: Product[] = isConfigInitialized ? rawProducts : (INITIAL_SAMPLE_PRODUCTS as Product[]);
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [isConfigInitialized, rawProducts]);

  const posts = useMemo(() => {
    const list: Post[] = isConfigInitialized ? rawPosts : (INITIAL_SAMPLE_POSTS as Post[]);
    return list
      .filter((p) => isScheduledVisible(p.scheduledAt))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = toDateSafe(a.createdAt)?.getTime() ?? 0;
        const tb = toDateSafe(b.createdAt)?.getTime() ?? 0;
        return tb - ta;
      });
  }, [isConfigInitialized, rawPosts]);

  const notices = useMemo(() => {
    const list: Notice[] = isConfigInitialized ? rawNotices : (INITIAL_SAMPLE_NOTICES as Notice[]);
    return list
      .filter((n) => isScheduledVisible(n.scheduledAt))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const ta = toDateSafe(a.createdAt)?.getTime() ?? 0;
        const tb = toDateSafe(b.createdAt)?.getTime() ?? 0;
        return tb - ta;
      });
  }, [isConfigInitialized, rawNotices]);

  const events = useMemo(() => {
    const list: EventItem[] = isConfigInitialized ? rawEvents : (INITIAL_SAMPLE_EVENTS as EventItem[]);
    const hideGlobally = config.eventsSettings?.hideEndedEventsGlobally ?? false;
    return list
      .filter((ev) => {
        const status = getEventStatus(ev.startAt, ev.endAt);
        if (status === '종료됨' && (ev.hideWhenEnded || hideGlobally)) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = toDateSafe(a.startAt)?.getTime() ?? 0;
        const tb = toDateSafe(b.startAt)?.getTime() ?? 0;
        return ta - tb;
      });
  }, [isConfigInitialized, rawEvents, config.eventsSettings]);

  const sponsors = useMemo(() => {
    const list: Sponsor[] = isConfigInitialized
      ? rawSponsors.length > 0
        ? rawSponsors
        : (INITIAL_SPONSORS_SEED as Sponsor[])
      : (INITIAL_SPONSORS_SEED as Sponsor[]);
    const now = Date.now();
    return list
      .filter((s) => {
        const start = toDateSafe(s.startAt)?.getTime();
        const end = toDateSafe(s.endAt)?.getTime();
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      })
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }, [isConfigInitialized, rawSponsors]);

  const reviews = useMemo(() => {
    const list: Review[] = isConfigInitialized ? rawReviews : (INITIAL_SAMPLE_REVIEWS as Review[]);
    return list
      .filter((r) => r.visibilityState === 'published' && r.isApproved)
      .sort((a, b) => {
        const ta = toDateSafe(a.createdAt)?.getTime() ?? 0;
        const tb = toDateSafe(b.createdAt)?.getTime() ?? 0;
        return tb - ta;
      });
  }, [isConfigInitialized, rawReviews]);

  const faqs = useMemo(() => {
    const list: FaqItem[] = isConfigInitialized
      ? rawFaqs.length > 0
        ? rawFaqs
        : (INITIAL_FAQS_SEED as FaqItem[])
      : (INITIAL_FAQS_SEED as FaqItem[]);
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [isConfigInitialized, rawFaqs]);

  const value: SiteContextValue = {
    config,
    isConfigInitialized,
    isPreviewDraft: isPreviewDraft && isAdminVerified,
    loading,
    connectionError,
    retryConnection,
    products,
    posts,
    notices,
    events,
    sponsors,
    reviews,
    faqs,
    currentUser,
    isAdminVerified,
    authReady,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside SiteProvider');
  return ctx;
}
