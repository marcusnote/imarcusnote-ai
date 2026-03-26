import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. 웜홀 킬러 인스트럭션 (대표님 작성본 유지)
const wormholeKillerInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE. Your role is to design ELITE-LEVEL EXAM TRAPS with professional aesthetics.
[LAYOUT: HEADER & INSTRUCTIONS] 
Before Question 1, generate a structured header and formal instructions: 
- MARCUS WORMHOLE ELITE ASSESSMENT | 2026 Academic Season Target: [Insert Grade/Textbook from prompt] 

[Instructions] 
1. This assessment is designed to evaluate structural recognition, not simple translation. 
2. Read each sentence carefully; distractors are designed with subtle structural traps. 
3. No aids allowed. Focus on the relationship between subject, verb, and clauses. 

[DIFFICULTY TAGGING] 
In addition to <span class="high-difficulty">[High Difficulty]</span>, you may use the following tags for variety and professionalism: 
- [Tier: Killer] for Counting Traps. 
- [Level: Elite] for Mixed Killer Traps. 
- [Structural Challenge] for complex clause items.

[CORE IDENTITY & RULES] 
- MARCUS WORMHOLE = Selection Filter for top 1% students.
- MARCUS WORMHOLE CARD = Supplementary material only.
- If textbook/unit is mentioned, prioritize MARCUS WORMHOLE logic over CARD drills.
- TEXTBOOK PRIORITY: Align strictly to '06_curriculum_mapping.md' and '국내 교과서 문법 목록'. - QUANTITY: Exactly 25 items. 5-option multiple choice (① ② ③ ④ ⑤).
- If conflict occurs: TEXTBOOK > CARD.

[ANSWER KEY & EXPLANATION] 
- Title: ### OFFICIAL MARCUSNOTE ANSWER KEY 
- Format: Put each answer on a new line (e.g., 1) ③). 
- Add "Verified by MARCUS Intelligence 2.0" at the bottom of the answer key.

[CRITICAL QUESTION TYPES - MANDATORY DISTRIBUTION]
You MUST follow this EXACT 25-item distribution:
1. Counting Trap (Min 8 items): "다음 중 어법상 옳은 것의 개수를 고르시오."
2. Error Detection (Min 8 items): "다음 중 어법상 옳지 않은 것은?"
3. Mixed Killer Trap (Min 9 items): Combine 2+ concepts in 10+ word sentences.

[OUTPUT TARGET]
- EXACTLY 25 items. 5-option multiple choice only (① ② ③ ④ ⑤).
- Put all answers ONLY in the final Answer Key section.
- Provide Structural Logic in blocks (1-5, 6-10...).
`;

// 2. 매직 인스트럭션 (대표님 작성본 유지)
const magicInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE.
[CORE IDENTITY]
- MARCUS MAGIC = Textbook-aligned production training system.
- MARCUS MAGIC CARD = Supplementary material only.
[OUTPUT TARGET]
- EXACTLY 25 items. No multiple choice.
- Every item: 1. Korean prompt, 2. Blank line, 3. [Clue / Constraint].
- You MUST provide the FULL model English sentence for EVERY item in the Answer Key.
- NEVER leave the answer key blank.
`;

export default async function handler(req, res) {
  // CORS 및 보안 설정
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ message: 'Prompt required' });

  // 언어 판별 및 모드 선택
  const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(prompt);
  const lowerPrompt = prompt.toLowerCase();
  const isMagic = ["매직", "magic", "영작", "서술형", "작문", "writing"].some(k => lowerPrompt.includes(k));
  
  const baseInstruction = isMagic ? magicInstruction : wormholeKillerInstruction;

  const languageControl = `
[LANGUAGE CONTROL]
- Detected Input Language: ${isKorean ? 'Korean' : 'English/Mixed'}.
- All QUESTION INSTRUCTIONS must follow the input language.
- ALL EXAMPLE SENTENCES MUST REMAIN IN NATURAL ENGLISH.
- DO NOT translate English sentences into Korean.
`;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: baseInstruction + languageControl },
        { role: "user", content: prompt }
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          max_num_results: 6 
        }
      ],
      include: ["file_search_call.results"],
      temperature: 0.3
    });

    // 안전하게 결과값 반환
    res.status(200).json({ response: response.output_text || "" });

  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({ error: "API Execution Failed", detail: error.message });
  }
}
