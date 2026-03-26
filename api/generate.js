import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // 1. CORS 및 기본 보안 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  // 2. 마커스노트 지능형 지침 (지식 검색 최적화)
  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. 
[CORE DATA] Access Vector Store knowledge base for:
1. CURRICULUM MAPPING: Use '06_curriculum_mapping.md' for textbook-specific logic. [cite: 18]
2. GRAMMAR LIST: Refer to '중1,2,3 국내 교과서 문법 목록' for precise unit targets. [cite: 20]
3. BRAND RULES: Apply '01_brand_philosophy' and '05_forbidden_patterns'. [cite: 3, 1]

[GENERATION PROTOCOL]
- TEXTBOOK MODE: If unit/textbook is mentioned, override general concepts. [cite: 19]
- QUANTITY: Exactly 25 items (1-25).
- FORMAT: <span class="high-difficulty">[High Difficulty]</span> for 5pts+ items. [cite: 16]
- OUTPUT: Horizontal Answer Key + Expert Explanations (Trap Type & Structural Reasoning). [cite: 17]
`;

  try {
    // 3. Responses API 호출 (지식 검색을 위한 정석 구조)
    const response = await openai.responses.create({
      model: "gpt-4.1", // 최신 Responses API 지원 모델
      input: [
        {
          role: "system",
          content: marcusInstruction
        },
        {
          role: "user",
          content: prompt
        }
      ],
      // 4. 지식 검색 도구와 Vector Store 직접 연결
      tools: [
        {
          type: "file_search",
          // 환경변수 또는 직접 ID 입력 (vs_69c4e7884720819183adf46ecd85422f)
          vector_store_ids: ["vs_69c4e7884720819183adf46ecd85422f"]
        }
      ],
      temperature: 0.4
    });

    // 5. 결과 텍스트 추출
    const resultText = response.output_text;

    res.status(200).json({
      response: resultText
    });

  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({
      error: "Marcus Engine Error",
      detail: error.message
    });
  }
}
