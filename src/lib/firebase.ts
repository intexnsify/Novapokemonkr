import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isFirestoreQuotaError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('free daily read units')
  );
}

export function explainFirestoreError(error: unknown): {
  isQuota: boolean;
  isPermission: boolean;
  isSizeLimit: boolean;
  isNetwork: boolean;
  title: string;
  detail: string;
  actionHint: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (isFirestoreQuotaError(error)) {
    return {
      isQuota: true,
      isPermission: false,
      isSizeLimit: false,
      isNetwork: false,
      title: 'Firestore 일일 무료 사용량(Quota) 초과',
      detail: raw,
      actionHint:
        '오늘 할당된 Firestore 무료 읽기/쓰기 한도를 초과했습니다. 작성 중인 내용은 브라우저 로컬 임시저장에 보관되며, 한도 초기화(매일 자정 PST 기준) 후 또는 Firebase 요금제 업그레이드 후 다시 저장할 수 있습니다.',
    };
  }

  if (
    lower.includes('exceeds the maximum allowed size') ||
    lower.includes('1,048,576') ||
    lower.includes('document size') ||
    lower.includes('invalid-argument')
  ) {
    return {
      isQuota: false,
      isPermission: false,
      isSizeLimit: true,
      isNetwork: false,
      title: '문서 용량(1MB) 또는 필드 길이 제한 초과',
      detail: raw,
      actionHint:
        '본문·대표 이미지·추가 이미지의 합계 용량이 Firestore 1MB 제한을 초과했거나 허용 길이를 넘었습니다. 인라인 이미지를 줄이거나 외부 이미지 URL / Storage 업로드를 사용해 주세요.',
    };
  }

  if (lower.includes('permission') || lower.includes('insufficient')) {
    return {
      isQuota: false,
      isPermission: true,
      isSizeLimit: false,
      isNetwork: false,
      title: 'Firestore 관리자 권한 또는 필드 검증 거부',
      detail: raw,
      actionHint:
        '로그인 세션(이메일 인증 여부) 또는 필드 길이/형식 제한(제목 160자, 요약 3,000자, 이미지 최대 10장)을 확인해 주세요. 상단 [권한 진단]으로 즉시 점검할 수 있습니다.',
    };
  }

  if (lower.includes('offline') || lower.includes('network') || lower.includes('unavailable')) {
    return {
      isQuota: false,
      isPermission: false,
      isSizeLimit: false,
      isNetwork: true,
      title: '네트워크 또는 Firebase 서버 연결 불안정',
      detail: raw,
      actionHint:
        '인터넷 연결 상태를 확인한 뒤 다시 저장해 주세요. 작성 중인 내용은 로컬에 안전하게 보관됩니다.',
    };
  }

  return {
    isQuota: false,
    isPermission: false,
    isSizeLimit: false,
    isNetwork: false,
    title: '데이터 저장 중 오류 발생',
    detail: raw,
    actionHint: '입력 내용과 이미지 상태를 확인한 뒤 다시 시도해 주세요.',
  };
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return { ok: false, error: msg };
  }
}
