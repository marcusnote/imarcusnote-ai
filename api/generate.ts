export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  // 1. GET 테스트 (살아있는지 확인용)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  try {
    const { prompt } = await req.json();
    // 환경 변수 직접 확인 로직 추가
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error("API_KEY_MISSING_IN_VERCEL");
    }

    const response = await fetch("https://api.openai.com/v1/threads/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: "asst_iMbzdAAogiZApGfSUObptW9A",
        thread: { messages: [{ role: "user", content: prompt }] },
        stream: true 
      })
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`OpenAI_Error_${response.status}: ${errorDetail}`);
    }

    return new Response(response.body, { headers });

  } catch (error: any) {
    // 프레이머 화면에 구체적인 에러 원인을 찍어줍니다.
    return new Response(JSON.stringify({ error: `MARCUSNOTE_ENGINE_ERROR: ${error.message}` }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
}
