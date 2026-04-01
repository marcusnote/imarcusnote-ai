// api/generate-wormhole.js

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

function sanitizeCount(value, fallback = 25) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 5, 30);
}

function sanitizeMp(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(Math.round(num), 0, 999999);
}

function sanitizeDifficulty(value, fallback = "high") {
  const v = sanitizeString(value, fallback).toLowerCase();
  if (["basic", "standard", "high", "extreme"].includes(v)) return v;
  return fallback;
}

function inferLanguage(text = "") {
  return /[가-힣]/.test(String(text || "")) ? "ko" : "en";
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
    "주격 관계대명사",
    "목적격 관계대명사",
    "관계부사",
    "동명사",
    "to부정사",
    "to부정사의 명사적 용법",
    "to부정사의 형용사적 용법",
    "to부정사의 부사적 용법",
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
    "간접의문문",
    "전치사",
    "의문사",
    "주어와 동사의 수일치",
    "5형식",
    "준사역동사",
  ];

  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }

  return "영문법";
}

function sanitizeTitle(title = "", fallbackTopic = "Wormhole Worksheet") {
  const cleaned = String(title || "")
    .replace(/\s+/g, " ")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .trim();

  return cleaned || `${fallbackTopic} 마커스웜홀 고난도 ${new Date().getFullYear()}`;
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countQuestions(text = "") {
  return (String(text || "").match(/^\s*\d+\.\s+/gm) || []).length;
}

function hasFiveChoicePattern(text = "") {
  const source = String(text || "");
  return /①[\s\S]*②[\s\S]*③[\s\S]*④[\s\S]*⑤/.test(source);
}

function normalizeQuestionBlocks(text = "", requestedCount = 25) {
  const blocks = cleanupText(text)
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!blocks.length) return cleanupText(text);

  return blocks
    .slice(0, requestedCount)
    .map((block, idx) => block.replace(/^\s*\d+\.\s*/, `${idx + 1}. `))
    .join("\n\n")
    .trim();
}

function normalizeAnswerSheet(text = "", requestedCount = 25) {
  const lines = cleanupText(text)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const numbered = lines.filter((line) => /^\d+\.\s+/.test(line));
  if (!numbered.length) return cleanupText(text);

  return numbered
    .slice(0, requestedCount)
    .map((line, idx) => line.replace(/^\d+\.\s*/, `${idx + 1}. `))
    .join("\n")
    .trim();
}

function splitQuestionsAndAnswers(raw = "") {
  const text = cleanupText(raw);

  const answerIdx = text.search(/\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i);
  if (answerIdx === -1) {
    return { body: text, answerSheet: "" };
  }

  return {
    body: text.slice(0, answerIdx).trim(),
    answerSheet: text.slice(answerIdx).trim(),
  };
}

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";

  const from = start + startMarker.length;
  const end = endMarker ? text.indexOf(endMarker, from) : -1;

  if (end === -1) return text.slice(from).trim();
  return text.slice(from, end).trim();
}

function parseModelOutput(raw = "", fallbackTitle = "", fallbackInstruction = "") {
  const cleaned = cleanupText(raw);

  const title = extractSection(cleaned, "[[TITLE]]", "[[INSTRUCTIONS]]") || fallbackTitle;
  const instructions =
    extractSection(cleaned, "[[INSTRUCTIONS]]", "[[QUESTIONS]]") || fallbackInstruction;
  const questions = extractSection(cleaned, "[[QUESTIONS]]", "[[ANSWERS]]");
  const answers = extractSection(cleaned, "[[ANSWERS]]", null);

  if (questions) {
    return {
      title: cleanupText(title),
      instructions: cleanupText(instructions),
      questions: cleanupText(questions),
      answers: cleanupText(answers),
    };
  }

  const fallbackSplit = splitQuestionsAndAnswers(cleaned);
  return {
    title: cleanupText(title || fallbackTitle),
    instructions: cleanupText(instructions || fallbackInstruction),
    questions: cleanupText(fallbackSplit.body),
    answers: cleanupText(fallbackSplit.answerSheet),
  };
}

function buildFullText(title, instructions, questions, answers) {
  const parts = [];
  if (title) parts.push(title);
  if (instructions) parts.push(instructions);
  if (questions) parts.push(questions);
  if (answers) parts.push("정답 및 해설\n" + answers);
  return cleanupText(parts.join("\n\n"));
}

function extractLeadInstruction(prompt = "", language = "ko", count = 25, topic = "영문법") {
  if (language === "ko") {
    return `다음 문항을 읽고 가장 알맞은 답을 고르시오. 총 ${count}문항이며, 모든 문항은 5지선다형입니다. 주제는 ${topic}입니다.`;
  }
  return `Read each item carefully and choose the best answer. Total ${count} items, and every item must be 5-choice multiple-choice on ${topic}.`;
}

function buildSystemPrompt(language = "ko") {
  if (language === "ko") {
    return `
당신은 I•marcusnote의 WORMHOLE 전용 고난도 문항 생성 엔진이다.

역할:
- 중등/고등 문법 단원 중심의 고난도 워크시트를 만든다.
- 교사가 바로 배포 가능한 완성형 결과만 출력한다.
- WORMHOLE은 반드시 판별형, 선택형, 개수형 중심이어야 한다.

웜홀 정체성:
- WORMHOLE = 고난도 문법 판별 · 오류 탐지 · 선지 비교 · 개수 판단
- 반드시 5지선다형 시험지 형식
- 단순 영작, 단순 변형, 빈칸 채우기, 서술형 수정 문제 금지
- 학생이 선택지를 비교하고 문법적으로 판단해야 하는 구조여야 한다

절대 규칙:
1. 요청 문항 수를 정확히 맞춘다.
2. 모든 문항은 반드시 5지선다형이다.
3. 각 문항은 반드시 아래 구조를 따른다:
   1. 문제문
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
4. 허용 문항 유형:
   - 다음 중 어법상 올바른 문장은?
   - 다음 중 어법상 어색한 문장은?
   - 다음 중 옳은 것을 모두 고른 것은?
   - 다음 중 올바른 문장의 개수는?
   - 다음 중 최소 수정으로 바르게 고친 것은?
5. 금지 문항 유형:
   - 문장을 변형하세요
   - 빈칸을 채우세요
   - 오류를 직접 고쳐 쓰세요
   - 주관식 서술형
6. 선택지는 실제 학생이 헷갈리는 문법 포인트를 반영해야 한다.
7. 개수형 문항은 실제 개수를 다시 계산한 뒤 정답을 적는다.
8. 정답은 각 문항마다 하나만 존재해야 한다.
9. 출력은 반드시 아래 블록 구조를 따른다.
10. 마크다운 코드펜스 금지
11. 불필요한 설명, 사족 금지

출력 구조:
[[TITLE]]
제목

[[INSTRUCTIONS]]
지시문

[[QUESTIONS]]
1. 문제문
① ...
② ...
③ ...
④ ...
⑤ ...

2. 문제문
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - 짧은 근거
2. ⑤ - 짧은 근거
...
`.trim();
  }

  return `
You are the dedicated WORMHOLE engine for I•marcusnote.

Role:
- Create high-difficulty grammar worksheets for middle/high school learners.
- Output only teacher-ready final worksheet text.
- WORMHOLE must be judgment-based, choice-based, and count-based.

Wormhole identity:
- WORMHOLE = advanced grammar judgment, error detection, option comparison, count logic
- Every item must be 5-choice multiple-choice
- No simple rewriting, no fill-in-the-blank, no open-ended correction

Hard rules:
1. Match the requested item count exactly.
2. Every item must be 5-choice multiple-choice.
3. Every item must follow this structure:
   1. Question
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
4. Allowed item types:
   - Which sentence is grammatically correct?
   - Which sentence is awkward?
   - Which choice includes only correct sentences?
   - How many sentences are correct?
   - Which revision is the minimal correct fix?
5. Forbidden item types:
   - Rewrite the sentence
   - Fill in the blank
   - Correct the sentence in writing
   - Open-ended subjective items
6. Distractors must target realistic grammar confusions.
7. Recalculate count-based items before finalizing answers.
8. Exactly one answer per item.
9. Follow the block structure below.
10. No markdown fences.
11. No extra commentary.

Required output format:
[[TITLE]]
Title

[[INSTRUCTIONS]]
Instruction

[[QUESTIONS]]
1. Question
① ...
② ...
③ ...
④ ...
⑤ ...

2. Question
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - brief reason
2. ⑤ - brief reason
...
`.trim();
}

function buildUserPrompt({
  prompt,
  worksheetTitle,
  language,
  requestedCount,
  topic,
  level,
  mode,
  difficulty,
}) {
  const guide =
    language === "ko"
      ? `
사용자 요청:
${prompt || "(없음)"}

설정값:
- 제목: ${worksheetTitle}
- 언어: ${language}
- 요청 문항 수: ${requestedCount}
- 주제: ${topic}
- 학년 추정: ${level}
- 웜홀 세부 모드: ${mode}
- 난이도: ${difficulty}

추가 생성 지시:
- 반드시 5지선다형으로만 작성하라.
- 모든 문항에 ① ② ③ ④ ⑤가 들어가야 한다.
- 변형형, 빈칸형, 직접수정형, 서술형 금지.
- 단원 핵심 문법 포인트를 선지 비교형으로 평가하라.
- 정답은 번호 + 짧은 근거로 작성하라.
- 최종 결과는 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 블록으로만 출력하라.
`
      : `
User request:
${prompt || "(none)"}

Settings:
- Title: ${worksheetTitle}
- Language: ${language}
- Requested count: ${requestedCount}
- Topic: ${topic}
- Estimated level: ${level}
- Wormhole mode: ${mode}
- Difficulty: ${difficulty}

Additional generation rules:
- Output only 5-choice multiple-choice items.
- Every item must contain ① ② ③ ④ ⑤.
- No rewriting, no blanks, no direct sentence correction, no subjective items.
- Evaluate the grammar target through option comparison.
- Answers must be answer number + brief reason.
- Output only the required [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] blocks.
`;

  return guide.trim();
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
      temperature: 0.35,
      max_tokens: 3900,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed");
  }

  return String(data?.choices?.[0]?.message?.content || "").trim();
}

function getMemberId(req) {
  const headerId =
    req.headers["x-member-id"] ||
    req.headers["X-Member-Id"] ||
    req.body?.memberId ||
    "";

  return sanitizeString(Array.isArray(headerId) ? headerId[0] : headerId);
}

async function memberstackRequest(path, options = {}) {
  if (!MEMBERSTACK_SECRET_KEY || !MEMBERSTACK_APP_ID) {
    throw new Error("Missing Memberstack environment variables");
  }

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": MEMBERSTACK_SECRET_KEY,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Memberstack request failed");
  }

  return data;
}

function readMpFromMember(memberData) {
  const customFields = memberData?.data?.customFields || memberData?.customFields || {};
  const raw = customFields?.[MEMBERSTACK_MP_FIELD];

  if (raw === null || raw === undefined || raw === "") return DEFAULT_TRIAL_MP;
  const num = Number(raw);
  return Number.isFinite(num) ? num : DEFAULT_TRIAL_MP;
}

async function fetchMember(memberId) {
  if (!memberId) return null;
  return memberstackRequest(`/${MEMBERSTACK_APP_ID}/${memberId}`, { method: "GET" });
}

async function updateMemberMp(memberId, nextMp) {
  if (!memberId) return null;

  return memberstackRequest(`/${MEMBERSTACK_APP_ID}/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({
      customFields: {
        [MEMBERSTACK_MP_FIELD]: String(nextMp),
      },
    }),
  });
}

async function maybeDeductMp(req, requestedMpCost) {
  const memberId = getMemberId(req);

  if (!memberId) {
    return {
      skipped: true,
      memberId: "",
      beforeMp: null,
      afterMp: null,
      chargedMp: 0,
    };
  }

  const member = await fetchMember(memberId);
  const beforeMp = readMpFromMember(member);
  const mpCost = sanitizeMp(requestedMpCost, 5);

  if (beforeMp < mpCost) {
    const error = new Error("MP가 부족합니다.");
    error.code = "INSUFFICIENT_MP";
    error.beforeMp = beforeMp;
    error.requiredMp = mpCost;
    throw error;
  }

  const afterMp = beforeMp - mpCost;
  await updateMemberMp(memberId, afterMp);

  return {
    skipped: false,
    memberId,
    beforeMp,
    afterMp,
    chargedMp: mpCost,
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

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const prompt = sanitizeString(req.body?.prompt || "");
    const requestedCount = sanitizeCount(req.body?.count || 25, 25);
    const requestedMpCost = sanitizeMp(req.body?.mpCost || 5, 5);

    const language =
      ["ko", "en"].includes(req.body?.language) ? req.body.language : inferLanguage(prompt);

    const inferredTopic = inferTopic(`${req.body?.worksheetTitle || ""}\n${prompt}`);
    const worksheetTitle = sanitizeTitle(
      req.body?.worksheetTitle || "",
      `${inferredTopic} 마커스웜홀 고난도 ${requestedCount}문항`
    );

    const level = inferLevel(prompt);
    const mode = sanitizeString(req.body?.mode || inferMode(prompt) || "grammar");
    const difficulty = sanitizeDifficulty(
      req.body?.difficulty || inferDifficulty(prompt),
      "high"
    );

    if (!prompt) {
      return json(res, 400, {
        success: false,
        error: "INVALID_PROMPT",
        message: "prompt가 비어 있습니다.",
      });
    }

    const mpResult = await maybeDeductMp(req, requestedMpCost);

    const systemPrompt = buildSystemPrompt(language);
    const userPrompt = buildUserPrompt({
      prompt,
      worksheetTitle,
      language,
      requestedCount,
      topic: inferredTopic,
      level,
      mode,
      difficulty,
    });

    const rawModelOutput = await callOpenAI(systemPrompt, userPrompt);

    const fallbackInstruction = extractLeadInstruction(
      prompt,
      language,
      requestedCount,
      inferredTopic
    );

    const parsed = parseModelOutput(rawModelOutput, worksheetTitle, fallbackInstruction);

    const normalizedQuestions = normalizeQuestionBlocks(parsed.questions, requestedCount);
    const actualQuestionCount = countQuestions(normalizedQuestions);
    const normalizedAnswers = normalizeAnswerSheet(parsed.answers, actualQuestionCount || requestedCount);

    const fullText = buildFullText(
      parsed.title || worksheetTitle,
      parsed.instructions || fallbackInstruction,
      normalizedQuestions,
      normalizedAnswers
    );

    const mustReview =
      !hasFiveChoicePattern(normalizedQuestions) ||
      /변형하세요|빈칸|채우세요|수정하세요|rewrite|fill in the blank|correct the sentence/i.test(
        normalizedQuestions
      );

    return json(res, 200, {
      success: true,
      engine: "wormhole",
      title: parsed.title || worksheetTitle,
      topic: inferredTopic,
      level,
      mode,
      difficulty,
      language,
      requestedCount,
      actualCount: actualQuestionCount || requestedCount,
      chargedMp: mpResult.chargedMp,
      remainingMp: mpResult.afterMp,
      instructions: parsed.instructions || fallbackInstruction,
      content: cleanupText(
        [
          parsed.title || worksheetTitle,
          parsed.instructions || fallbackInstruction,
          normalizedQuestions,
        ].filter(Boolean).join("\n\n")
      ),
      answerSheet: normalizedAnswers,
      fullText,
      reviewRecommended: mustReview,
      wormholeFormatOk: hasFiveChoicePattern(normalizedQuestions),
    });
  } catch (error) {
    if (error?.code === "INSUFFICIENT_MP") {
      return json(res, 402, {
        success: false,
        error: "INSUFFICIENT_MP",
        message: error.message || "MP가 부족합니다.",
        currentMp: error.beforeMp ?? null,
        requiredMp: error.requiredMp ?? null,
      });
    }

    return json(res, 500, {
      success: false,
      error: "WORMHOLE_GENERATION_FAILED",
      message: error?.message || "웜홀 생성 중 오류가 발생했습니다.",
    });
  }
}
