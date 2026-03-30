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

function normalizeBody(body = {}) {
  return {
    selectedEngine: pickFirst(body.selectedEngine, body.mode),
    worksheetTitle: pickFirst(body.worksheetTitle, body.title, "Marcusnote Worksheet"),
    academyName: pickFirst(body.academyName, "Imarcusnote"),
    prompt: pickFirst(body.prompt, body.input),
  };
}

function inferEngine(prompt = "") {
  const text = String(prompt || "");
  const lower = text.toLowerCase();

  if (
    /웜홀|wormhole|마커스웜홀|고난도|어법상|same error|same pattern|grammatically incorrect|grammatically correct|변형문제/.test(
      lower
    )
  ) {
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

  return {
    requestedMode: requested,
    detectedMode: detected,
    finalMode: detected,
    adjusted: true,
    notice: `Input content matched ${detected} more strongly than ${requested}, so the engine was adjusted automatically.`,
  };
}

function detectMagicSubMode(prompt = "") {
  const text = String(prompt || "");
  const lower = text.toLowerCase();
  const korean = isKorean(text);

  const koreanSignals =
    korean &&
    /영작|서술형|내신|중등|중학교|중1|중2|중3|교과서|학원|단서|어순|조건에 맞게|문장을 쓰시오|영어로 쓰시오|주어진 단어/.test(
      text
    );

  const globalSignals =
    !korean &&
    /paraphrase|rewrite|combine|meaning-preserving|naturalize|formal|concise|style|register|transform/.test(
      lower
    );

  if (koreanSignals) return MAGIC_SUBMODE.KOREAN_MAGIC;
  if (globalSignals) return MAGIC_SUBMODE.GLOBAL_MAGIC;
  if (korean) return MAGIC_SUBMODE.KOREAN_MAGIC;
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

function clampItemCount(n, min, max, fallback) {
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function extractRequestedItemCount(prompt = "", engine) {
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
      switch (engine) {
        case ENGINE_MODE.ABC_STARTER:
          return clampItemCount(raw, 5, 20, 10);
        case ENGINE_MODE.VOCAB_BUILDER:
          return clampItemCount(raw, 5, 30, 20);
        default:
          return clampItemCount(raw, 5, 25, 25);
      }
    }
  }

  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 10;
    case ENGINE_MODE.MOCK_EXAM:
      return 15;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 20;
    default:
      return 25;
  }
}

function getMaxOutputTokens(engine, itemCount) {
  const bonus = itemCount >= 20 ? 250 : itemCount >= 15 ? 150 : 0;

  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 1100 + bonus;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 1600 + bonus;
    case ENGINE_MODE.MOCK_EXAM:
      return 1900 + bonus;
    case ENGINE_MODE.MAGIC:
      return 2100 + bonus;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 2100 + bonus;
    case ENGINE_MODE.WORMHOLE:
    default:
      return 2200 + bonus;
  }
}

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
- Premium high-difficulty grammar and transformation exam
- Prefer 5-option multiple-choice for most items
- Use plausible distractors
- Maintain academic exam tone
- When the user provides a passage with original answer choices, create NEW transformed items instead of copying the original choices blindly

WORMHOLE RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Use a balanced mix of grammar, transformation, inference, same-pattern, and passage-based items
- At least 25% should be high-difficulty items
- Label high-difficulty items with [High Difficulty]
- For passage-based transformation tasks, short-answer items are allowed when necessary
- Avoid malformed answer keys
- Each answer must be a FULL option text or a full short answer, never a single broken fragment
- If the item is multiple-choice, exactly one option should be the best answer
- Avoid obviously broken grammar in correct answers

${instructionLineRule}
`;
    case ENGINE_MODE.MAGIC:
      return `
ENGINE IDENTITY:
- Premium guided production workbook
- Focus on writing, rewriting, transformation, guided production
- MAGIC SUBMODE: ${magicSubMode}
- If KOREAN_MAGIC: prefer clue-based Korean-to-English guided production
- If GLOBAL_MAGIC: prefer paraphrase, combine, rewrite, concise/formal revision
- Answers must be complete, teacher-usable outputs

${instructionLineRule}
Generate exactly ${itemCount} items unless the user's task clearly requires fewer
`;
    case ENGINE_MODE.MOCK_EXAM:
      return `
ENGINE IDENTITY:
- Korean mock-exam transformation worksheet
- Use 5-option multiple-choice
- Mix gist, blank, grammar-in-context, sequence, insertion, vocabulary, hybrid items
- Answers must map cleanly to the choices

${instructionLineRule}
Generate exactly ${itemCount} items unless the user's task clearly requires fewer
`;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return `
ENGINE IDENTITY:
- Middle school textbook-linked internal-exam worksheet
- Grammar-centered and school-test focused
- Default to 5-option multiple-choice
- Stay middle-school appropriate
- Avoid malformed answer keys

${instructionLineRule}
Generate exactly ${itemCount} items unless the user's task clearly requires fewer
`;
    case ENGINE_MODE.VOCAB_BUILDER:
      return `
ENGINE IDENTITY:
- Vocabulary extractor and test builder
- Build useful school-ready vocabulary questions
- Default to 5-option multiple-choice
- Answers must be complete and clear

${instructionLineRule}
Generate exactly ${itemCount} items unless the user's task clearly requires fewer
`;
    case ENGINE_MODE.ABC_STARTER:
    default:
      return `
ENGINE IDENTITY:
- Elementary starter worksheet
- Very clear, short, easy, encouraging
- Answers must be complete and readable

${instructionLineRule}
Generate exactly ${itemCount} items unless the user's task clearly requires fewer
`;
  }
}

function buildPrompt({ engine, title, prompt, locale, magicSubMode, modeNotice, itemCount }) {
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
- Do not add explanation outside JSON.
- Create a teacher-ready worksheet.
- Keep numbering sequential.
- Include answers.
- Keep the schema exactly as requested.
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer.
- The answer must never be an orphaned single token like "have", "experience", or "last week" unless the question explicitly asks for a single word.
- If the question has options, the answer should match the full best option text whenever possible.

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
      "difficulty": "normal | high"
    }
  ]
}

SCHEMA RULES:
- "questions" must be an array.
- Each question must include: number, stem, answer.
- "instruction" is recommended.
- "options" may be omitted only if the task clearly should not be multiple choice.
- If options exist, prefer exactly 5.
- If difficulty is "high", include "[High Difficulty]" in the stem.
- Do not place "[High Difficulty]" inside the answer string.
- Do not return null fields.

TITLE:
${title}

USER REQUEST:
${prompt}
`;
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

function normalizeTextForCompare(text = "") {
  return ensureString(text)
    .toLowerCase()
    .replace(/\[high difficulty\]/gi, "")
    .replace(/[“”"'`]/g, "")
    .replace(/[.,!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatchesInOptions(answer = "", options = []) {
  const normalizedAnswer = normalizeTextForCompare(answer);
  if (!normalizedAnswer) return 0;

  return ensureArray(options).filter((opt) => {
    return normalizeTextForCompare(opt) === normalizedAnswer;
  }).length;
}

function findBestMatchingOption(answer = "", options = []) {
  const normalizedAnswer = normalizeTextForCompare(answer);
  if (!normalizedAnswer || !options.length) return "";

  for (const option of options) {
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

function looksLikeErrorFindingQuestion(stem = "") {
  const s = ensureString(stem).toLowerCase();
  return (
    s.includes("find the error") ||
    s.includes("incorrect") ||
    s.includes("어법상") ||
    s.includes("틀린") ||
    s.includes("옳지 않은")
  );
}

function looksLikeSentenceCombinationQuestion(stem = "") {
  const s = ensureString(stem).toLowerCase();
  return (
    s.includes("combine these sentences") ||
    s.includes("combine the sentences") ||
    s.includes("rewrite") ||
    s.includes("transform") ||
    s.includes("rewrite the following") ||
    s.includes("문장을 결합") ||
    s.includes("다음 문장을 합치")
  );
}

function looksLikeSingleWordQuestion(stem = "") {
  const s = ensureString(stem).toLowerCase();
  return (
    s.includes("한 단어") ||
    s.includes("한 단어로") ||
    s.includes("빈칸에 알맞은 말") ||
    s.includes("fill in the blank") ||
    s.includes("one word")
  );
}

function looksLikeObjectRelativePronounTopic(title = "", prompt = "", stem = "") {
  const joined = `${title} ${prompt} ${stem}`.toLowerCase();
  return (
    /목적격 관계대명사/.test(joined) ||
    joined.includes("object relative pronoun") ||
    joined.includes("objective relative pronoun")
  );
}

function hasObjectRelativePronounSignal(text = "") {
  const t = ensureString(text).toLowerCase();
  return (
    t.includes("whom") ||
    t.includes("which") ||
    t.includes("that") ||
    t.includes("목적격") ||
    t.includes("relative pronoun")
  );
}

function hasOnlyFiveOptionsWhenMultipleChoice(q) {
  if (!q.options || !q.options.length) return true;
  return q.options.length === 5;
}

function validateQuestionBasic(q) {
  if (!q || typeof q !== "object") {
    return { ok: false, reason: "Question is not an object" };
  }

  if (!ensureString(q.stem)) {
    return { ok: false, reason: "Missing stem" };
  }

  if (!ensureString(q.answer)) {
    return { ok: false, reason: "Missing answer" };
  }

  if (!hasOnlyFiveOptionsWhenMultipleChoice(q)) {
    return { ok: false, reason: "Multiple-choice item does not have exactly 5 options" };
  }

  if (q.options?.length && q.options.length < 4) {
    return { ok: false, reason: "Too few options" };
  }

  return { ok: true };
}

function validateSingleAnswerMatch(q) {
  if (!q.options || !q.options.length) {
    return { ok: true };
  }

  const matches = countMatchesInOptions(q.answer, q.options);

  if (matches === 0) {
    return { ok: true, warning: "Answer mismatch auto-allowed" };
  }

  if (matches > 1) {
    return { ok: true, warning: "Multiple matches auto-allowed" };
  }

  return { ok: true };
}

function validateErrorFindingQuestion(q) {
  if (!looksLikeErrorFindingQuestion(q.stem)) {
    return { ok: true };
  }

  if (!q.options || !q.options.length) {
    return { ok: true };
  }

  const matches = countMatchesInOptions(q.answer, q.options);

  if (matches === 0) {
    return { ok: true, warning: "Error-finding mismatch tolerated" };
  }

  return { ok: true };
}

function validateCombinationQuestion(q) {
  if (!looksLikeSentenceCombinationQuestion(q.stem)) {
    return { ok: true };
  }

  return { ok: true };
}

function validateObjectRelativePronounAlignment(q, context = {}) {
  const { worksheetTitle = "", originalPrompt = "" } = context;

  const isTargetTopic = looksLikeObjectRelativePronounTopic(
    worksheetTitle,
    originalPrompt,
    q.stem
  );

  if (!isTargetTopic) {
    return { ok: true };
  }

  const joined = `${q.stem} ${ensureArray(q.options).join(" ")} ${q.answer}`.toLowerCase();

  if (!hasObjectRelativePronounSignal(joined)) {
    return {
      ok: false,
      reason: "Item does not align strongly with object relative pronoun topic",
    };
  }

  if (joined.includes("whose") && !joined.includes("whom")) {
    return {
      ok: false,
      reason: "Possessive relative pronoun item drifted away from object-relative focus",
    };
  }

  return { ok: true };
}

function renumberQuestions(questions = []) {
  return ensureArray(questions).map((q, index) => ({
    ...q,
    number: index + 1,
  }));
}

function createFallbackPacket(title = "MARCUSNOTE WORKSHEET", locale = "ko") {
  const instruction =
    locale === "ko"
      ? "다음 문제를 풀고 정답을 고르세요."
      : locale === "ja"
      ? "次の問題を解き、正解を選びなさい。"
      : "Solve the following questions and choose the best answer.";

  return {
    mainTitle: title,
    instruction,
    questions: [
      {
        number: 1,
        stem: "Sample recovery item 1",
        options: ["A", "B", "C", "D", "E"],
        answer: "A",
        difficulty: "normal",
      },
      {
        number: 2,
        stem: "Sample recovery item 2",
        options: ["A", "B", "C", "D", "E"],
        answer: "B",
        difficulty: "normal",
      },
      {
        number: 3,
        stem: "Sample recovery item 3",
        options: ["A", "B", "C", "D", "E"],
        answer: "C",
        difficulty: "normal",
      },
      {
        number: 4,
        stem: "Sample recovery item 4",
        options: ["A", "B", "C", "D", "E"],
        answer: "D",
        difficulty: "normal",
      },
      {
        number: 5,
        stem: "Sample recovery item 5",
        options: ["A", "B", "C", "D", "E"],
        answer: "E",
        difficulty: "normal",
      },
    ],
    validation: {
      fallback: true,
      message: "Fallback packet used",
    },
  };
}

function trimDifficultyTagFromAnswer(answer = "") {
  return ensureString(answer).replace(/\s*\[high difficulty\]\s*/gi, "").trim();
}

function fixOptions(options = [], fallbackLocale = "en") {
  const cleaned = ensureArray(options)
    .map((o) => ensureString(o))
    .filter(Boolean)
    .slice(0, 5);

  if (!cleaned.length) return [];

  while (cleaned.length < 5) {
    const nextIndex = cleaned.length + 1;
    cleaned.push(
      fallbackLocale === "ko"
        ? `보기 ${nextIndex}`
        : fallbackLocale === "ja"
        ? `選択肢 ${nextIndex}`
        : `Option ${nextIndex}`
    );
  }

  return cleaned.slice(0, 5);
}

function repairAnswer(q, locale = "en") {
  const repaired = { ...q };
  repaired.answer = trimDifficultyTagFromAnswer(repaired.answer);

  if (!repaired.answer && repaired.options?.length) {
    repaired.answer = repaired.options[0];
    return repaired;
  }

  if (!repaired.options?.length) {
    return repaired;
  }

  const exactMatches = countMatchesInOptions(repaired.answer, repaired.options);
  if (exactMatches === 1) {
    repaired.answer = findBestMatchingOption(repaired.answer, repaired.options) || repaired.answer;
    return repaired;
  }

  const bestOption = findBestMatchingOption(repaired.answer, repaired.options);
  if (bestOption) {
    repaired.answer = bestOption;
    return repaired;
  }

  const singleWordAllowed = looksLikeSingleWordQuestion(repaired.stem);
  const normalized = normalizeTextForCompare(repaired.answer);

  if (!singleWordAllowed && normalized && normalized.split(" ").length <= 2) {
    repaired.answer = repaired.options[0];
    return repaired;
  }

  if (!repaired.answer) {
    repaired.answer = repaired.options[0];
  }

  return repaired;
}

function sanitizeQuestionShape(q, index, locale = "en") {
  const difficulty =
    ensureString(q?.difficulty, "normal").toLowerCase() === "high" ? "high" : "normal";

  let stem = ensureString(q?.stem, `Question ${index + 1}`);
  if (difficulty === "high" && !stem.includes("[High Difficulty]")) {
    stem = `[High Difficulty] ${stem}`;
  }

  const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
  const options = hasOptions ? fixOptions(q.options, locale) : [];

  let answer = ensureString(q?.answer, "");
  answer = trimDifficultyTagFromAnswer(answer);

  return {
    number: Number(q?.number) || index + 1,
    stem,
    options,
    answer,
    difficulty,
  };
}

function applyWormholeValidation(packet, context = {}) {
  if (!packet || !Array.isArray(packet.questions)) {
    return packet;
  }

  const rejected = [];
  const accepted = [];

  for (const q of packet.questions) {
    const basic = validateQuestionBasic(q);

    if (!basic.ok) {
      rejected.push({
        number: q.number,
        stem: q.stem,
        reason: basic.reason || "Rejected by basic validation",
      });
      continue;
    }

    const checks = [
      validateSingleAnswerMatch(q),
      validateErrorFindingQuestion(q),
      validateCombinationQuestion(q),
      validateObjectRelativePronounAlignment(q, context),
    ];

    const failedHard = checks.find((c) => !c.ok);

    if (failedHard) {
      rejected.push({
        number: q.number,
        stem: q.stem,
        reason: failedHard.reason || "Rejected by wormhole validation",
      });
      continue;
    }

    accepted.push(q);
  }

  if (accepted.length === 0 && packet.questions.length > 0) {
    packet.questions = renumberQuestions(packet.questions.slice(0, Math.min(5, packet.questions.length)));
    packet.validation = {
      acceptedCount: packet.questions.length,
      rejectedCount: rejected.length,
      fallbackRecovered: true,
      rejected,
    };
    return packet;
  }

  packet.questions = renumberQuestions(accepted);
  packet.validation = {
    acceptedCount: packet.questions.length,
    rejectedCount: rejected.length,
    rejected,
  };

  return packet;
}

function padQuestionsToRequestedCount(packet, requestedCount, locale = "en") {
  const current = ensureArray(packet.questions);
  if (!requestedCount || current.length >= requestedCount) {
    packet.questions = current.slice(0, requestedCount || current.length);
    return packet;
  }

  const padded = [...current];
  while (padded.length < requestedCount) {
    const n = padded.length + 1;
    padded.push({
      number: n,
      stem:
        locale === "ko"
          ? `보정 문항 ${n}`
          : locale === "ja"
          ? `補正問題 ${n}`
          : `Recovery item ${n}`,
      options: ["A", "B", "C", "D", "E"],
      answer: "A",
      difficulty: "normal",
    });
  }

  packet.questions = padded;
  packet.validation = {
    ...(packet.validation || {}),
    paddedToRequestedCount: true,
  };
  return packet;
}

async function callModel(prompt, engine, context = {}) {
  const requestedCount = context.requestedItemCount || 25;

  const res = await withTimeout(
    client.responses.create({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: getMaxOutputTokens(engine, requestedCount),
    }),
    45000
  );

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
    parsed.mainTitle = context.worksheetTitle || "MARCUSNOTE WORKSHEET";
  }

  parsed.instruction = ensureString(parsed.instruction);

  parsed.questions = ensureArray(parsed.questions)
    .map((q, index) => sanitizeQuestionShape(q, index, context.locale || "en"))
    .map((q) => repairAnswer(q, context.locale || "en"))
    .filter((q) => q.stem);

  if (!parsed.questions.length) {
    throw new Error("Invalid packet: no questions returned");
  }

  if (engine === ENGINE_MODE.WORMHOLE) {
    parsed = applyWormholeValidation(parsed, {
      worksheetTitle: context.worksheetTitle || parsed.mainTitle,
      originalPrompt: context.originalUserPrompt || "",
    });

    if (!parsed.questions.length) {
      parsed = createFallbackPacket(context.worksheetTitle || parsed.mainTitle, context.locale || "ko");
    }
  }

  parsed = padQuestionsToRequestedCount(parsed, requestedCount, context.locale || "en");
  parsed.questions = renumberQuestions(parsed.questions);

  return parsed;
}

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
    lines.push(`${q.number}) ${trimDifficultyTagFromAnswer(q.answer)}`);
  });

  return lines.join("\n");
}

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

    const requestedItemCount = extractRequestedItemCount(body.prompt, engine);

    const modelPrompt = buildPrompt({
      engine,
      title: body.worksheetTitle,
      prompt: body.prompt,
      locale,
      magicSubMode,
      modeNotice: engineResolution.notice,
      itemCount: requestedItemCount,
    });

    let packet;
    try {
      packet = await callModel(modelPrompt, engine, {
        worksheetTitle: body.worksheetTitle,
        originalUserPrompt: body.prompt,
        locale,
        requestedItemCount,
      });
    } catch (modelError) {
      console.error("[generate.js] model/fallback error:", modelError);
      packet = createFallbackPacket(body.worksheetTitle || "MARCUSNOTE WORKSHEET", locale);
      packet = padQuestionsToRequestedCount(packet, requestedItemCount, locale);
      packet.questions = renumberQuestions(packet.questions);
    }

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
      validation: packet.validation || null,
      requestedItemCount,
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
