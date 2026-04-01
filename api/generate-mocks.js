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

  if (/변형형|변형문제|패러프레이즈|paraphrase|유의어|동의어|반의어|추론|함축|요지|주제|주장|태도|제목|삽입|순서/.test(t)) {
    return "transform";
  }
  if (/수능형|수능|학평|평가원|모평|csat|mock/.test(t)) {
    return "csat";
  }
  if (/내신형|내신|학교시험|중간고사|기말고사|school/.test(t)) {
    return "school";
  }

  return "hybrid";
}

function inferPremium(text = "") {
  const t = String(text || "").toLowerCase();
  return /premium|프리미엄|상위권|최상위|고퀄|high-end/.test(t);
}

function inferTopic(text = "") {
  const source = String(text || "");
  const topicPatterns = [
    "주제",
    "요지",
    "주장",
    "제목",
    "글쓴이의 생각",
    "글쓴이의 태도",
    "태도",
    "의미함축",
    "추론",
    "유의어",
    "동의어",
    "반의어",
    "패러프레이즈",
    "어법",
    "어휘",
    "문장삽입",
    "순서배열",
    "빈칸추론",
    "요약문",
  ];

  for (const topic of topicPatterns) {
    if (source.includes(topic)) return topic;
  }

  const lower = source.toLowerCase();
  if (/main idea/.test(lower)) return "주제";
  if (/gist|key point/.test(lower)) return "요지";
  if (/claim/.test(lower)) return "주장";
  if (/title/.test(lower)) return "제목";
  if (/attitude/.test(lower)) return "글쓴이의 태도";
  if (/implication/.test(lower)) return "의미함축";
  if (/inference/.test(lower)) return "추론";
  if (/synonym|equivalent/.test(lower)) return "유의어/동의어";
  if (/antonym/.test(lower)) return "반의어";
  if (/paraphrase/.test(lower)) return "패러프레이즈";
  if (/grammar/.test(lower)) return "어법";
  if (/vocab|word/.test(lower)) return "어휘";
  if (/blank/.test(lower)) return "빈칸추론";
  if (/insertion/.test(lower)) return "문장삽입";
  if (/order|sequence/.test(lower)) return "순서배열";
  if (/summary/.test(lower)) return "요약문";

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

  const modeLabel = getModeLabel(input.mode, input.language);

  if (input.language === "en") {
    return `${input.gradeLabel} ${input.topic} Mock Exam ${modeLabel} ${input.count} Questions`;
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
- Keep the transformed passage fully independent from the source.
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
- 변형 지문은 원문과 독립적인 신규 지문처럼 보여야 한다.
- 결과물은 상위권용 프리미엄 시험지처럼 보여야 한다.
`.trim();
}

function buildModeBlock(mode, language = "ko") {
  if (language === "en") {
    if (mode === "school") {
      return `
[MODE: SCHOOL EXAM]
- Prioritize school-exam-friendly transformed items.
- Emphasize main idea, gist, claim, attitude, title, grammar judgment.
- Keep the style suitable for premium internal school exams.
- Maintain strong distractors, but make the set coherent and classroom-usable.
`.trim();
    }
    if (mode === "csat") {
      return `
[MODE: CSAT STYLE]
- Prioritize CSAT-style reading logic.
- Emphasize gist, title, implication, inference, sentence insertion, order arrangement, blank logic.
- Make the tone closer to Korean mock-test reading sets.
- Increase reasoning density and subtle distractors.
`.trim();
    }
    if (mode === "transform") {
      return `
[MODE: TRANSFORMATION]
- Prioritize transformed-question logic most strongly.
- Emphasize paraphrase, synonym/equivalent/antonym in context, implication, inference, transformed title/theme.
- Make the passage and questions feel substantially restructured from the source.
`.trim();
    }
    return `
[MODE: HYBRID]
- Blend school exam, CSAT-style, and premium transformation logic.
- Ensure a balanced set across reading, structure, inference, and advanced grammar.
`.trim();
  }

  if (mode === "school") {
    return `
[모드: 내신형]
- 학교시험형 변형문제를 우선한다.
- 주제, 요지, 주장, 태도, 제목, 어법 판단을 중점 반영한다.
- 프리미엄 내신 시험지처럼 일관되고 실전적으로 구성한다.
`.trim();
  }
  if (mode === "csat") {
    return `
[모드: 수능형]
- 수능/학평형 독해 논리를 우선한다.
- 요지, 제목, 의미함축, 추론, 문장삽입, 순서배열, 빈칸 논리를 강화한다.
- 모의고사형 독해 세트처럼 사고력을 요구하게 설계한다.
`.trim();
  }
  if (mode === "transform") {
    return `
[모드: 변형형]
- 변형문제 성격을 가장 강하게 반영한다.
- 패러프레이즈, 유의어/동의어/반의어 문맥 판단, 의미함축, 추론, 변형 제목/주제를 중점 반영한다.
- 원문 느낌이 직접 드러나지 않도록 구조와 표현을 적극 재구성한다.
`.trim();
  }
  return `
[모드: 혼합형]
- 내신형, 수능형, 변형형 특성을 균형 있게 혼합한다.
- 독해형, 구조형, 추론형, 고난도 어법을 고르게 섞는다.
`.trim();
}

function buildSystemPrompt(input) {
  const premiumBlock = input.premium ? "\n\n" + buildPremiumBlock(input.language) : "";
  const modeBlock = "\n\n" + buildModeBlock(input.mode, input.language);

  return `
You are the premium high-school transformed exam generator of I•marcusnote.

[ENGINE IDENTITY]
Engine Name: Mocks
Primary Source Level: Marcus Crown Level 4
Target Students: Korean high school students, especially upper-intermediate to advanced learners (roughly high school grade 2–3 level)

This engine is NOT a basic worksheet generator.
This engine is a PREMIUM transformed exam generator for high-level mock-test-style English questions.

[CORE PURPOSE]
Generate high-quality transformed English exam questions based on high-school-level source material.
The output must feel like a premium Korean mock-exam transformation set, not a simple workbook.

[PRIMARY SOURCE RULE]
- The main source base is Marcus Crown Level 4.
- Marcus Crown Level 4 consists of 4 high-school-level books.
- Use the source as intellectual material only.
- DO NOT directly copy passages or sentences.
- You MUST transform, reconstruct, and redesign the material into premium exam questions.

[ABSOLUTE IDENTITY RULES]
1. This engine is for HIGH SCHOOL transformed exam questions.
2. The overall tone must be premium, difficult, and test-like.
3. The test must feel appropriate for strong high school students.
4. The output must reflect transformed-question logic, not direct reproduction.
5. Difficulty may be adjusted, but the baseline must remain advanced.

[MANDATORY QUESTION PHILOSOPHY]
This is a transformed exam.
Therefore:
- do not merely rewrite sentences superficially
- do not make shallow vocabulary matching questions
- do not create easy pattern-based questions
- do not rely on direct sentence lifting
- do not make predictable distractors

Instead:
- reconstruct sentence logic
- alter wording meaningfully
- redesign the testing point
- require interpretation, comparison, inference, or evaluation
- create questions that feel like true transformed mock-exam items

[CORE REQUIRED QUESTION TYPES]
The following types are NOT optional.
They must form the central structure of the test:

1. Main Idea / 주제
2. Key Point / Gist / 요지
3. Author’s Claim / 주장
4. Author’s Attitude / 글쓴이의 생각, 태도
5. Title / 제목

These five types must be clearly distinguished from each other.
Do NOT collapse them into one vague reading type.

[IMPORTANT DISTINCTION RULE]
- Main Idea = the broad overall topic or central area of discussion
- Key Point (Gist) = the writer’s main takeaway or core message
- Author’s Claim = the writer’s assertive position or argument
- Author’s Attitude = the writer’s tone, stance, or viewpoint
- Title = the most suitable heading representing the text

The distinction between Main Idea, Gist, and Claim must remain clear.

[CORE DISTRIBUTION RULE]
For a full set, the exam must include multiple items from the core reading group.
Gist / Key Point (요지) is especially important and must appear meaningfully.
Core reading question types should form the backbone of the test.

[ADDITIONAL PREMIUM QUESTION TYPES]
In addition to the core reading types, include premium transformed types such as:
- synonym in context
- equivalent expression
- antonym in context
- paraphrase
- implication / 의미 함축
- inference / 추론
- transformed theme/title
- vocabulary in context
- sentence insertion
- order arrangement
- grammar traps
- advanced grammar judgment

[CONTEXT-BASED VOCABULARY RULE]
All synonym / equivalent expression / antonym items must be context-based.
Do NOT create isolated vocabulary memorization questions.
These items must require reading comprehension and meaning judgment.

[INFERENCE AND IMPLICATION RULE]
Inference and implication questions must require actual reasoning.
The answer must not be found by matching one obvious sentence.
Students should need to understand the text as a whole.

[TRANSFORMATION RULE]
Every item must show meaningful transformation.
At least one or more of the following must happen:
- sentence restructuring
- logic flow adjustment
- focus shift
- paraphrased meaning reconstruction
- altered expression with preserved intent
- changed question angle
- reconstructed distractor logic

[DIFFICULTY CONTROL]
The engine may adjust difficulty internally, but the default baseline is advanced.
Recommended internal scale:
- Advanced
- High
- Extreme

Regardless of level, the output must still feel like a premium high-school transformed exam.

[HIGH DIFFICULTY LABEL RULE]
If any question is worth 5 points or more, you MUST mark it with [High Difficulty].

Correct format example:
21. What is the best title for the passage? [High Difficulty] (5 points)

Rules:
- 5 points or more = mandatory [High Difficulty]
- less than 5 points = no label unless explicitly justified
- the label must appear in the final visible output
- the label must remain visible in PDF output as well

[HIGH DIFFICULTY DESIGN RULE]
Questions marked [High Difficulty] should usually come from premium reasoning-heavy types such as:
- gist
- implication
- inference
- title
- main idea
- paraphrase
- claim
- advanced grammar traps

Do NOT assign [High Difficulty] to an easy item.

[DISTRACTOR RULES]
Distractors must be:
- plausible
- tempting
- partially believable
- clearly wrong only after careful reasoning

Do NOT produce:
- obviously wrong choices
- silly distractors
- choices that fail immediately
- grammatical nonsense unless the item specifically tests grammar

[ANSWER KEY RULE]
Provide:
- answer key
- brief explanation for each answer
- explanation should clarify why the correct answer is right
- explanation should briefly show why strong distractors are wrong when useful

[OUTPUT QUALITY RULE]
The final set must be coherent, balanced, high-level, and premium in tone.

[STRICTLY FORBIDDEN]
- direct passage copying
- shallow rewriting
- random easy items
- repetitive question stems
- overuse of one type only
- weak distractors
- vocabulary-only trivia questions
- middle-school style simplification
${modeBlock}${premiumBlock}

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
        ? `\nPremium mode is ON.\n- Raise distractor quality.\n- Increase implication and inference density.\n- Make the worksheet feel premium and upper-tier.\n`
        : `\n프리미엄 모드 활성화:\n- 선택지의 밀도와 부분 타당성을 높일 것.\n- 함축과 추론 비중을 높일 것.\n- 결과물을 상위권용 프리미엄 시험지처럼 설계할 것.\n`)
    : "";

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
${premiumNote}

Additional mandatory requirements:
- Do NOT reuse the source passage directly.
- Use the source only as reference material.
- The output must be a newly redesigned transformed test set.
- Every question must use exactly 5 options.
- Include core reading types meaningfully: main idea, gist, claim, attitude, title.
- Include additional premium transformed types according to mode.
- Mark 5pt+ questions as [High Difficulty].

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
${premiumNote}

추가 필수 요구사항:
- 입력 지문을 그대로 다시 사용하지 말 것.
- 입력 지문은 참고자료로만 사용할 것.
- 출력은 신규 고난도 변형문제 세트여야 한다.
- 모든 문항은 5지선다형으로 작성할 것.
- 주제, 요지, 주장, 글쓴이의 태도, 제목 유형을 의미 있게 포함할 것.
- 모드에 맞는 유형 비중을 강화할 것.
- 5점 이상 문항은 반드시 [High Difficulty]라고 표기할 것.

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
  return end === -1 ? rawText.slice(from).trim() : rawText.slice(from, end).trim();
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
  const answerMatch = cleaned.search(/\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i);

  if (answerMatch === -1) {
    return { title: "", instructions: "", questions: cleaned, answers: "" };
  }

  return {
    title: "",
    instructions: "",
    questions: cleaned.slice(0, answerMatch).trim(),
    answers: cleaned.slice(answerMatch).trim(),
  };
}

function enforceHighDifficultyLabels(questionsText = "") {
  const blocks = cleanupText(questionsText)
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!blocks.length) return cleanupText(questionsText);

  const upgraded = blocks.map((block) => {
    const lines = block.split("\n");
    if (!lines.length) return block;

    const firstLine = lines[0];
    const hasFivePoint = /\((?:5|6|7|8|9|10)\s*(?:점|points?)\)/i.test(firstLine);
    const hasLabel = /\[High Difficulty\]/i.test(firstLine);

    if (hasFivePoint && !hasLabel) {
      lines[0] = firstLine.replace(/\s*\((?:5|6|7|8|9|10)\s*(?:점|points?)\)/i, (m) => ` [High Difficulty] ${m}`);
    }

    return lines.join("\n");
  });

  return upgraded.join("\n\n").trim();
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
  finalQuestions = enforceHighDifficultyLabels(finalQuestions);
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

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Memberstack request failed: ${response.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

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
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return sanitizeMp(parsed, 0);
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) return null;

  const safeNextMp = sanitizeMp(nextMp, 0);
  const body = {
    customFields: {
      ...(member?.customFields || {}),
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
    },
    metaData: {
      ...(member?.metaData || {}),
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
    return { member, currentMp: current, trialGranted: false };
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
    if (bearer) member = await verifyMemberToken(bearer);
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
  if (!mpState?.enabled || !mpState?.member) return { ...mpState, deducted: false };

  const currentMp = sanitizeMp(mpState.currentMp, 0);
  const requiredMp = sanitizeMp(mpState.requiredMp, 0);

  if (!Number.isFinite(currentMp) || !Number.isFinite(requiredMp)) {
    return { ...mpState, deducted: false };
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

async function generateWithRetry(input) {
  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  const firstRaw = await callOpenAI(systemPrompt, userPrompt);
  const firstFormatted = formatMocksResponse(firstRaw, input);

  if (firstFormatted.actualCount >= input.count) {
    return firstFormatted;
  }

  if (firstFormatted.actualCount >= Math.ceil(input.count * 0.8)) {
    return firstFormatted;
  }

  const retryPrompt = `${userPrompt}

중요 재지시:
- 요청 문항 수 ${input.count}문항을 반드시 정확히 맞출 것.
- 문항 번호 누락 금지.
- [[QUESTIONS]]와 [[ANSWERS]]를 완전하게 출력할 것.
- 이미 생성한 중간 결과가 불완전했다면 처음부터 완전한 최종본만 다시 작성할 것.
`.trim();

  const secondRaw = await callOpenAI(systemPrompt, retryPrompt);
  return formatMocksResponse(secondRaw, input);
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

    const formatted = await generateWithRetry(input);

    if (formatted.actualCount < Math.ceil(input.count * 0.8)) {
      throw new Error(`Insufficient question count: expected ${input.count}, got ${formatted.actualCount}`);
    }

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
