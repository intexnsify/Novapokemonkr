export type VisibilityState = 'published' | 'draft' | 'trashed';

export type ProductCategory = '싱글카드' | '등급카드' | '미개봉 박스' | '팩' | '기타';
export type ProductStatus = '판매중' | '예약중' | '판매완료';
export type BuybackStatus = '신규' | '검토 중' | '가격 제안' | '협의 완료' | '거래 완료' | '거절';
export type CardLanguage = '한국어' | '일본어' | '영어' | '기타';

export interface HeroSlide {
  id: string;
  badge?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  accentTheme?: 'dark' | 'light';
  order: number;
  visible: boolean;
}

export interface BrandConfig {
  name: string;
  tagline: string;
  headline: string;
  description: string;
  logoUrl: string;
  heroImageUrl: string;
  heroSlides?: HeroSlide[];
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  email: string;
}

export interface ThemeConfig {
  mainBg: string;
  secondaryBg: string;
  cardBg: string;
  silver: string;
  primaryText: string;
  secondaryText: string;
  border: string;
  accent: string;
  fontScale: 'sm' | 'md' | 'lg';
  buttonShape: 'sharp' | 'rounded' | 'pill';
  sectionSpacing: 'compact' | 'normal' | 'relaxed';
  headingFont: 'Syncopate' | 'Pretendard';
}

export interface HomeActionItem {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  url: string;
  visible: boolean;
  order: number;
}

export type HomeSectionId =
  | 'retail_raffle'
  | 'news'
  | 'sponsors'
  | 'actions'
  | 'featured_products'
  | 'oripa_live'
  | 'events'
  | 'community'
  | 'reviews'
  | 'faq'
  | 'work_with_nova'
  | 'notices';

export interface HomeSectionConfig {
  id: HomeSectionId;
  label: string;
  visible: boolean;
  order: number;
  limit: number;
}

export interface CommunityLinkItem {
  id: string;
  name: string;
  description: string;
  url: string;
  platform: 'instagram' | 'discord' | 'kakao' | 'youtube' | 'tiktok' | 'other';
  visible: boolean;
  order: number;
}

export interface SeoConfig {
  siteTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  twitterCard: 'summary' | 'summary_large_image';
  keywords: string;
  organizationName: string;
}

export interface BusinessInfoSlot {
  companyName: string;
  representative: string;
  registrationNumber: string;
  ecommerceNumber: string;
  address: string;
  supportContact: string;
}

export interface LegalConfig {
  privacyPolicy: string;
  termsOfUse: string;
  shippingRefundPolicy: string;
  businessInfo: BusinessInfoSlot;
}

export interface SponsorExtendedMeta {
  campaignName?: string;
  headline?: string;
  videoUrl?: string;
  memo?: string;
  isPaused?: boolean;
}

export type OripaSlotStatus = 'available' | 'reserved' | 'sold' | 'disabled';
export type OripaScheduleMode = 'scheduled' | 'always' | 'ended';
export type OripaFulfillmentMode = 'live_or_ship' | 'live_only' | 'ship_only';

export interface OripaItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  pricePerSlot: number;
  totalSlots: number;
  imageUrl?: string;
  youtubeChannelUrl?: string;
  youtubeLiveUrl?: string;
  liveScheduleText?: string;
  fulfillmentMode: OripaFulfillmentMode;
  scheduleMode: OripaScheduleMode;
  visible: boolean;
  purchasingDisabled: boolean;
  slotStatuses: Record<string, OripaSlotStatus>;
  policyNote?: string;
  adminMemo?: string;
  order: number;
}

export interface EventsSettings {
  hideEndedEventsGlobally: boolean;
  sponsorMeta?: Record<string, SponsorExtendedMeta>;
  oripaItems?: OripaItem[];
}

export interface SiteConfig {
  brand: BrandConfig;
  theme: ThemeConfig;
  homeActions: HomeActionItem[];
  homeSections: HomeSectionConfig[];
  communityLinks: CommunityLinkItem[];
  seo: SeoConfig;
  legal: LegalConfig;
  eventsSettings?: EventsSettings;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface Product {
  id: string;
  title: string;
  category: ProductCategory;
  price: number;
  currency: 'KRW';
  status: ProductStatus;
  language?: string;
  grade?: string;
  setCode?: string;
  description?: string;
  images: string[];
  dmPrompt?: string;
  order: number;
  isFeatured?: boolean;
  isSample: boolean;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BuybackRequest {
  id: string;
  cardName: string;
  language: CardLanguage;
  condition: string;
  desiredPrice?: string;
  quantity: number;
  notes?: string;
  contact?: string;
  photoUrls: string[];
  status: BuybackStatus;
  offerPrice?: string;
  adminMemo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NewsTcgCategory = '포켓몬 TCG' | '원피스 TCG' | '기타 TCG';

export interface NewsImageItem {
  id: string;
  url: string;
  caption?: string;
  source?: string;
  rights?: string;
  rightsNote?: string;
  alt?: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  category: string;
  tcgCategory?: NewsTcgCategory | '';
  sourceName?: string;
  sourceUrl?: string;
  publishedAtSource?: string;
  inboxItemId?: string;
  summary?: string;
  content: string;
  coverImage?: string;
  galleryImages?: NewsImageItem[];
  isPinned: boolean;
  isSample: boolean;
  scheduledAt?: unknown;
  seoTitle?: string;
  seoDescription?: string;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isSample: boolean;
  scheduledAt?: unknown;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  startAt: unknown;
  endAt: unknown;
  locationOrPlatform?: string;
  externalUrl?: string;
  hideWhenEnded: boolean;
  isSample: boolean;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SponsorPlacement =
  | 'home_partners'
  | 'home_banner'
  | 'news_inline'
  | 'shop_banner'
  | 'drops_banner';

export interface Sponsor {
  id: string;
  name: string;
  description: string;
  url: string;
  logoUrl?: string;
  desktopBannerUrl?: string;
  mobileBannerUrl?: string;
  ctaLabel?: string;
  placement: SponsorPlacement;
  badgeLabel?: string;
  priority: number;
  startAt?: unknown;
  endAt?: unknown;
  isSponsored: boolean;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  authorName: string;
  context?: string;
  content: string;
  isApproved: boolean;
  isSample: boolean;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AnalyticsEvent {
  id: string;
  eventType:
    | 'page_view'
    | 'sponsor_click'
    | 'sponsor_impression'
    | 'action_click'
    | 'dm_click'
    | 'email_click';
  path: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  dateKey: string;
  createdAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  label?: string;
  role: 'admin';
  addedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DropSaleType = '추첨 판매' | '일반 정가 판매' | '선착순 판매' | '예약 판매';
export type DropTcgCategory = '포켓몬' | '원피스' | '기타 TCG';
export type DropCountry = '한국' | '일본' | '미국';
export type DropCurrency = 'KRW' | 'JPY' | 'USD';

export type DropStatusLabel =
  | '예정'
  | '응모 중'
  | '마감 임박'
  | '응모 종료'
  | '판매 확인'
  | '품절 확인'
  | '재확인 필요'
  | '시작 예정'
  | '접수 중'
  | '종료'
  | '확인 필요';

export type DropStatusOverride = 'auto' | DropStatusLabel;

export interface RetailCampaign {
  id: string;
  title: string;
  retailer: string;
  country: DropCountry;
  saleType: DropSaleType;
  timezoneLabel?: string;
  startAt?: unknown;
  endAt?: unknown;
  purchaseWindowText?: string;
  conditions?: string;
  officialUrl?: string;
  verifiedAt?: unknown;
  isPinned: boolean;
  isRecommended: boolean;
  archiveEnded: boolean;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RetailDrop {
  id: string;
  campaignId?: string;
  title: string;
  tcg: DropTcgCategory;
  country: DropCountry;
  retailer: string;
  saleType: DropSaleType;
  price: number;
  currency: DropCurrency;
  imageUrl?: string;
  officialUrl: string;
  timezoneLabel?: string;
  startAt?: unknown;
  endAt?: unknown;
  purchaseWindowText?: string;
  conditions?: string;
  manualStatus: DropStatusOverride;
  verifiedAt?: unknown;
  isPinned: boolean;
  isRecommended: boolean;
  archiveEnded: boolean;
  order: number;
  visibilityState: VisibilityState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NewsSourceType = 'rss' | 'atom' | 'json' | 'manual_only';
export type NewsSourceStatus = 'ok' | 'error' | 'no_public_feed' | 'idle';
export type NewsInboxStatus = 'pending' | 'approved' | 'ignored';

export interface NewsSource {
  id: string;
  name: string;
  siteUrl: string;
  feedUrl?: string;
  sourceType: NewsSourceType;
  tcgCategory: NewsTcgCategory;
  enabled: boolean;
  isBuiltIn: boolean;
  lastCheckedAt?: unknown;
  lastSuccessAt?: unknown;
  lastStatus: NewsSourceStatus;
  lastError?: string;
  lastFetchedCount?: number;
  lastNewCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsInboxItem {
  id: string;
  sourceId: string;
  sourceName: string;
  originalTitle: string;
  originalUrl: string;
  canonicalUrlKey: string;
  publishedAtSource?: string;
  tcgCategory: NewsTcgCategory;
  metadataAuthor?: string;
  metadataSnippet?: string;
  metadataImageUrl?: string;
  duplicateCandidateOf?: string;
  duplicateSimilarityNote?: string;
  koreanTitle?: string;
  novaSummary?: string;
  coverImage?: string;
  galleryImages?: NewsImageItem[];
  isPinned: boolean;
  status: NewsInboxStatus;
  publishedPostId?: string;
  aiDraftGenerated?: boolean;
  fetchedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsSyncState {
  id: string;
  lastSyncedAt?: unknown;
  lastTrigger: 'cron' | 'manual' | 'server_interval';
  lastNewCount: number;
  lastCheckedSources: number;
  lastErrorCount: number;
  lastErrors: string[];
  updatedAt?: unknown;
}
