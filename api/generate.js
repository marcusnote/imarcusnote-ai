import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // 1. 보안 강화: 허용 도메인을 마커스노트 공식 도메인으로 제한 
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  // 2. 입력 검증: 비정상적인 요청으로 인한 API 비용 낭비 방지 
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt is required' });
  }

  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. Use file_search to access the Vector Store for textbook and brand data.

[CRITICAL: OUTPUT INTEGRITY]
- QUANTITY: Strictly generate exactly 25 items. 
- NO LEAK: Never include answers or hints within the question text. 
- SEPARATION: Questions and Answer Keys must be completely separate sections. 

[MODE 1: WORMHOLE - TRAP DISTRIBUTION]
If requested or default, generate structural traps with this mandatory distribution:
- 30%: Multi-sentence counting (Counting) 
- 30%: Structural detection (Detection) 
- 40%: High-difficulty mixed traps (Mixed Traps) 

[MODE 2: MAGIC - PRODUCTION TRAINING]
If '매직' or 'Magic' is requested:
- Format: Korean Prompt + [Clue/Constraint] -> Blank for English. 
- ANSWER KEY: You MUST provide the FULL model English sentence for each item. Never leave it blank. 

[CORE RULES]
- TEXTBOOK ALIGNMENT: Use '06_curriculum_mapping.md' and '국내 교과서 문법 목록' to match targets. 
- BRANDING: Use <span class="high-difficulty">[High Difficulty]</span> for 5pts+ items. 
- EXPLANATION: Provide Structural Logic for every 5 items. 

[FORMAT RULES]
- Put each answer on a separate line for PDF readability. 
- Do not compress the answer key into one paragraph. 
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o", // 현재 가장 안정적인 모델 선택 
      input: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          // 검색 결과 수를 제한하여 응답의 집중도 향상 
          max_num_results: 5 
        }
      ],
      // 어떤 파일을 참고했는지 디버깅하기 위한 옵션 
      include: ["file_search_call.results"],
      temperature: 0.4
    });

    res.status(200).json({
      // 응답 데이터가 없을 경우를 대비한 안전장치 
      response: response.output_text || "" 
    });

  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({
      error: "Marcus Intelligence Engine Error",
      detail: error.message
    });
  }
}
