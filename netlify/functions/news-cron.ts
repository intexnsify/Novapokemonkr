import { isCronAuthConfigured, runNewsSync } from '../../server/newsSyncCore.ts';

export const config = {
  schedule: '0 * * * *',
};

export default async function handler(): Promise<Response> {
  if (!isCronAuthConfigured()) {
    console.warn(
      '[NOVA] Scheduled news sync skipped: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY is not configured.'
    );
    return Response.json(
      {
        ok: false,
        skipped: true,
        reason: 'CRON_AUTH_NOT_CONFIGURED',
      },
      { status: 200 }
    );
  }

  try {
    const summary = await runNewsSync({ trigger: 'cron' });
    return Response.json(summary, { status: 200 });
  } catch (err) {
    console.error('[NOVA] Scheduled news sync error (non-fatal to main site):', err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 }
    );
  }
}
