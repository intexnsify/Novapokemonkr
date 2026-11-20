import {
  BUILT_IN_SOURCES,
  fetchFeedsForAdminSources,
  verifyAdminBearerToken,
  type ClientFeedFetchSourceInput,
} from '../../server/newsSyncCore.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    await verifyAdminBearerToken(token);

    const body = (await req.json().catch(() => ({}))) as {
      sources?: ClientFeedFetchSourceInput[];
    };
    const rawSources = Array.isArray(body.sources) ? body.sources : BUILT_IN_SOURCES;
    const results = await fetchFeedsForAdminSources(rawSources);
    return Response.json({ ok: true, results }, { status: 200 });
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
