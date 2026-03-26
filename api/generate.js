import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS 설정 (기존과 동일)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. 
[CORE DATA] Access your Vector Store for these rules:
1. CURRICULUM MAPPING: Use '06_curriculum_mapping.md' for textbook-specific logic.
2. GRAMMAR LIST: Refer to '중1,2,3 국내 교과서 문법 목록' for precise unit targets.
3. BRAND RULES: Follow '01_brand_philosophy' and '05_forbidden_patterns'.

[GENERATION PROTOCOL]
- TEXTBOOK MODE: If unit/textbook is mentioned, override general concepts.
- QUANTITY: Exactly 25 items (1-25).
- FORMAT: <span class="high-difficulty">[High Difficulty]</span> for 5pts+ items.
- OUTPUT: Horizontal Answer Key + Expert Explanations (Trap Type & Structural Reasoning).
`;

  try {
    // [수정] .parse() 대신 .create()를 사용하여 file_search와의 호환성 확보
    const completion = await openai.beta.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      tools: [
        { 
          type: "file_search" 
        }
      ],
      // [수정] Vector Store ID를 명시적으로 연결
      tool_choice: "auto",
      temperature: 0.4,
    }, {
      headers: { "OpenAI-Beta": "assistants=v2" }
    });

    // 최종 텍스트 결과값 추출
    const resultText = completion.choices[0].message.content;

    res.status(200).json({ 
      response: resultText 
    });

  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({ 
      error: "System Optimization in progress. Please try again.",
      detail: error.message 
    });
  }
}
