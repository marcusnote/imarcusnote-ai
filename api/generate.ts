export const runtime = 'edge';

export default async function handler(req: Request) {
  const body = await req.json();

  const prompt = body.prompt;

  return new Response(
    JSON.stringify({
      message: "AI 연결 준비 완료",
      input: prompt,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
