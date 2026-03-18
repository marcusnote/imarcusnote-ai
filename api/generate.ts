export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // 1. CORS 설정
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
    const API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = "asst_iMbzdAAogiZApGfSUObptW9A"; // 확인해주신 ID 적용

    // 2. OpenAI Assistants API 호출 (라이브러리 없이 직접 통신)
    const response = await fetch("https://api.openai.com/v1/threads/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
        thread: {
          messages: [{ role: "user", content: prompt }]
        },
        stream: true // 차세대 스트리밍 활성화
      })
    });

    // 3. 실시간 응답 그대로 반환
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
