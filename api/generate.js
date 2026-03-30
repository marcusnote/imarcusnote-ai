const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* =========================
   ENGINE SYSTEM (7차 유지)
========================= */

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
   BASIC UTIL
========================= */

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

function detectLocale(text = "") {
  if (isKorean(text)) return "ko";
  return "en";
}

/* =========================
   BODY NORMALIZE
========================= */

function normalizeBody(body = {}) {
  return {
    selectedEngine: pickFirst(body.selectedEngine, body.mode),
    worksheetTitle: pickFirst(body.worksheetTitle, body.title, "Marcusnote Worksheet"),
    academyName: pickFirst(body.academyName, "Imarcusnote"),
    prompt: pickFirst(body.prompt, body.input),
  };
}

/* =========================
   ENGINE DETECTION (보조용)
========================= */

function inferEngine(prompt = "") {
  const t = ensureString(prompt).toLowerCase();

  if (/웜홀|wormhole|고난도|어법/.test(t)) return ENGINE_MODE.WORMHOLE;
  if (/매직|magic|영작|rewrite|paraphrase/.test(t)) return ENGINE_MODE.MAGIC;
  if (/어휘|vocab/.test(t)) return ENGINE_MODE.VOCAB_BUILDER;
  if (/모의|mock|빈칸|순서/.test(t)) return ENGINE_MODE.MOCK_EXAM;
  if (/중1|중2|중3|교과서/.test(t)) return ENGINE_MODE.MIDDLE_TEXTBOOK;

  return ENGINE_MODE.WORMHOLE;
}

/* =========================
   7차 핵심 (절대 유지)
========================= */

function resolveEngine(selectedEngine, prompt = "") {
  const requested = ensureString(selectedEngine).toUpperCase();
  const detected = inferEngine(prompt);
  const valid = new Set(Object.values(ENGINE_MODE));

  if (requested && valid.has(requested)) {
    return {
      finalMode: requested,
      notice: requested !== detected ? `Selected engine "${requested}" preserved.` : "",
    };
  }

  return {
    finalMode: detected,
    notice: "Engine inferred from input.",
  };
}

/* =========================
   MAGIC SUBMODE
========================= */

function detectMagicSubMode(prompt = "") {
  const text = ensureString(prompt);
  const lower = text.toLowerCase();

  if (isKorean(text)) return MAGIC_SUBMODE.KOREAN_MAGIC;
  if (/rewrite|paraphrase|combine/.test(lower)) return MAGIC_SUBMODE.GLOBAL_MAGIC;
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

/* =========================
   ITEM COUNT
========================= */

function extractItemCount(prompt = "", engine) {
  const m = ensureString(prompt).match(/(\d{1,2})\s*(문항|문제|개|questions?)/i);
  const raw = m ? Number(m[1]) : null;

  if (!raw) {
    if (engine === ENGINE_MODE.ABC_STARTER) return 10;
    if (engine === ENGINE_MODE.MOCK_EXAM) return 15;
    if (engine === ENGINE_MODE.VOCAB_BUILDER) return 20;
    return 25;
  }

  return Math.max(5, Math.min(raw, 25));
}

/* =========================
   9차 핵심: 안정형 TOKEN
========================= */

function getMaxTokens(engine, itemCount) {
  const base = 1800;
  const bonus = itemCount >= 20 ? 200 : 100;
  return base + bonus;
}

/* =========================
   9차 핵심: Grammar Lock (경량)
========================= */

function extractGrammarLock(prompt = "") {
  const text = ensureString(prompt);

  if (/관계부사/.test(text)) return "RELATIVE_ADVERB";
  if (/목적격\s*관계대명사/.test(text)) return "OBJECT_RELATIVE";
  if (/현재완료/.test(text)) return "PRESENT_PERFECT";
  return "";
}

/* =========================
   ENGINE PROMPT
========================= */

function buildPrompt({
  engine,
  title,
  prompt,
  locale,
  itemCount,
  magicSubMode,
}) {
  const grammarLock = extractGrammarLock(prompt);

  return `
You are a professional worksheet generator.

ENGINE: ${engine}
LOCALE: ${locale}
ITEMS: ${itemCount}
MAGIC MODE: ${magicSubMode}
GRAMMAR LOCK: ${grammarLock || "NONE"}

STRICT:
- Output ONLY JSON
- No markdown
- No explanation outside JSON
- EXACTLY ${itemCount} items

RULES:
- Include answers AND explanations
- Explanation = ONE LINE ONLY
- Maintain exam quality
- Do NOT switch engine

SCHEMA:
{
  "mainTitle": "",
  "instruction": "",
  "questions": [
    {
      "number": 1,
      "stem": "",
      "options": [],
      "answer": "",
      "explanation": "",
      "difficulty": "normal | high"
    }
  ]
}

TITLE:
${title}

USER:
${prompt}
`;
}

/* =========================
   RESPONSE TEXT FALLBACK
   (추가 기능 1)
========================= */

function extractTextFromResponse(response) {
  const directText = ensureString(response?.output_text);
  if (directText) return directText;

  const nestedText = ensureString(response?.output?.[0]?.content?.[0]?.text);
  if (nestedText) return nestedText;

  const chatText = ensureString(response?.choices?.[0]?.message?.content);
  if (chatText) return chatText;

  if (Array.isArray(response?.output)) {
    for (const out of response.output) {
      const contentArr = ensureArray(out?.content);
      for (const c of contentArr) {
        const t = ensureString(c?.text);
        if (t) return t;
      }
    }
  }

  throw new Error("No readable text found in model response.");
}

/* =========================
   ANSWER REPAIR
   (추가 기능 2)
========================= */

function normalizeTextForCompare(text = "") {
  return ensureString(text)
    .toLowerCase()
    .replace(/\[high difficulty\]/gi, "")
    .replace(/[“”"'`]/g, "")
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestMatchingOption(answer = "", options = []) {
  const normalizedAnswer = normalizeTextForCompare(answer);
  if (!normalizedAnswer) return "";

  for (const option of ensureArray(options)) {
    const normalizedOption = normalizeTextForCompare(option);
    if (!normalizedOption) continue;

    if (
      normalizedOption === normalizedAnswer ||
      normalizedOption.includes(normalizedAnswer) ||
      normalizedAnswer.includes(normalizedOption)
    ) {
      return option;
    }
  }

  return "";
}

function repairAnswer(question = {}, engine = "") {
  const q = { ...question };
  const options = ensureArray(q.options);
  const answer = ensureString(q.answer);

  if (engine === ENGINE_MODE.MAGIC) {
    if (!answer) q.answer = "";
    return q;
  }

  if (!options.length) {
    return q;
  }

  if (!answer) {
    q.answer = ensureString(options[0], "");
    return q;
  }

  const matched = findBestMatchingOption(answer, options);
  if (matched) {
    q.answer = matched;
    return q;
  }

  return q;
}

function repairQuestions(questions = [], engine = "") {
  return ensureArray(questions)
    .map((q, index) => {
      const repaired = repairAnswer(q, engine);

      return {
        ...repaired,
        number: index + 1,
        stem: ensureString(repaired.stem),
        answer: ensureString(repaired.answer),
        explanation: ensureString(repaired.explanation),
        difficulty:
          ensureString(repaired.difficulty).toLowerCase() === "high" ? "high" : "normal",
      };
    })
    .filter((q) => q.stem);
}

/* =========================
   MAIN HANDLER
========================= */

module.exports = async function handler(req, res) {
  try {
    const body = normalizeBody(req.body || {});
    const locale = detectLocale(body.prompt);

    const engineResult = resolveEngine(body.selectedEngine, body.prompt);
    const engine = engineResult.finalMode;

    const itemCount = extractItemCount(body.prompt, engine);
    const magicSubMode = detectMagicSubMode(body.prompt);

    const prompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
      itemCount,
      magicSubMode,
    });

    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: getMaxTokens(engine, itemCount),
    });

    const text = extractTextFromResponse(response);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "JSON parsing failed",
        raw: text,
      });
    }

    const repairedQuestions = repairQuestions(parsed.questions, engine);

    return res.status(200).json({
      ...parsed,
      questions: repairedQuestions,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      modeNotice: engineResult.notice || "",
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};
