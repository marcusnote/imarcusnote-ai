import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_ORIGINS = [
  "https://imarcusnote.com",
  "https://www.imarcusnote.com",
  "https://imarcusnote-ai.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

function getCorsHeaders(origin = "") {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://imarcusnote.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res, statusCode, payload, origin = "") {
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).json(payload);
}

function sanitizeInput(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function detectLanguage(text) {
  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
  return hasKorean ? "ko" : "en";
}

function buildSystemPrompt(mode, userPrompt) {
  const lang = detectLanguage(userPrompt);

  const commonRulesKo = `
당신은 I•marcusnote의 전문 영어교육 콘텐츠 엔진입니다.
반드시 교육용 결과물만 출력하십시오.
불필요한 잡담, 서론, 자기소개, 면책문구를 쓰지 마십시오.
출력은 바로 결과물만 쓰십시오.

공통 원칙:
1. 항상 구조적이고 인쇄 가능한 결과를 만드십시오.
2. 제목, 난이도/대상, 문제 본문, 정답/해설이 있으면 명확히 구분하십시오.
3. 문제 번호는 깔끔하게 정렬하십시오.
4. 지나치게 긴 설명 대신, 실제 교재 품질의 결과를 내십시오.
5. 사용자가 한국어로 요청하면 한국 교육 맥락에 맞는 결과를 우선하십시오.
6. 사용자가 지문 변형, 내신, 모의고사, 서술형, 영작 등을 요청하면 그 목적에 맞게 형식을 강제하십시오.
7. 마커스노트 계열 결과처럼 정돈된 시험지/워크북 느낌으로 작성하십시오.
8. 출력 텍스트 안에서 markdown code fence(\`\`\`)는 절대 사용하지 마십시오.
9. 가능하면 다음과 같은 헤더 구조를 활용하십시오:
   # Title
   ## Target Level
   ## Format
   ## Questions
   ## Answer Key
   ## Expert Explanation
`;

  const commonRulesEn = `
You are the I•marcusnote professional educational content engine.
Return only polished educational output.
Do not add small talk, disclaimers, or meta commentary.

Common rules:
1. Produce structured, printable educational material.
2. Separate title, level/target, questions, answer key, and explanations clearly when relevant.
3. Keep numbering clean and consistent.
4. Prefer real worksheet quality over generic AI wording.
5. If the user asks for Korean-school-style materials, reflect that style.
6. If the user asks for transformations, exams, workbook drills, or writing practice, force the output into that format.
7. Do not use markdown code fences.
8. Prefer this structure when suitable:
   # Title
   ## Target Level
   ## Format
   ## Questions
   ## Answer Key
   ## Expert Explanation
`;

  const modeRules = {
    ABC_STARTER: lang === "ko"
      ? `
모드: Junior Starter
- 초중급 또는 기초 입문용.
- 너무 어렵게 만들지 마십시오.
- 짧고 명확한 문항으로 구성하십시오.
- 필요 시 예문과 간단 해설을 포함하십시오.
`
      : `
Mode: Junior Starter
- Beginner-friendly.
- Keep items short, clear, and approachable.
- Include simple examples and short explanations when useful.
`,
    MOCK_EXAM: lang === "ko"
      ? `
모드: Mocks Exam
- 실제 시험지처럼 25문항 중심으로 구성하십시오.
- 객관식 문제가 적합하면 5지선다형으로 구성하십시오.
- 지문 변형 요청이면 지문 기반 고난도 변형 문제를 만드십시오.
- 반드시 시험지다운 밀도와 완성도를 유지하십시오.
`
      : `
Mode: Mocks Exam
- Build a realistic 25-item exam set when appropriate.
- If multiple choice fits, use five options.
- If the request is passage transformation, generate high-quality exam-style variants.
- Keep the tone professional and test-ready.
`,
    MIDDLE_TEXTBOOK: lang === "ko"
      ? `
모드: Middle Exam
- 중등 내신형 스타일.
- 교과서 문법, 본문, 서술형, 변형문제 맥락을 반영하십시오.
- 학교시험용으로 깔끔하게 구성하십시오.
`
      : `
Mode: Middle Exam
- Reflect middle-school textbook and school-exam style.
- Suitable for textbook grammar, passage-based questions, and school assessment materials.
`,
    WORMHOLE: lang === "ko"
      ? `
모드: Wormhole
- 최고난도 문법/변형/실전형.
- 25문항 세트를 우선 고려하십시오.
- 어법, 변형, 고난도 선지, 정답과 간단한 전문가 해설을 포함하십시오.
- 시험 실전감이 나게 작성하십시오.
`
      : `
Mode: Wormhole
- High-difficulty grammar and transformation mode.
- Prefer a 25-item elite set when appropriate.
- Include strong distractors, answer key, and concise expert explanations.
`,
    MAGIC: lang === "ko"
      ? `
모드: Magic Lab
- 영작 훈련/재구성/문장 완성 중심.
- 객관식보다 영작형/서술형을 우선하십시오.
- 단계별 훈련이 가능하도록 문항을 설계하십시오.
`
      : `
Mode: Magic Lab
- Focus on sentence-building, rewriting, composition, and reconstruction.
- Prefer productive writing tasks over multiple choice.
- Make the sequence trainable and workbook-friendly.
`,
    VOCAB_BUILDER: lang === "ko"
      ? `
모드: Vocab Builder
- 어휘 학습, 뜻 추론, 파생어, 예문, 확인 문제 중심.
- 학습 효율이 높도록 표제어와 활용을 정리하십시오.
`
      : `
Mode: Vocab Builder
- Focus on vocabulary learning, meaning inference, derivatives, examples, and checks.
- Make the set practical and study-friendly.
`,
  };

  const fallbackModeRule = lang === "ko"
    ? `
모드가 명확하지 않으면 요청 목적에 가장 적합한 교육용 형식으로 출력하십시오.
`
    : `
If the mode is unclear, choose the most educationally appropriate output format.
`;

  return `
${lang === "ko" ? commonRulesKo : commonRulesEn}

${modeRules[mode] || fallbackModeRule}
`;
}

function buildUserPrompt({ prompt, mode, title }) {
  const safePrompt = sanitizeInput(prompt);
  const safeTitle = sanitizeInput(title);
  const safeMode = sanitizeInput(mode) || "GENERAL";

  return `
[WORKSPACE MODE]
${safeMode}

${safeTitle ? `[WORKSHEET TITLE]\n${safeTitle}\n` : ""}

[USER REQUEST]
${safePrompt}

[OUTPUT INSTRUCTION]
Return the final educational material directly.
`;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return sendJson(
      res,
      405,
      { ok: false, error: "Method not allowed. Use POST." },
      origin
    );
  }

  try {
    const body = req.body || {};
    const prompt = sanitizeInput(body.prompt);
    const mode = sanitizeInput(body.mode || "GENERAL");
    const title = sanitizeInput(body.title || body.worksheetTitle || "");

    if (!prompt) {
      return sendJson(
        res,
        400,
        { ok: false, error: "Prompt is required." },
        origin
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return sendJson(
        res,
        500,
        { ok: false, error: "Missing OPENAI_API_KEY." },
        origin
      );
    }

    const systemPrompt = buildSystemPrompt(mode, prompt);
    const userPrompt = buildUserPrompt({ prompt, mode, title });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 3500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const responseText =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!responseText) {
      return sendJson(
        res,
        500,
        { ok: false, error: "Model returned an empty response." },
        origin
      );
    }

    return sendJson(
      res,
      200,
      {
        ok: true,
        response: responseText,
        mode,
        title: title || null,
      },
      origin
    );
  } catch (error) {
    console.error("api/generate error:", error);

    const statusCode = error?.status && Number.isInteger(error.status)
      ? error.status
      : 500;

    return sendJson(
      res,
      statusCode,
      {
        ok: false,
        error:
          error?.message ||
          "An unexpected error occurred while generating the worksheet.",
      },
      origin
    );
  }
}
