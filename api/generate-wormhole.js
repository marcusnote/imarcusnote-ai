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
  const t = String(text || "");
  return /[가-힣]/.test(t) ? "ko" : "en";
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

function normalizeQuestionNumbering(text = "") {
  const lines = cleanupText(text).split("\n");
  const out = [];
  let q = 0;

  for (const line of lines) {
    if (/^\s*\d+\.\s*/.test(line)) {
      q += 1;
      out.push(line.replace(/^\s*\d+\.\s*/, `${q}. `));
    } else {
      out.push(line);
    }
  }

  return out.join("\n").trim();
}

function countQuestions(text = "") {
  return (String(text || "").match(/^\s*\d+\.\s+/gm) || []).length;
}

function ensureExactQuestionCount(text = "", requestedCount = 25) {
  const cleaned = normalizeQuestionNumbering(text);
  const blocks = cleaned
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);
  if (blocks.length === 0) return cleaned;

  const sliced = blocks.slice(0, requestedCount);
  return sliced
    .map((block, idx) => block.replace(/^\s*\d+\.\s*/, `${idx + 1}. `))
    .join("\n\n")
    .trim();
}

function splitQuestionsAndAnswers(raw = "") {
  const text = cleanupText(raw);

  const answerIdx = text.search(/\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i);
  if (answerIdx === -1) {
    return {
      body: text,
      answerSheet: "",
    };
  }

  return {
    body: text.slice(0, answerIdx).trim(),
    answerSheet: text.slice(answerIdx).trim(),
  };
}

function extractLeadInstruction(prompt = "", language = "ko", count = 25, topic = "영문법") {
  if (language === "ko") {
    return `다음 문항을 읽고 가장 알맞은 답을 고르시오.
총 ${count}문항입니다. 주제는 ${topic}입니다.`;
  }
  return `Read each item carefully and choose the best answer.
Total ${count} items on ${topic}.`;
}

function buildSystemPrompt(language = "ko") {
  if (language === "ko") {
    return `
당신은 I•marcusnote의 WORMHOLE 전용 고난도 문항 생성 엔진이다.
역할:
- 중등/고등 문법 단원 중심의 고난도 워크시트를 만든다.
- 교사가 바로 배포 가능한 완성형 결과만 출력한다.
- 문제 수, 번호, 정답 구조를 매우 엄격히 지킨다.

핵심 정체성:
- WORMHOLE = 고난도 문법 판별 · 오류 탐지 · 문장 변형 · 개수 판단 중심
- 단순 객관식 남발 금지
- 교육적으로 날카롭고, 편집적으로 정돈된 프리미엄 자료
- 억지 장문 해설 금지
- 출력 구조 안정성이 최우선

절대 규칙:
1. 요청 문항 수를 반드시 정확히 맞춘다.
2. 문항 번호는 반드시 1. ~ N. 형식이다.
3. 본문과 정답 수가 반드시 일치해야 한다.
4. 정답은 반드시 각 문항마다 하나씩 존재해야 한다.
5. 개수형 문항은 실제 개수를 다시 계산한 뒤 정답을 적는다.
6. 문제 본문과 정답/해설이 서로 모순되면 안 된다.
7. 출력은 반드시 아래 블록 구조를 따른다.
8. 마크다운 코드펜스 금지
9. 불필요한 설명, 사족, 안내문 금지

출력 구조:
[[TITLE]]
제목

[[INSTRUCTIONS]]
지시문

[[QUESTIONS]]
1. ...
2. ...
...
N. ...

[[ANSWERS]]
1. ...
2. ...
...
N. ...
`.trim();
  }

  return `
You are the dedicated WORMHOLE engine for I•marcusnote.

Role:
- Create high-difficulty grammar worksheets for middle/high school learners.
- Output only teacher-ready final worksheet text.
- Keep item count, numbering, and answers strictly aligned.
Core identity:
- WORMHOLE focuses on advanced grammar judgment, error detection, transformation, and count-based logic.
- Avoid generic low-level multiple-choice spam.
- Keep output editorially polished and structurally stable.

Hard rules:
1. Match the requested item count exactly.
2. Number questions strictly from 1. to N.
3. The number of answers must exactly match the number of questions.
4. Every item must have exactly one answer line.
5. Recalculate count-based items before writing answers.
6. No contradictions between question body and answer section.
7. Follow the block structure below.
8. No markdown fences.
9. No extra commentary.

Required output format:
[[TITLE]]
Title

[[INSTRUCTIONS]]
Instruction

[[QUESTIONS]]
1. ...
2. ...
...
N. ...

[[ANSWERS]]
1. ...
2. ...
...
N. ...
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
- 문항은 교육적으로 타당해야 한다.
- 번호 누락, 중복, 깨진 포맷 금지.
- 정답 및 해설은 문항별로 1개씩 맞춰라.
- 개수형 문항이 포함되면 실제 개수를 재검산하라.
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
- Items must be educationally valid.
- No broken numbering, duplicates, or malformed layout.
- Provide one aligned answer per item.
- Recalculate any count-based item before finalizing the answer.
- Output only the required [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] blocks.
`;
  return guide.trim();
}

function extractSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? text.indexOf(endMarker, from) : -1;
  if (end === -1) {
    return text.slice(from).trim();
  }

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

function normalizeAnswerSheet(text = "", requestedCount = 25) {
  const lines = cleanupText(text).split("\n").map((v) => v.trim()).filter(Boolean);
  const numbered = [];
  for (const line of lines) {
    if (/^\d+\.\s*/.test(line)) {
      numbered.push(line);
    }
  }

  if (numbered.length === 0) return cleanupText(text);
  return numbered
    .slice(0, requestedCount)
    .map((line, idx) => line.replace(/^\d+\.\s*/, `${idx + 1}. `))
    .join("\n")
    .trim();
}

function ensureAnswerCount(answerSheet = "", requestedCount = 25) {
  const normalized = normalizeAnswerSheet(answerSheet, requestedCount);
  const lines = normalized
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => /^\d+\.\s+/.test(v));
  if (lines.length >= requestedCount) {
    return lines.slice(0, requestedCount).join("\n").trim();
  }

  const out = [...lines];
  for (let i = lines.length + 1; i <= requestedCount; i += 1) {
    out.push(`${i}. 정답 검토 필요`);
  }

  return out.join("\n").trim();
}

function buildFullText(title, instructions, questions, answers) {
  const parts = [];
  if (title) parts.push(title);
  if (instructions) parts.push(instructions);
  if (questions) parts.push(questions);
  if (answers) parts.push("정답 및 해설\n" + answers);
  return cleanupText(parts.join("\n\n"));
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
      temperature: 0.4,
      max_tokens: 3800,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
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

// 수정 완료된 부분: memberstackRequest
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
  if (raw === null || raw === undefined || raw === "") {
    return DEFAULT_TRIAL_MP;
  }

  const num = Number(raw);
  return Number.isFinite(num) ? num : DEFAULT_TRIAL_MP;
}

async function fetchMember(memberId) {
  if (!memberId) return null;
  return memberstackRequest(`/${MEMBERSTACK_APP_ID}/${memberId}`, {
    method: "GET",
  });
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
    const prompt = sanitizeString(req.body?.prompt || "");
    const requestedCount = sanitizeCount(req.body?.count || 25, 25);
    const requestedMpCost = sanitizeMp(req.body?.mpCost || 5, 5);

    const language =
      ["ko", "en"].includes(req.body?.language) ?
      req.body.language :
      inferLanguage(prompt);

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
    const parsed = parseModelOutput(
      rawModelOutput,
      worksheetTitle,
      fallbackInstruction
    );
    const normalizedQuestions = ensureExactQuestionCount(
      parsed.questions,
      requestedCount
    );
    const actualQuestionCount = countQuestions(normalizedQuestions);

    const normalizedAnswers = ensureAnswerCount(
      parsed.answers,
      actualQuestionCount || requestedCount
    );
    const fullText = buildFullText(
      parsed.title || worksheetTitle,
      parsed.instructions || fallbackInstruction,
      normalizedQuestions,
      normalizedAnswers
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
      reviewRecommended: /개수|how many|select all|모두 고른|옳은 것만|incorrect|not correct/i.test(fullText),
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
