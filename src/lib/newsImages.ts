import { NewsImageItem } from '../types/nova';
import { generateSafeId } from './utils';

export const MAX_NEWS_GALLERY_IMAGES = 10;

export const NEWS_IMAGE_RIGHTS_PRESETS = [
  '공식 보도자료 · 출처 표기',
  '저작권자 사용 허가',
  '자체 제작 · 직접 촬영',
  '퍼블릭 도메인 · CC',
  '보도 참고 · 제한적 인용',
  '권한 확인 필요',
] as const;

export function isValidImageUrlValue(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeGalleryImages(raw: unknown): NewsImageItem[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: NewsImageItem[] = [];
  const usedIds = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<NewsImageItem>;
    const url = typeof item.url === 'string' ? item.url.trim().slice(0, 200000) : '';
    if (!isValidImageUrlValue(url)) continue;

    const rawId = typeof item.id === 'string' ? item.id.trim() : '';
    let safeId = /^[a-zA-Z0-9_\-]{1,128}$/.test(rawId)
      ? rawId
      : generateSafeId('img');
    while (usedIds.has(safeId)) {
      safeId = generateSafeId('img');
    }
    usedIds.add(safeId);

    const normalized: NewsImageItem = {
      id: safeId,
      url,
    };

    const caption = typeof item.caption === 'string' ? item.caption.trim().slice(0, 300) : '';
    const source = typeof item.source === 'string' ? item.source.trim().slice(0, 140) : '';
    const rights = typeof item.rights === 'string' ? item.rights.trim().slice(0, 100) : '';
    const rightsNote = typeof item.rightsNote === 'string' ? item.rightsNote.trim().slice(0, 200) : '';
    const alt = typeof item.alt === 'string' ? item.alt.trim().slice(0, 200) : '';

    if (caption) normalized.caption = caption;
    if (source) normalized.source = source;
    if (rights) normalized.rights = rights;
    if (rightsNote) normalized.rightsNote = rightsNote;
    if (alt) normalized.alt = alt;

    cleaned.push(normalized);
    if (cleaned.length >= MAX_NEWS_GALLERY_IMAGES) break;
  }

  return cleaned;
}

export const IMAGE_TOKEN_REGEX = /\[\[image:([a-zA-Z0-9_\-]+)\]\]/g;

export function hasExplicitImagePlacement(content: string, image: NewsImageItem, index: number): boolean {
  if (!content) return false;
  if (content.includes(`[[image:${image.id}]]`)) return true;
  if (content.includes(`[[image:${index + 1}]]`)) return true;
  return false;
}

export function stripImageTokens(content: string): string {
  return content.replace(IMAGE_TOKEN_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
}

export type ArticleSegment =
  | { type: 'markdown'; text: string }
  | { type: 'image'; image: NewsImageItem; orderIndex: number }
  | { type: 'gallery_group'; images: Array<{ image: NewsImageItem; orderIndex: number }> };

/**
 * Splits article markdown content into ordered segments:
 * 1) Explicit [[image:id]] / [[image:1BasedIndex]] markers render inline at exact position.
 * 2) Unplaced galleryImages are interleaved naturally between body blocks BEFORE the
 *    trailing "--- / ### 원문 출처 안내" section so images never get stuck at the very bottom.
 */
export function buildArticleSegments(
  content: string,
  galleryImages: NewsImageItem[] = []
): ArticleSegment[] {
  const safeImages = sanitizeGalleryImages(galleryImages);
  const byId = new Map<string, { image: NewsImageItem; orderIndex: number }>();
  safeImages.forEach((img, idx) => {
    byId.set(img.id, { image: img, orderIndex: idx });
    byId.set(String(idx + 1), { image: img, orderIndex: idx });
  });

  const placedIds = new Set<string>();
  const explicitSegments: ArticleSegment[] = [];

  // Parse explicit [[image:...]] markers across the full content
  let lastIndex = 0;
  const regex = new RegExp(IMAGE_TOKEN_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      explicitSegments.push({ type: 'markdown', text: before });
    }
    const key = match[1];
    const resolved = byId.get(key);
    if (resolved) {
      explicitSegments.push({
        type: 'image',
        image: resolved.image,
        orderIndex: resolved.orderIndex,
      });
      placedIds.add(resolved.image.id);
    }
    lastIndex = match.index + match[0].length;
  }

  const tail = content.slice(lastIndex);
  if (tail.trim()) {
    explicitSegments.push({ type: 'markdown', text: tail });
  }

  const unplaced = safeImages
    .map((image, orderIndex) => ({ image, orderIndex }))
    .filter((entry) => !placedIds.has(entry.image.id));

  if (unplaced.length === 0) {
    return explicitSegments.length > 0
      ? explicitSegments
      : [{ type: 'markdown', text: content }];
  }

  // If explicit markers were already placed in the body, render any remaining unplaced images
  // right before the trailing source divider (or at the end of the main body).
  if (placedIds.size > 0) {
    const result: ArticleSegment[] = [];
    let insertedRemaining = false;

    for (const seg of explicitSegments) {
      if (seg.type === 'markdown' && !insertedRemaining) {
        const dividerIdx = seg.text.search(/\n---\s*\n/);
        if (dividerIdx !== -1) {
          const beforeDiv = seg.text.slice(0, dividerIdx);
          const afterDiv = seg.text.slice(dividerIdx);
          if (beforeDiv.trim()) result.push({ type: 'markdown', text: beforeDiv });
          result.push({ type: 'gallery_group', images: unplaced });
          if (afterDiv.trim()) result.push({ type: 'markdown', text: afterDiv });
          insertedRemaining = true;
          continue;
        }
      }
      result.push(seg);
    }

    if (!insertedRemaining) {
      result.push({ type: 'gallery_group', images: unplaced });
    }
    return result;
  }

  // No explicit markers at all: separate trailing "원문 출처 안내" footer if present,
  // then interleave unplaced images cleanly between paragraphs/blocks of the main body.
  const dividerMatch = content.match(/\n---\s*\n(?=[\s\S]*원문 출처 안내)/);
  const mainBody = dividerMatch && dividerMatch.index !== undefined
    ? content.slice(0, dividerMatch.index)
    : content;
  const trailingFooter = dividerMatch && dividerMatch.index !== undefined
    ? content.slice(dividerMatch.index)
    : '';

  const rawBlocks = mainBody
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // If the article body is a single dense multi-sentence paragraph (common in quick summaries),
  // gently split sentence boundaries into readable paragraphs so images weave mid-article instead of bottom-only.
  let bodyBlocks = rawBlocks;
  if (rawBlocks.length <= 2) {
    const expanded: string[] = [];
    for (const block of rawBlocks) {
      const isSpecialMarkdown = /^(#|>|- |\* |\d+\. |```)/.test(block);
      if (isSpecialMarkdown) {
        expanded.push(block);
        continue;
      }
      const sentences = block
        .split(/(?<=[.!?다요])\s+(?=[A-Z가-힣0-9"'\(\[])/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sentences.length >= 3) {
        // Group ~2 sentences per paragraph block for clean editorial pacing
        for (let i = 0; i < sentences.length; i += 2) {
          expanded.push(sentences.slice(i, i + 2).join(' '));
        }
      } else {
        expanded.push(block);
      }
    }
    bodyBlocks = expanded;
  }

  const output: ArticleSegment[] = [];
  if (bodyBlocks.length === 0) {
    output.push({ type: 'gallery_group', images: unplaced });
  } else if (bodyBlocks.length === 1) {
    output.push({ type: 'markdown', text: bodyBlocks[0] });
    output.push({ type: 'image', image: unplaced[0].image, orderIndex: unplaced[0].orderIndex });
    if (unplaced.length > 1) {
      output.push({ type: 'gallery_group', images: unplaced.slice(1) });
    }
  } else {
    // Distribute up to bodyBlocks.length images evenly mid-article (after block 0, 1, ...)
    // Avoid dumping everything after the last block if there are >= 2 blocks.
    const slotCount = bodyBlocks.length;
    const inlineCount = Math.min(unplaced.length, slotCount);
    const step = Math.max(1, Math.floor(slotCount / inlineCount));

    let nextImgIdx = 0;
    for (let b = 0; b < bodyBlocks.length; b++) {
      output.push({ type: 'markdown', text: bodyBlocks[b] });

      const shouldPlaceHere =
        nextImgIdx < inlineCount &&
        ((b + 1) % step === 0 || b === bodyBlocks.length - 1);

      if (shouldPlaceHere) {
        const entry = unplaced[nextImgIdx++];
        output.push({ type: 'image', image: entry.image, orderIndex: entry.orderIndex });
      }
    }

    // In case step skipped placing one before loop ended
    const leftover: Array<{ image: NewsImageItem; orderIndex: number }> = [];
    while (nextImgIdx < unplaced.length) {
      leftover.push(unplaced[nextImgIdx++]);
    }
    if (leftover.length === 1) {
      output.push({ type: 'image', image: leftover[0].image, orderIndex: leftover[0].orderIndex });
    } else if (leftover.length > 1) {
      output.push({ type: 'gallery_group', images: leftover });
    }
  }

  if (trailingFooter.trim()) {
    output.push({ type: 'markdown', text: trailingFooter });
  }

  return output;
}
