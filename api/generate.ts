export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const { prompt, memberId } = await req.json(); // 프레이머에서 memberId를 넘겨받아야 함
    const apiKey = process.env.OPENAI_API_KEY;
    const msKey = process.env.MEMBERSTACK_SECRET_KEY;
    const assistantId = "asst_iMbzdAAogiZApGfSUObptW9A";

    if (!memberId) throw new Error("로그인이 필요합니다.");

    // 1. 멤버스택 유저 정보 조회 (MP 체크)
    const msResponse = await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
      headers: { "X-API-KEY": msKey }
    });
    const member = await msResponse.json();
    
    // Custom Fields에서 포인트 가져오기 (필드명은 어제 만드신 이름과 일치해야 함)
    let dailyMP = parseInt(member.customFields?.daily || "0");
    const lastReset = member.customFields?.last_reset_date || "";
    const today = new Date().toISOString().split('T')[0];

    // 2. 일일 리셋 로직 (날짜가 바뀌었으면 포인트 충전)
    if (lastReset !== today) {
        dailyMP = 20; // Basic 기준 기본 20MP 지급 (요금제별 분기 가능)
        // 멤버스택 업데이트 (날짜와 포인트 리셋)
        await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
            method: "PATCH",
            headers: { "X-API-KEY": msKey, "Content-Type": "application/json" },
            body: JSON.stringify({ customFields: { daily: "20", last_reset_date: today } })
        });
    }

    // 3. 포인트 부족 시 차단
    if (dailyMP <= 0) {
        return new Response(JSON.stringify({ error: "오늘의 Marcus Points(MP)를 모두 소모했습니다. 내일 다시 충전되거나 Elite 플랜으로 업그레이드하세요!" }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 4. 포인트 1 차감 후 멤버스택 업데이트
    await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
        method: "PATCH",
        headers: { "X-API-KEY": msKey, "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: { daily: (dailyMP - 1).toString() } })
    });

    // 5. OpenAI Assistant 실행 (스트리밍)
    const response = await fetch("https://api.openai.com/v1/threads/runs", {
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

    return new Response(response.body, { headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `MARCUSNOTE_SYSTEM_ERROR: ${error.message}` }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
}
