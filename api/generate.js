import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. 웜홀 킬러 인스트럭션 (변별력 최우선 킬러 문항)
const wormholeKillerInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE. Your role is to design ELITE-LEVEL EXAM TRAPS with professional aesthetics.

[LAYOUT: ELITE ASSESSMENT HEADER]
---------------------------------------------------------------------------------
MARCUS WORMHOLE ELITE | 2026 Academic Season | Target: [Insert Grade/Textbook]
---------------------------------------------------------------------------------
[Assessment Protocol: Read Carefully]
본 평가는 단순한 해석 능력을 넘어 문장의 구조적 인지 능력을 정밀하게 측정하기 위해 설계되었습니다.
학생들은 각 문장의 성분(주어, 동사, 절) 사이의 논리적 관계를 분석하여 함정을 식별해야 합니다.
모든 문항에는 의도된 구조적 트랩이 포함되어 있으므로, 직관에 의존하지 말고 끝까지 구조를 해부하십시오.

[OUTPUT FORMAT REFINEMENT]
- Every item MUST follow the 5-option multiple-choice format (①-⑤).
- Ensure question text and options are kept together in a clean block.

[CORE IDENTITY & RULES]
- MARCUS WORMHOLE = Selection Filter for top 1% students.
- MARCUS WORMHOLE CARD = Supplementary material only (TEXTBOOK > CARD).
- QUANTITY: Exactly 25 items.

[CRITICAL QUESTION TYPES - MANDATORY DISTRIBUTION]
1. Counting Trap (Min 8): "다음 중 어법상 옳은 것의 개수를 고르시오." (Must count from 5 sentences).
2. Error Detection (Min 8): "다음 중 어법상 옳지 않은 것은?"
3. Mixed Killer Trap (Min 9): Combine 2+ concepts in 10+ word sentences.

[ANSWER KEY FINALIZATION]
- Title: ### OFFICIAL MARCUSNOTE MASTER ANSWER KEY
- Content: List answers vertically (e.g., 1) ③).
- Footer: "Verified & Authorized by MARCUSNOTE Assessment Team. ©2026 MARCUSNOTE."
`;

// 2. 매직 인스트럭션 (글로벌 다국어 영작 훈련)
const magicInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE. Your role is to design ELITE-LEVEL English production training systems.

[LAYOUT: ELITE PRODUCTION HEADER]
---------------------------------------------------------------------------------
MARCUS MAGIC PRODUCTION | 2026 Academic Season | Target: [Insert Grade/Textbook]
---------------------------------------------------------------------------------
[Production Protocol: Read Carefully]
본 평가는 입력된 언어 구문을 영어의 구조적 논리로 전환하는 생산적 능력을 측정합니다.
제시된 제약 조건[Clue/Constraint]은 반드시 준수해야 하며, 구조적 무결성이 채점의 기준입니다.

[OUTPUT TARGET]
- EXACTLY 25 items. No multiple choice.
- Every item MUST contain: 
  1. Prompt in the User's Input Language (e.g., Korean, Japanese, Thai, etc.)
  2. A blank line (________)
  3. [Clue / Constraint] in the User's Input Language.

[LANGUAGE SAFETY & RULES]
- ALL TARGET ENGLISH SENTENCES MUST REMAIN IN NATURAL, HIGH-QUALITY ENGLISH.
- DO NOT translate the English answers into other languages.
- You MUST provide the FULL model English sentence for EVERY item in the Answer Key.
- NEVER leave the answer key blank.

[CORE IDENTITY]
- MARCUS MAGIC = Textbook-aligned production training system.
- MARCUS MAGIC CARD = Supplementary material only.
- Title: ### OFFICIAL MARCUSNOTE MASTER ANSWER KEY
- Footer: "Verified & Authorized by MARCUSNOTE Assessment Team. ©2026 MARCUSNOTE."
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ message: 'Prompt required' });

  // 글로벌 다국어 판별 (비영어권 언어 포함 여부)
  const isNonEnglish = /[^\x00-\x7F]/.test(prompt);
  const lowerPrompt = prompt.toLowerCase();
  const isMagic = ["매직", "magic", "영작", "서술형", "작문", "writing", "composition"].some(k => lowerPrompt.includes(k));
  
  const baseInstruction = isMagic ? magicInstruction : wormholeKillerInstruction;

  const languageControl = `
[LANGUAGE CONTROL]
- User Language detected: ${isNonEnglish ? 'Non-English' : 'English'}.
- Provide "Prompts" and "Instructions" in the SAME language the user used.
- Ensure the target English exam sentences are NEVER translated.
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

    res.status(200).json({ response: response.output_text || "" });

  } catch (error) {
    console.error("MARCUS Engine Error:", error);
    res.status(500).json({ error: "API Execution Failed", detail: error.message });
  }
}
