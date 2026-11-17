import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_SITE_CONFIG,
  INITIAL_FAQS_SEED,
  INITIAL_RETAIL_CAMPAIGNS_SEED,
  INITIAL_RETAIL_DROPS_SEED,
  INITIAL_SAMPLE_EVENTS,
  INITIAL_SAMPLE_NOTICES,
  INITIAL_SAMPLE_POSTS,
  INITIAL_SAMPLE_PRODUCTS,
  INITIAL_SAMPLE_REVIEWS,
  INITIAL_SPONSORS_SEED,
} from './defaults';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function seedRakutenNovemberCampaign(): Promise<{ created: number }> {
  let created = 0;
  try {
    for (const camp of INITIAL_RETAIL_CAMPAIGNS_SEED) {
      const ref = doc(db, 'retail_campaigns', camp.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...campFields } = camp;
        await setDoc(ref, {
          ...campFields,
          startAt: camp.startAt ? Timestamp.fromDate(new Date(camp.startAt as string)) : null,
          endAt: camp.endAt ? Timestamp.fromDate(new Date(camp.endAt as string)) : null,
          verifiedAt: camp.verifiedAt ? Timestamp.fromDate(new Date(camp.verifiedAt as string)) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    }

    for (const drop of INITIAL_RETAIL_DROPS_SEED) {
      const ref = doc(db, 'retail_drops', drop.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const { id: _id, ...dropFields } = drop;
        await setDoc(ref, {
          ...dropFields,
          startAt: drop.startAt ? Timestamp.fromDate(new Date(drop.startAt as string)) : null,
          endAt: drop.endAt ? Timestamp.fromDate(new Date(drop.endAt as string)) : null,
          verifiedAt: drop.verifiedAt ? Timestamp.fromDate(new Date(drop.verifiedAt as string)) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    }

    return { created };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedRakutenNovemberCampaign');
  }
}

export async function seedInitialData(adminUid: string, includeSamples = true): Promise<{ created: number }> {
  let created = 0;

  try {
    // 1. Site config (published & draft) if missing
    const pubSnap = await getDoc(doc(db, 'site_config', 'published'));
    if (!pubSnap.exists()) {
      await setDoc(doc(db, 'site_config', 'published'), {
        ...DEFAULT_SITE_CONFIG,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      created++;
    }
    const draftSnap = await getDoc(doc(db, 'site_config', 'draft'));
    if (!draftSnap.exists()) {
      await setDoc(doc(db, 'site_config', 'draft'), {
        ...DEFAULT_SITE_CONFIG,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
      created++;
    }

    // 2. Real partner: REPACK
    for (const sponsor of INITIAL_SPONSORS_SEED) {
      const ref = doc(db, 'sponsors', sponsor.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ...sponsor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    }

    // 3. Initial 4 FAQs
    for (const faq of INITIAL_FAQS_SEED) {
      const ref = doc(db, 'faqs', faq.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ...faq,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    }

    // 4. First real retail campaign & 11 products (Rakuten Books Nov 2026)
    const rakutenRes = await seedRakutenNovemberCampaign();
    created += rakutenRes.created;

    if (includeSamples) {
      for (const product of INITIAL_SAMPLE_PRODUCTS) {
        const ref = doc(db, 'products', product.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            ...product,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        }
      }

      for (const notice of INITIAL_SAMPLE_NOTICES) {
        const ref = doc(db, 'notices', notice.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            ...notice,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        }
      }

      for (const post of INITIAL_SAMPLE_POSTS) {
        const ref = doc(db, 'posts', post.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            ...post,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        }
      }

      for (const ev of INITIAL_SAMPLE_EVENTS) {
        const ref = doc(db, 'events', ev.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            ...ev,
            startAt: Timestamp.fromDate(new Date(ev.startAt as string)),
            endAt: Timestamp.fromDate(new Date(ev.endAt as string)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        }
      }

      for (const review of INITIAL_SAMPLE_REVIEWS) {
        const ref = doc(db, 'reviews', review.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            ...review,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        }
      }
    }

    return { created };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedInitialData');
  }
}

export async function deleteAllSampleData(): Promise<{ deleted: number }> {
  const sampleCollections = ['products', 'posts', 'notices', 'events', 'reviews'] as const;
  let deleted = 0;

  try {
    for (const colName of sampleCollections) {
      const q = query(collection(db, colName), where('isSample', '==', true));
      const snap = await getDocs(q);
      if (snap.empty) continue;

      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
        deleted++;
      });
      await batch.commit();
    }
    return { deleted };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'sampleCollections');
  }
}

export async function hardDeleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
}
