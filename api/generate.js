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
[CORE DATA] Access Vector Store (vs_69c4e7...) for textbook and brand data.

[HEADER DESIGN]
Generate a formal header for each worksheet:
--------------------------------------------------
MARCUSNOTE OFFICIAL WORKSHEET | [Grade/Textbook/Unit]
System: MARCUS Intelligence 2.0 (Structural Training)
--------------------------------------------------

[GENERATION RULES]
1. WORMHOLE MODE: Focus on structural traps. No simple items.
2. NO ANSWER LEAK: Never include the answer in the question text (CRITICAL for Item 26 error).
3. QUANTITY: Exactly 25 or 30 items as requested.
4. HIGH DIFFICULTY: Tag <span class="high-difficulty">[High Difficulty]</span> for items with 2+ traps.

[OUTPUT ALIGNMENT]
- QUESTIONS: Strictly separate from answers.
- ANSWER KEY: Provide a compact, horizontal table (e.g., 1-5, 6-10 in rows).
- EXPLANATIONS: Group all explanations at the end. Use 'Trap Type' and 'Structural Logic'.
- FORMATTING: Ensure no sentence breaks between pages (Use clear spacing).
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
