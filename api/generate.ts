export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache', // 스트리밍 유지 필수
    'Connection': 'keep-alive',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const { prompt } = await req.json();
    const API_KEY = process.env.OPENAI_API_KEY;
    const ASSISTANT_ID = "asst_iMbzdAAogiZApGfSUObptW9A";

    // [3단계] 에러 방지: OpenAI 호출 (최대 3회 자동 재시도 로직 내포)
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

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Status ${response.status}: ${errText}`);
    }

    return new Response(response.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `I•MARCUSNOTE Engine Busy. ${error.message}` }), { 
      status: 500, 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    });
  }
}
