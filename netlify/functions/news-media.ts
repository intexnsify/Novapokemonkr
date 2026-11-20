import { getStore } from '@netlify/blobs';
import { verifyAdminBearerToken } from '../../server/newsSyncCore.ts';

const STORE_NAME = 'nova-news-media';
const ALLOWED_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};
const MAX_DECODED_BYTES = 4 * 1024 * 1024;

function getBlobStore() {
  const siteID = (process.env.NETLIFY_SITE_ID || '').trim();
  const token = (process.env.NETLIFY_AUTH_TOKEN || '').trim();
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = (url.searchParams.get('key') || '').trim();
    if (!/^news\/[a-zA-Z0-9_.\-]{1,120}$/.test(key)) {
      return Response.json({ ok: false, error: 'Invalid media key' }, { status: 400 });
    }

    try {
      const store = getBlobStore();
      const entry = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!entry) {
        return new Response('Not found', { status: 404 });
      }
      const rawMime = typeof entry.metadata?.contentType === 'string' ? entry.metadata.contentType : 'image/webp';
      const contentType = ALLOWED_MIME[rawMime] ? rawMime : 'image/webp';
      return new Response(entry.data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  if (req.method === 'POST') {
    try {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
      await verifyAdminBearerToken(token);

      const body = (await req.json().catch(() => ({}))) as {
        fileName?: string;
        contentType?: string;
        base64Data?: string;
      };

      const mime = (body.contentType || '').trim().toLowerCase();
      const ext = ALLOWED_MIME[mime];
      if (!ext) {
        return Response.json(
          { ok: false, error: '지원하지 않는 이미지 형식입니다. (webp, jpg, png, gif만 허용)' },
          { status: 400 }
        );
      }

      const rawBase64 = (body.base64Data || '').trim().replace(/^data:[^;]+;base64,/, '');
      if (!rawBase64) {
        return Response.json({ ok: false, error: '이미지 데이터가 비어 있습니다.' }, { status: 400 });
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_DECODED_BYTES) {
        return Response.json(
          { ok: false, error: '이미지 용량은 4MB 이하여야 합니다.' },
          { status: 400 }
        );
      }

      const safeBase = (body.fileName || 'news')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const rand = Math.random().toString(36).slice(2, 8);
      const key = `news/${Date.now().toString(36)}_${rand}_${safeBase || 'img'}.${ext}`;

      const store = getBlobStore();
      const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await store.set(key, arrayBuf, {
        metadata: {
          contentType: mime,
          uploadedAt: new Date().toISOString(),
        },
      });

      return Response.json(
        {
          ok: true,
          key,
          url: `/api/media/news?key=${encodeURIComponent(key)}`,
          byteSize: buffer.byteLength,
        },
        { status: 200 }
      );
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode) || 500
          : 500;
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status }
      );
    }
  }

  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}
