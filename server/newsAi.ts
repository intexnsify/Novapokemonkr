import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export function isNewsAiConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key !== 'undefined');
}

export interface NewsAiDraftInput {
  originalTitle: string;
  sourceName: string;
  publishedAtSource?: string;
  tcgCategory: string;
  metadataSnippet?: string;
  originalUrl: string;
}

export interface NewsAiDraftResult {
  koreanTitle: string;
  novaSummary: string;
  model: string;
}

export async function generateNewsKoreanDraft(
  input: NewsAiDraftInput
): Promise<NewsAiDraftResult> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!isNewsAiConfigured()) {
    const err = new Error(
      'GEMINI_API_KEY가 서버 환경변수에 설정되지 않았습니다. Netlify 또는 서버 환경변수에 키를 추가한 뒤 사용해 주세요.'
    ) as Error & { code?: string; statusCode?: number };
    err.code = 'AI_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = [
    '당신은 한국 프리미엄 TCG 플랫폼 NOVA의 에디터입니다.',
    '아래 해외 TCG 뉴스 메타데이터만 바탕으로 한국어 기사 제목과 간결한 NOVA 자체 요약 초안을 작성하세요.',
    '원문 기사 전문을 추측하거나 과장하지 말고, 제공된 제목과 짧은 요약 메타데이터 범위 내에서만 사실적으로 정리하세요.',
    '',
    `[출처] ${input.sourceName}`,
    `[카테고리] ${input.tcgCategory}`,
    `[원문 발행일] ${input.publishedAtSource || '미상'}`,
    `[원문 제목] ${input.originalTitle}`,
    `[메타데이터 요약] ${input.metadataSnippet || '없음'}`,
    `[원문 URL] ${input.originalUrl}`,
  ].join('\n');

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          koreanTitle: {
            type: Type.STRING,
            description: '자연스럽고 명확한 한국어 뉴스 제목 (최대 120자)',
          },
          novaSummary: {
            type: Type.STRING,
            description: 'NOVA 자체 요약 초안 (한국어 2~3문장, 메타데이터 기반 사실 요약)',
          },
        },
        required: ['koreanTitle', 'novaSummary'],
      },
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error('AI 응답이 비어 있습니다.');
  }

  const parsed = JSON.parse(rawText) as {
    koreanTitle?: string;
    novaSummary?: string;
  };

  return {
    koreanTitle: (parsed.koreanTitle || input.originalTitle).trim().slice(0, 160),
    novaSummary: (parsed.novaSummary || '').trim().slice(0, 2000),
    model: DEFAULT_GEMINI_MODEL,
  };
}
