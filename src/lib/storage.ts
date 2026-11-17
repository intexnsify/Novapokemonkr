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
