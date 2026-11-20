import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { getStore } from '@netlify/blobs';
import { generateNewsKoreanDraft, isNewsAiConfigured } from './server/newsAi.ts';
import {
  BUILT_IN_SOURCES,
  diagnoseFirestoreRestAuth,
  fetchFeedsForAdminSources,
  isCronAuthConfigured,
  runNewsSync,
  testAndParseFeed,
  verifyAdminBearerToken,
  type ClientFeedFetchSourceInput,
} from './server/newsSyncCore.ts';

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function getErrorStatus(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = Number((err as { statusCode?: number }).statusCode);
    if (code >= 400 && code < 600) return code;
  }
  return 500;
}

const NEWS_MEDIA_STORE = 'nova-news-media';
const ALLOWED_MEDIA_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
};
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

function getExpressBlobStore() {
  const siteID = (process.env.NETLIFY_SITE_ID || '').trim();
  const token = (process.env.NETLIFY_AUTH_TOKEN || '').trim();
  if (siteID && token) {
    return getStore({ name: NEWS_MEDIA_STORE, siteID, token });
  }
  if (process.env.NETLIFY_BLOBS_CONTEXT) {
    return getStore(NEWS_MEDIA_STORE);
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/news/capabilities', (_req: Request, res: Response) => {
    const netlifyBlobsAvailable = Boolean(
      process.env.NETLIFY_BLOBS_CONTEXT ||
        (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN)
    );
    res.json({
      ok: true,
      aiDraftAvailable: isNewsAiConfigured(),
      cronAuthConfigured: isCronAuthConfigured(),
      netlifyBlobsAvailable,
      runtime: 'express',
    });
  });

  app.post('/api/news/sync', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      await verifyAdminBearerToken(token);
      const summary = await runNewsSync({
        trigger: 'manual',
        bearerToken: token,
      });
      res.json(summary);
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/news/diagnose-auth', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      const diagnosis = await diagnoseFirestoreRestAuth(token);
      res.json(diagnosis);
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/news/fetch-feeds', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      await verifyAdminBearerToken(token);
      const rawSources = Array.isArray(req.body?.sources)
        ? (req.body.sources as ClientFeedFetchSourceInput[])
        : BUILT_IN_SOURCES;
      const results = await fetchFeedsForAdminSources(rawSources);
      res.json({ ok: true, results });
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/news/test-source', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      await verifyAdminBearerToken(token);
      const feedUrl = typeof req.body?.feedUrl === 'string' ? req.body.feedUrl : '';
      if (!feedUrl.trim()) {
        res.status(400).json({ ok: false, error: '테스트할 피드 URL을 입력해 주세요.' });
        return;
      }
      const result = await testAndParseFeed(feedUrl);
      res.json(result);
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/news/ai-draft', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      await verifyAdminBearerToken(token);
      if (!isNewsAiConfigured()) {
        res.status(503).json({
          ok: false,
          code: 'AI_NOT_CONFIGURED',
          error:
            'GEMINI_API_KEY가 서버 환경변수에 설정되지 않았습니다. 직접 제목과 요약을 작성하거나 서버에 GEMINI_API_KEY를 연결해 주세요.',
        });
        return;
      }

      const body = req.body || {};
      const originalTitle = typeof body.originalTitle === 'string' ? body.originalTitle : '';
      const originalUrl = typeof body.originalUrl === 'string' ? body.originalUrl : '';
      if (!originalTitle.trim()) {
        res.status(400).json({ ok: false, error: '원문 제목이 필요합니다.' });
        return;
      }

      const draft = await generateNewsKoreanDraft({
        originalTitle,
        sourceName: typeof body.sourceName === 'string' ? body.sourceName : '해외 TCG 뉴스',
        publishedAtSource:
          typeof body.publishedAtSource === 'string' ? body.publishedAtSource : '',
        tcgCategory: typeof body.tcgCategory === 'string' ? body.tcgCategory : '포켓몬 TCG',
        metadataSnippet: typeof body.metadataSnippet === 'string' ? body.metadataSnippet : '',
        originalUrl,
      });

      res.json({ ok: true, ...draft });
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        code: (err as { code?: string })?.code,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/api/media/news', async (req: Request, res: Response) => {
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!/^news\/[a-zA-Z0-9_.\-]{1,120}$/.test(key)) {
      res.status(400).json({ ok: false, error: 'Invalid media key' });
      return;
    }

    const store = getExpressBlobStore();
    if (!store) {
      res.status(503).json({
        ok: false,
        error: 'Netlify Blobs 환경변수(NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN)가 설정되지 않았습니다.',
      });
      return;
    }

    try {
      const entry = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!entry) {
        res.status(404).send('Not found');
        return;
      }
      const rawMime =
        typeof entry.metadata?.contentType === 'string' ? entry.metadata.contentType : 'image/webp';
      const contentType = ALLOWED_MEDIA_MIME[rawMime] ? rawMime : 'image/webp';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200).send(Buffer.from(entry.data));
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/media/news', async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      await verifyAdminBearerToken(token);

      const store = getExpressBlobStore();
      if (!store) {
        res.status(503).json({
          ok: false,
          error: 'Netlify Blobs 환경변수가 설정되지 않았습니다.',
        });
        return;
      }

      const body = (req.body || {}) as {
        fileName?: string;
        contentType?: string;
        base64Data?: string;
      };
      const mime = (body.contentType || '').trim().toLowerCase();
      const ext = ALLOWED_MEDIA_MIME[mime];
      if (!ext) {
        res.status(400).json({
          ok: false,
          error: '지원하지 않는 이미지 형식입니다. (webp, jpg, png, gif만 허용)',
        });
        return;
      }

      const rawBase64 = (body.base64Data || '').trim().replace(/^data:[^;]+;base64,/, '');
      if (!rawBase64) {
        res.status(400).json({ ok: false, error: '이미지 데이터가 비어 있습니다.' });
        return;
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_MEDIA_BYTES) {
        res.status(400).json({ ok: false, error: '이미지 용량은 4MB 이하여야 합니다.' });
        return;
      }

      const safeBase = (body.fileName || 'news')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const rand = Math.random().toString(36).slice(2, 8);
      const key = `news/${Date.now().toString(36)}_${rand}_${safeBase || 'img'}.${ext}`;

      const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await store.set(key, arrayBuf, {
        metadata: {
          contentType: mime,
          uploadedAt: new Date().toISOString(),
        },
      });

      res.json({
        ok: true,
        key,
        url: `/api/media/news?key=${encodeURIComponent(key)}`,
        byteSize: buffer.byteLength,
      });
    } catch (err) {
      const status = getErrorStatus(err);
      res.status(status).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.join(process.cwd(), 'dist');

  if (isProd && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.use((req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[NOVA] Server listening on http://0.0.0.0:${port}`);

    // Optional hourly server-side loop ONLY when service account credentials are present
    if (isCronAuthConfigured()) {
      const ONE_HOUR_MS = 60 * 60 * 1000;
      setInterval(() => {
        runNewsSync({ trigger: 'server_interval' }).catch((err) => {
          console.error('[NOVA] Background hourly news sync failed (non-fatal):', err);
        });
      }, ONE_HOUR_MS);
    }
  });
}

startServer().catch((err) => {
  console.error('[NOVA] Failed to start server:', err);
  process.exit(1);
});
