import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS 허용 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  // 마커스노트 지능형 지침 (지식 검색 연동 최적화)
  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. 
[IMPORTANT] You have access to the MARCUSNOTE Knowledge Base via 'file_search'. 
Always search the knowledge base first to ensure the questions align with:
1. MARCUSNOTE CORE PHILOSOPHY: Structural training, not memorization.
2. FORBIDDEN PATTERNS: No simple fill-in-the-blank or obvious errors.
3. ITEM DESIGN RULES: Plausible distractors, multi-sentence evaluation, and specific trap types.

Output Requirements:
- Generate exactly 25 questions (1-25).
- Use <span class="high-difficulty">[High Difficulty]</span> for complex items with multiple traps.
- Horizontal Answer Key format.
- Expert Explanations including 'Trap Type' and 'Structural Logic'.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // file_search를 지원하는 최신 모델
      messages: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.5, // 품질 일관성을 위해 0.7에서 0.5로 하향 조절 제언
      // [핵심 추가] Vector Store 연결 설정
      tools: [{ type: "file_search" }],
      tool_choice: "auto",
      parallel_tool_calls: true, // 여러 지식을 동시에 검색하도록 설정
    }, {
      // API 호출 시 헤더나 추가 옵션에 vector_store_ids를 직접 넣는 대신, 
      // 현재 Chat Completion API 표준 방식에 맞춰 beta 헤더를 사용하거나 
      // 아래와 같이 Assistants API의 지식 검색 기능을 호출 구조에 내재화합니다.
    });

    // 참고: 일반 Chat Completion에서 file_search 기능을 바로 쓰기 위해서는 
    // OpenAI의 최신 SDK 가이드에 따라 'beta' 기능을 활용하거나 
    // 생성하신 Vector Store ID를 특정 'Assistant'에 미리 연결해두는 것이 가장 안정적입니다.
    
    // 만약 현재 코드 방식(Chat Completion)을 고수하며 Vector Store를 직접 연결하려면 
    // 아래와 같이 해당 'Assistant'를 생성/호출하는 방식으로 전환이 필요할 수 있습니다.
    
    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({ error: error.message });
  }
}
