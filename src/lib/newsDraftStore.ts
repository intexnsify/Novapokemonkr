import { sanitizeGalleryImages } from './newsImages';
import { formatKST, toDateSafe } from './utils';
import { NewsImageItem, NewsInboxItem, NewsTcgCategory } from '../types/nova';

export interface NewsDraftData {
  koreanTitle: string;
  novaSummary: string;
  tcgCategory: NewsTcgCategory;
  coverImage: string;
  galleryImages: NewsImageItem[];
  isPinned: boolean;
}

export interface StoredLocalDraft {
  draft: NewsDraftData;
  localSavedAt: string;
  baseServerUpdatedAtMs: number;
  isDirty: boolean;
}

export type RevisionReason = 'manual_save' | 'publish' | 'ai_draft' | 'restore_backup';

export interface NewsRevisionEntry {
  id: string;
  savedAt: string;
  reason: RevisionReason;
  label: string;
  draft: NewsDraftData;
}

const DRAFT_PREFIX = 'nova_news_draft_v1:';
const REVISION_PREFIX = 'nova_news_revisions_v1:';
const ACTIVE_ITEM_KEY = 'nova_news_active_item_v1';
const MAX_REVISIONS_PER_ITEM = 10;

export function getServerUpdatedAtMs(item: NewsInboxItem): number {
  return toDateSafe(item.updatedAt)?.getTime() ?? toDateSafe(item.createdAt)?.getTime() ?? 0;
}

export function draftFromInboxItem(item: NewsInboxItem): NewsDraftData {
  return {
    koreanTitle: item.koreanTitle || '',
    novaSummary: item.novaSummary || '',
    tcgCategory: item.tcgCategory || '포켓몬 TCG',
    coverImage: item.coverImage || '',
    galleryImages: sanitizeGalleryImages(item.galleryImages),
    isPinned: Boolean(item.isPinned),
  };
}

export function areDraftsEqual(a: NewsDraftData, b: NewsDraftData): boolean {
  if (
    a.koreanTitle !== b.koreanTitle ||
    a.novaSummary !== b.novaSummary ||
    a.tcgCategory !== b.tcgCategory ||
    a.coverImage !== b.coverImage ||
    Boolean(a.isPinned) !== Boolean(b.isPinned) ||
    a.galleryImages.length !== b.galleryImages.length
  ) {
    return false;
  }

  for (let i = 0; i < a.galleryImages.length; i++) {
    const ia = a.galleryImages[i];
    const ib = b.galleryImages[i];
    if (
      ia.id !== ib.id ||
      ia.url !== ib.url ||
      (ia.caption || '') !== (ib.caption || '') ||
      (ia.source || '') !== (ib.source || '') ||
      (ia.rights || '') !== (ib.rights || '') ||
      (ia.rightsNote || '') !== (ib.rightsNote || '') ||
      (ia.alt || '') !== (ib.alt || '')
    ) {
      return false;
    }
  }
  return true;
}

function utf8ByteLength(str: string): number {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length * 2;
  }
}

export function estimateInboxDocBytes(item: NewsInboxItem, draft: NewsDraftData): number {
  const payload = {
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    originalTitle: item.originalTitle,
    originalUrl: item.originalUrl,
    canonicalUrlKey: item.canonicalUrlKey,
    publishedAtSource: item.publishedAtSource || '',
    tcgCategory: draft.tcgCategory,
    metadataAuthor: item.metadataAuthor || '',
    metadataSnippet: item.metadataSnippet || '',
    metadataImageUrl: item.metadataImageUrl || '',
    koreanTitle: draft.koreanTitle.trim().slice(0, 160),
    novaSummary: draft.novaSummary.trim().slice(0, 3000),
    coverImage: draft.coverImage.trim().slice(0, 200000),
    galleryImages: sanitizeGalleryImages(draft.galleryImages),
    isPinned: draft.isPinned,
    status: item.status,
    publishedPostId: item.publishedPostId || '',
  };
  return utf8ByteLength(JSON.stringify(payload)) + 512;
}

export function estimatePostDocBytes(
  item: NewsInboxItem,
  draft: NewsDraftData,
  markdownContent: string
): number {
  const payload = {
    title: (draft.koreanTitle || item.originalTitle).trim().slice(0, 160),
    category: 'TCG 뉴스',
    tcgCategory: draft.tcgCategory,
    sourceName: item.sourceName.slice(0, 100),
    sourceUrl: item.originalUrl.slice(0, 500),
    publishedAtSource: (item.publishedAtSource || '').slice(0, 80),
    inboxItemId: item.id,
    summary: draft.novaSummary.slice(0, 400),
    content: markdownContent.slice(0, 30000),
    coverImage: draft.coverImage.trim().slice(0, 200000),
    galleryImages: sanitizeGalleryImages(draft.galleryImages),
    isPinned: Boolean(draft.isPinned),
  };
  return utf8ByteLength(JSON.stringify(payload)) + 512;
}

export function buildNewsPostMarkdown(item: NewsInboxItem, novaSummary: string): string {
  const publishedLabel = item.publishedAtSource ? formatKST(item.publishedAtSource) : '-';
  return [
    `## NOVA 요약`,
    '',
    novaSummary.trim(),
    '',
    '---',
    '',
    `### 원문 출처 안내`,
    `- **출처**: ${item.sourceName}`,
    `- **원문 제목**: ${item.originalTitle}`,
    item.publishedAtSource ? `- **원문 발행일**: ${publishedLabel} KST` : '',
    `- **원문 링크**: [원문 기사 전체 보기](${item.originalUrl})`,
    '',
    `> 본 게시물은 해외 TCG 공식·커뮤니티 소식의 메타데이터를 바탕으로 NOVA 운영진이 직접 요약·편집한 아티클입니다. 상세 내용 및 공식 이미지는 원문 페이지를 참고해 주세요.`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 30000);
}

function pruneOldLocalStorage(excludeKey: string) {
  if (typeof window === 'undefined') return;
  try {
    const candidates: Array<{ key: string; ts: number; isCleanDraft: boolean }> = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === excludeKey) continue;
      if (k.startsWith(DRAFT_PREFIX)) {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(k) || '{}') as Partial<StoredLocalDraft>;
          candidates.push({
            key: k,
            ts: parsed.localSavedAt ? new Date(parsed.localSavedAt).getTime() || 0 : 0,
            isCleanDraft: parsed.isDirty === false,
          });
        } catch {
          candidates.push({ key: k, ts: 0, isCleanDraft: true });
        }
      } else if (k.startsWith(REVISION_PREFIX)) {
        candidates.push({ key: k, ts: 0, isCleanDraft: true });
      }
    }
    // Remove clean/old drafts & older revisions first, keeping dirty drafts longest
    candidates.sort((a, b) => {
      if (a.isCleanDraft !== b.isCleanDraft) return a.isCleanDraft ? -1 : 1;
      return a.ts - b.ts;
    });
    for (const c of candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)))) {
      window.localStorage.removeItem(c.key);
    }
  } catch {
    // ignore storage pruning errors
  }
}

export function loadLocalDraft(itemId: string): StoredLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${itemId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocalDraft>;
    if (!parsed || !parsed.draft) return null;
    return {
      draft: {
        koreanTitle: typeof parsed.draft.koreanTitle === 'string' ? parsed.draft.koreanTitle : '',
        novaSummary: typeof parsed.draft.novaSummary === 'string' ? parsed.draft.novaSummary : '',
        tcgCategory: parsed.draft.tcgCategory || '포켓몬 TCG',
        coverImage: typeof parsed.draft.coverImage === 'string' ? parsed.draft.coverImage : '',
        galleryImages: sanitizeGalleryImages(parsed.draft.galleryImages),
        isPinned: Boolean(parsed.draft.isPinned),
      },
      localSavedAt: parsed.localSavedAt || new Date().toISOString(),
      baseServerUpdatedAtMs: Number(parsed.baseServerUpdatedAtMs) || 0,
      isDirty: Boolean(parsed.isDirty),
    };
  } catch {
    return null;
  }
}

export function saveLocalDraft(
  itemId: string,
  record: StoredLocalDraft
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: false };
  const key = `${DRAFT_PREFIX}${itemId}`;
  const serialized = JSON.stringify(record);
  try {
    window.localStorage.setItem(key, serialized);
    return { ok: true };
  } catch {
    pruneOldLocalStorage(key);
    try {
      window.localStorage.setItem(key, serialized);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : '브라우저 로컬 저장 공간이 부족합니다.',
      };
    }
  }
}

export function clearLocalDraft(itemId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${DRAFT_PREFIX}${itemId}`);
  } catch {
    // ignore
  }
}

export function listDirtyLocalDraftIds(): Set<string> {
  const dirty = new Set<string>();
  if (typeof window === 'undefined') return dirty;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<StoredLocalDraft>;
      if (parsed?.isDirty) {
        dirty.add(k.slice(DRAFT_PREFIX.length));
      }
    }
  } catch {
    // ignore
  }
  return dirty;
}

export function loadRevisions(itemId: string): NewsRevisionEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${REVISION_PREFIX}${itemId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r && typeof r.id === 'string' && r.draft);
  } catch {
    return [];
  }
}

export function pushRevision(
  itemId: string,
  reason: RevisionReason,
  label: string,
  draft: NewsDraftData
): NewsRevisionEntry[] {
  if (typeof window === 'undefined') return [];
  const key = `${REVISION_PREFIX}${itemId}`;
  const existing = loadRevisions(itemId);
  const nextEntry: NewsRevisionEntry = {
    id: `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    reason,
    label,
    draft: {
      ...draft,
      galleryImages: sanitizeGalleryImages(draft.galleryImages),
    },
  };

  // Avoid pushing an identical back-to-back snapshot for manual_save
  if (existing.length > 0 && areDraftsEqual(existing[0].draft, nextEntry.draft) && reason === 'manual_save') {
    return existing;
  }

  let nextList = [nextEntry, ...existing].slice(0, MAX_REVISIONS_PER_ITEM);
  try {
    window.localStorage.setItem(key, JSON.stringify(nextList));
  } catch {
    // Trim history length if storage quota is tight
    nextList = nextList.slice(0, 3);
    try {
      window.localStorage.setItem(key, JSON.stringify(nextList));
    } catch {
      // ignore if browser quota is full
    }
  }
  return nextList;
}

export function getActiveEditingItemId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ACTIVE_ITEM_KEY) || window.localStorage.getItem(ACTIVE_ITEM_KEY);
  } catch {
    return null;
  }
}

export function setActiveEditingItemId(itemId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (itemId) {
      window.sessionStorage.setItem(ACTIVE_ITEM_KEY, itemId);
      window.localStorage.setItem(ACTIVE_ITEM_KEY, itemId);
    } else {
      window.sessionStorage.removeItem(ACTIVE_ITEM_KEY);
      window.localStorage.removeItem(ACTIVE_ITEM_KEY);
    }
  } catch {
    // ignore
  }
}
