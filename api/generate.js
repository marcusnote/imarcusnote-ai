const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ✅ 핵심 변경 */
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ✅ 엔진 정의 유지 */
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
    worksheetTitle: pickFirst(body.worksheetTitle, "Marcusnote Worksheet"),
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

  return ENGINE_MODE.WORMHOLE;
}

/* ================= 프롬프트 ================= */

function buildPrompt({ engine, title, prompt, locale }) {
  return `
You are a professional worksheet generator.

ENGINE: ${engine}

RULES:
- Always generate a teacher-ready worksheet
- Exactly 25 questions (except vocab max 30)
- Provide answers and explanations
- Output ONLY JSON

TITLE:
${title}

USER REQUEST:
${prompt}

LOCALE: ${locale}
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

  if (start === -1 || end === -1) {
    throw new Error("JSON parse failed");
  }

  return JSON.parse(text.slice(start, end + 1));
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
        const mark = ["①", "②", "③", "④", "⑤"][i];
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

/* ================= 핸들러 ================= */

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      model: OPENAI_MODEL,
    });
  }

  try {
    const body = normalizeBody(req.body || {});

    if (!body.prompt) {
      return res.status(400).json({ ok: false, error: "No prompt" });
    }

    const locale = isKorean(body.prompt) ? "ko" : "en";
    const engine = body.selectedEngine || inferEngine(body.prompt);

    const prompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
    });

    /* ✅ 단 1회 호출 */
    const packet = await callModel(prompt);

    const text = format(packet);

    return res.status(200).json({
      ok: true,
      output: text,
      questions: packet.questions,
      engine,
      model: OPENAI_MODEL,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Generation failed",
      detail: e.message,
    });
  }
};
