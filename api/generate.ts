export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const { prompt, memberId } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;
    const msKey = process.env.MEMBERSTACK_SECRET_KEY; // sk_live_... 키 확인 필수
    const assistantId = "asst_iMbzdAAogiZApGfSUObptW9A";

    if (!memberId) throw new Error("로그인이 필요합니다.");

    // 1. 멤버스택 유저 정보 조회
    const msResponse = await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
      headers: { "X-API-KEY": msKey }
    });
    const member = await msResponse.json();
    
    // CEO님께서 주신 플랜 ID 매칭
    const PLAN_IDS = {
      BASIC: "pln_basic-z2cc0oqz",
      STANDARD: "pln_standard-y5cd0okd",
      PREMIUM: "pln_premium-montly-jl5q0qjp",
      ELITE: "pln_elite-enterprise-4ace0ogg"
    };

    // 요금제별 일일 지급 포인트 설정
    let dailyLimit = 0;
    const userPlans = member.planConnections || [];
    
    if (userPlans.some(p => p.planId === PLAN_IDS.ELITE)) dailyLimit = 2000;      // Elite: 2000 MP
    else if (userPlans.some(p => p.planId === PLAN_IDS.PREMIUM)) dailyLimit = 500; // Premium: 500 MP
    else if (userPlans.some(p => p.planId === PLAN_IDS.STANDARD)) dailyLimit = 150; // Standard: 150 MP
    else if (userPlans.some(p => p.planId === PLAN_IDS.BASIC)) dailyLimit = 20;     // Basic: 20 MP

    // 2. 일일 리셋 및 포인트 확인
    let dailyMP = parseInt(member.customFields?.daily || "0");
    const lastReset = member.customFields?.last_reset_date || "";
    const today = new Date().toISOString().split('T')[0];

    // 날짜가 바뀌었으면 포인트 리셋
    if (lastReset !== today) {
        dailyMP = dailyLimit;
        await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
            method: "PATCH",
            headers: { "X-API-KEY": msKey, "Content-Type": "application/json" },
            body: JSON.stringify({ 
                customFields: { 
                    daily: dailyMP.toString(), 
                    last_reset_date: today 
                } 
            })
        });
    }

    // 포인트 부족 체크
    if (dailyMP <= 0) {
        return new Response(JSON.stringify({ error: "오늘의 Marcus Points를 모두 소모했습니다. 내일 다시 충전됩니다!" }), { 
            status: 403, 
            headers: { ...headers, 'Content-Type': 'application/json' } 
        });
    }

    // 3. 포인트 1 차감 로직
    await fetch(`https://admin.memberstack.com/v1/members/${memberId}`, {
        method: "PATCH",
        headers: { "X-API-KEY": msKey, "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: { daily: (dailyMP - 1).toString() } })
    });

    // 4. OpenAI Assistant 실행 (스트리밍)
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
    return new Response(JSON.stringify({ error: `SYSTEM_ERROR: ${error.message}` }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
}
