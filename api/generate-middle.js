const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* =========================
   MIDDLE ENGINE SYSTEM
========================= */

const ENGINE_MODE = {
  MAGIC: "MAGIC",
  WORMHOLE: "WORMHOLE",
};

const ENGINE_LABELS = {
  [ENGINE_MODE.MAGIC]: "Magic Lab",
  [ENGINE_MODE.WORMHOLE]: "Wormhole",
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
    worksheetTitle: pickFirst(body.worksheetTitle, body.title, "Marcusnote Middle Worksheet"),
    academyName: pickFirst(body.academyName, "Imarcusnote"),
    prompt: pickFirst(body.prompt, body.input),
  };
}

/* =========================
   ENGINE DETECTION
   - 중등은 MAGIC / WORMHOLE만
========================= */

function inferEngine(prompt = "") {
  const text = ensureString(prompt).toLowerCase();

  if (
    /웜홀|wormhole|고난도|어법상|어법|변형|same error|same pattern|grammatically incorrect|grammatically correct|객관식|5지선다/.test(
      text
    )
  ) {
    return ENGINE_MODE.WORMHOLE;
  }

  if (
    /매직|magic|영작|서술형|rewrite|paraphrase|combine|문장을 쓰시오|영어로 쓰시오|조건에 맞게|주어진 단어/.test(
      text
    )
  ) {
    return ENGINE_MODE.MAGIC;
  }

  return ENGINE_MODE.WORMHOLE;
}

/* =========================
   7차 핵심: 선택 엔진 유지
========================= */

function resolveEngine(selectedEngine, prompt = "") {
  const requested = ensureString(selectedEngine).toUpperCase();
  const detected = inferEngine(prompt);
  const validModes = new Set(Object.values(ENGINE_MODE));

  if (requested && validModes.has(requested)) {
    return {
      finalMode: requested,
      notice:
        requested !== detected
          ? `Selected engine "${requested}" preserved.`
          : "",
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

  const koreanSignals =
    isKorean(text) &&
    /영작|서술형|내신|중등|중학교|중1|중2|중3|교과서|학원|단서|어순|조건에 맞게|문장을 쓰시오|영어로 쓰시오|주어진 단어/.test(
      text
    );

  const globalSignals =
    !isKorean(text) &&
    /paraphrase|rewrite|combine|meaning-preserving|naturalize|formal|concise|style|register|transform/.test(
      lower
    );

  if (koreanSignals) return MAGIC_SUBMODE.KOREAN_MAGIC;
  if (globalSignals) return MAGIC_SUBMODE.GLOBAL_MAGIC;
  if (isKorean(text)) return MAGIC_SUBMODE.KOREAN_MAGIC;
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

/* =========================
   ITEM COUNT
========================= */

function extractItemCount(prompt = "", engine = "") {
  const text = ensureString(prompt);

  const patterns = [
    /(\d{1,2})\s*문항/,
    /(\d{1,2})\s*문제/,
    /(\d{1,2})\s*개/,
    /(\d{1,2})\s*items?/i,
    /(\d{1,2})\s*questions?/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const raw = Number(match[1]);
      if (Number.isFinite(raw)) {
        return Math.max(5, Math.min(raw, 25));
      }
    }
  }

  if (engine === ENGINE_MODE.MAGIC) return 20;
  return 25;
}

/* =========================
   TOKEN / TIMEOUT
========================= */

function getMaxTokens(engine, itemCount) {
  const sizeBonus = itemCount >= 20 ? 250 : itemCount >= 15 ? 150 : 80;

  switch (engine) {
    case ENGINE_MODE.MAGIC:
      return 1900 + sizeBonus;
    case ENGINE_MODE.WORMHOLE:
    default:
      return 2100 + sizeBonus;
  }
}

async function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Model timeout before server completion")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/* =========================
   GRAMMAR LOCK
========================= */

function extractGrammarLock(title = "", prompt = "") {
  const joined = `${ensureString(title)} ${ensureString(prompt)}`;

  if (/관계부사/.test(joined)) return "RELATIVE_ADVERB_ONLY";
  if (/목적격\s*관계대명사/.test(joined)) return "OBJECT_RELATIVE_PRONOUN_ONLY";
  if (/현재완료/.test(joined)) return "PRESENT_PERFECT_ONLY";
  if (/수동태/.test(joined)) return "PASSIVE_ONLY";
  if (/가정법/.test(joined)) return "SUBJUNCTIVE_ONLY";
  if (/조동사/.test(joined)) return "MODAL_ONLY";
  if (/to부정사/.test(joined)) return "TO_INF_ONLY";
  if (/동명사/.test(joined)) return "GERUND_ONLY";
  if (/분사/.test(joined)) return "PARTICIPLE_ONLY";

  return "";
}

/* =========================
   PROMPT BUILDERS
========================= */

function buildMagicInstruction(locale, itemCount, magicSubMode, grammarLock) {
  const localeRule =
    locale === "ko"
      ? "The visible instruction line should be concise Korean."
      : "The visible instruction line should be concise English.";

  return `
ENGINE IDENTITY:
- Premium middle-school grammar writing workbook
- Chapter-based grammar production training
- Middle-school internal-exam friendly
- MAGIC SUBMODE: ${magicSubMode}

MAGIC ABSOLUTE RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- DO NOT create multiple-choice questions
- DO NOT create 5-choice options
- Each item should be a writing task, rewrite task, guided production task, sentence-building task, or grammar-focused completion task
- Keep answer as a full teacher-usable model answer
- Include one short explanation line for each item
- Keep target grammar centered and visible
- Do not drift into Wormhole-style 객관식 고난도 문제
- Maintain middle-school appropriate level unless the prompt explicitly asks for high difficulty writing

GRAMMAR LOCK:
- ${grammarLock || "NONE"}
- If a grammar lock exists, keep that grammar consistently centered
- Avoid drifting into unrelated grammar points unless minimally necessary

QUALITY:
- Prefer Korean instruction when the request is Korean
- Make items teacher-ready and workbook-ready
- Keep numbering stable and clean

${localeRule}
`;
}

function buildWormholeInstruction(locale, itemCount, grammarLock) {
  const localeRule =
    locale === "ko"
      ? "The visible instruction line should be concise Korean."
      : "The visible instruction line should be concise English.";

  return `
ENGINE IDENTITY:
- Premium high-difficulty middle-school grammar problem set
- Strongly exam-oriented
- Best suited for difficult grammar multiple-choice and transformation items
- Use plausible distractors
- Maintain academic school-exam tone

WORMHOLE RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Prefer 5-option multiple-choice
- Exactly one option should be the best answer
- Include one short explanation line for each item
- Some items may be marked [High Difficulty]
- Keep answers complete and clean
- Avoid malformed answer keys
- Do not drift into Magic-style writing workbook
- Keep the requested grammar point visible when applicable

GRAMMAR LOCK:
- ${grammarLock || "NONE"}
- If a grammar lock exists, prioritize that grammar point across the set

HIGH-VALUE ITEM TYPES:
- Choose the grammatically correct sentence
- Choose the awkward/incorrect sentence
- Same error / same pattern
- Sentence transformation
- Grammar-in-context
- School-test style passage-based grammar

${localeRule}
`;
}

function buildPrompt({
  engine,
  title,
  prompt,
  locale,
  itemCount,
  magicSubMode,
}) {
  const grammarLock = extractGrammarLock(title, prompt);

  const engineInstruction =
    engine === ENGINE_MODE.MAGIC
      ? buildMagicInstruction(locale, itemCount, magicSubMode, grammarLock)
      : buildWormholeInstruction(locale, itemCount, grammarLock);

  const schema =
    engine === ENGINE_MODE.MAGIC
      ? `{
  "mainTitle": "string",
  "instruction": "string",
  "questions": [
    {
      "number": 1,
      "stem": "string",
      "answer": "string",
      "explanation": "string",
      "difficulty": "normal | high"
    }
  ]
}`
      : `{
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
}`;

  return `
You are a professional worksheet generator for middle-school teachers and academies.

ENGINE: ${engine}
ENGINE LABEL: ${ENGINE_LABELS[engine] || engine}
LOCALE: ${locale}
ITEMS: ${itemCount}
MAGIC MODE: ${magicSubMode}
GRAMMAR LOCK: ${grammarLock || "NONE"}

STRICT:
- Output ONLY valid JSON
- Do not wrap JSON in markdown
- Do not add explanation outside JSON
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Keep numbering sequential
- Include answers
- Include explanations
- Each explanation must be ONE short line only
- Respect the selected engine strictly
- Never switch worksheet style to another engine family

${engineInstruction}

JSON SCHEMA:
${schema}

SCHEMA RULES:
- "questions" must be an array
- Every question must include: number, stem, answer, explanation
- For MAGIC, omit "options"
- For WORMHOLE, prefer exactly 5 options
- If difficulty is "high", include "[High Difficulty]" in the stem
- Do not place "[High Difficulty]" inside the answer string
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
   JSON SAFE PARSE
========================= */

function safeJsonParse(text = "") {
  const raw = ensureString(text);

  try {
    return JSON.parse(raw);
  } catch (_) {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const sliced = raw.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error("JSON parsing failed");
  }
}

/* =========================
   MODEL CALL
   - chat.completions 우선: json_object 안정성
========================= */

async function callModel(modelPrompt, engine, itemCount) {
  const response = await withTimeout(
    client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: modelPrompt,
        },
      ],
      max_tokens: getMaxTokens(engine, itemCount),
      response_format: { type: "json_object" },
      temperature: engine === ENGINE_MODE.WORMHOLE ? 0.7 : 0.6,
    }),
    25000
  );

  return response;
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
    const prompt = ensureString(body.prompt);

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "No prompt provided",
      });
    }

    const locale = detectLocale(prompt);
    const engineResult = resolveEngine(body.selectedEngine, prompt);
    const engine = engineResult.finalMode;
    const itemCount = extractItemCount(prompt, engine);
    const magicSubMode = detectMagicSubMode(prompt);

    const modelPrompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt,
      locale,
      itemCount,
      magicSubMode,
    });

    const response = await callModel(modelPrompt, engine, itemCount);
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    const repairedQuestions = repairQuestions(parsed.questions, engine);

    return res.status(200).json({
      ok: true,
      mainTitle: ensureString(
        parsed.mainTitle,
        body.worksheetTitle || "Marcusnote Middle Worksheet"
      ),
      instruction: ensureString(parsed.instruction),
      questions: repairedQuestions,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      modeNotice: engineResult.notice || "",
      academyName: body.academyName || "Imarcusnote",
    });
  } catch (err) {
    console.error("[generate-middle.js] error:", err);

    const message = ensureString(err?.message, "Unknown server error");
    const isTimeout = /timeout/i.test(message);

    return res.status(isTimeout ? 504 : 500).json({
      ok: false,
      error: isTimeout ? "Model timeout" : "Generation failed",
      detail: message,
    });
  }
};
