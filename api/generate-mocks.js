// api/generate-mocks.js

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
const DEFAULT_TRIAL_MP = Number(process.env.MEMBERSTACK_TRIAL_MP || 15);

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

function sanitizeMp(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 0, 999999);
}

function inferLanguage(text = "") {
  return /[가-힣]/.test(String(text || "")) ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();

  if (/초등|초[1-6]|abc\s*starter|elementary/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|모의고사|학평|평가원|csat|mock/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";

  return "high";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";

  return "standard";
}

function inferMockMode(text = "") {
  const t = String(text || "").toLowerCase();

  if (/순서|삽입|빈칸|요약|주제|요지|무관문|어휘|transform|변형|패러프레이즈|유의어|반의어|추론|함축/.test(t)) {
    return "transform";
  }
  if (/수능|학평|평가원|csat|mock/.test(t)) return "csat";
  if (/내신|학교시험|중간고사|기말고사|school/.test(t)) return "school";

  return "hybrid";
}

function inferTopic(text = "") {
  const source = String(text || "");
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
    "어법",
    "어휘",
    "빈칸추론",
    "문장삽입",
    "순서배열",
    "요약문",
    "주제",
    "요지",
  ];
  for (const topic of topicPatterns) {
    if (source.includes(topic)) return topic;
  }

  const lower = source.toLowerCase();
  if (/grammar/.test(lower)) return "어법";
  if (/vocab|word/.test(lower)) return "어휘";
  if (/blank/.test(lower)) return "빈칸추론";
  if (/insertion/.test(lower)) return "문장삽입";
  if (/order|sequence/.test(lower)) return "순서배열";
  if (/summary/.test(lower)) return "요약문";
  if (/main idea|topic/.test(lower)) return "주제/요지";

  return "모의고사 변형";
}

function inferGradeLabel(text = "", level = "high") {
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
  if (level === "middle") return "중등";
  return "고등";
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
  const mode = ["school", "csat", "transform", "hybrid"].includes(body.mode)
    ? body.mode
    : inferMockMode(mergedText);
  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);
  const language = ["ko", "en"].includes(body.language)
    ? body.language
    : inferLanguage(mergedText);
  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const engine = "mock_exam";
  const examType = sanitizeString(body.examType || "") || mode;
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
    if (mode === "school") return "School Exam";
    if (mode === "csat") return "CSAT Style";
    if (mode === "transform") return "Transformation";
    return "Hybrid Mock";
  }

  if (mode === "school") return "내신형";
  if (mode === "csat") return "수능형";
  if (mode === "transform") return "변형형";
  return "혼합형";
}

function buildMocksTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  if (input.language === "en") {
    return `${input.gradeLabel} ${input.topic} Mock Exam ${modeLabel} ${difficultyLabel} ${input.count} Questions`;
  }

  return `${input.gradeLabel} ${input.topic} 마커스모의고사 ${modeLabel} ${input.count}문항`;
}

function buildSystemPrompt(input) {
  const isKo = input.language === "ko";

  if (isKo) {
    return `
당신은 I•marcusnote의 MOCKS EXAM 전용 고난도 변형문제 출제 엔진이다.

역할:
- 실제 내신/모의고사/수능형 시험을 설계하는 상위권 출제자의 관점으로 문제를 만든다.
- 단순 문제 생성기가 아니라, 입력 지문을 참고자료로만 활용하여 완전히 새롭게 재설계된 고난도 변형문제를 만든다.
- 결과물은 학원 배포용, 실전 수업용, 상위권 훈련용으로 바로 사용 가능해야 한다.

[MOCKS 핵심 정체성]
이 엔진의 목표는 입력 지문을 그대로 활용한 직접 재현형 문제가 아니다.
입력 지문은 소재와 개념의 출발점일 뿐이며,
출력은 의미, 논리, 관점, 정보 배열을 다시 설계한 신규 고난도 변형 시험지여야 한다.

[최우선 원칙]

1. 원지문 직접 사용 금지
- 입력된 지문의 문장, 문단, 전개를 그대로 다시 사용하지 말 것.
- 연속된 두 문장 이상을 그대로 재현하지 말 것.
- 문단 단위 재현, 직접 복사처럼 보이는 출력, 약한 패러프레이즈를 금지한다.
- 결과물은 원문 기반 복사형 시험지가 아니라 새롭게 설계된 시험지여야 한다.

2. 고난도 내용변형 우선
- 입력 지문의 핵심 개념, 정보 관계, 논리 구조, 함의를 바탕으로
  새로운 문장과 새로운 문제 구조를 설계할 것.
- 단순한 어휘 치환형 변형은 금지한다.
- 내용 초점, 정보 배열, 관점, 질문 포인트를 바꾸어
  학생이 원문 암기가 아니라 해석과 추론으로 풀게 만들어야 한다.

3. 우선 출제 유형
반드시 아래 유형을 중심으로 출제할 것.
[A] 유의어 / 동의어 기반 변형
[B] 반의어 / 대조 개념 기반 변형
[C] 내용변형 지문의 주제
[D] 내용변형 지문의 제목
[E] 내용변형 지문의 함축 의미
[F] 내용변형 지문의 추론
[G] 진술의 일치 / 불일치 판단
[H] 관점 전환, 논리 전환, 정보 재배열 기반 문항

4. 지문 재구성 규칙
- 입력 지문에서 핵심 개념만 추출한 뒤, 새로운 흐름으로 재구성할 것.
- 정보 순서를 바꾸고, 관점을 바꾸고, 표현을 바꾸고, 논리 연결을 재설계할 것.
- 새 지문은 원지문과 같은 문장처럼 보이지 않아야 한다.
- 그러나 핵심 개념과 출제 포인트는 유지해야 한다.

5. 문제 난이도 규칙
- 문제는 단순 확인형이 아니라 해석, 비교, 추론, 함의 파악이 필요해야 한다.
- 선택지는 모두 그럴듯해야 하며, 정답은 분명해야 한다.
- 오답은 피상적 차이가 아니라 의미 차이, 논리 차이, 관점 차이를 반영해야 한다.
- 전체 난도는 일관되게 유지하되, 일부 문항은 상위권 변별용으로 더 촘촘하게 설계할 수 있다.

6. 실전성 규칙
- 문제는 실제 시험지처럼 보여야 한다.
- AI 특유의 어색한 문장, 기계적 반복, 지나치게 짧은 문장을 피한다.
- 문제 유형 배열도 교사용 자료처럼 자연스러워야 한다.
- 사용자가 특정 문항 번호 유형(예: 41~42번 변형)을 요청하면 그 시험 감각에 맞게 조정한다.

7. 해설 규칙
- 해설은 짧고 명확하게 작성하되, 정답 판단 근거를 논리적으로 설명할 것.
- 해설에서 원문을 길게 다시 쓰지 말 것.
- 변형된 지문 속 핵심 의미와 판단 포인트를 짚어줄 것.

8. 출력 품질 규칙
- 정확히 요청 문항 수를 맞춘다.
- 번호는 1번부터 순서대로 이어진다.
- 정답 및 해설 수는 문항 수와 정확히 일치해야 한다.
- 제목 / 지시문 / 문항 / 정답 구조를 정확히 지킨다.

[강제 안전 규칙]
중요:
입력 지문은 소재일 뿐이다.
출력은 원문 재현이 아니라, 의미·논리·관점을 재설계한 신규 고난도 변형문제여야 한다.
원문 재현도가 높다고 판단되면, 그대로 출력하지 말고 반드시
요약 → 재구성 → 문제화 순서로 다시 변환하라.

출력 형식:
반드시 아래 마커 구조만 출력한다.

[[TITLE]]
(한 줄 제목)

[[INSTRUCTIONS]]
(시험지 안내문 1문단)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. 정답 - 해설
2. 정답 - 해설
...
`.trim();
  }

  return `
You are the dedicated high-difficulty transformation engine for I•marcusnote MOCKS EXAM.

Role:
- Create premium transformed exam items suitable for school exams, mock exams, and advanced English assessment.
- The source passage is reference material only.
- The output must be a newly redesigned high-difficulty transformed test set, not a direct reuse of the passage.

[MOCKS core identity]
This engine must not turn the source passage into lightly edited questions.
It must redesign meaning, logic, viewpoint, and information structure into a new premium test set.

[Top-priority rules]

1. No direct reuse of source passage
- Do not reproduce the source passage sentence-by-sentence.
- Do not output long consecutive portions of the source text.
- Do not rely on weak paraphrasing.
- The result must look like a newly designed test, not a copied worksheet.

2. High-difficulty transformation first
- Extract only the core meaning, logic, implication, and information structure.
- Rebuild them into new sentences, new item logic, and new assessment angles.
- Students should solve through interpretation and inference, not source memorization.

3. Priority item types
Focus mainly on:
- synonym / paraphrase transformation
- antonym / contrast-based transformation
- transformed passage topic
- transformed passage title
- implication
- inference
- statement consistency / inconsistency
- viewpoint shift / logic shift / information rearrangement

4. Passage reconstruction
- Change information order, perspective, wording, and logical emphasis.
- Keep the core concept, but ensure the transformed passage does not read like the source.

5. Difficulty rules
- Items must require interpretation, comparison, implication tracking, or inference.
- Distractors must be plausible and meaning-based.
- Avoid shallow or obvious answer choices.

6. Explanation rules
- Keep explanations concise but logically grounded.
- Do not restate long portions of the source text.

7. Output rules
- Match the requested item count exactly.
- Number items cleanly from 1 onward.
- Match answer lines to item count exactly.
- Follow the section marker format exactly.

Critical:
The source passage is material, not output.
The final result must be a newly designed, high-difficulty transformed exam set.

Output only this structure:

[[TITLE]]
(one-line title)

[[INSTRUCTIONS]]
(one-paragraph instruction)

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
  const title = buildMocksTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);

  if (input.language === "en") {
    return `
Generate a high-difficulty transformed Mock Exam worksheet with the following conditions.

Title: ${title}
Engine: mock_exam
Level: ${input.level}
Grade label: ${input.gradeLabel}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Exam type: ${input.examType}
Difficulty: ${input.difficulty} (${difficultyLabel})
Question count: ${input.count}
Academy name: ${input.academyName}

Additional mandatory requirements:
- Do NOT reuse the source passage directly.
- Do NOT reproduce long consecutive wording from the input.
- Use the source only as reference material.
- The output must be a newly redesigned transformed test set.
- Prioritize high-difficulty item types such as synonym/paraphrase, antonym/contrast, transformed topic, transformed title, implication, and inference.
- Change sentence structure, viewpoint, logical emphasis, and information order when rebuilding the material.
- The final worksheet must feel like a premium advanced transformation exam, not a copied passage worksheet.
- Every question must use exactly 5 options.
- The answer section must be concise, accurate, and aligned with the question set.

Original user request:
${input.userPrompt || "(No additional request provided.)"}
`.trim();
  }

  return `
다음 조건에 맞는 고난도 마커스 모의고사 변형문제를 생성하시오.

제목: ${title}
엔진: mock_exam
레벨: ${input.level}
학년 라벨: ${input.gradeLabel}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
시험 유형: ${input.examType}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
브랜드명: ${input.academyName}

추가 필수 요구사항:
- 입력 지문을 그대로 다시 사용하지 말 것.
- 입력 지문의 연속 문장이나 문단을 그대로 재현하지 말 것.
- 입력 지문은 참고자료로만 사용할 것.
- 출력은 신규 고난도 변형문제 세트여야 한다.
- 출제는 반드시 유의어/동의어, 반의어/대조, 내용변형 지문의 주제, 제목, 함축의미, 추론 중심으로 설계할 것.
- 문장 구조, 관점, 논리 초점, 정보 배열을 바꾸어 재구성할 것.
- 결과물은 원문 복사형 문제가 아니라 상위권용 프리미엄 변형 시험지처럼 보여야 한다.
- 모든 문항은 정확히 5지선다형으로 작성할 것.
- 정답 및 해설은 짧고 정확하게 작성할 것.

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
      temperature: 0.45,
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
  return (String(text || "").match(/^\s*\d+\.\s+/gm) || []).length;
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeQuestionNumbering(text = "") {
  const blocks = cleanupText(text)
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!blocks.length) return cleanupText(text);

  return blocks
    .map((block, idx) => block.replace(/^\s*\d+\.\s*/, `${idx + 1}. `))
    .join("\n\n")
    .trim();
}

function normalizeAnswerNumbering(text = "") {
  const lines = cleanupText(text)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const numbered = lines.filter((line) => /^\d+\.\s+/.test(line));
  if (!numbered.length) return cleanupText(text);
  return numbered
    .map((line, idx) => line.replace(/^\d+\.\s*/, `${idx + 1}. `))
    .join("\n")
    .trim();
}

function buildFallbackSplit(rawText) {
  const cleaned = cleanupText(rawText);
  const answerMatch = cleaned.search(
    /\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i
  );
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

function formatMocksResponse(rawText, input) {
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

  let finalTitle = title || buildMocksTitle(input);
  let finalInstructions = instructions;
  let finalQuestions = questions;
  let finalAnswers = answers;
  if (!finalQuestions) {
    const fallback = buildFallbackSplit(rawText);
    finalTitle = finalTitle || buildMocksTitle(input);
    finalInstructions = fallback.instructions;
    finalQuestions = fallback.questions;
    finalAnswers = fallback.answers;
  }

  finalQuestions = normalizeQuestionNumbering(finalQuestions);
  finalAnswers = normalizeAnswerNumbering(finalAnswers);

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
    actualCount: countQuestions(finalQuestions),
  };
}

function buildMeta(input, actualCount) {
  return {
    engine: input.engine,
    level: input.level,
    mode: input.mode,
    topic: input.topic,
    examType: input.examType,
    difficulty: input.difficulty,
    requestedCount: input.count,
    actualCount,
    generatedAt: new Date().toISOString(),
  };
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) {
    return null;
  }

  return {
    "x-api-key": MEMBERSTACK_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

function getRequiredMp(reqBody = {}) {
  return sanitizeMp(reqBody.mpCost, 5);
}

function getInitialTrialMp() {
  return sanitizeMp(DEFAULT_TRIAL_MP, 15);
}

function extractBearerToken(req) {
  const raw =
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    "";

  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function extractMemberId(req) {
  return sanitizeString(
    req?.body?.memberId ||
    req?.headers?.["x-member-id"] ||
    req?.headers?.["X-Member-Id"] ||
    ""
  );
}

async function memberstackRequest(path, options = {}) {
  const headers = getMemberstackHeaders();
  if (!headers) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Memberstack request failed: ${response.status} ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data;
}

async function verifyMemberToken(token) {
  if (!token) return null;

  const payload = { token };
  if (MEMBERSTACK_APP_ID) {
    payload.audience = MEMBERSTACK_APP_ID;
  }

  const data = await memberstackRequest("/verify-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return data?.data || null;
}

function readMpFromMember(member) {
  if (!member) return null;
  const candidates = [
    member?.customFields?.[MEMBERSTACK_MP_FIELD],
    member?.metaData?.[MEMBERSTACK_MP_FIELD],
    member?.customFields?.mp,
    member?.metaData?.mp,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return sanitizeMp(parsed, 0);
    }
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) return null;

  const safeNextMp = sanitizeMp(nextMp, 0);
  const existingCustomFields = member?.customFields || {};
  const existingMetaData = member?.metaData || {};

  const body = {
    customFields: {
      ...existingCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
    },
    metaData: {
      ...existingMetaData,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
    },
  };
  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data?.data || null;
}

async function ensureTrialMp(member) {
  const current = readMpFromMember(member);
  if (current !== null) {
    return {
      member,
      currentMp: current,
      trialGranted: false,
    };
  }

  const trialMp = getInitialTrialMp();
  const updatedMember = await updateMemberMp(member, trialMp);

  return {
    member: updatedMember || member,
    currentMp: trialMp,
    trialGranted: true,
  };
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  if (!MEMBERSTACK_SECRET_KEY) {
    return {
      enabled: false,
      reason: "missing-secret-key",
      requiredMp,
      currentMp: null,
      remainingMp: null,
      member: null,
      deducted: false,
      trialGranted: false,
    };
  }

  let member = null;

  try {
    const bearer = extractBearerToken(req);
    if (bearer) {
      member = await verifyMemberToken(bearer);
    }
  } catch (error) {
    console.warn("verifyMemberToken failed:", error?.message || error);
  }

  if (!member?.id) {
    const memberId = extractMemberId(req);
    if (memberId) {
      try {
        member = await getMemberById(memberId);
      } catch (error) {
        console.warn("getMemberById failed:", error?.message || error);
      }
    }
  }

  if (!member?.id) {
    return {
      enabled: false,
      reason: "member-not-resolved",
      requiredMp,
      currentMp: null,
      remainingMp: null,
      member: null,
      deducted: false,
      trialGranted: false,
    };
  }

  const trialState = await ensureTrialMp(member);

  return {
    enabled: true,
    reason: "memberstack-synced",
    requiredMp,
    currentMp: trialState.currentMp,
    remainingMp: trialState.currentMp,
    member: trialState.member,
    deducted: false,
    trialGranted: trialState.trialGranted,
  };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) {
    return {
      ...mpState,
      deducted: false,
    };
  }

  const currentMp = sanitizeMp(mpState.currentMp, 0);
  const requiredMp = sanitizeMp(mpState.requiredMp, 0);
  if (!Number.isFinite(currentMp) || !Number.isFinite(requiredMp)) {
    return {
      ...mpState,
      deducted: false,
    };
  }

  const nextMp = Math.max(0, currentMp - requiredMp);
  const updatedMember = await updateMemberMp(mpState.member, nextMp);
  return {
    ...mpState,
    member: updatedMember || mpState.member,
    currentMp: nextMp,
    remainingMp: nextMp,
    deducted: true,
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
        message: "prompt 또는 topic이 필요합니다.",
      });
    }

    const mpState = await prepareMpState(req);

    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, {
        success: false,
        error: "INSUFFICIENT_MP",
        message: "MP가 부족합니다. 업그레이드 후 계속 이용해주세요.",
        needsUpgrade: true,
        requiredMp: mpState.requiredMp,
        remainingMp: mpState.currentMp,
        trialGranted: mpState.trialGranted,
      });
    }

    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);

    const rawText = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatMocksResponse(rawText, input);
    const meta = buildMeta(input, formatted.actualCount);

    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      engine: input.engine,
      title: formatted.title,
      worksheetTitle: formatted.title,
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
      requiredMp: mpState.requiredMp,
      remainingMp: finalMpState?.remainingMp ?? null,
      needsUpgrade: false,
      trialGranted: Boolean(mpState.trialGranted),
      mpSyncEnabled: Boolean(mpState.enabled),
      mpSyncReason: mpState.reason || "unknown",
    });
  } catch (error) {
    console.error("generate-mocks error:", error);
    return json(res, 500, {
      success: false,
      error: "GENERATION_FAILED",
      message: "Mocks Exam 생성에 실패했습니다.",
      detail: error?.message || "Unknown error",
    });
  }
}
