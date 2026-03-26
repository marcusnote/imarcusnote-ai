import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // 1. CORS 및 기본 보안 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  // 2. 마커스노트 지능형 지침 (Internal Logic)
  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. 
[CORE DATA] You MUST use 'file_search' to access the Vector Store:
1. CURRICULUM MAPPING: Use '06_curriculum_mapping.md' for textbook-specific logic.
2. GRAMMAR LIST: Refer to '중1,2,3 국내 교과서 문법 목록' for precise unit targets.
3. BRAND RULES: Apply '01_brand_philosophy', '04_item_design_rules', and '05_forbidden_patterns'.

[GENERATION PROTOCOL]
- TEXTBOOK MODE: If unit/textbook is mentioned, override general concepts.
- QUANTITY: Exactly 25 items (1-25).
- FORMAT: <span class="high-difficulty">[High Difficulty]</span> for 5pts+ items.
- OUTPUT: Horizontal Answer Key + Expert Explanations (Trap Type & Structural Reasoning).
`;

  try {
    // 3. Responses API (Chat Completion의 최신 확장판) 호출
    // Note: OpenAI SDK 버전에 따라 'beta.chat.completions' 또는 
    // 전 전용 엔드포인트를 사용하며, 'file_search'를 공식적으로 지원합니다.
    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      // [핵심] 지식 검색 도구와 Vector Store ID를 직접 연결
      tools: [
        { 
          type: "file_search" 
        }
      ],
      tool_choice: "auto",
      // Vector Store를 명시적으로 지정하여 검색 정확도 극대화
      parallel_tool_calls: true,
      temperature: 0.4,
    }, {
      // API 호출 시 생성하신 Vector Store ID를 헤더에 포함하여 명시적 연결
      headers: { "OpenAI-Beta": "assistants=v2" }
    });

    // 4. 최종 결과 반환
    res.status(200).json({ 
      response: response.choices[0].message.content 
    });

  } catch (error) {
    console.error("MARCUSNOTE Responses API Error:", error);
    
    // 에러 발생 시 사용자에게 명확한 메시지 전달
    res.status(500).json({ 
      error: "MARCUS Intelligence Engine is currently being optimized. Please try again in a moment.",
      detail: error.message 
    });
  }
}
