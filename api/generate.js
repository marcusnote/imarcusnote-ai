const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// 🔥 서버 보호용 (동시 요청 제한)
let isProcessing = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeQueue() {
  let wait = 0;
  while (isProcessing) {
    await sleep(100);
    wait++;
    if (wait > 100) break; // 최대 10초 대기
  }
  isProcessing = true;
}

function releaseQueue() {
  isProcessing = false;
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function ensureString(v) {
  return typeof v === "string" ? v.trim() : "";
}

// 🔥 안전 JSON 파싱
function safeParse(text) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// 🔥 fallback 생성기 (절대 실패 방지)
function createFallback(title) {
  return {
    mainTitle: title || "MARCUSNOTE WORKSHEET",
    instruction: "다음 문제를 풀고 정답을 고르시오.",
    questions: Array.from({ length: 5 }).map((_, i) => ({
      number: i + 1,
      stem: `[Fallback] Sample Question ${i + 1}`,
      options: ["A", "B", "C", "D", "E"],
      answer: "A",
      difficulty: "normal",
    })),
  };
}

// 🔥 최소 검수 (절대 reject 없음)
function normalizeQuestions(questions = []) {
  return ensureArray(questions).map((q, i) => ({
    number: i + 1,
    stem: ensureString(q.stem) || `Question ${i + 1}`,
    options: ensureArray(q.options).slice(0, 5),
    answer: ensureString(q.answer) || "N/A",
    difficulty: q.difficulty === "high" ? "high" : "normal",
  }));
}

// 🔥 모델 호출 (안정형)
async function callModel(prompt) {
  try {
    const res = await client.responses.create({
      model: MODEL,
      input: prompt,
      max_output_tokens: 2000, // 🔥 최적화
    });

    const parsed = safeParse(res.output_text);

    if (!parsed || !parsed.questions) {
      throw new Error("Invalid JSON");
    }

    parsed.questions = normalizeQuestions(parsed.questions);

    return parsed;
  } catch (e) {
    console.error("Model error:", e.message);
    return createFallback("Recovery Worksheet");
  }
}

// 🔥 출력 포맷
function format(packet) {
  let out = `${packet.mainTitle}\n\n`;

  if (packet.instruction) {
    out += packet.instruction + "\n\n";
  }

  packet.questions.forEach((q) => {
    out += `${q.number}. ${q.stem}\n`;

    if (q.options?.length) {
      q.options.forEach((o, i) => {
        const mark = ["①", "②", "③", "④", "⑤"][i];
        out += `${mark} ${o}\n`;
      });
    }

    out += "\n";
  });

  out += "ANSWER KEY\n\n";

  packet.questions.forEach((q) => {
    out += `${q.number}) ${q.answer}\n`;
  });

  return out;
}

// 🔥 API 핸들러
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "API key missing" });
  }

  try {
    await safeQueue(); // 🔥 동시접속 보호

    const { prompt, worksheetTitle } = req.body;

    if (!prompt) {
      releaseQueue();
      return res.status(400).json({ error: "No prompt" });
    }

    const finalPrompt = `
You are a professional exam worksheet generator.

STRICT:
- Return ONLY JSON
- Create 5-option multiple-choice questions
- Include answer

{
 "mainTitle": "${worksheetTitle || "Worksheet"}",
 "instruction": "문제를 풀고 정답을 고르시오.",
 "questions": []
}

USER INPUT:
${prompt}
`;

    const packet = await callModel(finalPrompt);
    const text = format(packet);

    releaseQueue();

    return res.status(200).json({
      ok: true,
      output: text,
      questions: packet.questions,
      model: MODEL,
    });
  } catch (e) {
    releaseQueue();

    return res.status(500).json({
      error: "Server error",
      detail: e.message,
    });
  }
};
