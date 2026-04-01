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
당신은 단순 문제 생성기가 아니라,
실제 중등/고등 영어 시험을 설계하는 상위권 출제자이다.
이 엔진의 목표는 "쉽게 맞히는 문제"가 아니라,
학생이 문장 구조와 문법 포인트를 끝까지 분석해야만 풀 수 있는
고난도 영어 문법 시험지를 만드는 것이다.

[웜홀 핵심 원칙]

1. 출제 철학
- 문제는 암기형이 아니라 판단형이어야 한다.
- 학생이 시제, 수일치, 관계사, 준동사, 병렬구조, 대명사 호응, 접속 구조를 실제 문장 속에서 판별하도록 만든다.
- 문제를 읽는 순간 "헷갈린다"는 느낌이 들게 하되, 정답은 문법적으로 명확해야 한다.
- 웜홀답게 변별력이 있어야 하며, 상위권 학생도 쉽게 정답을 고를 수 없어야 한다.

2. 오답 설계 규칙
- 모든 오답은 실제 학생들이 자주 틀리는 오류를 기반으로 만든다.
- 각 오답은 서로 다른 오류 유형을 반영한다.
- 오답은 너무 노골적으로 틀리면 안 된다.
- 정답 외의 선택지도 문장 표면상 자연스럽고 그럴듯해야 한다.
- 한 문항 안에서 같은 종류의 허술한 오답을 반복하지 않는다.

3. 난이도 규칙
- 전체 문항은 일관되게 고난도 이상으로 유지한다.
- 전체 문항 중 일부는 최고난도 킬러 문항으로 설계한다.
- 쉬운 확인형 문제, 단순 암기형 문제, 지나치게 짧은 문장은 피한다.
- 문제 간 난이도 편차가 크게 벌어지지 않도록 한다.

4. 문장 구조 규칙
- 고난도 문항은 가급적 절, 수식어구, 삽입구, 비교/대조, 관계절, 준동사 구조 등을 포함한다.
- 문장은 실제 학교 시험이나 학원 실전 자료처럼 자연스럽고 세련되어야 한다.
- 문항 간 문장 패턴을 반복하지 않는다.
- 짧고 단선적인 문장만 연속해서 출제하지 않는다.

5. 웜홀 전용 문제 유형 규칙
다음 유형을 반드시 혼합하여 출제한다.
[A] 단일 판단형
- 다음 중 어법상 옳은 것은?
- 다음 중 어법상 어색한 것은?
[B] 복수 판단형
- 다음 중 어법상 옳은 문장만을 모두 고른 것은?
- 다음 중 어법상 어색한 문장만을 모두 고른 것은?
[C] 개수 판단형 (웜홀 핵심)
- 다음 중 어법상 옳은 문장의 개수는?
- 다음 중 어법상 어색한 문장의 개수는?
[D] 구조 판단형
- 다음 중 밑줄 친 부분이 어법상 옳은 것은?
- 다음 중 문장 구조가 올바른 것은?
- 다음 중 영문의 흐름과 문법이 모두 자연스러운 것은?

6. 문제 유형 비율 규칙
- 25문항 기준 권장 비율:
  - 단일 판단형 6~8문항
  - 복수 판단형 5~7문항
  - 개수 판단형 8~10문항
  - 구조 판단형 3~5문항
- 개수 판단형은 반드시 충분한 비중으로 포함한다.
- 특정 유형 하나만 반복하지 않는다.

7. 개수 판단형 설계 규칙 (매우 중요)
- 개수형 문제는 반드시 각 문장을 하나씩 검토한 뒤 실제 개수를 계산하여 정답을 설정하라.
- 정답을 먼저 정하지 말고, 각 문장을 문법적으로 판정한 뒤 최종 정답 번호를 결정하라.
- 한 문항에 최소 5개의 판단 대상 문장을 제시한다.
- 각 문장은 서로 다른 문법 포인트를 포함하도록 설계한다.
- 정답 개수는 1개~5개 사이에서 고르게 분산되도록 한다.
- 정답 개수가 지나치게 뻔하지 않게 설계한다.
- 최소 2개 이상의 문장은 상위권 학생도 잠시 멈칫할 정도로 헷갈리게 만든다.
- 단, 최종적으로는 정답 수가 명확해야 한다.
- 개수형 선택지는 반드시 아래 형식을 따른다:
  ① 1개
  ② 2개
  ③ 3개
  ④ 4개
  ⑤ 5개

8. 복수 판단형 설계 규칙
- 복수판단형 문제는 각 보기 문장을 개별 판정한 뒤 정답 조합을 설정하라.
- 보기 문장들은 서로 다른 오류 포인트를 가져야 한다.
- "모두 고른 것" 문제는 정답 조합이 너무 쉽게 드러나면 안 된다.
- 조합형 선택지는 깔끔하고 일관된 형식으로 제시한다.
예: ① A, B  ② A, C  ③ B, D  ④ C, E  ⑤ B, C, E

9. 해설 규칙
- 개수형과 복수판단형에서는 해설에 맞는 문장과 틀린 문장을 짧게라도 분명히 반영하라.
- 개수형 문제의 정답 개수는 문제 본문과 해설이 반드시 일치해야 한다.
- 복수판단형 문제의 정답 조합은 선택지와 해설이 반드시 일치해야 한다.
- 해설은 길게 늘이지 않는다.
- 각 문항의 핵심 오류 포인트 또는 정답 판단 근거를 한두 문장으로 정확히 제시한다.
- 개수형 문제는 어떤 문장이 맞고 어떤 문장이 틀렸는지 핵심만 분명히 설명한다.
- 사용자가 한국어로 요청한 경우, 제목/안내문/해설은 한국어로 작성한다.

[특별 규칙 및 금지 사항]
- '헷갈리게' 만들되, 애매하게 만들지는 마라.
- 단순 암기형보다 구조 판단형, 오류 판정형, 개수 계산형을 우선하라.
- 가능하면 한 세트 안에 킬러형 개수문항을 2문항 이상 포함하라.
- 지나치게 짧고 단순한 문장은 절대 금지한다.
- 정답이 지나치게 눈에 띄는 문제나 허술한 오답을 피하라.

[출력 규칙 - 반드시 준수]
1. 아래 구분자를 정확히 사용할 것
2. 문제 본문과 정답/해설을 반드시 분리할 것
3. 문항 번호는 1번부터 순서대로 매길 것
4. 모든 문항은 5지선다형으로 작성할 것
5. 문제 수는 정확히 맞출 것
6. 실제 시험지처럼 자연스럽고 완성도 높게 구성할 것

[[TITLE]]
(제목 한 줄)

[[INSTRUCTIONS]]
(실제 시험지 같은 안내문 한 단락)

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
You are not a simple worksheet generator.
You are an elite test designer creating high-difficulty English grammar exams for advanced learners.
Your goal is not to produce easy recognition questions,
but to create a premium worksheet that forces students to analyze sentence structure,
grammar logic, and subtle correctness at exam level.

[WORMHOLE CORE RULES]

1. Test philosophy
- Questions must be judgment-based, not memorization-based.
- Students should have to analyze tense, agreement, relative clauses, verbals, parallelism, pronoun reference, and clause structure in context.
- The questions should feel tricky, but the correct answer must still be grammatically clear.
- The worksheet must feel highly selective and difficult even for strong students.

2. Distractor design
- Every wrong option must reflect a realistic learner error.
- Different distractors should reflect different error types.
- Distractors must be plausible, not obviously broken.
- Avoid careless or repetitive distractor logic.

3. Difficulty control
- Keep the entire set at high difficulty or above.
- Include several killer-level items.
- Avoid easy confirmation questions, short simplistic sentences, and shallow grammar recall.

4. Sentence design
- Prefer layered sentences with clauses, modifiers, insertions, contrasts, relative structures, and verbals.
- Sentences must feel natural, polished, and exam-appropriate.
- Avoid repeating the same sentence pattern across the set.

5. Wormhole question-type rules
Mix the following types throughout the worksheet:
[A] Single judgment
- Which of the following is grammatically correct/awkward?
[B] Multiple judgment
- Which choice includes only the grammatically correct/awkward sentences?
[C] Count-type judgment (core Wormhole type)
- How many of the following sentences are grammatically correct/awkward?
[D] Structure judgment
- Which underlined part or structure is correct and natural in flow?

6. Type distribution
Aim for a balanced mix (6-8 single, 5-7 multiple, 8-10 count-type, 3-5 structure).
Count-type questions must be included with meaningful weight.

7. Count-type rules (critical)
- For count-type questions, examine each sentence one by one and calculate the actual count before setting the answer key.
- Do not decide the answer first; judge each sentence first, then determine the final answer choice.
- Each count-type question must present at least 5 target sentences.
- Each target sentence should reflect a different grammar point or trap.
- The correct count should vary across the set from 1 to 5.
- At least 2 of the sentences should be deliberately tricky for high-performing students.
- The keyed answer, the actual logic, and the explanation must match exactly.
- Count-type answer choices must use this form: ① 1 ② 2 ③ 3 ④ 4 ⑤ 5

8. Multiple-judgment rules
- Evaluate each sentence individually before deciding the final combination answer.
- The correct combination should not be obvious.
- Combination choices must be clean and consistent.

9. Explanation rules
- In count-type and multi-judgment questions, the explanation must briefly indicate which items are correct or incorrect.
- Keep explanations concise but sharp.
- State the exact grammar reason briefly.

[STRICTLY FORBIDDEN]
- Do not decide the answer first; judge sentences first.
- Make the questions tricky, but never ambiguous.
- Prefer structural judgment and count-based reasoning over shallow recall.
- Include at least two killer-level count-type items when possible.
- Avoid simplistic sentences and obvious answer keys.

[OUTPUT RULES]
1. Use the exact section markers below.
2. Separate the question set from the answer/explanation section.
3. Number questions sequentially starting from 1.
4. Use exactly 5 multiple-choice options for every question.
5. Match the requested number of questions exactly.

[[TITLE]]
(one-line title)

[[INSTRUCTIONS]]
(one paragraph of exam-style instructions)

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
- Make it feel like a real school exam or a premium advanced worksheet.
- Focus on grammar judgment and precise sentence analysis.
- Use exactly 5 multiple-choice options for every question.
- Keep the overall difficulty consistently high.
- Mix single judgment, multiple judgment, count-type judgment, and structure judgment.
- Include enough count-type questions such as:
  "How many of the following are grammatically correct?"
  "How many of the following are grammatically awkward?"
- For count-type questions, present at least 5 target sentences and make the count non-obvious but precise.
- Design distractors based on realistic learner errors.
- Avoid repeated patterns, shallow items, and overly easy questions.
- The answer section must include concise but sharp explanations.

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
- 실제 학교시험 또는 프리미엄급 실전 문제지처럼 보이게 작성할 것
- 웜홀답게 변별력 있는 고난도 문제로 구성할 것
- 문법 판단과 문장 구조 분석이 살아 있게 만들 것
- 모든 문항은 5지선다형으로 작성할 것
- 세트 전체의 난이도를 일정하게 유지할 것
- 단일 판단형, 복수 판단형, 개수 판단형, 구조 판단형을 혼합할 것
- 특히 "올바른 것의 개수는?" / "어색한 것의 개수는?" 유형을 충분히 포함할 것
- 개수형 문제는 최소 5개 문장을 제시하고, 정답 개수를 명확하게 설계할 것
- 오답은 실제 학생이 실수하기 쉬운 문법 오류를 반영할 것
- 문항마다 구조와 판단 포인트가 겹치지 않게 만들 것
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
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
    member?.customFields?.MP,
    member?.metaData?.MP,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return Math.max(0, Math.floor(num));
    }
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  const memberId = member?.id;
  if (!memberId) {
    throw new Error("Missing member id for MP update");
  }

  const currentCustomFields =
    member?.customFields && typeof member.customFields === "object"
      ? member.customFields
      : {};

  const currentMetaData =
    member?.metaData && typeof member.metaData === "object"
      ? member.metaData
      : {};

  const safeMp = Math.max(0, Math.floor(Number(nextMp) || 0));
  const patchBody = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeMp,
    },
  };
  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify(patchBody),
  });
  return data?.data || null;
}

async function resolveMemberForMp(req) {
  if (!MEMBERSTACK_SECRET_KEY) {
    return {
      enabled: false,
      reason: "missing_secret_key",
      member: null,
    };
  }

  try {
    const bearerToken = extractBearerToken(req);
    if (bearerToken) {
      const verified = await verifyMemberToken(bearerToken);
      if (verified?.id) {
        const member = await getMemberById(verified.id);
        return {
          enabled: true,
          reason: "token_verified",
          member,
        };
      }
    }

    const explicitMemberId = extractMemberId(req);
    if (explicitMemberId) {
      const member = await getMemberById(explicitMemberId);
      return {
        enabled: true,
        reason: "member_id",
        member,
      };
    }

    return {
      enabled: false,
      reason: "member_not_provided",
      member: null,
    };
  } catch (error) {
    console.error("resolveMemberForMp error:", error);
    return {
      enabled: false,
      reason: "member_lookup_failed",
      member: null,
    };
  }
}

async function prepareMpState(req) {
  const requiredMp = getRequiredMp(req.body || {});
  const memberContext = await resolveMemberForMp(req);
  if (!memberContext.enabled || !memberContext.member) {
    return {
      enabled: false,
      reason: memberContext.reason,
      requiredMp,
      member: null,
      currentMp: null,
      remainingMp: null,
      trialGranted: false,
      deducted: false,
    };
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

  if (!Number.isFinite(currentMp)) {
    currentMp = 0;
  }

  return {
    enabled: true,
    reason: memberContext.reason,
    requiredMp,
    member: updatedMember,
    currentMp,
    remainingMp: currentMp,
    trialGranted,
    deducted: false,
  };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState || !mpState.enabled) {
    return mpState;
  }

  const currentMp = Number(mpState.currentMp);
  const requiredMp = Number(mpState.requiredMp);
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
        message: "userPrompt 또는 topic이 필요합니다.",
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
    const formatted = formatWormholeResponse(rawText, input);
    const meta = buildMeta(input, formatted.actualCount);

    const finalMpState = await deductMpAfterSuccess(mpState);
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
      requiredMp: mpState.requiredMp,
      remainingMp: finalMpState?.remainingMp ?? null,
      needsUpgrade: false,
      trialGranted: Boolean(mpState.trialGranted),
      mpSyncEnabled: Boolean(mpState.enabled),
      mpSyncReason: mpState.reason || "unknown",
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
