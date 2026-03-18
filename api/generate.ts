export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream', // 스트리밍 전용 헤더
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  // 1. GET 요청 대응 (주소창 확인용 유지)
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ ok: true, message: "MARCUSNOTE Engine Ready." }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  // 2. POST 요청 (실제 AI 생성 로직)
  try {
    const { prompt } = await req.json();
    const API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = "asst_iMbzdAAogiZApGfSUObptW9A";

    const response = await fetch("https://api.openai.com/v1/threads/runs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: ASSISTANT_ID,
        thread: { messages: [{ role: "user", content: prompt }] },
        stream: true 
      })
    });

    if (!response.ok) throw new Error(`OpenAI Error: ${response.status}`);

    // [핵심] 스트리밍 데이터를 그대로 프레이머로 전달
    return new Response(response.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
}
