import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ASSET_IMAGES,
  DEFAULT_HERO_SLIDES,
  DEFAULT_ORIPA_ITEMS,
  DEFAULT_SITE_CONFIG,
  INITIAL_FAQS_SEED,
  INITIAL_RETAIL_CAMPAIGNS_SEED,
  INITIAL_RETAIL_DROPS_SEED,
  INITIAL_SAMPLE_EVENTS,
  INITIAL_SAMPLE_NOTICES,
  INITIAL_SAMPLE_POSTS,
  INITIAL_SAMPLE_PRODUCTS,
  INITIAL_SAMPLE_REVIEWS,
  INITIAL_SPONSORS_SEED,
  LEGACY_BUYBACK_HERO,
  LEGACY_DEFAULT_LOGO,
} from '../lib/defaults';
import { auth, db, handleFirestoreError, isFirestoreQuotaError, OperationType, testConnection } from '../lib/firebase';
import {
  getEventStatus,
  isScheduledVisible,
  normalizeHomeSections,
  resolveEffectiveDrop,
  toDateSafe,
} from '../lib/utils';
import {
  EventItem,
  FaqItem,
  HeroSlide,
  Notice,
  OripaItem,
  Post,
  Product,
  RetailCampaign,
  RetailDrop,
  Review,
  SiteConfig,
  Sponsor,
  SponsorExtendedMeta,
} from '../types/nova';

interface SiteContextValue {
  config: SiteConfig;
  isConfigInitialized: boolean;
  isPreviewDraft: boolean;
  loading: boolean;
  connectionError: string | null;
  retryConnection: () => void;
  heroSlides: HeroSlide[];
  buybackGuideImageUrl: string;
  oripaItems: OripaItem[];
  sponsorMeta: Record<string, SponsorExtendedMeta>;
  products: Product[];
  posts: Post[];
  notices: Notice[];
  events: EventItem[];
  sponsors: Sponsor[];
  endedSponsors: Sponsor[];
  reviews: Review[];
  faqs: FaqItem[];
  retailCampaigns: RetailCampaign[];
  retailDrops: RetailDrop[];
  currentUser: User | null;
  isAdminVerified: boolean;
  authReady: boolean;
}

const SiteContext = createContext<SiteContextValue | null>(null);

function normalizeHeroSlides(rawSlides: HeroSlide[] | undefined, fallbackHeroImage: string): HeroSlide[] {
  const source = Array.isArray(rawSlides) && rawSlides.length > 0 ? rawSlides : DEFAULT_HERO_SLIDES;
  const cleaned = source
    .map((s, idx) => {
      const desktop =
        !s.desktopImageUrl || s.desktopImageUrl === LEGACY_BUYBACK_HERO
          ? idx === 0
            ? fallbackHeroImage
            : ASSET_IMAGES.hero
          : s.desktopImageUrl;
      const mobile =
        !s.mobileImageUrl || s.mobileImageUrl === LEGACY_BUYBACK_HERO
          ? desktop
          : s.mobileImageUrl;
      return {
        ...s,
        desktopImageUrl: desktop,
        mobileImageUrl: mobile,
        order: Number.isFinite(s.order) ? s.order : idx,
        visible: s.visible !== false,
      };
    })
    .sort((a, b) => a.order - b.order);
  return cleaned;
}

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
  const [rawRetailCampaigns, setRawRetailCampaigns] = useState<RetailCampaign[]>([]);
  const [rawRetailDrops, setRawRetailDrops] = useState<RetailDrop[]>([]);

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

      const onListenerError = (
        err: unknown,
        op: OperationType,
        path: string,
        ignoreDraftPermission = false
      ) => {
        if (!active) return;
        if (ignoreDraftPermission) {
          setLoading(false);
          return;
        }
        if (isFirestoreQuotaError(err)) {
          setConnectionError(
            'Firestore 무료 일일 읽기 한도(Quota)를 초과했습니다. 한도 초기화(매일 자정 PST) 후 자동으로 복구되며, 현재는 기본 안내 콘텐츠가 표시됩니다.'
          );
          setLoading(false);
          return;
        }
        setConnectionError('사이트 데이터를 불러오는 중 연결 오류가 발생했습니다.');
        setLoading(false);
        handleFirestoreError(err, op, path);
      };

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
              if (!mergedBrand.heroImageUrl || mergedBrand.heroImageUrl === LEGACY_BUYBACK_HERO) {
                mergedBrand.heroImageUrl = ASSET_IMAGES.hero;
              }
              mergedBrand.heroSlides = normalizeHeroSlides(
                data.brand?.heroSlides,
                mergedBrand.heroImageUrl
              );

              const mergedSeo = { ...DEFAULT_SITE_CONFIG.seo, ...(data.seo || {}) };
              if (!mergedSeo.ogImageUrl || mergedSeo.ogImageUrl === LEGACY_BUYBACK_HERO) {
                mergedSeo.ogImageUrl = ASSET_IMAGES.hero;
              }

              setConfig({
                ...DEFAULT_SITE_CONFIG,
                ...data,
                homeSections: normalizeHomeSections(
                  data.homeSections,
                  DEFAULT_SITE_CONFIG.homeSections
                ),
                brand: mergedBrand,
                theme: { ...DEFAULT_SITE_CONFIG.theme, ...(data.theme || {}) },
                seo: mergedSeo,
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
                  sponsorMeta: data.eventsSettings?.sponsorMeta ?? {},
                  oripaItems:
                    data.eventsSettings?.oripaItems !== undefined
                      ? data.eventsSettings.oripaItems
                      : DEFAULT_ORIPA_ITEMS,
                },
              });
              setIsConfigInitialized(true);
            } else {
              setIsConfigInitialized(false);
            }
            setLoading(false);
          },
          (err) => onListenerError(err, OperationType.GET, `site_config/${configDocId}`, configDocId === 'draft')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'products'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'products')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'posts'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'posts')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'notices'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'notices')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'events'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'events')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'sponsors'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawSponsors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sponsor)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'sponsors')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'reviews'), where('isApproved', '==', true)),
          (snap) => {
            if (!active) return;
            setRawReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'reviews')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'faqs'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawFaqs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FaqItem)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'faqs')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'retail_campaigns'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawRetailCampaigns(
              snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailCampaign))
            );
          },
          (err) => onListenerError(err, OperationType.LIST, 'retail_campaigns')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'retail_drops'), where('visibilityState', '==', 'published')),
          (snap) => {
            if (!active) return;
            setRawRetailDrops(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailDrop)));
          },
          (err) => onListenerError(err, OperationType.LIST, 'retail_drops')
        )
      );
    }

    init();
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [isPreviewDraft, isAdminVerified, retryTick]);

  // Apply font scale safely without letting legacy dark-mode Firestore theme values overwrite the light store canvas
  useEffect(() => {
    const t = config.theme;
    const root = document.documentElement;
    const scaleMap = { sm: '0.94', md: '1', lg: '1.06' };
    root.style.setProperty('--nova-font-scale', scaleMap[t.fontScale || 'md'] || '1');
  }, [config.theme]);

  const sponsorMeta = useMemo(
    () => config.eventsSettings?.sponsorMeta || {},
    [config.eventsSettings?.sponsorMeta]
  );

  const heroSlides = useMemo(
    () =>
      normalizeHeroSlides(config.brand.heroSlides, config.brand.heroImageUrl).filter(
        (s) => s.visible
      ),
    [config.brand.heroSlides, config.brand.heroImageUrl]
  );

  const oripaItems = useMemo(() => {
    const raw =
      config.eventsSettings?.oripaItems !== undefined
        ? config.eventsSettings.oripaItems
        : DEFAULT_ORIPA_ITEMS;
    return [...raw]
      .filter((o) => o.visible)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [config.eventsSettings?.oripaItems]);

  const products = useMemo(() => {
    // Never replace live inventory with demo prices while config is loading/unavailable.
    const list: Product[] = rawProducts;
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [rawProducts]);

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

  const { sponsors, endedSponsors } = useMemo(() => {
    const list: Sponsor[] = isConfigInitialized
      ? rawSponsors.length > 0
        ? rawSponsors
        : (INITIAL_SPONSORS_SEED as Sponsor[])
      : (INITIAL_SPONSORS_SEED as Sponsor[]);
    const now = Date.now();
    const active: Sponsor[] = [];
    const ended: Sponsor[] = [];
    list.forEach((s) => {
      if (sponsorMeta[s.id]?.isPaused) return;
      const start = toDateSafe(s.startAt)?.getTime();
      const end = toDateSafe(s.endAt)?.getTime();
      if (start && now < start) return;
      if (end && now > end) {
        ended.push(s);
        return;
      }
      active.push(s);
    });
    active.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    ended.sort((a, b) => (b.priority ?? 99) - (a.priority ?? 99));
    return { sponsors: active, endedSponsors: ended };
  }, [isConfigInitialized, rawSponsors, sponsorMeta]);

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

  const useSeedDropsFallback = rawRetailCampaigns.length === 0 && rawRetailDrops.length === 0;

  const retailCampaigns = useMemo(() => {
    const list: RetailCampaign[] = useSeedDropsFallback
      ? (INITIAL_RETAIL_CAMPAIGNS_SEED as RetailCampaign[])
      : rawRetailCampaigns;
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const ta = toDateSafe(a.startAt)?.getTime() ?? 0;
      const tb = toDateSafe(b.startAt)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [useSeedDropsFallback, rawRetailCampaigns]);

  const retailDrops = useMemo(() => {
    const campMap = new Map(retailCampaigns.map((c) => [c.id, c]));
    const list: RetailDrop[] = useSeedDropsFallback
      ? (INITIAL_RETAIL_DROPS_SEED as RetailDrop[])
      : rawRetailDrops;
    return list
      .map((drop) => resolveEffectiveDrop(drop, drop.campaignId ? campMap.get(drop.campaignId) : undefined))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
  }, [useSeedDropsFallback, rawRetailDrops, retailCampaigns]);

  const value: SiteContextValue = {
    config,
    isConfigInitialized,
    isPreviewDraft: isPreviewDraft && isAdminVerified,
    loading,
    connectionError,
    retryConnection,
    heroSlides,
    buybackGuideImageUrl: ASSET_IMAGES.buybackGuide,
    oripaItems,
    sponsorMeta,
    products,
    posts,
    notices,
    events,
    sponsors,
    endedSponsors,
    reviews,
    faqs,
    retailCampaigns,
    retailDrops,
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
