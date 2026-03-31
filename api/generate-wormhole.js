// api/generate-wormhole.js

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

  if (/초등|초[1-6]|abc\s*starter|elementary/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|모의고사|high/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";

  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();

  if (/최고난도|고난도|극상|advanced|extreme/.test(t)) return "advanced";
  if (/변형|transform|rewrite|재구성/.test(t)) return "transform";
  if (/내신|학교시험|중간고사|기말고사|school/.test(t)) return "school-exam";

  return "grammar";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();

  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";

  return "high";
}

function inferTopic(text = "") {
  const t = String(text || "");

  const topicPatterns = [
    "현재완료",
    "현재진행형",
    "과거완료",
    "수동태",
    "관계대명사",
    "관계부사",
    "동명사",
    "to부정사",
    "가정법",
    "비교급",
    "최상급",
    "수일치",
    "조동사",
    "시제",
    "접속사",
    "분사",
    "분사구문",
    "부정대명사",
    "대명사",
    "명사절",
    "형용사절",
    "부사절",
    "전치사",
    "도치",
    "강조구문",
  ];

  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }

  const lower = t.toLowerCase();

  if (/present perfect/.test(lower)) return "현재완료";
  if (/passive/.test(lower)) return "수동태";
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/gerund/.test(lower)) return "동명사";
  if (/infinitive|to-infinitive/.test(lower)) return "to부정사";
  if (/subjunctive/.test(lower)) return "가정법";
  if (/tense/.test(lower)) return "시제";

  return "문법 종합";
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
  ]
    .filter(Boolean)
    .join(" ");

  const level = ["elementary", "middle", "high"].includes(body.level)
    ? body.level
    : inferLevel(mergedText);

  const mode = ["grammar", "transform", "school-exam", "advanced"].includes(body.mode)
    ? body.mode
    : inferMode(mergedText);

  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);

  const language = ["ko", "en"].includes(body.language)
    ? body.language
    : inferLanguage(mergedText);

  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || "") || "school";
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const engine = "wormhole";
  const gradeLabel = inferGradeLabel(mergedText, level);

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
  return "기본난도";
}

function getModeLabel(mode, language = "ko") {
  if (language === "en") {
    if (mode === "advanced") return "Advanced";
    if (mode === "transform") return "Transform";
    if (mode === "school-exam") return "School Exam";
    return "Grammar";
  }

  if (mode === "advanced") return "최고난도형";
  if (mode === "transform") return "변형형";
  if (mode === "school-exam") return "내신형";
  return "문법형";
}

function buildWormholeTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  if (input.language === "en") {
    return `${input.gradeLabel} ${input.topic} Wormhole ${difficultyLabel} ${input.count} Questions`;
  }

  return `${input.gradeLabel} ${input.topic} 마커스웜홀 ${difficultyLabel} ${input.count}문항`;
}

function buildSystemPrompt(input) {
  const isKo = input.language === "ko";

  return isKo
    ? `
당신은 마커스웜홀 전용 시험지 생성 엔진이다.

목표:
- 실제 학교시험/내신/실전 문제지처럼 보이는 영어 문법 문제 세트를 생성한다.
- 정답이 명확하고, 선지는 그럴듯하며, 시험지 품질이 높아야 한다.
- 문항 간 품질 편차를 줄이고, 단순 반복 문형을 피한다.
- 피상적 암기형이 아니라 문법 판단형 문제를 만든다.
- 웜홀답게 문장 구조, 어법, 시제, 관계사, 준동사, 수일치 등을 정교하게 반영한다.

반드시 지킬 출력 규칙:
1. 아래 구분자를 정확히 사용한다.
2. 문제 본문과 정답/해설을 반드시 분리한다.
3. 문항 번호는 1번부터 순서대로 매긴다.
4. 각 문항은 객관식 5지선다형으로 작성한다.
5. 해설은 너무 길지 않되, 핵심 문법 포인트가 드러나야 한다.
6. 영어 문장은 자연스럽고 시험 친화적이어야 한다.
7. 애매한 정답이나 오류 있는 선지는 만들지 않는다.
8. 사용자가 한국어로 요청한 경우, 제목/지시문/해설은 한국어로 작성한다.
9. 문제 수는 정확히 맞춘다.

출력 형식:
[[TITLE]]
(제목 한 줄)

[[INSTRUCTIONS]]
(수험생 안내문 한 단락)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. 정답 번호 - 해설
2. 정답 번호 - 해설
...
`.trim()
    : `
You are the dedicated MARCUS Wormhole worksheet generation engine.

Goals:
- Generate exam-quality English grammar questions.
- Answers must be clear, choices must be plausible, and the set must feel like a real exam.
- Avoid shallow memorization questions.
- Reflect precise grammar judgment, sentence structure awareness, and high test quality.

Mandatory output rules:
1. Use the exact section markers below.
2. Separate the question set from the answer/explanation section.
3. Number questions sequentially starting from 1.
4. Use 5 multiple-choice options for each question.
5. Keep explanations concise but meaningful.
6. Sentences must be natural and exam-appropriate.
7. Avoid ambiguous answers.
8. Match the requested number of questions exactly.

Output format:
[[TITLE]]
(one-line title)

[[INSTRUCTIONS]]
(one paragraph)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. correct option - explanation
2. correct option - explanation
...
`.trim();
}

function buildUserPrompt(input) {
  const title = buildWormholeTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);

  if (input.language === "en") {
    return `
Generate a Wormhole-style English grammar worksheet with the following conditions.

Title: ${title}
Engine: wormhole
Level: ${input.level}
Grade label: ${input.gradeLabel}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Exam type: ${input.examType}
Difficulty: ${input.difficulty} (${difficultyLabel})
Question count: ${input.count}
Academy name: ${input.academyName}

Additional requirements:
- Make it feel like a real school exam or high-quality test worksheet.
- Focus on grammar judgment and precise sentence analysis.
- Use 5-option multiple choice for every question.
- Keep difficulty consistent throughout the set.
- The answer section must include concise explanations.

Original user request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim();
  }

  return `
다음 조건에 맞는 마커스웜홀 스타일 영어 문법 문제 세트를 생성하시오.

제목: ${title}
엔진: wormhole
학년 수준: ${input.level}
학년 표기: ${input.gradeLabel}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
시험 유형: ${input.examType}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
학원명: ${input.academyName}

추가 조건:
- 실제 학교시험 또는 고품질 실전 문제지처럼 보이게 작성할 것
- 문법 판단과 문장 구조 분석이 살아 있게 만들 것
- 모든 문항은 5지선다형으로 작성할 것
- 세트 전체의 난이도를 일정하게 유지할 것
- 정답 섹션에는 간단하지만 핵심적인 해설을 붙일 것

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
      temperature: 0.5,
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

function countQuestions(text = "") {
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
  const answerMatch = cleaned.search(/\n\s*(정답|해설|answers?)\s*[:\-]?\s*\n?/i);

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

function formatWormholeResponse(rawText, input) {
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

  let finalTitle = title || buildWormholeTitle(input);
  let finalInstructions = instructions;
  let finalQuestions = questions;
  let finalAnswers = answers;

  if (!finalQuestions) {
    const fallback = buildFallbackSplit(rawText);
    finalTitle = finalTitle || buildWormholeTitle(input);
    finalInstructions = fallback.instructions;
    finalQuestions = fallback.questions;
    finalAnswers = fallback.answers;
  }

  const actualCount = countQuestions(finalQuestions);
  const contentParts = [];

  if (finalTitle) contentParts.push(finalTitle);
  if (finalInstructions) contentParts.push(finalInstructions);
  if (finalQuestions) contentParts.push(finalQuestions);

  const fullParts = [...contentParts];
  if (finalAnswers) fullParts.push("정답 및 해설\n" + finalAnswers);

  return {
    title: finalTitle,
    instructions: finalInstructions,
    content: cleanupText(contentParts.join("\n\n")),
    answerSheet: cleanupText(finalAnswers),
    fullText: cleanupText(fullParts.join("\n\n")),
    actualCount,
  };
}

function buildMeta(input, actualCount) {
  return {
    language: input.language,
    examType: input.examType,
    requestedCount: input.count,
    actualCount,
    generatedAt: new Date().toISOString(),
  };
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);

    const rawText = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatWormholeResponse(rawText, input);
    const meta = buildMeta(input, formatted.actualCount);

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
    console.error("generate-wormhole error:", error);

    return json(res, 500, {
      success: false,
      error: "GENERATION_FAILED",
      message: "웜홀 문제 생성에 실패했습니다.",
      detail: error?.message || "Unknown error",
    });
  }
}
