export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  // [수정 포인트 1] CORS 헤더에 x-site-id를 명시적으로 허용합니다.
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-site-id', // x-site-id 추가
  };

  // 1. CORS Preflight 대응
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  // 2. POST 방식이 아니면 차단
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST 방식만 허용됩니다.' }), {
      status: 405, headers
    });
  }

 // 기존 로직을 잠시 주석 처리하거나 아래처럼 직접 비교로 수정
const xSiteId = req.headers.get('x-site-id');
const EXPECTED_ID = "app_cmmm5k2i6007f0ttcejo13pcg"; // 대표님의 실제 ID

if (!xSiteId || xSiteId !== EXPECTED_ID) {
    return new Response(JSON.stringify({ 
        error: `Missing or Invalid header x-site-id. Received: ${xSiteId}` 
    }), { status: 401, headers });
}

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'JSON 바디가 비어있습니다.' }), {
        status: 400, headers
      });
    }

    const { prompt, memberId } = body;
    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = "asst_iMbzdAAogizAPGFSUObptW9A";

    if (!prompt) {
      return new Response(JSON.stringify({ error: '명령어가 누락되었습니다.' }), {
        status: 400, headers
      });
    }

    // OpenAI API 호출 부분 (기존과 동일)
    const openAIResponse = await fetch("https://api.openai.com/v1/threads/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        thread: { messages: [{ role: "user", content: prompt }] },
        stream: true 
      })
    });

    if (!openAIResponse.ok) {
      const errorMsg = await openAIResponse.text();
      throw new Error(`OpenAI API Error: ${errorMsg}`);
    }

    return new Response(openAIResponse.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `SYSTEM_ERROR: ${error.message}` }), { 
      status: 500, 
      headers
    });
  }
}
