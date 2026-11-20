import { isNewsAiConfigured } from '../../server/newsAi.ts';
import { isCronAuthConfigured } from '../../server/newsSyncCore.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const netlifyBlobsAvailable = Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.CONTEXT ||
      process.env.NETLIFY === 'true' ||
      (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN)
  );

  return Response.json({
    ok: true,
    aiDraftAvailable: isNewsAiConfigured(),
    cronAuthConfigured: isCronAuthConfigured(),
    netlifyBlobsAvailable,
    runtime: 'netlify-function',
  });
}
