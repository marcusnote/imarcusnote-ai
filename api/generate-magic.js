// api/generate-magic.js
import fs from "fs/promises";
import path from "path";

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const FILE_MAP = {
  be_verb: "middle1_be_verb.json",
  be_question: "middle1_be_question.json",
  be_negative: "middle1_be_negative.json",
  do_verb: "middle1_do_verb.json",
  do_question: "middle1_do_question.json",
  do_negative: "middle1_do_negative.json",
  wh_question: "middle1_wh_question.json",
  modal_will: "middle1_modal_will.json",
};

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

function inferLanguage(text = "") {
  const t = String(text || "");
  const koreanMatches = t.match(/[가-힣]/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();

  if (/초등|초[1-6]|abc\s*starter|elementary|junior/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|high/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";

  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();

  if (/abc\s*starter|starter|phonics|파닉스|기초영어|알파벳/.test(t)) return "abcstarter";
  if (/영작|writing|composition|rewrite|재배열|문장 재구성/.test(t)) return "writing";
  if (/card|카드|magic\s*card|매직카드/.test(t)) return "magic-card";
  if (/교과서|textbook/.test(t)) return "textbook-grammar";
  if (/chapter|챕터/.test(t)) return "chapter-grammar";

  return "magic";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();

  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|입문|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";

  return "standard";
}

function inferTopic(text = "") {
  const t = String(text || "");

  const topicPatterns = [
    "알파벳",
    "파닉스",
    "be동사",
    "일반동사",
    "현재진행형",
    "현재완료",
    "과거시제",
    "조동사",
    "명사",
    "대명사",
    "형용사",
    "부사",
    "비교급",
    "최상급",
    "수동태",
    "관계대명사",
    "관계부사",
    "동명사",
    "to부정사",
    "가정법",
    "접속사",
    "전치사",
    "시제",
    "수일치",
    "문장구조",
    "영작훈련",
  ];

  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }

  const lower = t.toLowerCase();

  if (/alphabet/.test(lower)) return "알파벳";
  if (/phonics/.test(lower)) return "파닉스";
  if (/writing|composition/.test(lower)) return "영작훈련";
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/infinitive|to-infinitive/.test(lower)) return "to부정사";
  if (/gerund/.test(lower)) return "동명사";
  if (/passive/.test(lower)) return "수동태";

  return "문법 학습";
}

function inferGradeLabel(text = "", level = "middle") {
  const t = String(text || "");

  if (/초1/.test(t)) return "초1";
  if (/초2/.test(t)) return "초2";
  if (/초3/.test(t)) return "초3";
  if (/초4/.test(t)) return "초4";
  if (/초5/.test(t)) return "초5";
  if (/초6/.test(t)) return "초6";

  if (/중1/.test(t)) return "중1";
  if (/중2/.test(t)) return "중2";
  if (/중3/.test(t)) return "중3";

  if (/고1/.test(t)) return "고1";
  if (/고2/.test(t)) return "고2";
  if (/고3/.test(t)) return "고3";

  if (level === "elementary") return "초등";
  if (level === "high") return "고등";
  return "중등";
}

function normalizeWorkbookType(value = "", mergedText = "") {
  const direct = String(value || "").trim().toLowerCase();
  if (["guided_writing", "blank_fill", "choice"].includes(direct)) return direct;

  const t = `${direct} ${String(mergedText || "").toLowerCase()}`;
  if (/blank\s*fill|빈칸/.test(t)) return "blank_fill";
  if (/choice|선택형|객관식/.test(t)) return "choice";
  return "guided_writing";
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
    sanitizeString(body.chapterKey || ""),
    sanitizeString(body.workbookType || ""),
  ]
    .filter(Boolean)
    .join(" ");

  const level = ["elementary", "middle", "high"].includes(body.level)
    ? body.level
    : inferLevel(mergedText);

  const modeCandidates = [
    "magic",
    "magic-card",
    "writing",
    "abcstarter",
    "textbook-grammar",
    "chapter-grammar",
  ];

  const mode = modeCandidates.includes(body.mode)
    ? body.mode
    : inferMode(mergedText);

  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);

  const language = ["ko", "en"].includes(body.language)
    ? body.language
    : inferLanguage(mergedText);

  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || "") || "workbook";
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const engine = "magic";
  const gradeLabel = inferGradeLabel(mergedText, level);
  const workbookType = normalizeWorkbookType(body.workbookType || body.problemType || body.type || "", mergedText);

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
    workbookType,
    requestedChapterKey: sanitizeString(body.chapterKey || ""),
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
  if (difficulty === "standard") return "표준난도";
  return "기초난도";
}

function getModeLabel(mode, language = "ko") {
  const koMap = {
    magic: "매직형",
    "magic-card": "매직카드형",
    writing: "영작훈련형",
    abcstarter: "ABC Starter형",
    "textbook-grammar": "교과서 문법형",
    "chapter-grammar": "챕터 문법형",
  };

  const enMap = {
    magic: "Magic",
    "magic-card": "Magic Card",
    writing: "Writing Training",
    abcstarter: "ABC Starter",
    "textbook-grammar": "Textbook Grammar",
    "chapter-grammar": "Chapter Grammar",
  };

  return language === "en" ? enMap[mode] || "Magic" : koMap[mode] || "매직형";
}

function buildMagicTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);

  if (input.language === "en") {
    return `${input.gradeLabel} ${input.topic} Magic ${difficultyLabel} ${input.count} Items`;
  }

  if (input.mode === "abcstarter") {
    return `${input.gradeLabel} ${input.topic} ABC Starter ${difficultyLabel} ${input.count}문항`;
  }

  return `${input.gradeLabel} ${input.topic} 마커스매직 ${difficultyLabel} ${input.count}문항`;
}

function buildSystemPrompt(input) {
  const isKo = input.language === "ko";

  return isKo
    ? `
당신은 마커스매직 전용 워크북 생성 엔진이다.

핵심 목표:
- 학습자 친화적이면서도 교육적으로 정교한 영어 학습 워크북을 만든다.
- 문제는 훈련용, 누적 학습용, 영작용, 교과서 문법 복습용이어야 한다.
- 출력물은 교사와 학원이 바로 사용할 수 있을 정도로 깔끔해야 한다.
- 억지로 시험형으로 만들기보다, 학습 효과와 반복 훈련 효과를 높인다.

중요 원칙:
1. 매직은 웜홀처럼 고난도 판별형 시험지가 아니라, 학습·훈련 중심이다.
2. 영작 요청이면 객관식보다 쓰기·재구성·배열·완성형 문항을 우선한다.
3. ABC Starter는 초등 입문자를 고려하여 지나치게 어렵지 않게 작성한다.
4. 교과서/챕터 문법 요청이면 개념 흐름이 자연스럽게 이어지게 한다.
5. 정답 또는 예시답안을 반드시 별도 섹션에 제공한다.
6. 한국어 요청이면 제목/안내문/해설은 한국어로 작성한다.
7. 문항 수는 정확히 맞춘다.
8. 애매한 문제나 여러 답이 가능한 문제는 피한다.

출력 형식:
[[TITLE]]
(제목 한 줄)

[[INSTRUCTIONS]]
(학습 안내문 한 단락)

[[QUESTIONS]]
1. ...
2. ...
3. ...

[[ANSWERS]]
1. ...
2. ...
3. ...
`.trim()
    : `
You are the dedicated MARCUS Magic workbook generation engine.

Core goals:
- Generate clean, educational, workbook-style English practice materials.
- Prioritize training value, progression, and learning effectiveness.
- For writing requests, prefer production tasks over multiple choice.
- For beginner requests, keep the content accessible and supportive.
- Always provide answers or model responses in a separate section.

Rules:
1. Magic is a learning and training engine, not a high-difficulty exam engine.
2. Prefer writing, sentence building, reordering, completion, and guided production tasks when appropriate.
3. ABC Starter mode must stay beginner-friendly.
4. Match the requested number of items exactly.
5. Avoid ambiguous tasks and unclear answer keys.

Output format:
[[TITLE]]
(one-line title)

[[INSTRUCTIONS]]
(one paragraph)

[[QUESTIONS]]
1. ...
2. ...
3. ...

[[ANSWERS]]
1. ...
2. ...
3. ...
`.trim();
}

function buildTaskGuide(input) {
  switch (input.mode) {
    case "abcstarter":
      return input.language === "en"
        ? "Create beginner-friendly foundational English tasks such as alphabet, phonics, word-picture connection, basic sentence building, and guided completion."
        : "알파벳, 파닉스, 단어-의미 연결, 기초 문장 만들기, 쉬운 완성형 문제 등 초등 입문 친화형 과제로 구성할 것.";

    case "writing":
      return input.language === "en"
        ? "Focus on English writing training: translation to English, sentence reconstruction, guided composition, reordering, and completion."
        : "영작훈련 중심으로 구성할 것. 한영 전환, 문장 재배열, 영작 완성, 구조 재구성, 단서 기반 영작을 우선할 것.";

    case "magic-card":
      return input.language === "en"
        ? "Use compact, repeatable, workbook-card style items suitable for repeated drilling."
        : "반복 훈련이 가능한 카드형 워크북 문항으로 구성할 것.";

    case "textbook-grammar":
      return input.language === "en"
        ? "Align tasks with textbook grammar learning and school-friendly progression."
        : "교과서 문법 흐름과 내신 학습에 맞는 단계형 훈련으로 구성할 것.";

    case "chapter-grammar":
      return input.language === "en"
        ? "Organize items around chapter-based grammar mastery and reinforcement."
        : "챕터별 문법 포인트를 중심으로 누적 복습이 가능하게 구성할 것.";

    case "magic":
    default:
      return input.language === "en"
        ? "Create premium workbook-style English training material with clear learning value."
        : "프리미엄 워크북형 영어 훈련 자료로 구성할 것.";
  }
}

function buildUserPrompt(input) {
  const title = buildMagicTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  const taskGuide = buildTaskGuide(input);

  if (input.language === "en") {
    return `
Generate a Magic-style English workbook with the following conditions.

Title: ${title}
Engine: magic
Level: ${input.level}
Grade label: ${input.gradeLabel}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Exam type: ${input.examType}
Difficulty: ${input.difficulty} (${difficultyLabel})
Item count: ${input.count}
Academy name: ${input.academyName}

Requirements:
- This should feel like a premium educational workbook, not generic AI text.
- Keep the set consistent in level and format.
- Provide clear answers or model responses in the answer section.
- Avoid unnecessary multiple-choice unless the request strongly calls for it.
- ${taskGuide}

Original user request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim();
  }

  return `
다음 조건에 맞는 마커스매직 스타일 영어 워크북 세트를 생성하시오.

제목: ${title}
엔진: magic
학년 수준: ${input.level}
학년 표기: ${input.gradeLabel}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
유형: ${input.examType}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
학원명: ${input.academyName}

필수 요구사항:
- 결과물은 일반 AI 문장이 아니라 실제 학습용 워크북처럼 보여야 한다.
- 세트 전체의 난이도와 형식을 일정하게 유지할 것.
- 정답 또는 예시답안을 반드시 별도 섹션에 제시할 것.
- 사용자가 강하게 요구하지 않는 한 불필요한 객관식은 피할 것.
- ${taskGuide}

사용자 원문 요청:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.55,
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new Error("Empty model response");
  }

  return text.trim();
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";

  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;

  if (end === -1) {
    return rawText.slice(from).trim();
  }

  return rawText.slice(from, end).trim();
}

function countItems(text = "") {
  const matches = text.match(/^\s*\d+\./gm) || [];
  return matches.length;
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFallbackSplit(rawText) {
  const cleaned = cleanupText(rawText);
  const answerMatch = cleaned.search(/\n\s*(정답|예시답안|모범답안|answers?)\s*[:\-]?\s*\n?/i);

  if (answerMatch === -1) {
    return {
      title: "",
      instructions: "",
      questions: cleaned,
      answers: "",
    };
  }

  return {
    title: "",
    instructions: "",
    questions: cleaned.slice(0, answerMatch).trim(),
    answers: cleaned.slice(answerMatch).trim(),
  };
}

function formatMagicResponse(rawText, input) {
  const title = cleanupText(
    extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]")
  );
  const instructions = cleanupText(
    extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]")
  );
  const questions = cleanupText(
    extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]")
  );
  const answers = cleanupText(
    extractSection(rawText, "[[ANSWERS]]", null)
  );

  let finalTitle = title || buildMagicTitle(input);
  let finalInstructions = instructions;
  let finalQuestions = questions;
  let finalAnswers = answers;

  if (!finalQuestions) {
    const fallback = buildFallbackSplit(rawText);
    finalTitle = finalTitle || buildMagicTitle(input);
    finalInstructions = fallback.instructions;
    finalQuestions = fallback.questions;
    finalAnswers = fallback.answers;
  }

  const actualCount = countItems(finalQuestions);
  const contentParts = [];

  if (finalTitle) contentParts.push(finalTitle);
  if (finalInstructions) contentParts.push(finalInstructions);
  if (finalQuestions) contentParts.push(finalQuestions);

  const fullParts = [...contentParts];
  if (finalAnswers) {
    fullParts.push(
      input.language === "en" ? "Answers / Model Responses\n" + finalAnswers : "정답 / 예시답안\n" + finalAnswers
    );
  }

  return {
    title: finalTitle,
    instructions: finalInstructions,
    content: cleanupText(contentParts.join("\n\n")),
    answerSheet: cleanupText(finalAnswers),
    fullText: cleanupText(fullParts.join("\n\n")),
    actualCount,
  };
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function resolveChapterKey(input) {
  const text = [input.userPrompt, input.topic, input.worksheetTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const explicitRules = [
    { key: "be_negative", re: /(be동사\s*(의)?부정문|be동사.*부정|be\s*negative|be_negative)/ },
    { key: "do_negative", re: /(일반동사\s*(의)?부정문|일반동사.*부정|do\s*negative|do_negative)/ },
    { key: "be_question", re: /(be동사\s*(의)?의문문|be동사.*의문|be\s*question|be_question)/ },
    { key: "do_question", re: /(일반동사\s*(의)?의문문|일반동사.*의문|do\s*question|do_question)/ },
    { key: "wh_question", re: /(의문사\s*(의)?의문문|의문사|wh[\s_-]*question|wh_question)/ },
    { key: "be_verb", re: /(be동사\s*(의)?평서문|be동사\s*평서문|be\s*verb|be_verb)/ },
    { key: "do_verb", re: /(일반동사\s*(의)?평서문|일반동사\s*평서문|do\s*verb|do_verb)/ },
    { key: "modal_will", re: /(조동사\s*will|\bmodal_will\b|\bwill\b)/ },
  ];

  const explicit = explicitRules.find((rule) => rule.re.test(text))?.key;
  if (explicit) return explicit;
  if (/일반동사/.test(text) && /(평서문|서술문)/.test(text) && !/의문사|의문문|부정문/.test(text)) {
    return "do_verb";
  }

  if (/be동사/.test(text) && /평서문/.test(text) && !/의문문|부정문/.test(text)) {
    return "be_verb";
  }

  if (input.requestedChapterKey && FILE_MAP[input.requestedChapterKey]) {
    return input.requestedChapterKey;
  }

  return "";
}

async function loadSentenceBank(chapterKey) {
  const fileName = FILE_MAP[chapterKey];
  if (!fileName) return [];
  try {
    const fullPath = path.join(process.cwd(), "data", "sentence_bank", "middle1", fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    return [];
  }
}

function selectBankItems(bank, count) {
  const shuffled = shuffle(bank);
  const unique = uniqBy(shuffled, (item) => `${String(item.english || "").toLowerCase()}__${String(item.korean || "").toLowerCase()}`);
  if (unique.length >= count) return unique.slice(0, count);

  const out = [...unique];
  let cursor = 0;
  while (out.length < count && unique.length > 0) {
    const source = unique[cursor % unique.length];
    out.push({ ...source, _reused: true, _slot: out.length + 1 });
    cursor += 1;
  }
  return out;
}

function pickExtraWord(item) {
  const pool = Array.isArray(item.extraClueWordPool) ? item.extraClueWordPool : [];
  if (!pool.length) return "";
  const clueText = (Array.isArray(item.clueUnits) ? item.clueUnits.join(" ") : "").toLowerCase();
  const english = String(item.english || "").toLowerCase();
  const candidates = pool.filter((word) => {
    const w = String(word || "").toLowerCase().trim();
    return w && !clueText.includes(w) && !english.includes(w);
  });
  const finalPool = candidates.length ? candidates : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

function buildGuidedClue(item) {
  const units = Array.isArray(item.clueUnits) && item.clueUnits.length
    ? [...item.clueUnits]
    : String(item.english || "")
        .replace(/[?.!]/g, "")
        .split(/\s+/)
        .filter(Boolean);

  const extra = pickExtraWord(item);
  const parts = extra ? [...units, extra] : units;
  return parts.join(" / ");
}

function replaceFirst(text, searchValue, replacement) {
  const idx = text.indexOf(searchValue);
  if (idx === -1) return text;
  return text.slice(0, idx) + replacement + text.slice(idx + searchValue.length);
}

function normalizeBlankTarget(item) {
  if (Array.isArray(item.blankTargets) && item.blankTargets.length) {
    return String(item.blankTargets[0] || "").trim();
  }
  const words = String(item.english || "").replace(/[?.!]/g, "").split(/\s+/).filter(Boolean);
  return words[words.length - 1] || "";
}

function buildBlankSentence(item) {
  const english = String(item.english || "").trim();
  const target = normalizeBlankTarget(item);
  if (!target) return english;
  return replaceFirst(english, target, "_____");
}

function genericDistractors(item) {
  const english = String(item.english || "").trim();
  const chapterKey = String(item.chapterKey || "");
  const noPunc = english.replace(/[?.!]/g, "");

  if (chapterKey === "be_question") {
    const parts = noPunc.split(/\s+/);
    const aux = parts[0];
    const swappedAux = aux === "Is" ? "Are" : aux === "Are" ? "Is" : "Is";
    return [
      `${swappedAux} ${parts.slice(1).join(" ")}?`,
      `${parts.slice(1).join(" ")}?`,
      `${parts.slice(1).join(" ")}.`,
    ];
  }

  if (chapterKey === "do_question" || chapterKey === "wh_question") {
    const parts = noPunc.split(/\s+/);
    const first = parts[0];
    if (first === "Do" || first === "Does") {
      const swapped = first === "Do" ? "Does" : "Do";
      return [
        `${swapped} ${parts.slice(1).join(" ")}?`,
        `${parts.slice(1).join(" ")}?`,
        `${parts.slice(1).join(" ")}.`,
      ];
    }
    return [`${noPunc}?`, `${noPunc}.`, noPunc];
  }

  if (chapterKey === "modal_will") {
    return [
      noPunc.replace(/\bwill\b/i, "do"),
      noPunc.replace(/\bwill\b/i, "").replace(/\s+/g, " ").trim() + ".",
      `Will ${noPunc.replace(/^\S+\s*/, "")}?`.replace(/\s+/g, " "),
    ];
  }

  if (chapterKey === "be_negative" || chapterKey === "do_negative") {
    const withoutNot = noPunc.replace(/\bnot\b/i, "").replace(/\s+/g, " ").trim();
    return [
      `${withoutNot}.`,
      `${withoutNot}?`,
      noPunc.replace(/\bis\b/i, "are").replace(/\s+/g, " ").trim() + ".",
    ];
  }

  if (chapterKey === "be_verb" || chapterKey === "do_verb") {
    const withoutBe = noPunc.replace(/\bis\b/i, "").replace(/\bare\b/i, "").replace(/\bam\b/i, "").replace(/\s+/g, " ").trim();
    return [
      `${noPunc}?`,
      `Do ${noPunc.toLowerCase()}?`,
      `${withoutBe}.`,
    ];
  }

  return [`${noPunc}?`, `${noPunc}.`, noPunc];
}

function buildChoiceSet(item) {
  const correct = String(item.english || "").trim();
  const seeds = item.distractorSeeds || {};
  const candidateDistractors = [
    seeds.auxError,
    seeds.statementForm,
    seeds.fragmentForm,
    ...genericDistractors(item),
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .filter((v) => v.toLowerCase() !== correct.toLowerCase());

  const distractors = uniqBy(candidateDistractors, (v) => v.toLowerCase()).slice(0, 3);
  while (distractors.length < 3) {
    distractors.push(`${correct.replace(/[?.!]/g, "")}?`);
  }

  const combined = shuffle([
    { text: correct, isAnswer: true },
    ...distractors.slice(0, 3).map((text) => ({ text, isAnswer: false })),
  ]);

  const answerIndex = combined.findIndex((choice) => choice.isAnswer) + 1;
  return { choices: combined, answerIndex };
}

function buildDbTitle(input, chapterLabel) {
  if (input.worksheetTitle) return input.worksheetTitle;
  const workbookTypeLabel = input.workbookType === "blank_fill"
    ? "blank fill"
    : input.workbookType === "choice"
      ? "choice"
      : "guided writing";
  return `${input.gradeLabel} ${chapterLabel} ${workbookTypeLabel} 워크북 1`;
}

function buildDbInstructions(input, chapterLabel) {
  const base = input.language === "en"
    ? `Build a ${input.workbookType} worksheet for ${chapterLabel}.`
    : `${chapterLabel} 단원 기반의 ${input.workbookType} 워크북입니다.`;

  if (input.workbookType === "guided_writing") {
    return input.language === "en"
      ? `${base} One clue word is extra. Use the clue words to write the correct English sentence.`
      : `${base} clue의 영어 단어/표현을 활용해 올바른 영어 문장을 쓰시오. clue에는 남는 단어 1개가 포함될 수 있다.`;
  }

  if (input.workbookType === "blank_fill") {
    return input.language === "en"
      ? `${base} Fill in the blank to complete the correct English sentence.`
      : `${base} 빈칸에 알맞은 말을 써서 올바른 영어 문장을 완성하시오.`;
  }

  return input.language === "en"
    ? `${base} Choose the correct English sentence.`
    : `${base} 가장 알맞은 영어 문장을 고르시오.`;
}

function renderDbQuestion(item, index, workbookType) {
  const number = `${index}.`;

  if (workbookType === "guided_writing") {
    return [
      `${number} ${item.korean}`,
      `clue: ${buildGuidedClue(item)}`,
      `word count: ${item.wordCount}`,
    ].join("\n");
  }

  if (workbookType === "blank_fill") {
    return [
      `${number} ${buildBlankSentence(item)}`,
      `clue: ${item.korean}`,
      `word count: ${item.wordCount}`,
    ].join("\n");
  }

  const choiceSet = buildChoiceSet(item);
  item._choiceAnswerIndex = choiceSet.answerIndex;
  const choiceLines = choiceSet.choices.map((choice, idx) => `${idx + 1}) ${choice.text}`);
  return [`${number} ${item.korean}`, ...choiceLines].join("\n");
}

function renderDbAnswer(item, index, workbookType) {
  if (workbookType === "choice") {
    return `${index}. ${item._choiceAnswerIndex}) ${item.english}`;
  }
  return `${index}. ${item.english}`;
}

function buildDbWorksheet(input, bank, chapterKey) {
  const chapterLabel = bank[0]?.chapterLabelKo || chapterKey;
  const title = buildDbTitle(input, chapterLabel);
  const instructions = buildDbInstructions(input, chapterLabel);
  const selected = selectBankItems(bank, input.count);
  const questions = selected.map((item, idx) => renderDbQuestion(item, idx + 1, input.workbookType)).join("\n\n");
  const answers = selected.map((item, idx) => renderDbAnswer(item, idx + 1, input.workbookType)).join("\n");
  const content = cleanupText([title, instructions, questions].filter(Boolean).join("\n\n"));
  const fullText = cleanupText([title, instructions, questions, `정답 / 예시답안\n${answers}`].filter(Boolean).join("\n\n"));

  return {
    title,
    instructions,
    content,
    answerSheet: answers,
    fullText,
    actualCount: selected.length,
    chapterKey,
    chapterLabel,
    source: "db",
  };
}

function buildMeta(input, actualCount, extra = {}) {
  return {
    language: input.language,
    examType: input.examType,
    requestedCount: input.count,
    actualCount,
    generatedAt: new Date().toISOString(),
    workbookType: input.workbookType,
    ...extra,
  };
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const input = normalizeInput(req.body || {});

    if (!input.userPrompt && !input.topic) {
      return json(res, 400, {
        success: false,
        error: "INVALID_REQUEST",
        message: "userPrompt 또는 topic이 필요합니다.",
      });
    }

    const chapterKey = resolveChapterKey(input);
    if (chapterKey && FILE_MAP[chapterKey]) {
      const bank = await loadSentenceBank(chapterKey);
      if (bank.length > 0) {
        const formatted = buildDbWorksheet(input, bank, chapterKey);
        const meta = buildMeta(input, formatted.actualCount, {
          source: formatted.source,
          chapterKey: formatted.chapterKey,
          chapterLabel: formatted.chapterLabel,
        });

        return json(res, 200, {
          success: true,
          engine: input.engine,
          title: formatted.title,
          level: input.level,
          mode: input.mode,
          topic: formatted.chapterLabel,
          difficulty: input.difficulty,
          count: input.count,
          academyName: input.academyName,
          instructions: formatted.instructions,
          content: formatted.content,
          answerSheet: formatted.answerSheet,
          fullText: formatted.fullText,
          meta,
        });
      }
    }

    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);
    const rawText = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatMagicResponse(rawText, input);
    const meta = buildMeta(input, formatted.actualCount, { source: "openai" });

    return json(res, 200, {
      success: true,
      engine: input.engine,
      title: formatted.title,
      level: input.level,
      mode: input.mode,
      topic: input.topic,
      difficulty: input.difficulty,
      count: input.count,
      academyName: input.academyName,
      instructions: formatted.instructions,
      content: formatted.content,
      answerSheet: formatted.answerSheet,
      fullText: formatted.fullText,
      meta,
    });
  } catch (error) {
    console.error("generate-magic error:", error);

    return json(res, 500, {
      success: false,
      error: "GENERATION_FAILED",
      message: "매직 워크북 생성에 실패했습니다.",
      detail: error?.message || "Unknown error",
    });
  }
}
