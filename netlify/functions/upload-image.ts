
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // 인증 기능을 연결하기 전에는 업로드를 허용하지 않습니다.
  return {
    statusCode: 403,
    body: JSON.stringify({
      error: 'Upload authentication is not configured yet'
    })
  };
};
