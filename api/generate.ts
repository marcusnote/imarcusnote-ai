export const runtime = 'edge';

export default async function handler(req: Request) {
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ message: 'API working' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const prompt = body.prompt;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an English teacher." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
