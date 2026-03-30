const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const ENGINE_MODE = {
  ABC_STARTER: "ABC_STARTER",
  MOCK_EXAM: "MOCK_EXAM",
  MIDDLE_TEXTBOOK: "MIDDLE_TEXTBOOK",
  WORMHOLE: "WORMHOLE",
  MAGIC: "MAGIC",
  VOCAB_BUILDER: "VOCAB_BUILDER",
};

const ENGINE_LABELS = {
  [ENGINE_MODE.ABC_STARTER]: "Junior Starter",
  [ENGINE_MODE.MOCK_EXAM]: "Mocks Exam",
  [ENGINE_MODE.MIDDLE_TEXTBOOK]: "Middle Exam",
  [ENGINE_MODE.WORMHOLE]: "Wormhole",
  [ENGINE_MODE.MAGIC]: "Magic Lab",
  [ENGINE_MODE.VOCAB_BUILDER]: "Vocab Builder",
};

const MAGIC_SUBMODE = {
  KOREAN_MAGIC: "KOREAN_MAGIC",
  GLOBAL_MAGIC: "GLOBAL_MAGIC",
  GENERAL_MAGIC: "GENERAL_MAGIC",
};

/* =========================
 * 기본 유틸
 * ========================= */

function ensureString(v, fallback = "") {
  if (typeof v === "string") return v.trim();
  if (v == null) return fallback;
  return String(v).trim();
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickFirst(...values) {
  for (const v of values) {
    const s = ensureString(v);
    if (s) return s;
  }
  return "";
}

function isKorean(text = "") {
  return /[가-힣]/.test(text);
}

function containsJapanese(text = "") {
  return /[\u3040-\u30ff]/.test(text);
}

function detectLocale(text = "") {
  if (isKorean(text)) return "ko";
  if (containsJapanese(text)) return "ja";
  return "en";
}

/* =========================
 * 요청 정규화
 * ========================= */

function normalizeBody(body = {}) {
  return {
    selectedEngine: pickFirst(body.selectedEngine, body.mode),
    worksheetTitle: pickFirst(body.worksheetTitle, body.title, "Marcusnote Worksheet"),
    academyName: pickFirst(body.academyName, "Imarcusnote"),
    prompt: pickFirst(body.prompt, body.input),
  };
}

/* =========================
 * 엔진 추론 / 보정
 * ========================= */

function inferEngine(prompt = "") {
  const text = String(prompt || "");
  const lower = text.toLowerCase();

  if (/웜홀|wormhole|마커스웜홀|고난도|어법상|same error|same pattern|grammatically incorrect|grammatically correct/.test(lower)) {
    return ENGINE_MODE.WORMHOLE;
  }

  if (/매직|magic|영작|서술형|rewrite|paraphrase|combine|production training/.test(lower)) {
    return ENGINE_MODE.MAGIC;
  }

  if (/어휘|단어|vocab|vocabulary/.test(lower)) {
    return ENGINE_MODE.VOCAB_BUILDER;
  }

  if (/모의|mock|빈칸|삽입|순서|흐름|summary|blank|insertion|sequence|title|gist|purpose/.test(lower)) {
    return ENGINE_MODE.MOCK_EXAM;
  }

  if (/내신|교과서|중1|중2|중3|middle textbook|lesson|unit|천재|동아|비상|능률|ybm|미래엔/.test(lower)) {
    return ENGINE_MODE.MIDDLE_TEXTBOOK;
  }

  if (/초등|starter|기초|abc/.test(lower)) {
    return ENGINE_MODE.ABC_STARTER;
  }

  return ENGINE_MODE.WORMHOLE;
}

function resolveEngine(selectedEngine, prompt = "") {
  const requested = ensureString(selectedEngine).toUpperCase();
  const detected = inferEngine(prompt);

  const validModes = new Set(Object.values(ENGINE_MODE));

  if (!requested || !validModes.has(requested)) {
    return {
      requestedMode: "",
      detectedMode: detected,
      finalMode: detected,
      adjusted: false,
      notice: "",
    };
  }

  if (requested === detected) {
    return {
      requestedMode: requested,
      detectedMode: detected,
      finalMode: requested,
      adjusted: false,
      notice: "",
    };
  }

  const strongKeywordModes = new Set([
    ENGINE_MODE.WORMHOLE,
    ENGINE_MODE.MAGIC,
    ENGINE_MODE.VOCAB_BUILDER,
    ENGINE_MODE.MOCK_EXAM,
    ENGINE_MODE.MIDDLE_TEXTBOOK,
    ENGINE_MODE.ABC_STARTER,
  ]);

  const finalMode = strongKeywordModes.has(detected) ? detected : requested;

  return {
    requestedMode: requested,
    detectedMode: detected,
    finalMode,
    adjusted: finalMode !== requested,
    notice:
      finalMode !== requested
        ? `Input content matched ${finalMode} more strongly than ${requested}, so the engine was adjusted automatically.`
        : "",
  };
}

function detectMagicSubMode(prompt = "") {
  const text = String(prompt || "");
  const lower = text.toLowerCase();
  const korean = isKorean(text);

  const koreanSignals =
    korean &&
    /영작|서술형|내신|중등|중학교|중1|중2|중3|교과서|학원|단서|어순|조건에 맞게|문장을 쓰시오|영어로 쓰시오|주어진 단어/.test(text);

  const globalSignals =
    !korean &&
    /paraphrase|rewrite|combine|meaning-preserving|naturalize|formal|concise|style|register|transform/.test(lower);

  if (koreanSignals) return MAGIC_SUBMODE.KOREAN_MAGIC;
  if (globalSignals) return MAGIC_SUBMODE.GLOBAL_MAGIC;
  if (korean) return MAGIC_SUBMODE.KOREAN_MAGIC;
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

/* =========================
 * 수량 / 토큰
 * ========================= */

function getItemCountByEngine(engine) {
  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 10;
    case ENGINE_MODE.MOCK_EXAM:
      return 15;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 20;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
    case ENGINE_MODE.WORMHOLE:
    case ENGINE_MODE.MAGIC:
    default:
      return 25;
  }
}

function getMaxOutputTokens(engine) {
  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 1600;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 2400;
    case ENGINE_MODE.MOCK_EXAM:
      return 3000;
    case ENGINE_MODE.MAGIC:
      return 3400;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 3400;
    case ENGINE_MODE.WORMHOLE:
    default:
      return 3600;
  }
}

/* =========================
 * 엔진별 경량 지시문
 * ========================= */

function buildEngineInstruction(engine, locale, itemCount, magicSubMode) {
  const instructionLineRule =
    locale === "ko"
      ? "The visible instruction line should be concise Korean."
      : locale === "ja"
      ? "The visible instruction line should be concise Japanese."
      : "The visible instruction line should be concise English.";

  switch (engine) {
    case ENGINE_MODE.WORMHOLE:
      return `
ENGINE IDENTITY:
- Premium grammar assessment
- High discrimination
- Not a generic worksheet
- Questions 1-20 should usually be 5-option multiple-choice
- Questions 21-25 may be descriptive when appropriate
- Mix these styles across the set:
  1) grammatically correct / incorrect judgment
  2) same pattern / same error
  3) revision / transformation / same meaning
  4) count-based trap items
  5) high-trap structure comparison
- Avoid repetitive one-line blanks only
- Keep distractors plausible
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
    case ENGINE_MODE.MAGIC:
      return `
ENGINE IDENTITY:
- Premium guided production workbook
- Not a default multiple-choice exam
- Focus on writing, rewriting, transformation, guided production
- Each item should require learner production
- Avoid vague free writing
- Use clues, constraints, or target structures when helpful
- MAGIC SUBMODE: ${magicSubMode}
- If KOREAN_MAGIC: prefer Korean-to-English guided production, clue-based writing, word order, transformation
- If GLOBAL_MAGIC: prefer paraphrase, combine, rewrite, formal/concise/natural revision
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
    case ENGINE_MODE.MOCK_EXAM:
      return `
ENGINE IDENTITY:
- Korean mock-exam transformation worksheet
- Not a generic reading worksheet
- Use 5-option multiple-choice
- Mix title/gist, blank/summary, grammar-in-context, insertion/sequence/flow, vocabulary, hybrid items
- Avoid direct-detail-only questions
- Keep distractors plausible
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return `
ENGINE IDENTITY:
- Middle school textbook-linked internal-exam worksheet
- Grammar-centered and school-test focused
- Default to 5-option multiple-choice unless descriptive is explicitly requested
- Mix grammar recognition, revision, transformation, textbook-linked expansion, and trap items
- Stay middle-school appropriate
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
    case ENGINE_MODE.VOCAB_BUILDER:
      return `
ENGINE IDENTITY:
- Vocabulary extractor and vocabulary test builder
- First identify important vocabulary if relevant
- Then build a vocabulary test
- Default to 5-option multiple-choice
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
    case ENGINE_MODE.ABC_STARTER:
    default:
      return `
ENGINE IDENTITY:
- Elementary starter worksheet
- Very clear, short, easy, encouraging
- Suitable for beginner English learners
- Prefer simple sentence work, easy grammar, easy vocabulary
${instructionLineRule}
Generate exactly ${itemCount} items unless the user explicitly requests otherwise.
`;
  }
}

/* =========================
 * JSON 프롬프트
 * ========================= */

function buildPrompt({ engine, title, prompt, locale, magicSubMode, modeNotice }) {
  const itemCount = getItemCountByEngine(engine);
  const engineInstruction = buildEngineInstruction(engine, locale, itemCount, magicSubMode);

  return `
You are a professional worksheet generator for teachers and academies.

ENGINE: ${engine}
ENGINE LABEL: ${ENGINE_LABELS[engine] || engine}
LOCALE: ${locale}

${modeNotice ? `MODE NOTICE:\n${modeNotice}\n` : ""}

STRICT RULES:
- Output ONLY valid JSON.
- Do not wrap JSON in markdown code fences.
- Do not add commentary before or after the JSON.
- Create a teacher-ready worksheet.
- Keep numbering sequential.
- Include answers.
- The result must be complete and usable as-is.
- Keep the schema exactly as requested.

${engineInstruction}

JSON SCHEMA:
{
  "mainTitle": "string",
  "instruction": "string",
  "questions": [
    {
      "number": 1,
      "stem": "string",
      "options": ["string", "string", "string", "string", "string"],
      "answer": "string"
    }
  ]
}

SCHEMA RULES:
- "questions" must be an array.
- Each question must include:
  - number
  - stem
  - answer
- "instruction" is optional but recommended.
- "options" may be omitted only if the task clearly should not be multiple choice.
- If options exist, prefer exactly 5 options.
- Do not return null fields unnecessarily.

TITLE:
${title}

USER REQUEST:
${prompt}
`;
}

/* =========================
 * 모델 호출
 * ========================= */

async function callModel(prompt, engine) {
  const res = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    max_output_tokens: getMaxOutputTokens(engine),
  });

  const text = ensureString(res.output_text);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSON parse failed: model did not return a valid JSON object");
  }

  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new Error("JSON parse failed: " + err.message);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid packet: parsed result is not an object");
  }

  if (!parsed.mainTitle) {
    parsed.mainTitle = "MARCUSNOTE WORKSHEET";
  }

  parsed.instruction = ensureString(parsed.instruction);

  parsed.questions = ensureArray(parsed.questions)
    .map((q, index) => {
      const options = ensureArray(q?.options)
        .map((o) => ensureString(o))
        .filter(Boolean)
        .slice(0, 5);

      return {
        number: Number(q?.number) || index + 1,
        stem: ensureString(q?.stem, `Question ${index + 1}`),
        options,
        answer: ensureString(q?.answer, ""),
      };
    })
    .filter((q) => q.stem);

  if (!parsed.questions.length) {
    throw new Error("Invalid packet: no questions returned");
  }

  return parsed;
}

/* =========================
 * 출력 포맷
 * ========================= */

function format(packet) {
  const lines = [];

  lines.push(packet.mainTitle || "MARCUSNOTE WORKSHEET");
  lines.push("");

  if (packet.instruction) {
    lines.push(packet.instruction);
    lines.push("");
  }

  packet.questions.forEach((q) => {
    lines.push(`${q.number}. ${q.stem}`);

    if (q.options?.length) {
      q.options.forEach((o, i) => {
        const mark = ["①", "②", "③", "④", "⑤"][i] || `${i + 1}.`;
        lines.push(`${mark} ${o}`);
      });
    }

    lines.push("");
  });

  lines.push("ANSWER KEY");
  lines.push("");

  packet.questions.forEach((q) => {
    lines.push(`${q.number}) ${q.answer}`);
  });

  return lines.join("\n");
}

/* =========================
 * CORS
 * ========================= */

function applyCors(req, res) {
  const allowedOrigins = [
    "https://imarcusnote.com",
    "https://www.imarcusnote.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const requestOrigin = req.headers.origin;

  if (allowedOrigins.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://imarcusnote.com");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/* =========================
 * 핸들러
 * ========================= */

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      model: OPENAI_MODEL,
      message: "I•marcusnote API is working. Use POST to send a prompt.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing OPENAI_API_KEY",
      });
    }

    const body = normalizeBody(req.body || {});

    if (!body.prompt) {
      return res.status(400).json({
        ok: false,
        error: "No prompt",
      });
    }

    const locale = detectLocale(body.prompt);
    const engineResolution = resolveEngine(body.selectedEngine, body.prompt);
    const engine = engineResolution.finalMode;
    const magicSubMode =
      engine === ENGINE_MODE.MAGIC
        ? detectMagicSubMode(body.prompt)
        : MAGIC_SUBMODE.GENERAL_MAGIC;

    const modelPrompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
      magicSubMode,
      modeNotice: engineResolution.notice,
    });

    const packet = await callModel(modelPrompt, engine);
    const text = format(packet);

    return res.status(200).json({
      ok: true,
      output: text,
      questions: packet.questions,
      mainTitle: packet.mainTitle,
      instruction: packet.instruction || "",
      worksheetTitle: body.worksheetTitle,
      academyName: body.academyName,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      modeAdjusted: engineResolution.adjusted,
      detectedMode: engineResolution.detectedMode,
      model: OPENAI_MODEL,
    });
  } catch (e) {
    console.error("[generate.js] error:", e);

    return res.status(500).json({
      ok: false,
      error: "Generation failed",
      detail: e?.message || "Unknown server error",
    });
  }
};
