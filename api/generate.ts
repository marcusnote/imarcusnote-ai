export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // CORS 설정 (타사 제언 코드에 프레이머 연동을 위해 추가)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  // 1. GET 요청 (브라우저 주소창 확인용)
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'I•MARCUSNOTE API is working. Use POST to send a prompt.',
      }),
      { headers }
    );
  }

  // 2. POST 요청 (프레이머 실제 데이터 연동용)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const prompt = body.prompt ?? 'No prompt provided';

      return new Response(
        JSON.stringify({
          ok: true,
          message: 'POST received successfully by MARCUSNOTE Engine',
          input: prompt,
        }),
        { headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or empty JSON body' }),
        { status: 400, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: false, error: 'Method not allowed' }),
    { status: 405, headers }
  );
}
