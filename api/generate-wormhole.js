// api/generate-wormhole.js

const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
const DEFAULT_TRIAL_MP = Number(process.env.MEMBERSTACK_TRIAL_MP || 15);

// --- 핵심 데이터: TEXTBOOK_GRAMMAR_MAP ---
const TEXTBOOK_GRAMMAR_MAP = {};


function json(res, status, payload) {
  return res.status(status).json(payload);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSelectedGrade(value = "") {
  const grade = String(value || "")
    .replace(/\.json$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return /^(middle|high|elementary)\d+$/.test(grade) ? grade : "auto";
}

function inferSelectedGradeFromText(text = "") {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const middle = "\\uC911";
  const high = "\\uACE0";
  if (new RegExp(`\\bmiddle\\s*1\\b|\\bmiddle1\\b|${middle}\\s*1|${middle}1|\\uC911\\uD559\\uAD50\\s*1`).test(normalized)) return "middle1";
  if (new RegExp(`\\bmiddle\\s*2\\b|\\bmiddle2\\b|${middle}\\s*2|${middle}2|\\uC911\\uD559\\uAD50\\s*2`).test(normalized)) return "middle2";
  if (new RegExp(`\\bmiddle\\s*3\\b|\\bmiddle3\\b|${middle}\\s*3|${middle}3|\\uC911\\uD559\\uAD50\\s*3`).test(normalized)) return "middle3";
  if (new RegExp(`\\bhigh\\s*1\\b|\\bhigh1\\b|${high}\\s*1|${high}1|\\uACE0\\uB4F1\\uD559\\uAD50\\s*1`).test(normalized)) return "high1";
  if (new RegExp(`\\bhigh\\s*2\\b|\\bhigh2\\b|${high}\\s*2|${high}2|\\uACE0\\uB4F1\\uD559\\uAD50\\s*2`).test(normalized)) return "high2";
  if (new RegExp(`\\bhigh\\s*3\\b|\\bhigh3\\b|${high}\\s*3|${high}3|\\uACE0\\uB4F1\\uD559\\uAD50\\s*3`).test(normalized)) return "high3";
  return "auto";
}


function selectedGradeLabel(value = "") {
  const grade = normalizeSelectedGrade(value);
  const labels = { middle1: "중1", middle2: "중2", middle3: "중3", high1: "고1", high2: "고2", high3: "고3" };
  return labels[grade] || "";
}

function sanitizeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function sanitizeCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 25;
  return clamp(Math.round(num), 5, 30);
}

function sanitizeMp(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 0, 999999);
}

function inferLanguage(text = "") {
  const t = String(text || "");
  const koreanMatches = t.match(/[\u3131-\u318E\uAC00-\uD7A3]/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();
  if (/elementary|초s*[1-6]|초등/.test(t)) return "elementary";
  if (/high|고s*[1-3]|고등|수능|모의고사/.test(t)) return "high";
  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/advanced|extreme|고난도|최고난도|극상/.test(t)) return "advanced";
  if (/transform|rewrite|영작|서술형/.test(t)) return "transform";
  if (/school|내신|시험|중간고사|기말고사/.test(t)) return "school-exam";
  return "grammar";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도/.test(t)) return "high";
  if (/basic|기초|쉬운/.test(t)) return "basic";
  if (/standard|보통|표준/.test(t)) return "standard";
  return "high";
}

function inferTopic(text = "") {
  const t = String(text || "");
  const lower = t.toLowerCase();
  if (/수여\s*동사|ditransitive|4\s*형식/.test(lower + " " + t)) return "ditransitive";
  if (/after[_s,/-]*before|before[_s,/-]*after/.test(lower) || (/after/.test(lower) && /before/.test(lower))) return "after_before";
  if (/when/.test(lower) && /while/.test(lower)) return "while_when";
  if (/although|though|evens+though/.test(lower)) return "although";
  if (/because/.test(lower)) return "because";
  if (/ass*[~-]?s*as|원급비교/.test(lower + " " + t)) return "as_as";
  if (/접속사s*as|ass*접속사/.test(t)) return "as_conjunction";
  if (/비교급s*강조|comparatives+emphasis/.test(lower + " " + t)) return "comparative_emphasis";
  if (/thes*비교급s*thes*비교급|thes+comparative/.test(lower + " " + t)) return "the_comparative";
  if (/최상급|superlative/.test(lower + " " + t)) return "superlative";
  if (/비교급|comparative/.test(lower + " " + t)) return "comparative";
  if (/사역s*동사|사역동사|causative/.test(lower + " " + t)) return "causative_verbs";
  if (/toos*~?s*to|enoughs+to/.test(lower)) return "too_to_enough_to";
  if (/its*~?s*to|가주어|진주어/.test(lower + " " + t)) return "it_to";
  if (/tos*부정사|to부정사|infinitive/.test(lower + " " + t)) return "to_infinitive";
  return "grammar";
}

function inferGradeLabel(text = "", level = "middle") {
  const t = String(text || "");
  if (/초s*1/.test(t)) return "초1";
  if (/초s*2/.test(t)) return "초2";
  if (/초s*3/.test(t)) return "초3";
  if (/초s*4/.test(t)) return "초4";
  if (/초s*5/.test(t)) return "초5";
  if (/초s*6/.test(t)) return "초6";
  if (/중s*1/.test(t)) return "중1";
  if (/중s*2/.test(t)) return "중2";
  if (/중s*3/.test(t)) return "중3";
  if (/고s*1/.test(t)) return "고1";
  if (/고s*2/.test(t)) return "고2";
  if (/고s*3/.test(t)) return "고3";
  if (level === "elementary") return "초등";
  if (level === "high") return "고등";
  return "중등";
}

function normalizeGrammarLabel(label = "") {
  return String(label || "").trim();
}

function normalizePublisherName(text = "") {
  const t = String(text || "").replace(/s+/g, "");
  const known = ["천재", "비상", "미래엔", "동아", "YBM", "지학사", "능률", "금성"];
  return known.find((name) => t.includes(name)) || "";
}

function detectTextbookRequest(text = "") {
  const source = String(text || "");
  const compact = source.replace(/s+/g, "");
  const gradeMatch = compact.match(/중([123])/);
  const lessonMatch = compact.match(/([1-9]|10)(?:과|단원)/i) || source.match(/lessons*([1-9]|10)/i);
  const publisher = normalizePublisherName(source);
  if (!gradeMatch || !lessonMatch || !publisher) return null;
  return {
    level: "middle",
    gradeLabel: `중${gradeMatch[1]}`,
    publisher,
    lesson: Number(lessonMatch[1])
  };
}

function resolveTextbookGrammar(textbookInfo) {
  return null;
}

function normalizeInput(body = {}) {
  const userPrompt = sanitizeString(body.userPrompt || body.prompt || "");
  const mergedText = [
    userPrompt,
    sanitizeString(body.topic || ""),
    sanitizeString(body.mode || ""),
    sanitizeString(body.level || ""),
    sanitizeString(body.difficulty || ""),
    sanitizeString(body.examType || ""),
    sanitizeString(body.worksheetTitle || ""),
    sanitizeString(body.requestedChapter || ""),
    sanitizeString(body.chapter || ""),
    sanitizeString(body.chapterKey || ""),
    sanitizeString(body.canonical || "")
  ].filter(Boolean).join(" ");
  const textbookRequest = detectTextbookRequest(mergedText);
  const textbookResolved = resolveTextbookGrammar(textbookRequest);

  const level = ["elementary", "middle", "high"].includes(body.level)
    ? body.level
    : (textbookResolved?.level || inferLevel(mergedText));

  let mode = ["grammar", "transform", "school-exam", "advanced", "textbook-chapter"].includes(body.mode)
    ? body.mode
    : (textbookResolved ? "textbook-chapter" : inferMode(mergedText));
  let difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);
  const grammarIntensiveRequested = /실전\s*모의고사|고난도|grammar\s*intensive/i.test(mergedText);
  if (grammarIntensiveRequested) {
    mode = "advanced";
    if (difficulty !== "extreme") difficulty = "high";
  }
  console.info("[WORMHOLE_MODE_RESOLUTION]", {
    requestedMode: body.mode || "",
    requestedDifficulty: body.difficulty || "",
    grammarIntensiveRequested,
    resolvedMode: mode,
    resolvedDifficulty: difficulty,
    planner: grammarIntensiveRequested ? "family-or-high-difficulty" : "standard"
  });
  const language = ["ko", "en"].includes(body.language)
    ? body.language
    : inferLanguage(mergedText);
  const topic =
    sanitizeString(body.topic || "") ||
    textbookResolved?.combinedTopic ||
    inferTopic(mergedText);
  const examType =
    sanitizeString(body.examType || "") ||
    (textbookResolved ? "textbook-school" : "school");
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const engine = "wormhole";
  const selectedGrade =
    normalizeSelectedGrade(body.selectedGrade || body.rawBody?.selectedGrade || "auto") !== "auto"
      ? normalizeSelectedGrade(body.selectedGrade || body.rawBody?.selectedGrade || "auto")
      : inferSelectedGradeFromText(mergedText);
  console.info("[GRADE_LOCK_TEST]", {
    mergedText,
    explicitSelectedGrade: body.selectedGrade || body.rawBody?.selectedGrade || "auto",
    inferred: inferSelectedGradeFromText(mergedText),
    selectedGrade
  });
  const gradeLabel = selectedGradeLabel(selectedGrade) || textbookResolved?.gradeLabel || inferGradeLabel(mergedText, level);

  return {
    engine,
    level,
    mode,
    topic,
    examType,
    difficulty,
    count,
    language,
    worksheetTitle,
    academyName,
    userPrompt,
    gradeLabel,
    selectedGrade,
    requestedChapter: sanitizeString(body.requestedChapter || body.chapter || body.chapterKey || body.canonical || ""),
    rawBody: body,
    textbook: textbookResolved || null
  };
}

function getDifficultyLabel(difficulty, language = "ko") {
  if (language === "en") {
    if (difficulty === "extreme") return "Extreme Difficulty";
    if (difficulty === "high") return "High Difficulty";
    if (difficulty === "standard") return "Standard Difficulty";
    return "Basic Difficulty";
  }
  if (difficulty === "extreme") return "최고난도";
  if (difficulty === "high") return "고난도";
  if (difficulty === "standard") return "표준 난도";
  return "기본 난도";
}

function shortenTopicForTitle(topic = "") {
  const parts = String(topic).split("+").map(v => v.trim()).filter(Boolean);
  if (parts.length <= 2) return topic;
  return `${parts[0]} + ${parts[1]} 외`;
}

function buildGrammarSystemPrompt(input) {
  const isHigh = input.difficulty === "high" || input.difficulty === "extreme";
  return [
    "You are the MARCUS Wormhole DB-first grammar worksheet generator.",
    "Return a polished 5-option multiple-choice grammar worksheet.",
    "Separate questions and answers clearly.",
    "Do not create subjective, rewrite, or sentence-arrangement items.",
    isHigh ? "Use high-discrimination grammar traps suitable for advanced middle-school practice." : "Keep the requested difficulty.",
    "If DB-first assembly is available, direct DB assembly must be preferred over GPT generation."
  ].join("\n");
}

function buildGrammarUserPrompt(input) {
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const displayTopic = shortenTopicForTitle(input.topic);
  const title = input.language === "en"
    ? input.gradeLabel + " " + displayTopic + " Wormhole " + difficultyLabel
    : input.gradeLabel + " " + displayTopic + " 웜홀 " + difficultyLabel;
  return [
    "Title: " + title,
    "Engine: wormhole",
    "Level: " + input.level,
    "Grade label: " + input.gradeLabel,
    "Mode: " + input.mode,
    "Topic: " + input.topic,
    "Difficulty: " + input.difficulty,
    "Question count: " + input.count,
    "Original request: " + (input.userPrompt || ""),
    "Requirements:",
    "- Generate exactly the requested number of questions.",
    "- Each question must have exactly five choices.",
    "- Keep answers only in the answer section.",
    "- Use realistic human/social context and plausible grammar traps."
  ].join("\n");
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const timeoutMs = 18000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  console.info("[WORMHOLE_FUNCTION_START]", { functionName: "callOpenAI", timeoutMs });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.5, max_tokens: 8000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
    const data = await response.json();
    console.info("[WORMHOLE_FUNCTION_END]", { functionName: "callOpenAI", ms: Date.now() - startedAt });
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error(timedOut ? "[WORMHOLE_TIMEOUT_FUNCTION]" : "[WORMHOLE_FUNCTION_ERROR]", {
      functionName: "callOpenAI",
      ms: Date.now() - startedAt,
      timeoutMs,
      error: error?.message || String(error)
    });
    if (timedOut) {
      const timeoutError = new Error("OpenAI fallback timed out before the Vercel function limit.");
      timeoutError.code = "WORMHOLE_OPENAI_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================
   Wormhole Output Stabilizer (문장 복원 및 출력 안정화)
   ========================= */

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSection(text = "", startMarker = "", endMarker = null) {
  const source = String(text || "");
  const start = startMarker ? source.indexOf(startMarker) : 0;
  if (start < 0) return "";

  const from = startMarker ? start + startMarker.length : 0;
  const sliced = source.slice(from);

  if (!endMarker) return cleanupText(sliced);

  const end = sliced.indexOf(endMarker);
  if (end < 0) return cleanupText(sliced);

  return cleanupText(sliced.slice(0, end));
}

function countQuestions(text = "") {
  return String(text || "")
    .split(/\n(?=\d+\.\s)/g)
    .map(s => s.trim())
    .filter(s => /^\d+\.\s/.test(s)).length;
}

function extractQuestionBlocks(text = "") {
  const source = cleanupText(text);
  if (!source) return [];
  return source
    .split(/\n(?=\d+\.\s)/g)
    .map(block => cleanupText(block))
    .filter(block => /^\d+\.\s/.test(block));
}

function renumberBlocks(blocks = [], startNumber = 1) {
  return blocks.map((block, index) => {
    const newNo = startNumber + index;
    return cleanupText(String(block).replace(/^\d+\.\s*/, `${newNo}. `));
  });
}

function extractAnswerBlocks(answerText = "") {
  const source = cleanupText(answerText);
  if (!source) return [];
  return source
    .split(/\n(?=\d+\)\s)/g)
    .map(block => cleanupText(block))
    .filter(block => /^\d+\)\s/.test(block));
}

function renumberAnswerBlocks(blocks = [], startNumber = 1) {
  return blocks.map((block, index) => {
    const newNo = startNumber + index;
    return cleanupText(String(block).replace(/^\d+\)\s*/, `${newNo}) `));
  });
}

function normalizeQuestionLine(line = "") {
  return String(line || "")
    .replace(/^\s*문제\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\s*(\d+)\)\s*/, "$1. ")
    .replace(/^\s*(\d+)\s*-\s*/, "$1. ")
    .trim();
}

function ensureFiveChoicesPerQuestion(questions = "") {
  const source = String(questions || "").replace(/\r\n/g, "\n");
  const blocks = source
    .split(/\n(?=\d+\.\s)/g)
    .map(s => s.trim())
    .filter(Boolean);

  const fixed = blocks.map((block) => {
    const lines = block.split("\n");
    const stem = [];
    const choices = [];

    for (const line of lines) {
      if (/^\s*(?:[①②③④⑤]|\(?[1-5]\)|[A-Ea-e][.)])\s+/.test(line)) {
        choices.push(line.trim());
      } else {
        stem.push(line.trim());
      }
    }

    const normalizedChoices = choices
      .map((choice, idx) => choice.replace(/^\s*(?:[①②③④⑤]|\(?[1-5]\)|[A-Ea-e][.)])\s+/, `${["①", "②", "③", "④", "⑤"][idx]} `))
      .slice(0, 5);

    return [...stem, ...normalizedChoices].join("\n");
  });

  return cleanupText(fixed.join("\n\n"));
}

function buildWormholeTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;
  const gradeLabel = input.gradeLabel || "중등";
  const topic = input.topic || "문법";
  const difficultyLabel =
    input.difficulty === "extreme" ? "최고난도" :
    input.difficulty === "high" ? "고난도" :
    input.difficulty === "basic" ? "기초" : "표준";

  return `${gradeLabel} ${topic} - ${difficultyLabel} 실전모의고사 1회`;
}

function buildWormholeInstructions(input) {
  if (input.language === "en") {
    return `Choose the best answer for each question.`;
  }
  return `다음 각 문항에서 가장 알맞은 답을 고르시오.`;
}

function normalizeWormholeAnswers(answerText = "") {
  const source = cleanupText(answerText);
  if (!source) return "";

  const lines = source.split("\n").map(s => s.trim()).filter(Boolean);
  const normalized = lines.map((line) => {
    let v = line
      .replace(/^문제\s*(\d+)\s*[:.)-]?\s*/i, "$1) ")
      .replace(/^(\d+)\.\s*/, "$1) ")
      .trim();
    if (/^\d+\)\s*[①②③④⑤]/.test(v)) return v;
    if (/^\d+\)\s*\d/.test(v)) {
      return v.replace(/^(\d+\))\s*([1-5])/, (_, a, b) => {
        const map = { "1": "①", "2": "②", "3": "③", "4": "④", "5": "⑤" };
        return `${a} ${map[b]}`;
      });
    }

    return v;
  });

  return cleanupText(normalized.join("\n"));
}

function formatWormholeResponse(rawText, input) {
  const normalizedRaw = cleanupText(rawText);

  let title = extractSection(normalizedRaw, "[[TITLE]]", "[[INSTRUCTIONS]]");
  let instructions = extractSection(normalizedRaw, "[[INSTRUCTIONS]]", "[[QUESTIONS]]");
  let questions = extractSection(normalizedRaw, "[[QUESTIONS]]", "[[ANSWERS]]");
  let answers = extractSection(normalizedRaw, "[[ANSWERS]]", null);
  if (!questions) {
    const firstQuestionIndex = normalizedRaw.search(/^\s*(?:문제\s*1|1\.|1\))/m);
    if (firstQuestionIndex >= 0) {
      const beforeQuestions = cleanupText(normalizedRaw.slice(0, firstQuestionIndex));
      const afterQuestions = cleanupText(normalizedRaw.slice(firstQuestionIndex));
      if (!title) {
        const firstLine = beforeQuestions.split("\n").map(s => s.trim()).find(Boolean) || "";
        title = firstLine.replace(/^#+\s*/, "") || buildWormholeTitle(input);
      }

      if (!instructions) {
        const beforeLines = beforeQuestions
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => s !== title);
        instructions = cleanupText(beforeLines.join("\n")) || buildWormholeInstructions(input);
      }

      const answerStart = afterQuestions.search(/\n\s*(?:#{1,3}\s*)?(정답|해설|정답\s*및\s*해설|answers?)/i);
      if (answerStart >= 0) {
        questions = cleanupText(afterQuestions.slice(0, answerStart));
        answers = cleanupText(afterQuestions.slice(answerStart));
      } else {
        questions = afterQuestions;
      }
    }
  }

  title = cleanupText(title) || buildWormholeTitle(input);
  instructions = cleanupText(instructions) || buildWormholeInstructions(input);
  questions = ensureFiveChoicesPerQuestion(questions);
  answers = normalizeWormholeAnswers(
    cleanupText(
      String(answers || "")
        .replace(/^(정답\s*및\s*해설|정답|해설|answers?)\s*:?/i, "")
        .trim()
    )
  );
  const actualCount = countQuestions(questions);

  const content = cleanupText([title, instructions, questions].filter(Boolean).join("\n\n"));
  const answerSheet = cleanupText(answers);
  const fullText = cleanupText(
    [title, instructions, questions, "정답 및 해설", answerSheet]
      .filter(Boolean)
      .join("\n\n")
  );
  return {
    title,
    instructions,
    content,
    answerSheet,
    fullText,
    actualCount,
  };
}

async function mergeWormholeSupplement(formatted, supplement, input) {
  const originalQuestionText = cleanupText(
    String(formatted.content || "")
      .replace(formatted.title || "", "")
      .replace(formatted.instructions || "", "")
  );
  const supplementQuestionText = cleanupText(
    String(supplement.content || "")
      .replace(supplement.title || "", "")
      .replace(supplement.instructions || "", "")
  );
  const originalQuestionBlocks = extractQuestionBlocks(originalQuestionText);
  const supplementQuestionBlocks = extractQuestionBlocks(supplementQuestionText);

  const originalAnswerBlocks = extractAnswerBlocks(formatted.answerSheet || "");
  const supplementAnswerBlocks = extractAnswerBlocks(supplement.answerSheet || "");
  const mergedQuestionBlocks = [
    ...renumberBlocks(originalQuestionBlocks, 1),
    ...renumberBlocks(
      supplementQuestionBlocks,
      originalQuestionBlocks.length + 1
    ),
  ];
  const mergedAnswerBlocks = [
    ...renumberAnswerBlocks(originalAnswerBlocks, 1),
    ...renumberAnswerBlocks(
      supplementAnswerBlocks,
      originalAnswerBlocks.length + 1
    ),
  ];
  const mergedQuestionsText = ensureFiveChoicesPerQuestion(
    mergedQuestionBlocks.join("\n\n")
  );

  const mergedAnswersText = normalizeWormholeAnswers(
    mergedAnswerBlocks.join("\n")
  );
  return {
    ...formatted,
    content: cleanupText(
      [formatted.title, formatted.instructions, mergedQuestionsText]
        .filter(Boolean)
        .join("\n\n")
    ),
    answerSheet: cleanupText(mergedAnswersText),
    fullText: cleanupText(
      [
        formatted.title,
        formatted.instructions,
        mergedQuestionsText,
        "정답 및 해설",
        mergedAnswersText,
      ]
        .filter(Boolean)
        .join("\n\n")
    ),
    actualCount: countQuestions(mergedQuestionsText),
  };
}


/* =========================
   WORMHOLE_DB_FIRST_AUTO_REGISTRY
   Auto-scans data/middle1, data/middle2, data/middle3.
   DB match always wins over GPT fallback.
   ========================= */

let WORMHOLE_DB_REGISTRY_CACHE = globalThis.__wormholeRegistry || null;
const WORMHOLE_DB_FILE_CACHE = globalThis.__wormholeDbFileCache instanceof Map
  ? globalThis.__wormholeDbFileCache
  : (globalThis.__wormholeDbFileCache = new Map());
const WORMHOLE_REGISTRY_META = globalThis.__wormholeRegistryMeta || (globalThis.__wormholeRegistryMeta = {
  buildMs: 0,
  builtAt: 0,
  buildCount: 0,
  totalFiles: 0
});
const WORMHOLE_VERBOSE_REGISTRY_LOGS = process.env.WORMHOLE_VERBOSE_REGISTRY_LOGS === "1";

const WORMHOLE_GRADE_BUCKETS = ["middle1", "middle2", "middle3"];

const WORMHOLE_KO_ALIAS_BY_SLUG = {
  a_few_few: ["a few few", "a few와 few"],
  a_little_little: ["a little little", "a little과 little"],
  after_before: ["after before", "after와 before", "시간 접속사"],
  although: ["although", "though", "even though", "양보 접속사"],
  although_though_even_though: ["although", "though", "even though", "양보 접속사"],
  and: ["and", "접속사 and"],
  as_as: ["as as", "원급비교"],
  as_conjunction: ["as conjunction", "접속사 as"],
  be_negative: ["be negative", "be동사 부정문"],
  be_question: ["be question", "be동사 의문문"],
  be_verb: ["be verb", "be동사"],
  because: ["because", "because of", "이유 접속사"],
  because_because_of: ["because", "because of", "because와 because of"],
  but: ["but", "접속사 but"],
  can: ["can", "조동사 can"],
  causative: ["causative", "사역동사"],
  causative_verbs: ["causative verbs", "사역동사"],
  cleft_it_that: ["cleft it that", "it that 강조구문", "강조구문"],
  comparative: ["comparative", "비교급"],
  comparatives: ["comparatives", "비교급"],
  comparative_emphasis: ["comparative emphasis", "비교급 강조"],
  comparative_emphasis_adverbs: ["comparative emphasis", "비교급 강조", "비교급 강조 부사"],
  conjunction_that: ["conjunction that", "접속사 that"],
  conjunction_when: ["conjunction when", "접속사 when"],
  conjunction_while: ["conjunction while", "접속사 while"],
  continuative_relative_clauses: ["continuative relative clauses", "계속적 용법", "관계대명사의 계속적 용법"],
  ditransitive: ["ditransitive", "수여동사", "4형식"],
  do_emphasis: ["do emphasis", "강조의 do", "do 강조"],
  do_negative: ["do negative", "일반동사 부정문"],
  do_question: ["do question", "일반동사 의문문"],
  do_verb: ["do verb", "일반동사"],
  dont_have_to: ["dont have to", "don't have to", "do not have to", "할 필요가 없다"],
  exclamation: ["exclamation", "감탄문"],
  five_form: ["five form", "5형식"],
  frequency_adverbs: ["frequency adverbs", "빈도부사", "빈도 부사"],
  gerund: ["gerund", "동명사"],
  gerund_idiomatic_expressions: ["gerund idiomatic expressions", "동명사 관용표현"],
  gerund_object: ["gerund object", "동명사 목적어"],
  gerund_total: ["gerund total", "동명사 종합", "동명사"],
  had_better: ["had better", "had better not", "하는 것이 좋겠다"],
  have_object_pp: ["have object pp", "have 목적어 pp", "have 목적어 p.p."],
  have_to: ["have to", "해야 한다"],
  have_to_must: ["have to must", "have to", "must", "의무 표현"],
  here_there_inversion: ["here there inversion", "here there 도치"],
  however_therefore: ["however therefore", "however와 therefore"],
  if_condition: ["if condition", "조건의 if", "if 조건문"],
  if_whether: ["if whether", "if와 whether"],
  imperatives: ["imperatives", "명령문", "청유문"],
  indefinite_pronouns: ["indefinite pronouns", "부정대명사"],
  indirect_question: ["indirect question", "간접의문문", "간접 의문문"],
  inversion_so_neither: ["inversion so neither", "so neither 도치"],
  it_object_infinitive: ["it object infinitive", "가목적어 it"],
  it_seems_that: ["it seems that", "it seems that 구문"],
  it_that_expletive_subject: ["it that expletive subject", "가주어 it that"],
  it_to: ["it to", "가주어 진주어", "it to 가주어"],
  it_to_infinitive_subject: ["it to infinitive subject", "가주어 it to부정사"],
  its_time_subjunctive: ["its time subjunctive", "it's time 가정법"],
  many_much: ["many much", "many와 much"],
  may: ["may", "조동사 may"],
  modal_extended: ["modal extended", "조동사 확장"],
  modal_have_pp: ["modal have pp", "조동사 have pp", "조동사 have p.p."],
  modal_passive: ["modal passive", "조동사의 수동태"],
  must: ["must", "조동사 must"],
  not_only_but_also: ["not only but also", "상관접속사 not only but also"],
  not_to_infinitive: ["not to infinitive", "not to부정사"],
  object_complement_5th_form: ["object complement", "5형식 목적격보어"],
  object_complement_adj: ["object complement adj", "목적격보어 형용사"],
  objective_relative_pronouns: ["objective relative pronouns", "목적격 관계대명사"],
  participial_construction: ["participial construction", "분사구문"],
  participles: ["participles", "분사"],
  participles_attributive: ["participles attributive", "분사의 한정적 용법"],
  passive: ["passive", "passive voice", "수동태"],
  passive_advanced: ["passive advanced", "수동태 심화"],
  past: ["past tense", "과거시제"],
  past_perfect: ["past perfect", "과거완료"],
  perception_verb: ["perception verb", "지각동사"],
  perception_verbs: ["perception verbs", "지각동사"],
  perceptual_verbs: ["perceptual verbs", "지각동사"],
  possessive_relative_pronouns: ["possessive relative pronouns", "소유격 관계대명사"],
  prepositions_basic: ["prepositions basic", "전치사 기초"],
  present_continuous: ["present continuous", "현재진행형"],
  present_perfect: ["present perfect", "현재완료", "현재 완료"],
  present_perfect_progressive: ["present perfect progressive", "현재완료진행"],
  quantity_adjectives: ["quantity adjectives", "수량형용사"],
  quantity_agreement: ["quantity agreement", "수일치", "수량 일치"],
  quantifiers: ["quantifiers", "수량표현"],
  quasi_causative: ["quasi causative", "준사역동사"],
  quasi_causative_verbs: ["quasi causative verbs", "준사역동사"],
  reflexive_pronoun: ["reflexive pronoun", "재귀대명사"],
  reflexive_pronouns: ["reflexive pronouns", "재귀대명사"],
  relative_adverbs: ["relative adverbs", "관계부사"],
  relative_pronoun_what: ["relative pronoun what", "관계대명사 what"],
  reported_speech: ["reported speech", "간접화법", "화법 전환"],
  semi_causative: ["semi causative", "준사역동사"],
  sensory_verb: ["sensory verb", "감각동사"],
  should: ["should", "조동사 should"],
  should_have_pp: ["should have pp", "should have p.p.", "했어야 했다"],
  since: ["since", "since 이유 시간"],
  so: ["so", "접속사 so"],
  so_that: ["so that", "so that 구문"],
  so_that_purpose: ["so that purpose", "목적의 so that"],
  so_that_purpose_advanced: ["so that purpose advanced", "목적의 so that 심화"],
  something_adjective: ["something adjective", "something 형용사"],
  subject_relative_pronouns: ["subject relative pronouns", "주격 관계대명사"],
  subjunctive_past: ["subjunctive past", "가정법 과거"],
  subjunctive_past_perfect: ["subjunctive past perfect", "가정법 과거완료"],
  superlative: ["superlative", "최상급"],
  superlatives: ["superlatives", "최상급"],
  sva_of_structure: ["sva of structure", "of 구조 수 일치"],
  tag_questions: ["tag questions", "부가의문문"],
  tense_agreement: ["tense agreement", "시제 일치"],
  that: ["that", "that절"],
  that_clause_statement: ["that clause statement", "that 명사절"],
  that_clause_subjunctive: ["that clause subjunctive", "that절 가정법"],
  the_comparative_the_comparative: ["the comparative the comparative", "the 비교급 the 비교급", "비교급 병렬구문"],
  there_is_are: ["there is are", "there is are 문법"],
  time_conjunctions: ["time conjunctions", "시간 접속사"],
  to_infinitive_adjective: [
    "to infinitive adjective",
    "to부정사 형용사적 용법",
    "to부정사의 형용사적 용법",
    "to부정사 형용사 용법",
    "to부정사의 형용사 용법",
    "형용사적 용법",
    "형용사 용법"
  ],
  to_infinitive_adverbial: ["to infinitive adverbial", "to부정사 부사적 용법", "부사적 용법"],
  to_infinitive_gerund_verbs: ["to infinitive gerund verbs", "to부정사 동명사 목적어 동사"],
  to_infinitive_noun: ["to infinitive noun", "to부정사 명사적 용법", "명사적 용법"],
  to_infinitive_noun_adjective: ["to infinitive noun adjective", "to부정사 명사 형용사"],
  to_infinitive_noun_adjective_quality_fix: ["to infinitive noun adjective", "to부정사 명사 형용사"],
  to_infinitive_total: ["to infinitive total", "to부정사 종합"],
  too_enough_to: ["too enough to", "too to enough to", "too ~ to", "enough to"],
  too_to_enough_to: ["too to enough to", "too ~ to", "enough to"],
  total_vs_partial_negation: ["total vs partial negation", "전체부정 부분부정", "부분부정"],
  used_to: ["used to", "used to 용법"],
  wh_question: ["wh question", "의문사 의문문"],
  wh_questions: ["wh questions", "의문사 의문문"],
  wh_to_infinitive: ["wh to infinitive", "의문사 to부정사"],
  while_when: ["while when", "when while", "접속사 when while"],
  will: ["will", "조동사 will", "미래 will"],
  wish_subjunctive: ["wish subjunctive", "wish 가정법"],
  with_noun_phrase_be: ["with noun phrase be", "with 명사구 be"],
  with_noun_phrase_have: ["with noun phrase have", "with 명사구 have"],
  with_object_participle: ["with object participle", "with 목적어 분사"]
};

function normalizeWormholeDbFirstText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[，、]/g, ",")
    .replace(/[’']/g, "")
    .replace(/\bas\s*[~〜～]\s*as\b/g, "as as")
    .replace(/\bas\s*[-/]\s*as\b/g, "as as")
    .replace(/[~〜～]+/g, " ")
    .replace(/[\\/_-]+/g, " ")
    .replace(/[()[\]{}"“”‘’.,;:!?|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactWormholeAliasKey(value = "") {
  return normalizeWormholeDbFirstText(value).replace(/\s+/g, "");
}

function addWormholeAliasKey(set, value = "") {
  const normalized = normalizeWormholeDbFirstText(value);
  if (!normalized) return;
  set.add(normalized);
  set.add(normalized.replace(/\s+/g, "_"));
  const compact = normalized.replace(/\s+/g, "");
  if (compact) set.add(compact);
}

function flattenWormholeAliases(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenWormholeAliases(item, out));
    return out;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => flattenWormholeAliases(item, out));
    return out;
  }
  out.push(String(value));
  return out;
}

function getWormholeRequestedText(input = {}) {
  return [
    input.topic,
    input.userPrompt,
    input.worksheetTitle,
    input.requestedChapter,
    input.rawBody?.requestedChapter,
    input.rawBody?.chapter,
    input.rawBody?.chapterKey,
    input.rawBody?.canonical,
    input.rawBody?.topic,
    input.rawBody?.worksheetTitle,
    input.rawBody?.selectedGrade
  ].filter(Boolean).join(" | ");
}

function inferWormholeRegistryGrade(input = {}, requested = "") {
  const selected = normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto");
  if (WORMHOLE_GRADE_BUCKETS.includes(selected)) return selected;
  const source = String(requested || "").normalize("NFKC").toLowerCase();
  if (/\bmiddle\s*1\b|\bmiddle1\b|중\s*1|중1|중학교\s*1/.test(source)) return "middle1";
  if (/\bmiddle\s*2\b|\bmiddle2\b|중\s*2|중2|중학교\s*2/.test(source)) return "middle2";
  if (/\bmiddle\s*3\b|\bmiddle3\b|중\s*3|중3|중학교\s*3/.test(source)) return "middle3";
  return "auto";
}

function getWormholeSlugParts(fileName = "", grade = "") {
  const stem = String(fileName || "").replace(/\.json$/i, "");
  const noGrade = stem.replace(new RegExp("^" + grade + "[_\\s-]*", "i"), "");
  const phrase = noGrade.replace(/[_-]+/g, " ");
  return { stem, noGrade, phrase };
}

function buildWormholeFileAliases(fileName = "", grade = "", meta = {}) {
  const aliases = new Set();
  const { stem, noGrade, phrase } = getWormholeSlugParts(fileName, grade);
  [
    stem,
    noGrade,
    phrase,
    grade + " " + phrase,
    meta.canonical,
    meta.chapterKey,
    meta.grammar,
    meta.chapterLabelKo
  ].filter(Boolean).forEach((value) => addWormholeAliasKey(aliases, value));

  flattenWormholeAliases(meta.aliases).forEach((value) => addWormholeAliasKey(aliases, value));
  (WORMHOLE_KO_ALIAS_BY_SLUG[noGrade] || []).forEach((value) => {
    addWormholeAliasKey(aliases, value);
    addWormholeAliasKey(aliases, grade + " " + value);
    const gradeKo = grade === "middle1" ? "중1" : grade === "middle2" ? "중2" : grade === "middle3" ? "중3" : "";
    if (gradeKo) addWormholeAliasKey(aliases, gradeKo + " " + value);
  });

  return [...aliases].filter((alias) => alias.length >= 2);
}

function getWormholeAcceptedAlternatives(item = {}) {
  const correct = String(item.english || "").replace(/\s+/g, " ").trim();
  const raw = [
    item.acceptedAlternatives,
    item.validAlternatives,
    item.ambiguityAlternatives,
    item.distractorSeeds?.acceptedAlternatives,
    item.distractorSeeds?.validAlternatives
  ];
  const alternatives = [];
  function add(value) {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const normalized = text.replace(/[.?!]$/g, "").toLowerCase();
    const correctNormalized = correct.replace(/[.?!]$/g, "").toLowerCase();
    if (text && normalized !== correctNormalized && !alternatives.some((entry) => entry.replace(/[.?!]$/g, "").toLowerCase() === normalized)) {
      alternatives.push(text);
    }
  }
  raw.forEach(add);
  return alternatives;
}



function isToInfinitiveAdjectiveDbItem(item = {}) {
  const joined = [
    item.chapterKey,
    item.grammar,
    item.chapterMeta?.canonical,
    item.chapterMeta?.family,
    item.chapterMeta?.subtype
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return joined.includes("to_infinitive_adjective");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function extractToInfAdjectiveTargetPhrase(item = {}) {
  const correct = String(item.english || "").replace(/\s+/g, " ").trim();
  const blank = Array.isArray(item.blankTargets) && item.blankTargets.length
    ? String(item.blankTargets[0] || "").trim()
    : "";
  if (!correct || !blank) return "";
  const escapedBlank = escapeRegExp(blank);
  const pattern = new RegExp("\\b(?:a|an|the)\\s+(?:[A-Za-z'-]+\\s+){0,4}" + escapedBlank, "i");
  const match = correct.match(pattern);
  return match ? match[0] : blank;
}

function buildToInfAdjectiveSentenceCandidate(item = {}, candidate = "") {
  const correct = String(item.english || "").replace(/\s+/g, " ").trim();
  const raw = String(candidate || "").replace(/\s+/g, " ").trim();
  if (!correct || !raw || /_+/.test(raw)) return "";

  const cleanCandidate = raw.replace(/[.?!]+$/g, "").trim();
  if (!cleanCandidate) return "";

  const targetPhrase = extractToInfAdjectiveTargetPhrase(item);
  if (!targetPhrase) return cleanCandidate + ".";

  const targetIndex = correct.toLowerCase().indexOf(targetPhrase.toLowerCase());
  if (targetIndex < 0) return cleanCandidate + ".";

  const prefix = correct.slice(0, targetIndex);
  const suffix = correct.slice(targetIndex + targetPhrase.length);

  let rebuilt = cleanCandidate;

  if (!/^([A-Z][a-z]+\s+){1,6}(is|are|was|were|looks?|looked|finds?|found|needs?|needed|wanted|wants|has|have|had)\b/.test(cleanCandidate)) {
    rebuilt = prefix + cleanCandidate + suffix;
  }

  rebuilt = rebuilt.replace(/\s+/g, " ").trim();
  rebuilt = rebuilt.replace(/\s+([,.?!])/g, "$1");

  if (!/[.?!]$/.test(rebuilt)) rebuilt += ".";
  return rebuilt;
}

function isLikelyFiniteSentence(text = "") {
  const normalized = normalizeSentenceIdentity(text);
  return /\b(am|is|are|was|were|has|have|had|do|does|did|will|would|can|could|should|must|may|might|need|needs|needed|want|wants|wanted|look|looks|looked|find|finds|found|see|sees|saw|notice|notices|noticed|recommend|recommended|introduce|introduced|invite|invited|assign|assigned|receive|received|announce|announced|explain|explained|list|listed)\b/.test(normalized);
}

function isSemanticOnlyToInfAdjectiveDistractor(text = "") {
  const normalized = normalizeSentenceIdentity(text);
  if (!normalized) return false;
  if (/^(a|an|the)\s+/.test(normalized)) return false;
  if (/\bto\b/.test(normalized)) return false;
  if (/\b(who|which|that|whom)\b/.test(normalized)) return false;
  if (isLikelyFiniteSentence(normalized)) return false;
  return /^([a-z]+(?:\s+[a-z]+){0,3})$/.test(normalized);
}

function normalizeToInfAdjectiveWrongCandidate(item = {}, candidate = "") {
  const text = String(candidate || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  if (!isToInfinitiveAdjectiveDbItem(item)) return cleanDbOption(text);
  if (/^supportive friend\.?$/i.test(text)) return "";
  if (/\bto be sat on\b/i.test(text)) return "";
  if (isSemanticOnlyToInfAdjectiveDistractor(text)) return "";

  if (isLikelyFiniteSentence(text)) return cleanDbOption(text);

  const rebuilt = buildToInfAdjectiveSentenceCandidate(item, text);
  if (!rebuilt) return "";
  return cleanDbOption(rebuilt);
}

function isAwkwardToInfAdjectiveSource(item = {}) {
  if (!isToInfinitiveAdjectiveDbItem(item)) return false;
  const text = cleanDbOption(item.english).toLowerCase();
  return /\bannounced an announcement\b|\breceived a campaign\b|\bexplained a meeting\b/.test(text);
}

function getRawWormholeWrongCandidates(item = {}) {
  const correct = String(item.english || "").replace(/\s+/g, " ").trim();
  const accepted = getWormholeAcceptedAlternatives(item)
    .map((value) => value.replace(/[.?!]$/g, "").toLowerCase());
  const seeds = item.distractorSeeds || {};
  const out = [];

  function add(value) {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    const normalizedCandidate = normalizeToInfAdjectiveWrongCandidate(item, text);
    if (!normalizedCandidate) return;

    const normalized = normalizedCandidate.replace(/[.?!]$/g, "").toLowerCase();
    const correctNormalized = correct.replace(/[.?!]$/g, "").toLowerCase();

    if (
      normalized !== correctNormalized &&
      !accepted.includes(normalized) &&
      !out.some((entry) => entry.replace(/[.?!]$/g, "").toLowerCase() === normalized)
    ) {
      out.push(normalizedCandidate);
    }
  }

  add(seeds.wormholeVariants);
  add(seeds.auxError);
  add(seeds.statementForm);
  if (!isToInfinitiveAdjectiveDbItem(item)) add(seeds.fragmentForm);

  if (correct) {
    add(correct.replace(/\b(have|has|had)\s+/i, ""));
    add(correct.replace(/\bhave\b/i, "has"));
    add(correct.replace(/\bhas\b/i, "have"));
    add(correct.replace(/\bhad\b/i, "have"));
    add(correct.replace(/\b(before|already|ever|never|just|yet)\b/i, "yesterday"));
    add(correct.replace(/\bam\b/i, "is"));
    add(correct.replace(/\bis\b/i, "are"));
    add(correct.replace(/\bare\b/i, "is"));
    add(correct.replace(/\bwill\b/i, "would"));
    add(correct.replace(/\bcan\b/i, "could"));
    add(correct.replace(/\bshould\b/i, "must"));
  }

  return out;
}

function getWormholeDbUsability(items = []) {

  if (!Array.isArray(items)) return { usable: false, reason: "db_not_array", usableCount: 0 };
  const counters = { chapterMeta: 0, english: 0, wormholeVariants: 0, awkwardSource: 0 };
  const usableItems = [];
  for (const item of items) {
    const awkwardSource = isAwkwardToInfAdjectiveSource(item);
    if (!item?.chapterMeta) counters.chapterMeta += 1;
    if (typeof item?.english !== "string" || !item.english.trim()) counters.english += 1;
    if (awkwardSource) counters.awkwardSource += 1;
    if (!item?.distractorSeeds || getRawWormholeWrongCandidates(item).length < 4) {
      counters.wormholeVariants += 1;
    }
    if (
      item &&
      item.id &&
      typeof item.english === "string" &&
      item.english.trim() &&
      item.distractorSeeds &&
      getRawWormholeWrongCandidates(item).length >= 4 &&
      !awkwardSource
    ) {
      usableItems.push(item);
    }
  }
  if (!usableItems.length) {
    const reason = counters.wormholeVariants >= counters.english && counters.wormholeVariants >= counters.chapterMeta && counters.wormholeVariants >= counters.awkwardSource
      ? "wormhole_variants_insufficient"
      : counters.awkwardSource >= counters.chapterMeta && counters.awkwardSource >= counters.english
        ? "awkward_source_sentence"
        : counters.english >= counters.chapterMeta
          ? "missing_english"
          : "missing_chapter_meta";
    return { usable: false, reason, usableCount: 0, counters };
  }
  return { usable: true, reason: "ok", usableCount: usableItems.length, items: usableItems, counters };
}

function detectWormholeDbTier(items = [], meta = {}) {
  const haystack = JSON.stringify({
    version: meta.version,
    tier: meta.tier,
    sourceType: meta.sourceType,
    tags: meta.tags
  }).toLowerCase();
  const maxVariants = Array.isArray(items)
    ? items.reduce((max, item) => Math.max(max, Array.isArray(item?.distractorSeeds?.wormholeVariants) ? item.distractorSeeds.wormholeVariants.length : 0), 0)
    : 0;
  if (/\bv[34]\b|v3|v4|premium|upgraded|tier_a/.test(haystack) || maxVariants >= 5) return "A";
  return "B";
}

function findWormholeDataDirs() {
  const path = require("path");
  const fs = require("fs");
  const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const roots = [
    path.join(process.cwd(), "data"),
    path.join(currentDir, "..", "data"),
    path.join(process.cwd(), "data", "sentence_bank"),
    path.join(currentDir, "..", "data", "sentence_bank")
  ];
  const found = {};
  for (const grade of WORMHOLE_GRADE_BUCKETS) {
    found[grade] = [];
    const seen = new Set();
    for (const root of roots) {
      const dir = path.join(root, grade);
      const resolved = path.resolve(dir);
      if (!seen.has(resolved) && fs.existsSync(resolved)) {
        seen.add(resolved);
        found[grade].push(resolved);
      }
    }
  }
  return found;
}

function buildWormholeDbRegistry() {
  if (globalThis.__wormholeRegistry) {
    WORMHOLE_DB_REGISTRY_CACHE = globalThis.__wormholeRegistry;
    return WORMHOLE_DB_REGISTRY_CACHE;
  }

  const fs = require("fs");
  const path = require("path");
  const buildStart = Date.now();
  const dataDirs = findWormholeDataDirs();
  const registry = {
    entries: [],
    aliasMap: new Map(),
    counts: { middle1: 0, middle2: 0, middle3: 0 },
    tierCounts: { A: 0, B: 0 },
    aliasCount: 0
  };

  for (const grade of WORMHOLE_GRADE_BUCKETS) {
    const seenFiles = new Set();
    for (const dir of dataDirs[grade]) {
      const files = fs.readdirSync(dir)
        .filter((file) => /\.json$/i.test(file) && !/(?:^|[_\-.])backup(?:[_\-.]|$)/i.test(file))
        .sort();
      for (const file of files) {
        const filePath = path.join(dir, file);
        const resolvedFile = path.resolve(filePath);
        if (seenFiles.has(resolvedFile)) continue;
        seenFiles.add(resolvedFile);

        const { stem, noGrade } = getWormholeSlugParts(file, grade);
        const aliases = buildWormholeFileAliases(file, grade, {
          canonical: stem,
          chapterKey: noGrade,
          grammar: noGrade,
          chapterLabelKo: noGrade.replace(/[_-]+/g, " ")
        });

        const entry = {
          grade,
          file,
          filePath: resolvedFile,
          canonical: stem,
          slug: noGrade,
          aliases,
          tier: "A",
          usable: true,
          usableCount: 1,
          unusableReason: null
        };

        registry.entries.push(entry);
        registry.counts[grade] += 1;
        registry.tierCounts.A += 1;

        if (WORMHOLE_VERBOSE_REGISTRY_LOGS) {
          console.info("[WORMHOLE_ALIAS_REGISTER]", { file, aliasCount: aliases.length });
          console.info("[WORMHOLE_DB_TIER]", { file, tier: entry.tier });
        }

        for (const alias of aliases) {
          const keys = new Set([alias, normalizeWormholeDbFirstText(alias), compactWormholeAliasKey(alias)]);
          for (const key of keys) {
            if (!key) continue;
            if (!registry.aliasMap.has(key)) registry.aliasMap.set(key, []);
            registry.aliasMap.get(key).push(entry);
          }
        }
      }
    }
  }

  registry.aliasCount = registry.aliasMap.size;
  const totalFiles = registry.entries.length;
  const buildMs = Date.now() - buildStart;

  WORMHOLE_REGISTRY_META.buildMs = buildMs;
  WORMHOLE_REGISTRY_META.builtAt = Date.now();
  WORMHOLE_REGISTRY_META.buildCount = Number(WORMHOLE_REGISTRY_META.buildCount || 0) + 1;
  WORMHOLE_REGISTRY_META.totalFiles = totalFiles;

  console.log("[WORMHOLE_REGISTRY_BUILD]", {
    strategy: "lightweight_filename_registry",
    coldStart: true,
    buildMs,
    totalFiles,
    middle1: registry.counts.middle1,
    middle2: registry.counts.middle2,
    middle3: registry.counts.middle3
  });

  WORMHOLE_DB_REGISTRY_CACHE = registry;
  globalThis.__wormholeRegistry = registry;
  return registry;
}

function sortWormholeRegistryCandidates(candidates = [], selectedGrade = "auto") {
  const unique = [];
  const seen = new Set();
  for (const item of candidates) {
    const entry = item.entry || item;
    if (!entry || seen.has(entry.filePath)) continue;
    seen.add(entry.filePath);
    unique.push({
      entry,
      alias: item.alias || "",
      score: Number(item.score || 0)
    });
  }
  return unique.sort((a, b) => {
    const gradeScoreB = selectedGrade !== "auto" && b.entry.grade === selectedGrade ? 10000 : 0;
    const gradeScoreA = selectedGrade !== "auto" && a.entry.grade === selectedGrade ? 10000 : 0;
    const tierScoreB = b.entry.tier === "A" ? 1000 : 0;
    const tierScoreA = a.entry.tier === "A" ? 1000 : 0;
    const usableScoreB = b.entry.usable ? 100 : 0;
    const usableScoreA = a.entry.usable ? 100 : 0;
    return (gradeScoreB + tierScoreB + usableScoreB + b.score) - (gradeScoreA + tierScoreA + usableScoreA + a.score);
  }).map((item) => item.entry);
}

function resolveWormholeDbFirstScope(input = {}) {
  const requested = getWormholeRequestedText(input);
  const normalized = normalizeWormholeDbFirstText(requested);
  const selectedGrade = inferWormholeRegistryGrade(input, requested);
  return { requested, normalized, canonical: null, selectedGrade };
}

async function resolveWormholeDbFile(input = {}, timing = null) {
  const registryStart = Date.now();
  const registry = buildWormholeDbRegistry();
  if (timing) timing.registryMs += Date.now() - registryStart;

  const resolveStart = Date.now();
  const scope = resolveWormholeDbFirstScope(input);
  const query = scope.normalized;
  const queryCompact = compactWormholeAliasKey(scope.requested);
  const candidateHits = [];

  const queryKeys = new Set([query, queryCompact]);
  String(scope.requested || "").split(/[|,]/).forEach((part) => {
    addWormholeAliasKey(queryKeys, part);
  });

  for (const key of queryKeys) {
    const entries = registry.aliasMap.get(key);
    if (!entries) continue;
    entries.forEach((entry) => candidateHits.push({ entry, alias: key, score: 5000 + key.length }));
  }

  for (const [alias, entries] of registry.aliasMap.entries()) {
    if (!alias || alias.length < 3) continue;
    const aliasCompact = alias.replace(/\s+/g, "");
    const spacedHit = query.includes(alias) && alias.length >= 4;
    const compactHit = aliasCompact.length >= 4 && queryCompact.includes(aliasCompact);
    if (!spacedHit && !compactHit) continue;
    entries.forEach((entry) => candidateHits.push({
      entry,
      alias,
      score: (spacedHit ? 2500 : 1500) + alias.length
    }));
  }

  let candidates = sortWormholeRegistryCandidates(candidateHits, scope.selectedGrade);
  if (scope.selectedGrade !== "auto") {
    candidates = candidates.filter((entry) => entry.grade === scope.selectedGrade);
  }

  const match = candidates[0] || null;
  const matchedAlias = match
    ? (candidateHits.find((hit) => hit.entry.filePath === match.filePath)?.alias || "")
    : "";

  if (match) {
    console.info("[WORMHOLE_DB_MATCH]", {
      query: scope.requested,
      alias: matchedAlias,
      file: match.file
    });
    console.info("[WORMHOLE_DB_FILE]", {
      canonical: match.canonical,
      selectedGrade: scope.selectedGrade,
      selectedDbFile: match.filePath,
      resolvedPath: match.filePath,
      tier: match.tier,
      usable: match.usable
    });
  } else {
    console.info("[WORMHOLE_FALLBACK]", {
      query: scope.requested,
      reason: "db_alias_not_found"
    });
  }

  if (timing) timing.chapterResolveMs += Date.now() - resolveStart;

  return {
    ...scope,
    registry,
    candidates,
    matched: Boolean(match),
    entry: match,
    filePath: match?.filePath || null
  };
}

async function loadGrammarDb(filePath, timing = null) {
  if (!filePath) return null;
  const loadStart = Date.now();

  if (WORMHOLE_DB_FILE_CACHE.has(filePath)) {
    const cachedItems = WORMHOLE_DB_FILE_CACHE.get(filePath);
    const elapsed = Date.now() - loadStart;
    if (timing) timing.dbLoadMs += elapsed;
    console.info("[DB_LOAD_TIME]", { ms: elapsed, filePath, rawBytes: 0, itemCount: Array.isArray(cachedItems) ? cachedItems.length : 0, cached: true });
    return cachedItems;
  }

  const fs = require("fs");
  console.info("[WORMHOLE_DB_FILE_READ]", { filePath, cwd: process.cwd() });
  const raw = fs.readFileSync(filePath, "utf8");
  const items = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const usability = getWormholeDbUsability(items);
  if (!usability.usable) {
    const elapsed = Date.now() - loadStart;
    if (timing) timing.dbLoadMs += elapsed;
    console.info("[DB_LOAD_TIME]", { ms: elapsed, filePath, rawBytes: raw.length, itemCount: Array.isArray(items) ? items.length : 0, cached: false, usable: false });
    const error = new Error(usability.reason || "Wormhole DB has no usable items.");
    error.code = "WORMHOLE_DB_UNUSABLE";
    error.usability = usability;
    throw error;
  }

  WORMHOLE_DB_FILE_CACHE.set(filePath, usability.items);
  const elapsed = Date.now() - loadStart;
  if (timing) timing.dbLoadMs += elapsed;
  console.info("[DB_LOAD_TIME]", { ms: elapsed, filePath, rawBytes: raw.length, itemCount: Array.isArray(items) ? items.length : 0, cached: false, usable: true });
  return usability.items;
}

function dbPilotHash(text = "") {
  let hash = 2166136261;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dbPilotRandom(seed) {
  let value = seed >>> 0;
  return function next() {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function stableShuffle(list = [], seedText = "") {
  const arr = [...list];
  const rand = dbPilotRandom(dbPilotHash(seedText));
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getDbItemTailKey(item = {}) {
  const text = String(item.english || "").toLowerCase();
  const knownTails = [
    "after the reactions became colder",
    "once the screenshots spread privately",
    "after the awkward silence grew longer",
    "while nobody mentioned the real issue",
    "after people misunderstood the situation",
    "before the teacher clarified the rumor",
    "while the tension slowly increased",
    "after the comments became personal",
    "when the atmosphere suddenly changed",
    "after the conversation lost its warmth",
    "once the private replies stopped",
    "after the friendly tone disappeared",
    "while everyone avoided the real question",
    "after the apology sounded too late",
    "when the private chat became uncomfortable",
    "after the classroom mood changed",
    "while the real reason stayed hidden",
    "after the screenshot changed the meaning",
    "when the joke stopped feeling harmless",
    "after the silence made the answer obvious",
    "while the group pretended nothing happened",
    "after the online reaction felt colder",
    "when the explanation arrived too late",
    "after the praise started sounding forced",
    "while the friendship felt distant"
  ];
  const found = knownTails.find((tail) => text.includes(tail));
  if (found) return found;
  const match = text.match(/\b(after|before|while|when|once)\b[^.?!]*[.?!]?$/i);
  return match ? match[0].replace(/[.?!]$/, "").trim() : "no_tail";
}

function selectAlthoughDbItems(items = [], input = {}, seedText = "") {
  const count = clamp(Number(input.count) || 10, 1, 30);
  const shuffled = stableShuffle(items, seedText)
    .sort((a, b) => Number((b.tags || []).includes("premium_priority")) - Number((a.tags || []).includes("premium_priority")));
  const selected = [];
  const used = new Set();
  const bucketCount = new Map();
  const worldCount = new Map();
  const emotionCount = new Map();
  const tailCount = new Map();
  const maxBucket = Math.max(2, Math.ceil(count / 4));
  const maxWorld = Math.max(3, Math.ceil(count / 3));
  const maxEmotion = Math.max(2, Math.ceil(count / 4));

  function keyOf(item, key, fallback = "unknown") {
    return String(item.chapterMeta?.[key] || fallback);
  }
  function canTake(item, relaxed = false) {
    if (!item || used.has(item.id)) return false;
    if (relaxed) return true;
    const bucket = keyOf(item, "semanticBucket");
    const world = keyOf(item, "worldType");
    const emotion = keyOf(item, "emotionAxis");
    const tail = getDbItemTailKey(item);
    return (bucketCount.get(bucket) || 0) < maxBucket &&
      (worldCount.get(world) || 0) < maxWorld &&
      (emotionCount.get(emotion) || 0) < maxEmotion &&
      (tail === "no_tail" || (tailCount.get(tail) || 0) < 1);
  }
  function take(item) {
    used.add(item.id);
    selected.push(item);
    const bucket = keyOf(item, "semanticBucket");
    const world = keyOf(item, "worldType");
    const emotion = keyOf(item, "emotionAxis");
    const tail = getDbItemTailKey(item);
    bucketCount.set(bucket, (bucketCount.get(bucket) || 0) + 1);
    worldCount.set(world, (worldCount.get(world) || 0) + 1);
    emotionCount.set(emotion, (emotionCount.get(emotion) || 0) + 1);
    tailCount.set(tail, (tailCount.get(tail) || 0) + 1);
  }

  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (canTake(item, false)) take(item);
  }
  for (const item of shuffled) {
    if (selected.length >= count) break;
    if (canTake(item, true)) take(item);
  }
  console.info("[ALTHOUGH_SELECTION_QUOTA]", {
    requested: count,
    selected: selected.length,
    buckets: Object.fromEntries(bucketCount),
    worlds: Object.fromEntries(worldCount),
    emotions: Object.fromEntries(emotionCount),
    repeatedTails: [...tailCount.entries()].filter(([, value]) => value > 1)
  });
  return selected.slice(0, count);
}

function selectDbItems(items = [], input = {}) {
  const count = clamp(Number(input.count) || 10, 1, 30);
  if (items.length < count) return [];

  const seedText = [
    input.selectedGrade,
    input.topic,
    input.userPrompt,
    input.worksheetTitle,
    input.requestedChapter,
    input.problemType,
    input.__wormholeDbFile,
    count
  ].filter(Boolean).join("|");

  const canonical = String(input.__wormholeDbCanonical || "");
  if (canonical.includes("although")) {
    return selectAlthoughDbItems(items, input, seedText);
  }

  const shuffled = stableShuffle(items, seedText);
  const afterItems = shuffled.filter((item) => (item.tags || []).includes("after"));
  const beforeItems = shuffled.filter((item) => (item.tags || []).includes("before"));
  const neutralItems = shuffled.filter((item) => !(item.tags || []).includes("after") && !(item.tags || []).includes("before"));

  const selected = [];
  const used = new Set();
  let turn = dbPilotHash(seedText) % 2;

  function takeFrom(bucket) {
    while (bucket.length) {
      const item = bucket.shift();
      if (!used.has(item.id)) {
        used.add(item.id);
        selected.push(item);
        return true;
      }
    }
    return false;
  }

  while (selected.length < count && (afterItems.length || beforeItems.length || neutralItems.length)) {
    const preferred = turn % 2 === 0 ? afterItems : beforeItems;
    const alternate = turn % 2 === 0 ? beforeItems : afterItems;
    if (!takeFrom(preferred) && !takeFrom(alternate)) takeFrom(neutralItems);
    turn += 1;
  }

  return selected.slice(0, count);
}

function collapseAdjacentRepeatedNgrams(text = "") {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return source;
  let tokens = source.split(" ");
  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.min(6, Math.floor(tokens.length / 2)); size >= 2; size -= 1) {
      for (let i = 0; i + size * 2 <= tokens.length; i += 1) {
        const left = tokens.slice(i, i + size).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        const right = tokens.slice(i + size, i + size * 2).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        if (left && left === right) {
          tokens.splice(i + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return tokens.join(" ");
}

function inferIndefiniteArticle(word = "") {
  const raw = String(word || "").trim();
  if (!raw) return "a";
  if (/^[AEFHILMNORSX][A-Z0-9-]*$/.test(raw)) return "an";
  const normalized = raw.toLowerCase();
  if (/^(honest|honor|hour|heir|herb)\b/.test(normalized)) return "an";
  if (/^(uni([^nmd]|$)|use\b|user\b|users\b|usual\b|euro\b|europe\b|european\b|eulogy\b|euphon|ewe\b|one\b|once\b|ubiquit)/.test(normalized)) return "a";
  if (/^[aeiou]/.test(normalized)) return "an";
  return "a";
}

function normalizeIndefiniteArticles(text = "") {
  return String(text || "").replace(/\b(A|An|a|an)\s+([A-Za-z][A-Za-z0-9'-]*)/g, (match, article, word) => {
    const expected = inferIndefiniteArticle(word);
    const nextArticle = article === article.toUpperCase()
      ? expected.toUpperCase()
      : /^[A]/.test(article)
        ? expected.charAt(0).toUpperCase() + expected.slice(1)
        : expected;
    return nextArticle + " " + word;
  });
}

function collapseAdjacentRepeatedNgrams(text = "") {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return source;
  let tokens = source.split(" ");
  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.min(6, Math.floor(tokens.length / 2)); size >= 2; size -= 1) {
      for (let i = 0; i + size * 2 <= tokens.length; i += 1) {
        const left = tokens.slice(i, i + size).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        const right = tokens.slice(i + size, i + size * 2).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        if (left && left === right) {
          tokens.splice(i + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return tokens.join(" ");
}

function inferIndefiniteArticle(word = "") {
  const raw = String(word || "").trim();
  if (!raw) return "a";
  if (/^[AEFHILMNORSX][A-Z0-9-]*$/.test(raw)) return "an";
  const normalized = raw.toLowerCase();
  if (/^(honest|honor|hour|heir|herb)\b/.test(normalized)) return "an";
  if (/^(uni([^nmd]|$)|use\b|user\b|users\b|usual\b|euro\b|europe\b|european\b|eulogy\b|euphon|ewe\b|one\b|once\b|ubiquit)/.test(normalized)) return "a";
  if (/^[aeiou]/.test(normalized)) return "an";
  return "a";
}

function normalizeIndefiniteArticles(text = "") {
  return String(text || "").replace(/\b(A|An|a|an)\s+([A-Za-z][A-Za-z0-9'-]*)/g, (match, article, word) => {
    const expected = inferIndefiniteArticle(word);
    const nextArticle = article === article.toUpperCase()
      ? expected.toUpperCase()
      : /^[A]/.test(article)
        ? expected.charAt(0).toUpperCase() + expected.slice(1)
        : expected;
    return nextArticle + " " + word;
  });
}

function collapseAdjacentRepeatedNgrams(text = "") {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return source;
  let tokens = source.split(" ");
  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.min(6, Math.floor(tokens.length / 2)); size >= 2; size -= 1) {
      for (let i = 0; i + size * 2 <= tokens.length; i += 1) {
        const left = tokens.slice(i, i + size).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        const right = tokens.slice(i + size, i + size * 2).map((token) => token.replace(/[.,?!]+$/g, "").toLowerCase()).join(" ");
        if (left && left === right) {
          tokens.splice(i + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return tokens.join(" ");
}

function inferIndefiniteArticle(word = "") {
  const raw = String(word || "").trim();
  if (!raw) return "a";
  if (/^[AEFHILMNORSX][A-Z0-9-]*$/.test(raw)) return "an";
  const normalized = raw.toLowerCase();
  if (/^(honest|honor|hour|heir|herb)\b/.test(normalized)) return "an";
  if (/^(uni([^nmd]|$)|use\b|user\b|users\b|usual\b|euro\b|europe\b|european\b|eulogy\b|euphon|ewe\b|one\b|once\b|ubiquit)/.test(normalized)) return "a";
  if (/^[aeiou]/.test(normalized)) return "an";
  return "a";
}

function normalizeIndefiniteArticles(text = "") {
  return String(text || "").replace(/\b(A|An|a|an)\s+([A-Za-z][A-Za-z0-9'-]*)/g, (match, article, word) => {
    const expected = inferIndefiniteArticle(word);
    const nextArticle = article === article.toUpperCase()
      ? expected.toUpperCase()
      : /^[A]/.test(article)
        ? expected.charAt(0).toUpperCase() + expected.slice(1)
        : expected;
    return nextArticle + " " + word;
  });
}

function cleanDbOption(text = "") {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  const ending = (raw.match(/[.?!]$/) || [])[0] || "";
  let source = raw;
  source = collapseAdjacentRepeatedNgrams(source);
  source = source.replace(/\s+([,.?!])/g, "$1");
  source = normalizeIndefiniteArticles(source);
  if (ending && !/[.?!]$/.test(source)) source += ending;
  return normalizeDbSentenceCase(source);
}

function normalizeDbSentenceCase(text = "") {
  const source = String(text || "").trim();
  if (!source) return source;
  return source.replace(/^(\s*)([a-z])/, (_, lead, ch) => lead + ch.toUpperCase());
}

function isLowQualityDbDistractor(text = "") {
  const t = cleanDbOption(text).toLowerCase();
  return /\bafter\s+before\b|\bbefore\s+after\b|\bafter\s+to\b|\bbefore\s+to\b/.test(t) ||
    /\bto be sat on\b|\bto be stood on\b/.test(t) ||
    isGloballyBannedDistractor(text);
}

const WORMHOLE_DISTRACTOR_CATEGORY_KEYS = [
  "relative_pronoun_confusion",
  "double_object",
  "double_relative",
  "missing_relative_subject",
  "antecedent_mismatch",
  "been_gone_confusion",
  "for_since_confusion",
  "past_time_conflict",
  "subject_verb_conflict",
  "past_participle_error",
  "global_ban_rejected",
  "etc"
];

function isGloballyBannedDistractor(text = "") {
  const t = normalizeSentenceIdentity(text);
  if (!t) return true;
  if (/\bbefore now\b|\bmany times now\b/.test(t)) return true;
  if (/\byesterday\b/.test(t) && /\b(has|have)\b/.test(t)) return true;
  if (/\blast year\b/.test(t) && /\b(has|have)\b/.test(t) && !/\b(since|for)\s+last year\b/.test(t)) return true;
  if (/\b(rumor|influencer|software update)\s+\1\b/i.test(t)) return true;
  if (/\b(that it|which it|whom he|who he)\b/.test(t)) return true;
  if (/\b(the\s+\w+)\s+\1\b/.test(t)) return true;
  if (/\b(that|which|who|whom)\s+(rumor|influencer|software update|book|movie|teacher|app|story|issue|problem|student|person)\b/.test(t)) return true;
  if (/\b(it|him|her|them)\s+(that|which|who|whom)\b/.test(t)) return true;
  return false;
}

function classifyDistractorCategory(text = "", fallback = "etc") {
  const t = normalizeSentenceIdentity(text);
  if (isGloballyBannedDistractor(text)) return "global_ban_rejected";
  if (/\b(the|a|an)\s+\w+\s+(who|whom|which)\b/.test(t)) return "relative_pronoun_confusion";
  if (/\b(that|which|who|whom)\s+(that|which|who|whom)\b/.test(t)) return "double_relative";
  if (/\b(that|which|who|whom)\s+(bought|watched|met|lost|painted|invited|liked|took|helped|made|read|visited|found|wore|called|wrote|borrowed|designed|explained|repaired|saved|examined|used)\b/.test(t)) return "missing_relative_subject";
  if (/\b(that|which|who|whom)\b.*\b(it|him|her|them)\b/.test(t)) return "double_object";
  if (/\b(has|have)\s+been\b.*\bnot here now\b|\b(has|have)\s+gone\b.*\bbefore\b/.test(t)) return "been_gone_confusion";
  if (/\bfor\s+(last\s+\w+|20\d\d)\b|\bsince\s+(\d+|two|three|four|five|several|many)\s+(days|weeks|months|years)\b/.test(t)) return "for_since_confusion";
  if (/\b(has|have)\b.*\b(yesterday|last night|last week|last year|in 20\d\d)\b/.test(t)) return "past_time_conflict";
  if (/\b(i|you|we|they)\s+has\b|\b(he|she|it)\s+have\b/.test(t)) return "subject_verb_conflict";
  if (/\b(has|have)\s+(went|saw|ate|wrote|took|gave|bought|did|made|came|became)\b/.test(t)) return "past_participle_error";
  return fallback;
}

function getDistractorPatternKey(text = "") {
  const t = normalizeSentenceIdentity(text);
  if (/\bbefore now\b/.test(t)) return "before_now";
  if (/\bmany times now\b/.test(t)) return "many_times_now";
  if (/\bthat it\b/.test(t)) return "that_it";
  if (/\bwhich it\b/.test(t)) return "which_it";
  if (/\bwho he\b/.test(t)) return "who_he";
  if (/\bwhom he\b/.test(t)) return "whom_he";
  if (/\b(that|which|who|whom)\s+(that|which|who|whom)\b/.test(t)) return "double_relative:" + t;
  if (/\b(that|which|who|whom)\b.*\b(it|him|her|them)\b/.test(t)) return "double_object:" + t;
  if (/\b(the|a|an)\s+\w+\s+(who|whom|which)\b/.test(t)) return "relative_pronoun_confusion:" + t;
  if (/\b(that|which|who|whom)\s+(bought|watched|met|lost|painted|invited|liked|took|helped|made|read|visited|found|wore|called|wrote|borrowed|designed|explained|repaired|saved|examined|used)\b/.test(t)) return "missing_relative_subject:" + t;
  if (/\b(i|you|we|they)\s+has\b|\b(he|she|it)\s+have\b/.test(t)) return "subject_verb_conflict";
  if (/\bfor\s+(last\s+\w+|20\d\d)\b|\bsince\s+(\d+|two|three|four|five|several|many)\s+(days|weeks|months|years)\b/.test(t)) return "for_since_confusion";
  if (/\b(has|have)\b.*\b(yesterday|last night|last week|last year|in 20\d\d)\b/.test(t)) return "past_time_conflict";
  return classifyDistractorCategory(text);
}

function createDistractorTracker(label = "global") {
  return {
    label,
    categories: Object.fromEntries(WORMHOLE_DISTRACTOR_CATEGORY_KEYS.map((key) => [key, 0])),
    patterns: {},
    rejected: {}
  };
}

function trackDistractor(context = {}, text = "", fallbackCategory = "etc") {
  if (!context.distractorTracker) context.distractorTracker = createDistractorTracker("worksheet");
  const category = WORMHOLE_DISTRACTOR_CATEGORY_KEYS.includes(fallbackCategory)
    ? fallbackCategory
    : classifyDistractorCategory(text, fallbackCategory);
  const key = getDistractorPatternKey(text);
  context.distractorTracker.categories[category] = (context.distractorTracker.categories[category] || 0) + 1;
  context.distractorTracker.patterns[key] = (context.distractorTracker.patterns[key] || 0) + 1;
  console.info("[DISTRACTOR_CATEGORY]", { category, pattern: key, count: context.distractorTracker.patterns[key] });
}

function canUseDistractor(context = {}, text = "", maxPerPattern = 2) {
  if (isGloballyBannedDistractor(text)) {
    if (!context.distractorTracker) context.distractorTracker = createDistractorTracker("worksheet");
    const key = getDistractorPatternKey(text);
    context.distractorTracker.rejected[key] = (context.distractorTracker.rejected[key] || 0) + 1;
    return false;
  }
  const key = getDistractorPatternKey(text);
  const count = context.distractorTracker?.patterns?.[key] || 0;
  return count < maxPerPattern;
}

const WORMHOLE_TYPE_KEYS = [
  "correct",
  "incorrect",
  "counting",
  "structure_match",
  "multi_select"
];

const WORMHOLE_TYPE_LABELS = {
  correct: "correct",
  incorrect: "incorrect",
  counting: "counting",
  structure_match: "structure",
  multi_select: "multi"
};

const WORMHOLE_BASE_TYPE_WEIGHTS = {
  correct: 7,
  incorrect: 6,
  counting: 5,
  structure_match: 4,
  multi_select: 3
};

const WORMHOLE_HIGH_DIFFICULTY_TYPE_WEIGHTS = {
  correct: 8,
  incorrect: 7,
  counting: 5,
  structure_match: 1,
  multi_select: 4
};

const WORMHOLE_CHAPTER_TYPE_BONUS = {
  present_perfect: { counting: 2, structure_match: 1 },
  relative_pronoun: { structure_match: 2, multi_select: 1 },
  relative_pronouns: { structure_match: 2, multi_select: 1 },
  subject_relative_pronouns: { structure_match: 2, multi_select: 1 },
  objective_relative_pronouns: { structure_match: 2, multi_select: 1 },
  ditransitive: { incorrect: 1, structure_match: 1 },
  comparative: { counting: 1, structure_match: 2 },
  comparatives: { counting: 1, structure_match: 2 }
};

function countQuestionTypes(types = []) {
  const counts = Object.fromEntries(WORMHOLE_TYPE_KEYS.map((type) => [type, 0]));
  for (const value of types) {
    const type = typeof value === "string" ? value : value?.questionType;
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  }
  return counts;
}

function getQuestionTypeWeights(input = {}) {
  if (input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced") {
    return { ...WORMHOLE_HIGH_DIFFICULTY_TYPE_WEIGHTS };
  }
  const weights = { ...WORMHOLE_BASE_TYPE_WEIGHTS };
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  for (const [key, bonus] of Object.entries(WORMHOLE_CHAPTER_TYPE_BONUS)) {
    if (!chapter.includes(key)) continue;
    for (const [type, value] of Object.entries(bonus)) weights[type] += value;
  }
  return weights;
}

function QuestionTypePlanner(count, input = {}) {
  const plannerStart = Date.now();
  const requested = clamp(Number(count) || 25, 1, 30);
  const weights = getQuestionTypeWeights(input);
  const allocation = Object.fromEntries(WORMHOLE_TYPE_KEYS.map((type) => [type, 0]));
  let remaining = requested;
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const exact = WORMHOLE_TYPE_KEYS.map((type) => ({
    type,
    exact: requested * weights[type] / totalWeight
  }));
  for (const entry of exact) {
    const whole = Math.floor(entry.exact);
    allocation[entry.type] += whole;
    remaining -= whole;
  }
  const remainderOrder = exact
    .map((entry) => ({ ...entry, remainder: entry.exact - Math.floor(entry.exact) }))
    .sort((a, b) => b.remainder - a.remainder || WORMHOLE_TYPE_KEYS.indexOf(a.type) - WORMHOLE_TYPE_KEYS.indexOf(b.type));
  for (let i = 0; i < remaining; i += 1) allocation[remainderOrder[i % remainderOrder.length].type] += 1;
  if (requested >= WORMHOLE_TYPE_KEYS.length) {
    for (const type of WORMHOLE_TYPE_KEYS) {
      if (allocation[type] > 0) continue;
      const donor = WORMHOLE_TYPE_KEYS
        .filter((candidate) => allocation[candidate] > 1)
        .sort((a, b) => allocation[b] - allocation[a])[0];
      if (donor) {
        allocation[donor] -= 1;
        allocation[type] = 1;
      }
    }
  }

  const bag = WORMHOLE_TYPE_KEYS.flatMap((type) => Array(allocation[type]).fill(type));
  const shuffled = stableShuffle(bag, [
    "wormhole-type-plan",
    input.selectedGrade,
    input.__wormholeDbCanonical,
    input.topic,
    input.userPrompt,
    input.count
  ].filter(Boolean).join("|"));
  const plan = [];
  while (shuffled.length) {
    const last = plan[plan.length - 1];
    const previous = plan[plan.length - 2];
    let pickIndex = 0;
    if (last && last === previous) {
      const alternate = shuffled.findIndex((type) => type !== last);
      if (alternate >= 0) pickIndex = alternate;
    }
    plan.push(shuffled.splice(pickIndex, 1)[0]);
  }
  console.info("[WORMHOLE_TYPE_PLAN]", {
    requestedCount: requested,
    chapter: input.__wormholeDbCanonical || input.topic || "",
    distribution: countQuestionTypes(plan),
    functionName: "QuestionTypePlanner",
    ms: Date.now() - plannerStart
  });
  return plan;
}

const PRESENT_PERFECT_ADVANCED_TYPES = [
  "present_perfect_vs_past",
  "for_since_confusion",
  "been_gone_confusion",
  "result_usage",
  "continuation_usage",
  "experience_usage",
  "semantic_paraphrase"
];

const PRESENT_PERFECT_ADVANCED_WEIGHTS = {
  present_perfect_vs_past: 20,
  for_since_confusion: 16,
  been_gone_confusion: 12,
  result_usage: 12,
  continuation_usage: 12,
  experience_usage: 16,
  semantic_paraphrase: 12
};

function isPresentPerfectAdvancedRequest(input = {}) {
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "").toLowerCase();
  return chapter.includes("present_perfect") &&
    (input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced");
}
function isPresentPerfectProgressiveRequest(input = {}) {
  const chapterKey = String(input.chapterKey || input.requestedChapter || input.topic || input.__wormholeDbCanonical || input.rawBody?.chapterKey || input.rawBody?.requestedChapter || input.rawBody?.canonical || "").toLowerCase();
  const family = String(input.family || input.rawBody?.family || input.chapterFamily || input.rawBody?.chapterFamily || "").toLowerCase();
  return chapterKey.includes("present_perfect_progressive") || family === "present_perfect_progressive" || family.includes("present_perfect_progressive");
}

function buildPresentPerfectAdvancedTypes(count, input = {}) {
  const requested = clamp(Number(count) || 25, 1, 30);
  const progressive = isPresentPerfectProgressiveRequest(input);
  const activeTypes = progressive
    ? PRESENT_PERFECT_ADVANCED_TYPES.filter((type) => type !== "been_gone_confusion")
    : PRESENT_PERFECT_ADVANCED_TYPES;
  const weights = progressive
    ? {
        present_perfect_vs_past: 20,
        for_since_confusion: 20,
        result_usage: 12,
        continuation_usage: 16,
        experience_usage: 16,
        semantic_paraphrase: 16
      }
    : PRESENT_PERFECT_ADVANCED_WEIGHTS;
  const allocation = Object.fromEntries(activeTypes.map((type) => [type, 0]));
  let remaining = requested;
  const exact = activeTypes.map((type) => ({
    type,
    exact: requested * weights[type] / 100
  }));
  exact.forEach((entry) => {
    allocation[entry.type] = Math.floor(entry.exact);
    remaining -= allocation[entry.type];
  });
  exact
    .map((entry) => ({ ...entry, remainder: entry.exact - Math.floor(entry.exact) }))
    .sort((a, b) => b.remainder - a.remainder || activeTypes.indexOf(a.type) - activeTypes.indexOf(b.type))
    .slice(0, remaining)
    .forEach((entry) => { allocation[entry.type] += 1; });
  const bag = activeTypes.flatMap((type) => Array(allocation[type]).fill(type));
  const plan = stableShuffle(bag, [
    "present-perfect-advanced-2.1",
    progressive ? "present-perfect-progressive" : "",
    input.selectedGrade,
    input.topic,
    input.userPrompt,
    input.worksheetTitle,
    requested
  ].filter(Boolean).join("|"));
  console.info("[WORMHOLE_PRESENT_PERFECT_ADVANCED_PLAN]", {
    functionName: "buildPresentPerfectAdvancedTypes",
    requested,
    progressive,
    distribution: countPresentPerfectAdvancedTypes(plan)
  });
  return plan;
}

function countPresentPerfectAdvancedTypes(values = []) {
  const counts = Object.fromEntries(PRESENT_PERFECT_ADVANCED_TYPES.map((type) => [type, 0]));
  values.forEach((value) => {
    const type = typeof value === "string" ? value : value?.presentPerfectType || value?.questionType;
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  });
  return counts;
}

function normalizeSentenceIdentity(text = "") {
  return String(text || "").replace(/\s+/g, " ").replace(/[.?!]$/g, "").trim().toLowerCase();
}

function lowerInitialArticle(text = "") {
  return String(text || "").replace(/^(The|A|An)\b/, (value) => value.toLowerCase());
}

function presentAgreement(subject = "", singular, plural, firstPerson = plural) {
  const normalized = String(subject || "").trim().toLowerCase();
  if (normalized === "i") return firstPerson;
  if (normalized === "you" || normalized === "we" || normalized === "they" || /\band\b/.test(normalized)) return plural;
  return singular;
}

function buildPresentPerfectParaphrase(item = {}) {
  const source = cleanDbOption(item.english);
  let match = source.match(/^(Has|Have)\s+(.+?)\s+been\s+([a-z]+ing)\s*(.*?)\s*[.?!]$/i);
  if (match) {
    const subject = match[2];
    const verb = match[3];
    const rest = String(match[4] || "").trim();
    const tail = rest ? ` ${rest}` : "";
    const continued = presentAgreement(subject, "has continued", "have continued", "have continued");
    return {
      text: `${subject} ${continued} ${verb}${tail} until now.`,
      relation: "continuing_action_present",
      distractors: [
        `${subject} stopped ${verb}${tail} long ago.`,
        `${subject} will ${verb}${tail} later.`,
        `${subject} used to ${verb}${tail} but no longer does.`,
        `${subject} never ${continued} ${verb}${tail}.`
      ]
    };
  }
  match = source.match(/^(.+?)\s+(has|have)\s+been\s+([a-z]+ing)\s*(.*?)\s*[.?!]$/i);
  if (match) {
    const subject = match[1];
    const verb = match[3];
    const rest = String(match[4] || "").trim();
    const tail = rest ? ` ${rest}` : "";
    const continued = presentAgreement(subject, "has continued", "have continued", "have continued");
    return {
      text: `${subject} ${continued} ${verb}${tail} until now.`,
      relation: "continuing_action_present",
      distractors: [
        `${subject} stopped ${verb}${tail} long ago.`,
        `${subject} will ${verb}${tail} later.`,
        `${subject} used to ${verb}${tail} but no longer does.`,
        `${subject} never ${continued} ${verb}${tail}.`
      ]
    };
  }
  match = source.match(/^(.+?)\s+(has|have)\s+gone to\s+(.+?)(?:,\s*.+)?[.?!]$/i);
  if (match) {
    const subject = match[1];
    const be = presentAgreement(subject, "is", "are", "am");
    return {
      text: `${subject} ${be} away now.`,
      relation: "gone_current_absence",
      distractors: [
        `${subject} ${be} back here now.`,
        `${subject} ${be} always here.`,
        `${subject} ${be} planning to leave now.`,
        `${subject} ${be} no longer away.`
      ]
    };
  }
  match = source.match(/^(.+?)\s+(has|have)\s+been to\s+(.+?)(?:\s+before|\s+many times)?[.?!]$/i);
  if (match) {
    const subject = match[1];
    const place = match[3];
    return {
      text: `${subject} has visited ${place} at least once.`,
      relation: "experience_before_now",
      distractors: [
        `${subject} has never visited ${place}.`,
        `${subject} is visiting ${place} for the first time now.`,
        `${subject} will visit ${place} for the first time.`,
        `${subject} did not visit ${place}.`
      ]
    };
  }
  match = source.match(/^(.+?)\s+(has|have)\s+lost\s+(.+?)(?:,\s*.+)?[.?!]$/i);
  if (match) {
    const subject = match[1];
    const object = match[3];
    const negative = presentAgreement(subject, "does not have", "do not have", "do not have");
    const positive = presentAgreement(subject, "still has", "still have", "still have");
    return {
      text: `${subject} ${negative} ${object} now.`,
      relation: "present_result",
      distractors: [
        `${subject} ${positive} ${object} now.`,
        `${subject} found ${object} again.`,
        `${subject} plans to replace ${object} later.`,
        `${subject} never owned ${object}.`
      ]
    };
  }
  match = source.match(/^(.+?)\s+(has|have)\s+lived\s+(.+?)\s+for\s+(.+?)[.?!]$/i);
  if (match) {
    const subject = match[1];
    const place = match[3];
    const duration = match[4];
    const stillLives = presentAgreement(subject, "still lives", "still live", "still live");
    const noLongerLives = presentAgreement(subject, "no longer lives", "no longer live", "no longer live");
    const plansToLive = presentAgreement(subject, "plans to live", "plan to live", "plan to live");
    return {
      text: `${subject} started living ${place} ${duration} ago and ${stillLives} ${place}.`,
      relation: "continuation_started_and_still",
      distractors: [
        `${subject} ${noLongerLives} ${place}.`,
        `${subject} began living ${place} only yesterday.`,
        `${subject} ${plansToLive} ${place} for ${duration}.`,
        `${subject} lived ${place} for ${duration} but moved away.`
      ]
    };
  }
  return null;
}
function presentPerfectItemMatchesType(item = {}, type = "") {
  const bucket = String(item.chapterMeta?.semanticBucket || "").toLowerCase();
  const chronology = String(item.chapterMeta?.chronologyType || "").toLowerCase();
  const tags = (item.tags || []).join(" ").toLowerCase();
  const english = String(item.english || "").toLowerCase();
  const variants = getRawWormholeWrongCandidates(item).join(" ").toLowerCase();
  const all = [bucket, chronology, tags, english, variants].join(" ");
  if (type === "present_perfect_vs_past") return /past_vs_present_perfect|yesterday|last (night|week|year|month)|in 20\d\d|simple past/.test(all);
  if (type === "for_since_confusion") return /\bfor\b|\bsince\b|continuing_state|continuation/.test(all);
  if (type === "been_gone_confusion") return /gone_vs_been|has gone|have gone|has been to|have been to/.test(all);
  if (type === "result_usage") return /result_state|digital_result|result|so (he|she|it|they|we|i)|cannot|can't/.test(all);
  if (type === "continuation_usage") return /continuing_state|continuation|\bfor\b|\bsince\b/.test(all);
  if (type === "experience_usage") return /experience|ever|never|before|twice|times/.test(all);
  if (type === "semantic_paraphrase") return Boolean(buildPresentPerfectParaphrase(item));
  return false;
}

function scoreWormholeDifficulty(item = {}, type = "", candidate = "") {
  const text = String(candidate || item.english || "").toLowerCase();
  const bucket = String(item.chapterMeta?.semanticBucket || "").toLowerCase();
  let score = 1;
  if (/have|has/.test(text) && /\b(yesterday|last night|last week|last year|in 20\d\d)\b/.test(text)) score = Math.max(score, 5);
  if (/\bfor\s+(20\d\d|last\s+\w+)\b|\bsince\s+(several|many|two|three|four|five|\d+)\s+(days|weeks|months|years)\b/.test(text)) score = Math.max(score, 4);
  if (/gone_vs_been/.test(bucket) || /\bbeen\b.*\bgone\b|\bgone\b.*\bbeen\b/.test(text)) score = Math.max(score, 5);
  if (/result_state|digital_result/.test(bucket)) score = Math.max(score, 6);
  if (/continuing_state/.test(bucket) || /\bfor\b|\bsince\b/.test(text)) score = Math.max(score, 4);
  if (/experience/.test(bucket) || /\bever\b|\bnever\b|\bbefore\b|\btwice\b|\btimes\b/.test(text)) score = Math.max(score, 4);
  if (/\b(have|has)\s+\w+(ed|en)\b/.test(text)) score = Math.max(score, 2);
  if (type === "present_perfect_vs_past" && presentPerfectItemMatchesType(item, type)) score = Math.max(score, 5);
  if (type === "for_since_confusion" && presentPerfectItemMatchesType(item, type)) score = Math.max(score, 4);
  if (type === "been_gone_confusion" && presentPerfectItemMatchesType(item, type)) score = Math.max(score, 5);
  if (type === "result_usage" && presentPerfectItemMatchesType(item, type)) score = Math.max(score, 6);
  if ((type === "continuation_usage" || type === "experience_usage") && presentPerfectItemMatchesType(item, type)) score = Math.max(score, 4);
  if (type === "semantic_paraphrase" && buildPresentPerfectParaphrase(item)) score = Math.max(score, 6);
  return score;
}

function scorePresentPerfectDistractorDifficulty(candidate = "", type = "") {
  const text = String(candidate || "").toLowerCase();
  if (type === "present_perfect_vs_past" && /\b(have|has)\b.*\b(yesterday|last night|last week|last year|in 20\d\d)\b/.test(text)) return 5;
  if ((type === "for_since_confusion" || type === "continuation_usage") &&
      (/\bfor\s+(20\d\d|last\s+\w+)\b/.test(text) || /\bsince\s+(several|many|two|three|four|five|\d+)\s+(days|weeks|months|years)\b/.test(text))) return 4;
  if (type === "been_gone_confusion" && /\b(been|gone)\b/.test(text)) return 5;
  if (type === "result_usage" && /\b(had|yesterday|last night|last week)\b/.test(text)) return 6;
  if (type === "continuation_usage" && /\b(yesterday|last night|last week)\b/.test(text)) return 5;
  if (type === "experience_usage" && /\b(yesterday|last year|ever|never|before|twice|times)\b/.test(text)) return 4;
  if (/\b(i|you|we|they)\s+has\b|\b(he|she|it)\s+have\b/.test(text)) return 1;
  if (/\b(have|has)\s+\w+\b/.test(text)) return 2;
  return 1;
}

function selectPresentPerfectAdvancedItems(items = [], input = {}, typePlan = []) {
  const seed = ["present-perfect-selection-2.1", input.topic, input.userPrompt, input.worksheetTitle, input.count].filter(Boolean).join("|");
  const pool = stableShuffle(items, seed);
  const usedIds = new Set();
  const usedSentences = new Set();
  const selected = [];
  let fallbackAssignments = 0;
  typePlan.forEach((type) => {
    const candidates = pool
      .filter((item) => !usedIds.has(item.id) && !usedSentences.has(normalizeSentenceIdentity(item.english)) && presentPerfectItemMatchesType(item, type))
      .sort((a, b) => scoreWormholeDifficulty(b, type) - scoreWormholeDifficulty(a, type));
    let item = candidates.find((candidate) =>
      scoreWormholeDifficulty(candidate, type) >= 4 &&
      buildPresentPerfectSemanticCandidates(candidate, type).length >= 4
    );
    if (!item && type !== "semantic_paraphrase") {
      item = pool
        .filter((candidate) => !usedIds.has(candidate.id) && !usedSentences.has(normalizeSentenceIdentity(candidate.english)))
        .sort((a, b) => scoreWormholeDifficulty(b, type) - scoreWormholeDifficulty(a, type))
        .find((candidate) =>
          scoreWormholeDifficulty(candidate, type) >= 4 &&
          buildPresentPerfectSemanticCandidates(candidate, type).length >= 4
        );
      if (item) fallbackAssignments += 1;
    }
    if (!item) return;
    usedIds.add(item.id);
    usedSentences.add(normalizeSentenceIdentity(item.english));
    selected.push({ item, type });
  });
  console.info("[WORMHOLE_PRESENT_PERFECT_SELECTION]", {
    functionName: "selectPresentPerfectAdvancedItems",
    requested: typePlan.length,
    selected: selected.length,
    usedSentenceIds: usedIds.size,
    uniqueEnglish: usedSentences.size,
    fallbackAssignments,
    minimumDifficultyScore: selected.length ? Math.min(...selected.map((entry) => scoreWormholeDifficulty(entry.item, entry.type))) : 0
  });
  return selected;
}

function buildPresentPerfectSemanticCandidates(item = {}, type = "") {
  const correct = cleanDbOption(item.english);
  const raw = getUniqueWrongOptions(item, 12);
  const generated = [];
  const add = (value) => {
    const text = cleanDbOption(value);
    if (
      text &&
      !isGloballyBannedDistractor(text) &&
      normalizeSentenceIdentity(text) !== normalizeSentenceIdentity(correct) &&
      !generated.some((entry) => normalizeSentenceIdentity(entry) === normalizeSentenceIdentity(text))
    ) generated.push(text);
  };
  const addAgreementError = () => {
    if (/\bI have\b/.test(correct)) add(correct.replace(/\bI have\b/, "I has"));
    if (/\b(You|We|They) have\b/.test(correct)) add(correct.replace(/\b(You|We|They) have\b/, "$1 has"));
    if (/\b(He|She|It|The [A-Za-z ]+?) has\b/.test(correct)) add(correct.replace(/\b(He|She|It|The [A-Za-z ]+?) has\b/, "$1 have"));
  };
  const addPastParticipleError = () => {
    const irregular = [
      [/\bhas been\b/i, "has went"],
      [/\bhave been\b/i, "have went"],
      [/\bhas seen\b/i, "has saw"],
      [/\bhave seen\b/i, "have saw"],
      [/\bhas gone\b/i, "has went"],
      [/\bhave gone\b/i, "have went"],
      [/\bhas written\b/i, "has wrote"],
      [/\bhave written\b/i, "have wrote"],
      [/\bhas taken\b/i, "has took"],
      [/\bhave taken\b/i, "have took"],
      [/\bhas eaten\b/i, "has ate"],
      [/\bhave eaten\b/i, "have ate"],
      [/\bhas done\b/i, "has did"],
      [/\bhave done\b/i, "have did"]
    ];
    irregular.forEach(([pattern, replacement]) => add(correct.replace(pattern, replacement)));
  };
  if (type === "present_perfect_vs_past") {
    add(correct.replace(/[.?!]$/, "") + " last night.");
    add(correct.replace(/[.?!]$/, "") + " in 2024.");
    add(correct.replace(/\byet\b/i, "last week"));
    addAgreementError();
    addPastParticipleError();
  } else if (type === "for_since_confusion" || type === "continuation_usage") {
    add(correct.replace(/\bfor\b/i, "since"));
    add(correct.replace(/\bsince\b/i, "for"));
    add(correct.replace(/\bfor\s+[^,.?!]+/i, "for last year"));
    add(correct.replace(/\bsince\s+[^,.?!]+/i, "since three years"));
    add(correct.replace(/\bfor\s+[^,.?!]+/i, "since several months"));
    addAgreementError();
  } else if (type === "been_gone_confusion") {
    add(correct.replace(/\bbeen\b/i, "gone"));
    add(correct.replace(/\bgone\b/i, "been"));
    if (/\bhas been to\b/i.test(correct)) add(correct.replace(/\bhas been to\b/i, "has gone to").replace(/[.?!]$/, ", so he is not here now."));
    if (/\bhave been to\b/i.test(correct)) add(correct.replace(/\bhave been to\b/i, "have gone to").replace(/[.?!]$/, ", so they are not here now."));
    if (/\bhas gone to\b/i.test(correct)) add(correct.replace(/\bhas gone to\b/i, "has been to"));
    if (/\bhave gone to\b/i.test(correct)) add(correct.replace(/\bhave gone to\b/i, "have been to"));
    addPastParticipleError();
  } else if (type === "result_usage") {
    add(correct.replace(/\bhas\b/i, "had"));
    add(correct.replace(/\bhave\b/i, "had"));
    add(correct.replace(/\bnow\b/i, "last night"));
    add(correct.replace(/\bso\b/i, "yesterday, so"));
    addAgreementError();
  } else if (type === "experience_usage") {
    add(correct.replace(/\bnever\b/i, "ever"));
    add(correct.replace(/\bever\b/i, "already"));
    add(correct.replace(/\bbefore\b/i, "last night"));
    add(correct.replace(/\btwice\b/i, "last night"));
    addPastParticipleError();
  }
  raw
    .filter((value) => scorePresentPerfectDistractorDifficulty(value, type) >= 4 && !isGloballyBannedDistractor(value))
    .forEach(add);
  raw.filter((value) => !isGloballyBannedDistractor(value)).forEach(add);
  return generated
    .sort((a, b) => scorePresentPerfectDistractorDifficulty(b, type) - scorePresentPerfectDistractorDifficulty(a, type))
    .slice(0, 4);
}

function getPresentPerfectAdvancedStem(type = "", language = "ko") {
  const ko = {
    present_perfect_vs_past: "다음 중 현재완료와 과거 시점 표현의 관계가 어법상 올바른 문장을 고르시오.",
    for_since_confusion: "다음 중 for와 since의 쓰임이 어법상 올바른 문장을 고르시오.",
    been_gone_confusion: "다음 중 been과 gone의 의미 관계가 문맥상 올바른 문장을 고르시오.",
    result_usage: "다음 중 과거 사건의 현재 결과를 가장 정확하게 나타낸 문장을 고르시오.",
    continuation_usage: "다음 중 과거부터 현재까지의 계속을 올바르게 나타낸 문장을 고르시오.",
    experience_usage: "다음 중 현재완료의 경험 용법을 어법상 올바르게 사용한 문장을 고르시오."
  };
  const en = {
    present_perfect_vs_past: "Choose the sentence that correctly distinguishes the present perfect from the simple past.",
    for_since_confusion: "Choose the sentence that correctly uses for or since.",
    been_gone_confusion: "Choose the sentence that correctly uses been or gone in context.",
    result_usage: "Choose the sentence that correctly expresses a present result.",
    continuation_usage: "Choose the sentence that correctly expresses continuation up to the present.",
    experience_usage: "Choose the sentence that correctly expresses experience."
  };
  return (language === "en" ? en : ko)[type];
}

function buildPresentPerfectAdvancedQuestion(item, index, input = {}, context = {}, type = "") {
  if (type === "semantic_paraphrase") {
    return buildSemanticParaphraseQuestion(item, index, input, context, "present_perfect");
  }
  const correct = cleanDbOption(item.english);
  const wrong = buildPresentPerfectSemanticCandidates(item, type);
  if (!correct || wrong.length < 4) return null;
  const question = formatStructuredDbQuestion(
    item,
    index,
    input,
    type,
    getPresentPerfectAdvancedStem(type, input.language),
    [{ text: correct, correct: true }, ...wrong.map((text) => ({ text, correct: false }))],
    correct
  );
  if (question) {
    question.presentPerfectType = type;
    question.difficultyScore = scoreWormholeDifficulty(item, type);
    wrong.forEach((text) => trackDistractor(context, text, classifyDistractorCategory(text, type)));
  }
  return question;
}

function validatePresentPerfectAdvancedDistribution(questions = [], requestedCount = 0) {
  const counts = countPresentPerfectAdvancedTypes(questions);
  const total = questions.length;
  const zeroTypes = PRESENT_PERFECT_ADVANCED_TYPES.filter((type) => counts[type] === 0);
  const uniqueIds = new Set(questions.map((question) => String(question.id || "").split(":")[0]));
  const valid = total === requestedCount && uniqueIds.size === total && zeroTypes.length === 0;
  return { valid, total, requestedCount, counts, zeroTypes, uniqueSentenceIds: uniqueIds.size };
}

function baseFromRegularPast(word = "") {
  const value = String(word || "").toLowerCase();
  if (/ied$/.test(value)) return value.replace(/ied$/, "y");
  if (/(ved|ded)$/.test(value)) return value.slice(0, -1);
  if (/ed$/.test(value)) {
    const stem = value.replace(/ed$/, "");
    return stem.endsWith("e") ? stem : (/([bcdfghjklmnpqrstvwxyz])\1$/.test(stem) ? stem.slice(0, -1) : stem);
  }
  return value;
}

function buildPassiveParaphrase(item = {}) {
  const source = cleanDbOption(item.english);
  const match = source.match(/^(.+?)\s+(was|were)\s+([A-Za-z]+ed)\s+by\s+(.+?)[.?!]$/i);
  if (!match) return null;
  const patient = lowerInitialArticle(match[1]);
  const verb = match[3].toLowerCase();
  const base = baseFromRegularPast(verb);
  const agent = match[4];
  const agentStart = agent.charAt(0).toUpperCase() + agent.slice(1);
  return {
    text: `${agentStart} ${verb} ${patient}.`,
    relation: "active_passive_transform",
    distractors: [
      `${agentStart} did not ${base} ${patient}.`,
      `${agentStart} will ${base} ${patient}.`,
      `${agentStart} usually ${base}s ${patient}.`,
      `${agentStart} did something else with ${patient}.`
    ]
  };
}

const DITRANSITIVE_BASE_FORMS = {
  gave: "give",
  sent: "send",
  showed: "show",
  told: "tell",
  taught: "teach",
  offered: "offer",
  brought: "bring",
  wrote: "write",
  lent: "lend",
  passed: "pass",
  read: "read",
  handed: "hand",
  bought: "buy",
  made: "make"
};

function buildDitransitiveParaphrase(item = {}) {
  const source = cleanDbOption(item.english);
  const targets = Array.isArray(item.blankTargets) ? item.blankTargets.map((value) => String(value || "").trim()) : [];
  if (!source || source.endsWith("?") || targets.length < 3) return null;
  const [verb, recipient, object] = targets;
  const base = DITRANSITIVE_BASE_FORMS[String(verb).toLowerCase()] || String(verb).toLowerCase();
  if (!base || !recipient || !object || !Object.values(DITRANSITIVE_BASE_FORMS).includes(base)) return null;
  const core = `${verb} ${recipient} ${object}`;
  const coreIndex = source.toLowerCase().indexOf(core.toLowerCase());
  if (coreIndex < 1 || /\b(?:did not|does not|do not|can|could|will|would|should|may|might|must)\s*$/i.test(source.slice(0, coreIndex))) return null;
  const subject = source.slice(0, coreIndex).trim();
  const suffix = source.slice(coreIndex + core.length).replace(/[.?!]$/, "").trim();
  const preposition = /^(buy|make)$/.test(base) ? "for" : "to";
  const tail = suffix ? ` ${suffix}` : "";
  return {
    text: `${subject} ${verb} ${object} ${preposition} ${recipient}${tail}.`,
    relation: "ditransitive_prepositional_transform",
    distractors: [
      `${subject} did not ${base} ${object} ${preposition} ${recipient}${tail}.`,
      `${subject} planned to ${base} ${object} ${preposition} ${recipient}${tail}.`,
      `${subject} ${verb} ${object} ${preposition} someone else${tail}.`,
      `${subject} ${verb} something else ${preposition} ${recipient}${tail}.`
    ]
  };
}

const WORMHOLE_SEMANTIC_CAPABILITIES = {
  present_perfect: "enabled",
  passive: "eligible_items_only",
  ditransitive: "enabled",
  relative_pronouns: "accepted_alternatives_required"
};

function inferSemanticFamily(input = {}) {
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "").toLowerCase();
  if (/present_perfect/.test(chapter)) return "present_perfect";
  if (/(^|_)passive$/.test(chapter)) return "passive";
  if (/ditransitive/.test(chapter)) return "ditransitive";
  if (/relative/.test(chapter)) return "relative_pronouns";
  return "none";
}

function getSemanticEligibleItems(items = [], family = "", input = {}) {
  const eligibleItems = family === "none" ? [] : items.filter((item) => getSemanticParaphrase(item, family));
  console.info("[SEMANTIC_ELIGIBLE_DEBUG]", {
    family,
    chapterKey: String(input.chapterKey || input.requestedChapter || input.topic || input.__wormholeDbCanonical || input.rawBody?.chapterKey || input.rawBody?.requestedChapter || input.rawBody?.canonical || ""),
    totalItems: items.length,
    eligibleItems: eligibleItems.length
  });
  return eligibleItems;
}
function getSemanticParaphrase(item = {}, family = "") {
  if (family === "present_perfect") return buildPresentPerfectParaphrase(item);
  if (family === "passive") return buildPassiveParaphrase(item);
  if (family === "ditransitive") return buildDitransitiveParaphrase(item);
  return null;
}

function buildSemanticParaphraseQuestion(item, index, input = {}, context = {}, family = "") {
  const source = cleanDbOption(item.english);
  const paraphrase = getSemanticParaphrase(item, family);
  if (!source || !paraphrase?.text || normalizeSentenceIdentity(source) === normalizeSentenceIdentity(paraphrase.text)) return null;
  const options = [paraphrase.text, ...(paraphrase.distractors || [])]
    .map(cleanDbOption)
    .filter((value, optionIndex, values) => value && values.findIndex((entry) => normalizeSentenceIdentity(entry) === normalizeSentenceIdentity(value)) === optionIndex)
    .slice(0, 5);
  if (options.length < 5) return null;
  const stem = input.language === "en"
    ? `Choose the sentence that best preserves the meaning of the given sentence.\n<${source}>`
    : `다음 주어진 문장의 의미를 가장 정확하게 유지한 문장을 고르시오.\n<${source}>`;
  const question = formatStructuredDbQuestion(
    item,
    index,
    input,
    "semantic_paraphrase",
    stem,
    options.map((text, optionIndex) => ({ text, correct: optionIndex === 0 })),
    paraphrase.text
  );
  if (question) {
    question.semanticRelation = paraphrase.relation;
    question.difficultyScore = 6;
    if (context.usedOptionSentences instanceof Set) {
      options.forEach((option) => context.usedOptionSentences.add(normalizeSentenceIdentity(option)));
    }
  }
  return question;
}

const PASSIVE_ADVANCED_TYPES = [
  "correct",
  "incorrect",
  "counting",
  "structure_match",
  "multi_select",
  "semantic_paraphrase"
];

const PASSIVE_ADVANCED_ALLOCATION_25 = {
  correct: 6,
  incorrect: 6,
  counting: 5,
  structure_match: 1,
  multi_select: 4,
  semantic_paraphrase: 3
};

function isPassiveAdvancedRequest(input = {}, items = []) {
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "").toLowerCase();
  const advanced = input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced";
  return advanced && /(^|_)passive$/.test(chapter) && items.filter((item) => buildPassiveParaphrase(item)).length >= 3;
}

function buildPassiveAdvancedTypes(count, input = {}) {
  const requested = clamp(Number(count) || 25, 1, 30);
  const weights = requested === 25
    ? PASSIVE_ADVANCED_ALLOCATION_25
    : { correct: 6, incorrect: 6, counting: 5, structure_match: 1, multi_select: 4, semantic_paraphrase: 3 };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const allocation = Object.fromEntries(PASSIVE_ADVANCED_TYPES.map((type) => [type, Math.floor(requested * weights[type] / totalWeight)]));
  let remaining = requested - Object.values(allocation).reduce((sum, value) => sum + value, 0);
  for (const type of PASSIVE_ADVANCED_TYPES) {
    if (remaining <= 0) break;
    allocation[type] += 1;
    remaining -= 1;
  }
  const plan = stableShuffle(
    PASSIVE_ADVANCED_TYPES.flatMap((type) => Array(allocation[type]).fill(type)),
    ["passive-semantic-3.0", input.selectedGrade, input.topic, input.worksheetTitle, requested].filter(Boolean).join("|")
  );
  console.info("[WORMHOLE_PASSIVE_ADVANCED_PLAN]", { requested, distribution: countPassiveAdvancedTypes(plan) });
  return plan;
}

function countPassiveAdvancedTypes(values = []) {
  const counts = Object.fromEntries(PASSIVE_ADVANCED_TYPES.map((type) => [type, 0]));
  values.forEach((value) => {
    const type = typeof value === "string" ? value : value?.questionType;
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  });
  return counts;
}

function selectPassiveAdvancedItems(items = [], input = {}, typePlan = []) {
  const pool = stableShuffle(items, ["passive-semantic-selection-3.0", input.topic, input.worksheetTitle, input.count].filter(Boolean).join("|"));
  const used = new Set();
  return typePlan.map((type) => {
    const item = pool.find((candidate) => !used.has(candidate.id) && (type !== "semantic_paraphrase" || buildPassiveParaphrase(candidate)));
    if (!item) return null;
    used.add(item.id);
    return { item, type };
  }).filter(Boolean);
}

function buildPassiveAdvancedQuestion(item, index, input = {}, context = {}, type = "") {
  return type === "semantic_paraphrase"
    ? buildSemanticParaphraseQuestion(item, index, input, context, "passive")
    : buildPlannedDbQuestion(item, index, input, context, type);
}

function validatePassiveAdvancedDistribution(questions = [], requestedCount = 0) {
  const counts = countPassiveAdvancedTypes(questions);
  const uniqueIds = new Set(questions.map((question) => String(question.id || "").split(":")[0]));
  const valid = questions.length === requestedCount &&
    uniqueIds.size === questions.length &&
    PASSIVE_ADVANCED_TYPES.every((type) => counts[type] > 0);
  return { valid, total: questions.length, requestedCount, counts, uniqueSentenceIds: uniqueIds.size };
}

const DITRANSITIVE_ADVANCED_TYPES = [
  "correct",
  "incorrect",
  "counting",
  "structure_match",
  "multi_select",
  "semantic_paraphrase"
];

const DITRANSITIVE_ADVANCED_ALLOCATION_25 = {
  correct: 6,
  incorrect: 6,
  counting: 5,
  structure_match: 1,
  multi_select: 4,
  semantic_paraphrase: 3
};

function isDitransitiveAdvancedRequest(input = {}, items = []) {
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "").toLowerCase();
  const advanced = input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced";
  return advanced && /ditransitive/.test(chapter) && items.filter((item) => buildDitransitiveParaphrase(item)).length >= 3;
}

function buildDitransitiveAdvancedTypes(count, input = {}) {
  const requested = clamp(Number(count) || 25, 1, 30);
  const weights = requested === 25
    ? DITRANSITIVE_ADVANCED_ALLOCATION_25
    : { correct: 6, incorrect: 6, counting: 5, structure_match: 1, multi_select: 4, semantic_paraphrase: 3 };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const allocation = Object.fromEntries(DITRANSITIVE_ADVANCED_TYPES.map((type) => [type, Math.floor(requested * weights[type] / totalWeight)]));
  let remaining = requested - Object.values(allocation).reduce((sum, value) => sum + value, 0);
  for (const type of DITRANSITIVE_ADVANCED_TYPES) {
    if (remaining <= 0) break;
    allocation[type] += 1;
    remaining -= 1;
  }
  const plan = stableShuffle(
    DITRANSITIVE_ADVANCED_TYPES.flatMap((type) => Array(allocation[type]).fill(type)),
    ["ditransitive-semantic-3.0", input.selectedGrade, input.topic, input.worksheetTitle, requested].filter(Boolean).join("|")
  );
  console.info("[WORMHOLE_DITRANSITIVE_ADVANCED_PLAN]", { requested, distribution: countDitransitiveAdvancedTypes(plan) });
  return plan;
}

function countDitransitiveAdvancedTypes(values = []) {
  const counts = Object.fromEntries(DITRANSITIVE_ADVANCED_TYPES.map((type) => [type, 0]));
  values.forEach((value) => {
    const type = typeof value === "string" ? value : value?.questionType;
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  });
  return counts;
}

function selectDitransitiveAdvancedItems(items = [], input = {}, typePlan = []) {
  const pool = stableShuffle(items, ["ditransitive-semantic-selection-3.0", input.topic, input.worksheetTitle, input.count].filter(Boolean).join("|"));
  const used = new Set();
  return typePlan.map((type) => {
    const item = pool.find((candidate) => !used.has(candidate.id) && (type !== "semantic_paraphrase" || buildDitransitiveParaphrase(candidate)));
    if (!item) return null;
    used.add(item.id);
    return { item, type };
  }).filter(Boolean);
}

function buildDitransitiveAdvancedQuestion(item, index, input = {}, context = {}, type = "") {
  return type === "semantic_paraphrase"
    ? buildSemanticParaphraseQuestion(item, index, input, context, "ditransitive")
    : buildPlannedDbQuestion(item, index, input, context, type);
}

function validateDitransitiveAdvancedDistribution(questions = [], requestedCount = 0) {
  const counts = countDitransitiveAdvancedTypes(questions);
  const uniqueIds = new Set(questions.map((question) => String(question.id || "").split(":")[0]));
  const valid = questions.length === requestedCount &&
    uniqueIds.size === questions.length &&
    DITRANSITIVE_ADVANCED_TYPES.every((type) => counts[type] > 0);
  return { valid, total: questions.length, requestedCount, counts, uniqueSentenceIds: uniqueIds.size };
}

const OBJECTIVE_RELATIVE_DISTRACTOR_TYPES = [
  "relative_pronoun_confusion",
  "double_object",
  "double_relative",
  "missing_relative_subject",
  "antecedent_mismatch"
];

const OBJECTIVE_RELATIVE_SUBJECTS = [
  "our class",
  "the teacher",
  "students",
  "I",
  "you",
  "we",
  "they",
  "he",
  "she"
];

function isObjectiveRelativeAdvancedRequest(input = {}) {
  const chapter = String(input.__wormholeDbCanonical || input.requestedChapter || input.topic || "").toLowerCase();
  const advanced = input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced";
  return advanced && /objective_relative_pronouns/.test(chapter);
}

function countObjectiveRelativeTypes(values = []) {
  const counts = Object.fromEntries(OBJECTIVE_RELATIVE_DISTRACTOR_TYPES.map((type) => [type, 0]));
  values.forEach((value) => {
    const type = typeof value === "string" ? value : value?.objectiveRelativeType;
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  });
  return counts;
}

function buildObjectiveRelativeTypes(count, input = {}) {
  const requested = clamp(Number(count) || 25, 1, 30);
  const bag = [];
  let cursor = dbPilotHash([input.selectedGrade, input.topic, input.worksheetTitle, requested].filter(Boolean).join("|")) % OBJECTIVE_RELATIVE_DISTRACTOR_TYPES.length;
  while (bag.length < requested) {
    bag.push(OBJECTIVE_RELATIVE_DISTRACTOR_TYPES[cursor % OBJECTIVE_RELATIVE_DISTRACTOR_TYPES.length]);
    cursor += 1;
  }
  const plan = stableShuffle(bag, ["objective-relative-distractors-2.0", input.selectedGrade, input.topic, input.worksheetTitle, requested].filter(Boolean).join("|"));
  console.info("[WORMHOLE_OBJECTIVE_RELATIVE_PLAN]", { requested, distribution: countObjectiveRelativeTypes(plan) });
  return plan;
}

function selectObjectiveRelativeItems(items = [], input = {}, typePlan = []) {
  const pool = stableShuffle(items, ["objective-relative-selection-2.0", input.topic, input.worksheetTitle, input.count].filter(Boolean).join("|"));
  const used = new Set();
  const selected = [];
  typePlan.forEach((type) => {
    const item = pool.find((candidate) => !used.has(candidate.id) && buildObjectiveRelativeDistractors(candidate, type, {}).length >= 4);
    if (!item) return;
    used.add(item.id);
    selected.push({ item, type });
  });
  console.info("[WORMHOLE_OBJECTIVE_RELATIVE_SELECTION]", {
    requested: typePlan.length,
    selected: selected.length,
    uniqueSentenceIds: used.size
  });
  return selected;
}

function getObjectiveRelativePronoun(item = {}) {
  const blank = Array.isArray(item.blankTargets) ? item.blankTargets.find((value) => /^(that|which|who|whom)$/i.test(String(value || ""))) : "";
  if (blank) return String(blank).toLowerCase();
  const match = cleanDbOption(item.english).match(/\b(that|which|who|whom)\b/i);
  return match ? match[1].toLowerCase() : "that";
}

function isHumanObjectiveRelativeItem(item = {}) {
  const tags = (item.tags || []).join(" ").toLowerCase();
  const text = cleanDbOption(item.english).toLowerCase();
  return /\b(human|person|people|man|woman|girl|boy|teacher|student|friend|player|writer|scientist|traveler|expert|leader|family|children|guest|member)\b/.test(tags + " " + text);
}

function replaceFirstRelativePronoun(sentence = "", replacement = "that") {
  return cleanDbOption(sentence).replace(/\b(that|which|who|whom)\b/i, replacement);
}

function removeObjectiveRelativeSubject(sentence = "", rel = "that") {
  const source = cleanDbOption(sentence);
  for (const subject of OBJECTIVE_RELATIVE_SUBJECTS) {
    const pattern = new RegExp("\\b" + rel + "\\s+" + subject.replace(/\s+/g, "\\s+") + "\\s+", "i");
    if (pattern.test(source)) return source.replace(pattern, rel + " ");
  }
  return "";
}

function insertRetainedObjectPronoun(sentence = "", item = {}, rel = "that") {
  const source = cleanDbOption(sentence);
  const objectPronoun = isHumanObjectiveRelativeItem(item)
    ? (/children|people|families|guests|experts|students|players|travelers/i.test(source) ? "them" : "him")
    : "it";
  const relMatch = source.match(new RegExp("\\b" + rel + "\\b\\s+(.+)", "i"));
  if (!relMatch) return "";
  const beforeRel = source.slice(0, relMatch.index + rel.length + 1);
  const afterRel = source.slice(relMatch.index + rel.length + 1);
  const subject = OBJECTIVE_RELATIVE_SUBJECTS.find((candidate) => new RegExp("^" + candidate.replace(/\s+/g, "\\s+") + "\\b", "i").test(afterRel));
  if (!subject) return "";
  const afterSubject = afterRel.replace(new RegExp("^" + subject.replace(/\s+/g, "\\s+") + "\\s+", "i"), "");
  const words = afterSubject.split(/\s+/);
  const insertionIndex = /^(did|does|do|could|can|have|has|had|were|was)$/i.test(words[0] || "") && words.length > 2 ? 3 : 1;
  if (words.length <= insertionIndex) return "";
  words.splice(insertionIndex, 0, objectPronoun);
  return beforeRel + subject + " " + words.join(" ");
}

function buildObjectiveRelativeDistractors(item = {}, preferredType = "", context = {}) {
  const correct = cleanDbOption(item.english);
  const rel = getObjectiveRelativePronoun(item);
  const human = isHumanObjectiveRelativeItem(item);
  const entries = [];
  const add = (type, value) => {
    const text = cleanDbOption(value);
    if (
      text &&
      normalizeSentenceIdentity(text) !== normalizeSentenceIdentity(correct) &&
      !isGloballyBannedDistractor(text) &&
      !entries.some((entry) => normalizeSentenceIdentity(entry.text) === normalizeSentenceIdentity(text))
    ) entries.push({ type, text });
  };
  const wrongPronoun = human ? "which" : (rel === "which" ? "who" : "whom");
  const mismatchPronoun = human ? (rel === "whom" ? "who" : "which") : (rel === "which" ? "whom" : "who");
  add("relative_pronoun_confusion", replaceFirstRelativePronoun(correct, wrongPronoun));
  add("antecedent_mismatch", replaceFirstRelativePronoun(correct, mismatchPronoun));
  add("relative_pronoun_confusion", replaceFirstRelativePronoun(correct, "what"));
  add("double_relative", replaceFirstRelativePronoun(correct, rel + (rel === "which" ? " that" : " which")));
  add("missing_relative_subject", removeObjectiveRelativeSubject(correct, rel));
  add("double_object", insertRetainedObjectPronoun(correct, item, rel));
  add("missing_relative_subject", cleanDbOption(correct).replace(new RegExp("\\b" + rel + "\\s+", "i"), ""));
  return entries
    .sort((a, b) => Number(a.type === preferredType) - Number(b.type === preferredType))
    .reverse()
    .slice(0, 4);
}

function getObjectiveRelativeStem(input = {}) {
  return input.language === "en"
    ? "Choose the sentence that correctly uses an objective relative pronoun."
    : "다음 중 목적격 관계대명사의 쓰임이 어법상 가장 자연스러운 문장을 고르시오.";
}

function buildObjectiveRelativeQuestion(item, index, input = {}, context = {}, type = "") {
  const correct = cleanDbOption(item.english);
  const wrongEntries = buildObjectiveRelativeDistractors(item, type, context);
  if (!correct || wrongEntries.length < 4) return null;
  const question = formatStructuredDbQuestion(
    item,
    index,
    input,
    "objective_relative_pronouns",
    getObjectiveRelativeStem(input),
    [{ text: correct, correct: true }, ...wrongEntries.map((entry) => ({ text: entry.text, correct: false }))],
    correct
  );
  if (question) {
    question.objectiveRelativeType = type;
    wrongEntries.forEach((entry) => trackDistractor(context, entry.text, entry.type));
    if (context.usedOptionSentences instanceof Set) {
      [correct, ...wrongEntries.map((entry) => entry.text)].forEach((option) => context.usedOptionSentences.add(normalizeSentenceIdentity(option)));
    }
  }
  return question;
}

function validateObjectiveRelativeDistribution(questions = [], requestedCount = 0) {
  const counts = countObjectiveRelativeTypes(questions);
  const uniqueIds = new Set(questions.map((question) => String(question.id || "").split(":")[0]));
  const valid = questions.length === requestedCount &&
    uniqueIds.size === questions.length &&
    OBJECTIVE_RELATIVE_DISTRACTOR_TYPES.every((type) => counts[type] > 0);
  return { valid, total: questions.length, requestedCount, counts, uniqueSentenceIds: uniqueIds.size };
}

function getUniqueWrongOptions(item = {}, limit = 4, usedOptions = new Set()) {
  const correct = cleanDbOption(item.english);
  const unique = [];
  for (const value of getRawWormholeWrongCandidates(item).map(cleanDbOption).filter(Boolean)) {
    if (value && value !== correct && !usedOptions.has(normalizeSentenceIdentity(value)) && !unique.includes(value)) unique.push(value);
  }
  const highQuality = unique.filter((value) => !isLowQualityDbDistractor(value));
  const fallback = unique.filter((value) => isLowQualityDbDistractor(value));
  return [...highQuality, ...fallback].slice(0, limit);
}

function getUniqueCorrectOptions(items = [], excludedIds = new Set(), limit = 5, usedOptions = new Set()) {
  const unique = [];
  for (const item of items) {
    const value = cleanDbOption(item?.english);
    const normalized = normalizeSentenceIdentity(value);
    if (!value || excludedIds.has(item?.id) || usedOptions.has(normalized) || unique.some((entry) => normalizeSentenceIdentity(entry) === normalized)) continue;
    unique.push(value);
    if (unique.length >= limit) break;
  }
  return unique;
}

function getBuilderUsedOptions(context = {}, item = {}) {
  const used = new Set(context.usedOptionSentences instanceof Set ? context.usedOptionSentences : []);
  const correct = normalizeSentenceIdentity(item.english);
  if (correct) used.add(correct);
  return used;
}

function scoreGlobalWormholeDistractor(value = "") {
  const text = normalizeSentenceIdentity(value);
  if (!text || isLowQualityDbDistractor(text)) return 0;
  if (/\b(have|has)\b.*\b(yesterday|last night|last week|last year|in 20\d\d)\b|\bfor\s+(20\d\d|last\s+\w+)\b|\bsince\s+(several|many|two|three|four|five|\d+)\s+(days|weeks|months|years)\b/.test(text)) return 6;
  if (/\bbeen\b.*\bgone\b|\bgone\b.*\bbeen\b|\b(already|yet|ever|never|before)\b.*\b(yesterday|last year|now)\b/.test(text)) return 6;
  if (/\b(most|more)\s+\w+est\b|\bthe\s+more\s+\w+est\b|\bmore\s+\w+er\b|\bmost\s+\w+er\b/.test(text)) return 5;
  if (/\balthough\b.*\bbut\b|\bbecause of\b\s+(he|she|it|they|we|i)\b|\bbecause\b\s+(the|a|an)\s+\w+\s*$|\bdespite\b.*\bbut\b/.test(text)) return 5;
  if (/\b(to|for|since|during|while|when|that|which|who|whom)\b/.test(text)) return 4;
  if (/\b(i|you|we|they)\s+has\b|\b(he|she|it)\s+have\b|\b(have has|has have|did \w+ed|does \w+s)\b/.test(text)) return 1;
  if (/\b(have|has|had)\s+\w+\b/.test(text)) return 2;
  return 3;
}

function getContextWrongOptions(item = {}, limit = 4, context = {}) {
  const usedOptions = getBuilderUsedOptions(context, item);
  const pool = [];
  function add(value, ownItem) {
    const normalized = normalizeSentenceIdentity(value);
    if (!normalized || usedOptions.has(normalized) || pool.some((entry) => entry.normalized === normalized)) return;
    pool.push({ value, normalized, score: scoreGlobalWormholeDistractor(value), ownItem });
  }
  getUniqueWrongOptions(item, 12, usedOptions).forEach((value) => add(value, true));
  for (const candidate of context.allItems || []) {
    if (candidate?.id === item?.id) continue;
    getUniqueWrongOptions(candidate, 8, usedOptions).forEach((value) => add(value, false));
    if (pool.length >= 80) break;
  }
  return pool
    .sort((a, b) => b.score - a.score || Number(b.ownItem) - Number(a.ownItem))
    .slice(0, limit)
    .map((entry) => entry.value);
}

function getBuilderSeed(item = {}, index = 0, input = {}, type = "") {
  return [item.id, input.topic, input.userPrompt, input.worksheetTitle, input.requestedChapter, input.count, index, type].filter(Boolean).join("|");
}

function formatStructuredDbQuestion(item, index, input, questionType, stem, optionObjects, explanation) {
  if (!Array.isArray(optionObjects) || optionObjects.length !== 5) return null;
  const labels = ["①", "②", "③", "④", "⑤"];
  const shuffled = stableShuffle(optionObjects, getBuilderSeed(item, index, input, questionType));
  const correctOptionIndexes = shuffled
    .map((option, optionIndex) => option.correct ? optionIndex : -1)
    .filter((optionIndex) => optionIndex >= 0);
  if (!correctOptionIndexes.length) return null;
  const answerLabels = correctOptionIndexes.map((optionIndex) => labels[optionIndex]).join(", ");
  return {
    id: item.id + ":" + questionType,
    questionType,
    correctOptionIndexes,
    questionText: [
      String(index + 1) + ". " + stem,
      ...shuffled.map((option, optionIndex) => labels[optionIndex] + " " + option.text)
    ].join("\n"),
    answerText: String(index + 1) + ") " + answerLabels + " - " + explanation
  };
}

function buildCorrectQuestion(item, index, input = {}, context = {}) {
  const correct = cleanDbOption(item.english);
  const accepted = getWormholeAcceptedAlternatives(item).map(cleanDbOption).filter(Boolean).slice(0, 2);
  const valid = [correct, ...accepted].filter(Boolean);
  const wrong = getContextWrongOptions(item, 5 - valid.length, context);
  if (!correct || wrong.length < 5 - valid.length) return null;
  return formatStructuredDbQuestion(
    item, index, input, "correct",
    accepted.length
      ? (input.language === "en" ? "Choose all grammatically correct sentences." : "다음 중 어법상 자연스러운 문장을 모두 고르시오.")
      : (input.language === "en" ? "Choose the grammatically correct sentence." : "다음 중 어법상 가장 자연스러운 문장을 고르시오."),
    [...valid.map((text) => ({ text, correct: true })), ...wrong.map((text) => ({ text, correct: false }))],
    valid.join(" / ")
  );
}

function buildIncorrectQuestion(item, index, input = {}, context = {}) {
  const correctOptions = [cleanDbOption(item.english), ...getUniqueCorrectOptions(context.allItems, context.selectedIds, 3, getBuilderUsedOptions(context, item))].filter(Boolean).slice(0, 4);
  const wrong = getContextWrongOptions(item, 1, context)[0];
  if (correctOptions.length < 4 || !wrong) return null;
  return formatStructuredDbQuestion(
    item, index, input, "incorrect",
    input.language === "en" ? "Choose the grammatically incorrect sentence." : "다음 중 어법상 어색한 문장을 고르시오.",
    [...correctOptions.map((text) => ({ text, correct: false })), { text: wrong, correct: true }],
    wrong
  );
}

function buildCountingQuestion(item, index, input = {}, context = {}) {
  const correctCount = 2 + (index % 3);
  const correctSentences = [cleanDbOption(item.english), ...getUniqueCorrectOptions(context.allItems, context.selectedIds, correctCount - 1, getBuilderUsedOptions(context, item))].filter(Boolean).slice(0, correctCount);
  const wrongSentences = getContextWrongOptions(item, 5 - correctCount, context);
  if (correctSentences.length < correctCount || wrongSentences.length < 5 - correctCount) return null;
  const statements = stableShuffle(
    [...correctSentences.map((text) => ({ text, valid: true })), ...wrongSentences.map((text) => ({ text, valid: false }))],
    getBuilderSeed(item, index, input, "counting-statements")
  );
  const statementLabels = ["(a)", "(b)", "(c)", "(d)", "(e)"];
  const stem = [
    input.language === "en" ? "How many of the following sentences are grammatically correct?" : "다음 중 어법상 옳은 문장의 개수는?",
    ...statements.map((entry, statementIndex) => statementLabels[statementIndex] + " " + entry.text)
  ].join("\n");
  return formatStructuredDbQuestion(
    item, index, input, "counting", stem,
    [1, 2, 3, 4, 5].map((value) => ({ text: input.language === "en" ? String(value) : value + "개", correct: value === correctCount })),
    String(correctCount)
  );
}

function buildStructureQuestion(item, index, input = {}, context = {}) {
  const sameStructure = getUniqueCorrectOptions(context.allItems, context.selectedIds, 1, getBuilderUsedOptions(context, item))[0];
  const wrong = getContextWrongOptions(item, 4, context);
  if (!sameStructure || wrong.length < 4) return null;
  const target = cleanDbOption(item.english);
  const stem = input.language === "en"
    ? "Choose the sentence that uses the same grammatical structure as the given sentence.\n<" + target + ">"
    : "다음 주어진 문장과 같은 문법 구조를 사용한 문장을 고르시오.\n<" + target + ">";
  return formatStructuredDbQuestion(
    item, index, input, "structure_match", stem,
    [{ text: sameStructure, correct: true }, ...wrong.map((text) => ({ text, correct: false }))],
    sameStructure
  );
}

function buildMultiSelectQuestion(item, index, input = {}, context = {}) {
  const validCount = 2 + (index % 2);
  const valid = [cleanDbOption(item.english), ...getUniqueCorrectOptions(context.allItems, context.selectedIds, validCount - 1, getBuilderUsedOptions(context, item))].filter(Boolean).slice(0, validCount);
  const wrong = getContextWrongOptions(item, 5 - validCount, context);
  if (valid.length < validCount || wrong.length < 5 - validCount) return null;
  return formatStructuredDbQuestion(
    item, index, input, "multi_select",
    input.language === "en" ? "Choose all grammatically correct sentences." : "다음 중 어법상 옳은 문장을 모두 고르시오.",
    [...valid.map((text) => ({ text, correct: true })), ...wrong.map((text) => ({ text, correct: false }))],
    valid.join(" / ")
  );
}

const WORMHOLE_QUESTION_BUILDERS = {
  correct: buildCorrectQuestion,
  incorrect: buildIncorrectQuestion,
  counting: buildCountingQuestion,
  structure_match: buildStructureQuestion,
  multi_select: buildMultiSelectQuestion
};

function buildPlannedDbQuestion(item, index, input = {}, context = {}, questionType = "correct") {
  const builder = WORMHOLE_QUESTION_BUILDERS[questionType];
  const question = builder ? builder(item, index, input, context) : null;
  if (question && context.usedOptionSentences instanceof Set) {
    question.questionText
      .split("\n")
      .filter((line) => /^[①②③④⑤]\s/.test(line))
      .map((line) => line.replace(/^[①②③④⑤]\s*/, ""))
      .forEach((option) => context.usedOptionSentences.add(normalizeSentenceIdentity(option)));
  }
  console.info("[WORMHOLE_TYPE_SELECTED]", {
    index: index + 1,
    seedId: item.seedId || item.id,
    questionType,
    builder: builder?.name || "missing",
    built: Boolean(question),
    correctAnswerCount: question?.correctOptionIndexes?.length || 0
  });
  return question;
}

function validateWormholeTypeDistribution(questions = [], requestedCount = 0) {
  const counts = countQuestionTypes(questions);
  const total = questions.length;
  const maxAllowed = Math.floor(requestedCount * 0.4);
  const zeroTypes = WORMHOLE_TYPE_KEYS.filter((type) => counts[type] === 0);
  const excessiveTypes = WORMHOLE_TYPE_KEYS.filter((type) => counts[type] > maxAllowed);
  const valid = total === requestedCount && zeroTypes.length === 0 && excessiveTypes.length === 0;
  return { valid, total, requestedCount, counts, zeroTypes, excessiveTypes, maxAllowed };
}

function validateGlobalHighDifficultyQuality(questions = [], requestedCount = 0, input = {}) {
  const applies = !isPresentPerfectAdvancedRequest(input) &&
    (input.difficulty === "high" || input.difficulty === "extreme" || input.mode === "advanced");
  if (!applies) return { valid: true, applies: false };
  const normalizedOptions = questions.flatMap((question) =>
    String(question.questionText || "").split("\n")
      .filter((line) => /^[①②③④⑤]\s/.test(line))
      .map((line) => normalizeSentenceIdentity(line.replace(/^[①②③④⑤]\s*/, "")))
      .filter((option) => /[a-z]/i.test(option) && option.split(/\s+/).length >= 3)
  );
  const duplicateOptions = normalizedOptions.filter((option, index) => normalizedOptions.indexOf(option) !== index);
  const primaryIds = questions.map((question) => String(question.id || "").split(":")[0]);
  const duplicatePrimaryIds = primaryIds.filter((id, index) => primaryIds.indexOf(id) !== index);
  const confirmationCount = questions.filter((question) =>
    question.questionType === "structure_match"
  ).length;
  const maxConfirmation = Math.floor(requestedCount * 0.1);
  const valid = questions.length === requestedCount &&
    duplicateOptions.length === 0 &&
    duplicatePrimaryIds.length === 0 &&
    confirmationCount <= maxConfirmation;
  return {
    valid,
    applies: true,
    requestedCount,
    actualCount: questions.length,
    duplicateOptionCount: new Set(duplicateOptions).size,
    duplicatePrimaryIdCount: new Set(duplicatePrimaryIds).size,
    confirmationCount,
    maxConfirmation
  };
}

function formatDbWormholeResponse(questions = [], input = {}) {
  const title = buildWormholeTitle(input);
  const instructions = buildWormholeInstructions(input);
  const questionsText = cleanupText(questions.map((question) => question.questionText).join("\n\n"));
  const answerSheet = cleanupText(questions.map((question) => question.answerText).join("\n"));
  const content = cleanupText([title, instructions, questionsText].filter(Boolean).join("\n\n"));
  const fullText = cleanupText([title, instructions, questionsText, "정답 및 해설", answerSheet].filter(Boolean).join("\n\n"));
  return {
    title,
    instructions,
    content,
    answerSheet,
    fullText,
    actualCount: questions.length,
    source: "db-first",
    dbFirst: true,
    questionTypeDistribution: isPresentPerfectAdvancedRequest(input)
    ? countPresentPerfectAdvancedTypes(questions)
    : input.__wormholePassiveSemantic
      ? countPassiveAdvancedTypes(questions)
      : input.__wormholeDitransitiveSemantic
        ? countDitransitiveAdvancedTypes(questions)
        : input.__wormholeObjectiveRelativeAdvanced
          ? countObjectiveRelativeTypes(questions)
          : countQuestionTypes(questions),
    ambiguityMode: questions.some((question) => (question.correctOptionIndexes || []).length > 1)
      ? "single-dual-multi-correct"
      : "single-correct"
  };
}

function buildWormholeTimingReport(timing = {}, totalStart = 0, extra = {}) {
  const report = {
    registryMs: Number(timing.registryMs || 0),
    chapterResolveMs: Number(timing.chapterResolveMs || 0),
    dbLoadMs: Number(timing.dbLoadMs || 0),
    worksheetBuildMs: Number(timing.worksheetBuildMs || 0),
    totalMs: totalStart ? Date.now() - totalStart : 0,
    registryBuildMs: Number(WORMHOLE_REGISTRY_META.buildMs || 0),
    registryBuildCount: Number(WORMHOLE_REGISTRY_META.buildCount || 0),
    registryTotalFiles: Number(WORMHOLE_REGISTRY_META.totalFiles || 0),
    registryCacheWarm: Boolean(globalThis.__wormholeRegistry),
    slowStages: []
  };

  report.slowStages = ["registryMs", "chapterResolveMs", "dbLoadMs", "worksheetBuildMs"]
    .filter((key) => report[key] > 5000);

  const merged = { ...report, ...extra };
  console.log("[TIMING]", merged);
  return merged;
}

async function tryBuildWormholeFromDb(input = {}) {
  const totalStart = Date.now();
  const timing = { registryMs: 0, chapterResolveMs: 0, dbLoadMs: 0, worksheetBuildMs: 0 };
  const match = await resolveWormholeDbFile(input, timing);

  if (!match?.matched) {
    const selectedGrade = normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto");
    const gradeLocked = WORMHOLE_GRADE_BUCKETS.includes(selectedGrade);
    const timingReport = buildWormholeTimingReport(timing, totalStart, {
      phase: "chapter_not_found",
      selectedGrade,
      requestedChapter: input.requestedChapter || input.topic || ""
    });
    console.warn("[WORMHOLE_CHAPTER_NOT_FOUND]", {
      functionName: "tryBuildWormholeFromDb",
      selectedGrade,
      requestedChapter: input.requestedChapter || input.topic || "",
      resolvedChapter: input.topic || "",
      blockGptFallback: gradeLocked,
      ms: Date.now() - totalStart
    });
    return {
      success: false,
      dbMatched: false,
      blockGptFallback: gradeLocked,
      reason: gradeLocked ? "chapter_not_found_in_selected_grade" : "db_alias_not_found",
      selectedGrade,
      requestedChapter: input.requestedChapter || input.topic || "",
      timing: timingReport
    };
  }

  const unusable = [];
  for (const entry of match.candidates) {
    if (match.selectedGrade !== "auto" && entry.grade !== match.selectedGrade) continue;
    input.__wormholeDbCanonical = entry.canonical;
    input.__wormholeDbFile = entry.file;
    try {
      const items = await loadGrammarDb(entry.filePath, timing);
      const presentPerfectAdvanced = isPresentPerfectAdvancedRequest(input);
      const passiveAdvanced = !presentPerfectAdvanced && isPassiveAdvancedRequest(input, items);
      const ditransitiveAdvanced = !presentPerfectAdvanced && !passiveAdvanced && isDitransitiveAdvancedRequest(input, items);
      const objectiveRelativeAdvanced = !presentPerfectAdvanced && !passiveAdvanced && !ditransitiveAdvanced && isObjectiveRelativeAdvancedRequest(input);
      input.__wormholePassiveSemantic = passiveAdvanced;
      input.__wormholeDitransitiveSemantic = ditransitiveAdvanced;
      input.__wormholeObjectiveRelativeAdvanced = objectiveRelativeAdvanced;
      const requestedSemanticFamily = inferSemanticFamily(input);
      const semanticFamily = presentPerfectAdvanced ? "present_perfect" : passiveAdvanced ? "passive" : ditransitiveAdvanced ? "ditransitive" : objectiveRelativeAdvanced ? "relative_pronouns" : "none";
      const semanticEligibleCount = semanticFamily === "none"
        ? 0
        : getSemanticEligibleItems(items, semanticFamily, input).length;
      console.info("[WORMHOLE_SEMANTIC_CAPABILITY]", {
        family: requestedSemanticFamily,
        capability: WORMHOLE_SEMANTIC_CAPABILITIES[requestedSemanticFamily] || "disabled",
        enabled: semanticFamily !== "none"
      });
      console.info("[WORMHOLE_SEMANTIC_ELIGIBLE_COUNT]", {
        family: semanticFamily,
        eligible: semanticEligibleCount,
        total: items.length
      });
      const presentPerfectTypePlan = presentPerfectAdvanced ? buildPresentPerfectAdvancedTypes(input.count, input) : [];
      const passiveTypePlan = passiveAdvanced ? buildPassiveAdvancedTypes(input.count, input) : [];
      const ditransitiveTypePlan = ditransitiveAdvanced ? buildDitransitiveAdvancedTypes(input.count, input) : [];
      const objectiveRelativeTypePlan = objectiveRelativeAdvanced ? buildObjectiveRelativeTypes(input.count, input) : [];
      const presentPerfectSelection = presentPerfectAdvanced
        ? selectPresentPerfectAdvancedItems(items, input, presentPerfectTypePlan)
        : [];
      const passiveSelection = passiveAdvanced ? selectPassiveAdvancedItems(items, input, passiveTypePlan) : [];
      const ditransitiveSelection = ditransitiveAdvanced ? selectDitransitiveAdvancedItems(items, input, ditransitiveTypePlan) : [];
      const objectiveRelativeSelection = objectiveRelativeAdvanced ? selectObjectiveRelativeItems(items, input, objectiveRelativeTypePlan) : [];
      const selected = presentPerfectAdvanced
        ? presentPerfectSelection.map((entry) => entry.item)
        : passiveAdvanced
          ? passiveSelection.map((entry) => entry.item)
          : ditransitiveAdvanced
            ? ditransitiveSelection.map((entry) => entry.item)
            : objectiveRelativeAdvanced
              ? objectiveRelativeSelection.map((entry) => entry.item)
              : selectDbItems(items, input);

      if (selected.length < input.count) {
        unusable.push({ file: entry.file, reason: "not_enough_db_items" });
        const timingReport = buildWormholeTimingReport(timing, totalStart, {
          phase: "not_enough_db_items",
          file: entry.file
        });
        console.warn("[WORMHOLE_DB_UNUSABLE]", { file: entry.file, reason: "not_enough_db_items" });
        return {
          success: false,
          dbMatched: true,
          blockGptFallback: true,
          reason: "matched_db_unusable",
          unusable,
          timing: timingReport
        };
      }

      const worksheetBuildStart = Date.now();
      const typePlan = presentPerfectAdvanced
        ? presentPerfectTypePlan
        : passiveAdvanced
          ? passiveTypePlan
          : ditransitiveAdvanced
            ? ditransitiveTypePlan
            : objectiveRelativeAdvanced
              ? objectiveRelativeTypePlan
              : QuestionTypePlanner(input.count, input);
      const context = {
        items: selected,
        allItems: items,
        input,
        selectedIds: new Set(selected.map((item) => item.id)),
        usedOptionSentences: new Set(selected.map((item) => normalizeSentenceIdentity(item.english)).filter(Boolean)),
        distractorTracker: createDistractorTracker(entry.canonical)
      };
      const questions = selected
        .map((item, index) => presentPerfectAdvanced
          ? buildPresentPerfectAdvancedQuestion(item, index, input, context, presentPerfectSelection[index]?.type || typePlan[index])
          : passiveAdvanced
            ? buildPassiveAdvancedQuestion(item, index, input, context, passiveSelection[index]?.type || typePlan[index])
            : ditransitiveAdvanced
              ? buildDitransitiveAdvancedQuestion(item, index, input, context, ditransitiveSelection[index]?.type || typePlan[index])
              : objectiveRelativeAdvanced
                ? buildObjectiveRelativeQuestion(item, index, input, context, objectiveRelativeSelection[index]?.type || typePlan[index])
                : buildPlannedDbQuestion(item, index, input, context, typePlan[index]))
        .filter(Boolean);
      timing.worksheetBuildMs += Date.now() - worksheetBuildStart;

      console.info("[ASSEMBLY_TIME]", { ms: Date.now() - worksheetBuildStart, selected: selected.length, questions: questions.length });
      console.info("[DISTRACTOR_CATEGORY_DISTRIBUTION]", {
        chapter: entry.canonical,
        categories: context.distractorTracker.categories,
        patterns: context.distractorTracker.patterns,
        rejected: context.distractorTracker.rejected
      });

      if (questions.length < input.count) {
        unusable.push({ file: entry.file, reason: "not_enough_db_questions" });
        const timingReport = buildWormholeTimingReport(timing, totalStart, {
          phase: "not_enough_db_questions",
          file: entry.file
        });
        console.warn("[WORMHOLE_DB_UNUSABLE]", { file: entry.file, reason: "not_enough_db_questions" });
        return {
          success: false,
          dbMatched: true,
          blockGptFallback: true,
          reason: "matched_db_unusable",
          unusable,
          timing: timingReport
        };
      }

      const globalQualityValidation = validateGlobalHighDifficultyQuality(questions, input.count, input);
      console.info("[WORMHOLE_GLOBAL_QUALITY_GATE]", globalQualityValidation);
      if (!globalQualityValidation.valid) {
        unusable.push({ file: entry.file, reason: "global_high_difficulty_quality_gate_rejected", globalQualityValidation });
        const timingReport = buildWormholeTimingReport(timing, totalStart, {
          phase: "global_quality_rejected",
          file: entry.file
        });
        console.warn("[WORMHOLE_GLOBAL_QUALITY_GATE_REJECTED]", {
          file: entry.file,
          functionName: "validateGlobalHighDifficultyQuality",
          ...globalQualityValidation
        });
        return {
          success: false,
          dbMatched: true,
          blockGptFallback: true,
          reason: "global_high_difficulty_quality_gate_rejected",
          unusable,
          timing: timingReport
        };
      }

      const distributionValidation = presentPerfectAdvanced
        ? validatePresentPerfectAdvancedDistribution(questions, input.count)
        : passiveAdvanced
          ? validatePassiveAdvancedDistribution(questions, input.count)
          : ditransitiveAdvanced
            ? validateDitransitiveAdvancedDistribution(questions, input.count)
            : objectiveRelativeAdvanced
              ? validateObjectiveRelativeDistribution(questions, input.count)
              : validateWormholeTypeDistribution(questions, input.count);
      if (presentPerfectAdvanced) {
        console.info("[WORMHOLE_PRESENT_PERFECT_TYPE_DISTRIBUTION]", {
          ...distributionValidation.counts,
          total: distributionValidation.total,
          requested: distributionValidation.requestedCount,
          uniqueSentenceIds: distributionValidation.uniqueSentenceIds,
          valid: distributionValidation.valid
        });
      } else if (passiveAdvanced) {
        console.info("[WORMHOLE_PASSIVE_TYPE_DISTRIBUTION]", {
          ...distributionValidation.counts,
          total: distributionValidation.total,
          requested: distributionValidation.requestedCount,
          uniqueSentenceIds: distributionValidation.uniqueSentenceIds,
          valid: distributionValidation.valid
        });
      } else if (ditransitiveAdvanced) {
        console.info("[WORMHOLE_DITRANSITIVE_TYPE_DISTRIBUTION]", {
          ...distributionValidation.counts,
          total: distributionValidation.total,
          requested: distributionValidation.requestedCount,
          uniqueSentenceIds: distributionValidation.uniqueSentenceIds,
          valid: distributionValidation.valid
        });
      } else if (objectiveRelativeAdvanced) {
        console.info("[WORMHOLE_OBJECTIVE_RELATIVE_TYPE_DISTRIBUTION]", {
          ...distributionValidation.counts,
          total: distributionValidation.total,
          requested: distributionValidation.requestedCount,
          uniqueSentenceIds: distributionValidation.uniqueSentenceIds,
          valid: distributionValidation.valid
        });
      } else {
        console.info("[WORMHOLE_TYPE_DISTRIBUTION]", {
          correct: distributionValidation.counts.correct,
          incorrect: distributionValidation.counts.incorrect,
          counting: distributionValidation.counts.counting,
          structure: distributionValidation.counts.structure_match,
          multi: distributionValidation.counts.multi_select,
          total: distributionValidation.total,
          requested: distributionValidation.requestedCount,
          valid: distributionValidation.valid
        });
      }
      console.info("[WORMHOLE_SEMANTIC_DISTRIBUTION]", {
        family: semanticFamily,
        semanticParaphrase: distributionValidation.counts.semantic_paraphrase || 0,
        total: distributionValidation.total,
        enabled: semanticFamily !== "none"
      });
      console.info("[WORMHOLE_AMBIGUITY_ENGINE]", {
        singleCorrect: questions.filter((question) => question.correctOptionIndexes.length === 1).length,
        dualCorrect: questions.filter((question) => question.correctOptionIndexes.length === 2).length,
        multiCorrect: questions.filter((question) => question.correctOptionIndexes.length > 2).length
      });

      if (!distributionValidation.valid) {
        unusable.push({ file: entry.file, reason: "invalid_question_type_distribution", distributionValidation });
        const timingReport = buildWormholeTimingReport(timing, totalStart, {
          phase: "distribution_rejected",
          file: entry.file
        });
        console.warn("[WORMHOLE_TYPE_DISTRIBUTION_REJECTED]", distributionValidation);
        return {
          success: false,
          dbMatched: true,
          blockGptFallback: true,
          reason: "matched_db_unusable",
          unusable,
          timing: timingReport
        };
      }

      const formatted = formatDbWormholeResponse(questions.slice(0, input.count), input);
      const timingReport = buildWormholeTimingReport(timing, totalStart, {
        phase: "db_first_success",
        file: entry.file,
        chapter: entry.canonical
      });
      console.info("[TOTAL_EXECUTION_TIME]", { phase: "db_first_success", ms: Date.now() - totalStart });
      return {
        success: true,
        dbMatched: true,
        file: entry.file,
        tier: entry.tier,
        timing: timingReport,
        formatted: {
          ...formatted,
          timing: timingReport
        }
      };
    } catch (error) {
      const reason = error?.usability?.reason || error?.message || "db_first_failed";
      unusable.push({ file: entry.file, reason });
      const timingReport = buildWormholeTimingReport(timing, totalStart, {
        phase: "db_first_failed",
        file: entry.file,
        reason
      });
      console.warn("[WORMHOLE_DB_UNUSABLE]", { file: entry.file, reason });
      return {
        success: false,
        dbMatched: true,
        blockGptFallback: true,
        reason: "matched_db_unusable",
        unusable,
        timing: timingReport
      };
    }
  }

  const timingReport = buildWormholeTimingReport(timing, totalStart, {
    phase: "no_candidate_after_filter"
  });
  return {
    success: false,
    dbMatched: false,
    blockGptFallback: false,
    reason: "db_alias_not_found",
    timing: timingReport
  };
}

function getRequiredMp(reqBody = {}) {
  return sanitizeMp(reqBody?.mpCost, 5);
}

function getInitialTrialMp() {
  return sanitizeMp(DEFAULT_TRIAL_MP, 15);
}

function extractBearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function extractMemberId(req) {
  return sanitizeString(req?.body?.memberId || req?.headers?.["x-member-id"] || req?.headers?.["X-Member-Id"] || "");
}

async function verifyMemberToken(token) {
  if (!token) return null;
  const payload = { token };
  if (MEMBERSTACK_APP_ID) payload.audience = MEMBERSTACK_APP_ID;
  const data = await memberstackRequest("/verify-token", { method: "POST", body: JSON.stringify(payload) });
  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, { method: "GET" });
  return data?.data || null;
}

function readMpFromMember(member) {
  if (!member) return null;
  const candidates = [
    member?.customFields?.[MEMBERSTACK_MP_FIELD],
    member?.metaData?.[MEMBERSTACK_MP_FIELD],
    member?.customFields?.mp,
    member?.metaData?.mp
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return sanitizeMp(parsed, 0);
  }
  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) throw new Error("Missing member id");
  const safeNextMp = sanitizeMp(nextMp, 0);
  const body = {
    customFields: { ...member?.customFields, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp },
    metaData: { ...member?.metaData, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp }
  };
  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, { method: "PATCH", body: JSON.stringify(body) });
  return data?.data || null;
}

async function resolveMemberForMp(req) {
  if (!MEMBERSTACK_SECRET_KEY) return { enabled: false, reason: "missing_secret_key", member: null };
  try {
    const bearerToken = extractBearerToken(req);
    if (bearerToken) {
      const verified = await verifyMemberToken(bearerToken);
      if (verified?.id) {
        const member = await getMemberById(verified.id);
        return { enabled: true, reason: "token_verified", member };
      }
    }
    const explicitMemberId = extractMemberId(req);
    if (explicitMemberId) {
      const member = await getMemberById(explicitMemberId);
      return { enabled: true, reason: "member_id", member };
    }
    return { enabled: false, reason: "member_not_provided", member: null };
  } catch (error) {
    return { enabled: false, reason: "member_lookup_failed", member: null };
  }
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  const memberContext = await resolveMemberForMp(req);
  if (!memberContext.enabled || !memberContext.member) {
    return { enabled: false, reason: memberContext.reason, requiredMp, member: null, currentMp: null, trialGranted: false, deducted: false };
  }
  let member = memberContext.member;
  let currentMp = readMpFromMember(member);
  let trialGranted = false;
  if (!Number.isFinite(currentMp)) {
    currentMp = getInitialTrialMp();
    member = (await updateMemberMp(member, currentMp)) || member;
    currentMp = readMpFromMember(member);
    trialGranted = true;
  }
  return { enabled: true, reason: memberContext.reason, requiredMp, member, currentMp, remainingMp: currentMp, trialGranted, deducted: false };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) return { ...mpState, deducted: false };
  const nextMp = Math.max(0, sanitizeMp(mpState.currentMp, 0) - sanitizeMp(mpState.requiredMp, 0));
  const updatedMember = await updateMemberMp(mpState.member, nextMp);
  return { ...mpState, member: updatedMember || mpState.member, currentMp: nextMp, remainingMp: nextMp, deducted: true };
}

// --- Main Handler ---

async function handler(req, res) {
  addCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST only" });
  try {
    const input = normalizeInput(req.body || {});
    console.info("[WORMHOLE_NAMESPACE_LOCK]", {
      selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedBucket: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedChapter: input.topic || "",
    });
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, message: "Prompt or topic required" });
    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP가 부족합니다.", requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp });
    }

    const handlerStart = Date.now();
    console.info("[WORMHOLE_FUNCTION_START]", {
      functionName: "tryBuildWormholeFromDb",
      selectedGrade: input.selectedGrade,
      resolvedChapter: input.topic
    });
    const dbResult = await tryBuildWormholeFromDb(input);
    console.info("[WORMHOLE_FUNCTION_END]", {
      functionName: "tryBuildWormholeFromDb",
      ms: Date.now() - handlerStart,
      success: Boolean(dbResult?.success),
      reason: dbResult?.reason || "db_first_success"
    });
    let formatted;
    if (dbResult?.success) {
      formatted = dbResult.formatted;
      console.info("[WORMHOLE_DB_FIRST_PILOT_HIT]", {
        selectedGrade: input.selectedGrade,
        requestedChapter: input.requestedChapter,
        topic: input.topic,
        actualCount: formatted.actualCount,
        source: formatted.source || "db-first"
      });
      console.info("[GPT_FALLBACK_SKIPPED]", { reason: "db_first_success", actualCount: formatted.actualCount });
      console.info("[TOTAL_EXECUTION_TIME]", { phase: "handler_db_first_return", ms: Date.now() - handlerStart });
      const finalMpState = await deductMpAfterSuccess(mpState);
      return json(res, 200, {
        success: true,
        ...formatted,
        textbook: input.textbook,
        mp: {
          requiredMp: mpState.requiredMp,
          currentMp: mpState.currentMp,
          remainingMp: finalMpState?.remainingMp ?? null,
          deducted: Boolean(finalMpState?.deducted),
          trialGranted: Boolean(mpState.trialGranted),
        }
      });
    } else if (dbResult?.blockGptFallback) {
      console.info("[GPT_FALLBACK_SKIPPED]", {
        reason: dbResult.reason || "db_first_blocked",
        selectedGrade: input.selectedGrade,
        resolvedChapter: input.topic
      });
      if (dbResult.reason === "chapter_not_found_in_selected_grade") {
        const grade = dbResult.selectedGrade || input.selectedGrade || "selected grade";
        return json(res, 404, {
          success: false,
          error: "WORMHOLE_CHAPTER_NOT_FOUND",
          message: `해당 챕터는 ${grade} DB에 존재하지 않습니다`,
          selectedGrade: grade,
          requestedChapter: dbResult.requestedChapter || input.requestedChapter || input.topic || "",
          resolvedChapter: input.topic || ""
        });
      }
      console.warn("[WORMHOLE_DB_UNUSABLE]", {
        reason: dbResult.reason || "matched_db_unusable",
        unusable: dbResult.unusable || []
      });
      return json(res, 422, {
        success: false,
        error: "WORMHOLE_DB_UNUSABLE",
        message: "해당 챕터 DB는 존재하지만 현재 웜홀 문제 생성에 사용할 수 없습니다.",
        detail: dbResult.reason || "matched_db_unusable",
        unusable: dbResult.unusable || []
      });
    } else {
      console.info("[WORMHOLE_FALLBACK]", {
        reason: dbResult?.reason || "no_db_result",
        functionName: "callOpenAI",
        selectedGrade: input.selectedGrade,
        resolvedChapter: input.topic
      });
      const systemPrompt = buildGrammarSystemPrompt(input);
      const userPrompt = buildGrammarUserPrompt(input);
      const raw = await callOpenAI(systemPrompt, userPrompt);
      formatted = formatWormholeResponse(raw, input);
    }

    // --- 문항 수 보정 구간 (출력 안정화 영역) ---
    if (formatted.actualCount < input.count) {
      console.warn(`WORMHOLE QUESTION SHORTAGE: expected ${input.count}, got ${formatted.actualCount}`);
      const missingCount = input.count - formatted.actualCount;
      if (missingCount > 0) {
        const supplement = await generateWormholeSupplement(input, missingCount, formatted.content);
        formatted = await mergeWormholeSupplement(formatted, supplement, input);
      }
    }

    if (formatted.actualCount > input.count) {
      const trimmedQuestionBlocks = extractQuestionBlocks(
        cleanupText(
          String(formatted.content || "")
            .replace(formatted.title || "", "")
            .replace(formatted.instructions || "", "")
        )
      ).slice(0, input.count);
      const trimmedAnswerBlocks = extractAnswerBlocks(formatted.answerSheet || "").slice(0, input.count);

      const trimmedQuestionsText = ensureFiveChoicesPerQuestion(
        renumberBlocks(trimmedQuestionBlocks, 1).join("\n\n")
      );
      const trimmedAnswersText = normalizeWormholeAnswers(
        renumberAnswerBlocks(trimmedAnswerBlocks, 1).join("\n")
      );
      formatted = {
        ...formatted,
        content: cleanupText(
          [formatted.title, formatted.instructions, trimmedQuestionsText]
            .filter(Boolean)
            .join("\n\n")
        ),
        answerSheet: cleanupText(trimmedAnswersText),
        fullText: cleanupText(
          [
            formatted.title,
            formatted.instructions,
            trimmedQuestionsText,
            "정답 및 해설",
            trimmedAnswersText,
          ]
            .filter(Boolean)
            .join("\n\n")
        ),
        actualCount: countQuestions(trimmedQuestionsText),
      };
    }

    if (formatted.actualCount !== input.count) {
      console.warn(`WORMHOLE FINAL COUNT MISMATCH: expected ${input.count}, got ${formatted.actualCount}`);
    }

    if (formatted.actualCount === 0) {
      return json(res, 500, { success: false, message: `Question parsing failed: expected ${input.count}, got 0` });
    }

    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      ...formatted,
      textbook: input.textbook,
      mp: {
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: finalMpState?.remainingMp ?? null,
        deducted: Boolean(finalMpState?.deducted),
        trialGranted: Boolean(mpState.trialGranted),
      }
    });
  } catch (error) {
    const timeoutFunction = error?.code === "WORMHOLE_OPENAI_TIMEOUT" ? "callOpenAI" : "unknown";
    console.error("[WORMHOLE_HANDLER_ERROR]", {
      functionName: timeoutFunction,
      code: error?.code || "WORMHOLE_GENERATION_FAILED",
      error: error?.message || String(error)
    });
    return json(res, error?.code === "WORMHOLE_OPENAI_TIMEOUT" ? 504 : 500, {
      success: false,
      error: error?.code || "WORMHOLE_GENERATION_FAILED",
      message: error?.code === "WORMHOLE_OPENAI_TIMEOUT" ? "Fallback generation timed out safely." : "Generation failed",
      functionName: timeoutFunction,
      detail: error.message
    });
  }
}

module.exports = handler;
module.exports.config = config;




