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

/**
 * 7차 핵심 유지:
 * - selectedEngine이 유효하면 무조건 그 엔진 유지
 * - detected는 보조 참고용만 사용
 * - 자동 엔진 교체 금지
 */
function resolveEngine(selectedEngine, prompt = "") {
  const requested = ensureString(selectedEngine).toUpperCase();
  const detected = inferEngine(prompt);
  const validModes = new Set(Object.values(ENGINE_MODE));

  if (requested && validModes.has(requested)) {
    return {
      requestedMode: requested,
      detectedMode: detected,
      finalMode: requested,
      adjusted: false,
      notice:
        requested !== detected
          ? `Selected engine "${requested}" was preserved. Input text also contains signals related to "${detected}", but automatic engine switching is disabled.`
          : "",
    };
  }

  return {
    requestedMode: "",
    detectedMode: detected,
    finalMode: detected,
    adjusted: false,
    notice: "No valid engine was selected, so the engine was inferred from the input.",
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

function shouldUseCompactExplanation(engine, itemCount) {
  if (engine === ENGINE_MODE.MAGIC) return true;
  if (itemCount >= 20) return true;
  return false;
}

function getMaxOutputTokens(engine, itemCount) {
  // 8차: explanation 추가로 아주 조금만 보강.
  // 과도하게 올리지 않아 Vercel 부담을 줄임.
  const compact = shouldUseCompactExplanation(engine, itemCount);
  const compactBonus = compact ? 120 : 220;
  const sizeBonus = itemCount >= 20 ? 180 : itemCount >= 15 ? 100 : 0;

  switch (engine) {
    case ENGINE_MODE.ABC_STARTER:
      return 1100 + compactBonus + sizeBonus;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 1500 + compactBonus + sizeBonus;
    case ENGINE_MODE.MOCK_EXAM:
      return 1800 + compactBonus + sizeBonus;
    case ENGINE_MODE.MAGIC:
      return 1900 + compactBonus + sizeBonus;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 1900 + compactBonus + sizeBonus;
    case ENGINE_MODE.WORMHOLE:
    default:
      return 2000 + compactBonus + sizeBonus;
  }
}

function extractGrammarLockHint(title = "", prompt = "") {
  const joined = `${title} ${prompt}`;

  if (/관계부사/.test(joined)) return "RELATIVE_ADVERB_ONLY";
  if (/목적격\s*관계대명사/.test(joined)) return "OBJECT_RELATIVE_PRONOUN_ONLY";
  if (/현재완료/.test(joined)) return "PRESENT_PERFECT_ONLY";
  if (/수동태/.test(joined)) return "PASSIVE_ONLY";
  if (/가정법/.test(joined)) return "SUBJUNCTIVE_ONLY";

  return "";
}

function buildEngineInstruction(engine, locale, itemCount, magicSubMode, grammarLockHint = "") {
  const instructionLineRule =
    locale === "ko"
      ? "The visible instruction line should be concise Korean."
      : locale === "ja"
      ? "The visible instruction line should be concise Japanese."
      : "The visible instruction line should be concise English.";

  const compactExplanationRule = shouldUseCompactExplanation(engine, itemCount)
    ? "Keep each explanation to ONE short line only."
    : "Keep each explanation brief and teacher-usable.";

  switch (engine) {
    case ENGINE_MODE.WORMHOLE:
      return `
ENGINE IDENTITY:
- Premium high-difficulty grammar and transformation exam
- Strongly exam-oriented
- Prefer 5-option multiple-choice for most items, but 6 options are allowed when the question naturally benefits from an extra distractor
- Use plausible distractors
- Maintain academic exam tone
- When the user provides a passage with original answer choices, create NEW transformed items instead of copying the original choices blindly

WORMHOLE RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Use a balanced mix of grammar, transformation, inference, same-pattern, error-finding, sentence-count, and passage-based items
- At least 25% should be high-difficulty items
- Label high-difficulty items with [High Difficulty]
- Multiple-choice is the default format
- Exactly one option should be the single best answer
- Avoid malformed answer keys
- Each answer must be a FULL option text or a full short answer, never a broken fragment
- Include a short explanation for every item
- ${compactExplanationRule}
- For some items, you may use these high-value formats:
  1) "How many sentences are grammatically correct?"
  2) "How many sentences are awkward?"
  3) "Choose the awkward sentence."
  4) "Choose the grammatically correct sentence."
  5) "Choose the pair/set that shares the same error pattern."
- Use 6 options sparingly, not excessively
- Do not let every item become the same pattern
- Avoid obviously broken grammar in correct answers

${instructionLineRule}
`;
    case ENGINE_MODE.MAGIC:
      return `
ENGINE IDENTITY:
- Premium guided production workbook
- Focus on writing, rewriting, transformation, guided production
- MAGIC SUBMODE: ${magicSubMode}
- If KOREAN_MAGIC: prefer Korean-to-English production
- If GLOBAL_MAGIC: prefer paraphrase, combine, rewrite, concise/formal revision
- Answers must be complete, teacher-usable outputs

MAGIC ABSOLUTE RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- DO NOT generate multiple-choice options
- DO NOT generate 5-choice answers
- Each item should be a production task, sentence writing task, rewrite task, or guided completion task
- Include a short explanation for every item
- ${compactExplanationRule}
- "options" should be omitted
- "answer" should be a complete model answer
- Never turn Magic into Wormhole-style grammar multiple-choice
- Never turn Magic into Mock-style test questions
- If grammar lock exists, obey it strictly

MAGIC GRAMMAR LOCK:
- Grammar lock hint: ${grammarLockHint || "NONE"}
- If RELATIVE_ADVERB_ONLY:
  * Focus on where / when / why structures
  * Avoid drifting into who / which / that-focused relative pronoun items unless absolutely necessary
- If OBJECT_RELATIVE_PRONOUN_ONLY:
  * Focus on whom / that / which as object relatives
  * Avoid drifting into possessive relative pronoun whose unless clearly required
- Keep the target grammar centered and visible

${instructionLineRule}
`;
    case ENGINE_MODE.MOCK_EXAM:
      return `
ENGINE IDENTITY:
- Korean mock-exam transformation worksheet
- Use 5-option multiple-choice as default
- 6 options are allowed only for selected high-difficulty items
- Mix gist, blank, grammar-in-context, sequence, insertion, vocabulary, and passage-based items
- Answers must map cleanly to the choices

MOCK EXAM RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Default to 5-option multiple-choice
- Keep strong test-book / exam-book tone
- Include a short explanation for every item
- ${compactExplanationRule}
- Do not turn this into Magic-style sentence production
- Do not turn this into pure Wormhole grammar-only mode unless the user's source itself is grammar-transformation based

${instructionLineRule}
`;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return `
ENGINE IDENTITY:
- Middle school textbook-linked internal-exam worksheet
- Grammar-centered and school-test focused
- Default to 5-option multiple-choice
- 6 options allowed for a limited number of high-difficulty items
- Stay middle-school appropriate
- Avoid malformed answer keys

MIDDLE_TEXTBOOK RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Keep textbook-linked school-exam style
- Default to 5-option multiple-choice
- Include a short explanation for every item
- ${compactExplanationRule}
- Do not convert into Magic production workbook format

${instructionLineRule}
`;
    case ENGINE_MODE.VOCAB_BUILDER:
      return `
ENGINE IDENTITY:
- Vocabulary extractor and test builder
- Build useful school-ready vocabulary questions
- Default to 5-option multiple-choice
- Answers must be complete and clear

VOCAB RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Prioritize vocabulary meaning, usage, synonym/antonym, context completion
- Include a short explanation for every item
- ${compactExplanationRule}

${instructionLineRule}
`;
    case ENGINE_MODE.ABC_STARTER:
    default:
      return `
ENGINE IDENTITY:
- Elementary starter worksheet
- Very clear, short, easy, encouraging
- Answers must be complete and readable

ABC RULES:
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer
- Keep difficulty low and stable
- Use simple, short stems
- Include a short explanation for every item
- ${compactExplanationRule}

${instructionLineRule}
`;
  }
}

function buildPrompt({ engine, title, prompt, locale, magicSubMode, modeNotice, itemCount }) {
  const grammarLockHint = extractGrammarLockHint(title, prompt);
  const engineInstruction = buildEngineInstruction(
    engine,
    locale,
    itemCount,
    magicSubMode,
    grammarLockHint
  );
  const compactExplanation = shouldUseCompactExplanation(engine, itemCount);

  return `
You are a professional worksheet generator for teachers and academies.

ENGINE: ${engine}
ENGINE LABEL: ${ENGINE_LABELS[engine] || engine}
LOCALE: ${locale}
GRAMMAR LOCK HINT: ${grammarLockHint || "NONE"}

${modeNotice ? `MODE NOTICE:\n${modeNotice}\n` : ""}

STRICT RULES:
- Output ONLY valid JSON.
- Do not wrap JSON in markdown code fences.
- Do not add explanation outside JSON.
- Create a teacher-ready worksheet.
- Keep numbering sequential.
- Include answers.
- Include explanations.
- Keep the schema exactly as requested.
- Generate exactly ${itemCount} items unless the user's task clearly requires fewer.
- The answer must never be an orphaned single token like "have", "experience", or "last week" unless the question explicitly asks for a single word.
- If the question has options, the answer should match the full best option text whenever possible.
- Respect the selected ENGINE strictly.
- Never switch worksheet style to another engine family.
- Keep explanations very short.
- ${compactExplanation ? "Explanations must be one short line only." : "Explanations must stay brief."}
- Avoid long passages inside explanations.

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
- "questions" must be an array.
- Each question must include: number, stem, answer, explanation.
- "instruction" is recommended.
- For MAGIC, omit "options".
- For non-MAGIC modes, prefer 5 options. 6 options are allowed for selected items.
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
    s.includes("옳지 않은") ||
    s.includes("awkward")
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

function looksLikeRelativeAdverbTopic(title = "", prompt = "", stem = "") {
  const joined = `${title} ${prompt} ${stem}`.toLowerCase();
  return /관계부사/.test(joined) || joined.includes("relative adverb");
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

function hasRelativeAdverbSignal(text = "") {
  const t = ensureString(text).toLowerCase();
  return (
    t.includes("where") ||
    t.includes("when") ||
    t.includes("why") ||
    t.includes("관계부사") ||
    t.includes("relative adverb")
  );
}

function hasAllowedOptionCount(q) {
  if (!q.options || !q.options.length) return true;
  return q.options.length >= 4 && q.options.length <= 6;
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

  if (!ensureString(q.explanation)) {
    return { ok: false, reason: "Missing explanation" };
  }

  if (!hasAllowedOptionCount(q)) {
    return { ok: false, reason: "Multiple-choice item does not have 4-6 options" };
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

  const joined = `${q.stem} ${ensureArray(q.options).join(" ")} ${q.answer} ${q.explanation}`.toLowerCase();

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

function validateRelativeAdverbAlignment(q, context = {}) {
  const { worksheetTitle = "", originalPrompt = "" } = context;
  const isTargetTopic = looksLikeRelativeAdverbTopic(worksheetTitle, originalPrompt, q.stem);

  if (!isTargetTopic) return { ok: true };

  const joined = `${q.stem} ${ensureArray(q.options).join(" ")} ${q.answer} ${q.explanation}`.toLowerCase();

  if (!hasRelativeAdverbSignal(joined)) {
    return {
      ok: false,
      reason: "Item does not align strongly with relative adverb topic",
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

function createFallbackInstruction(locale = "ko", engine = ENGINE_MODE.WORMHOLE) {
  if (engine === ENGINE_MODE.MAGIC) {
    if (locale === "ko") return "다음 문장을 영어로 완성하세요.";
    if (locale === "ja") return "次の文を英語で完成させなさい。";
    return "Complete the following sentences in English.";
  }

  if (locale === "ko") return "다음 문제를 풀고 정답을 고르세요.";
  if (locale === "ja") return "次の問題を解き、正解を選びなさい。";
  return "Solve the following questions and choose the best answer.";
}

function buildAutoExplanation(locale = "ko", engine = ENGINE_MODE.WORMHOLE, q = {}, index = 1) {
  if (engine === ENGINE_MODE.MAGIC) {
    if (locale === "ko") return "핵심 구조를 반영한 모범 답안입니다.";
    if (locale === "ja") return "主要構文を反映した模範解答です。";
    return "This model answer reflects the target structure.";
  }

  if (looksLikeErrorFindingQuestion(q.stem)) {
    if (locale === "ko") return "문법적으로 맞거나 틀린 핵심 지점을 확인해야 합니다.";
    if (locale === "ja") return "文法上の適否を判断する必要があります。";
    return "Check the key grammatical point carefully.";
  }

  if (locale === "ko") return "정답이 문맥과 문법에 가장 적절합니다.";
  if (locale === "ja") return "正答が文脈と文法に最も適切です。";
  return "The answer is the best fit for grammar and context.";
}

function createEngineFallbackPacket(
  title = "MARCUSNOTE WORKSHEET",
  locale = "ko",
  engine = ENGINE_MODE.WORMHOLE,
  requestedCount = 5
) {
  const instruction = createFallbackInstruction(locale, engine);

  if (engine === ENGINE_MODE.MAGIC) {
    const questions = [];
    const count = Math.max(5, Math.min(requestedCount || 5, 25));

    for (let i = 1; i <= count; i += 1) {
      questions.push({
        number: i,
        stem:
          locale === "ko"
            ? `보정 영작 문항 ${i}: 다음 문장을 영어로 쓰세요.`
            : locale === "ja"
            ? `補正英作文 ${i}: 次の文を英語で書きなさい。`
            : `Recovery writing item ${i}: Write the sentence in English.`,
        answer: `Sample answer ${i}`,
        explanation: buildAutoExplanation(locale, engine, {}, i),
        difficulty: "normal",
      });
    }

    return {
      mainTitle: title,
      instruction,
      questions,
      validation: {
        fallback: true,
        message: "Engine-specific Magic fallback packet used",
      },
    };
  }

  const questions = [];
  const count = Math.max(5, Math.min(requestedCount || 5, 25));

  for (let i = 1; i <= count; i += 1) {
    questions.push({
      number: i,
      stem:
        locale === "ko"
          ? `보정 문항 ${i}`
          : locale === "ja"
          ? `補正問題 ${i}`
          : `Recovery item ${i}`,
      options: ["A", "B", "C", "D", "E"],
      answer: "A",
      explanation: buildAutoExplanation(locale, engine, {}, i),
      difficulty: "normal",
    });
  }

  return {
    mainTitle: title,
    instruction,
    questions,
    validation: {
      fallback: true,
      message: "Engine-specific multiple-choice fallback packet used",
    },
  };
}

function trimDifficultyTagFromAnswer(answer = "") {
  return ensureString(answer).replace(/\s*\[high difficulty\]\s*/gi, "").trim();
}

function trimExplanation(explanation = "", locale = "ko") {
  const text = ensureString(explanation);
  if (!text) return "";

  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^[-•]\s*/, "")
    .trim();

  const limit = locale === "en" ? 140 : 90;
  if (cleaned.length > limit) {
    cleaned = cleaned.slice(0, limit).trim();
    if (!/[.!?。]$/.test(cleaned)) cleaned += "...";
  }

  return cleaned;
}

function fixOptions(options = [], fallbackLocale = "en") {
  const cleaned = ensureArray(options)
    .map((o) => ensureString(o))
    .filter(Boolean)
    .slice(0, 6);

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

  return cleaned.slice(0, 6);
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

function sanitizeQuestionShape(q, index, locale = "en", engine = ENGINE_MODE.WORMHOLE) {
  const difficulty =
    ensureString(q?.difficulty, "normal").toLowerCase() === "high" ? "high" : "normal";

  let stem = ensureString(q?.stem, `Question ${index + 1}`);
  if (difficulty === "high" && !stem.includes("[High Difficulty]")) {
    stem = `[High Difficulty] ${stem}`;
  }

  let options = [];

  if (engine !== ENGINE_MODE.MAGIC) {
    const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
    options = hasOptions ? fixOptions(q.options, locale) : [];
  }

  let answer = ensureString(q?.answer, "");
  answer = trimDifficultyTagFromAnswer(answer);

  let explanation = trimExplanation(q?.explanation, locale);

  const result = {
    number: Number(q?.number) || index + 1,
    stem,
    answer,
    explanation,
    difficulty,
  };

  if (engine !== ENGINE_MODE.MAGIC && options.length) {
    result.options = options;
  }

  return result;
}

function ensureExplanation(packet, locale = "ko", engine = ENGINE_MODE.WORMHOLE) {
  if (!packet || !Array.isArray(packet.questions)) return packet;

  packet.questions = packet.questions.map((q, index) => {
    if (ensureString(q.explanation)) return q;
    return {
      ...q,
      explanation: buildAutoExplanation(locale, engine, q, index + 1),
    };
  });

  return packet;
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
      validateRelativeAdverbAlignment(q, context),
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

function applyMagicValidation(packet, locale = "ko") {
  if (!packet || !Array.isArray(packet.questions)) {
    return packet;
  }

  const cleaned = packet.questions
    .map((q, index) => {
      const item = { ...q, number: index + 1 };

      delete item.options;

      item.stem = ensureString(item.stem, `Writing item ${index + 1}`);
      item.answer = ensureString(item.answer, `Sample answer ${index + 1}`);
      item.explanation = trimExplanation(
        ensureString(item.explanation, buildAutoExplanation(locale, ENGINE_MODE.MAGIC, item, index + 1)),
        locale
      );

      return item;
    })
    .filter((q) => ensureString(q.stem) && ensureString(q.answer));

  packet.questions = renumberQuestions(cleaned);
  packet.validation = {
    ...(packet.validation || {}),
    magicValidated: true,
    multipleChoiceRemoved: true,
  };

  return packet;
}

function applyGenericValidation(packet, locale = "ko", engine = ENGINE_MODE.WORMHOLE) {
  if (!packet || !Array.isArray(packet.questions)) return packet;

  packet.questions = packet.questions.map((q, index) => {
    const explanation =
      trimExplanation(q.explanation, locale) || buildAutoExplanation(locale, engine, q, index + 1);

    return {
      ...q,
      explanation,
    };
  });

  return packet;
}

function applyEngineValidation(packet, engine, context = {}) {
  if (!packet || !Array.isArray(packet.questions)) return packet;

  if (engine === ENGINE_MODE.WORMHOLE) {
    return applyWormholeValidation(packet, context);
  }

  if (engine === ENGINE_MODE.MAGIC) {
    return applyMagicValidation(packet, context.locale || "ko");
  }

  return applyGenericValidation(packet, context.locale || "ko", engine);
}

function padQuestionsToRequestedCount(packet, requestedCount, locale = "en", engine = ENGINE_MODE.WORMHOLE) {
  const current = ensureArray(packet.questions);
  if (!requestedCount || current.length >= requestedCount) {
    packet.questions = current.slice(0, requestedCount || current.length);
    return packet;
  }

  const padded = [...current];
  while (padded.length < requestedCount) {
    const n = padded.length + 1;

    if (engine === ENGINE_MODE.MAGIC) {
      padded.push({
        number: n,
        stem:
          locale === "ko"
            ? `보정 영작 문항 ${n}: 다음 문장을 영어로 쓰세요.`
            : locale === "ja"
            ? `補正文 ${n}: 次の文を英語で書きなさい。`
            : `Recovery writing item ${n}: Write the sentence in English.`,
        answer: `Sample answer ${n}`,
        explanation: buildAutoExplanation(locale, engine, {}, n),
        difficulty: "normal",
      });
    } else {
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
        explanation: buildAutoExplanation(locale, engine, {}, n),
        difficulty: "normal",
      });
    }
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
    .map((q, index) => sanitizeQuestionShape(q, index, context.locale || "en", engine))
    .map((q) => (engine === ENGINE_MODE.MAGIC ? q : repairAnswer(q, context.locale || "en")))
    .filter((q) => q.stem);

  if (!parsed.questions.length) {
    throw new Error("Invalid packet: no questions returned");
  }

  parsed = ensureExplanation(parsed, context.locale || "ko", engine);

  parsed = applyEngineValidation(parsed, engine, {
    worksheetTitle: context.worksheetTitle || parsed.mainTitle,
    originalPrompt: context.originalUserPrompt || "",
    locale: context.locale || "ko",
  });

  if (!parsed.questions.length) {
    parsed = createEngineFallbackPacket(
      context.worksheetTitle || parsed.mainTitle,
      context.locale || "ko",
      engine,
      requestedCount
    );
  }

  parsed = padQuestionsToRequestedCount(parsed, requestedCount, context.locale || "en", engine);
  parsed = ensureExplanation(parsed, context.locale || "ko", engine);
  parsed.questions = renumberQuestions(parsed.questions);

  return parsed;
}

function getOptionMarks(length = 5) {
  const marks = ["①", "②", "③", "④", "⑤", "⑥"];
  return marks.slice(0, Math.max(0, Math.min(length, 6)));
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
      const marks = getOptionMarks(q.options.length);
      q.options.forEach((o, i) => {
        const mark = marks[i] || `${i + 1}.`;
        lines.push(`${mark} ${o}`);
      });
    }

    lines.push("");
  });

  lines.push("ANSWER KEY");
  lines.push("");

  packet.questions.forEach((q) => {
    lines.push(`${q.number}) ${trimDifficultyTagFromAnswer(q.answer)}`);
    if (q.explanation) {
      lines.push(`→ ${q.explanation}`);
    }
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
      packet = createEngineFallbackPacket(
        body.worksheetTitle || "MARCUSNOTE WORKSHEET",
        locale,
        engine,
        requestedItemCount
      );
      packet = padQuestionsToRequestedCount(packet, requestedItemCount, locale, engine);
      packet = ensureExplanation(packet, locale, engine);
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
      requestedMode: engineResolution.requestedMode,
      model: OPENAI_MODEL,
      validation: packet.validation || null,
      requestedItemCount,
      compactExplanation: shouldUseCompactExplanation(engine, requestedItemCount),
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
