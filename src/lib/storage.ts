import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
