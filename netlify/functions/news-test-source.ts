import { testAndParseFeed, verifyAdminBearerToken } from '../../server/newsSyncCore.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    await verifyAdminBearerToken(token);

    const body = (await req.json().catch(() => ({}))) as { feedUrl?: string };
    const feedUrl = typeof body.feedUrl === 'string' ? body.feedUrl : '';
    if (!feedUrl.trim()) {
      return Response.json(
        { ok: false, error: '테스트할 피드 URL을 입력해 주세요.' },
        { status: 400 }
      );
    }

    const result = await testAndParseFeed(feedUrl);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode) || 500
        : 500;
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status }
    );
  }
}
