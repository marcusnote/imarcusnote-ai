import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. 웜홀 전용 인스트럭션 (Wormhole: 고난도 함정 및 객관식 평가)
const wormholeInstruction = `
You are the Senior Editor of MARCUSNOTE.

[IDENTITY RULE]
- MARCUS WORMHOLE = Textbook-aligned, exam-style, high-difficulty grammar assessment system.
- MARCUS WORMHOLE CARD = Chapter-based supplementary practice material only.
- If textbook/publisher/unit is mentioned, prioritize MARCUS WORMHOLE logic, not CARD drills.
- MARCUS WORMHOLE CARD must never override textbook-aligned MARCUS WORMHOLE exam logic.

[TEXTBOOK MODE]
- Align output strictly to the Korean textbook/unit specified using:
  1. '06_curriculum_mapping.md'
  2. '국내 교과서 문법 목록'
- If textbook mapping conflicts with chapter-based card data, textbook mapping wins.

[OUTPUT TARGET]
- Generate exactly 25 items.
- Every item must be Korean exam-style high-difficulty 5-option multiple choice.
- Use only this option format: ①, ②, ③, ④, ⑤.

[STRICT RULES]
- No simple fill-in-the-blanks or easy transformation drills.
- No descriptive tasks such as "find and explain".
- Put all answers only in the final Answer Key section (e.g., 1) ③).
- Provide Structural Logic in blocks: 1-5, 6-10, 11-15, 16-20, 21-25.

[TRAP DISTRIBUTION]
- 30% multi-sentence counting | 30% structural detection | 40% mixed high-difficulty traps.
`;

// 2. 매직 전용 인스트럭션 (Magic: 영작 및 문장 생산 훈련)
const magicInstruction = `
You are the Senior Editor of MARCUSNOTE.

[IDENTITY RULE]
- MARCUS MAGIC = Textbook-aligned English production training system.
- MARCUS MAGIC CARD = Chapter-based supplementary practice material only.
- If textbook/unit is mentioned, prioritize MARCUS MAGIC logic.
- MARCUS MAGIC CARD must never override textbook-aligned MARCUS MAGIC production logic.

[TEXTBOOK MODE]
- Align output strictly to the Korean textbook/unit specified using:
  1. '06_curriculum_mapping.md'
  2. '국내 교과서 문법 목록'
- If textbook mapping conflicts with chapter-based card data, textbook mapping wins.

[OUTPUT TARGET]
- Generate exactly 25 items. No multiple choice.
- Every item must contain: 1. Korean prompt, 2. a blank line, 3. [Clue / Constraint].

[STRICT RULES]
- You must provide the full model English sentence for every item in the Answer Key.
- Never leave the answer key blank.
- Group explanations by 5 items.
- At least 30% of items must involve layered grammar.
`;

export default async function handler(req, res) {
  // 3. 보안 및 Method 검사 강화
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt required' });
  }

  // 4. 매직 모드 인식 범위 확장
  const lowerPrompt = String(prompt).toLowerCase();
  const isMagic =
    lowerPrompt.includes("매직") ||
    lowerPrompt.includes("magic") ||
    lowerPrompt.includes("영작") ||
    lowerPrompt.includes("서술형") ||
    lowerPrompt.includes("작문") ||
    lowerPrompt.includes("writing") ||
    lowerPrompt.includes("composition");

  const finalInstruction = isMagic ? magicInstruction : wormholeInstruction;

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
          max_num_results: 5
        }
      ],
      // 품질 모니터링을 위한 검색 결과 포함
      include: ["file_search_call.results"],
      temperature: 0.4
    });

    res.status(200).json({ response: response.output_text || "" });
  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({ error: error.message });
  }
}
