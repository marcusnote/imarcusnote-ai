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
  if (/초등|초[1-6]|abc\s*starter|elementary|junior/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|high/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";
  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();

  if (/vocab|vocabulary|어휘|단어|단어장|단어시험|어휘시험|어휘테스트|뜻쓰기|유의어|반의어/.test(t)) {
    return "vocab-builder";
  }
  if (/abc\s*starter|starter|phonics|파닉스|기초영어|알파벳/.test(t)) return "abcstarter";
  if (/영작|writing|composition|rewrite|재배열|문장 재구성/.test(t)) return "writing";
  if (/card|카드|magic\s*card|매직카드/.test(t)) return "magic-card";
  if (/교과서|textbook/.test(t)) return "textbook-grammar";
  if (/chapter|챕터/.test(t)) return "chapter-grammar";

  return "magic";
}

function inferDifficulty(text = "") {
  const t = String(text || "").toLowerCase();
  if (/extreme|최고난도|극상/.test(t)) return "extreme";
  if (/high|고난도|상/.test(t)) return "high";
  if (/basic|기초|입문|하/.test(t)) return "basic";
  if (/standard|중|보통/.test(t)) return "standard";
  return "standard";
}

function inferTopic(text = "") {
  const t = String(text || "");
  const topicPatterns = [
    "알파벳", "파닉스", "be동사", "일반동사", "현재진행형", "현재완료", "과거시제",
    "조동사", "명사", "대명사", "형용사", "부사", "비교급", "최상급", "수동태",
    "관계대명사", "관계부사", "동명사", "to부정사", "가정법", "접속사", "전치사",
    "시제", "수일치", "문장구조", "영작훈련"
  ];
  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }

  const lower = t.toLowerCase();
  if (/alphabet/.test(lower)) return "알파벳";
  if (/phonics/.test(lower)) return "파닉스";
  if (/writing|composition/.test(lower)) return "영작훈련";
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/infinitive|to-infinitive/.test(lower)) return "to부정사";
  if (/gerund/.test(lower)) return "동명사";
  if (/passive/.test(lower)) return "수동태";

  return "문법 학습";
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
  ].filter(Boolean).join(" ");

  const level = ["elementary", "middle", "high"].includes(body.level)
    ? body.level
    : inferLevel(mergedText);

  const modeCandidates = [
    "magic",
    "magic-card",
    "writing",
    "abcstarter",
    "textbook-grammar",
    "chapter-grammar",
    "vocab-builder"
  ];

  const mode = modeCandidates.includes(body.mode) ? body.mode : inferMode(mergedText);
  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty)
    ? body.difficulty
    : inferDifficulty(mergedText);

  const language = ["ko", "en"].includes(body.language) ? body.language : inferLanguage(mergedText);
  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || "") || "workbook";
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const gradeLabel = inferGradeLabel(mergedText, level);

  return {
    engine: "magic",
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
    gradeLabel
  };
}

/* =========================
   Magic Output Builders
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
  return "기초난도";
}

function getModeLabel(mode, language = "ko") {
  const koMap = {
    magic: "매직형",
    "magic-card": "매직카드형",
    writing: "영작훈련형",
    abcstarter: "ABC Starter형",
    "textbook-grammar": "교과서 문법형",
    "chapter-grammar": "챕터 문법형",
    "vocab-builder": "어휘 빌더형"
  };

  const enMap = {
    magic: "Magic",
    "magic-card": "Magic Card",
    writing: "Writing Training",
    abcstarter: "ABC Starter",
    "textbook-grammar": "Textbook Grammar",
    "chapter-grammar": "Chapter Grammar",
    "vocab-builder": "Vocab Builder"
  };

  return language === "en" ? (enMap[mode] || "Magic") : (koMap[mode] || "매직형");
}

function buildMagicTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);

  if (input.language === "en") {
    if (input.mode === "vocab-builder") {
      return `${input.gradeLabel} ${input.topic} Vocab Builder ${difficultyLabel} ${input.count} Items`;
    }
    return `${input.gradeLabel} ${input.topic} Magic ${difficultyLabel} ${input.count} Items`;
  }

  if (input.mode === "abcstarter") {
    return `${input.gradeLabel} ${input.topic} ABC Starter ${difficultyLabel} ${input.count}문항`;
  }

  if (input.mode === "vocab-builder") {
    return `${input.gradeLabel} ${input.topic} 어휘 빌더 ${difficultyLabel} ${input.count}문항`;
  }

  return `${input.gradeLabel} ${input.topic} 마커스매직 ${difficultyLabel} ${input.count}문항`;
}

function buildModeSpecificGuide(input) {
  const isEn = input.language === "en";

  if (input.mode === "vocab-builder") {
    return isEn
      ? `
Mode Identity:
- This is a vocabulary-centered worksheet.
- Do not turn it into a grammar worksheet.
- If a passage is provided, anchor vocabulary tasks to the passage.
- If no passage is provided, build topic-based vocabulary training.
Allowed item styles:
- meaning check
- contextual vocabulary use
- synonym / antonym
- lexical gap-fill
- usage review
Forbidden drift:
- grammar-dominant exam sheet
- unrelated transformation drill
`.trim()
      : `
모드 정체성:
- 이것은 어휘 중심 학습지이다.
- 문법 문제지로 변질시키지 말 것.
- 지문이 있으면 지문 기반 어휘 문제로 만들 것.
- 지문이 없으면 주제 기반 어휘 훈련지로 만들 것.
허용 유형:
- 뜻 확인
- 문맥상 어휘 사용
- 유의어 / 반의어
- 어휘 빈칸
- 용법 점검
금지 변질:
- 문법 중심 시험지
- 무관한 변형 영작 문제
`.trim();
  }

  if (input.mode === "abcstarter") {
    return isEn
      ? `
Mode Identity:
- This is a beginner-friendly foundational English workbook.
- Keep sentence length simple and cognitively light.
- Provide very clear clues and friendly scaffolding.
`.trim()
      : `
모드 정체성:
- 초등 입문 친화형 기초 영어 워크북이다.
- 문장 길이는 짧고 부담이 적어야 한다.
- clue와 안내는 매우 친절하게 제공할 것.
`.trim();
  }

  if (input.mode === "writing") {
    return isEn
      ? `
Mode Identity:
- This is an explicit writing-training workbook.
- Strongly prioritize learner sentence production.
- Use guided composition, transformation, rearrangement, and completion tasks.
`.trim()
      : `
모드 정체성:
- 명시적 영작훈련 워크북이다.
- 학습자의 문장 산출을 강하게 우선할 것.
- guided composition, transformation, rearrangement, completion 유형을 적극 활용할 것.
`.trim();
  }

  if (input.mode === "magic-card") {
    return isEn
      ? `
Mode Identity:
- This is a Magic Card style workbook.
- Keep chapter-based grammar focus, but output must still be production-oriented.
- The worksheet should feel compact, clear, and highly trainable.
`.trim()
      : `
모드 정체성:
- 매직카드형 워크북이다.
- 챕터 기반 문법 초점을 유지하되, 출력은 반드시 생산형 훈련 자료여야 한다.
- 전체 구성은 압축적이되 훈련 효과가 높아야 한다.
`.trim();
  }

  if (input.mode === "textbook-grammar") {
    return isEn
      ? `
Mode Identity:
- This is a textbook-grammar based writing workbook.
- Anchor the grammar to school-textbook style learning goals.
- Still keep the output as guided production practice, not a trap-based exam sheet.
`.trim()
      : `
모드 정체성:
- 교과서 문법 기반 영작 워크북이다.
- 학교 교과서형 학습목표에 맞추되, 시험 함정형이 아니라 안내형 생산 훈련지로 만들 것.
`.trim();
  }

  if (input.mode === "chapter-grammar") {
    return isEn
      ? `
Mode Identity:
- This is a chapter-grammar based writing workbook.
- Focus tightly on the designated chapter grammar.
- Maintain guided production identity across all items.
`.trim()
      : `
모드 정체성:
- 챕터 문법 기반 영작 워크북이다.
- 지정된 챕터 문법에 집중하되, 모든 문항에서 안내형 생산 훈련 정체성을 유지할 것.
`.trim();
  }

  return isEn
    ? `
Mode Identity:
- This is a premium Magic workbook.
- The output must remain workbook-style, production-oriented, and teacher-ready.
`.trim()
    : `
모드 정체성:
- 프리미엄 매직 워크북이다.
- 출력은 반드시 워크북형, 생산형, 교사용 완성형이어야 한다.
`.trim();
}

function buildSystemPrompt(input) {
  const isKo = input.language === "ko";

  if (input.mode === "vocab-builder") {
    return isKo ? `
당신은 MARCUS VOCA BUILDER 전용 생성 엔진이다.

핵심 목표:
- 어휘 중심의 프리미엄 학습 자료를 생성한다.
- 문법 문제가 아니라 어휘 학습지, 어휘 테스트지, 문맥 기반 어휘 훈련지여야 한다.
- 출력물은 교사와 학원이 바로 사용할 수 있을 정도로 깔끔해야 한다.

중요 원칙:
1. 반드시 어휘 중심이어야 한다.
2. 문법 문제지처럼 변질되면 안 된다.
3. 사용자가 지문을 제공하면 지문 기반 어휘 자료로 작성한다.
4. 사용자가 지문을 제공하지 않으면 주제 기반 어휘 훈련지로 작성한다.
5. 뜻, 문맥, 용법, 유의어, 반의어, 빈칸 속 어휘 선택 등 어휘 학습 요소를 활용한다.
6. 정답 섹션을 반드시 제공한다.
7. 객관식이 꼭 필요한 경우에만 제한적으로 사용하고, 무분별한 문법형 객관식은 금지한다.

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim() : `
You are the dedicated MARCUS VOCA BUILDER engine.

Core goals:
- Generate premium vocabulary-centered worksheets.
- Keep the output focused on vocabulary learning, not grammar drilling.
- Make the worksheet teacher-ready and classroom-usable.

Important rules:
1. The worksheet must stay vocabulary-centered.
2. If the user provides a passage, build a passage-based vocabulary worksheet.
3. If no passage is provided, build a topic-based vocabulary practice set.
4. Use meaning, context, usage, synonym, antonym, and lexical review.
5. Do not turn the output into a grammar worksheet.
6. Always provide an answer section.

Output format:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim();
  }

  return isKo ? `
당신은 마커스매직 전용 워크북 생성 엔진이다.

핵심 목표:
- 학습자 친화적이면서도 교육적으로 정교한 영어 학습 워크북을 만든다.
- 출력물은 교사와 학원이 바로 사용할 수 있을 정도로 깔끔해야 한다.
- 매직은 시험 함정형 엔진이 아니라, 영어 문장 생산을 훈련시키는 영작훈련 워크북 엔진이다.

최상위 공통 규칙:
1. 매직은 반드시 영작훈련 중심 워크북이어야 한다.
2. 각 문항은 먼저 학습자의 입력 언어로 제시할 것.
3. 학습자는 제시된 의미를 바탕으로 영어 문장을 직접 생산해야 한다.
4. clue는 가능한 충분히 제공할 것.
5. clue에는 핵심 어휘, 구조 힌트, 문법 앵커, 시간/장소/대상 단서를 적극 포함할 것.
6. 워크북 전체에는 clue 기반 영작형과 재배열 영작형을 함께 포함할 것.
7. 일부 재배열형 문항은 실제 정답에 필요하지 않은 초과단어 1개를 포함할 것.
8. 이 원칙은 특정 예문이 아니라 전체 영어문법 챕터에 공통 적용할 것.
9. 객관식 시험지처럼 작성하지 말 것.
10. 웜홀식 함정 문제지나 모의고사식 시험지로 변질되지 말 것.
11. 문항은 학습자가 직접 쓰고, 고치고, 배열하고, 완성하게 만드는 방향으로 설계할 것.
12. 안내문은 짧고 명확하게 작성할 것.
13. 제목, 안내, 문제, 정답 구조를 반드시 유지할 것.
14. 정답 섹션을 반드시 제공할 것.
15. 문항 수를 가능한 한 정확히 맞출 것.
16. 각 문항은 실제 수업과 과제에 바로 사용할 수 있도록 자연스럽고 교육적으로 설계할 것.

문항 설계 규칙:
- 최소 2가지 이상의 생산형 문항 유형을 섞을 것.
- 대표 유형:
  a) 입력 언어 제시 + 풍부한 clue 기반 영작
  b) 초과단어 1개 포함 재배열 영작
  c) 문장 변환 영작
  d) 부분 완성 후 완전 영작
- clue는 빈약하게 주지 말고, 학습자가 구조를 유추할 수 있을 정도로 충분히 줄 것.
- 단, 정답 전체를 그대로 노출하지는 말 것.
- 문법 챕터의 핵심 구조가 자연스럽게 드러나야 한다.

${buildModeSpecificGuide(input)}

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim() : `
You are the dedicated MARCUS Magic workbook generation engine.

Core goals:
- Generate clean, teacher-ready, workbook-style English practice materials.
- Magic is not a trap-based exam engine. It is a guided English writing-training workbook engine.

Top-level universal rules:
1. Magic must remain a writing-training workbook.
2. Present each item first in the learner's input language.
3. The learner must produce the English sentence.
4. Provide rich clues generously.
5. Clues should include key vocabulary, structural hints, grammar anchors, and time/place/target cues when useful.
6. Across the worksheet, include both clue-based composition items and rearrangement-based writing items.
7. Some rearrangement items must include one extra unnecessary word beyond the correct answer.
8. This rule applies across all grammar chapters, not just one topic.
9. Do not turn the worksheet into a multiple-choice exam sheet.
10. Do not drift into Wormhole-style trap-based grammar identity.
11. Do not drift into Mocks-style exam-passage identity.
12. Make learners write, rebuild, rearrange, transform, and complete sentences.
13. Keep instructions concise and clear.
14. Maintain TITLE / INSTRUCTIONS / QUESTIONS / ANSWERS structure.
15. Always provide an answer section.
16. Match the requested item count as accurately as possible.

Item design rules:
- Mix at least two productive item types.
- Recommended item types:
  a) input-language prompt + rich-clue guided composition
  b) rearrangement writing with one extra unused word
  c) sentence transformation writing
  d) partial-completion to full-sentence writing
- Clues must be generous enough to support guided production.
- But do not reveal the full answer sentence directly.
- The core target grammar should naturally appear in the task design.

${buildModeSpecificGuide(input)}

Output format:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim();
}

function buildTaskGuide(input) {
  const isEn = input.language === "en";

  switch (input.mode) {
    case "vocab-builder":
      return isEn
        ? "Create a vocabulary-centered worksheet. If a passage is provided, use passage-based vocabulary tasks. If not, create a topic-based vocabulary practice set. Do not turn it into a grammar worksheet."
        : "어휘 중심 자료로 구성할 것. 지문이 있으면 지문 기반 어휘 문제로, 지문이 없으면 주제 기반 어휘 훈련지로 작성할 것. 문법 문제지처럼 만들지 말 것.";

    case "abcstarter":
      return isEn
        ? "Create beginner-friendly foundational English tasks with very clear scaffolding and generous clues."
        : "초등 입문 친화형 과제로 구성하되, clue와 안내를 매우 친절하게 제공할 것.";

    case "writing":
      return isEn
        ? "Focus strongly on English writing training through guided composition, rearrangement, and productive sentence building."
        : "영작훈련 중심으로 구성하되, guided composition, 재배열, 문장 생산 훈련을 강하게 반영할 것.";

    case "magic-card":
      return isEn
        ? "Use a compact but highly trainable Magic Card style while preserving guided writing production."
        : "매직카드형의 압축감을 유지하되, 안내형 영작 생산 훈련 중심으로 구성할 것.";

    case "textbook-grammar":
      return isEn
        ? "Anchor the worksheet to textbook-style grammar goals, but keep it as a guided writing workbook."
        : "교과서 문법 학습목표에 맞추되, 결과물은 안내형 영작 워크북으로 유지할 것.";

    case "chapter-grammar":
      return isEn
        ? "Focus tightly on the chapter grammar and make learners produce sentences with generous clues."
        : "챕터 문법에 집중하되, 충분한 clue와 함께 문장 생산 훈련이 일어나도록 구성할 것.";

    default:
      return isEn
        ? "Create premium workbook-style English writing training material with generous clues and multiple productive task types."
        : "풍부한 clue와 복수의 생산형 문항 유형을 갖춘 프리미엄 영작훈련 워크북으로 구성할 것.";
  }
}

function buildUserPrompt(input) {
  const title = buildMagicTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  const taskGuide = buildTaskGuide(input);

  if (input.mode === "vocab-builder") {
    return input.language === "en" ? `
Generate a Vocab Builder worksheet.

Title: ${title}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Difficulty: ${input.difficulty} (${difficultyLabel})
Item count: ${input.count}
Requirement: ${taskGuide}

Additional rules:
- Keep vocabulary as the true center.
- If the user included a passage, extract or anchor the vocabulary from that passage.
- If no passage is included, create a topic-based vocabulary practice worksheet.
- Allowed task types: meaning check, contextual vocabulary use, synonym, antonym, lexical gap-fill, usage review.
- Forbidden: grammar-dominant worksheet, relative pronoun drill, tense drill, generic grammar quiz.

Original request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim() : `
마커스 VOCA BUILDER 스타일 어휘 학습지를 생성하시오.

제목: ${title}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
요구사항: ${taskGuide}

추가 규칙:
- 반드시 어휘 중심으로 작성할 것.
- 사용자가 지문을 제공하면 그 지문에 근거한 어휘 문제를 만들 것.
- 지문이 없으면 주제 기반 어휘 훈련지로 만들 것.
- 허용 유형: 뜻 확인, 문맥상 어휘 사용, 유의어, 반의어, 어휘 빈칸, 용법 점검.
- 금지 유형: 문법 중심 문제지, 관계대명사 문제지, 시제 문제지, 일반 문법 퀴즈.

사용자 원문:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
  }

  return input.language === "en" ? `
Generate a Magic-style English writing workbook.

Title: ${title}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Difficulty: ${input.difficulty} (${difficultyLabel})
Item count: ${input.count}
Requirement: ${taskGuide}

Universal Magic rules:
- Present prompts in the learner's input language first.
- Make learners produce English sentences.
- Provide rich clues generously.
- Include key words, phrase hints, grammar anchors, and structural hints.
- Mix at least two productive item types across the set.
- Include some rearrangement-based writing items with one extra unnecessary word.
- Keep the worksheet production-oriented, not trap-based.

Original request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim() : `
마커스매직 스타일 영어 영작훈련 워크북 세트를 생성하시오.

제목: ${title}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
요구사항: ${taskGuide}

매직 공통 규칙:
- 문제 제시는 먼저 학습자의 입력 언어로 할 것.
- 학습자가 영어 문장을 직접 생산하게 만들 것.
- clue는 가능한 충분히 제공할 것.
- clue에는 핵심 단어, 구 힌트, 문법 앵커, 구조 힌트를 포함할 것.
- 세트 전체에 최소 2가지 이상의 생산형 문항 유형을 섞을 것.
- 일부 문항은 초과단어 1개가 포함된 재배열 영작형으로 만들 것.
- 시험 함정형이 아니라 영작훈련형 워크북 정체성을 유지할 것.

사용자 원문:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
}

/* =========================
   External API Call & Parsing
   ========================= */

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.55,
      max_tokens: 8000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";

  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;

  return end === -1
    ? rawText.slice(from).trim()
    : rawText.slice(from, end).trim();
}

function formatMagicResponse(rawText, input) {
  const title = extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]");
  const instructions = extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]");
  const questions = extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]");
  const answers = extractSection(rawText, "[[ANSWERS]]", null);

  const finalTitle = title.trim() || buildMagicTitle(input);
  const contentParts = [finalTitle, instructions.trim(), questions.trim()].filter(Boolean);
  const fullParts = [...contentParts];

  if (answers.trim()) {
    fullParts.push((input.language === "en" ? "Answers\n" : "정답\n") + answers.trim());
  }

  return {
    title: finalTitle,
    instructions: instructions.trim(),
    content: contentParts.join("\n\n"),
    answerSheet: answers.trim(),
    fullText: fullParts.join("\n\n"),
    actualCount: (questions.match(/^\s*\d+\./gm) || []).length
  };
}

/* =========================
   MP deduction helpers only
   ========================= */

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) return null;
  return {
    "x-api-key": MEMBERSTACK_SECRET_KEY,
    "Content-Type": "application/json"
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
    headers: { ...headers, ...(options.headers || {}) }
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
  if (MEMBERSTACK_APP_ID) payload.audience = MEMBERSTACK_APP_ID;

  const data = await memberstackRequest("/verify-token", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;

  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
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
    if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  const memberId = member?.id;
  if (!memberId) throw new Error("Missing member id for MP update");

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
    customFields: { ...currentCustomFields, [MEMBERSTACK_MP_FIELD]: safeMp },
    metaData: { ...currentMetaData, [MEMBERSTACK_MP_FIELD]: safeMp },
  };

  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify(patchBody)
  });

  return data?.data || null;
}

async function resolveMemberForMp(req) {
  if (!MEMBERSTACK_SECRET_KEY) {
    return { enabled: false, reason: "missing_secret_key", member: null };
  }

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
    return {
      enabled: false,
      reason: memberContext.reason,
      requiredMp,
      member: null,
      currentMp: null,
      remainingMp: null,
      trialGranted: false,
      deducted: false
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

  if (!Number.isFinite(currentMp)) currentMp = 0;

  return {
    enabled: true,
    reason: memberContext.reason,
    requiredMp,
    member: updatedMember,
    currentMp,
    remainingMp: currentMp,
    trialGranted,
    deducted: false
  };
}

async function deductMpAfterSuccess(mpState) {
  if (!mpState || !mpState.enabled) return mpState;

  const currentMp = Number(mpState.currentMp);
  const requiredMp = Number(mpState.requiredMp);

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
    deducted: true
  };
}

/* =========================
   Main Handler
   ========================= */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      message: "POST 요청만 허용됩니다."
    });
  }

  try {
    const input = normalizeInput(req.body || {});

    if (!input.userPrompt && !input.topic) {
      return json(res, 400, {
        success: false,
        message: "userPrompt 또는 topic이 필요합니다."
      });
    }

    const mpState = await prepareMpState(req);

    if (mpState.enabled && mpState.currentMp < mpState.requiredMp) {
      return json(res, 403, {
        success: false,
        error: "INSUFFICIENT_MP",
        message: "MP가 부족합니다.",
        requiredMp: mpState.requiredMp,
        remainingMp: mpState.currentMp
      });
    }

    const rawText = await callOpenAI(
      buildSystemPrompt(input),
      buildUserPrompt(input)
    );

    const formatted = formatMagicResponse(rawText, input);
    const finalMpState = await deductMpAfterSuccess(mpState);

    return json(res, 200, {
      success: true,
      ...formatted,
      meta: {
        language: input.language,
        requestedCount: input.count,
        actualCount: formatted.actualCount,
        generatedAt: new Date().toISOString()
      },
      remainingMp: finalMpState?.remainingMp ?? null,
      mpSyncEnabled: Boolean(mpState.enabled)
    });
  } catch (error) {
    console.error("Handler error:", error);
    return json(res, 500, {
      success: false,
      message: "매직 워크북 생성에 실패했습니다.",
      detail: error.message
    });
  }
}
