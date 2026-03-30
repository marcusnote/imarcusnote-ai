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

function buildPrompt({ engine, title, prompt, locale }) {
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
      "stem": "string",
      "options": ["string", "string", "string", "string", "string"],
      "answer": "string"
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

  parsed.questions = ensureArray(parsed.questions)
    .map((q, index) => ({
      number: Number(q?.number) || index + 1,
      stem: ensureString(q?.stem, `Question ${index + 1}`),
      options: ensureArray(q?.options).map((o) => ensureString(o)).filter(Boolean),
      answer: ensureString(q?.answer, ""),
    }))
    .filter((q) => q.stem);

  if (!parsed.questions.length) {
    throw new Error("Invalid packet: no questions returned");
  }

  return parsed;
}

/* ================= 포맷 ================= */

function format(packet) {
  const lines = [];

  lines.push(packet.mainTitle || "MARCUSNOTE WORKSHEET");
  lines.push("");

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

    const packet = await callModel(prompt);
    const text = format(packet);

    return res.status(200).json({
      ok: true,
      output: text,
      questions: packet.questions,
      mainTitle: packet.mainTitle,
      worksheetTitle: body.worksheetTitle,
      academyName: body.academyName,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
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
