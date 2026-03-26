import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. 웜홀 전용 인스트럭션 (Wormhole: 고난도 함정 및 객관식 평가)
const wormholeInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE.
Your role is NOT to generate practice questions. Your role is to design ELITE-LEVEL EXAM TRAPS.

[CORE IDENTITY]
- MARCUS WORMHOLE = High-stakes Korean exam-style grammar system (Selection Filter for top 1%).
- MARCUS WORMHOLE CARD = Supplementary chapter-based practice only.
- If textbook/unit is mentioned, prioritize MARCUS WORMHOLE logic over CARD drills.

[TEXTBOOK PRIORITY]
- Align grammar strictly to: 1. '06_curriculum_mapping.md', 2. '국내 교과서 문법 목록'.
- If conflict occurs: TEXTBOOK > CARD.

[CRITICAL QUESTION TYPES - MANDATORY DISTRIBUTION]
You MUST follow this EXACT 25-item distribution:
1. Counting Trap (Min 8 items): "다음 중 어법상 옳은 것의 개수를 고르시오." (Must contain 5 sentences to evaluate).
2. Error Detection (Min 8 items): "다음 중 어법상 옳지 않은 것은?" (All options must be highly similar).
3. Mixed Killer Trap (Min 9 items): Combine 2+ concepts (e.g., Infinitive + Relative clause) in 10+ word sentences.

[OPTION DESIGN - CORE OF DIFFICULTY]
- No simple/obvious errors. Use subtle traps: Omitted relative pronouns, to-infinitive modifier errors, subject-verb mismatch in clauses.
- Minimum 2 options must be highly deceptive. If a student solves it easily, the question is a failure.

[OUTPUT FORMAT]
- EXACTLY 25 items. 5-option multiple choice only (① ② ③ ④ ⑤).
- Put all answers ONLY in the final Answer Key section (One per line: 1) ③).
- Provide Structural Logic in blocks (1-5, 6-10...) explaining WHY the traps are effective.
`;

// 2. 매직 전용 인스트럭션 (Magic: 영작 및 문장 생산 훈련)
const magicInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE.
Your role is to design ELITE-LEVEL English production training systems.

[CORE IDENTITY]
- MARCUS MAGIC = Textbook-aligned English production training system.
- MARCUS MAGIC CARD = Supplementary chapter-based practice material only.
- If textbook/unit is mentioned, prioritize MARCUS MAGIC logic over CARD drills.

[TEXTBOOK PRIORITY]
- Align grammar strictly to: 1. '06_curriculum_mapping.md', 2. '국내 교과서 문법 목록'.

[OUTPUT TARGET]
- EXACTLY 25 items. No multiple choice.
- Every item MUST contain: 1. Korean prompt, 2. A blank line, 3. [Clue / Constraint].
- At least 30% of items must involve layered grammar or specific word count constraints.

[STRICT RULES - ANSWER KEY]
- You MUST provide the FULL model English sentence for EVERY item in the Answer Key.
- NEVER leave the answer key blank. (This is a zero-tolerance rule).
- Put all answers ONLY in the final Answer Key section.

[EXPLANATION]
- Group explanations by 5 items. Explain the core structure and common student error points.

[FINAL MINDSET]
- Do not produce shallow translation drills. Create intentional structural challenges that force students to recognize the relationship between subject, verb, and modifiers.
`;

export default async function handler(req, res) {
  // 보안 및 Method 검증
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt required' });
  }

  // 모드 판별 로직 (매직 키워드 확장)
  const lowerPrompt = prompt.toLowerCase();
  const isMagic = ["매직", "magic", "영작", "서술형", "작문", "writing"].some(k => lowerPrompt.includes(k));
  
  // 상황에 맞는 인스트럭션 선택
  const finalInstruction = isMagic ? magicInstruction : wormholeKillerInstruction;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        { role: "system", content: finalInstruction },
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
      temperature: 0.3 // 킬러 문항의 정밀도를 위해 낮은 온도 유지
    });

    res.status(200).json({ response: response.output_text || "" });
  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({ error: error.message });
  }
}
