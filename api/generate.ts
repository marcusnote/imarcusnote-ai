export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  try {
    // 3. 데이터(JSON) 파싱
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
    const assistantId = "asst_iMbzdAAogizAPGFSUObptW9A"; // 대표님의 Assistant ID

    if (!prompt) {
      return new Response(JSON.stringify({ error: '명령어가 누락되었습니다.' }), {
        status: 400, headers
      });
    }

    // 4. OpenAI Assistant 실행 (스트리밍)
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

    // 5. 스트림 결과 그대로 반환
    return new Response(openAIResponse.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `SYSTEM_ERROR: ${error.message}` }), { 
      status: 500, 
      headers
    });
  }
}
