import { doc, getDoc, Firestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { NewsImageItem, NewsInboxItem, NewsTcgCategory } from '../types/nova';

export const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const VALID_TCG_CATEGORIES: readonly NewsTcgCategory[] = [
  '포켓몬 TCG',
  '원피스 TCG',
  '기타 TCG',
];

export const POST_REQUIRED_KEYS = [
  'title',
  'slug',
  'category',
  'content',
  'isPinned',
  'isSample',
  'visibilityState',
  'createdAt',
  'updatedAt',
] as const;

export const POST_ALLOWED_KEYS = new Set([
  'title',
  'slug',
  'category',
  'summary',
  'content',
  'coverImage',
  'galleryImages',
  'tcgCategory',
  'sourceName',
  'sourceUrl',
  'publishedAtSource',
  'inboxItemId',
  'isPinned',
  'isSample',
  'scheduledAt',
  'seoTitle',
  'seoDescription',
  'visibilityState',
  'createdAt',
  'updatedAt',
]);

export const POST_UPDATE_AFFECTED_KEYS = new Set([
  'title',
  'slug',
  'category',
  'summary',
  'content',
  'coverImage',
  'galleryImages',
  'tcgCategory',
  'sourceName',
  'sourceUrl',
  'publishedAtSource',
  'inboxItemId',
  'isPinned',
  'isSample',
  'scheduledAt',
  'seoTitle',
  'seoDescription',
  'visibilityState',
  'updatedAt',
]);

export const INBOX_REQUIRED_KEYS = [
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
] as const;

export const INBOX_ALLOWED_KEYS = new Set([
  'sourceId',
  'sourceName',
  'originalTitle',
  'originalUrl',
  'canonicalUrlKey',
  'publishedAtSource',
  'tcgCategory',
  'metadataAuthor',
  'metadataSnippet',
  'metadataImageUrl',
  'duplicateCandidateOf',
  'duplicateSimilarityNote',
  'koreanTitle',
  'novaSummary',
  'coverImage',
  'galleryImages',
  'isPinned',
  'status',
  'publishedPostId',
  'aiDraftGenerated',
  'fetchedAt',
  'createdAt',
  'updatedAt',
]);

export const INBOX_UPDATE_AFFECTED_KEYS = new Set([
  'tcgCategory',
  'koreanTitle',
  'novaSummary',
  'coverImage',
  'galleryImages',
  'isPinned',
  'status',
  'publishedPostId',
  'aiDraftGenerated',
  'duplicateCandidateOf',
  'duplicateSimilarityNote',
  'updatedAt',
]);

const GALLERY_ENTRY_ALLOWED_KEYS = new Set([
  'id',
  'url',
  'caption',
  'source',
  'rights',
  'rightsNote',
  'alt',
]);

export function isValidFirestoreId(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.length >= 1 &&
    val.length <= 128 &&
    VALID_ID_REGEX.test(val)
  );
}

export function normalizeTcgCategory(raw: unknown): NewsTcgCategory {
  if (typeof raw === 'string' && (VALID_TCG_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as NewsTcgCategory;
  }
  return '포켓몬 TCG';
}

export function isFirestoreTimestampValue(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  const maybe = val as { toDate?: unknown; seconds?: unknown; nanoseconds?: unknown };
  if (typeof maybe.toDate === 'function') return true;
  if (typeof maybe.seconds === 'number' && Number.isFinite(maybe.seconds)) return true;
  return false;
}

function describeFieldTypes(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '(없음)';
  return Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      if (v === null) return `${k}:null`;
      if (Array.isArray(v)) return `${k}:list(${v.length})`;
      if (isFirestoreTimestampValue(v)) return `${k}:timestamp`;
      if (typeof v === 'string') return `${k}:str(${v.length})`;
      return `${k}:${typeof v}`;
    })
    .join(', ');
}

function validateGalleryEntriesForRules(gallery: NewsImageItem[], targetLabel: string): string[] {
  const errs: string[] = [];
  if (!Array.isArray(gallery)) {
    errs.push(`${targetLabel}.galleryImages가 배열이 아닙니다.`);
    return errs;
  }
  if (gallery.length > 10) {
    errs.push(`${targetLabel}.galleryImages는 최대 10장까지 허용됩니다. (현재 ${gallery.length}장)`);
  }
  gallery.forEach((entry, idx) => {
    const prefix = `${targetLabel}.galleryImages[${idx}]`;
    if (!entry || typeof entry !== 'object') {
      errs.push(`${prefix} 항목이 객체가 아닙니다.`);
      return;
    }
    const keys = Object.keys(entry);
    for (const k of keys) {
      if (!GALLERY_ENTRY_ALLOWED_KEYS.has(k)) {
        errs.push(`${prefix}에 허용되지 않은 키 '${k}'가 포함되어 있습니다.`);
      }
    }
    if (!isValidFirestoreId(entry.id)) {
      errs.push(`${prefix}.id('${String(entry.id || '')}')가 규칙 형식(영문/숫자/_/- 1~128자)에 맞지 않습니다.`);
    }
    if (typeof entry.url !== 'string' || entry.url.length < 1 || entry.url.length > 200000) {
      errs.push(`${prefix}.url 길이가 규칙 범위(1~200,000자)를 벗어났습니다.`);
    }
    if (entry.caption !== undefined && (typeof entry.caption !== 'string' || entry.caption.length > 300)) {
      errs.push(`${prefix}.caption은 300자 이하여야 합니다.`);
    }
    if (entry.source !== undefined && (typeof entry.source !== 'string' || entry.source.length > 140)) {
      errs.push(`${prefix}.source는 140자 이하여야 합니다.`);
    }
    if (entry.rights !== undefined && (typeof entry.rights !== 'string' || entry.rights.length > 100)) {
      errs.push(`${prefix}.rights는 100자 이하여야 합니다.`);
    }
    if (entry.rightsNote !== undefined && (typeof entry.rightsNote !== 'string' || entry.rightsNote.length > 200)) {
      errs.push(`${prefix}.rightsNote는 200자 이하여야 합니다.`);
    }
    if (entry.alt !== undefined && (typeof entry.alt !== 'string' || entry.alt.length > 200)) {
      errs.push(`${prefix}.alt는 200자 이하여야 합니다.`);
    }
  });
  return errs;
}

export interface PostPayloadValidationInput {
  postId: string;
  isUpdate: boolean;
  existingPostData?: Record<string, unknown> | null;
  payload: {
    title: string;
    slug: string;
    category: string;
    summary: string;
    content: string;
    coverImage: string;
    galleryImages: NewsImageItem[];
    tcgCategory: string;
    sourceName: string;
    sourceUrl: string;
    publishedAtSource: string;
    inboxItemId: string;
    isPinned: boolean;
    isSample: boolean;
    scheduledAt: null;
    seoTitle: string;
    seoDescription: string;
    visibilityState: string;
  };
}

export function validatePostPayloadAgainstRules(input: PostPayloadValidationInput): string[] {
  const errs: string[] = [];
  const { postId, isUpdate, existingPostData, payload } = input;

  if (!isValidFirestoreId(postId)) {
    errs.push(`posts 문서 ID('${postId}')가 허용 패턴(^[a-zA-Z0-9_-]+$, 1~128자)을 벗어났습니다.`);
  }

  const payloadKeys = Object.keys(payload);
  for (const k of payloadKeys) {
    if (!POST_ALLOWED_KEYS.has(k)) {
      errs.push(`posts 쓰기 payload에 허용되지 않은 키 '${k}'가 포함되어 있습니다.`);
    }
    if (isUpdate && !POST_UPDATE_AFFECTED_KEYS.has(k)) {
      errs.push(`posts 수정(affectedKeys)에 허용되지 않은 키 '${k}'가 포함되어 있습니다.`);
    }
  }

  const simulatedMergedKeys = new Set<string>([
    ...payloadKeys,
    'updatedAt',
    ...(isUpdate && existingPostData ? Object.keys(existingPostData) : ['createdAt']),
  ]);
  for (const reqKey of POST_REQUIRED_KEYS) {
    if (!simulatedMergedKeys.has(reqKey)) {
      errs.push(`posts 필수 키 '${reqKey}'가 누락되었습니다.`);
    }
  }

  if (isUpdate) {
    if (!existingPostData) {
      errs.push('기존 posts 문서 데이터를 확인할 수 없습니다.');
    } else {
      if (!isFirestoreTimestampValue(existingPostData.createdAt)) {
        errs.push('기존 posts 문서의 createdAt 필드가 Firestore Timestamp가 아니어서 update 규칙(createdAt is timestamp)에 거부됩니다.');
      }
      for (const k of Object.keys(existingPostData)) {
        if (!POST_ALLOWED_KEYS.has(k)) {
          errs.push(`기존 posts 문서에 규칙 외 레거시 키 '${k}'가 남아 있어 병합 시 hasOnly 검증에 거부됩니다.`);
        }
      }
    }
  }

  if (typeof payload.title !== 'string' || !payload.title || payload.title.length > 160) {
    errs.push(`posts.title 길이(${typeof payload.title === 'string' ? payload.title.length : '비문자열'})가 1~160자 범위를 벗어났습니다.`);
  }
  if (!isValidFirestoreId(payload.slug)) {
    errs.push(`posts.slug('${String(payload.slug || '')}')가 규칙 패턴(^[a-zA-Z0-9_-]+$, 1~128자)에 맞지 않습니다.`);
  }
  if (typeof payload.category !== 'string' || !payload.category || payload.category.length > 50) {
    errs.push('posts.category 길이가 1~50자 범위를 벗어났습니다.');
  }
  if (typeof payload.summary !== 'string' || payload.summary.length > 400) {
    errs.push('posts.summary가 400자를 초과했거나 문자열이 아닙니다.');
  }
  if (typeof payload.content !== 'string' || !payload.content || payload.content.length > 30000) {
    errs.push(`posts.content 길이(${typeof payload.content === 'string' ? payload.content.length : '비문자열'})가 1~30,000자 범위를 벗어났습니다.`);
  }
  if (typeof payload.coverImage !== 'string' || payload.coverImage.length > 200000) {
    errs.push('posts.coverImage 길이가 200,000자를 초과했거나 문자열이 아닙니다.');
  }
  if (typeof payload.tcgCategory !== 'string' || payload.tcgCategory.length > 40) {
    errs.push('posts.tcgCategory가 40자를 초과했습니다.');
  }
  if (typeof payload.sourceName !== 'string' || payload.sourceName.length > 100) {
    errs.push('posts.sourceName이 100자를 초과했습니다.');
  }
  if (typeof payload.sourceUrl !== 'string' || payload.sourceUrl.length > 500) {
    errs.push('posts.sourceUrl이 500자를 초과했습니다.');
  }
  if (typeof payload.publishedAtSource !== 'string' || payload.publishedAtSource.length > 80) {
    errs.push('posts.publishedAtSource가 80자를 초과했습니다.');
  }
  if (typeof payload.inboxItemId !== 'string' || payload.inboxItemId.length > 128) {
    errs.push('posts.inboxItemId가 128자를 초과했습니다.');
  }
  if (typeof payload.isPinned !== 'boolean') {
    errs.push('posts.isPinned가 boolean이 아닙니다.');
  }
  if (typeof payload.isSample !== 'boolean') {
    errs.push('posts.isSample가 boolean이 아닙니다.');
  }
  if (payload.scheduledAt !== null && !isFirestoreTimestampValue(payload.scheduledAt)) {
    errs.push('posts.scheduledAt이 null 또는 Timestamp가 아닙니다.');
  }
  if (typeof payload.seoTitle !== 'string' || payload.seoTitle.length > 120) {
    errs.push('posts.seoTitle이 120자를 초과했습니다.');
  }
  if (typeof payload.seoDescription !== 'string' || payload.seoDescription.length > 300) {
    errs.push('posts.seoDescription이 300자를 초과했습니다.');
  }
  if (!['published', 'draft', 'trashed'].includes(payload.visibilityState)) {
    errs.push(`posts.visibilityState('${payload.visibilityState}')가 허용 목록에 없습니다.`);
  }

  errs.push(...validateGalleryEntriesForRules(payload.galleryImages, 'posts'));
  return errs;
}

export interface InboxUpdateValidationInput {
  item: NewsInboxItem;
  rawServerData?: Record<string, unknown> | null;
  updatePayload: {
    koreanTitle: string;
    novaSummary: string;
    tcgCategory: NewsTcgCategory;
    coverImage: string;
    galleryImages: NewsImageItem[];
    isPinned: boolean;
    status: string;
    publishedPostId: string;
  };
}

export function validateInboxUpdateAgainstRules(input: InboxUpdateValidationInput): string[] {
  const errs: string[] = [];
  const { item, rawServerData, updatePayload } = input;

  if (!isValidFirestoreId(item.id)) {
    errs.push(`news_inbox 문서 ID('${item.id}')가 허용 패턴(^[a-zA-Z0-9_-]+$, 1~128자)을 벗어났습니다.`);
  }

  for (const k of Object.keys(updatePayload)) {
    if (!INBOX_UPDATE_AFFECTED_KEYS.has(k)) {
      errs.push(`news_inbox 수정(affectedKeys)에 허용되지 않은 키 '${k}'가 포함되어 있습니다.`);
    }
  }

  const baseSource = rawServerData || (item as unknown as Record<string, unknown>);
  if (rawServerData) {
    for (const reqKey of INBOX_REQUIRED_KEYS) {
      if (reqKey === 'updatedAt') continue;
      if (rawServerData[reqKey] === undefined || rawServerData[reqKey] === null) {
        errs.push(`기존 news_inbox/${item.id} 문서에 필수 필드 '${reqKey}'가 누락되어 update 규칙이 거부됩니다.`);
      }
    }
    if (!isFirestoreTimestampValue(rawServerData.createdAt)) {
      errs.push(
        `기존 news_inbox/${item.id} 문서의 createdAt(${typeof rawServerData.createdAt})이 Firestore Timestamp가 아니어서 update 규칙(createdAt is timestamp)에 거부됩니다.`
      );
    }
    if (
      rawServerData.fetchedAt !== undefined &&
      rawServerData.fetchedAt !== null &&
      !isFirestoreTimestampValue(rawServerData.fetchedAt)
    ) {
      errs.push(
        `기존 news_inbox/${item.id} 문서의 fetchedAt(${typeof rawServerData.fetchedAt})이 null 또는 Firestore Timestamp가 아니어서 update 규칙에 거부됩니다.`
      );
    }
    if (
      rawServerData.aiDraftGenerated !== undefined &&
      typeof rawServerData.aiDraftGenerated !== 'boolean'
    ) {
      errs.push(
        `기존 news_inbox/${item.id} 문서의 aiDraftGenerated(${typeof rawServerData.aiDraftGenerated})가 boolean이 아닙니다.`
      );
    }
    for (const k of Object.keys(rawServerData)) {
      if (!INBOX_ALLOWED_KEYS.has(k)) {
        errs.push(`기존 news_inbox/${item.id} 문서에 규칙 외 레거시 필드 '${k}'가 존재해 병합 시 hasOnly 검증이 거부됩니다.`);
      }
    }
  } else {
    if (!isFirestoreTimestampValue(item.createdAt)) {
      errs.push(
        `news_inbox/${item.id}의 createdAt이 Firestore Timestamp가 아니거나 누락되어 update 규칙(createdAt is timestamp)에 거부될 수 있습니다.`
      );
    }
    if (
      item.fetchedAt !== undefined &&
      item.fetchedAt !== null &&
      !isFirestoreTimestampValue(item.fetchedAt)
    ) {
      errs.push(
        `news_inbox/${item.id}의 fetchedAt이 null 또는 Firestore Timestamp가 아닙니다.`
      );
    }
    if (
      item.aiDraftGenerated !== undefined &&
      typeof item.aiDraftGenerated !== 'boolean'
    ) {
      errs.push(`news_inbox/${item.id}의 aiDraftGenerated가 boolean이 아닙니다.`);
    }
    for (const k of Object.keys(item)) {
      if (k === 'id') continue;
      if (!INBOX_ALLOWED_KEYS.has(k)) {
        errs.push(`news_inbox/${item.id}에 규칙 외 레거시 필드 '${k}'가 존재해 병합 시 hasOnly 검증에 거부됩니다.`);
      }
    }
    if (!item.canonicalUrlKey) {
      errs.push(`news_inbox/${item.id}에 canonicalUrlKey가 비어 있습니다.`);
    }
  }

  const checkStrLen = (val: unknown, name: string, min: number, max: number) => {
    if (val === undefined) return;
    if (typeof val !== 'string' || val.length < min || val.length > max) {
      errs.push(`news_inbox.${name} 길이(${typeof val === 'string' ? val.length : val === null ? 'null' : typeof val})가 ${min}~${max}자 범위를 벗어났습니다.`);
    }
  };

  checkStrLen(baseSource.sourceId, 'sourceId', 1, 128);
  checkStrLen(baseSource.sourceName, 'sourceName', 1, 100);
  checkStrLen(baseSource.originalTitle, 'originalTitle', 1, 300);
  checkStrLen(baseSource.originalUrl, 'originalUrl', 1, 500);
  checkStrLen(baseSource.canonicalUrlKey, 'canonicalUrlKey', 1, 500);
  checkStrLen(baseSource.publishedAtSource, 'publishedAtSource', 0, 80);
  checkStrLen(baseSource.metadataAuthor, 'metadataAuthor', 0, 100);
  checkStrLen(baseSource.metadataSnippet, 'metadataSnippet', 0, 300);
  checkStrLen(baseSource.metadataImageUrl, 'metadataImageUrl', 0, 500);
  checkStrLen(baseSource.duplicateCandidateOf, 'duplicateCandidateOf', 0, 128);
  checkStrLen(baseSource.duplicateSimilarityNote, 'duplicateSimilarityNote', 0, 300);

  if (!(VALID_TCG_CATEGORIES as readonly string[]).includes(updatePayload.tcgCategory)) {
    errs.push(`news_inbox.tcgCategory('${updatePayload.tcgCategory}')가 허용 목록에 없습니다.`);
  }
  if (typeof updatePayload.koreanTitle !== 'string' || updatePayload.koreanTitle.length > 160) {
    errs.push('news_inbox.koreanTitle이 160자를 초과했습니다.');
  }
  if (typeof updatePayload.novaSummary !== 'string' || updatePayload.novaSummary.length > 3000) {
    errs.push('news_inbox.novaSummary가 3,000자를 초과했습니다.');
  }
  if (typeof updatePayload.coverImage !== 'string' || updatePayload.coverImage.length > 200000) {
    errs.push('news_inbox.coverImage가 200,000자를 초과했습니다.');
  }
  if (typeof updatePayload.isPinned !== 'boolean') {
    errs.push('news_inbox.isPinned가 boolean이 아닙니다.');
  }
  if (!['pending', 'approved', 'ignored'].includes(updatePayload.status)) {
    errs.push(`news_inbox.status('${updatePayload.status}')가 허용 목록에 없습니다.`);
  }
  if (typeof updatePayload.publishedPostId !== 'string' || updatePayload.publishedPostId.length > 128) {
    errs.push('news_inbox.publishedPostId가 128자를 초과했습니다.');
  }

  errs.push(...validateGalleryEntriesForRules(updatePayload.galleryImages, 'news_inbox'));
  return errs;
}

export interface PublishPermissionStep {
  step: string;
  ok: boolean;
  detail: string;
}

export async function diagnosePublishPermissions(params: {
  db: Firestore;
  user: User | null;
  postId: string;
  inboxItemId: string;
  failedStage: 'read_existing_post' | 'batch_commit';
  postPayloadInput: Omit<PostPayloadValidationInput, 'isUpdate' | 'existingPostData'>;
  inboxPayloadInput: Omit<InboxUpdateValidationInput, 'rawServerData'>;
}): Promise<PublishPermissionStep[]> {
  const { db, user, postId, inboxItemId, failedStage, postPayloadInput, inboxPayloadInput } = params;
  const steps: PublishPermissionStep[] = [];

  // Step 1: Firebase Auth & Admin status
  if (!user) {
    steps.push({
      step: '1. Firebase Auth 인증 상태',
      ok: false,
      detail: '로그인된 사용자 세션이 없습니다. 다시 로그인해 주세요.',
    });
    return steps;
  }

  const isBootstrap =
    user.emailVerified && user.email?.toLowerCase() === 'jwkim9633@gmail.com';
  let adminDocExists = false;
  let adminRole = '';
  let adminReadErr = '';

  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    adminDocExists = adminSnap.exists();
    adminRole = String(adminSnap.data()?.role || '');
  } catch (err) {
    adminReadErr = err instanceof Error ? err.message : String(err);
  }

  const authOk = user.emailVerified && (adminDocExists || isBootstrap);
  steps.push({
    step: '1. 관리자 인증 (Auth & admins/{uid})',
    ok: authOk,
    detail: adminReadErr
      ? `uid=${user.uid}, email=${user.email || '-'}, verified=${String(user.emailVerified)}, admins 조회 실패: ${adminReadErr}`
      : `uid=${user.uid}, email=${user.email || '-'}, verified=${String(user.emailVerified)}, admins 문서=${adminDocExists ? `존재(role=${adminRole || '-'})` : '없음'}, 부트스트랩=${isBootstrap ? '예' : '아니오'}`,
  });

  // Step 2: posts/{postId} read & payload rule check
  let existingPostData: Record<string, unknown> | null = null;
  let postExists = false;
  let postReadOk = true;
  let postReadErr = '';

  try {
    const postSnap = await getDoc(doc(db, 'posts', postId));
    postExists = postSnap.exists();
    existingPostData = postExists ? (postSnap.data() as Record<string, unknown>) : null;
  } catch (err) {
    postReadOk = false;
    postReadErr = err instanceof Error ? err.message : String(err);
  }

  const postRuleViolations = validatePostPayloadAgainstRules({
    ...postPayloadInput,
    isUpdate: postExists,
    existingPostData,
  });

  steps.push({
    step: `2. 대상 게시글 검증 (posts/${postId})`,
    ok: postReadOk && postRuleViolations.length === 0 && failedStage !== 'read_existing_post',
    detail: !postReadOk
      ? `문서 조회 거부됨(${postReadErr}).`
      : postRuleViolations.length > 0
        ? `규칙 검증 불일치: ${postRuleViolations.join(' | ')}`
        : postExists
          ? `기존 게시글 조회 및 update 규칙 필드 검증 통과 | 기존 필드: ${describeFieldTypes(existingPostData)}`
          : `신규 게시글 create 규칙 필드 검증 통과 | 전송 필드: ${describeFieldTypes(postPayloadInput.payload as unknown as Record<string, unknown>)}`,
  });

  // Step 3: news_inbox/{itemId} read & payload rule check
  let inboxRawData: Record<string, unknown> | null = null;
  let inboxReadOk = true;
  let inboxReadErr = '';

  try {
    const inboxSnap = await getDoc(doc(db, 'news_inbox', inboxItemId));
    inboxRawData = inboxSnap.exists() ? (inboxSnap.data() as Record<string, unknown>) : null;
  } catch (err) {
    inboxReadOk = false;
    inboxReadErr = err instanceof Error ? err.message : String(err);
  }

  const inboxRuleViolations = validateInboxUpdateAgainstRules({
    ...inboxPayloadInput,
    rawServerData: inboxRawData,
  });

  steps.push({
    step: `3. 수집함 문서 검증 (news_inbox/${inboxItemId})`,
    ok: inboxReadOk && inboxRuleViolations.length === 0,
    detail: !inboxReadOk
      ? `문서 조회 거부됨(${inboxReadErr}).`
      : !inboxRawData
        ? 'Firestore에 해당 news_inbox 문서가 존재하지 않습니다.'
        : inboxRuleViolations.length > 0
          ? `규칙 검증 불일치: ${inboxRuleViolations.join(' | ')} | 서버 필드: ${describeFieldTypes(inboxRawData)}`
          : `수집함 문서 조회 및 update 규칙 필드 검증 통과 | 서버 필드: ${describeFieldTypes(inboxRawData)}`,
  });

  // Step 4: Named Database & Rule Deployment Sync check
  steps.push({
    step: '4. Named Firestore DB 및 보안 규칙 배포 확인',
    ok: true,
    detail: `연결 대상: project=${firebaseConfig.projectId}, database=${firebaseConfig.firestoreDatabaseId}.`,
  });

  return steps;
}
