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
