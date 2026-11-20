import { getIdTokenResult, User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  Firestore,
  getDocFromServer,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, FirestoreErrorInfo, OperationType } from './firebase';
import { buildNewsPostMarkdown, NewsDraftData } from './newsDraftStore';
import { sanitizeGalleryImages } from './newsImages';
import { normalizeTcgCategory, isValidFirestoreId } from './newsPublishGuard';
import { sanitizeSlug } from './utils';
import { NewsInboxItem } from '../types/nova';

export interface BatchProbeResult {
  id: string;
  label: string;
  targetPath: string;
  operationType: OperationType;
  ok: boolean;
  code: string;
  message: string;
  durationMs: number;
  structuredError?: FirestoreErrorInfo;
  extra?: Record<string, unknown>;
}

export interface LiveBatchDiagnosticsReport {
  startedAt: string;
  finishedAt: string;
  projectId: string;
  databaseId: string;
  authContext: {
    signedIn: boolean;
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
    tokenEmailVerifiedClaim: boolean | null;
    signInProvider: string | null;
    adminDocExists: boolean | null;
    adminDocRole: string | null;
    adminReadError: string | null;
  };
  probes: BatchProbeResult[];
  isolatedFieldFailures: BatchProbeResult[];
  conclusion: string;
  likelyConstraint:
    | 'passed_all'
    | 'auth_or_admin_denied'
    | 'stale_deployed_rules_missing_new_fields'
    | 'gallery_images_rejected'
    | 'specific_post_field_rejected'
    | 'real_inbox_doc_rejected'
    | 'inbox_update_rejected'
    | 'atomic_combined_batch_rejected'
    | 'quota_or_network_error';
}

export interface RunLiveDiagnosticsOptions {
  targetDb?: Firestore;
  targetUser?: User | null;
  targetInboxItem?: NewsInboxItem | null;
  targetInboxItemId?: string;
  draft?: NewsDraftData | null;
  testExistingPostUpdate?: boolean;
}

function buildStructuredErrorInfo(
  err: unknown,
  user: User | null,
  operationType: OperationType,
  path: string
): { code: string; message: string; info: FirestoreErrorInfo } {
  const errObj = err as { code?: unknown; message?: unknown };
  const code = typeof errObj?.code === 'string' ? errObj.code : 'unknown';
  const message =
    err instanceof Error
      ? err.message
      : typeof errObj?.message === 'string'
        ? errObj.message
        : String(err);

  const info: FirestoreErrorInfo = {
    error: message,
    operationType,
    path,
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) ?? [],
    },
  };

  return { code, message, info };
}

function summarizeDocSchema(data: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!data) return {};
  const summary: Record<string, string> = {};
  for (const [k, v] of Object.entries(data).sort(([a], [b]) => a.localeCompare(b))) {
    if (v === null) {
      summary[k] = 'null';
    } else if (Array.isArray(v)) {
      summary[k] = `list(${v.length})`;
    } else if (
      typeof v === 'object' &&
      v !== null &&
      (typeof (v as { toDate?: unknown }).toDate === 'function' ||
        typeof (v as { seconds?: unknown }).seconds === 'number')
    ) {
      summary[k] = 'timestamp';
    } else if (typeof v === 'string') {
      summary[k] = `string(${v.length})`;
    } else {
      summary[k] = typeof v;
    }
  }
  return summary;
}

async function runSingleBatchProbe(params: {
  id: string;
  label: string;
  targetPath: string;
  operationType: OperationType;
  user: User | null;
  execute: () => Promise<void>;
  extra?: Record<string, unknown>;
}): Promise<BatchProbeResult> {
  const start = Date.now();
  try {
    await params.execute();
    return {
      id: params.id,
      label: params.label,
      targetPath: params.targetPath,
      operationType: params.operationType,
      ok: true,
      code: 'ok',
      message: 'ALLOWED',
      durationMs: Date.now() - start,
      extra: params.extra,
    };
  } catch (err) {
    const { code, message, info } = buildStructuredErrorInfo(
      err,
      params.user,
      params.operationType,
      params.targetPath
    );
    return {
      id: params.id,
      label: params.label,
      targetPath: params.targetPath,
      operationType: params.operationType,
      ok: false,
      code,
      message,
      durationMs: Date.now() - start,
      structuredError: info,
      extra: params.extra,
    };
  }
}

export async function runLivePublishBatchDiagnostics(
  options: RunLiveDiagnosticsOptions = {}
): Promise<LiveBatchDiagnosticsReport> {
  const startedAt = new Date().toISOString();
  const targetDb = options.targetDb ?? db;
  const targetUser = options.targetUser !== undefined ? options.targetUser : auth.currentUser;
  const probes: BatchProbeResult[] = [];
  const isolatedFieldFailures: BatchProbeResult[] = [];

  const authContext: LiveBatchDiagnosticsReport['authContext'] = {
    signedIn: Boolean(targetUser),
    uid: targetUser?.uid ?? null,
    email: targetUser?.email ?? null,
    emailVerified: Boolean(targetUser?.emailVerified),
    tokenEmailVerifiedClaim: null,
    signInProvider: null,
    adminDocExists: null,
    adminDocRole: null,
    adminReadError: null,
  };

  if (!targetUser) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      authContext,
      probes,
      isolatedFieldFailures,
      likelyConstraint: 'auth_or_admin_denied',
      conclusion:
        '현재 Firebase Auth 로그인 세션(auth.currentUser)이 없습니다. Google 관리자 계정으로 로그인한 뒤 다시 실행해 주세요.',
    };
  }

  try {
    const tokenResult = await getIdTokenResult(targetUser, true);
    authContext.tokenEmailVerifiedClaim =
      typeof tokenResult.claims.email_verified === 'boolean'
        ? tokenResult.claims.email_verified
        : null;
    authContext.signInProvider = tokenResult.signInProvider ?? null;
  } catch (err) {
    authContext.adminReadError = `ID 토큰 갱신 실패: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }

  try {
    const adminSnap = await getDocFromServer(doc(targetDb, 'admins', targetUser.uid));
    authContext.adminDocExists = adminSnap.exists();
    authContext.adminDocRole = adminSnap.exists()
      ? String(adminSnap.data()?.role || '')
      : null;
  } catch (err) {
    authContext.adminReadError = err instanceof Error ? err.message : String(err);
  }

  const runNonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const diagPostIdsToDelete = new Set<string>();
  const diagInboxIdsToDelete = new Set<string>();

  const makeDiagPostId = (suffix: string) => {
    const id = `diag_post_${runNonce}_${suffix}`;
    diagPostIdsToDelete.add(id);
    return id;
  };
  const makeDiagInboxId = (suffix: string) => {
    const id = `diag_inbox_${runNonce}_${suffix}`;
    diagInboxIdsToDelete.add(id);
    return id;
  };

  const baseMinimalPost = (slugSuffix: string) => ({
    title: '[진단용] NOVA writeBatch 격리 테스트 문서',
    slug: sanitizeSlug(`diag-post-${runNonce}-${slugSuffix}`).slice(0, 120),
    category: 'TCG 뉴스',
    content: '## NOVA 진단용 본문\n\nwriteBatch 보안 규칙 격리 테스트입니다.',
    isPinned: false,
    isSample: true,
    visibilityState: 'draft',
  });

  const sampleGallery = [
    {
      id: 'img_diag_1',
      url: 'https://example.com/nova-diag-test.webp',
      caption: '진단 테스트 캡션',
      source: 'NOVA Diagnostics',
      rights: '자체 제작 · 직접 촬영',
      alt: '진단 테스트 이미지',
    },
  ];

  const baseInboxSeed = (suffix: string) => ({
    sourceId: 'src_pokebeach',
    sourceName: 'PokeBeach',
    originalTitle: `[Diagnostic] Test Inbox Item ${suffix}`,
    originalUrl: `https://example.com/news/${runNonce}/${suffix}`,
    canonicalUrlKey: `https://example.com/news/${runNonce}/${suffix}`,
    publishedAtSource: '2026-11-18T00:00:00Z',
    tcgCategory: '포켓몬 TCG',
    metadataAuthor: 'DiagBot',
    metadataSnippet: 'Diagnostic snippet',
    metadataImageUrl: 'https://example.com/thumb.webp',
    duplicateCandidateOf: '',
    duplicateSimilarityNote: '',
    koreanTitle: '',
    novaSummary: '',
    coverImage: '',
    isPinned: false,
    status: 'pending',
    publishedPostId: '',
    aiDraftGenerated: false,
    fetchedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    // Probe 1: Minimal legacy 9-field posts create via writeBatch
    const p1Id = makeDiagPostId('p1');
    const p1 = await runSingleBatchProbe({
      id: 'posts_minimal_9fields',
      label: '1. posts 최소 9개 필수 필드 단독 writeBatch create',
      targetPath: `posts/${p1Id}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'posts', p1Id), {
          ...baseMinimalPost('p1'),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await b.commit();
      },
    });
    probes.push(p1);

    // Probe 2: posts with new news-linking metadata (WITHOUT galleryImages)
    const p2Id = makeDiagPostId('p2');
    const p2 = await runSingleBatchProbe({
      id: 'posts_metadata_without_gallery',
      label: '2. posts 뉴스 연동 메타 포함 (galleryImages 제외) writeBatch create',
      targetPath: `posts/${p2Id}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'posts', p2Id), {
          ...baseMinimalPost('p2'),
          summary: '진단용 요약입니다.',
          coverImage: '',
          tcgCategory: '포켓몬 TCG',
          sourceName: 'PokeBeach',
          sourceUrl: 'https://example.com/source',
          publishedAtSource: '2026-11-18T00:00:00Z',
          inboxItemId: `inbox_diag_${runNonce}`,
          scheduledAt: null,
          seoTitle: '진단 SEO 제목',
          seoDescription: '진단 SEO 설명',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await b.commit();
      },
    });
    probes.push(p2);

    // Probe 3: posts with empty galleryImages: []
    const p3Id = makeDiagPostId('p3');
    const p3 = await runSingleBatchProbe({
      id: 'posts_empty_gallery',
      label: '3. posts + galleryImages: [] 포함 writeBatch create',
      targetPath: `posts/${p3Id}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'posts', p3Id), {
          ...baseMinimalPost('p3'),
          summary: '진단용 요약입니다.',
          coverImage: '',
          galleryImages: [],
          tcgCategory: '포켓몬 TCG',
          sourceName: 'PokeBeach',
          sourceUrl: 'https://example.com/source',
          publishedAtSource: '2026-11-18T00:00:00Z',
          inboxItemId: `inbox_diag_${runNonce}`,
          scheduledAt: null,
          seoTitle: '진단 SEO 제목',
          seoDescription: '진단 SEO 설명',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await b.commit();
      },
    });
    probes.push(p3);

    // Probe 4: posts with 1 populated galleryImages entry
    const p4Id = makeDiagPostId('p4');
    const p4 = await runSingleBatchProbe({
      id: 'posts_populated_gallery',
      label: '4. posts + galleryImages[1] 포함 writeBatch create',
      targetPath: `posts/${p4Id}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'posts', p4Id), {
          ...baseMinimalPost('p4'),
          summary: '진단용 요약입니다.',
          coverImage: 'https://example.com/cover.webp',
          galleryImages: sampleGallery,
          tcgCategory: '포켓몬 TCG',
          sourceName: 'PokeBeach',
          sourceUrl: 'https://example.com/source',
          publishedAtSource: '2026-11-18T00:00:00Z',
          inboxItemId: `inbox_diag_${runNonce}`,
          scheduledAt: null,
          seoTitle: '진단 SEO 제목',
          seoDescription: '진단 SEO 설명',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await b.commit();
      },
    });
    probes.push(p4);

    // Probe 5: Exact user draft replication on disposable post doc (keeping visibilityState='draft', isSample=true for zero public leak)
    const targetInboxItem = options.targetInboxItem ?? null;
    const draft = options.draft ?? null;
    let p5: BatchProbeResult | null = null;

    if (draft && targetInboxItem) {
      const p5Id = makeDiagPostId('p5_exact');
      const finalTitle = (draft.koreanTitle.trim() || targetInboxItem.originalTitle || '진단 제목').slice(0, 160);
      const finalSummary = (draft.novaSummary.trim() || '진단용 요약입니다.').slice(0, 3000);
      const cleanPlainSummary = finalSummary
        .replace(/\[\[image:[a-zA-Z0-9_\-]+\]\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const normalizedGallery = sanitizeGalleryImages(draft.galleryImages);

      const exactPostPayload = {
        title: finalTitle,
        slug: sanitizeSlug(`diag-exact-${runNonce}`).slice(0, 120),
        category: 'TCG 뉴스',
        tcgCategory: normalizeTcgCategory(draft.tcgCategory),
        sourceName: (targetInboxItem.sourceName || 'NOVA').slice(0, 100),
        sourceUrl: (targetInboxItem.originalUrl || '').slice(0, 500),
        publishedAtSource: (targetInboxItem.publishedAtSource || '').slice(0, 80),
        inboxItemId: targetInboxItem.id.slice(0, 128),
        summary: (cleanPlainSummary || finalTitle).slice(0, 400),
        content: buildNewsPostMarkdown(targetInboxItem, finalSummary).slice(0, 30000),
        coverImage: draft.coverImage.trim().slice(0, 200000),
        galleryImages: normalizedGallery,
        isPinned: Boolean(draft.isPinned),
        isSample: true,
        scheduledAt: null,
        seoTitle: finalTitle.slice(0, 120),
        seoDescription: (cleanPlainSummary || finalTitle).slice(0, 300),
        visibilityState: 'draft',
      };

      p5 = await runSingleBatchProbe({
        id: 'posts_exact_draft_payload',
        label: '5. 실제 작성 중인 posts 전체 payload 복제본 writeBatch create',
        targetPath: `posts/${p5Id}`,
        operationType: OperationType.CREATE,
        user: targetUser,
        extra: { fieldSchema: summarizeDocSchema(exactPostPayload) },
        execute: async () => {
          const b = writeBatch(targetDb);
          b.set(doc(targetDb, 'posts', p5Id), {
            ...exactPostPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await b.commit();
        },
      });
      probes.push(p5);

      // If minimal worked (p1 ok) but exact failed, isolate field-by-field
      if (p1.ok && !p5.ok) {
        const suspectFields: Array<keyof typeof exactPostPayload> = [
          'coverImage',
          'galleryImages',
          'content',
          'summary',
          'sourceName',
          'sourceUrl',
          'publishedAtSource',
          'inboxItemId',
          'tcgCategory',
          'seoTitle',
          'seoDescription',
          'scheduledAt',
          'title',
        ];
        for (const fieldKey of suspectFields) {
          const bisectId = makeDiagPostId(`bisect_${fieldKey}`);
          const res = await runSingleBatchProbe({
            id: `bisect_post_${fieldKey}`,
            label: `   ↳ 필드 격리 테스트: posts.${fieldKey}`,
            targetPath: `posts/${bisectId}`,
            operationType: OperationType.CREATE,
            user: targetUser,
            extra: {
              valueType: summarizeDocSchema({ [fieldKey]: exactPostPayload[fieldKey] })[fieldKey],
            },
            execute: async () => {
              const b = writeBatch(targetDb);
              b.set(doc(targetDb, 'posts', bisectId), {
                ...baseMinimalPost(`b_${fieldKey}`),
                [fieldKey]: exactPostPayload[fieldKey],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              await b.commit();
            },
          });
          if (!res.ok) {
            isolatedFieldFailures.push(res);
          }
        }
      }
    }

    // Probe 6: Ephemeral news_inbox create + update without/with galleryImages
    const i1Id = makeDiagInboxId('i1');
    const p6Create = await runSingleBatchProbe({
      id: 'inbox_ephemeral_create',
      label: '6a. news_inbox 임시 문서 writeBatch create',
      targetPath: `news_inbox/${i1Id}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'news_inbox', i1Id), baseInboxSeed('i1'));
        await b.commit();
      },
    });
    probes.push(p6Create);

    if (p6Create.ok) {
      const p6UpdateNoGallery = await runSingleBatchProbe({
        id: 'inbox_ephemeral_update_no_gallery',
        label: '6b. news_inbox 임시 문서 수정 (galleryImages 제외) writeBatch update',
        targetPath: `news_inbox/${i1Id}`,
        operationType: OperationType.UPDATE,
        user: targetUser,
        execute: async () => {
          const b = writeBatch(targetDb);
          b.update(doc(targetDb, 'news_inbox', i1Id), {
            koreanTitle: '진단용 한국어 제목',
            novaSummary: '진단용 요약',
            tcgCategory: '포켓몬 TCG',
            coverImage: '',
            isPinned: false,
            status: 'approved',
            publishedPostId: p1Id,
            updatedAt: serverTimestamp(),
          });
          await b.commit();
        },
      });
      probes.push(p6UpdateNoGallery);

      const p6UpdateWithGallery = await runSingleBatchProbe({
        id: 'inbox_ephemeral_update_with_gallery',
        label: '6c. news_inbox 임시 문서 수정 (galleryImages 포함) writeBatch update',
        targetPath: `news_inbox/${i1Id}`,
        operationType: OperationType.UPDATE,
        user: targetUser,
        execute: async () => {
          const b = writeBatch(targetDb);
          b.update(doc(targetDb, 'news_inbox', i1Id), {
            koreanTitle: '진단용 한국어 제목',
            novaSummary: '진단용 요약',
            tcgCategory: '포켓몬 TCG',
            coverImage: 'https://example.com/cover.webp',
            galleryImages: sampleGallery,
            isPinned: false,
            status: 'approved',
            publishedPostId: p1Id,
            updatedAt: serverTimestamp(),
          });
          await b.commit();
        },
      });
      probes.push(p6UpdateWithGallery);
    }

    // Probe 7: Non-destructive updatedAt-only probe on REAL target news_inbox/{id}
    const realInboxId = options.targetInboxItemId || targetInboxItem?.id || '';
    if (realInboxId && isValidFirestoreId(realInboxId)) {
      let realSchema: Record<string, string> = {};
      try {
        const snap = await getDocFromServer(doc(targetDb, 'news_inbox', realInboxId));
        if (snap.exists()) {
          realSchema = summarizeDocSchema(snap.data() as Record<string, unknown>);
        }
      } catch {
        // capture via batch probe below
      }

      const p7RealInbox = await runSingleBatchProbe({
        id: 'inbox_real_target_noop_update',
        label: `7. 실제 대상 news_inbox/${realInboxId} 비파괴 updatedAt 단독 writeBatch update`,
        targetPath: `news_inbox/${realInboxId}`,
        operationType: OperationType.UPDATE,
        user: targetUser,
        extra: { serverFieldTypes: realSchema },
        execute: async () => {
          const b = writeBatch(targetDb);
          b.update(doc(targetDb, 'news_inbox', realInboxId), {
            updatedAt: serverTimestamp(),
          });
          await b.commit();
        },
      });
      probes.push(p7RealInbox);
    }

    // Probe 8: Atomic combined 2-doc writeBatch (posts create + news_inbox update in ONE commit)
    const comboPostId = makeDiagPostId('combo');
    const comboInboxId = makeDiagInboxId('combo');
    const comboSeed = await runSingleBatchProbe({
      id: 'combo_seed_inbox',
      label: '8a. 원자적 결합 배치용 임시 news_inbox 시드',
      targetPath: `news_inbox/${comboInboxId}`,
      operationType: OperationType.CREATE,
      user: targetUser,
      execute: async () => {
        const b = writeBatch(targetDb);
        b.set(doc(targetDb, 'news_inbox', comboInboxId), baseInboxSeed('combo'));
        await b.commit();
      },
    });
    if (comboSeed.ok) {
      const p8Combined = await runSingleBatchProbe({
        id: 'atomic_combined_2doc_batch',
        label: '8. 원자적 2문서 결합 writeBatch (posts create + news_inbox update 동시 커밋)',
        targetPath: `posts/${comboPostId} + news_inbox/${comboInboxId}`,
        operationType: OperationType.WRITE,
        user: targetUser,
        execute: async () => {
          const b = writeBatch(targetDb);
          b.set(doc(targetDb, 'posts', comboPostId), {
            ...baseMinimalPost('combo'),
            summary: '결합 배치 테스트 요약',
            coverImage: '',
            galleryImages: sampleGallery,
            tcgCategory: '포켓몬 TCG',
            sourceName: 'PokeBeach',
            sourceUrl: 'https://example.com/source',
            publishedAtSource: '2026-11-18T00:00:00Z',
            inboxItemId: comboInboxId,
            scheduledAt: null,
            seoTitle: '결합 테스트',
            seoDescription: '결합 테스트 설명',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          b.update(doc(targetDb, 'news_inbox', comboInboxId), {
            koreanTitle: '결합 테스트 한국어 제목',
            novaSummary: '결합 테스트 요약',
            tcgCategory: '포켓몬 TCG',
            coverImage: '',
            galleryImages: sampleGallery,
            isPinned: false,
            status: 'approved',
            publishedPostId: comboPostId,
            updatedAt: serverTimestamp(),
          });
          await b.commit();
        },
      });
      probes.push(p8Combined);

      // Probe 9: posts update rule verification (19 POST_UPDATE_AFFECTED_KEYS)
      if (p8Combined.ok && options.testExistingPostUpdate !== false) {
        const p9UpdatePost = await runSingleBatchProbe({
          id: 'posts_existing_update_batch',
          label: '9. 기존 posts 문서 수정 (POST_UPDATE_AFFECTED_KEYS) writeBatch update',
          targetPath: `posts/${comboPostId}`,
          operationType: OperationType.UPDATE,
          user: targetUser,
          execute: async () => {
            const b = writeBatch(targetDb);
            b.update(doc(targetDb, 'posts', comboPostId), {
              ...baseMinimalPost('combo'),
              title: '[진단용] 수정된 제목 테스트',
              summary: '수정된 요약',
              coverImage: '',
              galleryImages: sampleGallery,
              tcgCategory: '포켓몬 TCG',
              sourceName: 'PokeBeach',
              sourceUrl: 'https://example.com/source',
              publishedAtSource: '2026-11-18T00:00:00Z',
              inboxItemId: comboInboxId,
              scheduledAt: null,
              seoTitle: '수정 SEO 제목',
              seoDescription: '수정 SEO 설명',
              updatedAt: serverTimestamp(),
            });
            await b.commit();
          },
        });
        probes.push(p9UpdatePost);
      }
    } else {
      probes.push(comboSeed);
    }
  } finally {
    // Clean up all ephemeral diagnostic documents
    await Promise.allSettled([
      ...Array.from(diagPostIdsToDelete).map((id) => deleteDoc(doc(targetDb, 'posts', id))),
      ...Array.from(diagInboxIdsToDelete).map((id) => deleteDoc(doc(targetDb, 'news_inbox', id))),
    ]);
  }

  const byId = new Map(probes.map((p) => [p.id, p]));
  const p1 = byId.get('posts_minimal_9fields');
  const p2 = byId.get('posts_metadata_without_gallery');
  const p3 = byId.get('posts_empty_gallery');
  const p4 = byId.get('posts_populated_gallery');
  const p5 = byId.get('posts_exact_draft_payload');
  const p6NoGal = byId.get('inbox_ephemeral_update_no_gallery');
  const p6WithGal = byId.get('inbox_ephemeral_update_with_gallery');
  const p7Real = byId.get('inbox_real_target_noop_update');
  const p8Combo = byId.get('atomic_combined_2doc_batch');

  const anyQuotaOrNetwork = probes.find(
    (p) =>
      !p.ok &&
      (p.code.includes('resource-exhausted') ||
        p.message.toLowerCase().includes('quota') ||
        p.code.includes('unavailable'))
  );

  let likelyConstraint: LiveBatchDiagnosticsReport['likelyConstraint'] = 'passed_all';
  let conclusion =
    '모든 writeBatch 격리 테스트를 통과했습니다. 현재 Named DB 보안 규칙과 관리자 권한이 정상 작동 중입니다.';

  if (anyQuotaOrNetwork) {
    likelyConstraint = 'quota_or_network_error';
    conclusion = `권한 문제가 아닌 할당량/네트워크 오류(${anyQuotaOrNetwork.code})가 발생했습니다: ${anyQuotaOrNetwork.message}`;
  } else if (p1 && !p1.ok) {
    likelyConstraint = 'auth_or_admin_denied';
    conclusion = `가장 기본 9필드 posts writeBatch도 거부됨(${p1.code}). Firebase Auth email_verified=${String(
      authContext.emailVerified
    )}, tokenClaim=${String(authContext.tokenEmailVerifiedClaim)}, admins/${
      authContext.uid
    } 존재=${String(authContext.adminDocExists)} 및 Named DB(${firebaseConfig.firestoreDatabaseId}) 연결을 확인하세요.`;
  } else if (p1?.ok && p2 && !p2.ok) {
    likelyConstraint = 'stale_deployed_rules_missing_new_fields';
    conclusion =
      '원격 Named DB에 구버전 보안 규칙이 남아 있을 가능성이 매우 높습니다! 최소 9필드 posts 생성은 통과했으나 신규 뉴스 연동 필드(inboxItemId/tcgCategory/sourceUrl 등) 포함 시 거부되었습니다.';
  } else if (p2?.ok && ((p3 && !p3.ok) || (p4 && !p4.ok) || (p6NoGal?.ok && p6WithGal && !p6WithGal.ok))) {
    likelyConstraint = 'gallery_images_rejected';
    conclusion =
      'galleryImages 필드 또는 isValidNewsGalleryList 규칙에서 거부되었습니다. 원격 Named DB에 최신 galleryImages 규칙이 배포되지 않았을 수 있습니다.';
  } else if (p4?.ok && p5 && !p5.ok) {
    likelyConstraint = 'specific_post_field_rejected';
    const fieldNames = isolatedFieldFailures.map((f) => f.id.replace('bisect_post_', '')).join(', ');
    conclusion = fieldNames
      ? `일반 샘플 writeBatch는 통과했으나 현재 편집 중인 기사 데이터의 특정 필드(${fieldNames})에서 거부되었습니다.`
      : '일반 샘플 writeBatch는 통과했으나 현재 작성 중인 posts payload 복제본이 거부되었습니다.';
  } else if (p6WithGal?.ok && p7Real && !p7Real.ok) {
    likelyConstraint = 'real_inbox_doc_rejected';
    conclusion = `임시 news_inbox 업데이트는 통과했으나 실제 대상 문서(${p7Real.targetPath})의 updatedAt 단독 수정이 거부되었습니다. 해당 서버 문서의 createdAt/fetchedAt 타입(Timestamp 여부) 또는 레거시 필드가 isValidNewsInboxItem 규칙과 충돌합니다.`;
  } else if (probes.some((p) => p.id.startsWith('inbox_ephemeral') && !p.ok)) {
    likelyConstraint = 'inbox_update_rejected';
    conclusion =
      'news_inbox 컬렉션 생성/수정 규칙(isValidNewsInboxItem 또는 affectedKeys)에서 거부되었습니다.';
  } else if (p4?.ok && p6WithGal?.ok && p8Combo && !p8Combo.ok) {
    likelyConstraint = 'atomic_combined_batch_rejected';
    conclusion =
      '개별 writeBatch는 통과했으나 posts + news_inbox 동시 2문서 원자적 writeBatch에서 거부되었습니다. 규칙 내 cross-op 제한 또는 exists() 읽기 한도를 확인하세요.';
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    authContext,
    probes,
    isolatedFieldFailures,
    likelyConstraint,
    conclusion,
  };
}

export interface NovaFirebaseDebugHandle {
  config: typeof firebaseConfig;
  getAuthState: () => {
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
  };
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  runBatchDiagnostic: (opts?: {
    inboxItemId?: string;
  }) => Promise<LiveBatchDiagnosticsReport>;
}

declare global {
  interface Window {
    __novaDiagnosePublishBatch?: (opts?: {
      inboxItemId?: string;
    }) => Promise<LiveBatchDiagnosticsReport>;
    __novaFirebaseDebug?: NovaFirebaseDebugHandle;
  }
}

export function registerBrowserBatchDiagnosticHelpers(
  getDefaultContext?: () => {
    targetInboxItem?: NewsInboxItem | null;
    draft?: NewsDraftData | null;
  }
): () => void {
  if (typeof window === 'undefined') return () => {};

  const runner = async (opts?: { inboxItemId?: string }) => {
    const ctx = getDefaultContext?.() ?? {};
    const report = await runLivePublishBatchDiagnostics({
      targetDb: db,
      targetUser: auth.currentUser,
      targetInboxItem: ctx.targetInboxItem ?? null,
      targetInboxItemId: opts?.inboxItemId || ctx.targetInboxItem?.id,
      draft: ctx.draft ?? null,
    });
    console.group('[NOVA] Live Firestore writeBatch Isolation Report');
    console.log('Conclusion:', report.conclusion);
    console.log('Likely Constraint:', report.likelyConstraint);
    console.log('Auth Context:', report.authContext);
    console.table(
      report.probes.map((p) => ({
        id: p.id,
        ok: p.ok,
        code: p.code,
        targetPath: p.targetPath,
        durationMs: p.durationMs,
        message: p.message,
      }))
    );
    if (report.isolatedFieldFailures.length > 0) {
      console.warn('Isolated Field Failures:', report.isolatedFieldFailures);
    }
    console.groupEnd();
    return report;
  };

  window.__novaDiagnosePublishBatch = runner;
  window.__novaFirebaseDebug = {
    config: firebaseConfig,
    getAuthState: () => ({
      uid: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: Boolean(auth.currentUser?.emailVerified),
    }),
    getIdToken: async (forceRefresh = true) => {
      if (!auth.currentUser) return null;
      return auth.currentUser.getIdToken(forceRefresh);
    },
    runBatchDiagnostic: runner,
  };

  return () => {
    // Keep global helpers available across route switches within admin session
  };
}
