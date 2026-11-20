import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';

const MAX_BUYBACK_BYTES = 5 * 1024 * 1024;
const MAX_ADMIN_MEDIA_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.slice(0, 90) || 'image.jpg';
}

export function validateImageFile(file: File, maxBytes = MAX_BUYBACK_BYTES): string | null {
  if (!file.type.startsWith('image/')) {
    return `${file.name}: 이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.`;
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `${file.name}: 파일 크기는 ${mb}MB 이하여야 합니다.`;
  }
  return null;
}

export async function uploadBuybackPhoto(submissionId: string, file: File, index: number): Promise<string> {
  const err = validateImageFile(file, MAX_BUYBACK_BYTES);
  if (err) throw new Error(err);

  try {
    const safeName = `${Date.now()}_${index}_${sanitizeFileName(file.name)}`;
    const storageRef = ref(storage, `buybacks/${submissionId}/${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unauthorized') || msg.includes('permission') || msg.includes('403')) {
      throw new Error('Firebase Storage 권한이 거부되었습니다. Firebase Console > Storage에서 storage.rules를 적용했는지 확인해 주세요.');
    }
    throw error;
  }
}

export async function uploadPublicMedia(
  folder: 'brand' | 'products' | 'posts' | 'sponsors' | 'seo',
  file: File
): Promise<string> {
  const err = validateImageFile(file, MAX_ADMIN_MEDIA_BYTES);
  if (err) throw new Error(err);

  try {
    const safeName = `${Date.now()}_${sanitizeFileName(file.name)}`;
    const storageRef = ref(storage, `public/${folder}/${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unauthorized') || msg.includes('permission') || msg.includes('403')) {
      throw new Error('Firebase Storage 권한이 거부되었습니다. Firebase Console > Storage를 활성화하고 storage.rules를 적용한 뒤 다시 시도하거나, 이미지 URL을 직접 입력해 주세요.');
    }
    throw error;
  }
}

export async function compressImageToDataUrl(
  file: File,
  initialMaxDim = 640,
  maxChars = 185000
): Promise<string> {
  const err = validateImageFile(file, MAX_ADMIN_MEDIA_BYTES);
  if (err) throw new Error(err);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
      el.src = objectUrl;
    });

    const attempts: Array<{ maxDim: number; quality: number }> = [
      { maxDim: initialMaxDim, quality: 0.82 },
      { maxDim: initialMaxDim, quality: 0.68 },
      { maxDim: 520, quality: 0.6 },
      { maxDim: 420, quality: 0.5 },
      { maxDim: 320, quality: 0.42 },
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('브라우저 이미지 처리(Canvas)를 초기화할 수 없습니다.');
    }

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * scale));
      const h = Math.max(1, Math.round((img.height || 1) * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0D1015';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const webpUrl = canvas.toDataURL('image/webp', attempt.quality);
      if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= maxChars) {
        return webpUrl;
      }
      const jpegUrl = canvas.toDataURL('image/jpeg', attempt.quality);
      if (jpegUrl.length <= maxChars) {
        return jpegUrl;
      }
    }

    throw new Error('이미지 용량이 너무 커서 최적화할 수 없습니다. 더 작은 이미지 파일을 선택하거나 이미지 URL을 직접 입력해 주세요.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeImageBlobForStorage(
  file: File,
  maxDim = 1600,
  quality = 0.86
): Promise<{ blob: Blob; contentType: string; fileName: string }> {
  // Keep small non-huge files or animated GIFs untouched
  if (file.type === 'image/gif' || file.size <= 450 * 1024) {
    return {
      blob: file,
      contentType: file.type || 'image/jpeg',
      fileName: sanitizeFileName(file.name),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    if (scale === 1 && file.size <= 1.2 * 1024 * 1024) {
      return {
        blob: file,
        contentType: file.type || 'image/jpeg',
        fileName: sanitizeFileName(file.name),
      };
    }

    const w = Math.max(1, Math.round((img.width || 1) * scale));
    const h = Math.max(1, Math.round((img.height || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        blob: file,
        contentType: file.type || 'image/jpeg',
        fileName: sanitizeFileName(file.name),
      };
    }
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality);
    });
    if (blob && blob.size > 0 && blob.size < file.size) {
      const base = sanitizeFileName(file.name).replace(/\.[^.]+$/, '');
      return { blob, contentType: 'image/webp', fileName: `${base}.webp` };
    }
  } catch {
    // Fallback to raw file if canvas optimization fails
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return {
    blob: file,
    contentType: file.type || 'image/jpeg',
    fileName: sanitizeFileName(file.name),
  };
}

function uploadToFirebaseStorageWithProgress(
  folder: 'posts',
  blob: Blob,
  fileName: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${sanitizeFileName(fileName)}`;
    const storageRef = ref(storage, `public/${folder}/${safeName}`);
    const task = uploadBytesResumable(storageRef, blob, { contentType });

    let lastBytes = 0;
    let settled = false;
    const stallTimer = window.setInterval(() => {
      if (settled) return;
      if (lastBytes === 0) {
        settled = true;
        window.clearInterval(stallTimer);
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('STORAGE_STALLED'));
      }
    }, 5000);

    const hardTimer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.clearInterval(stallTimer);
      try {
        task.cancel();
      } catch {
        // ignore
      }
      reject(new Error('STORAGE_TIMEOUT'));
    }, 15000);

    task.on(
      'state_changed',
      (snapshot) => {
        lastBytes = snapshot.bytesTransferred;
        if (snapshot.totalBytes > 0) {
          const pct = Math.min(94, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90));
          onProgress?.(pct);
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        window.clearInterval(stallTimer);
        window.clearTimeout(hardTimer);
        reject(err);
      },
      async () => {
        if (settled) return;
        settled = true;
        window.clearInterval(stallTimer);
        window.clearTimeout(hardTimer);
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress?.(100);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('파일을 Base64로 읽을 수 없습니다.'));
    reader.readAsDataURL(blob);
  });
}

export type NewsImageStorageMode = 'firebase_storage' | 'netlify_blobs' | 'inline';

export interface NewsImageUploadResult {
  url: string;
  mode: NewsImageStorageMode;
  byteSize: number;
  warning?: string;
}

export interface NewsImageUploadOptions {
  onProgress?: (pct: number, stage: string) => void;
  idToken?: string | null;
  netlifyBlobsAvailable?: boolean;
}

export async function uploadNewsImageWithProgress(
  file: File,
  options: NewsImageUploadOptions = {}
): Promise<NewsImageUploadResult> {
  const err = validateImageFile(file, MAX_ADMIN_MEDIA_BYTES);
  if (err) throw new Error(err);

  const { onProgress, idToken, netlifyBlobsAvailable } = options;

  onProgress?.(10, '이미지 파일 확인 및 최적화 중');
  const prepared = await optimizeImageBlobForStorage(file);

  // 1) Try Firebase Storage first (URL-only in Firestore, protected by storage.rules)
  try {
    onProgress?.(20, 'Firebase Storage 업로드 중');
    const url = await uploadToFirebaseStorageWithProgress(
      'posts',
      prepared.blob,
      prepared.fileName,
      prepared.contentType,
      (pct) => onProgress?.(Math.max(20, pct), 'Firebase Storage 업로드 중')
    );
    onProgress?.(100, 'Firebase Storage 업로드 완료');
    return {
      url,
      mode: 'firebase_storage',
      byteSize: prepared.blob.size,
    };
  } catch {
    // Continue to Netlify Blobs or compact inline fallback
  }

  // 2) Try Netlify Blobs if running on Netlify (or configured) and authenticated
  if (netlifyBlobsAvailable && idToken && prepared.blob.size <= 3.8 * 1024 * 1024) {
    try {
      onProgress?.(45, 'Netlify Blobs 스토리지 업로드 중');
      const base64Data = await blobToBase64Data(prepared.blob);
      const res = await fetch('/api/media/news', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: prepared.fileName,
          contentType: prepared.contentType,
          base64Data,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        byteSize?: number;
        error?: string;
      };
      if (res.ok && json.ok && json.url) {
        onProgress?.(100, 'Netlify Blobs 업로드 완료');
        return {
          url: json.url,
          mode: 'netlify_blobs',
          byteSize: json.byteSize ?? prepared.blob.size,
        };
      }
    } catch {
      // Continue to compact inline fallback
    }
  }

  // 3) Compact inline WebP fallback (strictly capped <= 65KB so Firestore 1MB limit is safe)
  onProgress?.(60, '외부 스토리지 미연결 · 경량 WebP 변환 중');
  const compressedUrl = await compressImageToDataUrl(file, 560, 65000);
  onProgress?.(100, '경량 이미지 등록 완료');
  return {
    url: compressedUrl,
    mode: 'inline',
    byteSize: compressedUrl.length,
    warning:
      'Firebase Storage 또는 Netlify Blobs가 연결되지 않아 경량 WebP(인라인)로 저장됩니다. 문서 총 용량(1MB 제한)을 확인해 주세요.',
  };
}

export async function uploadDropImageWithFallback(
  file: File
): Promise<{ url: string; mode: 'storage' | 'inline' }> {
  const err = validateImageFile(file, MAX_ADMIN_MEDIA_BYTES);
  if (err) throw new Error(err);

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('STORAGE_TIMEOUT')), 5000)
    );
    const url = await Promise.race([uploadPublicMedia('products', file), timeoutPromise]);
    return { url, mode: 'storage' };
  } catch {
    const compressedUrl = await compressImageToDataUrl(file);
    return { url: compressedUrl, mode: 'inline' };
  }
}

export async function uploadPostImageWithFallback(
  file: File
): Promise<{ url: string; mode: 'storage' | 'inline' }> {
  const result = await uploadNewsImageWithProgress(file);
  return {
    url: result.url,
    mode: result.mode === 'inline' ? 'inline' : 'storage',
  };
}
