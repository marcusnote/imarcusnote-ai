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

function inferPremium(text = "") {
  const t = String(text || "").toLowerCase();
  return /premium|프리미엄|상위권|최상위|고퀄|high-end/.test(t);
}

function inferTopic(text = "") {
  const source = String(text || "");
  const topicPatterns = [
    "현재완료", "현재진행형", "과거완료", "수동태", "관계대명사", "관계부사",
    "동명사", "to부정사", "가정법", "비교급", "최상급", "수일치", "조동사",
    "시제", "접속사", "분사", "분사구문", "부정대명사", "대명사", "명사절",
    "형용사절", "부사절", "전치사", "도치", "강조구문", "어법", "어휘",
    "빈칸추론", "문장삽입", "순서배열", "요약문", "주제", "요지",
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
    sanitizeString(body.qualityMode || ""),
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
  const premium = body.premium === true || inferPremium(mergedText);
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
    premium,
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

function buildPremiumBlock(language = "ko") {
  if (language === "en") {
    return `
[MOCKS PREMIUM MODE]
This is a premium upper-tier transformation mode.
Rules:
- Raise distractor quality significantly.
- Increase implication and inference density.
- Make all answer choices partially plausible.
- Keep clear conceptual linkage to the source while transforming wording and structure strongly.
- The final worksheet must feel like a premium advanced assessment set.
`.trim();
  }

  return `
[MOCKS PREMIUM MODE]
이 모드는 상위권용 프리미엄 변형 모드이다.

규칙:
- 선택지의 부분 타당성을 높일 것.
- 함축과 추론 밀도를 높일 것.
- 모든 선택지를 그럴듯하게 설계할 것.
- 원문과의 개념적 연결감은 유지하되, 표현과 구조는 강하게 변형할 것.
- 결과물은 상위권용 프리미엄 시험지처럼 보여야 한다.
`.trim();
}

function buildSystemPrompt(input) {
  const premiumBlock = input.premium ? "\n\n" + buildPremiumBlock(input.language) + "\n\n" : "\n\n";
  return `
You are the premium transformed reading-exam engine of I•marcusnote.

[ENGINE IDENTITY]
Engine Name: Mocks
Purpose: premium transformed reading worksheet generator
Target: Korean middle/high school exams, CSAT-style mock tests, advanced academy materials
This is NOT a basic workbook generator.
This is a premium transformed exam generator.

[CORE GOAL]
Generate a premium transformed reading worksheet based on the user's source material.
The output must feel like a real school-exam / CSAT-style transformation set.

[CONTROLLED TRANSFORMATION RULE]
The worksheet must be clearly based on the source passage.

However, it must NOT become a completely unrelated new passage.

Strict rules:
- Preserve the core topic, main logic, and central message of the source.
- Maintain recognizable conceptual overlap with the original.
- Students should feel that the worksheet is transformed from the original passage.
- Do NOT copy original sentences directly.
- Rewrite sentence structures substantially.
- Replace wording meaningfully.
- Reorder or regroup supporting details when helpful.
- Change the testing angle while preserving the original intellectual base.

The final result must feel like:
"a professionally transformed version of the original passage"

It must NOT feel like:
- a copied worksheet
- a completely different passage

[QUESTION PHILOSOPHY]
This engine must create exam-quality transformed items.
Therefore:
- do not merely paraphrase superficially
- do not create trivial keyword questions
- do not create predictable distractors
- do not overuse the same stem pattern
- do not simplify into middle-school workbook style unless the user clearly requests a lower level

Instead:
- redesign the testing point
- test interpretation, comparison, implication, inference, attitude, and transformed understanding
- create items that feel written by a real exam writer

[MANDATORY CORE TYPES]
These are central and must be meaningfully included when the passage supports them:
1. Main Idea / 주제
2. Gist / 요지
3. Title / 제목
4. Author's Claim / 주장
5. Author's Attitude / 태도

These must remain distinct.
Do NOT collapse them into one vague type.

[REQUIRED TYPE POOL]
Also include, when appropriate:
- purpose
- implication
- inference
- content agreement / disagreement
- blank inference
- summary completion
- paraphrase
- equivalent expression
- synonym / antonym in context
- sentence insertion
- order arrangement
- flow disruption / awkward sentence
- transformed detail questions

[STRUCTURED EXAM RULE]
For a 25-item full set, follow this structure as closely as possible:

1–3: main idea / gist / title
4–6: claim / purpose / attitude
7–10: implication / inference / meaning interpretation
11–14: detail agreement / disagreement / key detail
15–18: blank / summary / paraphrase
19–21: sentence insertion / order arrangement / flow
22–25: high-difficulty integrated reasoning

If the item count is smaller, compress proportionally while preserving variety.

[DISTRACTOR RULE]
Wrong answers must be plausible.
Use distractors such as:
- partially true but incomplete
- reversed logic
- exaggerated claim
- wrong scope
- tone mismatch
- related but not central
- detail misuse
- unsupported inference

Do NOT make silly or obviously wrong distractors.

[HIGH DIFFICULTY RULE]
If any question is worth 5 points or more, you MUST mark it with [High Difficulty].

High-difficulty items should usually involve:
- inference
- implication
- title
- gist
- attitude
- paraphrase
- summary
- integrated reasoning

[ANTI-REPETITION RULE]
Avoid repeating:
- the same question stem pattern
- the same answer logic
- the same distractor style
- the same cognitive skill too many times

Each item should feel independently designed.

[EXAM FEEL RULE]
The final worksheet must feel like:
- a premium academy material
- a real transformed school exam
- a CSAT-aware mock set
- not an AI-generated repetitive worksheet

${premiumBlock}

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

function buildUserPrompt(input) {
  const title = buildMocksTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  const premiumNote = input.premium
    ? (input.language === "en"
        ? `\nPremium mode is ON.\n- Raise distractor quality.\n- Increase inference and implication density.\n- Make answer choices more competitive.\n`
        : `\n프리미엄 모드 활성화:\n- 선택지의 부분 타당성과 경쟁력을 높일 것.\n- 함축과 추론 밀도를 높일 것.\n- 정답이 키워드만으로 보이지 않게 설계할 것.\n`)
    : "";

  if (input.language === "en") {
    return `
Generate a premium transformed Mock Exam worksheet with the following conditions.

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
${premiumNote}

Mandatory rules:
- The worksheet must clearly feel based on the original source.
- However, do NOT copy the source passage directly.
- Preserve the core topic and message.
- Rewrite wording and structure meaningfully.
- Keep recognizable overlap with the original passage.
- Every question must have exactly 5 options.
- Mark 5pt+ questions with [High Difficulty].
- Ensure meaningful type variety.

Original user request:
${input.userPrompt || "(No additional request provided.)"}
`.trim();
  }

  return `
다음 조건에 맞는 상품형 마커스 모의고사 변형문제를 생성하시오.

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
${premiumNote}

추가 필수 요구사항:
- 결과물은 반드시 원문 기반 변형이라는 느낌이 나야 한다.
- 그러나 입력 지문을 그대로 다시 사용해서는 안 된다.
- 원문의 핵심 주제와 중심 메시지는 유지할 것.
- 문장 구조와 표현은 충분히 새롭게 바꿀 것.
- 학생이 보기에 '원문을 바탕으로 전문적으로 변형했다'는 느낌이 나야 한다.
- 모든 문항은 5지선다형으로 작성할 것.
- 5점 이상 문항은 반드시 [High Difficulty]라고 표기할 것.
- 주제, 요지, 제목, 주장, 태도, 추론, 함축, 요약, 문장삽입, 순서배열 등 유형 다양성을 확보할 것.

사용자 원문 요청:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
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
  if (!text || typeof text !== "string") throw new Error("Empty model response");

  return text.trim();
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  return end === -1 ?
    rawText.slice(from).trim() : rawText.slice(from, end).trim();
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
  const blocks = cleanupText(text).split(/(?=^\s*\d+\.\s+)/gm).map((v) => v.trim()).filter(Boolean);
  if (!blocks.length) return cleanupText(text);
  return blocks.map((block, idx) => block.replace(/^\s*\d+\.\s*/, `${idx + 1}. `)).join("\n\n").trim();
}

function normalizeAnswerNumbering(text = "") {
  const lines = cleanupText(text).split("\n").map((v) => v.trim()).filter(Boolean);
  const numbered = lines.filter((line) => /^\d+\.\s+/.test(line));
  if (!numbered.length) return cleanupText(text);
  return numbered.map((line, idx) => line.replace(/^\d+\.\s*/, `${idx + 1}. `)).join("\n").trim();
}

function buildFallbackSplit(rawText) {
  const cleaned = cleanupText(rawText);
  const answerMatch = cleaned.search(/\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i);
  if (answerMatch === -1) return { title: "", instructions: "", questions: cleaned, answers: "" };
  return {
    title: "",
    instructions: "",
    questions: cleaned.slice(0, answerMatch).trim(),
    answers: cleaned.slice(answerMatch).trim(),
  };
}

function formatMocksResponse(rawText, input) {
  const title = cleanupText(extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]"));
  const instructions = cleanupText(extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]"));
  const questions = cleanupText(extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]"));
  const answers = cleanupText(extractSection(rawText, "[[ANSWERS]]", null));

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

  const contentParts = [finalTitle, finalInstructions, finalQuestions].filter(Boolean);
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
}

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) return null;
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
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
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
  if (!headers) throw new Error("Missing MEMBERSTACK_SECRET_KEY");
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
    headers: { "Content-Type": "application/json" },
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
    member?.customFields?.MP,
    member?.metaData?.MP,
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
  if (!member?.id) {
    throw new Error("Missing member id for MP update");
  }

  const safeNextMp = sanitizeMp(nextMp, 0);
  const currentCustomFields =
    member?.customFields && typeof member.customFields === "object"
      ? member.customFields
      : {};
  const currentMetaData =
    member?.metaData && typeof member.metaData === "object"
      ? member.metaData
      : {};

  const body = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
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
      const verified = await verifyMemberToken(bearer);
      if (verified?.id) {
        member = await getMemberById(verified.id);
      }
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
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, error: "METHOD_NOT_ALLOWED", message: "POST 요청만 허용됩니다." });
  try {
    const input = normalizeInput(req.body || {});
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, error: "INVALID_REQUEST", message: "prompt 또는 topic이 필요합니다." });
    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP가 부족합니다. 업그레이드 후 계속 이용해주세요.", needsUpgrade: true, requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp, trialGranted: mpState.trialGranted });
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
    return json(res, 500, { success: false, error: "GENERATION_FAILED", message: "Mocks Exam 생성에 실패했습니다.", detail: error?.message || "Unknown error" });
  }
}
