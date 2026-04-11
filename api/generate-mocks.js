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
  if (!Number.isFinite(num)) return 12;
  return clamp(Math.round(num), 8, 15);
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

function extractSourceLabel(text = "") {
  const t = String(text || "");
  const patterns = [
    /출처\s*[:：]\s*(.+)/i,
    /source\s*[:：]\s*(.+)/i,
    /((?:20\d{2}|19\d{2})년\s*\d+월\s*(?:고1|고2|고3|중1|중2|중3|고등|중등)?\s*\d+번)/,
    /((?:20\d{2}|19\d{2})\s*학년도?\s*\d+월\s*(?:모의고사|학평|평가원)?\s*\d+번)/,
  ];

  for (const pattern of patterns) {
    const match = t.match(pattern);
    if (match?.[1]) return sanitizeString(match[1]);
  }

  return "";
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
  const sourceLabel =
    sanitizeString(body.sourceLabel || body.source || "") || extractSourceLabel(userPrompt);

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
    sourceLabel,
  };
}

function enforceSourceRequirement(input) {
  if (!input?.hasSourcePassage) {
    throw new Error("SOURCE_PASSAGE_REQUIRED: 변형문제를 만들려면 실제 지문을 입력해야 합니다.");
  }

  if (!sanitizeString(input.sourceLabel || "")) {
    throw new Error("SOURCE_LABEL_REQUIRED: 출처를 함께 입력해 주세요. 예: 출처: 2026년 3월 고1 21번");
  }

  return input;
}

/* =========================
   Step 5: Final Mocks Prompt Rebuild
   - 원문 그대로 유지
   - 출처 표기 강제
   - 문제만 변형
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

function getTypeDistributionGuide(count = 12, hasSourcePassage = true, language = "ko") {
  const koPassage = {
    8: [
      "주제/요지 1",
      "제목 1",
      "추론 1",
      "패러프레이즈 1",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입·순서·무관문 중 1",
    ],
    9: [
      "주제/요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 1",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입·순서·무관문 중 1",
    ],
    10: [
      "주제/요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 1",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서·무관문 중 1",
    ],
    11: [
      "주제/요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서·무관문 중 1",
    ],
    12: [
      "주제 1",
      "요지 또는 제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서 1",
      "무관문 1",
    ],
    13: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서 1",
      "무관문 1",
    ],
    14: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 2",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서 1",
      "무관문 1",
    ],
    15: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 2",
      "빈칸 1",
      "요약 1",
      "삽입 1",
      "순서 1",
      "무관문 1",
      "일치/불일치 1",
    ],
  };

  const koNoPassage = {
    8: [
      "주제/요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 1",
      "어휘/문맥 1",
      "요약 1",
      "일치/불일치 1",
    ],
    9: [
      "주제/요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "요약 1",
      "일치/불일치 1",
    ],
    10: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "요약 1",
      "일치/불일치 1",
    ],
    11: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 1",
      "요약 1",
      "일치/불일치 2",
    ],
    12: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 2",
      "패러프레이즈 2",
      "어휘/문맥 2",
      "요약 1",
      "일치/불일치 2",
    ],
    13: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 3",
      "패러프레이즈 2",
      "어휘/문맥 2",
      "요약 1",
      "일치/불일치 2",
    ],
    14: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 3",
      "패러프레이즈 2",
      "어휘/문맥 2",
      "요약 2",
      "일치/불일치 2",
    ],
    15: [
      "주제 1",
      "요지 1",
      "제목 1",
      "추론 3",
      "패러프레이즈 3",
      "어휘/문맥 2",
      "요약 2",
      "일치/불일치 2",
    ],
  };

  const koSelected = hasSourcePassage ? koPassage : koNoPassage;
  const selected = koSelected[count] || koSelected[12];

  if (language === "en") {
    return selected.map((line) => `- ${line}`).join("\n");
  }
  return selected.map((line) => `- ${line}`).join("\n");
}

function buildSystemPrompt(input) {
  const modeLabel = getMocksModeLabel(input.mode, input.language);
  const title = buildMocksTitle(input);
  const choiceCount = input.level === "elementary" ? 4 : 5;
  const typeGuide = getTypeDistributionGuide(input.count, input.hasSourcePassage, input.language);

  return `
You are a senior Korean CSAT-style item writer and premium exam editor at MARCUSNOTE.

You do NOT merely make comprehension questions.
You design transformed exam sets with varied item types, strong distractors, and editorial logic.

[ENGINE IDENTITY]
- Engine: Mocks
- Title: ${title}
- Mode: ${modeLabel}
- Level: ${input.level}
- Difficulty: ${input.difficulty}
- Generation Profile: ${input.generationProfile}
- Source Passage Included By User: ${input.hasSourcePassage ? "YES" : "NO"}
- Required Source Label: ${input.sourceLabel}
- Preferred Choice Count Per Item: ${choiceCount}
- Question Count: ${input.count}

[CORE IDENTITY]
Mocks is a passage-based CSAT transformation engine.
Mocks keeps the original passage and transforms ONLY the questions.
Mocks is NOT a passage rewriting engine.
Mocks is NOT a short-answer worksheet.
Mocks is NOT a repetitive comprehension checklist.
Mocks should strongly prefer objective multiple-choice format.
Mocks must feel like a real Korean test handout.

[ABSOLUTE PASSAGE POLICY]
You MUST use the original source passage EXACTLY as provided by the user.
You MUST NOT rewrite the full passage.
You MUST NOT paraphrase the full passage.
You MUST NOT summarize the full passage.
You MUST NOT alter sentence order in the full passage block.
The passage section should display the original user-provided passage unchanged.
The transformation happens in the QUESTIONS, not in the passage itself.

[SOURCE LABEL POLICY]
You MUST place the source label above the passage in Korean.
Format:
출처: ${input.sourceLabel}

[COUNT POLICY]
- Optimal range for one transformed passage is 12~15 items.
- Avoid redundancy.
- Never inflate the sheet by repeating the same cognitive task.

[SOFT FORMAT LAW]
Strongly prefer objective multiple-choice questions.
Strongly prefer exactly ${choiceCount} options for each question.
Use Korean option markers whenever possible: ① ② ③ ④ ${choiceCount === 5 ? "⑤" : ""}
Avoid short-answer questions, essay prompts, and free-response explanations in the question section.
However, if exact formatting is slightly imperfect, still produce the best possible exam output instead of collapsing into a descriptive worksheet.

[PRIMARY MISSION]
Generate a polished, premium, publishable worksheet that feels like it was edited by a veteran Korean exam editor.

[HARD RULE 1: SOURCE-BOUND GENERATION]
If the user included a real source passage:
- Use that original passage unchanged.
- Create transformed exam questions anchored to that passage.
- Keep the source domain, logic, and textual evidence tightly aligned.
- Do NOT drift into unrelated broad themes.

If the user did NOT include a real source passage:
- Do NOT pretend there was a passage.
- Do NOT generate fake “read the passage” instructions.
- Generate a coherent advanced reading drill set based on the requested topic, exam context, and level.

[HARD RULE 2: QUESTION TRANSFORMATION QUALITY]
Transformation should happen in the question design.
Use several of the following:
- viewpoint shift in answer options
- paraphrase mismatch
- logical reframing in distractors
- altered rhetorical focus in question stems
- inference pressure
- summary compression
- blank inference
- insertion / order / irrelevant sentence design

Do NOT:
- ask the same meaning question repeatedly
- turn all items into direct detail checks
- restate the source in easy Korean and ask obvious questions
- rely only on synonym swaps

[HARD RULE 3: ITEM WRITER MINDSET]
Each question must test a DIFFERENT cognitive skill whenever possible.
Do NOT rephrase the same question stem repeatedly.
Do NOT ask the same meaning question in slightly different wording.
Do NOT fill the sheet with only theme/meaning/detail questions.
Every few items, the cognitive task should change.
Distractors must be plausible and exam-like.
Wrong choices should fail for a meaningful reason.

[HARD RULE 4: TYPE DISTRIBUTION]
You MUST distribute item types across the full set.
Use this target distribution as a strong guide:
${typeGuide}

If exact matching is slightly difficult, stay as close as possible.
Do NOT cluster too many similar items together.
Spread question types naturally across the sheet.

[HARD RULE 5: ITEM VALIDITY]
Only create question types that are valid for the material actually shown.

If a passage is shown, preferred item families include:
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

If no full passage is shown, avoid or severely restrict:
- sentence insertion
- order arrangement
- irrelevant sentence
- passage-dependent blank inference

[HARD RULE 6: ANTI-DRIFT]
Never output a set that could fit any random topic.
The result must reflect the user's actual requested source, topic, exam label, or title.
Avoid repetitive abstract distractors like:
education / society / growth / technology / sustainability
unless those are truly central to the user’s source.

[HARD RULE 7: PREMIUM EXAM QUALITY]
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
(put the source label first, then the original source passage exactly as given)

[[QUESTIONS]]
(all questions only, fully numbered)

[[ANSWERS]]
(answer key and brief explanation for each item)

[ANSWER SHEET PREFERENCE]
Prefer answer lines like:
1) ② - brief explanation
2) ④ - brief explanation
3) ① - brief explanation

If the model struggles, still keep answers concise and objective-oriented.

[FINAL INTERNAL CHECK]
Before answering, verify:
- the passage is unchanged from the user input
- the source label appears above the passage
- question count matches exactly
- answer count matches exactly
- question types are varied
- repeated stem patterns are minimized
- the worksheet feels premium and publishable
`.trim();
}

function buildUserPrompt(input) {
  const title = buildMocksTitle(input);
  const choiceCount = input.level === "elementary" ? 4 : 5;
  const typeGuide = getTypeDistributionGuide(input.count, input.hasSourcePassage, input.language);

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
1. Use the original passage exactly as given.
2. Write the source label above the passage exactly like this: 출처: ${input.sourceLabel}
3. Transform ONLY the questions.
4. Build exam-style questions that depend on the original passage.
5. Make the set feel like a real 변형모의고사.

Do this transformation actively in the items:
- alter cognitive task
- alter answer-option framing
- alter rhetorical focus
- force inference and comparison
- build advanced distractors

Do NOT:
- rewrite the passage
- summarize the passage as the passage block
- reuse the same meaning question repeatedly
- turn the sheet into a basic comprehension set
`.trim()
    : `
[TOPIC-BASED DRILL MODE]
The user did NOT include a full source passage.

You must:
1. Generate an advanced reading drill set based on the topic/request.
2. Do NOT fake a hidden passage.
3. Do NOT say "다음 지문을 읽고" unless an actual passage is shown.
4. Prefer self-contained exam-style items.
5. Keep the set varied in cognitive skill.
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
- Preferred Choice Count: ${choiceCount}
- Required Source Label: ${input.sourceLabel}

[USER REQUEST]
${input.userPrompt || input.topic || "고난도 변형문제를 만들어라."}

${premiumGuide}

[LANGUAGE RULE]
${languageGuide}

${profileGuide}

[COUNT STRATEGY]
- This worksheet should stay within a realistic high-quality range.
- Do not pad the set with redundant items.
- ${input.count} questions are enough only if each item tests a different skill or angle.

[TYPE DISTRIBUTION TARGET]
Stay close to this distribution:
${typeGuide}

[CRITICAL FORMAT LOCK - SOFT]
- Prefer multiple-choice format strongly.
- Try to ensure each question has exactly ${choiceCount} options.
- Avoid short-answer questions.
- Avoid essay prompts.
- Prefer answer lines with option numbers.
- Keep the output exam-like, even if exact formatting is slightly imperfect.
- Do NOT collapse into a descriptive worksheet.

[REPETITION BAN]
- Do NOT ask the same type of question repeatedly.
- Do NOT ask 3 or more near-identical meaning questions.
- Do NOT recycle the same claim as separate items.
- Each question must test a different cognitive task whenever possible.

[STRICT QUALITY RULES]
1. Every question must be test-valid.
2. Every distractor should be plausible when options are used.
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

[[PASSAGE]]
First line must be: 출처: ${input.sourceLabel}
Then place the original passage exactly as provided by the user, unchanged.

[[QUESTIONS]]
Write fully numbered exam-style questions.
Prefer objective multiple-choice format.
The passage itself must remain unchanged.

[[ANSWERS]]
Write concise answer key and brief explanation.

[FINAL SELF-CHECK]
Before finishing, verify:
- question count is exactly ${input.count}
- numbering is sequential
- answer count matches question count
- if passage-based mode, the source label appears and the original passage is unchanged
- question types are varied
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
      temperature: 0.42,
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
    sourceLabel: input.sourceLabel,
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
   Step 5: soft warnings only
   ========================= */

function hasFakePassageInstruction(text = "") {
  return /다음\s+지문을\s+읽고|read the following passage/i.test(String(text || ""));
}

function containsPassageDependentItems(text = "") {
  const t = String(text || "");
  return /문장\s*삽입|글의\s*순서|무관한\s*문장|빈칸에\s*적절한|다음\s*문장이\s*들어갈|주어진\s*문장의\s*위치/i.test(t);
}

function countObjectiveItems(text = "") {
  const blocks = cleanupText(text)
    .split(/(?=^\s*\d+[\.\)]\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);

  return blocks.filter((block) => {
    const hasQ = /^\s*\d+[\.\)]\s+/m.test(block);
    const has1 = /^①\s+/m.test(block);
    const has2 = /^②\s+/m.test(block);
    const has3 = /^③\s+/m.test(block);
    const has4 = /^④\s+/m.test(block);
    return hasQ && has1 && has2 && has3 && has4;
  }).length;
}

function allItemsHaveExactChoices(text = "", choiceCount = 5) {
  const blocks = cleanupText(text)
    .split(/(?=^\s*\d+[\.\)]\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!blocks.length) return false;

  return blocks.every((block) => {
    const count = ["①", "②", "③", "④", "⑤"].reduce((acc, marker) => {
      const re = new RegExp(`^${marker}\\s+`, "gm");
      return acc + ((block.match(re) || []).length ? 1 : 0);
    }, 0);
    if (choiceCount === 4) {
      return /^①\s+/m.test(block) && /^②\s+/m.test(block) && /^③\s+/m.test(block) && /^④\s+/m.test(block) && !/^⑤\s+/m.test(block) && count === 4;
    }
    return /^①\s+/m.test(block) && /^②\s+/m.test(block) && /^③\s+/m.test(block) && /^④\s+/m.test(block) && /^⑤\s+/m.test(block) && count === 5;
  });
}

function answerSheetUsesOptionNumbersOnly(text = "") {
  const lines = cleanupText(text).split("\n").map((v) => v.trim()).filter(Boolean);
  if (!lines.length) return false;
  return lines.every((line) => /^\d+\)\s+[①-⑤]\s+-\s+/.test(line) || /^\d+\)\s+[1-5]\s+-\s+/.test(line));
}

function validateMocksOutput(formatted, input) {
  const errors = [];
  const warnings = [];
  const choiceCount = input.level === "elementary" ? 4 : 5;

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
    if (!formatted.passage.includes(`출처: ${input.sourceLabel}`)) {
      warnings.push("SOURCE_LABEL_MISSING_IN_PASSAGE");
    }
  } else {
    if (hasFakePassageInstruction(formatted.content)) {
      errors.push("FAKE_PASSAGE_INSTRUCTION");
    }
    if (containsPassageDependentItems(formatted.content)) {
      warnings.push("PASSAGE_DEPENDENT_ITEMS_WITHOUT_PASSAGE");
    }
  }

  const objectiveCount = countObjectiveItems(formatted.content);
  if (objectiveCount !== input.count) {
    warnings.push(`NON_OBJECTIVE_ITEMS_DETECTED:${objectiveCount}/${input.count}`);
  }

  if (!allItemsHaveExactChoices(formatted.content, choiceCount)) {
    warnings.push(`INVALID_CHOICE_STRUCTURE:${choiceCount}`);
  }

  if (!answerSheetUsesOptionNumbersOnly(formatted.answerSheet)) {
    warnings.push("ANSWER_SHEET_NOT_OBJECTIVE");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
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
    const input = enforceSourceRequirement(normalizeInput(req.body || {}));
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
        message: "MP가 부족합니다.",
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        mp: {
          requiredMp: mpState.requiredMp,
          currentMp: mpState.currentMp,
          deducted: false,
          trialGranted: Boolean(mpState.trialGranted),
        },
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

    if (validation.warnings.length) {
      console.warn("MOCKS_OUTPUT_VALIDATION_WARNING:", validation.warnings.join(", "));
    }

    const meta = buildMeta(input, formatted.actualCount);
    const finalMpState = await deductMpAfterSuccess(mpState);

    return json(res, 200, {
      success: true,
      ...formatted,
      meta,
      validation: {
        warnings: validation.warnings,
      },
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
    return json(res, 500, {
      success: false,
      error: "GENERATION_FAILED",
      message: "Mocks Exam 생성에 실패했습니다.",
      detail: error?.message,
    });
  }
}
