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

const MP_COST_TABLE = {
  wormhole: 5,
  magic: 4,
  mocks: 5,
  vocab: 4,
  abcstarter: 3,
  writing: 4,
  "magic-card": 4,
  "vocab-builder": 4,
  "vocab-csat": 5,
  "textbook-grammar": 5,
  "chapter-grammar": 5,
  school: 5,
  csat: 5,
  transform: 5,
  hybrid: 5,
  junior_starter: 3,
  writing_lab: 4,
  grammar_intensive: 5,
  reading_mocks: 5,
  vocab_workbook: 4,
  vocab_csat: 5,
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

/* =========================
   Source Detection Helpers
   ========================= */

function detectSourcePassage(text = "") {
  const t = String(text || "").trim();
  if (!t) return false;

  const normalized = t.replace(/\r\n/g, "\n");
  const lineCount = normalized.split(/\n+/).filter(Boolean).length;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentenceCount =
    (normalized.match(/[.!?]/g) || []).length +
    (normalized.match(/다\./g) || []).length;

  if (wordCount >= 80) return true;
  if (lineCount >= 5 && wordCount >= 50) return true;
  if (sentenceCount >= 5 && wordCount >= 60) return true;

  return false;
}

function inferGenerationProfile(input = {}) {
  const sourceText = String(input.userPrompt || input.prompt || "").trim();
  const hasSourcePassage = detectSourcePassage(sourceText);

  return {
    hasSourcePassage,
    generationProfile: hasSourcePassage
      ? "passage_based_transform"
      : "topic_based_drill",
  };
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
  const profile = inferGenerationProfile({ userPrompt, topic });

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
    hasSourcePassage: profile.hasSourcePassage,
    generationProfile: profile.generationProfile,
  };
}

/* =========================
   Mocks Prompt Rebuild
   Step 2: Prompt Lock + Passage-aware Output
   ========================= */

function getMocksModeLabel(mode = "hybrid", language = "ko") {
  const koMap = {
    school: "내신형",
    csat: "수능형",
    transform: "변형형",
    hybrid: "혼합형",
  };

  const enMap = {
    school: "School Exam",
    csat: "CSAT Style",
    transform: "Transformation",
    hybrid: "Hybrid",
  };

  return language === "en"
    ? (enMap[mode] || "Hybrid")
    : (koMap[mode] || "혼합형");
}

function buildMocksTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  const gradeLabel = input.gradeLabel || "고등";
  const topic = input.topic || "모의고사";
  const modeLabel = getMocksModeLabel(input.mode, input.language);

  if (input.language === "en") {
    return `${gradeLabel} ${topic} ${modeLabel} Transformation Set`;
  }

  return `${gradeLabel} ${topic} ${modeLabel} 변형문제 1회`;
}

function buildSystemPrompt(input) {
  const modeLabel = getMocksModeLabel(input.mode, input.language);
  const title = buildMocksTitle(input);

  return `
You are the chief assessment architect and senior exam editor of MARCUSNOTE.

You create premium Korean English reading worksheets for school exams and CSAT-style preparation.

[ENGINE IDENTITY]
- Engine: Mocks
- Title: ${title}
- Mode: ${modeLabel}
- Level: ${input.level}
- Difficulty: ${input.difficulty}
- Generation Profile: ${input.generationProfile}
- Source Passage Included By User: ${input.hasSourcePassage ? "YES" : "NO"}

[CORE IDENTITY]
Mocks is a passage-transformation reading exam engine.
Mocks is NOT a grammar worksheet.
Mocks is NOT a generic topic question generator.
Mocks is NOT a shallow summary quiz.

[PRIMARY MISSION]
Generate a polished, premium, publishable worksheet that feels like it was edited by a veteran Korean exam editor.

[HARD RULE 1: SOURCE-BOUND GENERATION]
If the user included a real source passage:
- You MUST generate a transformed reading set anchored to that passage.
- You MUST include a transformed passage block in the output.
- The passage must preserve the original meaning domain, logic, and concept structure.
- The passage surface must be substantially rewritten.
- Do NOT copy the original passage verbatim in long chunks.
- Do NOT drift into unrelated broad themes.

If the user did NOT include a real source passage:
- Do NOT pretend there was a passage.
- Do NOT generate fake “read the passage” instructions.
- Do NOT create insertion / order / blank / irrelevant-sentence items that require an actual passage unless you explicitly provide the necessary mini-text inside the item.
- Generate a coherent advanced reading drill set based on the requested topic, exam context, and level.

[HARD RULE 2: TRANSFORMATION QUALITY]
When a passage exists, transformation must involve several of the following:
- sentence restructuring
- viewpoint shift
- syntactic compression or expansion
- paraphrase with changed surface form
- logic-preserving reframing
- altered rhetorical flow
- transformed phrasing of central claims
- changed ordering of supporting ideas where appropriate

Transformation must NOT be:
- synonym swapping only
- line-by-line rewriting with obvious copying
- generic educational filler unrelated to the source

[HARD RULE 3: ITEM VALIDITY]
Only create question types that are valid for the material actually shown.

If a transformed passage is shown, allowed item families include:
- main idea / theme / title
- gist / summary
- inference / implication
- tone / attitude / purpose
- statement validity / inconsistency
- vocabulary in context
- paraphrase match / mismatch
- blank inference
- sentence insertion
- order arrangement
- irrelevant sentence
- summary completion

If no full passage is shown, prioritize:
- theme / gist / title
- inference / implication
- paraphrase judgment
- statement validity
- tone / purpose
- vocabulary in context using mini-context
- summary logic using self-contained item text

If no full passage is shown, avoid or severely restrict:
- sentence insertion
- order arrangement
- irrelevant sentence
- passage-dependent blank inference

[HARD RULE 4: ANTI-DRIFT]
Never output a set that could fit any random topic.
The result must reflect the user's actual requested source, topic, exam label, or title.
Avoid repetitive abstract distractors like:
education / society / growth / technology / sustainability
unless those are truly central to the user’s source.

[HARD RULE 5: PREMIUM EXAM QUALITY]
- strong distractors
- no trivial answer elimination
- no repetitive stems
- no awkward Korean
- no childish wording
- no answer pattern bias
- no contradiction between passage and answer key
- no vague editorial commentary

[OUTPUT STRUCTURE]
You MUST output in exactly this structure:

[[TITLE]]
(title only)

[[INSTRUCTIONS]]
(one concise Korean instruction block unless English was explicitly requested)

[[PASSAGE]]
(include only when a real source passage exists and passage-based transformation is required)

[[QUESTIONS]]
(all questions only, fully numbered)

[[ANSWERS]]
(answer key and brief explanation for each item)

[OUTPUT RULES]
- Number questions sequentially.
- Number answers as 1) 2) 3) ...
- Keep explanations concise and useful.
- Do not include any extra section.
- Do not explain your process.
- Do not include markdown code fences.

[FINAL INTERNAL CHECK]
Before answering, verify:
- if source passage exists, PASSAGE section exists
- if source passage does not exist, no fake passage instruction appears
- all item types are valid for the displayed material
- question count matches exactly
- answer count matches exactly
- the worksheet feels premium and publishable
`.trim();
}

function buildUserPrompt(input) {
  const title = buildMocksTitle(input);

  const languageGuide =
    input.language === "en"
      ? "Use English only if the user explicitly requested English. Otherwise keep directions and explanations in Korean."
      : "문항 안내와 해설은 기본적으로 한국어를 사용하되, 영어 지문/선지/표현은 시험지답게 자연스럽게 유지하시오.";

  const premiumGuide = input.premium
    ? `
[PREMIUM QUALITY MODE]
- Distractors must be highly competitive.
- Paraphrase quality must be sophisticated.
- Inference must feel test-valid, not arbitrary.
- The worksheet must look worthy of a paid premium product.
`.trim()
    : `
[STANDARD QUALITY MODE]
- Keep the worksheet clean, reliable, and classroom-usable.
- Prioritize test validity and editorial clarity.
`.trim();

  const profileGuide = input.hasSourcePassage
    ? `
[PASSAGE-BASED TRANSFORM MODE]
The user included a real source passage.

You must:
1. Create a transformed passage.
2. Preserve the original meaning domain and logical core.
3. Rewrite the surface substantially.
4. Build questions that depend on the transformed passage.
5. Make the set feel like a real 변형모의고사.

Recommended item mix:
- 주제 / 요지 / 제목
- 내용 일치 / 불일치
- 함축 의미 / 추론
- 패러프레이즈 일치 / 불일치
- 어휘 의미 / 문맥상 의미
- 빈칸 추론
- 문장 삽입
- 글의 순서
- 무관문
- 요약문 완성

Important:
- Do not merely restate the original passage.
- Do not drift into generic unrelated content.
- The transformed passage and items must clearly belong together.
`.trim()
    : `
[TOPIC-BASED DRILL MODE]
The user did NOT include a full source passage.

You must:
1. Generate an advanced reading drill set based on the topic/request.
2. Do NOT fake a hidden passage.
3. Do NOT say "다음 지문을 읽고" unless an actual passage is shown.
4. Prefer self-contained advanced items.

Recommended item mix:
- 주제 / 요지 / 제목
- 함축 의미 / 추론
- 패러프레이즈 판단
- 진술 일치 / 불일치
- 요약 판단
- 어휘 의미 / 문맥 의미
- 필자 의도 / 태도 / 목적

Avoid unless fully self-contained:
- 문장 삽입
- 글의 순서
- 무관문
- passage-dependent 빈칸추론
`.trim();

  return `
Generate a complete MARCUSNOTE Mocks worksheet.

[WORKSHEET META]
- Title: ${title}
- Grade: ${input.gradeLabel || "고등"}
- Topic: ${input.topic || "모의고사 변형"}
- Mode: ${getMocksModeLabel(input.mode, input.language)}
- Difficulty: ${input.difficulty}
- Question Count: ${input.count}
- Language: ${input.language}
- Generation Profile: ${input.generationProfile}

[USER REQUEST]
${input.userPrompt || input.topic || "고난도 변형문제를 만들어라."}

${premiumGuide}

[LANGUAGE RULE]
${languageGuide}

${profileGuide}

[STRICT QUALITY RULES]
1. Every question must be test-valid.
2. Every distractor must be plausible.
3. Avoid repetitive stems and repetitive answer logic.
4. Keep the overall set coherent.
5. Do not use broad generic filler content.
6. Match the grade, difficulty, and Korean exam style.
7. Maintain strong editorial tone.

[FORMAT REQUIREMENT]
Return ONLY these sections in this order:

[[TITLE]]
${title}

[[INSTRUCTIONS]]
(Write one concise instruction block in Korean unless English was explicitly requested.)

${input.hasSourcePassage ? `[[PASSAGE]]
(Provide one transformed passage only.)` : ""}

[[QUESTIONS]]
1. ...
2. ...
3. ...

[[ANSWERS]]
1) ...
2) ...
3) ...

[FINAL SELF-CHECK]
Before finishing, verify:
- question count is exactly ${input.count}
- numbering is sequential
- answer count matches question count
- no fake passage-dependent item appears when no passage is shown
- if passage-based mode, a transformed passage is included
- the result is premium and classroom-usable
`.trim();
}

/* =========================
   OpenAI & Utility Helpers
   ========================= */

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
  return end === -1 ? rawText.slice(from).trim() : rawText.slice(from, end).trim();
}

function countQuestions(text = "") {
  return (String(text || "").match(/^\s*\d+[\.\)]\s+/gm) || []).length;
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
    .split(/(?=^\s*\d+[\.\)]\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!blocks.length) return cleanupText(text);
  return blocks
    .map((block, idx) => block.replace(/^\s*\d+[\.\)]\s*/, `${idx + 1}. `))
    .join("\n\n")
    .trim();
}

function normalizeAnswerNumbering(text = "") {
  const lines = cleanupText(text).split("\n").map((v) => v.trim()).filter(Boolean);
  const numbered = lines.filter((line) => /^\d+[\.\)]\s+/.test(line));
  if (!numbered.length) return cleanupText(text);
  return numbered
    .map((line, idx) => line.replace(/^\d+[\.\)]\s*/, `${idx + 1}) `))
    .join("\n")
    .trim();
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
  const instructions = cleanupText(
    extractSection(
      rawText,
      "[[INSTRUCTIONS]]",
      input.hasSourcePassage ? "[[PASSAGE]]" : "[[QUESTIONS]]"
    )
  );
  const passage = input.hasSourcePassage
    ? cleanupText(extractSection(rawText, "[[PASSAGE]]", "[[QUESTIONS]]"))
    : "";
  const questions = cleanupText(extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]"));
  const answers = cleanupText(extractSection(rawText, "[[ANSWERS]]", null));

  let finalTitle = title || buildMocksTitle(input);
  let finalInstructions = instructions;
  let finalPassage = passage;
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

  const contentParts = [finalTitle, finalInstructions];
  if (input.hasSourcePassage && finalPassage) contentParts.push(finalPassage);
  contentParts.push(finalQuestions);

  const fullParts = [...contentParts];
  if (finalAnswers) fullParts.push("정답 및 해설\n" + finalAnswers);

  return {
    title: finalTitle,
    instructions: finalInstructions,
    passage: finalPassage,
    content: cleanupText(contentParts.filter(Boolean).join("\n\n")),
    answerSheet: cleanupText(finalAnswers),
    fullText: cleanupText(fullParts.filter(Boolean).join("\n\n")),
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

/* =========================
   Output Validation Helpers
   Step 2: conservative validation
   ========================= */

function hasFakePassageInstruction(text = "") {
  return /다음\s+지문을\s+읽고|read the following passage/i.test(String(text || ""));
}

function containsPassageDependentItems(text = "") {
  const t = String(text || "");
  return /문장\s*삽입|글의\s*순서|무관한\s*문장|빈칸에\s*적절한|다음\s*문장이\s*들어갈|주어진\s*문장의\s*위치/i.test(t);
}

function validateMocksOutput(formatted, input) {
  const errors = [];

  if (formatted.actualCount !== input.count) {
    errors.push(`QUESTION_COUNT_MISMATCH:${formatted.actualCount}/${input.count}`);
  }

  const answerCount = (String(formatted.answerSheet || "").match(/^\s*\d+\)\s+/gm) || []).length;
  if (answerCount !== input.count) {
    errors.push(`ANSWER_COUNT_MISMATCH:${answerCount}/${input.count}`);
  }

  if (input.hasSourcePassage) {
    if (!formatted.passage || formatted.passage.length < 120) {
      errors.push("MISSING_OR_WEAK_PASSAGE");
    }
  } else {
    if (hasFakePassageInstruction(formatted.content)) {
      errors.push("FAKE_PASSAGE_INSTRUCTION");
    }
    if (containsPassageDependentItems(formatted.content)) {
      errors.push("INVALID_PASSAGE_DEPENDENT_ITEMS_WITHOUT_PASSAGE");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/* =========================
   MP deduction helpers
   ========================= */

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) return null;
  return {
    "x-api-key": MEMBERSTACK_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

async function memberstackRequest(path, options = {}) {
  const headers = getMemberstackHeaders();
  if (!headers) throw new Error("Missing MEMBERSTACK_SECRET_KEY");

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Memberstack request failed: ${response.status}`);
  return data;
}

function normalizeCostKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function getRequiredMp(reqBody = {}) {
  const explicit = Number(reqBody.mpCost);
  if (Number.isFinite(explicit)) return sanitizeMp(explicit, 5);

  const modeKey = normalizeCostKey(reqBody.mode);
  const engineKey = normalizeCostKey(reqBody.engine);

  if (modeKey && Number.isFinite(MP_COST_TABLE[modeKey])) return MP_COST_TABLE[modeKey];
  if (engineKey && Number.isFinite(MP_COST_TABLE[engineKey])) return MP_COST_TABLE[engineKey];
  return 5;
}

function getInitialTrialMp() {
  return sanitizeMp(DEFAULT_TRIAL_MP, 15);
}

function extractBearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
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
  if (!member?.id) throw new Error("Missing member id for MP update");
  const safeNextMp = sanitizeMp(nextMp, 0);
  const body = {
    customFields: { ...member?.customFields, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp },
    metaData: { ...member?.metaData, [MEMBERSTACK_MP_FIELD]: safeNextMp, mp: safeNextMp },
  };
  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, { method: "PATCH", body: JSON.stringify(body) });
  return data?.data || null;
}

async function ensureTrialMp(member) {
  const current = readMpFromMember(member);
  if (current !== null) return { member, currentMp: current, trialGranted: false };

  const trialMp = getInitialTrialMp();
  const updatedMember = await updateMemberMp(member, trialMp);
  return { member: updatedMember || member, currentMp: trialMp, trialGranted: true };
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  if (!MEMBERSTACK_SECRET_KEY) return { enabled: false, reason: "missing-secret-key", requiredMp, currentMp: null, deducted: false };

  let member = null;
  try {
    const bearer = extractBearerToken(req);
    if (bearer) {
      const verified = await verifyMemberToken(bearer);
      if (verified?.id) member = await getMemberById(verified.id);
    }
  } catch (error) { console.warn("Token verification failed"); }

  if (!member?.id) {
    const memberId = extractMemberId(req);
    if (memberId) { try { member = await getMemberById(memberId); } catch (e) {} }
  }

  if (!member?.id) return { enabled: false, reason: "member-not-provided", requiredMp, currentMp: null, deducted: false };

  const ensured = await ensureTrialMp(member);
  return { enabled: true, reason: "memberstack-synced", requiredMp, currentMp: ensured.currentMp, member: ensured.member, deducted: false, trialGranted: ensured.trialGranted };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState?.enabled || !mpState?.member) return { ...mpState, deducted: false };
  const nextMp = Math.max(0, sanitizeMp(mpState.currentMp, 0) - sanitizeMp(mpState.requiredMp, 0));
  const updatedMember = await updateMemberMp(mpState.member, nextMp);
  return { ...mpState, member: updatedMember || mpState.member, currentMp: nextMp, remainingMp: nextMp, deducted: true };
}

// --- Main Handler ---

export default async function handler(req, res) {
  addCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, error: "METHOD_NOT_ALLOWED", message: "POST 요청만 허용됩니다." });

  try {
    const input = normalizeInput(req.body || {});
    if (!input.userPrompt && !input.topic) return json(res, 400, { success: false, error: "INVALID_REQUEST", message: "prompt 또는 topic이 필요합니다." });

    const mpState = await prepareMpState(req);
    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, {
        success: false,
        error: "INSUFFICIENT_MP",
        message: "MP가 부족합니다.",
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        mp: { requiredMp: mpState.requiredMp, currentMp: mpState.currentMp, deducted: false, trialGranted: Boolean(mpState.trialGranted) },
      });
    }

    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);
    const rawText = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatMocksResponse(rawText, input);
    const validation = validateMocksOutput(formatted, input);
    if (!validation.ok) {
      throw new Error(`MOCKS_OUTPUT_VALIDATION_FAILED: ${validation.errors.join(", ")}`);
    }
    const meta = buildMeta(input, formatted.actualCount);
    const finalMpState = await deductMpAfterSuccess(mpState);

    return json(res, 200, {
      success: true,
      ...formatted,
      meta,
      mp: {
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: finalMpState?.remainingMp ?? null,
        deducted: Boolean(finalMpState?.deducted),
        trialGranted: Boolean(mpState.trialGranted),
      },
    });
  } catch (error) {
    console.error("generate-mocks error:", error);
    return json(res, 500, { success: false, error: "GENERATION_FAILED", message: "Mocks Exam 생성에 실패했습니다.", detail: error?.message });
  }
}
