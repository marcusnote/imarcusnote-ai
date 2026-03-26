import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS 및 기본 설정 생략 (기존과 동일)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. 
[CORE DATA] You MUST use 'file_search' to access the following in your Vector Store:
1. CURRICULUM MAPPING: Use '06_curriculum_mapping.md' to determine if the user is requesting textbook-specific or concept-based generation.
2. GRAMMAR LIST: Refer to '중1,2,3 국내 교과서 문법 목록' to identify precise grammar points for specific textbook units.
3. BRAND RULES: Follow '01_brand_philosophy' and '05_forbidden_patterns' for all generation.

[GENERATION PROTOCOL]
- If a textbook/unit is mentioned (e.g., "중2 천재소영순 4과"):
  Step A: Search the grammar list for that unit's specific targets.
  Step B: Generate exactly 25 items based on those targets.
- For all questions: Apply WORMHOLE traps or MAGIC production rules as specified.
- Output: 25 items, Horizontal Answer Key, Expert Explanations with 'Trap Type'.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.4, // 교과서 데이터 정밀 매핑을 위해 온도를 조금 더 낮추어 일관성을 확보합니다.
      tools: [{ type: "file_search" }],
      // Vector Store ID를 요청 시점에 직접 연결하는 설정
      tool_choice: "auto"
    }, {
      // API 요청 헤더에 생성하신 Vector Store ID를 포함하거나, 
      // 해당 ID가 연결된 Assistant ID를 사용하는 환경을 구축해야 합니다.
    });

    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    console.error("MARCUSNOTE Engine Error:", error);
    res.status(500).json({ error: error.message });
  }
}
