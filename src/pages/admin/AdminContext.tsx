import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ASSET_IMAGES, DEFAULT_SITE_CONFIG, LEGACY_DEFAULT_LOGO } from '../../lib/defaults';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../../lib/firebase';
import { normalizeHomeSections } from '../../lib/utils';
import {
  AdminUser,
  AnalyticsEvent,
  BuybackRequest,
  EventItem,
  FaqItem,
  Notice,
  Post,
  Product,
  RetailCampaign,
  RetailDrop,
  Review,
  SiteConfig,
  Sponsor,
} from '../../types/nova';

export type AdminAuthStatus = 'loading' | 'signed_out' | 'unauthorized' | 'error' | 'authorized';

export type AdminMenuId =
  | 'dashboard'
  | 'drops'
  | 'brand'
  | 'theme'
  | 'home_layout'
  | 'community'
  | 'products'
  | 'buybacks'
  | 'posts'
  | 'notices'
  | 'sponsors'
  | 'events'
  | 'reviews'
  | 'faqs'
  | 'analytics'
  | 'seo'
  | 'backup'
  | 'admins';

interface AdminContextValue {
  authStatus: AdminAuthStatus;
  authError: string | null;
  user: User | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  retryAuth: () => void;

  activeMenu: AdminMenuId;
  setActiveMenu: (menu: AdminMenuId) => void;

  draftConfig: SiteConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<SiteConfig>>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  savingConfig: boolean;
  publishingConfig: boolean;
  saveDraftConfig: (override?: SiteConfig) => Promise<void>;
  publishDraftToLive: () => Promise<void>;
  discardDraftChanges: () => Promise<void>;
  statusToast: string | null;
  showToast: (msg: string) => void;

  products: Product[];
  buybacks: BuybackRequest[];
  posts: Post[];
  notices: Notice[];
  events: EventItem[];
  sponsors: Sponsor[];
  reviews: Review[];
  faqs: FaqItem[];
  retailCampaigns: RetailCampaign[];
  retailDrops: RetailDrop[];
  analyticsEvents: AnalyticsEvent[];
  admins: AdminUser[];
}

const AdminContext = createContext<AdminContextValue | null>(null);

function normalizeSiteConfig(data: Partial<SiteConfig>): SiteConfig {
  const brand = { ...DEFAULT_SITE_CONFIG.brand, ...(data.brand || {}) };
  if (!brand.logoUrl || brand.logoUrl === LEGACY_DEFAULT_LOGO) {
    brand.logoUrl = ASSET_IMAGES.logo;
  }
  return {
    ...DEFAULT_SITE_CONFIG,
    ...data,
    homeSections: normalizeHomeSections(
      data.homeSections,
      DEFAULT_SITE_CONFIG.homeSections
    ),
    brand,
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
  };
}

const VALID_ADMIN_MENUS: AdminMenuId[] = [
  'dashboard',
  'drops',
  'brand',
  'theme',
  'home_layout',
  'community',
  'products',
  'buybacks',
  'posts',
  'notices',
  'sponsors',
  'events',
  'reviews',
  'faqs',
  'analytics',
  'seo',
  'backup',
  'admins',
];

function getInitialAdminMenu(): AdminMenuId {
  if (typeof window === 'undefined') return 'dashboard';
  const param = new URLSearchParams(window.location.search).get('tab') as AdminMenuId | null;
  return param && VALID_ADMIN_MENUS.includes(param) ? param : 'dashboard';
}

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [activeMenu, setActiveMenuRaw] = useState<AdminMenuId>(getInitialAdminMenu);
  const [draftConfig, setDraftConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [publishingConfig, setPublishingConfig] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [buybacks, setBuybacks] = useState<BuybackRequest[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [retailCampaigns, setRetailCampaigns] = useState<RetailCampaign[]>([]);
  const [retailDrops, setRetailDrops] = useState<RetailDrop[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const retryAuth = useCallback(() => {
    setAuthStatus('loading');
    setAuthError(null);
    setRetryTick((n) => n + 1);
  }, []);

  // Warn on browser leave if unsaved config changes exist
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Verify connection + Firebase Auth + Firestore admins/{uid} allowlist
  useEffect(() => {
    let mounted = true;

    async function verifyUser(currentUser: User | null) {
      if (!mounted) return;
      const conn = await testConnection();
      if (!mounted) return;
      if (!conn.ok && conn.error?.includes('offline')) {
        setAuthError('Firebase 서버에 연결할 수 없습니다. 인터넷 연결을 확인 후 다시 시도해 주세요.');
        setAuthStatus('error');
        return;
      }

      if (!currentUser) {
        setUser(null);
        setAuthStatus('signed_out');
        return;
      }

      setUser(currentUser);

      try {
        const adminRef = doc(db, 'admins', currentUser.uid);
        let adminSnap = await getDoc(adminRef);

        // Bootstrap initial admin document in Firestore if verified initial admin signs in for the first time
        if (
          !adminSnap.exists() &&
          currentUser.emailVerified &&
          currentUser.email?.toLowerCase() === 'jwkim9633@gmail.com'
        ) {
          await setDoc(adminRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            label: '초기 최고 관리자',
            role: 'admin',
            addedBy: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          adminSnap = await getDoc(adminRef);
        }

        if (!mounted) return;

        if (adminSnap.exists() && adminSnap.data()?.role === 'admin') {
          setAuthStatus('authorized');
        } else {
          setAuthStatus('unauthorized');
        }
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('permission')) {
          setAuthStatus('unauthorized');
        } else {
          setAuthError(`관리자 권한 확인 중 오류가 발생했습니다: ${msg}`);
          setAuthStatus('error');
        }
      }
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      verifyUser(u);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [retryTick]);

  // Attach real-time Firestore listeners ONLY when authorized
  useEffect(() => {
    if (authStatus !== 'authorized' || !user) return;
    const unsubs: (() => void)[] = [];

    // Load draft config (fallback to published or default)
    async function loadDraft() {
      try {
        const draftSnap = await getDoc(doc(db, 'site_config', 'draft'));
        if (draftSnap.exists()) {
          setDraftConfig(normalizeSiteConfig(draftSnap.data() as Partial<SiteConfig>));
          return;
        }
        const pubSnap = await getDoc(doc(db, 'site_config', 'published'));
        if (pubSnap.exists()) {
          setDraftConfig(normalizeSiteConfig(pubSnap.data() as Partial<SiteConfig>));
          return;
        }
        setDraftConfig(DEFAULT_SITE_CONFIG);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'site_config/draft');
      }
    }
    loadDraft();

    unsubs.push(
      onSnapshot(
        collection(db, 'products'),
        (s) =>
          setProducts(
            s.docs
              .map((d) => ({ id: d.id, ...d.data() } as Product))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'products')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'buyback_requests'),
        (s) =>
          setBuybacks(
            s.docs.map((d) => ({ id: d.id, ...d.data() } as BuybackRequest))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'buyback_requests')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'posts'),
        (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Post))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'notices'),
        (s) => setNotices(s.docs.map((d) => ({ id: d.id, ...d.data() } as Notice))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'notices')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'events'),
        (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() } as EventItem))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'events')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'sponsors'),
        (s) =>
          setSponsors(
            s.docs
              .map((d) => ({ id: d.id, ...d.data() } as Sponsor))
              .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'sponsors')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'reviews'),
        (s) => setReviews(s.docs.map((d) => ({ id: d.id, ...d.data() } as Review))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'faqs'),
        (s) =>
          setFaqs(
            s.docs
              .map((d) => ({ id: d.id, ...d.data() } as FaqItem))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'faqs')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'analytics_events'),
        (s) =>
          setAnalyticsEvents(
            s.docs.map((d) => ({ id: d.id, ...d.data() } as AnalyticsEvent))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'analytics_events')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'admins'),
        (s) => setAdmins(s.docs.map((d) => ({ uid: d.id, ...d.data() } as AdminUser))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'retail_campaigns'),
        (s) =>
          setRetailCampaigns(
            s.docs.map((d) => ({ id: d.id, ...d.data() } as RetailCampaign))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'retail_campaigns')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'retail_drops'),
        (s) =>
          setRetailDrops(
            s.docs
              .map((d) => ({ id: d.id, ...d.data() } as RetailDrop))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'retail_drops')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authStatus, user]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-blocked')) {
        setAuthError(
          '브라우저에서 로그인 팝업이 차단되었습니다. Safari 팝업 차단을 허용하거나 아래 [새 창에서 관리자 로그인 열기]를 눌러 로그인해 주세요.'
        );
      } else if (msg.includes('popup-closed-by-user')) {
        setAuthError('로그인 창이 닫혔습니다. 다시 시도해 주세요.');
      } else {
        setAuthError(`Google 로그인 중 오류가 발생했습니다: ${msg}`);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setHasUnsavedChanges(false);
    setAuthStatus('signed_out');
  };

  const setActiveMenu = (menu: AdminMenuId) => {
    setActiveMenuRaw(menu);
  };

  const saveDraftConfig = async (override?: SiteConfig) => {
    if (!user) return;
    setSavingConfig(true);
    const target = override || draftConfig;
    try {
      await setDoc(doc(db, 'site_config', 'draft'), {
        brand: target.brand,
        theme: target.theme,
        homeActions: target.homeActions,
        homeSections: target.homeSections,
        communityLinks: target.communityLinks,
        seo: target.seo,
        legal: target.legal,
        eventsSettings: target.eventsSettings || { hideEndedEventsGlobally: false },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      setHasUnsavedChanges(false);
      showToast('초안(Draft)이 저장되었습니다. 새로고침해도 유지됩니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'site_config/draft');
    } finally {
      setSavingConfig(false);
    }
  };

  const publishDraftToLive = async () => {
    if (!user) return;
    setPublishingConfig(true);
    try {
      const payload = {
        brand: draftConfig.brand,
        theme: draftConfig.theme,
        homeActions: draftConfig.homeActions,
        homeSections: draftConfig.homeSections,
        communityLinks: draftConfig.communityLinks,
        seo: draftConfig.seo,
        legal: draftConfig.legal,
        eventsSettings: draftConfig.eventsSettings || { hideEndedEventsGlobally: false },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      await setDoc(doc(db, 'site_config', 'draft'), payload);
      await setDoc(doc(db, 'site_config', 'published'), payload);
      setHasUnsavedChanges(false);
      showToast('변경사항이 공개 사이트에 즉시 게시되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'site_config/published');
    } finally {
      setPublishingConfig(false);
    }
  };

  const discardDraftChanges = async () => {
    try {
      const pubSnap = await getDoc(doc(db, 'site_config', 'published'));
      const base = pubSnap.exists()
        ? normalizeSiteConfig(pubSnap.data() as Partial<SiteConfig>)
        : DEFAULT_SITE_CONFIG;
      setDraftConfig(base);
      setHasUnsavedChanges(false);
      showToast('게시된 버전의 설정으로 되돌렸습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'site_config/published');
    }
  };

  return (
    <AdminContext.Provider
      value={{
        authStatus,
        authError,
        user,
        loginWithGoogle,
        logout,
        retryAuth,
        activeMenu,
        setActiveMenu,
        draftConfig,
        setDraftConfig,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        savingConfig,
        publishingConfig,
        saveDraftConfig,
        publishDraftToLive,
        discardDraftChanges,
        statusToast,
        showToast,
        products,
        buybacks,
        posts,
        notices,
        events,
        sponsors,
        reviews,
        faqs,
        retailCampaigns,
        retailDrops,
        analyticsEvents,
        admins,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider');
  return ctx;
}
