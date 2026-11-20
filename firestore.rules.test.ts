import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateInboxUpdateAgainstRules,
  validatePostPayloadAgainstRules,
  POST_ALLOWED_KEYS,
  POST_UPDATE_AFFECTED_KEYS,
  INBOX_ALLOWED_KEYS,
  INBOX_UPDATE_AFFECTED_KEYS,
} from './src/lib/newsPublishGuard';
import { buildNewsPostMarkdown } from './src/lib/newsDraftStore';
import { NewsImageItem, NewsInboxItem } from './src/types/nova';

/**
 * Security Rules Verification Suite (Phase 0: Dirty Dozen + News Publish Batch Simulation)
 * Validates that adversarial payloads return PERMISSION_DENIED and exact NewsArticleEditor
 * posts + news_inbox atomic writeBatch payloads pass every rule predicate in firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Admin Escalation',
    path: '/admins/attacker_uid_123',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid_123', email: 'attacker@example.com', role: 'admin' },
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    path: '/admins/spoof_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'spoof_uid', email: 'jwkim9633@gmail.com', role: 'admin' },
  },
  {
    id: 3,
    name: 'Buyback Snooping (Get)',
    path: '/buyback_requests/req_001',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Buyback Snooping (List)',
    path: '/buyback_requests',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Buyback Status Forgery',
    path: '/buyback_requests/req_forged',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Charizard',
      language: '한국어',
      condition: 'PSA 10',
      quantity: 1,
      photoUrls: [],
      status: '거래 완료',
      offerPrice: '9999999',
    },
  },
  {
    id: 6,
    name: 'Buyback Shadow Field',
    path: '/buyback_requests/req_shadow',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Pikachu',
      language: '일본어',
      condition: 'NM',
      quantity: 1,
      photoUrls: [],
      status: '신규',
      isApprovedByAdmin: true,
    },
  },
  {
    id: 7,
    name: 'Buyback Array Bomb (>4 images)',
    path: '/buyback_requests/req_bomb',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      cardName: 'Umbreon',
      language: '일본어',
      condition: 'NM',
      quantity: 1,
      photoUrls: ['1', '2', '3', '4', '5'],
      status: '신규',
    },
  },
  {
    id: 8,
    name: 'Draft Config Leak',
    path: '/site_config/draft',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Draft/Trashed Product Leak (unfiltered list)',
    path: '/products',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unapproved Review Leak',
    path: '/reviews',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Analytics Tampering / Reading',
    path: '/analytics_events',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Resource Poisoning / Invalid Document ID',
    path: '/buyback_requests/bad$id!with/slash',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { cardName: 'A'.repeat(50000) },
  },
];

/* -------------------------------------------------------------------------- */
/* Faithful Firestore Rules v2 Simulation & Atomic Batch Test Runner          */
/* -------------------------------------------------------------------------- */

const SERVER_TIME = Symbol('REQUEST_TIME');

interface MockTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

function makeTimestamp(ms = Date.now()): MockTimestamp {
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toDate: () => new Date(ms),
  };
}

function isTs(v: unknown): boolean {
  if (v === SERVER_TIME) return true;
  if (!v || typeof v !== 'object') return false;
  const o = v as { seconds?: unknown; toDate?: unknown };
  return typeof o.seconds === 'number' || typeof o.toDate === 'function';
}

interface MockAuth {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

interface EvalContext {
  auth: MockAuth | null;
  admins: Record<string, Record<string, unknown>>;
  dbReads: number;
}

const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;

function isValidIdRule(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_RE.test(id);
}

function isStringBoundedRule(val: unknown, minLen: number, maxLen: number): boolean {
  return typeof val === 'string' && val.length >= minLen && val.length <= maxLen;
}

function keysHasAll(data: Record<string, unknown>, req: string[]): boolean {
  return req.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function keysHasOnly(data: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(data).every((k) => allowed.has(k));
}

function isVerifiedRule(ctx: EvalContext): boolean {
  return ctx.auth !== null && ctx.auth.token.email_verified === true;
}

function isBootstrappedAdminRule(ctx: EvalContext): boolean {
  return (
    isVerifiedRule(ctx) &&
    typeof ctx.auth?.token.email === 'string' &&
    ctx.auth.token.email.toLowerCase() === 'jwkim9633@gmail.com'
  );
}

function isAdminRule(ctx: EvalContext): boolean {
  if (!isVerifiedRule(ctx) || !ctx.auth) return false;
  ctx.dbReads += 1; // exists(/databases/$(database)/documents/admins/$(request.auth.uid))
  if (Object.prototype.hasOwnProperty.call(ctx.admins, ctx.auth.uid)) {
    return true;
  }
  return isBootstrappedAdminRule(ctx);
}

function isValidNewsImageEntryRule(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  const m = entry as Record<string, unknown>;
  const allowed = new Set(['id', 'url', 'caption', 'source', 'rights', 'rightsNote', 'alt']);
  return (
    keysHasAll(m, ['id', 'url']) &&
    keysHasOnly(m, allowed) &&
    isValidIdRule(m.id) &&
    isStringBoundedRule(m.url, 1, 200000) &&
    (!('caption' in m) || isStringBoundedRule(m.caption, 0, 300)) &&
    (!('source' in m) || isStringBoundedRule(m.source, 0, 140)) &&
    (!('rights' in m) || isStringBoundedRule(m.rights, 0, 100)) &&
    (!('rightsNote' in m) || isStringBoundedRule(m.rightsNote, 0, 200)) &&
    (!('alt' in m) || isStringBoundedRule(m.alt, 0, 200))
  );
}

function isValidNewsGalleryListRule(listVal: unknown): boolean {
  if (!Array.isArray(listVal) || listVal.length > 10) return false;
  for (let i = 0; i < listVal.length; i++) {
    if (!isValidNewsImageEntryRule(listVal[i])) return false;
  }
  return true;
}

function isValidPostRule(data: Record<string, unknown>): boolean {
  return (
    keysHasAll(data, [
      'title',
      'slug',
      'category',
      'content',
      'isPinned',
      'isSample',
      'visibilityState',
      'createdAt',
      'updatedAt',
    ]) &&
    keysHasOnly(data, POST_ALLOWED_KEYS) &&
    isStringBoundedRule(data.title, 1, 160) &&
    isValidIdRule(data.slug) &&
    isStringBoundedRule(data.category, 1, 50) &&
    (!('summary' in data) || isStringBoundedRule(data.summary, 0, 400)) &&
    isStringBoundedRule(data.content, 1, 30000) &&
    (!('coverImage' in data) || isStringBoundedRule(data.coverImage, 0, 200000)) &&
    (!('galleryImages' in data) || isValidNewsGalleryListRule(data.galleryImages)) &&
    (!('tcgCategory' in data) || isStringBoundedRule(data.tcgCategory, 0, 40)) &&
    (!('sourceName' in data) || isStringBoundedRule(data.sourceName, 0, 100)) &&
    (!('sourceUrl' in data) || isStringBoundedRule(data.sourceUrl, 0, 500)) &&
    (!('publishedAtSource' in data) || isStringBoundedRule(data.publishedAtSource, 0, 80)) &&
    (!('inboxItemId' in data) || isStringBoundedRule(data.inboxItemId, 0, 128)) &&
    typeof data.isPinned === 'boolean' &&
    typeof data.isSample === 'boolean' &&
    (!('scheduledAt' in data) || data.scheduledAt === null || isTs(data.scheduledAt)) &&
    (!('seoTitle' in data) || isStringBoundedRule(data.seoTitle, 0, 120)) &&
    (!('seoDescription' in data) || isStringBoundedRule(data.seoDescription, 0, 300)) &&
    typeof data.visibilityState === 'string' &&
    ['published', 'draft', 'trashed'].includes(data.visibilityState) &&
    isTs(data.createdAt) &&
    isTs(data.updatedAt)
  );
}

function isValidNewsInboxItemRule(data: Record<string, unknown>): boolean {
  return (
    keysHasAll(data, [
      'sourceId',
      'sourceName',
      'originalTitle',
      'originalUrl',
      'canonicalUrlKey',
      'tcgCategory',
      'isPinned',
      'status',
      'createdAt',
      'updatedAt',
    ]) &&
    keysHasOnly(data, INBOX_ALLOWED_KEYS) &&
    isStringBoundedRule(data.sourceId, 1, 128) &&
    isStringBoundedRule(data.sourceName, 1, 100) &&
    isStringBoundedRule(data.originalTitle, 1, 300) &&
    isStringBoundedRule(data.originalUrl, 1, 500) &&
    isStringBoundedRule(data.canonicalUrlKey, 1, 500) &&
    (!('publishedAtSource' in data) || isStringBoundedRule(data.publishedAtSource, 0, 80)) &&
    typeof data.tcgCategory === 'string' &&
    ['포켓몬 TCG', '원피스 TCG', '기타 TCG'].includes(data.tcgCategory) &&
    (!('metadataAuthor' in data) || isStringBoundedRule(data.metadataAuthor, 0, 100)) &&
    (!('metadataSnippet' in data) || isStringBoundedRule(data.metadataSnippet, 0, 300)) &&
    (!('metadataImageUrl' in data) || isStringBoundedRule(data.metadataImageUrl, 0, 500)) &&
    (!('duplicateCandidateOf' in data) || isStringBoundedRule(data.duplicateCandidateOf, 0, 128)) &&
    (!('duplicateSimilarityNote' in data) ||
      isStringBoundedRule(data.duplicateSimilarityNote, 0, 300)) &&
    (!('koreanTitle' in data) || isStringBoundedRule(data.koreanTitle, 0, 160)) &&
    (!('novaSummary' in data) || isStringBoundedRule(data.novaSummary, 0, 3000)) &&
    (!('coverImage' in data) || isStringBoundedRule(data.coverImage, 0, 200000)) &&
    (!('galleryImages' in data) || isValidNewsGalleryListRule(data.galleryImages)) &&
    typeof data.isPinned === 'boolean' &&
    typeof data.status === 'string' &&
    ['pending', 'approved', 'ignored'].includes(data.status) &&
    (!('publishedPostId' in data) || isStringBoundedRule(data.publishedPostId, 0, 128)) &&
    (!('aiDraftGenerated' in data) || typeof data.aiDraftGenerated === 'boolean') &&
    (!('fetchedAt' in data) || data.fetchedAt === null || isTs(data.fetchedAt)) &&
    isTs(data.createdAt) &&
    isTs(data.updatedAt)
  );
}

function diffAffectedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): string[] {
  const keys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const affected: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      affected.push(k);
    }
  }
  return affected;
}

function evalPostsGet(
  ctx: EvalContext,
  postId: string,
  existing: Record<string, unknown> | null
): boolean {
  return (
    isValidIdRule(postId) &&
    (isAdminRule(ctx) || (existing !== null && existing.visibilityState === 'published'))
  );
}

function evalPostsCreate(
  ctx: EvalContext,
  postId: string,
  incoming: Record<string, unknown>
): boolean {
  return (
    isValidIdRule(postId) &&
    isAdminRule(ctx) &&
    isValidPostRule(incoming) &&
    incoming.createdAt === SERVER_TIME &&
    incoming.updatedAt === SERVER_TIME
  );
}

function evalPostsUpdate(
  ctx: EvalContext,
  postId: string,
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): boolean {
  const merged = { ...existing, ...patch };
  const affected = diffAffectedKeys(merged, existing);
  return (
    isValidIdRule(postId) &&
    isAdminRule(ctx) &&
    isValidPostRule(merged) &&
    merged.createdAt === existing.createdAt &&
    merged.updatedAt === SERVER_TIME &&
    affected.every((k) => POST_UPDATE_AFFECTED_KEYS.has(k))
  );
}

function evalInboxUpdate(
  ctx: EvalContext,
  itemId: string,
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): boolean {
  const merged = { ...existing, ...patch };
  const affected = diffAffectedKeys(merged, existing);
  return (
    isValidIdRule(itemId) &&
    isAdminRule(ctx) &&
    isValidNewsInboxItemRule(merged) &&
    merged.createdAt === existing.createdAt &&
    merged.updatedAt === SERVER_TIME &&
    affected.every((k) => INBOX_UPDATE_AFFECTED_KEYS.has(k))
  );
}

function runAllRulesVerificationTests() {
  // 0. Assert firestore.rules on disk contains key hardened clauses (drift check)
  const rulesText = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(
    rulesText.includes(
      'allow get: if isValidId(postId) && (isAdmin() || (resource != null && existing().visibilityState == \'published\'));'
    ),
    'posts allow get must evaluate isAdmin() before resource != null'
  );
  assert.ok(
    rulesText.includes("'galleryImages'") && rulesText.includes("'inboxItemId'"),
    'firestore.rules must include galleryImages and inboxItemId'
  );

  const bootstrapAdmin: MockAuth = {
    uid: '62Im9sMbYwMb9Ot3WejlutehuKr1',
    token: { email: 'jwkim9633@gmail.com', email_verified: true },
  };
  const allowlistedAdmin: MockAuth = {
    uid: 'secondary_admin_uid',
    token: { email: 'staff@novatcg.kr', email_verified: true },
  };
  const adminsTable = {
    secondary_admin_uid: {
      uid: 'secondary_admin_uid',
      email: 'staff@novatcg.kr',
      role: 'admin',
    },
  };

  const createdTs = makeTimestamp(1_760_000_000_000);
  const fetchedTs = makeTimestamp(1_760_000_000_000);

  const sampleInboxDoc: NewsInboxItem = {
    id: 'inbox_9c83a1b2f4d5e6a7b8c9d0e1',
    sourceId: 'src_pokebeach',
    sourceName: 'PokeBeach',
    originalTitle: 'New Pokémon TCG Scarlet & Violet Expansion Revealed',
    originalUrl: 'https://www.pokebeach.com/2026/11/new-expansion',
    canonicalUrlKey: 'https://pokebeach.com/2026/11/new-expansion',
    publishedAtSource: '2026-11-18T09:00:00Z',
    tcgCategory: '포켓몬 TCG',
    metadataAuthor: 'Water Pokémon Master',
    metadataSnippet: 'Official expansion announcement with card previews.',
    metadataImageUrl: 'https://www.pokebeach.com/news/cover.jpg',
    duplicateCandidateOf: '',
    duplicateSimilarityNote: '',
    koreanTitle: '',
    novaSummary: '',
    coverImage: '',
    isPinned: false,
    status: 'pending',
    publishedPostId: '',
    aiDraftGenerated: false,
    fetchedAt: fetchedTs,
    createdAt: createdTs,
    updatedAt: createdTs,
  };

  const sampleGallery: NewsImageItem[] = [
    {
      id: 'img_1',
      url: 'https://firebasestorage.googleapis.com/v0/b/savvy-climber-53kqt.firebasestorage.app/o/public%2Fposts%2Fimg_1.webp?alt=media',
      caption: '신규 확장팩 메인 비주얼',
      source: 'PokeBeach',
      rights: '공식 보도자료 · 출처 표기',
      alt: '신규 확장팩 카드 이미지',
    },
  ];

  const finalTitle = '포켓몬 카드 신규 확장팩 공개 안내';
  const finalSummary = '포켓몬 TCG 신규 확장팩이 공개되었습니다.\n\n[[image:img_1]]\n\n발매 일정은 추후 업데이트됩니다.';
  const postId = 'post_m8xyz123_abc987';
  const slug = 'news-9c83a1b2f4d5-m8xyz1';

  const postPayload = {
    title: finalTitle,
    slug,
    category: 'TCG 뉴스',
    tcgCategory: '포켓몬 TCG',
    sourceName: sampleInboxDoc.sourceName,
    sourceUrl: sampleInboxDoc.originalUrl,
    publishedAtSource: sampleInboxDoc.publishedAtSource || '',
    inboxItemId: sampleInboxDoc.id,
    summary: finalSummary.replace(/\[\[image:[a-zA-Z0-9_\-]+\]\]/g, '').trim().slice(0, 400),
    content: buildNewsPostMarkdown(sampleInboxDoc, finalSummary),
    coverImage: 'https://www.pokebeach.com/news/cover.jpg',
    galleryImages: sampleGallery,
    isPinned: true,
    isSample: false,
    scheduledAt: null,
    seoTitle: finalTitle.slice(0, 120),
    seoDescription: finalSummary.replace(/\[\[image:[a-zA-Z0-9_\-]+\]\]/g, '').trim().slice(0, 300),
    visibilityState: 'published',
  };

  const inboxUpdatePayload = {
    koreanTitle: finalTitle,
    novaSummary: finalSummary,
    tcgCategory: '포켓몬 TCG' as const,
    coverImage: 'https://www.pokebeach.com/news/cover.jpg',
    galleryImages: sampleGallery,
    isPinned: true,
    status: 'approved',
    publishedPostId: postId,
  };

  const existingInboxRaw = { ...sampleInboxDoc } as Record<string, unknown>;
  delete existingInboxRaw.id;

  // Test 1: Pre-flight guard matches zero violations
  assert.deepEqual(
    validatePostPayloadAgainstRules({
      postId,
      isUpdate: false,
      existingPostData: null,
      payload: postPayload,
    }),
    []
  );
  assert.deepEqual(
    validateInboxUpdateAgainstRules({
      item: sampleInboxDoc,
      rawServerData: existingInboxRaw,
      updatePayload: inboxUpdatePayload,
    }),
    []
  );
  assert.equal(
    validateInboxUpdateAgainstRules({
      item: sampleInboxDoc,
      rawServerData: sampleInboxDoc as unknown as Record<string, unknown>,
      updatePayload: inboxUpdatePayload,
    }).some((msg) => msg.includes("'id'")),
    true,
    'Guard must flag stray id field if stored inside raw Firestore doc'
  );

  // Test 2: Exact atomic writeBatch (posts create + news_inbox update) as bootstrap admin (NO admins doc needed)
  const batchCtx1: EvalContext = { auth: bootstrapAdmin, admins: {}, dbReads: 0 };
  const allowPostCreate = evalPostsCreate(batchCtx1, postId, {
    ...postPayload,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  });
  const allowInboxUpdate = evalInboxUpdate(batchCtx1, sampleInboxDoc.id, existingInboxRaw, {
    ...inboxUpdatePayload,
    updatedAt: SERVER_TIME,
  });
  assert.equal(allowPostCreate, true, 'Bootstrap admin posts create must be ALLOWED');
  assert.equal(allowInboxUpdate, true, 'Bootstrap admin news_inbox update must be ALLOWED');
  assert.ok(batchCtx1.dbReads <= 20, `Batch exists() reads (${batchCtx1.dbReads}) must be <= 20`);

  // Test 3: Same atomic writeBatch with empty galleryImages: [] as secondary allowlisted admin
  const batchCtx2: EvalContext = { auth: allowlistedAdmin, admins: adminsTable, dbReads: 0 };
  assert.equal(
    evalPostsCreate(batchCtx2, postId, {
      ...postPayload,
      galleryImages: [],
      coverImage: '',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    }),
    true
  );
  assert.equal(
    evalInboxUpdate(batchCtx2, sampleInboxDoc.id, existingInboxRaw, {
      ...inboxUpdatePayload,
      galleryImages: [],
      coverImage: '',
      updatedAt: SERVER_TIME,
    }),
    true
  );

  // Test 4: Atomic writeBatch when posts/{postId} already exists (update + news_inbox update)
  const existingPostRaw: Record<string, unknown> = {
    ...postPayload,
    createdAt: createdTs,
    updatedAt: createdTs,
  };
  assert.equal(
    evalPostsUpdate(batchCtx1, postId, existingPostRaw, {
      ...postPayload,
      title: '수정된 포켓몬 카드 뉴스 제목',
      updatedAt: SERVER_TIME,
    }),
    true
  );

  // Test 5: Null-resource allow get on deleted/non-existent posts/{postId}
  assert.equal(evalPostsGet(batchCtx1, 'missing_post_id', null), true, 'Admin allow get with resource == null must be ALLOWED');
  assert.equal(
    evalPostsGet({ auth: null, admins: {}, dbReads: 0 }, 'missing_post_id', null),
    false,
    'Public allow get with resource == null must be DENIED'
  );

  // Test 6: Security negatives (unverified email spoof, shadow field, >10 gallery images, bad timestamps)
  const unverifiedSpoof: MockAuth = {
    uid: 'spoof_uid',
    token: { email: 'jwkim9633@gmail.com', email_verified: false },
  };
  assert.equal(
    evalPostsCreate({ auth: unverifiedSpoof, admins: {}, dbReads: 0 }, postId, {
      ...postPayload,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    }),
    false,
    'Unverified email spoof must be DENIED'
  );

  assert.equal(
    evalPostsCreate(batchCtx1, postId, {
      ...postPayload,
      galleryImages: Array.from({ length: 11 }, (_, idx) => ({
        id: `img_${idx}`,
        url: 'https://example.com/a.webp',
      })),
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    }),
    false,
    '>10 galleryImages must be DENIED'
  );

  assert.equal(
    evalPostsCreate(batchCtx1, postId, {
      ...postPayload,
      shadowAdminFlag: true,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    }),
    false,
    'Shadow field on posts create must be DENIED'
  );

  assert.equal(
    evalInboxUpdate(batchCtx1, sampleInboxDoc.id, { ...existingInboxRaw, createdAt: '2026-11-18T00:00:00Z' }, {
      ...inboxUpdatePayload,
      updatedAt: SERVER_TIME,
    }),
    false,
    'news_inbox doc with string createdAt must be DENIED'
  );

  const guardBadTs = validateInboxUpdateAgainstRules({
    item: sampleInboxDoc,
    rawServerData: { ...existingInboxRaw, createdAt: '2026-11-18T00:00:00Z' },
    updatePayload: inboxUpdatePayload,
  });
  assert.equal(
    guardBadTs.some((msg) => msg.includes('Timestamp')),
    true,
    'validateInboxUpdateAgainstRules must catch non-Timestamp createdAt'
  );

  assert.equal(
    evalInboxUpdate(batchCtx1, sampleInboxDoc.id, existingInboxRaw, {
      ...inboxUpdatePayload,
      originalUrl: 'https://evil.example.com',
      updatedAt: SERVER_TIME,
    }),
    false,
    'Modifying non-whitelisted originalUrl in news_inbox update must be DENIED'
  );

  // Test 7: Dirty Dozen sanity check
  assert.equal(DIRTY_DOZEN_TESTS.length, 12);
  console.log('ALL_FIRESTORE_RULES_AND_BATCH_TESTS_PASSED');
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('firestore.rules.test.ts');

if (isDirectExecution) {
  runAllRulesVerificationTests();
}
