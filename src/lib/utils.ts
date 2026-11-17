import {
  DropCurrency,
  DropStatusLabel,
  RetailCampaign,
  RetailDrop,
} from '../types/nova';

export function formatKRW(price: number): string {
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.round(price)))}`;
}

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybe.toDate === 'function') {
      const d = maybe.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof maybe.seconds === 'number') {
      return new Date(maybe.seconds * 1000);
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatKST(value: unknown, withTime = true): string {
  const date = toDateSafe(value);
  if (!date) return '-';
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      : {}),
  };
  return new Intl.DateTimeFormat('ko-KR', opts).format(date);
}

export function toKSTDatetimeLocalInput(value: unknown): string {
  const date = toDateSafe(value);
  if (!date) return '';
  const kstString = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return kstString.replace(' ', 'T');
}

export function fromKSTDatetimeLocalInput(val: string): Date | null {
  if (!val) return null;
  const iso = val.length === 16 ? `${val}:00+09:00` : `${val}+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getKSTDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now().toString(36)}_${rand}`;
}

export function isScheduledVisible(scheduledAt: unknown): boolean {
  const date = toDateSafe(scheduledAt);
  if (!date) return true;
  return date.getTime() <= Date.now();
}

export function getEventStatus(startAt: unknown, endAt: unknown): '예정' | '진행 중' | '종료됨' {
  const now = Date.now();
  const start = toDateSafe(startAt)?.getTime() ?? 0;
  const end = toDateSafe(endAt)?.getTime() ?? 0;
  if (end > 0 && now > end) return '종료됨';
  if (start > 0 && now >= start && (end === 0 || now <= end)) return '진행 중';
  return '예정';
}

export function getInstagramDmUrl(instagramUrl: string): string {
  if (!instagramUrl) return '';
  try {
    const parsed = new URL(instagramUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && !['p', 'reel', 'stories', 'explore'].includes(parts[0])) {
      return `https://ig.me/m/${parts[0]}`;
    }
    return instagramUrl;
  } catch {
    return instagramUrl;
  }
}

export function getGmailComposeUrl(email: string, subject?: string, body?: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: email,
  });
  if (subject) params.set('su', subject);
  if (body) params.set('body', body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function copyToClipboardSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `post-${Date.now().toString(36)}`;
}

export function isValidExternalUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isRetailRaffleCategory(category?: string): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return (
    c.includes('정가') ||
    c.includes('추첨') ||
    c.includes('래플') ||
    c.includes('사전예약') ||
    c.includes('드롭') ||
    c.includes('retail') ||
    c.includes('raffle') ||
    c.includes('drop')
  );
}

export function normalizeHomeSections<
  T extends { id: string; label: string; visible: boolean; order: number; limit: number }
>(existing: T[] | undefined, defaults: T[]): T[] {
  if (!existing || existing.length === 0) return defaults;
  const hasRetailRaffle = existing.some((s) => s.id === 'retail_raffle');
  if (!hasRetailRaffle) {
    // Non-destructively upgrade legacy pre-media layout to new recommended priority order
    // while keeping any admin-configured visibility and limit preferences.
    const existingMap = new Map(existing.map((s) => [s.id, s]));
    return defaults.map((def, idx) => {
      const prev = existingMap.get(def.id);
      return prev
        ? { ...def, visible: prev.visible, limit: prev.limit, order: idx }
        : { ...def, order: idx };
    });
  }
  const existingIds = new Set(existing.map((s) => s.id));
  const missing = defaults.filter((d) => !existingIds.has(d.id));
  return [...existing, ...missing.map((m, i) => ({ ...m, order: existing.length + i }))];
}

export function formatDropPrice(price: number, currency: DropCurrency): string {
  const safe = Math.max(0, Number.isFinite(price) ? price : 0);
  if (currency === 'JPY') {
    return `¥${new Intl.NumberFormat('ja-JP').format(Math.round(safe))}`;
  }
  if (currency === 'USD') {
    return `$${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(safe)}`;
  }
  return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(safe))}`;
}

export function resolveTimezoneIana(tzLabel?: string): { iana: string; label: string } {
  const clean = (tzLabel || '').trim().toUpperCase();
  if (clean === 'JST' || clean === 'ASIA/TOKYO') {
    return { iana: 'Asia/Tokyo', label: 'JST' };
  }
  if (clean === 'EST' || clean === 'EDT' || clean === 'ET' || clean === 'AMERICA/NEW_YORK') {
    return { iana: 'America/New_York', label: clean || 'ET' };
  }
  if (clean === 'PST' || clean === 'PDT' || clean === 'PT' || clean === 'AMERICA/LOS_ANGELES') {
    return { iana: 'America/Los_Angeles', label: clean || 'PT' };
  }
  return { iana: 'Asia/Seoul', label: tzLabel?.trim() || 'KST' };
}

export function formatDropDateTime(value: unknown, timezoneLabel?: string): string {
  const date = toDateSafe(value);
  if (!date) return '-';
  const { iana, label } = resolveTimezoneIana(timezoneLabel);
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: iana,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${formatted.replace(/-/g, '.')} ${label}`;
}

export function resolveEffectiveDrop(drop: RetailDrop, campaign?: RetailCampaign): RetailDrop {
  if (!campaign) return drop;
  return {
    ...drop,
    retailer: campaign.retailer || drop.retailer,
    country: campaign.country || drop.country,
    saleType: campaign.saleType || drop.saleType,
    timezoneLabel: campaign.timezoneLabel || drop.timezoneLabel,
    startAt: campaign.startAt ?? drop.startAt,
    endAt: campaign.endAt ?? drop.endAt,
    purchaseWindowText: campaign.purchaseWindowText || drop.purchaseWindowText,
    conditions: campaign.conditions || drop.conditions,
    verifiedAt: campaign.verifiedAt ?? drop.verifiedAt,
    archiveEnded: drop.archiveEnded || campaign.archiveEnded,
  };
}

export interface DropComputedStatus {
  label: DropStatusLabel;
  isEnded: boolean;
  isUrgent: boolean;
  isActive: boolean;
}

export function getDropStatusInfo(drop: RetailDrop, nowMs = Date.now()): DropComputedStatus {
  const start = toDateSafe(drop.startAt)?.getTime() ?? 0;
  const end = toDateSafe(drop.endAt)?.getTime() ?? 0;

  if (drop.saleType === '추첨 판매') {
    if (end > 0 && nowMs > end) {
      return { label: '응모 종료', isEnded: true, isUrgent: false, isActive: false };
    }
    if (
      drop.manualStatus &&
      drop.manualStatus !== 'auto' &&
      ['예정', '응모 중', '마감 임박', '응모 종료'].includes(drop.manualStatus)
    ) {
      const m = drop.manualStatus as DropStatusLabel;
      return {
        label: m,
        isEnded: m === '응모 종료',
        isUrgent: m === '마감 임박',
        isActive: m === '응모 중' || m === '마감 임박',
      };
    }
    if (start > 0 && nowMs < start) {
      return { label: '예정', isEnded: false, isUrgent: false, isActive: false };
    }
    if (end > 0 && end - nowMs <= 24 * 60 * 60 * 1000) {
      return { label: '마감 임박', isEnded: false, isUrgent: true, isActive: true };
    }
    return { label: '응모 중', isEnded: false, isUrgent: false, isActive: true };
  }

  if (drop.saleType === '일반 정가 판매') {
    // Never assume live in-stock solely from clock
    if (drop.manualStatus === '판매 확인') {
      return { label: '판매 확인', isEnded: false, isUrgent: false, isActive: true };
    }
    if (drop.manualStatus === '품절 확인') {
      return { label: '품절 확인', isEnded: true, isUrgent: false, isActive: false };
    }
    return { label: '재확인 필요', isEnded: false, isUrgent: false, isActive: false };
  }

  // 선착순 판매 & 예약 판매
  if (end > 0 && nowMs > end) {
    return { label: '종료', isEnded: true, isUrgent: false, isActive: false };
  }
  if (
    drop.manualStatus &&
    drop.manualStatus !== 'auto' &&
    ['시작 예정', '접수 중', '종료', '확인 필요'].includes(drop.manualStatus)
  ) {
    const m = drop.manualStatus as DropStatusLabel;
    return {
      label: m,
      isEnded: m === '종료',
      isUrgent: m === '접수 중' && end > 0 && end - nowMs <= 24 * 60 * 60 * 1000,
      isActive: m === '접수 중',
    };
  }
  if (start > 0 && nowMs < start) {
    return { label: '시작 예정', isEnded: false, isUrgent: false, isActive: false };
  }
  if (start > 0 && nowMs >= start && (end === 0 || nowMs <= end)) {
    return {
      label: '접수 중',
      isEnded: false,
      isUrgent: end > 0 && end - nowMs <= 24 * 60 * 60 * 1000,
      isActive: true,
    };
  }
  return { label: '확인 필요', isEnded: false, isUrgent: false, isActive: false };
}

