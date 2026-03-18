export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // 1. CORS 및 헤더 설정 (프레이머 연동 필수)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { prompt } = await req.json();
    const API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = "asst_iMbzdAAogiZApGfSUObptW9A"; 

    // 2. OpenAI Assistants API 실시간 스트리밍 호출
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
        stream: true 
      })
    });

    if (!response.ok) throw new Error(`OpenAI Error: ${response.status}`);

    // 3. 스트리밍 데이터를 프레이머로 그대로 전달
    return new Response(response.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
}
