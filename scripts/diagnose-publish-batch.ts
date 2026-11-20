import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

interface AppletFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
}

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as AppletFirebaseConfig;

const FIRESTORE_DB_PREFIX = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}`;
const FIRESTORE_DOC_PREFIX = `${FIRESTORE_DB_PREFIX}/documents`;
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/${FIRESTORE_DOC_PREFIX}`;

interface CliArgs {
  idToken?: string;
  customToken?: string;
  emulator: boolean;
  inboxId?: string;
  snippet: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    idToken: process.env.FIREBASE_ID_TOKEN,
    customToken: process.env.FIREBASE_CUSTOM_TOKEN,
    emulator: false,
    inboxId: process.env.NOVA_INBOX_ITEM_ID,
    snippet: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--emulator') args.emulator = true;
    else if (a === '--snippet') args.snippet = true;
    else if (a === '--id-token' && argv[i + 1]) args.idToken = argv[++i];
    else if (a.startsWith('--id-token=')) args.idToken = a.slice('--id-token='.length);
    else if (a === '--custom-token' && argv[i + 1]) args.customToken = argv[++i];
    else if (a.startsWith('--custom-token=')) args.customToken = a.slice('--custom-token='.length);
    else if (a === '--inbox-id' && argv[i + 1]) args.inboxId = argv[++i];
    else if (a.startsWith('--inbox-id=')) args.inboxId = a.slice('--inbox-id='.length);
  }
  return args;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function printBrowserSnippet() {
  console.log(`
=== [NOVA] Browser DevTools Console Snippet (현재 로그인된 관리자 세션 사용) ===

// 방법 1: 앱에 내장된 firebase/firestore writeBatch 격리 진단 직접 실행
await window.__novaDiagnosePublishBatch({
  // 선택: 특정 news_inbox 문서 ID까지 함께 진단하려면 아래 주석 해제
  // inboxItemId: 'inbox_여기에_문서ID'
});

// 방법 2: window.__novaDiagnosePublishBatch 없이도 현재 페이지의 ID 토큰을 뽑아
// Node CLI로 전달하고 싶을 때:
//   copy(await window.__novaFirebaseDebug.getIdToken(true))
// 그 다음 터미널에서 실행:
//   npx tsx scripts/diagnose-publish-batch.ts --id-token "<복사한_토큰>" --inbox-id "<문서ID>"
`);
}

function printHelp() {
  console.log(`
NOVA Firestore writeBatch PERMISSION_DENIED Isolation Diagnostic

Usage:
  npx tsx scripts/diagnose-publish-batch.ts [options]

Options:
  --id-token <JWT>       Live Firebase Auth ID token from logged-in browser admin
                         (from: await window.__novaFirebaseDebug.getIdToken(true))
  --custom-token <JWT>   Firebase Auth custom token (uses firebase/auth + firebase/firestore writeBatch)
  --emulator             Connect firebase/firestore SDK to local Firestore emulator
  --inbox-id <ID>        Also inspect & run non-destructive updatedAt-only probe on news_inbox/<ID>
  --snippet              Print copy-pasteable browser DevTools console snippet
  --help, -h             Show this help

Target Database:
  projectId  = ${firebaseConfig.projectId}
  databaseId = ${firebaseConfig.firestoreDatabaseId}
`);
}

/* -------------------------------------------------------------------------- */
/* Mode A: Direct firebase/firestore writeBatch (Custom Token or Emulator)    */
/* -------------------------------------------------------------------------- */

async function runFirebaseWebSdkBatchMode(args: CliArgs) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  if (args.emulator) {
    const hostPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [host, portStr] = hostPort.split(':');
    connectFirestoreEmulator(db, host || '127.0.0.1', Number(portStr) || 8080);
    console.log(`[SDK] Connected to Firestore Emulator at ${host}:${portStr || 8080}`);
  }

  if (args.customToken) {
    const cred = await signInWithCustomToken(auth, args.customToken);
    console.log(`[Auth] Signed in via custom token uid=${cred.user.uid}`);
  } else {
    console.warn(
      '[Auth] No --custom-token provided. Firestore SDK writeBatch will run unauthenticated unless emulator rules allow.'
    );
  }

  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanupPosts: string[] = [];
  const cleanupInbox: string[] = [];

  const runProbe = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`  [PASS] ${label}`);
      return true;
    } catch (err) {
      const code = (err as { code?: string })?.code || 'unknown';
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${label} -> code=${code} | ${msg}`);
      return false;
    }
  };

  try {
    if (auth.currentUser) {
      await runProbe(`getDoc admins/${auth.currentUser.uid}`, async () => {
        const snap = await getDocFromServer(doc(db, 'admins', auth.currentUser!.uid));
        console.log(`         admins doc exists=${snap.exists()}, role=${String(snap.data()?.role || '-')}`);
      });
    }

    const p1 = `diag_post_${nonce}_1`;
    cleanupPosts.push(p1);
    await runProbe(`writeBatch posts/${p1} (minimal 9 required keys)`, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posts', p1), {
        title: '[Diag] Minimal 9-key Post',
        slug: `diag-${nonce}-1`,
        category: 'TCG 뉴스',
        content: 'Diagnostic content body',
        isPinned: false,
        isSample: true,
        visibilityState: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    });

    const p2 = `diag_post_${nonce}_2`;
    cleanupPosts.push(p2);
    await runProbe(`writeBatch posts/${p2} (metadata + galleryImages[])`, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posts', p2), {
        title: '[Diag] Full News Post',
        slug: `diag-${nonce}-2`,
        category: 'TCG 뉴스',
        summary: 'Diagnostic summary',
        content: 'Diagnostic content body',
        coverImage: '',
        galleryImages: [
          {
            id: 'img_diag_1',
            url: 'https://example.com/diag.webp',
            caption: 'diag',
            source: 'PokeBeach',
            rights: '공식 보도자료 · 출처 표기',
            alt: 'diag alt',
          },
        ],
        tcgCategory: '포켓몬 TCG',
        sourceName: 'PokeBeach',
        sourceUrl: 'https://example.com/news',
        publishedAtSource: '2026-11-18T00:00:00Z',
        inboxItemId: `diag_inbox_${nonce}`,
        isPinned: false,
        isSample: true,
        scheduledAt: null,
        seoTitle: 'Diag SEO',
        seoDescription: 'Diag SEO desc',
        visibilityState: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    });

    const i1 = `diag_inbox_${nonce}_1`;
    cleanupInbox.push(i1);
    const i1SeedOk = await runProbe(`writeBatch news_inbox/${i1} (seed)`, async () => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'news_inbox', i1), {
        sourceId: 'src_pokebeach',
        sourceName: 'PokeBeach',
        originalTitle: 'Diagnostic Title',
        originalUrl: `https://example.com/${nonce}`,
        canonicalUrlKey: `https://example.com/${nonce}`,
        publishedAtSource: '2026-11-18T00:00:00Z',
        tcgCategory: '포켓몬 TCG',
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
      await batch.commit();
    });

    if (i1SeedOk) {
      const comboPost = `diag_post_${nonce}_combo`;
      cleanupPosts.push(comboPost);
      await runProbe(
        `atomic combined writeBatch (posts/${comboPost} create + news_inbox/${i1} update)`,
        async () => {
          const batch = writeBatch(db);
          batch.set(doc(db, 'posts', comboPost), {
            title: '[Diag] Combo Post',
            slug: `diag-${nonce}-combo`,
            category: 'TCG 뉴스',
            summary: 'Combo summary',
            content: 'Combo content',
            coverImage: '',
            galleryImages: [],
            tcgCategory: '포켓몬 TCG',
            sourceName: 'PokeBeach',
            sourceUrl: 'https://example.com/news',
            publishedAtSource: '2026-11-18T00:00:00Z',
            inboxItemId: i1,
            isPinned: false,
            isSample: true,
            scheduledAt: null,
            seoTitle: 'Combo SEO',
            seoDescription: 'Combo SEO desc',
            visibilityState: 'draft',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, 'news_inbox', i1), {
            koreanTitle: 'Combo Korean Title',
            novaSummary: 'Combo Summary',
            tcgCategory: '포켓몬 TCG',
            coverImage: '',
            galleryImages: [],
            isPinned: false,
            status: 'approved',
            publishedPostId: comboPost,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }
      );
    }

    if (args.inboxId) {
      await runProbe(`real target news_inbox/${args.inboxId} non-destructive updatedAt writeBatch`, async () => {
        const snap = await getDocFromServer(doc(db, 'news_inbox', args.inboxId!));
        if (!snap.exists()) {
          throw new Error(`Document news_inbox/${args.inboxId} does not exist`);
        }
        const batch = writeBatch(db);
        batch.update(doc(db, 'news_inbox', args.inboxId!), { updatedAt: serverTimestamp() });
        await batch.commit();
      });
    }
  } finally {
    await Promise.allSettled([
      ...cleanupPosts.map((id) => deleteDoc(doc(db, 'posts', id))),
      ...cleanupInbox.map((id) => deleteDoc(doc(db, 'news_inbox', id))),
    ]);
  }
}

/* -------------------------------------------------------------------------- */
/* Mode B: Live Named DB :commit Probe using Browser Google OAuth ID Token    */
/* -------------------------------------------------------------------------- */

type FsVal =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsVal[] } }
  | { mapValue: { fields?: Record<string, FsVal> } };

function toFsVal(v: unknown): FsVal {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === 'object') {
    const fields: Record<string, FsVal> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val !== undefined) fields[k] = toFsVal(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFsFields(obj: Record<string, unknown>): Record<string, FsVal> {
  const out: Record<string, FsVal> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = toFsVal(v);
  }
  return out;
}

async function runRestIdTokenBatchMode(idToken: string, inboxId?: string) {
  const claims = decodeJwtPayload(idToken);
  console.log('[Token Claims]', {
    uid: claims?.user_id || claims?.sub,
    email: claims?.email,
    email_verified: claims?.email_verified,
    aud: claims?.aud,
    exp: claims?.exp ? new Date(Number(claims.exp) * 1000).toISOString() : null,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
  });

  const headers = (json = true): Record<string, string> => ({
    Authorization: `Bearer ${idToken}`,
    'google-cloud-resource-prefix': FIRESTORE_DB_PREFIX,
    'x-goog-request-params': `project_id=${encodeURIComponent(
      firebaseConfig.projectId
    )}&database_id=${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}`,
    'X-Firebase-GMPID': firebaseConfig.appId,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  });

  const commitBatch = async (
    label: string,
    writes: Array<{
      collection: string;
      docId: string;
      fields: Record<string, unknown>;
      serverTimeFields: string[];
      updateMask?: string[];
    }>
  ): Promise<boolean> => {
    const body = {
      writes: writes.map((w) => ({
        update: {
          name: `${FIRESTORE_DOC_PREFIX}/${w.collection}/${w.docId}`,
          fields: toFsFields(w.fields),
        },
        updateTransforms: w.serverTimeFields.map((fieldPath) => ({
          fieldPath,
          setToServerValue: 'REQUEST_TIME',
        })),
        ...(w.updateMask ? { updateMask: { fieldPaths: w.updateMask } } : {}),
      })),
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}:commit?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(`  [PASS] ${label} (HTTP ${res.status})`);
      return true;
    }
    console.error(`  [FAIL] ${label} (HTTP ${res.status}) -> ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
    return false;
  };

  const deleteDocRest = async (col: string, docId: string) => {
    await fetch(`${FIRESTORE_BASE_URL}/${col}/${docId}?key=${firebaseConfig.apiKey}`, {
      method: 'DELETE',
      headers: headers(false),
    }).catch(() => undefined);
  };

  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanupPosts: string[] = [];
  const cleanupInbox: string[] = [];

  try {
    const p1 = `diag_post_${nonce}_1`;
    cleanupPosts.push(p1);
    const p1Ok = await commitBatch('1. posts minimal 9 required keys :commit', [
      {
        collection: 'posts',
        docId: p1,
        fields: {
          title: '[Diag] Minimal 9-key Post',
          slug: `diag-${nonce}-1`,
          category: 'TCG 뉴스',
          content: 'Diagnostic content',
          isPinned: false,
          isSample: true,
          visibilityState: 'draft',
        },
        serverTimeFields: ['createdAt', 'updatedAt'],
      },
    ]);

    const p2 = `diag_post_${nonce}_2`;
    cleanupPosts.push(p2);
    const p2Ok = await commitBatch('2. posts metadata (no galleryImages) :commit', [
      {
        collection: 'posts',
        docId: p2,
        fields: {
          title: '[Diag] Metadata Post',
          slug: `diag-${nonce}-2`,
          category: 'TCG 뉴스',
          summary: 'Diagnostic summary',
          content: 'Diagnostic content',
          coverImage: '',
          tcgCategory: '포켓몬 TCG',
          sourceName: 'PokeBeach',
          sourceUrl: 'https://example.com',
          publishedAtSource: '2026-11-18T00:00:00Z',
          inboxItemId: `diag_inbox_${nonce}`,
          isPinned: false,
          isSample: true,
          scheduledAt: null,
          seoTitle: 'Diag SEO',
          seoDescription: 'Diag SEO Desc',
          visibilityState: 'draft',
        },
        serverTimeFields: ['createdAt', 'updatedAt'],
      },
    ]);

    const p3 = `diag_post_${nonce}_3`;
    cleanupPosts.push(p3);
    const p3Ok = await commitBatch('3. posts + galleryImages[1] :commit', [
      {
        collection: 'posts',
        docId: p3,
        fields: {
          title: '[Diag] Gallery Post',
          slug: `diag-${nonce}-3`,
          category: 'TCG 뉴스',
          summary: 'Diagnostic summary',
          content: 'Diagnostic content',
          coverImage: 'https://example.com/cover.webp',
          galleryImages: [
            {
              id: 'img_diag_1',
              url: 'https://example.com/diag.webp',
              caption: 'diag',
              source: 'PokeBeach',
              rights: '공식 보도자료 · 출처 표기',
              alt: 'diag',
            },
          ],
          tcgCategory: '포켓몬 TCG',
          sourceName: 'PokeBeach',
          sourceUrl: 'https://example.com',
          publishedAtSource: '2026-11-18T00:00:00Z',
          inboxItemId: `diag_inbox_${nonce}`,
          isPinned: false,
          isSample: true,
          scheduledAt: null,
          seoTitle: 'Diag SEO',
          seoDescription: 'Diag SEO Desc',
          visibilityState: 'draft',
        },
        serverTimeFields: ['createdAt', 'updatedAt'],
      },
    ]);

    const i1 = `diag_inbox_${nonce}_1`;
    cleanupInbox.push(i1);
    const i1Ok = await commitBatch('4. news_inbox ephemeral create :commit', [
      {
        collection: 'news_inbox',
        docId: i1,
        fields: {
          sourceId: 'src_pokebeach',
          sourceName: 'PokeBeach',
          originalTitle: 'Diagnostic Title',
          originalUrl: `https://example.com/${nonce}`,
          canonicalUrlKey: `https://example.com/${nonce}`,
          publishedAtSource: '2026-11-18T00:00:00Z',
          tcgCategory: '포켓몬 TCG',
          koreanTitle: '',
          novaSummary: '',
          coverImage: '',
          isPinned: false,
          status: 'pending',
          publishedPostId: '',
          aiDraftGenerated: false,
        },
        serverTimeFields: ['fetchedAt', 'createdAt', 'updatedAt'],
      },
    ]);

    let i1UpdateOk = false;
    if (i1Ok) {
      const comboPost = `diag_post_${nonce}_combo`;
      cleanupPosts.push(comboPost);
      i1UpdateOk = await commitBatch(
        '5. atomic combined 2-doc :commit (posts create + news_inbox update with galleryImages)',
        [
          {
            collection: 'posts',
            docId: comboPost,
            fields: {
              title: '[Diag] Combo Post',
              slug: `diag-${nonce}-combo`,
              category: 'TCG 뉴스',
              summary: 'Combo summary',
              content: 'Combo content',
              coverImage: '',
              galleryImages: [
                {
                  id: 'img_diag_1',
                  url: 'https://example.com/diag.webp',
                },
              ],
              tcgCategory: '포켓몬 TCG',
              sourceName: 'PokeBeach',
              sourceUrl: 'https://example.com',
              publishedAtSource: '2026-11-18T00:00:00Z',
              inboxItemId: i1,
              isPinned: false,
              isSample: true,
              scheduledAt: null,
              seoTitle: 'Combo SEO',
              seoDescription: 'Combo SEO Desc',
              visibilityState: 'draft',
            },
            serverTimeFields: ['createdAt', 'updatedAt'],
          },
          {
            collection: 'news_inbox',
            docId: i1,
            fields: {
              koreanTitle: 'Combo Korean Title',
              novaSummary: 'Combo Summary',
              tcgCategory: '포켓몬 TCG',
              coverImage: '',
              galleryImages: [
                {
                  id: 'img_diag_1',
                  url: 'https://example.com/diag.webp',
                },
              ],
              isPinned: false,
              status: 'approved',
              publishedPostId: comboPost,
            },
            serverTimeFields: ['updatedAt'],
            updateMask: [
              'koreanTitle',
              'novaSummary',
              'tcgCategory',
              'coverImage',
              'galleryImages',
              'isPinned',
              'status',
              'publishedPostId',
              'updatedAt',
            ],
          },
        ]
      );
    }

    if (inboxId) {
      const getRes = await fetch(
        `${FIRESTORE_BASE_URL}/news_inbox/${encodeURIComponent(inboxId)}?key=${firebaseConfig.apiKey}`,
        { headers: headers(false) }
      );
      if (getRes.ok) {
        const docJson = (await getRes.json()) as { fields?: Record<string, Record<string, unknown>> };
        const fieldTypes: Record<string, string> = {};
        for (const [k, v] of Object.entries(docJson.fields || {})) {
          fieldTypes[k] = Object.keys(v)[0] || 'unknown';
        }
        console.log(`  [INFO] Real news_inbox/${inboxId} server value types:`, fieldTypes);
      } else {
        console.error(`  [FAIL] GET news_inbox/${inboxId} HTTP ${getRes.status}`);
      }

      await commitBatch(`6. real target news_inbox/${inboxId} non-destructive updatedAt-only :commit`, [
        {
          collection: 'news_inbox',
          docId: inboxId,
          fields: {},
          serverTimeFields: ['updatedAt'],
          updateMask: ['updatedAt'],
        },
      ]);
    }

    console.log('\n[Summary]', {
      p1MinimalPostOk: p1Ok,
      p2MetadataPostOk: p2Ok,
      p3GalleryPostOk: p3Ok,
      i1SeedOk: i1Ok,
      combinedBatchOk: i1UpdateOk,
    });
  } finally {
    await Promise.allSettled([
      ...cleanupPosts.map((id) => deleteDocRest('posts', id)),
      ...cleanupInbox.map((id) => deleteDocRest('news_inbox', id)),
    ]);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.snippet) {
    printBrowserSnippet();
    return;
  }

  console.log(
    `NOVA Batch Diagnostic -> project=${firebaseConfig.projectId}, database=${firebaseConfig.firestoreDatabaseId}`
  );

  if (args.idToken) {
    await runRestIdTokenBatchMode(args.idToken, args.inboxId);
    return;
  }

  if (args.customToken || args.emulator) {
    await runFirebaseWebSdkBatchMode(args);
    return;
  }

  console.log('\n[!] 인증 토큰 또는 에뮬레이터 플래그가 지정되지 않았습니다.');
  console.log('    Node.js에서는 Google 팝업 로그인을 직접 열 수 없으므로 아래 중 하나를 선택하세요:');
  console.log('    1) 브라우저 DevTools Console에서 직접 실행 (--snippet 참고)');
  console.log('    2) 브라우저에서 copy(await window.__novaFirebaseDebug.getIdToken(true)) 후 --id-token 전달');
  console.log('    3) --custom-token <JWT> 또는 --emulator 실행');
  printBrowserSnippet();
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
