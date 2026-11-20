import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirestoreQuotaError } from './firebase';
import { generateSafeId, getKSTDateKey } from './utils';

export type AnalyticsEventType =
  | 'page_view'
  | 'sponsor_click'
  | 'sponsor_impression'
  | 'action_click'
  | 'dm_click'
  | 'email_click';

let quotaPausedUntil = 0;

export async function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  path: string,
  extra?: {
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
  }
): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/admin')) return;
      if (Date.now() < quotaPausedUntil) return;

      if (eventType === 'page_view') {
        const cleanKey = `nova_pv_${(path || '/').slice(0, 120)}`;
        if (window.sessionStorage.getItem(cleanKey)) return;
        window.sessionStorage.setItem(cleanKey, '1');
      }
    }

    const id = generateSafeId('ev');
    const cleanPath = (path || '/').slice(0, 120);
    await setDoc(doc(db, 'analytics_events', id), {
      eventType,
      path: cleanPath,
      targetType: extra?.targetType ? extra.targetType.slice(0, 60) : '',
      targetId: extra?.targetId ? extra.targetId.slice(0, 128) : '',
      targetLabel: extra?.targetLabel ? extra.targetLabel.slice(0, 120) : '',
      dateKey: getKSTDateKey(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      quotaPausedUntil = Date.now() + 10 * 60 * 1000;
    }
    // Analytics must never interrupt visitor browsing
  }
}

export function trackSponsorImpressionOnce(
  sponsorId: string,
  sponsorName: string,
  placement: string,
  path: string
): void {
  try {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) return;
    const sessionKey = `nova_imp_${sponsorId}_${placement}`;
    if (window.sessionStorage.getItem(sessionKey)) return;
    window.sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Ignore storage restriction errors (e.g. strict private browsing)
  }

  void trackAnalyticsEvent('sponsor_impression', path, {
    targetType: placement,
    targetId: sponsorId,
    targetLabel: sponsorName,
  });
}
