import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

export type NewsTcgCategory = '포켓몬 TCG' | '원피스 TCG' | '기타 TCG';
export type NewsSourceType = 'rss' | 'atom' | 'json' | 'manual_only';
export type NewsSourceStatus = 'ok' | 'error' | 'no_public_feed' | 'idle';

export interface ServerNewsSource {
  id: string;
  name: string;
  siteUrl: string;
  feedUrl?: string;
  sourceType: NewsSourceType;
  tcgCategory: NewsTcgCategory;
  enabled: boolean;
  isBuiltIn: boolean;
  lastCheckedAt?: string | null;
  lastSuccessAt?: string | null;
  lastStatus: NewsSourceStatus;
  lastError?: string;
  lastFetchedCount?: number;
  lastNewCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ServerNewsInboxItem {
  id: string;
  sourceId: string;
  sourceName: string;
  originalTitle: string;
  originalUrl: string;
  canonicalUrlKey: string;
  publishedAtSource?: string;
  tcgCategory: NewsTcgCategory;
  metadataAuthor?: string;
  metadataSnippet?: string;
  metadataImageUrl?: string;
  duplicateCandidateOf?: string;
  duplicateSimilarityNote?: string;
  koreanTitle?: string;
  novaSummary?: string;
  coverImage?: string;
  isPinned: boolean;
  status: 'pending' | 'approved' | 'ignored';
  publishedPostId?: string;
  aiDraftGenerated?: boolean;
  fetchedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ParsedFeedEntry {
  title: string;
  url: string;
  publishedAt: string;
  author: string;
  snippet: string;
  imageUrl: string;
}

export interface FeedTestResult {
  ok: boolean;
  detectedType: 'rss' | 'atom' | 'json' | 'html_not_feed' | 'error';
  itemCount: number;
  sampleTitles: string[];
  error?: string;
  entries?: ParsedFeedEntry[];
}

export interface NewsSyncSummary {
  ok: boolean;
  trigger: 'cron' | 'manual' | 'server_interval';
  checkedSources: number;
  newCount: number;
  skippedDuplicates: number;
  duplicateCandidateCount: number;
  errorCount: number;
  errors: string[];
  sources: Array<{
    id: string;
    name: string;
    status: NewsSourceStatus;
    fetchedCount: number;
    newCount: number;
    error?: string;
  }>;
  syncedAt: string;
}

interface AppletFirebaseConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
  appId?: string;
}

function loadAppletConfig(): AppletFirebaseConfig {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as AppletFirebaseConfig;
    }
  } catch {
    // Fallback to constants below when bundled without cwd config file
  }
  return {};
}

const APPLET_CFG = loadAppletConfig();
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || APPLET_CFG.projectId || 'savvy-climber-53kqt';
const FIREBASE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  APPLET_CFG.firestoreDatabaseId ||
  'ai-studio-8de423d6-9d23-4651-ae7a-555ca0d7718e';
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  APPLET_CFG.apiKey ||
  'AIzaSyDslyEs5zU3wOwWbSBRJYV07g7JH3ly3NI';
const FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID ||
  APPLET_CFG.appId ||
  '1:762636182972:web:a9e075098bb213c79a77b9';
const BOOTSTRAP_ADMIN_EMAIL = 'jwkim9633@gmail.com';

const FIRESTORE_DB_PREFIX = `projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}`;
const FIRESTORE_DOC_PREFIX = `${FIRESTORE_DB_PREFIX}/documents`;
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/${FIRESTORE_DOC_PREFIX}`;

const USER_AGENT = 'NOVA-TCG-NewsAggregator/1.0 (+https://nova-tcg.netlify.app)';

export const BUILT_IN_SOURCES: Array<{
  id: string;
  name: string;
  siteUrl: string;
  feedUrl: string;
  sourceType: NewsSourceType;
  tcgCategory: NewsTcgCategory;
  enabled: boolean;
  lastStatus: NewsSourceStatus;
  lastError: string;
}> = [
  {
    id: 'src_pokebeach',
    name: 'PokeBeach',
    siteUrl: 'https://www.pokebeach.com/',
    feedUrl: 'https://kaprestridge.github.io/pokebeach-news-feed/feed.xml',
    sourceType: 'rss',
    tcgCategory: '포켓몬 TCG',
    enabled: true,
    lastStatus: 'idle',
    lastError: '',
  },
  {
    id: 'src_pokemon_official',
    name: 'Pokémon 공식 뉴스',
    siteUrl: 'https://www.pokemon.com/us/pokemon-news',
    feedUrl: '',
    sourceType: 'manual_only',
    tcgCategory: '포켓몬 TCG',
    enabled: true,
    lastStatus: 'no_public_feed',
    lastError:
      '공식 사이트가 공개 RSS/Atom/JSON 피드를 제공하지 않습니다. 비인가 크롤링·우회는 수행하지 않으며, 공개 피드 URL을 확인하면 아래에서 직접 연결할 수 있습니다.',
  },
  {
    id: 'src_onepiece_official',
    name: 'ONE PIECE 카드게임 공식 뉴스',
    siteUrl: 'https://en.onepiece-cardgame.com/topics/',
    feedUrl: '',
    sourceType: 'manual_only',
    tcgCategory: '원피스 TCG',
    enabled: true,
    lastStatus: 'no_public_feed',
    lastError:
      '공식 사이트가 공개 RSS/Atom/JSON 피드를 제공하지 않습니다. 비인가 크롤링·우회는 수행하지 않으며, 공개 피드 URL을 확인하면 아래에서 직접 연결할 수 있습니다.',
  },
];

/* -------------------------------------------------------------------------- */
/* Service Account & Firebase Auth Verification                               */
/* -------------------------------------------------------------------------- */

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function readServiceAccountFromEnv(): ServiceAccountCredentials | null {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    try {
      const decoded = rawJson.startsWith('{')
        ? rawJson
        : Buffer.from(rawJson, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<ServiceAccountCredentials>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      return null;
    }
  }

  const email = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (email && key) {
    return {
      client_email: email,
      private_key: key.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

export function isCronAuthConfigured(): boolean {
  return readServiceAccountFromEnv() !== null;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

let cachedServiceToken: { token: string; expiresAtMs: number } | null = null;

async function getServiceAccountAccessToken(): Promise<string> {
  if (cachedServiceToken && cachedServiceToken.expiresAtMs > Date.now() + 60_000) {
    return cachedServiceToken.token;
  }

  const creds = readServiceAccountFromEnv();
  if (!creds) {
    const err = new Error(
      '자동 수집용 Firebase 서비스 계정 환경변수(FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)가 설정되지 않았습니다.'
    ) as Error & { code?: string; statusCode?: number };
    err.code = 'CRON_AUTH_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(creds.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`서비스 계정 액세스 토큰 발급 실패 (${res.status}): ${txt.slice(0, 240)}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error('Google OAuth 응답에 access_token이 없습니다.');
  }

  cachedServiceToken = {
    token: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, json.expires_in || 3500) * 1000,
  };
  return json.access_token;
}

function buildFirestoreRestUrl(pathOrRpc: string, isUserIdToken: boolean): string {
  const url = new URL(`${FIRESTORE_BASE_URL}${pathOrRpc}`);
  if (isUserIdToken && FIREBASE_WEB_API_KEY) {
    url.searchParams.set('key', FIREBASE_WEB_API_KEY);
  }
  return url.toString();
}

function buildFirestoreRestHeaders(
  authToken: string,
  isUserIdToken: boolean,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
    'google-cloud-resource-prefix': FIRESTORE_DB_PREFIX,
    'x-goog-request-params': `project_id=${encodeURIComponent(FIREBASE_PROJECT_ID)}&database_id=${encodeURIComponent(FIREBASE_DATABASE_ID)}`,
  };
  if (isUserIdToken && FIREBASE_APP_ID) {
    headers['X-Firebase-GMPID'] = FIREBASE_APP_ID;
  }
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

async function firestoreRestFetch(
  pathOrRpc: string,
  authToken: string,
  isUserIdToken: boolean,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const extraHeaders: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers);
    h.forEach((v, k) => {
      extraHeaders[k] = v;
    });
  }
  return fetch(buildFirestoreRestUrl(pathOrRpc, isUserIdToken), {
    ...init,
    headers: buildFirestoreRestHeaders(authToken, isUserIdToken, extraHeaders),
    signal: init?.signal || AbortSignal.timeout(init?.timeoutMs || 12000),
  });
}

export async function verifyAdminBearerToken(
  idToken: string
): Promise<{ uid: string; email: string; emailVerified: boolean; isBootstrapAdmin: boolean }> {
  if (!idToken || idToken.length < 20) {
    const err = new Error('관리자 인증 토큰이 누락되었습니다.') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!lookupRes.ok) {
    const err = new Error('유효하지 않거나 만료된 관리자 인증 토큰입니다.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 401;
    throw err;
  }

  const lookupJson = (await lookupRes.json()) as {
    users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
  };
  const user = lookupJson.users?.[0];
  if (!user?.localId || !user.emailVerified) {
    const err = new Error('이메일 인증된 관리자 계정만 접근할 수 있습니다.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 403;
    throw err;
  }

  const isBootstrapAdmin = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
  if (isBootstrapAdmin) {
    return {
      uid: user.localId,
      email: user.email || '',
      emailVerified: Boolean(user.emailVerified),
      isBootstrapAdmin: true,
    };
  }

  const adminCheckRes = await firestoreRestFetch(`/admins/${user.localId}`, idToken, true, {
    timeoutMs: 10000,
  });

  if (!adminCheckRes.ok) {
    const err = new Error('NOVA 관리자 허용 목록(admins)에 등록되지 않은 계정입니다.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 403;
    throw err;
  }

  return {
    uid: user.localId,
    email: user.email || '',
    emailVerified: Boolean(user.emailVerified),
    isBootstrapAdmin: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Firestore REST Helpers                                                     */
/* -------------------------------------------------------------------------- */

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function toFsValue(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFsValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFsValue(val: FsValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map((v) => fromFsValue(v));
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFsValue(v);
    }
    return out;
  }
  return undefined;
}

interface RawFsDocument {
  name: string;
  fields?: Record<string, FsValue>;
}

function fromFsDoc<T>(doc: RawFsDocument): T & { id: string } {
  const parts = doc.name.split('/');
  const id = parts[parts.length - 1];
  const out: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    out[k] = fromFsValue(v);
  }
  return out as T & { id: string };
}

async function runCollectionStructuredQuery<T>(
  collectionName: string,
  authToken: string,
  isUserIdToken: boolean,
  where?: Record<string, unknown>,
  limit?: number
): Promise<Array<T & { id: string }>> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collectionName }],
  };
  if (where) structuredQuery.where = where;
  if (typeof limit === 'number') structuredQuery.limit = limit;

  const res = await firestoreRestFetch(':runQuery', authToken, isUserIdToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
    timeoutMs: 12000,
  });

  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(
      `Firestore 쿼리 조회 실패 (${collectionName}, ${res.status}): ${txt.slice(0, 240)}`
    ) as Error & { statusCode?: number };
    err.statusCode = res.status;
    throw err;
  }

  const rows = (await res.json()) as Array<{ document?: RawFsDocument }>;
  const results: Array<T & { id: string }> = [];
  for (const row of rows) {
    if (row.document) {
      results.push(fromFsDoc<T>(row.document));
    }
  }
  return results;
}

async function listFsCollection<T>(
  collectionName: string,
  authToken: string,
  isUserIdToken = true
): Promise<Array<T & { id: string }>> {
  // Prefer :runQuery (matches Firebase Web SDK query semantics) when using a user ID token
  if (isUserIdToken) {
    return runCollectionStructuredQuery<T>(collectionName, authToken, true);
  }

  const results: Array<T & { id: string }> = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await firestoreRestFetch(`/${collectionName}?${params.toString()}`, authToken, false, {
      timeoutMs: 12000,
    });

    if (!res.ok) {
      const txt = await res.text();
      const err = new Error(
        `Firestore 목록 조회 실패 (${collectionName}, ${res.status}): ${txt.slice(0, 240)}`
      ) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const json = (await res.json()) as {
      documents?: RawFsDocument[];
      nextPageToken?: string;
    };
    for (const d of json.documents || []) {
      results.push(fromFsDoc<T>(d));
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return results;
}

interface DedupPostRecord {
  title?: string;
  sourceName?: string;
  sourceUrl?: string;
  visibilityState?: string;
  publishedAtSource?: string;
  createdAt?: string;
}

async function listPublishedPostsForDedup(
  authToken: string,
  isUserIdToken = true
): Promise<Array<DedupPostRecord & { id: string }>> {
  return runCollectionStructuredQuery<DedupPostRecord>(
    'posts',
    authToken,
    isUserIdToken,
    {
      fieldFilter: {
        field: { fieldPath: 'visibilityState' },
        op: 'EQUAL',
        value: { stringValue: 'published' },
      },
    }
  );
}

async function getFsDoc<T>(
  pathStr: string,
  authToken: string,
  isUserIdToken = true
): Promise<(T & { id: string }) | null> {
  const normalized = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  const res = await firestoreRestFetch(normalized, authToken, isUserIdToken, {
    timeoutMs: 10000,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(
      `Firestore 문서 조회 실패 (${pathStr}, ${res.status}): ${txt.slice(0, 240)}`
    ) as Error & { statusCode?: number };
    err.statusCode = res.status;
    throw err;
  }
  const json = (await res.json()) as RawFsDocument;
  return fromFsDoc<T>(json);
}

interface CommitWriteSpec {
  collection: string;
  docId: string;
  fields: Record<string, unknown>;
  serverTimeFields: string[];
  updateMaskFields?: string[];
}

async function commitFsWrites(
  writes: CommitWriteSpec[],
  authToken: string,
  isUserIdToken = true
): Promise<void> {
  if (writes.length === 0) return;

  // Commit in chunks of 40 operations to stay well within Firestore commit limits
  for (let i = 0; i < writes.length; i += 40) {
    const chunk = writes.slice(i, i + 40);
    const body = {
      writes: chunk.map((w) => {
        const fsFields: Record<string, FsValue> = {};
        for (const [k, v] of Object.entries(w.fields)) {
          if (v !== undefined) fsFields[k] = toFsValue(v);
        }

        const writeOp: Record<string, unknown> = {
          update: {
            name: `${FIRESTORE_DOC_PREFIX}/${w.collection}/${w.docId}`,
            fields: fsFields,
          },
          updateTransforms: w.serverTimeFields.map((fieldPath) => ({
            fieldPath,
            setToServerValue: 'REQUEST_TIME',
          })),
        };

        if (w.updateMaskFields && w.updateMaskFields.length > 0) {
          writeOp.updateMask = {
            fieldPaths: w.updateMaskFields,
          };
        }

        return writeOp;
      }),
    };

    const res = await firestoreRestFetch(':commit', authToken, isUserIdToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 15000,
    });

    if (!res.ok) {
      const txt = await res.text();
      const err = new Error(`Firestore 저장 실패 (${res.status}): ${txt.slice(0, 300)}`) as Error & {
        statusCode?: number;
      };
      err.statusCode = res.status;
      throw err;
    }
  }
}

export interface FirestoreRestProbeResult {
  label: string;
  method: string;
  endpoint: string;
  ok: boolean;
  status: number;
  count?: number;
  error?: string;
}

export interface FirestoreAuthDiagnosis {
  ok: boolean;
  tokenSummary: {
    present: boolean;
    length: number;
    jwtSegments: number;
    sameTokenUsedForRest: boolean;
    authHeaderFormatValid: boolean;
    uid: string;
    email: string;
    emailVerified: boolean;
    isBootstrapAdmin: boolean;
    projectId: string;
    databaseId: string;
  };
  probes: FirestoreRestProbeResult[];
}

export async function diagnoseFirestoreRestAuth(idToken: string): Promise<FirestoreAuthDiagnosis> {
  const verified = await verifyAdminBearerToken(idToken);
  const probes: FirestoreRestProbeResult[] = [];

  async function runProbe(
    label: string,
    method: 'GET' | 'POST',
    pathOrRpc: string,
    body?: Record<string, unknown>,
    countParser?: (json: unknown) => number
  ) {
    try {
      const res = await firestoreRestFetch(pathOrRpc, idToken, true, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: 10000,
      });
      const text = await res.text();
      if (!res.ok) {
        probes.push({
          label,
          method,
          endpoint: pathOrRpc.split('?')[0],
          ok: false,
          status: res.status,
          error: text.replace(/\s+/g, ' ').slice(0, 220),
        });
        return;
      }
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      probes.push({
        label,
        method,
        endpoint: pathOrRpc.split('?')[0],
        ok: true,
        status: res.status,
        count: countParser ? countParser(parsed) : undefined,
      });
    } catch (err) {
      probes.push({
        label,
        method,
        endpoint: pathOrRpc.split('?')[0],
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await runProbe(
    `admins/${verified.uid} 단일 문서 조회`,
    'GET',
    `/admins/${verified.uid}`,
    undefined,
    (json) => (json && typeof json === 'object' && 'name' in json ? 1 : 0)
  );
  await runProbe(
    'news_sources REST 목록 조회 (GET)',
    'GET',
    '/news_sources?pageSize=5',
    undefined,
    (json) => ((json as { documents?: unknown[] })?.documents || []).length
  );
  await runProbe(
    'news_sources REST 쿼리 조회 (:runQuery)',
    'POST',
    ':runQuery',
    { structuredQuery: { from: [{ collectionId: 'news_sources' }], limit: 5 } },
    (json) => (Array.isArray(json) ? json.filter((r: { document?: unknown }) => r.document).length : 0)
  );
  await runProbe(
    'news_inbox REST 목록 조회 (GET)',
    'GET',
    '/news_inbox?pageSize=5',
    undefined,
    (json) => ((json as { documents?: unknown[] })?.documents || []).length
  );
  await runProbe(
    'news_inbox REST 쿼리 조회 (:runQuery)',
    'POST',
    ':runQuery',
    { structuredQuery: { from: [{ collectionId: 'news_inbox' }], limit: 5 } },
    (json) => (Array.isArray(json) ? json.filter((r: { document?: unknown }) => r.document).length : 0)
  );
  await runProbe(
    'posts 공개글 필터 쿼리 (:runQuery)',
    'POST',
    ':runQuery',
    {
      structuredQuery: {
        from: [{ collectionId: 'posts' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'visibilityState' },
            op: 'EQUAL',
            value: { stringValue: 'published' },
          },
        },
        limit: 5,
      },
    },
    (json) => (Array.isArray(json) ? json.filter((r: { document?: unknown }) => r.document).length : 0)
  );

  return {
    ok: probes.every((p) => p.ok),
    tokenSummary: {
      present: Boolean(idToken),
      length: idToken.length,
      jwtSegments: idToken.split('.').length,
      sameTokenUsedForRest: true,
      authHeaderFormatValid: !/\s/.test(idToken) && idToken.length >= 20,
      uid: verified.uid,
      email: verified.email,
      emailVerified: verified.emailVerified,
      isBootstrapAdmin: verified.isBootstrapAdmin,
      projectId: FIREBASE_PROJECT_ID,
      databaseId: FIREBASE_DATABASE_ID,
    },
    probes,
  };
}

export interface ClientFeedFetchSourceInput {
  id: string;
  name: string;
  feedUrl?: string;
  sourceType: NewsSourceType;
  tcgCategory: NewsTcgCategory;
  enabled: boolean;
  lastError?: string;
}

export interface ClientFeedFetchEntry extends ParsedFeedEntry {
  docId: string;
  canonicalUrlKey: string;
  tcgCategory: NewsTcgCategory;
}

export interface ClientFeedFetchResult {
  id: string;
  name: string;
  ok: boolean;
  status: NewsSourceStatus;
  detectedType?: 'rss' | 'atom' | 'json' | 'html_not_feed' | 'error';
  entries: ClientFeedFetchEntry[];
  error?: string;
}

export async function fetchFeedsForAdminSources(
  sources: ClientFeedFetchSourceInput[]
): Promise<ClientFeedFetchResult[]> {
  const results: ClientFeedFetchResult[] = [];
  for (const src of sources) {
    if (!src.enabled) continue;
    const feedUrl = (src.feedUrl || '').trim();
    if (!feedUrl || src.sourceType === 'manual_only') {
      results.push({
        id: src.id,
        name: src.name,
        ok: false,
        status: 'no_public_feed',
        entries: [],
        error:
          src.lastError ||
          '공개 RSS/Atom/JSON 피드가 확인되지 않아 자동 수집 대상에서 대기 중입니다.',
      });
      continue;
    }

    const parsed = await testAndParseFeed(feedUrl);
    if (!parsed.ok) {
      results.push({
        id: src.id,
        name: src.name,
        ok: false,
        status: 'error',
        detectedType: parsed.detectedType,
        entries: [],
        error: parsed.error || '피드 조회 실패',
      });
      continue;
    }

    const enrichedEntries: ClientFeedFetchEntry[] = (parsed.entries || []).map((entry) => {
      const canonKey = canonicalizeUrl(entry.url);
      const urlHash = crypto.createHash('sha256').update(canonKey).digest('hex').slice(0, 24);
      return {
        ...entry,
        docId: `inbox_${urlHash}`,
        canonicalUrlKey: canonKey.slice(0, 490),
        tcgCategory: inferCategory(src.tcgCategory, entry.title),
      };
    });

    results.push({
      id: src.id,
      name: src.name,
      ok: true,
      status: 'ok',
      detectedType: parsed.detectedType,
      entries: enrichedEntries,
    });
  }
  return results;
}

/* -------------------------------------------------------------------------- */
/* Feed Validation, Fetching & Metadata Extraction                            */
/* -------------------------------------------------------------------------- */

export function validateSafePublicFeedUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('유효한 URL 형식이 아닙니다.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('http:// 또는 https:// 프로토콜만 허용됩니다.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    throw new Error('내부 네트워크 및 로컬호스트 URL은 등록할 수 없습니다.');
  }

  return parsed;
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    const hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
      'ref',
    ];
    for (const p of trackingParams) u.searchParams.delete(p);
    u.searchParams.sort();
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname;
    const qs = u.searchParams.toString();
    return `${u.protocol}//${hostname}${path}${qs ? `?${qs}` : ''}`.slice(0, 480);
  } catch {
    return rawUrl.trim().toLowerCase().slice(0, 480);
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/\u00a0/g, ' ');
}

function stripHtmlToShortSnippet(raw: unknown, maxLen = 220): string {
  const str = extractXmlText(raw);
  if (!str) return '';
  const plain = decodeHtmlEntities(str.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 3).trim()}...`;
}

function extractXmlText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val).trim();
  if (Array.isArray(val)) return extractXmlText(val[0]);
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') return obj['#text'].trim();
    if (typeof obj['@_href'] === 'string') return obj['@_href'].trim();
  }
  return '';
}

function pickAtomLink(linkField: unknown): string {
  if (!linkField) return '';
  if (typeof linkField === 'string') return linkField.trim();
  if (Array.isArray(linkField)) {
    const alt = linkField.find(
      (l) => typeof l === 'object' && l !== null && (l as Record<string, unknown>)['@_rel'] === 'alternate'
    );
    return pickAtomLink(alt || linkField[0]);
  }
  if (typeof linkField === 'object') {
    const obj = linkField as Record<string, unknown>;
    if (typeof obj['@_href'] === 'string') return obj['@_href'].trim();
    if (typeof obj['#text'] === 'string') return obj['#text'].trim();
  }
  return '';
}

function pickMediaImage(item: Record<string, unknown>): string {
  const candidates: unknown[] = [
    item['media:thumbnail'],
    item['media:content'],
    item['enclosure'],
  ];
  for (const cand of candidates) {
    const arr = Array.isArray(cand) ? cand : [cand];
    for (const c of arr) {
      if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        const url = typeof obj['@_url'] === 'string' ? obj['@_url'].trim() : '';
        const type = typeof obj['@_type'] === 'string' ? obj['@_type'].toLowerCase() : '';
        if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
          if (!type || type.startsWith('image/')) {
            return url.slice(0, 480);
          }
        }
      }
    }
  }
  return '';
}

function normalizeIsoDate(raw: string): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 75);
  return parsed.toISOString();
}

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export async function testAndParseFeed(feedUrl: string): Promise<FeedTestResult> {
  let validatedUrl: URL;
  try {
    validatedUrl = validateSafePublicFeedUrl(feedUrl);
  } catch (err) {
    return {
      ok: false,
      detectedType: 'error',
      itemCount: 0,
      sampleTitles: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const res = await fetch(validatedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, application/json;q=0.9, */*;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        ok: false,
        detectedType: 'error',
        itemCount: 0,
        sampleTitles: [],
        error: `피드 HTTP 오류 (${res.status} ${res.statusText})`,
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const rawBody = await res.text();
    const trimmed = rawBody.trim();

    if (
      contentType.includes('text/html') &&
      !trimmed.startsWith('<?xml') &&
      !trimmed.startsWith('<rss') &&
      !trimmed.startsWith('<feed')
    ) {
      return {
        ok: false,
        detectedType: 'html_not_feed',
        itemCount: 0,
        sampleTitles: [],
        error:
          '대상 URL이 공개 RSS/Atom/JSON 피드가 아니라 일반 HTML 웹페이지를 반환했습니다. 비인가 HTML 크롤링은 지원하지 않습니다.',
      };
    }

    // 1. JSON Feed attempt
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed) as {
          items?: Array<{
            title?: string;
            url?: string;
            external_url?: string;
            date_published?: string;
            summary?: string;
            content_text?: string;
            image?: string;
            author?: { name?: string };
            authors?: Array<{ name?: string }>;
          }>;
        };
        if (Array.isArray(json.items)) {
          const entries: ParsedFeedEntry[] = json.items
            .map((it) => ({
              title: decodeHtmlEntities(String(it.title || '')).trim().slice(0, 290),
              url: String(it.url || it.external_url || '').trim().slice(0, 490),
              publishedAt: normalizeIsoDate(String(it.date_published || '')),
              author: String(it.author?.name || it.authors?.[0]?.name || '').trim().slice(0, 95),
              snippet: stripHtmlToShortSnippet(it.summary || it.content_text || '', 220),
              imageUrl:
                typeof it.image === 'string' && it.image.startsWith('http')
                  ? it.image.slice(0, 480)
                  : '',
            }))
            .filter((e) => e.title && (e.url.startsWith('https://') || e.url.startsWith('http://')));

          return {
            ok: true,
            detectedType: 'json',
            itemCount: entries.length,
            sampleTitles: entries.slice(0, 5).map((e) => e.title),
            entries: entries.slice(0, 40),
          };
        }
      } catch {
        // Fall through to XML check
      }
    }

    // 2. RSS / Atom XML Parse
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      trimValues: true,
    });
    const parsedXml = parser.parse(trimmed) as Record<string, unknown>;

    const rssChannel = (parsedXml.rss as Record<string, unknown> | undefined)?.channel as
      | Record<string, unknown>
      | undefined;
    const rdfRoot = parsedXml['rdf:RDF'] as Record<string, unknown> | undefined;

    if (rssChannel || rdfRoot) {
      const rawItems = asArray<Record<string, unknown>>(
        (rssChannel?.item || rdfRoot?.item) as Record<string, unknown> | Record<string, unknown>[]
      ).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
      const entries: ParsedFeedEntry[] = rawItems
        .map((it) => ({
          title: decodeHtmlEntities(extractXmlText(it.title)).slice(0, 290),
          url: extractXmlText(it.link).slice(0, 490),
          publishedAt: normalizeIsoDate(
            extractXmlText(it.pubDate || it['dc:date'] || it.published)
          ),
          author: extractXmlText(it['dc:creator'] || it.author).slice(0, 95),
          snippet: stripHtmlToShortSnippet(it.description || it.summary || '', 220),
          imageUrl: pickMediaImage(it),
        }))
        .filter((e) => e.title && (e.url.startsWith('https://') || e.url.startsWith('http://')));

      return {
        ok: true,
        detectedType: 'rss',
        itemCount: entries.length,
        sampleTitles: entries.slice(0, 5).map((e) => e.title),
        entries: entries.slice(0, 40),
      };
    }

    const atomFeed = parsedXml.feed as Record<string, unknown> | undefined;
    if (atomFeed) {
      const rawEntries = asArray<Record<string, unknown>>(
        atomFeed.entry as Record<string, unknown> | Record<string, unknown>[]
      ).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
      const entries: ParsedFeedEntry[] = rawEntries
        .map((it) => {
          const authorObj = it.author as Record<string, unknown> | undefined;
          return {
            title: decodeHtmlEntities(extractXmlText(it.title)).slice(0, 290),
            url: pickAtomLink(it.link).slice(0, 490),
            publishedAt: normalizeIsoDate(
              extractXmlText(it.published || it.updated)
            ),
            author: extractXmlText(authorObj?.name || it.author).slice(0, 95),
            snippet: stripHtmlToShortSnippet(it.summary || '', 220),
            imageUrl: pickMediaImage(it),
          };
        })
        .filter((e) => e.title && (e.url.startsWith('https://') || e.url.startsWith('http://')));

      return {
        ok: true,
        detectedType: 'atom',
        itemCount: entries.length,
        sampleTitles: entries.slice(0, 5).map((e) => e.title),
        entries: entries.slice(0, 40),
      };
    }

    return {
      ok: false,
      detectedType: 'error',
      itemCount: 0,
      sampleTitles: [],
      error: 'RSS 2.0, Atom 또는 JSON Feed 형식을 인식할 수 없습니다.',
    };
  } catch (err) {
    return {
      ok: false,
      detectedType: 'error',
      itemCount: 0,
      sampleTitles: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Cross-Source Similarity & Category Inference                               */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'new',
  'news',
  'tcg',
  'card',
  'cards',
  'game',
  'official',
  'announced',
  'announce',
  'revealed',
  'reveal',
  'details',
  'first',
  'set',
  'series',
  'pack',
  'box',
  'expansion',
  'release',
  'coming',
  'soon',
  'update',
  'pokemon',
  'pokémon',
  'one',
  'piece',
]);

function extractTopicTokens(title: string): Set<string> {
  const cleaned = title
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ');
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function inferCategory(sourceCat: NewsTcgCategory, title: string): NewsTcgCategory {
  if (sourceCat !== '기타 TCG') return sourceCat;
  const lower = title.toLowerCase();
  if (lower.includes('one piece') || lower.includes('원피스') || /\bop[- ]?\d{2}\b/i.test(lower)) {
    return '원피스 TCG';
  }
  if (
    lower.includes('pokemon') ||
    lower.includes('pokémon') ||
    lower.includes('포켓몬') ||
    lower.includes('pikachu')
  ) {
    return '포켓몬 TCG';
  }
  return sourceCat;
}

interface CandidatePoolItem {
  id: string;
  title: string;
  sourceId: string;
  sourceName: string;
  publishedMs: number;
  tokens: Set<string>;
}

function findDuplicateCandidate(
  title: string,
  sourceId: string,
  publishedAtSource: string,
  pool: CandidatePoolItem[]
): { id: string; note: string } | null {
  const norm = title.trim().toLowerCase();
  const tokens = extractTopicTokens(title);
  const pubMs = publishedAtSource ? new Date(publishedAtSource).getTime() : 0;

  let best: { id: string; note: string; score: number } | null = null;

  for (const existing of pool) {
    if (existing.sourceId === sourceId) continue;

    if (pubMs > 0 && existing.publishedMs > 0) {
      const diffDays = Math.abs(pubMs - existing.publishedMs) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) continue;
    }

    if (existing.title.trim().toLowerCase() === norm) {
      return {
        id: existing.id,
        note: `중복 후보: '${existing.sourceName}'의 기존 기사("${existing.title.slice(0, 60)}")와 제목이 동일합니다.`,
      };
    }

    if (tokens.size < 2 || existing.tokens.size < 2) continue;

    let overlap = 0;
    for (const t of tokens) {
      if (existing.tokens.has(t)) overlap += 1;
    }
    const union = tokens.size + existing.tokens.size - overlap;
    const jaccard = union > 0 ? overlap / union : 0;

    if (jaccard >= 0.45 || overlap >= 3) {
      const score = jaccard + overlap * 0.05;
      if (!best || score > best.score) {
        best = {
          id: existing.id,
          score,
          note: `중복 후보: '${existing.sourceName}'의 기존 기사("${existing.title.slice(0, 60)}")와 유사한 주제입니다.`,
        };
      }
    }
  }

  return best ? { id: best.id, note: best.note } : null;
}

/* -------------------------------------------------------------------------- */
/* Main News Sync Runner                                                      */
/* -------------------------------------------------------------------------- */

export async function runNewsSync(options: {
  trigger: 'cron' | 'manual' | 'server_interval';
  bearerToken?: string;
}): Promise<NewsSyncSummary> {
  const isUserIdToken = Boolean(options.bearerToken);
  const authToken = options.bearerToken
    ? options.bearerToken
    : await getServiceAccountAccessToken();

  // Step 1~3: Sequential ordered queries aligned with Firestore security rules
  const existingSources = await listFsCollection<ServerNewsSource>(
    'news_sources',
    authToken,
    isUserIdToken
  );
  const existingInbox = await listFsCollection<ServerNewsInboxItem>(
    'news_inbox',
    authToken,
    isUserIdToken
  );
  const existingPublishedPosts = await listPublishedPostsForDedup(authToken, isUserIdToken);

  const writes: CommitWriteSpec[] = [];
  const existingSourceIds = new Set(existingSources.map((s) => s.id));
  const sourceMap = new Map(existingSources.map((s) => [s.id, s]));

  // Register missing built-in defaults in memory; they will be written once with their first sync result
  for (const def of BUILT_IN_SOURCES) {
    if (!sourceMap.has(def.id)) {
      const created: ServerNewsSource = {
        id: def.id,
        name: def.name,
        siteUrl: def.siteUrl,
        feedUrl: def.feedUrl,
        sourceType: def.sourceType,
        tcgCategory: def.tcgCategory,
        enabled: def.enabled,
        isBuiltIn: true,
        lastStatus: def.lastStatus,
        lastError: def.lastError,
        lastFetchedCount: 0,
        lastNewCount: 0,
      };
      sourceMap.set(def.id, created);
    }
  }

  // Primary deduplication from news_inbox (originalUrl, canonicalUrlKey, publishedPostId)
  const knownUrlKeys = new Set<string>();
  const knownPublishedPostIds = new Set<string>();
  const candidatePool: CandidatePoolItem[] = [];

  for (const item of existingInbox) {
    const key = item.canonicalUrlKey || canonicalizeUrl(item.originalUrl);
    knownUrlKeys.add(key);
    if (item.publishedPostId) {
      knownPublishedPostIds.add(item.publishedPostId);
    }
    candidatePool.push({
      id: item.id,
      title: item.originalTitle,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      publishedMs: item.publishedAtSource ? new Date(item.publishedAtSource).getTime() || 0 : 0,
      tokens: extractTopicTokens(item.originalTitle),
    });
  }

  // Supplement deduplication with published posts not already linked from news_inbox
  for (const post of existingPublishedPosts) {
    if (knownPublishedPostIds.has(post.id)) continue;
    if (post.sourceUrl) {
      knownUrlKeys.add(canonicalizeUrl(post.sourceUrl));
    }
    if (post.title) {
      candidatePool.push({
        id: post.id,
        title: post.title,
        sourceId: `post_${post.id}`,
        sourceName: post.sourceName || '기존 NOVA 게시물',
        publishedMs: post.publishedAtSource
          ? new Date(post.publishedAtSource).getTime() || 0
          : post.createdAt
            ? new Date(post.createdAt).getTime() || 0
            : 0,
        tokens: extractTopicTokens(post.title),
      });
    }
  }

  const allSources = Array.from(sourceMap.values()).filter((s) => s.enabled);
  const errors: string[] = [];
  const sourceResults: NewsSyncSummary['sources'] = [];
  let totalNewCount = 0;
  let skippedDuplicates = 0;
  let duplicateCandidateCount = 0;

  const pushSourceWrite = (
    src: ServerNewsSource,
    statusFields: {
      sourceType?: NewsSourceType;
      lastStatus: NewsSourceStatus;
      lastError: string;
      lastFetchedCount: number;
      lastNewCount: number;
      succeeded: boolean;
    }
  ) => {
    const isNewSource = !existingSourceIds.has(src.id);
    if (isNewSource) {
      writes.push({
        collection: 'news_sources',
        docId: src.id,
        fields: {
          name: src.name.slice(0, 100),
          siteUrl: src.siteUrl.slice(0, 500),
          feedUrl: (src.feedUrl || '').slice(0, 500),
          sourceType: statusFields.sourceType || src.sourceType,
          tcgCategory: src.tcgCategory,
          enabled: src.enabled,
          isBuiltIn: src.isBuiltIn,
          lastSuccessAt: statusFields.succeeded ? undefined : null,
          lastStatus: statusFields.lastStatus,
          lastError: statusFields.lastError.slice(0, 490),
          lastFetchedCount: statusFields.lastFetchedCount,
          lastNewCount: statusFields.lastNewCount,
        },
        serverTimeFields: statusFields.succeeded
          ? ['createdAt', 'updatedAt', 'lastCheckedAt', 'lastSuccessAt']
          : ['createdAt', 'updatedAt', 'lastCheckedAt'],
      });
      return;
    }

    const fields: Record<string, unknown> = {
      lastStatus: statusFields.lastStatus,
      lastError: statusFields.lastError.slice(0, 490),
      lastFetchedCount: statusFields.lastFetchedCount,
      lastNewCount: statusFields.lastNewCount,
    };
    const updateMaskFields = [
      'lastCheckedAt',
      'lastStatus',
      'lastError',
      'lastFetchedCount',
      'lastNewCount',
      'updatedAt',
    ];
    if (statusFields.sourceType) {
      fields.sourceType = statusFields.sourceType;
      updateMaskFields.push('sourceType');
    }
    if (statusFields.succeeded) {
      updateMaskFields.push('lastSuccessAt');
    }

    writes.push({
      collection: 'news_sources',
      docId: src.id,
      fields,
      serverTimeFields: statusFields.succeeded
        ? ['lastCheckedAt', 'lastSuccessAt', 'updatedAt']
        : ['lastCheckedAt', 'updatedAt'],
      updateMaskFields,
    });
  };

  for (const src of allSources) {
    const feedUrl = (src.feedUrl || '').trim();
    if (!feedUrl || src.sourceType === 'manual_only') {
      const msg =
        src.lastError ||
        '공개 RSS/Atom/JSON 피드가 확인되지 않아 자동 수집 대상에서 대기 중입니다.';
      sourceResults.push({
        id: src.id,
        name: src.name,
        status: 'no_public_feed',
        fetchedCount: 0,
        newCount: 0,
        error: msg,
      });
      pushSourceWrite(src, {
        lastStatus: 'no_public_feed',
        lastError: msg,
        lastFetchedCount: 0,
        lastNewCount: 0,
        succeeded: false,
      });
      continue;
    }

    const parsed = await testAndParseFeed(feedUrl);
    if (!parsed.ok) {
      const errText = `${src.name}: ${parsed.error || '피드 조회 실패'}`;
      errors.push(errText.slice(0, 390));
      sourceResults.push({
        id: src.id,
        name: src.name,
        status: 'error',
        fetchedCount: 0,
        newCount: 0,
        error: parsed.error,
      });
      pushSourceWrite(src, {
        lastStatus: 'error',
        lastError: parsed.error || '피드 조회 실패',
        lastFetchedCount: 0,
        lastNewCount: 0,
        succeeded: false,
      });
      continue;
    }

    let sourceNew = 0;
    const entries = parsed.entries || [];

    for (const entry of entries) {
      const canonKey = canonicalizeUrl(entry.url);
      if (knownUrlKeys.has(canonKey)) {
        skippedDuplicates += 1;
        continue;
      }
      knownUrlKeys.add(canonKey);

      const urlHash = crypto.createHash('sha256').update(canonKey).digest('hex').slice(0, 24);
      const docId = `inbox_${urlHash}`;
      const category = inferCategory(src.tcgCategory, entry.title);
      const dupCand = findDuplicateCandidate(entry.title, src.id, entry.publishedAt, candidatePool);
      if (dupCand) duplicateCandidateCount += 1;

      const fields: Record<string, unknown> = {
        sourceId: src.id,
        sourceName: src.name.slice(0, 95),
        originalTitle: entry.title.slice(0, 290),
        originalUrl: entry.url.slice(0, 490),
        canonicalUrlKey: canonKey.slice(0, 490),
        publishedAtSource: entry.publishedAt.slice(0, 75),
        tcgCategory: category,
        metadataAuthor: entry.author.slice(0, 95),
        metadataSnippet: entry.snippet.slice(0, 290),
        metadataImageUrl: entry.imageUrl.slice(0, 490),
        duplicateCandidateOf: dupCand ? dupCand.id : '',
        duplicateSimilarityNote: dupCand ? dupCand.note.slice(0, 290) : '',
        koreanTitle: '',
        novaSummary: '',
        coverImage: '',
        isPinned: false,
        status: 'pending',
        publishedPostId: '',
        aiDraftGenerated: false,
      };

      writes.push({
        collection: 'news_inbox',
        docId,
        fields,
        serverTimeFields: ['fetchedAt', 'createdAt', 'updatedAt'],
      });

      candidatePool.push({
        id: docId,
        title: entry.title,
        sourceId: src.id,
        sourceName: src.name,
        publishedMs: entry.publishedAt ? new Date(entry.publishedAt).getTime() || 0 : 0,
        tokens: extractTopicTokens(entry.title),
      });

      sourceNew += 1;
      totalNewCount += 1;
    }

    sourceResults.push({
      id: src.id,
      name: src.name,
      status: 'ok',
      fetchedCount: entries.length,
      newCount: sourceNew,
    });

    pushSourceWrite(src, {
      sourceType:
        parsed.detectedType === 'atom' || parsed.detectedType === 'json'
          ? parsed.detectedType
          : 'rss',
      lastStatus: 'ok',
      lastError: '',
      lastFetchedCount: entries.length,
      lastNewCount: sourceNew,
      succeeded: true,
    });
  }

  // Update global sync telemetry document
  const existingState = await getFsDoc('news_sync_state/global', authToken, isUserIdToken).catch(
    () => null
  );
  writes.push({
    collection: 'news_sync_state',
    docId: 'global',
    fields: {
      lastTrigger: options.trigger,
      lastNewCount: totalNewCount,
      lastCheckedSources: allSources.length,
      lastErrorCount: errors.length,
      lastErrors: errors.slice(0, 20),
    },
    serverTimeFields: ['lastSyncedAt', 'updatedAt'],
    updateMaskFields: existingState
      ? [
          'lastSyncedAt',
          'lastTrigger',
          'lastNewCount',
          'lastCheckedSources',
          'lastErrorCount',
          'lastErrors',
          'updatedAt',
        ]
      : undefined,
  });

  await commitFsWrites(writes, authToken, isUserIdToken);

  return {
    ok: true,
    trigger: options.trigger,
    checkedSources: allSources.length,
    newCount: totalNewCount,
    skippedDuplicates,
    duplicateCandidateCount,
    errorCount: errors.length,
    errors,
    sources: sourceResults,
    syncedAt: new Date().toISOString(),
  };
}
