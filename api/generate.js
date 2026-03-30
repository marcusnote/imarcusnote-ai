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

/* ================= 유틸 ================= */

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

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function getOptionMark(index) {
  return ["①", "②", "③", "④", "⑤"][index] || `${index + 1}.`;
}

function normalizeAnswerValue(answer) {
  const raw = ensureString(answer);

  if (!raw) return "";

  const circledMap = {
    "1": "①",
    "2": "②",
    "3": "③",
    "4": "④",
    "5": "⑤",
    "①": "①",
    "②": "②",
    "③": "③",
    "④": "④",
    "⑤": "⑤",
  };

  return circledMap[raw] || raw;
}

/* ================= 요청 정규화 ================= */

function normalizeBody(body = {}) {
  return {
    selectedEngine: pickFirst(body.selectedEngine, body.mode),
    worksheetTitle: pickFirst(body.worksheetTitle, body.title, "Marcusnote Worksheet"),
    academyName: pickFirst(body.academyName, "Imarcusnote"),
    prompt: pickFirst(body.prompt, body.input),
  };
}

/* ================= 엔진 판단 ================= */

function inferEngine(prompt = "") {
  const t = prompt.toLowerCase();

  if (/웜홀|wormhole|고난도/.test(t)) return ENGINE_MODE.WORMHOLE;
  if (/매직|magic|영작/.test(t)) return ENGINE_MODE.MAGIC;
  if (/단어|vocab/.test(t)) return ENGINE_MODE.VOCAB_BUILDER;
  if (/모의|mock/.test(t)) return ENGINE_MODE.MOCK_EXAM;
  if (/내신|교과서/.test(t)) return ENGINE_MODE.MIDDLE_TEXTBOOK;
  if (/초등|starter|기초/.test(t)) return ENGINE_MODE.ABC_STARTER;

  return ENGINE_MODE.WORMHOLE;
}

/* ================= 프롬프트 ================= */

function buildBasePrompt({ engine, title, prompt, locale }) {
  return `
You are a professional worksheet generator for teachers and academies.

ENGINE: ${engine}
ENGINE LABEL: ${ENGINE_LABELS[engine] || engine}
LOCALE: ${locale}

STRICT RULES:
- Output ONLY valid JSON.
- Do not wrap JSON in markdown code fences.
- Create a teacher-ready worksheet.
- Default to exactly 25 questions.
- If the engine is VOCAB_BUILDER, up to 30 items are allowed.
- Include answers.
- Keep the schema exactly as requested.

JSON SCHEMA:
{
  "mainTitle": "string",
  "questions": [
    {
      "number": 1,
      "type": "string",
      "stem": "string",
      "options": ["string", "string", "string", "string", "string"],
      "answer": "string",
      "explanation": "string"
    }
  ]
}

IMPORTANT:
- "questions" must be an array.
- Each question must include:
  - number
  - stem
  - answer
- "options" may be omitted only if the task clearly should not be multiple choice.
- Keep numbering sequential.
- Return JSON only, with no extra explanation before or after.

TITLE:
${title}

USER REQUEST:
${prompt}
`;
}

function buildWormholePrompt({ title, prompt, locale }) {
  return `
You are the premium assessment engine for I•marcusnote.

ENGINE ID: WORMHOLE
ENGINE PURPOSE: High-difficulty grammar discrimination, transformation, trap-choice design, and exam-style mastery testing.
LOCALE: ${locale}

CORE IDENTITY:
- This is NOT a beginner worksheet.
- This is NOT a generic grammar quiz.
- This is a premium, teacher-ready, high-difficulty worksheet for Korean school-exam and academy use.
- The worksheet must feel sharper, trickier, and more refined than ordinary workbook questions.

NON-NEGOTIABLE RULES:
1. Generate exactly 25 questions.
2. All questions must be multiple choice with exactly 5 options.
3. Include answers and concise explanations for every item.
4. Vary question types.
5. Avoid repetitive patterns.
6. Avoid overly easy definition-only questions except sparingly.
7. Use plausible trap choices.
8. Output ONLY valid JSON.
9. No markdown fences.
10. No extra commentary outside JSON.

MANDATORY DIFFICULTY FEATURES:
- Include a balanced mix of:
  - correct vs incorrect sentence discrimination
  - error identification
  - fill-in-the-blank with close distractors
  - sentence transformation
  - context-based grammar choice
  - mixed grammar environment
- At least some items must require contextual reasoning, not simple form spotting.
- At least some items must include plausible Korean learner traps.
- The worksheet should feel suitable for advanced middle-school / lower high-school academy difficulty.

QUALITY RULES:
- All English must sound natural.
- Korean instructions should be polished and teacher-facing when the user prompt is Korean.
- No childish wording.
- No duplicated questions.
- No mismatch between instruction and options.
- No ambiguous multiple-correct items.

EXPLANATION RULE:
For each item, explain briefly:
- why the correct answer is correct
- what the main trap is

JSON SCHEMA:
{
  "mainTitle": "string",
  "difficultyLabel": "High Difficulty",
  "targetGrammar": "string",
  "questions": [
    {
      "number": 1,
      "type": "grammar_discrimination",
      "stem": "string",
      "options": ["string", "string", "string", "string", "string"],
      "answer": "①",
      "explanation": "string"
    }
  ]
}

FINAL SELF-CHECK:
- exactly 25 questions?
- all items have 5 options?
- answer included for every item?
- explanation included for every item?
- difficulty truly high enough for WORMHOLE?
- no duplicated stems?
- no broken English?
- JSON only?

TITLE:
${title}

USER REQUEST:
${prompt}
`;
}

function buildPrompt({ engine, title, prompt, locale }) {
  if (engine === ENGINE_MODE.WORMHOLE) {
    return buildWormholePrompt({ title, prompt, locale });
  }

  return buildBasePrompt({ engine, title, prompt, locale });
}

/* ================= 모델 호출 ================= */

async function callModel(prompt) {
  const res = await client.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
  });

  const text = ensureString(res.output_text);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("JSON parse failed: model did not return a valid JSON object");
  }

  const jsonText = text.slice(start, end + 1);
  const parsed = safeJsonParse(jsonText);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON parse failed: invalid JSON object");
  }

  return parsed;
}

/* ================= 패킷 정리 ================= */

function normalizePacket(packet, engine, fallbackTitle) {
  const normalized = {
    mainTitle: ensureString(packet?.mainTitle, fallbackTitle || "MARCUSNOTE WORKSHEET"),
    difficultyLabel: ensureString(packet?.difficultyLabel),
    targetGrammar: ensureString(packet?.targetGrammar),
    questions: ensureArray(packet?.questions).map((q, index) => {
      const options = ensureArray(q?.options)
        .map((o) => ensureString(o))
        .filter(Boolean)
        .slice(0, 5);

      return {
        number: Number(q?.number) || index + 1,
        type: ensureString(q?.type, engine === ENGINE_MODE.WORMHOLE ? "grammar_question" : "general"),
        stem: ensureString(q?.stem, `Question ${index + 1}`),
        options,
        answer: normalizeAnswerValue(q?.answer),
        explanation: ensureString(q?.explanation),
      };
    }),
  };

  normalized.questions = normalized.questions.filter((q) => q.stem);

  return normalized;
}

/* ================= 검수 ================= */

function validateCommonPacket(packet, engine) {
  const errors = [];
  const questions = ensureArray(packet?.questions);

  const requiredCount = engine === ENGINE_MODE.VOCAB_BUILDER ? null : 25;
  if (requiredCount && questions.length !== requiredCount) {
    errors.push(`Question count must be exactly ${requiredCount}.`);
  }

  questions.forEach((q, index) => {
    if (!q.stem || q.stem.length < 5) {
      errors.push(`Question ${index + 1} stem is too short.`);
    }

    if (!q.answer) {
      errors.push(`Question ${index + 1} is missing answer.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

function validateWormholePacket(packet) {
  const errors = [];
  const warnings = [];
  const questions = ensureArray(packet?.questions);

  if (questions.length !== 25) {
    errors.push("WORMHOLE requires exactly 25 questions.");
  }

  const seenStems = new Set();
  const typeCount = {};
  const answerCount = { "①": 0, "②": 0, "③": 0, "④": 0, "⑤": 0 };

  let explanationMissingCount = 0;
  let weakTypeCount = 0;

  questions.forEach((q, index) => {
    const n = index + 1;

    if (!q.stem || q.stem.length < 8) {
      errors.push(`Question ${n} stem is too short.`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 5) {
      errors.push(`Question ${n} must have exactly 5 options.`);
    }

    if (!q.answer) {
      errors.push(`Question ${n} is missing answer.`);
    }

    if (!q.explanation || q.explanation.length < 8) {
      explanationMissingCount += 1;
    }

    const stemKey = ensureString(q.stem).toLowerCase();
    if (stemKey) {
      if (seenStems.has(stemKey)) {
        errors.push(`Question ${n} is duplicated.`);
      }
      seenStems.add(stemKey);
    }

    const type = ensureString(q.type, "unknown");
    typeCount[type] = (typeCount[type] || 0) + 1;

    if (!/discrimination|error|blank|transformation|context|comparison|judgment/i.test(type)) {
      weakTypeCount += 1;
    }

    if (answerCount[q.answer] != null) {
      answerCount[q.answer] += 1;
    }
  });

  if (explanationMissingCount > 0) {
    errors.push(`WORMHOLE explanation missing or too short in ${explanationMissingCount} item(s).`);
  }

  const dominantTypeTooHigh = Object.values(typeCount).some((count) => count >= 12);
  if (dominantTypeTooHigh) {
    warnings.push("Too many questions share the same type pattern.");
  }

  if (weakTypeCount >= 15) {
    warnings.push("Too many questions are labeled in a weak/general way.");
  }

  const maxAnswerSpread = Math.max(...Object.values(answerCount));
  if (maxAnswerSpread >= 10) {
    warnings.push("Answer distribution looks too concentrated.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/* ================= 포맷 ================= */

function format(packet, engine) {
  const lines = [];

  lines.push(packet.mainTitle || "MARCUSNOTE WORKSHEET");
  if (engine === ENGINE_MODE.WORMHOLE && packet.difficultyLabel) {
    lines.push(`[${packet.difficultyLabel}]`);
  }
  if (packet.targetGrammar) {
    lines.push(`Target Grammar: ${packet.targetGrammar}`);
  }
  lines.push("");

  packet.questions.forEach((q) => {
    lines.push(`${q.number}. ${q.stem}`);

    if (q.options?.length) {
      q.options.forEach((o, i) => {
        lines.push(`${getOptionMark(i)} ${o}`);
      });
    }

    lines.push("");
  });

  lines.push("ANSWER KEY");
  lines.push("");

  packet.questions.forEach((q) => {
    if (q.explanation) {
      lines.push(`${q.number}) ${q.answer} — ${q.explanation}`);
    } else {
      lines.push(`${q.number}) ${q.answer}`);
    }
  });

  return lines.join("\n");
}

/* ================= CORS ================= */

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

/* ================= 핸들러 ================= */

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
    const body = normalizeBody(req.body || {});

    if (!body.prompt) {
      return res.status(400).json({
        ok: false,
        error: "No prompt",
      });
    }

    const locale = isKorean(body.prompt) ? "ko" : "en";
    const engine = body.selectedEngine || inferEngine(body.prompt);

    const prompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
    });

    const rawPacket = await callModel(prompt);
    const packet = normalizePacket(rawPacket, engine, body.worksheetTitle);

    const commonValidation = validateCommonPacket(packet, engine);
    if (!commonValidation.ok) {
      throw new Error("Common validation failed: " + commonValidation.errors.join(" | "));
    }

    let validationWarnings = [];
    if (engine === ENGINE_MODE.WORMHOLE) {
      const wormholeValidation = validateWormholePacket(packet);

      if (!wormholeValidation.ok) {
        throw new Error("WORMHOLE validation failed: " + wormholeValidation.errors.join(" | "));
      }

      validationWarnings = wormholeValidation.warnings || [];
    }

    const text = format(packet, engine);

    return res.status(200).json({
      ok: true,
      output: text,
      questions: packet.questions,
      mainTitle: packet.mainTitle,
      difficultyLabel: packet.difficultyLabel,
      targetGrammar: packet.targetGrammar,
      worksheetTitle: body.worksheetTitle,
      academyName: body.academyName,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      model: OPENAI_MODEL,
      warnings: validationWarnings,
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
