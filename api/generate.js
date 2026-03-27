const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =========================
// 🔥 안정화 핵심 1: OUTPUT 파싱 함수
// =========================
function extractText(response) {
  if (!response) return '';

  if (response.output_text) return response.output_text;

  if (response.output?.length) {
    return response.output
      .map(o =>
        (o.content || [])
          .map(c => c.text || '')
          .join('')
      )
      .join('');
  }

  return '';
}

// =========================
// 🔥 기존 Instruction (원본 유지)
// =========================
// 👉 대표님 기존 wormholeInstruction / magicInstruction / mockExamInstruction / middleTextbookInstruction
// 👉 여기에 있는 코드 그대로 유지 (생략 없이 그대로 두세요)

// =========================
// 🔥 기존 Helper (원본 유지)
// =========================
// detectEngineType, buildSourceLabel 등 전부 그대로 유지

// =========================
// API HANDLER
// =========================
module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // =========================
  // 🔥 핵심 수정: mode 추가
  // =========================
  const { prompt, mode } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ message: 'Missing OPENAI_API_KEY' });
  }

  if (!process.env.OPENAI_VECTOR_STORE_ID) {
    return res.status(500).json({ message: 'Missing OPENAI_VECTOR_STORE_ID' });
  }

  const normalizedPrompt = prompt.trim();

  // 🔥 핵심: 버튼 우선
  const engineType = mode || detectEngineType(normalizedPrompt);

  const baseInstruction = getBaseInstructionByEngine(engineType);
  const detectedLanguage = detectPromptLanguage(normalizedPrompt);
  const routingControl = buildRoutingControl(engineType);
  const itemCount = getItemCountByEngine(engineType);
  const sourceLabel = buildSourceLabel(normalizedPrompt, engineType);

  const languageControl = `
[LANGUAGE CONTROL]
- Detected user language: ${detectedLanguage}.
- Follow this language for instructions.
`;

  const quantityControl = `
[QUANTITY CONTROL]
- Generate exactly ${itemCount} items.
- Complete full answer key.
`;

  const fullSystemPrompt = [
    baseInstruction,
    routingControl,
    languageControl,
    quantityControl
  ].join('\n');

  try {

    // =========================
    // 1차 생성
    // =========================
    let response = await openai.responses.create({
      model: 'gpt-4o-mini',
      max_output_tokens: 6500, // 🔥 증가
      input: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: normalizedPrompt }
      ],
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          max_num_results: 6
        }
      ]
    });

    // 🔥 디버그 로그
    console.log('RAW RESPONSE:', JSON.stringify(response, null, 2));

    // 🔥 핵심 수정
    let finalText = extractText(response);

    // =========================
    // 🔥 재시도 안정화
    // =========================
    if (!finalText || finalText.length < 500) {

      console.log('⚠️ RETRY TRIGGERED');

      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens: 6500,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              `
[RETRY]
Generate full complete exam.
Do NOT stop early.
`
          },
          { role: 'user', content: normalizedPrompt }
        ],
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
            max_num_results: 6
          }
        ]
      });

      finalText = extractText(response);
    }

    // =========================
    // 후처리 (원본 유지)
    // =========================
    finalText = stabilizeNumbers(finalText);
    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSourceLabel(finalText, sourceLabel.labelText);

    return res.status(200).json({
      response: finalText
    });

  } catch (error) {
    console.error('MARCUS Engine Error:', error);

    return res.status(500).json({
      error: 'API Execution Failed',
      detail: error?.message || 'Unknown error'
    });
  }
};
