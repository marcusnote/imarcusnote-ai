export const runtime = 'edge';

export default async function handler(req: Request) {
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'API is working',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const prompt = body.prompt ?? '';

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'POST received',
        input: prompt,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
