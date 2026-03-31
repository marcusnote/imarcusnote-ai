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

/* =========================
   Utility Helpers
   ========================= */

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
  const t = String(text || "");
  const koreanMatches = t.match(/[가-힣]/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function inferLevel(text = "") {
  const t = String(text || "").toLowerCase();
  if (/고1|고2|고3|고등|수능|모의고사|high|csat/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";
  if (/초등|초[1-6]|elementary/.test(t)) return "elementary";
  return "high";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/수능|csat/.test(t)) return "csat";
  if (/모의고사|mock/.test(t)) return "mock-exam";
  if (/변형|transform|재구성|adapted/.test(t)) return "exam-transform";
  if (/지문|passage|reading/.test(t)) return "passage-based";
  if (/문법|어법|grammar/.test(t)) return "grammar-high";
  return "mock-exam";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";
  return "high";
}

function inferExamType(text = "") {
  const t = String(text || "").toLowerCase();
  if (/수능|csat/.test(t)) return "csat";
  if (/모의고사|mock/.test(t)) return "mock";
  if (/내신|school/.test(t)) return "school";
  if (/변형|transform/.test(t)) return "transform";
  if (/문법|어법|grammar/.test(t)) return "grammar";
  return "mock";
}

function inferTopic(text = "") {
  const t = String(text || "");
  const topicPatterns = [
    "어법 종합", "문법 종합", "수일치", "시제", "조동사", "수동태", "관계대명사",
    "관계부사", "동명사", "to부정사", "가정법", "분사", "분사구문", "접속사",
    "전치사", "비교급", "최상급", "대명사", "명사절", "형용사절", "부사절", "도치",
    "강조구문", "어휘", "빈칸추론", "순서배열", "문장삽입", "장문독해",
  ];
  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }
  const lower = t.toLowerCase();
  if (/grammar/.test(lower)) return "어법 종합";
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/infinitive|to-infinitive/.test(lower)) return "to부정사";
  if (/gerund/.test(lower)) return "동명사";
  if (/passive/.test(lower)) return "수동태";
  if (/subjunctive/.test(lower)) return "가정법";
  if (/passage/.test(lower)) return "지문 독해";
  if (/blank/.test(lower)) return "빈칸추론";
  return "어법 종합";
}

function inferGradeLabel(text = "", level = "high") {
  const t = String(text || "");
  if (/고1/.test(t)) return "고1";
  if (/고2/.test(t)) return "고2";
  if (/고3/.test(t)) return "고3";
  if (/중1/.test(t)) return "중1";
  if (/중2/.test(t)) return "중2";
  if (/중3/.test(t)) return "중3";
  if (/초1/.test(t)) return "초1";
  if (/초2/.test(t)) return "초2";
  if (/초3/.test(t)) return "초3";
  if (/초4/.test(t)) return "초4";
  if (/초5/.test(t)) return "초5";
  if (/초6/.test(t)) return "초6";
  if (level === "middle") return "중등";
  if (level === "elementary") return "초등";
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
  ].filter(Boolean).join(" ");

  const level = ["elementary", "middle", "high"].includes(body.level) ? body.level : inferLevel(mergedText);
  const modeCandidates = ["csat", "mock-exam", "grammar-high", "exam-transform", "passage-based"];
  const mode = modeCandidates.includes(body.mode) ? body.mode : inferMode(mergedText);
  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty) ? body.difficulty : inferDifficulty(mergedText);
  const language = ["ko", "en"].includes(body.language) ? body.language : inferLanguage(mergedText);
  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || "") || inferExamType(mergedText);
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const gradeLabel = inferGradeLabel(mergedText, level);

  return { engine: "mocks", level, mode, topic, examType, difficulty, count, language, worksheetTitle, academyName, userPrompt, gradeLabel };
}

/* =========================
   Mocks Output Builders
   ========================= */

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
  const koMap = { csat: "수능형", "mock-exam": "모의고사형", "grammar-high": "고등문법형", "exam-transform": "변형형", "passage-based": "지문형" };
  const enMap = { csat: "CSAT", "mock-exam": "Mock Exam", "grammar-high": "High School Grammar", "exam-transform": "Exam Transformation", "passage-based": "Passage Based" };
  return language === "en" ? enMap[mode] || "Mock Exam" : koMap[mode] || "모의고사형";
}

function buildMocksTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  if (input.language === "en") return `${input.gradeLabel} ${input.topic} Mocks ${difficultyLabel} ${input.count} Questions`;
  return `${input.gradeLabel} ${input.topic} 모의고사 ${difficultyLabel} ${input.count}문항`;
}

function buildSystemPrompt(input) {
  const isKo = input.language === "ko";
  return isKo ? `
당신은 고등 영어 평가용 MARCUS Mocks 전용 생성 엔진이다.
핵심 목표:
- 고등부 문법, 수능형 문제, 모의고사, 변형 문제를 실제 시험지처럼 생성한다.
핵심 원칙:
1. 고등 실전형 톤을 유지한다.
2. 5지선다형 객관식 평가 자료를 기본으로 한다.
3. 문제 본문과 정답/해설을 반드시 분리한다.
출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim() : `
You are the dedicated MARCUS Mocks engine for high-school English assessment.
Core goals:
- Generate real exam-style English materials for grammar, CSAT, mock exams, and exam transformations.
Output format:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim();
}

function buildTaskGuide(input) {
  const isEn = input.language === "en";
  switch (input.mode) {
    case "csat": return isEn ? "Use a CSAT-oriented tone with high-school level grammar judgment." : "수능형 톤으로 작성할 것. 고등 수준의 어법 판단과 오답 선지를 반영할 것.";
    case "grammar-high": return isEn ? "Focus on high-school grammar judgment and realistic error-detection." : "고등 문법과 어법 판단 중심으로 구성할 것.";
    case "exam-transform": return isEn ? "Create transformed exam-style items with adapted wording." : "시험 변형 문제처럼 구성할 것. 문맥 유지와 표현 변형이 핵심.";
    default: return isEn ? "Create a realistic mock-exam set for high-school students." : "고등학생 대상의 실전 모의고사 세트처럼 작성할 것.";
  }
}

function buildUserPrompt(input) {
  const title = buildMocksTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  const taskGuide = buildTaskGuide(input);
  return input.language === "en" ? `
Generate a Mocks-style English assessment set.
Title: ${title}
Mode: ${input.mode} (${modeLabel})
Difficulty: ${input.difficulty} (${difficultyLabel})
Question count: ${input.count}
Requirement: ${taskGuide}
Original request: ${input.userPrompt || "(No additional user prompt provided.)"}`.trim() : `
MARCUS Mocks 스타일 영어 평가 세트를 생성하시오.
제목: ${title}
모드: ${input.mode} (${modeLabel})
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
요구사항: ${taskGuide}
사용자 원문: ${input.userPrompt || "(추가 요청 없음)"}`.trim();
}

/* =========================
   External API Call & Parsing
   ========================= */

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.5, max_tokens: 8000, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  return end === -1 ? rawText.slice(from).trim() : rawText.slice(from, end).trim();
}

function formatMocksResponse(rawText, input) {
  const title = extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]");
  const instructions = extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]");
  const questions = extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]");
  const answers = extractSection(rawText, "[[ANSWERS]]", null);

  const finalTitle = title.trim() || buildMocksTitle(input);
  const contentParts = [finalTitle, instructions.trim(), questions.trim()].filter(Boolean);
  const fullParts = [...contentParts];
  if (answers.trim()) fullParts.push((input.language === "en" ? "Answers / Explanations\n" : "정답 및 해설\n") + answers.trim());

  return { title: finalTitle, instructions: instructions.trim(), content: contentParts.join("\n\n"), answerSheet: answers.trim(), fullText: fullParts.join("\n\n"), actualCount: (questions.match(/^\s*\d+\./gm) || []).length };
}

/* =========================
   MP deduction helpers only (Updated)
   ========================= */

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) return null;
  return { "x-api-key": MEMBERSTACK_SECRET_KEY, "Content-Type": "application/json" };
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
  return sanitizeString(req?.body?.memberId || req?.headers?.["x-member-id"] || req?.headers?.["X-Member-Id"] || "");
}

async function memberstackRequest(path, options = {}) {
  const headers = getMemberstackHeaders();
  if (!headers) throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Memberstack request failed: ${response.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
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
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, { method: "GET", headers: { "Content-Type": "application/json" } });
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
    const num = Number(value);
    if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
  }
  return null;
}

async function updateMemberMp(member, nextMp) {
  const memberId = member?.id;
  if (!memberId) throw new Error("Missing member id for MP update");
  const currentCustomFields = member?.customFields && typeof member.customFields === "object" ? member.customFields : {};
  const currentMetaData = member?.metaData && typeof member.metaData === "object" ? member.metaData : {};
  const safeMp = Math.max(0, Math.floor(Number(nextMp) || 0));
  const patchBody = {
    customFields: { ...currentCustomFields, [MEMBERSTACK_MP_FIELD]: safeMp },
    metaData: { ...currentMetaData, [MEMBERSTACK_MP_FIELD]: safeMp },
  };
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify(patchBody) });
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
    console.error("resolveMemberForMp error:", error);
    return { enabled: false, reason: "member_lookup_failed", member: null };
  }
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  const memberContext = await resolveMemberForMp(req);
  if (!memberContext.enabled || !memberContext.member) {
    return { enabled: false, reason: memberContext.reason, requiredMp, member: null, currentMp: null, remainingMp: null, trialGranted: false, deducted: false };
  }
  const member = memberContext.member;
  let currentMp = readMpFromMember(member);
  let updatedMember = member;
  let trialGranted = false;
  if (!Number.isFinite(currentMp)) {
    currentMp = getInitialTrialMp();
    updatedMember = (await updateMemberMp(member, currentMp)) || member;
    currentMp = readMpFromMember(updatedMember);
    trialGranted = true;
  }
  if (!Number.isFinite(currentMp)) currentMp = 0;
  return { enabled: true, reason: memberContext.reason, requiredMp, member: updatedMember, currentMp, remainingMp: currentMp, trialGranted, deducted: false };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState || !mpState.enabled) return mpState;
  const currentMp = Number(mpState.currentMp);
  const requiredMp = Number(mpState.requiredMp);
  if (!Number.isFinite(currentMp) || !Number.isFinite(requiredMp)) return { ...mpState, deducted: false };
  const nextMp = Math.max(0, currentMp - requiredMp);
  const updatedMember = await updateMemberMp(mpState.member, nextMp);
  return { ...mpState, member: updatedMember || mpState.member, currentMp: nextMp, remainingMp: nextMp, deducted: true };
}

/* =========================
   Main Handler
   ========================= */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST 요청만 허용됩니다." });

  try {
    const input = normalizeInput(req.body || {});
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, message: "userPrompt 또는 topic이 필요합니다." });

    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP가 부족합니다.", requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp });
    }

    const rawText = await callOpenAI(buildSystemPrompt(input), buildUserPrompt(input));
    const formatted = formatMocksResponse(rawText, input);
    const finalMpState = await deductMpAfterSuccess(mpState);

    return json(res, 200, {
      success: true,
      ...formatted,
      meta: { language: input.language, requestedCount: input.count, actualCount: formatted.actualCount, generatedAt: new Date().toISOString() },
      remainingMp: finalMpState?.remainingMp ?? null,
      mpSyncEnabled: Boolean(mpState.enabled)
    });
  } catch (error) {
    console.error("Handler error:", error);
    return json(res, 500, { success: false, message: "Mocks 평가 세트 생성에 실패했습니다.", detail: error.message });
  }
}
