import { OpenAI } from 'openai';

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: Request) {
  // 1. CORS 설정 (프레이머 연동 필수)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const { prompt } = await req.json();
    
    // CEO님의 자산: Vector Store ID
    const VECTOR_STORE_ID = "vs_69bab4dc20cc8191bb0585b197d9f7a0";
    // [중요] OpenAI Assistant ID를 여기에 입력하세요!
    asst_iMbzdAAogiZApGfSUObptW9A

    // 2. 차세대 스트리밍 실행 (OpenAI v2)
    const stream = await openai.beta.threads.createAndRunStream({
      assistant_id: ASSISTANT_ID,
      thread: {
        messages: [{ role: "user", content: prompt }],
        tool_resources: { "file_search": { "vector_store_ids": [VECTOR_STORE_ID] } }
      },
    });

    // 3. 실시간 응답 반환
    return new Response(stream.toReadableStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    // [3단계] 에러 발생 시 재시도 안내 로직
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
