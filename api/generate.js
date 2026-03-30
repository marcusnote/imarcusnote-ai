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

  if (/웜홀|wormhole|고난도|어법|변형/.test(t)) return ENGINE_MODE.WORMHOLE;
  if (/매직|magic|영작|rewrite|paraphrase|combine|서술형/.test(t)) return ENGINE_MODE.MAGIC;
  if (/어휘|단어|vocab|vocabulary/.test(t)) return ENGINE_MODE.VOCAB_BUILDER;
  if (/모의|mock|빈칸|삽입|순서|summary|gist|purpose/.test(t)) return ENGINE_MODE.MOCK_EXAM;
  if (/중1|중2|중3|교과서|내신/.test(t)) return ENGINE_MODE.MIDDLE_TEXTBOOK;

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
  if (/rewrite|paraphrase|combine|meaning-preserving|transform/.test(lower)) {
    return MAGIC_SUBMODE.GLOBAL_MAGIC;
  }
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

/* =========================
   ITEM COUNT
========================= */

function extractItemCount(prompt = "", engine) {
  const m = ensureString(prompt).match(/(\d{1,2})\s*(문항|문제|개|items?|questions?)/i);
  const raw = m ? Number(m[1]) : null;

  if (!raw) {
    if (engine === ENGINE_MODE.ABC_STARTER) return 10;
    if (engine === ENGINE_MODE.MOCK_EXAM) return 15;
    if (engine === ENGINE_MODE.VOCAB_BUILDER) return 20;
    return 25;
  }

  if (engine === ENGINE_MODE.ABC_STARTER) {
    return Math.max(5, Math.min(raw, 20));
  }

  if (engine === ENGINE_MODE.VOCAB_BUILDER) {
    return Math.max(5, Math.min(raw, 30));
  }

  return Math.max(5, Math.min(raw, 25));
}

/* =========================
   TOKEN
========================= */

function getMaxTokens(engine, itemCount) {
  const bonus = itemCount >= 20 ? 250 : itemCount >= 15 ? 150 : 100;

  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 1100 + bonus;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 1500 + bonus;
    case ENGINE_MODE.MOCK_EXAM:
      return 1800 + bonus;
    case ENGINE_MODE.MAGIC:
      return 1900 + bonus;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 1900 + bonus;
    case ENGINE_MODE.WORMHOLE:
    default:
      return 2000 + bonus;
  }
}

/* =========================
   TIMEOUT
========================= */

async function withTimeout(promise, ms) {
  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Model timeout before server completion"));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/* =========================
   Grammar Lock (경량)
========================= */

function extractGrammarLock(prompt = "", title = "") {
  const text = `${ensureString(title)} ${ensureString(prompt)}`;

  if (/관계부사/.test(text)) return "RELATIVE_ADVERB";
  if (/목적격\s*관계대명사/.test(text)) return "OBJECT_RELATIVE";
  if (/현재완료/.test(text)) return "PRESENT_PERFECT";
  if (/수동태/.test(text)) return "PASSIVE";
  if (/가정법/.test(text)) return "SUBJUNCTIVE";

  return "";
}

/* =========================
   ENGINE PROMPT
========================= */

function buildEngineInstruction(engine, locale, itemCount, magicSubMode, grammarLock) {
  const localeRule =
    locale === "ko"
      ? "The visible instruction line should be concise Korean."
      : "The visible instruction line should be concise English.";

  switch (engine) {
    case ENGINE_MODE.WORMHOLE:
      return `
ENGINE IDENTITY:
- Premium high-difficulty grammar and transformation exam
- Strongly exam-oriented
- Prefer 5-option multiple-choice
- Maintain academic exam tone
- Use plausible distractors
- Keep answers complete and clean
- Include one short explanation line for each item

WORMHOLE RULES:
- Generate exactly ${itemCount} items
- At least some items should feel high-difficulty
- If difficulty is high, put [High Difficulty] in the stem
- Do not output malformed answer keys
- Do not switch to Magic style

${localeRule}
`;
    case ENGINE_MODE.MAGIC:
      return `
ENGINE IDENTITY:
- Premium guided production workbook
- Focus on writing, rewriting, transformation, guided production
- MAGIC SUBMODE: ${magicSubMode}
- Include one short explanation line for each item

MAGIC RULES:
- Generate exactly ${itemCount} items
- DO NOT generate multiple-choice if not needed
- Prefer production tasks, rewrite tasks, sentence building tasks
- Keep answer as a complete model answer
- Do not switch to Wormhole-style grammar MCQ
- Grammar lock: ${grammarLock || "NONE"}

${localeRule}
`;
    case ENGINE_MODE.MOCK_EXAM:
      return `
ENGINE IDENTITY:
- Korean mock-exam transformation worksheet
- Use 5-option multiple-choice as default
- Include one short explanation line for each item

MOCK RULES:
- Generate exactly ${itemCount} items
- Keep strong test-book tone
- Do not switch to Magic production style

${localeRule}
`;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return `
ENGINE IDENTITY:
- Middle school textbook-linked internal exam worksheet
- Grammar-centered and school-test focused
- Use 5-option multiple-choice as default
- Include one short explanation line for each item

MIDDLE RULES:
- Generate exactly ${itemCount} items
- Keep textbook-linked school-exam tone
- Stay middle-school appropriate

${localeRule}
`;
    case ENGINE_MODE.VOCAB_BUILDER:
      return `
ENGINE IDENTITY:
- Vocabulary extractor and test builder
- Build useful school-ready vocabulary items
- Include one short explanation line for each item

VOCAB RULES:
- Generate exactly ${itemCount} items
- Prioritize meaning, usage, synonym, antonym, context

${localeRule}
`;
    case ENGINE_MODE.ABC_STARTER:
    default:
      return `
ENGINE IDENTITY:
- Elementary starter worksheet
- Very clear, short, easy, encouraging
- Include one short explanation line for each item

ABC RULES:
- Generate exactly ${itemCount} items
- Keep difficulty low and stable

${localeRule}
`;
  }
}

function buildPrompt({
  engine,
  title,
  prompt,
  locale,
  itemCount,
  magicSubMode,
}) {
  const grammarLock = extractGrammarLock(prompt, title);
  const engineInstruction = buildEngineInstruction(
    engine,
    locale,
    itemCount,
    magicSubMode,
    grammarLock
  );

  return `
You are a professional worksheet generator for teachers and academies.

ENGINE: ${engine}
LOCALE: ${locale}
ITEMS: ${itemCount}
MAGIC MODE: ${magicSubMode}
GRAMMAR LOCK: ${grammarLock || "NONE"}

STRICT:
- Output ONLY valid JSON
- Do not wrap JSON in markdown
- No explanation outside JSON
- Generate exactly ${itemCount} items
- Maintain the selected engine strictly
- Include answers
- Include explanations
- Each explanation must be one short line only

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
      "answer": "string",
      "explanation": "string",
      "difficulty": "normal | high"
    }
  ]
}

SCHEMA RULES:
- Every question must include: number, stem, answer, explanation
- For MAGIC, options may be omitted
- For non-MAGIC modes, 5 options are preferred when multiple-choice is used
- If difficulty is "high", include "[High Difficulty]" in the stem
- Do not return null fields

TITLE:
${title}

USER REQUEST:
${prompt}
`;
}

/* =========================
   RESPONSE TEXT FALLBACK
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
    q.answer = answer;
    return q;
  }

  if (!options.length) {
    q.answer = answer;
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

  q.answer = answer;
  return q;
}

function repairQuestions(questions = [], engine = "") {
  return ensureArray(questions)
    .map((q, index) => {
      const repaired = repairAnswer(q, engine);

      const out = {
        ...repaired,
        number: index + 1,
        stem: ensureString(repaired.stem),
        answer: ensureString(repaired.answer),
        explanation: ensureString(repaired.explanation),
        difficulty:
          ensureString(repaired.difficulty).toLowerCase() === "high" ? "high" : "normal",
      };

      if (engine !== ENGINE_MODE.MAGIC) {
        out.options = ensureArray(repaired.options).filter(Boolean);
      }

      return out;
    })
    .filter((q) => q.stem);
}

/* =========================
   MAIN HANDLER
========================= */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = normalizeBody(req.body || {});
    const locale = detectLocale(body.prompt);

    if (!body.prompt) {
      return res.status(400).json({
        ok: false,
        error: "No prompt provided",
      });
    }

    const engineResult = resolveEngine(body.selectedEngine, body.prompt);
    const engine = engineResult.finalMode;

    const itemCount = extractItemCount(body.prompt, engine);
    const magicSubMode = detectMagicSubMode(body.prompt);

    const modelPrompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
      itemCount,
      magicSubMode,
    });

    const response = await withTimeout(
      client.responses.create({
        model: OPENAI_MODEL,
        input: modelPrompt,
        max_output_tokens: getMaxTokens(engine, itemCount),
      }),
      25000
    );

    const text = extractTextFromResponse(response);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "JSON parsing failed",
        detail: e.message,
        raw: text,
      });
    }

    const repairedQuestions = repairQuestions(parsed.questions, engine);

    return res.status(200).json({
      ok: true,
      mainTitle: ensureString(parsed.mainTitle, body.worksheetTitle || "Marcusnote Worksheet"),
      instruction: ensureString(parsed.instruction),
      questions: repairedQuestions,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      modeNotice: engineResult.notice || "",
      academyName: body.academyName || "Imarcusnote",
    });
  } catch (err) {
    console.error("[generate.js] error:", err);

    const message = ensureString(err?.message, "Unknown server error");
    const isTimeout = /timeout/i.test(message);

    return res.status(isTimeout ? 504 : 500).json({
      ok: false,
      error: isTimeout ? "Model timeout" : "Generation failed",
      detail: message,
    });
  }
};
