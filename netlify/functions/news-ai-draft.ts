import { generateNewsKoreanDraft, isNewsAiConfigured } from '../../server/newsAi.ts';
import { verifyAdminBearerToken } from '../../server/newsSyncCore.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    await verifyAdminBearerToken(token);

    if (!isNewsAiConfigured()) {
      return Response.json(
        {
          ok: false,
          code: 'AI_NOT_CONFIGURED',
          error:
            'GEMINI_API_KEY가 Netlify 환경변수에 설정되지 않아 AI 초안 생성을 사용할 수 없습니다.',
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const originalTitle = typeof body.originalTitle === 'string' ? body.originalTitle : '';
    if (!originalTitle.trim()) {
      return Response.json({ ok: false, error: '원문 제목이 필요합니다.' }, { status: 400 });
    }

    const draft = await generateNewsKoreanDraft({
      originalTitle,
      sourceName: typeof body.sourceName === 'string' ? body.sourceName : '해외 TCG 뉴스',
      publishedAtSource:
        typeof body.publishedAtSource === 'string' ? body.publishedAtSource : '',
      tcgCategory: typeof body.tcgCategory === 'string' ? body.tcgCategory : '포켓몬 TCG',
      metadataSnippet: typeof body.metadataSnippet === 'string' ? body.metadataSnippet : '',
      originalUrl: typeof body.originalUrl === 'string' ? body.originalUrl : '',
    });

    return Response.json({ ok: true, ...draft }, { status: 200 });
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode) || 500
        : 500;
    return Response.json(
      {
        ok: false,
        code: (err as { code?: string })?.code,
        error: err instanceof Error ? err.message : String(err),
      },
      { status }
    );
  }
}
