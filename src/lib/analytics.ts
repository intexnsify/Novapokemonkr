import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { generateSafeId, getKSTDateKey } from './utils';

export type AnalyticsEventType =
  | 'page_view'
  | 'sponsor_click'
  | 'action_click'
  | 'dm_click'
  | 'email_click';

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
  } catch {
    // Analytics must never interrupt visitor browsing
  }
}
