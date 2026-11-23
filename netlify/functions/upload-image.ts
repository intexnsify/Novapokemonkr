
import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (statusCode: number, data: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const handler = async (event: { httpMethod: string }) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return json(500, { error: 'Cloudinary 설정 누락' });
    }

    // 관리자 인증 구현 전까지 업로드 차단
    // Firebase ID 토큰 검증 및 admins 역할 확인 필요
    return json(403, {
      error: '관리자 인증 연결 전입니다.',
    });
  } catch {
    return json(500, { error: 'Server error' });
  }
};
