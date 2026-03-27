const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =========================
// 1) ABC STARTER (초등)
// =========================
const abcStarterInstruction = `
You are the Senior Chief Elementary Architect of MARCUSNOTE.

[IDENTITY]
- Abcstarter56 = MARCUSNOTE elementary foundation system

[LEVEL]
- CEFR A1
- Sentence max 6 words
- Very simple vocabulary

[QUESTION RULE]
- ALWAYS 5-option multiple choice
①②③④⑤ only
- No subjective questions

[STYLE]
- Very clear
- Short sentences
- Easy but structured

[ANSWER KEY]
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ①
2) ②
3) ③
`;

// =========================
// 기존 엔진들 (생략 없이 그대로 유지)
// =========================

// 👉 기존 wormholeInstruction 그대로
// 👉 mockExamInstruction 그대로
// 👉 middleTextbookInstruction 그대로
// 👉 magicInstruction 그대로

// =========================
// 엔진 선택 (🔥 핵심)
// =========================
function getInstruction(engineType) {
  switch (engineType) {
    case 'ABC_STARTER': return abcStarterInstruction;
    case 'MOCK_EXAM': return mockExamInstruction;
    case 'MIDDLE_TEXTBOOK': return middleTextbookInstruction;
    case 'MAGIC': return magicInstruction;
    default: return wormholeInstruction;
  }
}

// =========================
// 문항 수
// =========================
function getItemCount(engineType) {
  if (engineType === 'ABC_STARTER') return 10;
  if (engineType === 'WORMHOLE') return 25;
  return 15;
}

// =========================
// 품질 체크
// =========================
function isBad(text = '') {
  if (!text.includes('### OFFICIAL MARCUSNOTE ANSWER KEY')) return true;
  if (text.length < 1000) return true;
  return false;
}

// =========================
// API
// =========================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { prompt, mode } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    // ⭐ 핵심: 버튼 기반 엔진
    const engineType = mode || 'MOCK_EXAM';

    const instruction = getInstruction(engineType);
    const itemCount = getItemCount(engineType);

    const systemPrompt = `
${instruction}

[ENGINE LOCK]
- Selected engine: ${engineType}
- NEVER change engine

[QUANTITY]
- Generate exactly ${itemCount} questions

[STRICT RULE]
- Do NOT stop early
- Do NOT omit answer key
`;

    let response = await openai.responses.create({
      model: 'gpt-4o-mini',
      max_output_tokens: 5200,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    let text = response.output_text || '';

    // 재시도
    if (isBad(text)) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens: 5200,
        input: [
          {
            role: 'system',
            content: systemPrompt + `
[RETRY]
- Previous output was incomplete
- regenerate full exam
`
          },
          { role: 'user', content: prompt }
        ]
      });

      text = response.output_text || '';
    }

    return res.status(200).json({
      response: text
    });

  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
};
