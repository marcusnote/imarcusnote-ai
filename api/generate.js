const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* =========================
   ENGINE
========================= */
const ENGINE_MODE = {
  ABC_STARTER: "ABC_STARTER",
  MOCK_EXAM: "MOCK_EXAM",
  MIDDLE_TEXTBOOK: "MIDDLE_TEXTBOOK",
  WORMHOLE: "WORMHOLE",
  MAGIC: "MAGIC",
};

/* =========================
   CACHE (9차 핵심)
========================= */
const CACHE = new Map();

function getCacheKey(engine, prompt, count) {
  return `${engine}_${count}_${prompt.slice(0, 100)}`;
}

/* =========================
   ITEM COUNT CONTROL (핵심)
========================= */
function getGenerationItemCount(engine, requested) {
  if (requested >= 25) {
    if (engine === ENGINE_MODE.WORMHOLE) return 18;
    if (engine === ENGINE_MODE.MOCK_EXAM) return 15;
    if (engine === ENGINE_MODE.MIDDLE_TEXTBOOK) return 18;
    if (engine === ENGINE_MODE.MAGIC) return 15;
  }
  return requested;
}

/* =========================
   TOKEN CONTROL (핵심)
========================= */
function getMaxOutputTokens(engine, count) {
  switch (engine) {
    case ENGINE_MODE.WORMHOLE:
      return count >= 15 ? 1300 : 1100;
    case ENGINE_MODE.MOCK_EXAM:
      return 1200;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 1200;
    case ENGINE_MODE.MAGIC:
      return 1000;
    case ENGINE_MODE.ABC_STARTER:
      return 800;
    default:
      return 900;
  }
}

/* =========================
   PROMPT (핵심 수정)
========================= */
function buildPrompt(prompt, engine, itemCount) {
  return `
You are a professional worksheet generator.

ENGINE: ${engine}

STRICT RULES:
- Output ONLY valid JSON
- DO NOT include explanation field
- Generate exactly ${itemCount} items
- Keep output lightweight
- Avoid long text
- Ensure answer is correct

JSON FORMAT:
{
 "questions":[
  {
   "number":1,
   "stem":"string",
   "options":["A","B","C","D","E"],
   "answer":"string"
  }
 ]
}

USER REQUEST:
${prompt}
`;
}

/* =========================
   CALL MODEL
========================= */
async function callModel(engine, prompt, count) {
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: buildPrompt(prompt, engine, count),
    max_output_tokens: getMaxOutputTokens(engine, count),
  });

  return response.output_text;
}

/* =========================
   PARSE JSON
========================= */
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* =========================
   HANDLER
========================= */
export default async function handler(req, res) {
  try {
    const body = req.body;

    const engine = body.selectedEngine || ENGINE_MODE.WORMHOLE;
    const prompt = body.prompt || "";

    const requested = 25;
    const generationCount = getGenerationItemCount(engine, requested);

    /* =========================
       CACHE HIT
    ========================= */
    const cacheKey = getCacheKey(engine, prompt, requested);
    if (CACHE.has(cacheKey)) {
      return res.status(200).json(CACHE.get(cacheKey));
    }

    /* =========================
       MODEL CALL
    ========================= */
    const raw = await callModel(engine, prompt, generationCount);
    const parsed = safeParse(raw);

    if (!parsed || !parsed.questions) {
      throw new Error("JSON parse failed");
    }

    /* =========================
       PAD TO 25
    ========================= */
    let questions = parsed.questions;

    while (questions.length < requested) {
      questions.push({
        number: questions.length + 1,
        stem: "Auto-filled item",
        options: ["A", "B", "C", "D", "E"],
        answer: "A",
      });
    }

    const result = {
      ok: true,
      questions,
    };

    /* =========================
       CACHE SAVE
    ========================= */
    CACHE.set(cacheKey, result);

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      ok: false,
      error: "Generation failed",
    });
  }
}
