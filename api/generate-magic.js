module.exports.config = { runtime: "nodejs" };

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
  junior_starter: 3,
  writing_lab: 4,
  grammar_intensive: 5,
  reading_mocks: 5,
  vocab_workbook: 4,
  vocab_csat: 5,
};

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
  if (/vocab|vocabulary|어휘|단어|단어장|단어시험|어휘시험|어휘테스트|뜻쓰기|유의어|반의어/.test(t)) return "vocab-builder";
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

function detectMagicIntent(text = "") {
  const t = String(text || "").toLowerCase();
  const conceptKeywords = [
    "개념", "개념설명", "개념 설명", "설명", "정리", "예문", "문법 설명",
    "문법개념", "문법 개념", "문법 정리", "grammar explanation",
    "grammar concept", "concept", "examples", "example sentences"
  ];
  const trainingKeywords = [
    "영작", "영작훈련", "쓰기", "writing", "composition", "rearrange",
    "재배열", "문장 완성", "워크북", "훈련"
  ];
  const isConcept = conceptKeywords.some((k) => t.includes(k));
  const isTraining = trainingKeywords.some((k) => t.includes(k));

  if (isConcept && isTraining) return "concept+training";
  if (isConcept) return "concept";
  return "training";
}

function detectGrammarFocus(text = "") {
  const raw = String(text || "");
  const t = raw.toLowerCase();

  const hasAny = (patterns) => patterns.some((p) => p.test(raw) || p.test(t));

  const isRelativePronoun = hasAny([
    /관계대명사/,
    /relative\s*pronoun/i,
  ]);

  const isRelativeAdverb = hasAny([
    /관계부사/,
    /relative\s*adverb/i,
  ]);

  const isToInfinitive = hasAny([
    /to부정사/,
    /to-infinitive/i,
    /infinitive/i,
  ]);

  const isGerund = hasAny([
    /동명사/,
    /gerund/i,
  ]);

  const isPassive = hasAny([
    /수동태/,
    /passive/i,
  ]);

  const isPresentPerfect = hasAny([
    /현재완료/,
    /present\s+perfect/i,
  ]);

  const isComparative = hasAny([
    /비교급/,
    /comparative/i,
  ]);

  const isSuperlative = hasAny([
    /최상급/,
    /superlative/i,
  ]);

  const isParticipialModifier = hasAny([
    /분사의\s*한정적\s*용법/,
    /분사\s*한정적\s*용법/,
    /현재분사\s*한정적\s*용법/,
    /과거분사\s*한정적\s*용법/,
    /participial\s*modifier/i,
    /attributive\s*participle/i,
    /participle\s+as\s+adjective/i,
  ]);

  const isCausative = hasAny([
    /사역동사/,
    /causative/i,
  ]);

  const isSoThatPurpose = hasAny([
    /so that\s*구문/,
    /so that\s*\(목적\)/,
    /purpose clause/i,
    /so that/i,
  ]);

  const isNonRestrictive = hasAny([
    /계속적\s*용법/,
    /non[-\s]?restrictive/i,
    /nonrestrictive/i,
    /comma relative/i,
  ]);

  const isRestrictive = hasAny([
    /제한적\s*용법/,
    /restrictive/i,
  ]) && !isNonRestrictive;

  const isObjectiveRelativePronoun = hasAny([
    /목적격\s*관계대명사/,
    /objective\s*relative\s*pronoun/i,
  ]);

  let chapterKey = "general";
  if (isRelativePronoun && isNonRestrictive) chapterKey = "relative_pronoun_non_restrictive";
  else if (isRelativePronoun && isObjectiveRelativePronoun) chapterKey = "relative_pronoun_objective";
  else if (isRelativePronoun && isRestrictive) chapterKey = "relative_pronoun_restrictive";
  else if (isRelativePronoun) chapterKey = "relative_pronoun_general";
  else if (isRelativeAdverb) chapterKey = "relative_adverb";
  else if (isToInfinitive) chapterKey = "to_infinitive";
  else if (isGerund) chapterKey = "gerund";
  else if (isPassive) chapterKey = "passive";
  else if (isPresentPerfect) chapterKey = "present_perfect";
  else if (isSuperlative) chapterKey = "superlative";
  else if (isComparative) chapterKey = "comparative";
  else if (isParticipialModifier) chapterKey = "participial_modifier";
  else if (isCausative) chapterKey = "causative";
  else if (isSoThatPurpose) chapterKey = "so_that_purpose";

  return {
    chapterKey,
    isRelativePronoun,
    isRelativeAdverb,
    isToInfinitive,
    isGerund,
    isPassive,
    isPresentPerfect,
    isComparative,
    isSuperlative,
    isParticipialModifier,
    isCausative,
    isSoThatPurpose,
    isNonRestrictive,
    isRestrictive,
    isObjectiveRelativePronoun,
  };
}


function sanitizeEngine(value) {
  const v = sanitizeString(value).toLowerCase();

  if (v === "abc_starter" || v === "abcstarter") return "magic";
  if (v === "mock_exam") return "mocks";
  if (v === "vocab_workbook" || v === "vocab_csat") return "vocab";

  if (["wormhole", "magic", "mocks", "vocab"].includes(v)) {
    return v;
  }

  return "magic";
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
    sanitizeString(body.engine || ""),
  ]
    .filter(Boolean)
    .join(" ");

  const engine = sanitizeEngine(body.engine);

  const level =
    ["elementary", "middle", "high"].includes(body.level)
      ? body.level
      : inferLevel(mergedText);

  const modeCandidates = [
    "magic",
    "magic-card",
    "writing",
    "abcstarter",
    "textbook-grammar",
    "chapter-grammar",
    "vocab-builder",
    "vocab-csat",
  ];
  const mode = modeCandidates.includes(body.mode)
    ? body.mode
    : inferMode(mergedText);

  const difficulty =
    ["basic", "standard", "high", "extreme"].includes(body.difficulty)
      ? body.difficulty
      : inferDifficulty(mergedText);

  const language =
    ["ko", "en"].includes(body.language)
      ? body.language
      : inferLanguage(mergedText);

  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || "") || "workbook";
  const worksheetTitle = sanitizeString(body.worksheetTitle || "");
  const academyName = sanitizeString(body.academyName || "Imarcusnote");
  const count = sanitizeCount(body.count);
  const intentMode = detectMagicIntent(mergedText);
  const grammarFocus = detectGrammarFocus(mergedText);
  const grammarOptions =
    body.grammarOptions && typeof body.grammarOptions === "object"
      ? body.grammarOptions
      : null;

  const effectiveCount =
    intentMode === "concept"
      ? 3
      : intentMode === "concept+training"
      ? 5
      : count;

  const gradeLabel = inferGradeLabel(mergedText, level);

  const vocabSeriesStart = clamp(Number(body.vocabSeriesStart || 1), 1, 200);
  const vocabSeriesEnd = clamp(Number(body.vocabSeriesEnd || 1), 1, 200);
  const vocabItemsPerRound = clamp(
    Number(body.vocabItemsPerRound || 20),
    10,
    30
  );

  return {
    engine,
    level,
    mode,
    topic,
    examType,
    difficulty,
    count: effectiveCount,
    language,
    worksheetTitle,
    academyName,
    userPrompt,
    gradeLabel,
    vocabSeriesStart,
    vocabSeriesEnd: Math.max(vocabSeriesStart, vocabSeriesEnd),
    vocabItemsPerRound,
    intentMode,
    grammarFocus,
    grammarOptions,
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
  if (input.mode === "vocab-builder") {
    const start = Number(input.vocabSeriesStart || 1);
    const end = Number(input.vocabSeriesEnd || 1);
    if (input.language === "en") {
      if (start === end) return `Vocabulary Round ${start}`;
      return `Vocabulary Rounds ${start}-${end}`;
    }
    if (start === end) {
      return `${input.gradeLabel} 필수어휘 ${start}회`;
    }
    return `${input.gradeLabel} 필수어휘 ${start}~${end}회`;
  }

  const isConcept = input.intentMode === "concept" || input.intentMode === "concept+training";
  if (isConcept) {
    if (input.language === "en") {
      return `${input.gradeLabel} ${input.topic} Concept Explanation and Examples`;
    }
    return `${input.gradeLabel} ${input.topic} 개념설명과 예문`;
  }

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  if (input.language === "en") {
    return `${input.gradeLabel} ${input.topic} Magic ${difficultyLabel} ${input.count} Items`;
  }
  if (input.mode === "abcstarter") {
    return `${input.gradeLabel} ${input.topic} ABC Starter ${difficultyLabel} ${input.count}문항`;
  }
  return `${input.gradeLabel} ${input.topic} 마커스매직 ${difficultyLabel} ${input.count}문항`;
}

function buildVocabSeriesBlock(input) {
  const start = Number(input.vocabSeriesStart || 1);
  const end = Number(input.vocabSeriesEnd || 1);
  const perRound = Number(input.vocabItemsPerRound || input.count || 20);
  const rounds = [];
  for (let r = start; r <= end; r += 1) {
    rounds.push(`- Round ${r}: ${perRound} vocabulary items`);
  }
  return `
[VOCAB ROUND SERIES]

STRICT OUTPUT RULE (CRITICAL):
- MUST include "### Round 1", "### Round 2"
- MUST restart numbering from 1 in each round
- MUST include Korean meanings
- NEVER skip numbering

${rounds.join("\n\n")}

Rules:
- Separate each round clearly.
- Each round must include:
  1. Vocabulary List
  2. Vocabulary Test
- Avoid overlap between rounds as much as possible.
- Keep each round independently usable.
`.trim();
}

function buildConceptGuide(input) {
  const isEn = input.language === "en";
  return isEn ?
  `
Mode Identity:
- This is a grammar concept-and-example sheet.
- Do NOT turn it into a writing-only workbook.
- Teach first, then train lightly.

Required structure:
1. Clear concept explanation
2. Core pattern summary
3. 6-10 example sentences
4. Mini Check (3-5 items)
5. Answer section

Rules:
- Explanations must be concise but teacher-like.
- Example sentences must be complete and natural.
- Mini Check should be simple and directly linked to the concept.
- Keep classroom and workbook tone.
` : `
모드 정체성:
- 이것은 문법 개념설명 + 예문 학습지이다.
- 영작훈련지로만 변질시키지 말 것.
- 먼저 가르치고, 그 다음 가볍게 확인하게 할 것.
필수 구조:
1. 개념 설명
2. 핵심 구조 정리
3. 예문 6~10개
4. Mini Check 3~5문항
5. 정답

규칙:
- 설명은 간결하지만 교사다운 톤으로 작성할 것.
- 예문은 완전한 문장으로 자연스럽게 작성할 것.
- Mini Check는 개념과 직접 연결될 것.
- 전체 톤은 교재형, 워크북형으로 유지할 것.
`;
}

function buildModeSpecificGuide(input) {
  const isEn = input.language === "en";
  if (input.mode === "vocab-builder") {
    return isEn ? `
Mode Identity:
- This is a vocabulary-centered worksheet.
- Do not turn it into a grammar worksheet.
- If a passage is provided, anchor vocabulary tasks to the passage.
- If no passage is provided, build topic-based vocabulary training.
- Allowed item styles:
- meaning check
- contextual vocabulary use
- synonym / antonym
- lexical gap-fill
- usage review

Forbidden drift:
- grammar-dominant exam sheet
- unrelated transformation drill
`.trim() : `
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
    return isEn ?
    `
Mode Identity:
- This is a beginner-friendly starter workbook.
- Keep sentence length short and cognitively light.
- Use very clear clues and gentle scaffolding.
- Prefer highly guided production over open-ended difficulty.
- Keep vocabulary basic and school-friendly.

Preferred item tendencies:
- fragment-clue writing
- simple rearrangement
- partial completion
`.trim() : `
모드 정체성:
- 초등 입문 친화형 스타터 워크북이다.
- 문장 길이는 짧고 부담이 적어야 한다.
- clue와 안내는 매우 친절하고 분명해야 한다.
- 자유 영작보다 안내형 생산 훈련을 우선할 것.
- 어휘는 기초적이고 학교 친화적이어야 한다.
- 반드시 문제와 정답을 분리 가능한 구조로 출력할 것.

초등 문법 정확성 특수 규칙:
- countable noun 복수에는 many / a few를 우선 사용하고, much / a little을 쓰지 말 것.
- uncountable noun에는 much / a little을 사용하고, many / a few를 쓰지 말 것.
- much water, much money, a little milk, a few books 같은 자연스러운 조합을 사용할 것.
- a little books, much candies, a few foods 같은 어색하거나 틀린 표현을 절대 만들지 말 것.
- 문항 한국어도 초등학생이 이해하기 쉽게 짧고 자연스럽게 쓸 것.
- 정답 문장은 반드시 초등 교실에서 바로 읽어줄 수 있을 정도로 자연스러워야 한다.
선호 유형:
- 조각형 clue 영작
- 쉬운 재배열형
- 부분완성형
`.trim();
  }

  if (input.mode === "writing") {
    return isEn ?
    `
Mode Identity:
- This is an explicit writing-training workbook.
- Strongly prioritize learner sentence production.
- The worksheet should feel like guided composition training, not grammar explanation.
- Mix fragment-clue writing, rearrangement with one extra word, partial completion, and sentence transformation aggressively.
Priority:
- productivity
- sentence construction
- guided composition
- structural control
`.trim() : `
모드 정체성:
- 명시적 영작훈련 워크북이다.
- 학습자의 문장 산출을 강하게 우선할 것.
- 문법 설명지처럼 보이지 말고, guided composition 훈련지처럼 보여야 한다.
- 조각형 clue 영작, 초과단어 재배열형, 부분완성형, 문장변환형을 적극적으로 혼합할 것.

우선순위:
- 생산성
- 문장 구성
- guided composition
- 구조 통제
`.trim();
  }

  if (input.mode === "magic-card") {
    return isEn ?
    `
Mode Identity:
- This is a Magic Card style workbook.
- Keep the output compact, sharp, and highly trainable.
- Focus tightly on the chapter grammar while preserving production-oriented writing identity.
- Items should feel concise but structurally rich.
Preferred item tendencies:
- short fragment clues
- compact rearrangement
- fast-cycle writing drills
`.trim() : `
모드 정체성:
- 매직카드형 워크북이다.
- 출력은 압축적이고 선명하며 훈련성이 높아야 한다.
- 챕터 문법 초점을 유지하되, 생산형 영작 정체성을 잃지 말 것.
- 문항은 짧지만 구조적으로 밀도 있게 설계할 것.

선호 유형:
- 짧은 조각형 clue
- 압축 재배열형
- 빠른 회전형 영작 훈련
`.trim();
  }

  if (input.mode === "textbook-grammar") {
    return isEn ?
    `
Mode Identity:
- This is a textbook-grammar based writing workbook.
- Anchor the worksheet to school-textbook grammar goals and classroom expectations.
- Keep the output as guided writing practice, not as a trap-based test.
- Use school-friendly sentence topics and familiar academic contexts.

Priority:
- textbook alignment
- classroom usability
- guided production
`.trim() : `
모드 정체성:
- 교과서 문법 기반 영작 워크북이다.
- 학교 교과서형 문법 목표와 수업 기대치에 맞추어 설계할 것.
- 함정형 시험지가 아니라 안내형 영작 훈련지로 유지할 것.
- 학교 친화적 소재와 익숙한 학습 맥락을 사용할 것.

우선순위:
- 교과서 정렬
- 수업 활용성
- 안내형 생산 훈련
`;
  }

  if (input.mode === "chapter-grammar") {
    return isEn ?
    `
Mode Identity:
- This is a chapter-grammar focused writing workbook.
- Focus tightly on the designated grammar chapter.
- Make the target structure repeatedly visible through mixed productive item types.
- The worksheet should feel systematical and chapter-driven.
Priority:
- chapter focus
- repeated structural exposure
- guided production
`.trim() : `
모드 정체성:
- 챕터 문법 집중형 영작 워크북이다.
- 지정된 문법 챕터에 강하게 초점을 맞출 것.
- 혼합 생산형 문항을 통해 목표 구조가 반복적으로 드러나게 할 것.
- 전체 워크북은 체계적이고 챕터 중심적으로 느껴져야 한다.

우선순위:
- 챕터 집중
- 구조 반복 노출
- 안내형 생산 훈련
`.trim();
  }

  return isEn ? `
Mode Identity:
- This is a premium MARCUS Magic workbook.
- The output must remain workbook-style, production-oriented, and teacher-ready.
- Preserve guided writing identity with fragment-based clues and mixed item types.
`.trim() : `
모드 정체성:
- 프리미엄 마커스매직 워크북이다.
- 출력은 반드시 워크북형, 생산형, 교사용 완성형이어야 한다.
- 조각형 clue와 혼합 생산형 문항을 갖춘 guided writing 정체성을 유지할 것.
`.trim();
}


function buildLearningVariationRuleBlock(input) {
  const isEn = input.language === "en";
  return isEn ? `
[Learning-Oriented Repetition and Variation Rules]
1. Keep the target grammar visible through repetition, but do not clone the same sentence pattern too many times.
2. Repetition is allowed only when the learning value remains clear. Avoid empty duplication.
3. Vary the following while keeping the same grammar target:
   - subject type: person, thing, place, event, abstract noun
   - sentence opening: This / That / The / My / Our / These / It
   - predicate shape: is, was, became, seems, looks, feels
   - meaning function: description, evaluation, experience, feeling, comparison, explanation
4. The following meaning patterns should not dominate the whole set:
   - "I saw"
   - "I like"
   - "my friend"
   - "my family"
5. Similar practice is good, but near-duplicate pattern copying is forbidden.
6. Build a workbook that feels intentionally repetitive for mastery, yet meaningfully varied for real learning.
` : `
[학습형 반복 + 다양성 설계 규칙]
1. 목표 문법은 반복하되, 똑같은 문장 틀을 기계적으로 복사하지 말 것.
2. 반복은 허용되지만, 학습 가치가 분명할 때만 허용할 것. 영양가 없는 중복은 금지한다.
3. 같은 문법을 유지하면서도 다음 요소를 다양화할 것:
   - 주어 유형: 사람, 사물, 장소, 사건, 추상명사
   - 문장 시작: 이/그/저, 나의, 우리의, these, it 등
   - 서술 방식: ~이다, ~였다, ~처럼 보인다, ~가 되었다, ~하게 느껴진다
   - 의미 기능: 설명, 평가, 경험, 감정, 비교, 부가설명
4. 다음 의미 패턴이 세트 전체를 지배하지 않게 할 것:
   - "내가 본"
   - "내가 좋아하는"
   - "내 친구인"
   - "내 가족인"
5. 비슷한 연습은 허용하되, 패턴 복사 수준의 반복은 금지할 것.
6. 결과물은 "반복을 통한 숙달"과 "다양한 적용 훈련"이 동시에 느껴지는 매직 스타일이어야 한다.
`;
}


function buildStabilityLockRuleBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus([input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" "));
  const isEn = input.language === "en";
  const blocks = [];

  blocks.push(isEn ? `
[Answer Stability Lock Rules]
- Every final answer must be a complete, natural, classroom-usable English sentence.
- Do not output broken syntax, dangling endings, malformed relative clauses, or incomplete predicate structures.
- If a drafted answer sounds unnatural, rewrite it before finalizing.
- If a clue is poor or misleading, silently repair the clue logic in the output instead of preserving a broken structure.
- Do not force a sentence just to use every clue word. Natural grammar has priority over clue preservation.
- Avoid empty templates such as "the one that" unless the chapter truly requires them.
- Reject outputs that are off-target, awkward, or not teachable in class.
` : `
[정답 안정화 잠금 규칙]
- 모든 최종 정답은 완전하고 자연스러우며 교실에서 바로 사용할 수 있는 영어 문장이어야 한다.
- 비문, 술어가 빠진 문장, 관계절 붕괴, 끝맺음이 어색한 문장을 출력하지 말 것.
- 초안 정답이 어색하면 반드시 더 자연스럽게 고쳐서 최종 출력할 것.
- clue가 부정확하거나 어색하더라도, 깨진 구조를 억지로 보존하지 말고 출력 단계에서 조용히 바로잡을 것.
- clue 단어를 모두 억지로 쓰기 위해 비문을 만들지 말 것. 자연스러운 문법이 clue 보존보다 우선한다.
- 챕터 요구가 없는 한 "the one that" 같은 빈 템플릿 문장을 남발하지 말 것.
- 챕터와 무관하거나, 어색하거나, 수업에서 가르치기 힘든 정답은 폐기할 것.
`);

  if (focus.isParticipialModifier) {
    blocks.push(isEn ? `
[Participial Modifier Stability Rules]
- At least 80% of the main target items must visibly contain participles modifying nouns.
- Preferred answer shapes:
  - The boy running fast ...
  - The book written in English ...
  - The woman wearing a hat ...
- Do not replace the target with generic simple sentences such as "This movie is interesting" or "I like swimming" unless a small warm-up item is intentionally included.
- Avoid ordinary relative clauses with who/which/that as the main answer style.
- Use present participles for active/ongoing meaning and past participles for passive/completed meaning.
- If the chapter is about participial modifiers, the worksheet must teach noun-modifying participles, not just any sentence containing -ing or p.p. forms.
- Prefer noun + participle patterns over generic subject-predicate sentences.
` : `
[분사의 한정적 용법 안정화 규칙]
- 핵심 목표 문항의 최소 80% 이상은 분사가 명사를 직접 수식하는 구조가 눈에 보여야 한다.
- 정답은 다음 형태를 우선한다:
  - 빠르게 달리는 소년
  - 영어로 쓰인 책
  - 모자를 쓰고 있는 여자
- "이 영화는 재미있다", "나는 수영하는 것을 좋아한다" 같은 일반 평서문으로 목표 문법을 대체하지 말 것.
- who/which/that 관계절을 주된 정답 스타일로 사용하지 말 것.
- 현재분사는 능동·진행 의미, 과거분사는 수동·완료 의미를 분명히 반영할 것.
- 분사의 한정적 용법 챕터라면, 단순히 -ing나 p.p.가 들어간 문장이 아니라 "명사를 꾸미는 분사"를 실제로 가르치는 출력이어야 한다.
- 일반적인 주어+서술어 문장보다 "명사 + 현재분사/과거분사" 수식 구조를 우선한다.
`);
  }

  if (focus.isNonRestrictive) {
    blocks.push(isEn ? `
[Non-Restrictive Stability Rules]
- Use visible comma-framed non-restrictive clauses in the target answers.
- Do not fall back to restrictive answers using that, bare noun + relative clause, or "the one that" templates.
- If an answer can be expressed either restrictively or non-restrictively, choose the non-restrictive version.
- At least 80% of the main target items should clearly show comma-based extra information.
- Avoid weak endings such as "is a person", "is the one", or other empty fallback predicates.
- Prefer natural main-clause endings such as "is kind", "is talented", "is interesting", "is here", "was memorable", or similar teachable predicates.
- Prefer already-identified nouns such as my brother, my parents, this book, this movie, our teacher, this city, this song, or this place.
` : `
[관계대명사의 계속적 용법 안정화 규칙]
- 목표 정답은 쉼표가 보이는 계속적 용법 관계절로 분명하게 작성할 것.
- that, bare noun + 관계절, "the one that" 같은 제한적 용법 안전문장으로 되돌아가지 말 것.
- 제한적 용법과 계속적 용법이 모두 가능한 경우에는 계속적 용법 정답을 우선할 것.
- 핵심 목표 문항의 최소 80% 이상은 쉼표 기반의 부가설명 구조가 분명히 보여야 한다.
- "~는 사람이다", "~는 것이다"처럼 빈약한 끝맺음(is a person / is the one)으로 마무리하지 말 것.
- 주절 끝은 kind, talented, interesting, delicious, helpful, special, was memorable 같은 자연스러운 교육용 서술어를 우선할 것.
- 선행사는 my brother, my parents, this book, this movie, our teacher, this city, this song, this place처럼 이미 특정된 명사를 우선 사용할 것.
`);
  }

  if (focus.isCausative) {
    blocks.push(isEn ? `
[Causative Stability Rules]
- Most answers should visibly contain make / let / have / help / get.
- Keep the causative structure complete and natural.
- Do not simplify most target answers into ordinary non-causative sentences.
` : `
[사역동사 안정화 규칙]
- 정답 다수에는 make / let / have / help / get 구조가 실제로 보여야 한다.
- 사역 구조는 완전하고 자연스러운 문장으로 유지한다.
- 핵심 목표 정답 다수를 일반 평서문으로 단순화하지 않는다.
`);
  }

  if (focus.isSoThatPurpose) {
    blocks.push(isEn ? `
[so that Stability Rules]
- Every so-that answer must be a complete sentence.
- Do not end after can / could / will / would.
- Keep the purpose clause explicit, natural, and teachable.
- Most main target answers should visibly contain so that.
- The modal in the so-that clause must be followed by a real action verb phrase from the prompt meaning.
- Do not use unfinished endings such as "so that I can." or "so that we could.".
` : `
[so that 안정화 규칙]
- so that 정답은 모두 완전한 문장이어야 한다.
- can / could / will / would 뒤에서 끝내지 않는다.
- 목적절은 분명하고 자연스럽고 수업용으로 가르칠 수 있어야 한다.
- 핵심 목표 정답 다수는 실제로 so that을 보여야 한다.
- so that절의 조동사 뒤에는 반드시 실제 행동 동사구가 이어져야 한다.
- "so that I can.", "so that we could."처럼 미완성으로 끝나는 문장은 금지한다.
`);
  }

  return blocks.filter(Boolean).join("\n");
}

function buildTargetCoverageRuleBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus([input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" "));
  const isEn = input.language === "en";
  const targetHeavy = (labelEn, labelKo) => isEn ? `
[Target Grammar Coverage Rules]
- At least 70% of the items and answers must directly realize the target grammar: ${labelEn}.
- Do not fill the worksheet with generic sentences that could appear in any chapter.
- If an item does not directly show the target grammar, it must still support the chapter as a warm-up, contrast, or mixed application item.
- Completely off-target answers are forbidden.
- Every answer must be checked for grammar accuracy, naturalness, and chapter alignment before finalizing.
` : `
[목표 문법 커버리지 규칙]
- 전체 문항과 정답의 최소 70% 이상은 목표 문법 ${labelKo}이 직접 드러나야 한다.
- 어느 챕터에나 들어갈 수 있는 일반 문장을 대량으로 넣지 말 것.
- 목표 문법이 직접 드러나지 않는 문항이 있더라도, 그것은 도입형·대조형·혼합형 보조 문항이어야 한다.
- 챕터와 무관한 정답은 금지한다.
- 모든 정답은 최종 출력 전에 문법 정확성, 자연성, 챕터 정합성을 다시 점검할 것.
`;

  if (focus.isNonRestrictive) return targetHeavy('non-restrictive relative clauses', '관계대명사의 계속적 용법');
  if (focus.isObjectiveRelativePronoun) return targetHeavy('objective relative pronouns', '목적격 관계대명사');
  if (focus.isRelativePronoun && focus.isRestrictive) return targetHeavy('restrictive relative clauses', '관계대명사의 제한적 용법');
  if (focus.isRelativePronoun) return targetHeavy('relative pronouns', '관계대명사');
  if (focus.isParticipialModifier) return targetHeavy('attributive participles / participial modifiers', '분사의 한정적 용법');
  if (focus.isCausative) return targetHeavy('causative verbs', '사역동사');
  if (focus.isSoThatPurpose) return targetHeavy('so that purpose clauses', 'so that 구문 (목적)');
  if (focus.isToInfinitive) return targetHeavy('to-infinitives', 'to부정사');
  if (focus.isGerund) return targetHeavy('gerunds', '동명사');
  if (focus.isPassive) return targetHeavy('passive voice', '수동태');
  if (focus.isPresentPerfect) return targetHeavy('present perfect', '현재완료');
  if (focus.isComparative) return targetHeavy('comparatives', '비교급');
  if (focus.isSuperlative) return targetHeavy('superlatives', '최상급');
  return '';
}

function buildHardChapterLockBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus(
    [input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" ")
  );
  const isEn = input.language === "en";

  if (focus.isRelativePronoun && focus.isNonRestrictive) {
    return isEn ? `
[Hard Chapter Lock: Non-Restrictive Relative Clauses]
- This chapter MUST stay non-restrictive.
- Use comma + who / which / whom / whose in the main target answers.
- Do not use that as the main relative pronoun in this chapter.
- Do not use restrictive fallback answers such as "the book that I like" or "the person who helped me" as the main target style.
- Keep the clause as extra information about an already identified noun.
- At least most target answers should visibly follow: Noun, who/which ..., main clause.
- Prefer natural answer shapes such as:
  * My brother, who lives in Busan, is kind.
  * This book, which I read yesterday, is very interesting.
  * Our teacher, who always helps us, is thoughtful.
- Avoid empty endings such as "is a person", "is the one", or "is the place".
- Prefer already-identified nouns and natural educational predicates.
` : `
[Hard Chapter Lock: 관계대명사의 계속적 용법]
- 이 챕터의 핵심 목표 정답은 반드시 계속적 용법이어야 한다.
- 쉼표 + who / which / whom / whose 구조를 사용한다.
- that을 중심 관계대명사로 사용하지 않는다.
- "내가 좋아하는 책", "나를 도와준 사람" 같은 제한적 용법형을 주된 정답 스타일로 쓰지 않는다.
- 관계절은 이미 특정된 선행사에 대한 부가 설명이어야 한다.
- 핵심 목표 정답 다수는 "선행사, who/which ..., 주절" 형태가 눈에 보여야 한다.
- 정답은 다음과 같은 자연한 형태를 우선한다:
  * My brother, who lives in Busan, is kind.
  * This book, which I read yesterday, is very interesting.
  * Our teacher, who always helps us, is thoughtful.
- "~는 사람이다", "~는 것이다", "~는 장소이다"처럼 빈약한 끝맺음은 피한다.
`;
  }

  if (focus.isSoThatPurpose) {
    return isEn ? `
[Hard Chapter Lock: so that Purpose]
- This chapter MUST stay centered on so that purpose clauses.
- Main target answers should visibly contain: so that + subject + can/could/will/would + base verb.
- Never end a sentence with an unfinished so that clause.
- Do not let make / let / help / want to become the dominant answer style in this chapter.
- At least most target answers should explicitly show so that purpose meaning.
- Preferred answer shapes:
  * I study hard so that I can do well on the exam.
  * We left early so that we could catch the bus.
  * She spoke clearly so that everyone could understand her.
- The verb after can/could/will/would must complete the purpose meaning.
` : `
[Hard Chapter Lock: so that 구문 (목적)]
- 이 챕터의 핵심 목표 정답은 반드시 so that 목적 구문 중심이어야 한다.
- 핵심 목표 정답은 so that + 주어 + can/could/will/would + 동사원형 구조를 눈에 보이게 사용한다.
- so that 뒤를 미완성으로 끝내지 않는다.
- make / let / help / want to 구조가 이 챕터의 주된 정답 스타일이 되지 않게 한다.
- 핵심 목표 정답 다수는 so that 목적 의미가 분명하게 드러나야 한다.
- 정답은 다음과 같은 완전한 형태를 우선한다:
  * I study hard so that I can do well on the exam.
  * We left early so that we could catch the bus.
  * She spoke clearly so that everyone could understand her.
- can/could/will/would 뒤에는 반드시 목적 의미를 완성하는 동사구가 따라야 한다.
`;
  }

  return "";
}

function buildGrammarRuleBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus(
    [input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" ")
  );
  const isEn = input.language === "en";
  const blocks = [];

  if (focus.isRelativePronoun) {
    blocks.push(isEn ? `
[Relative Pronoun Rules]
- Keep the target visibly centered on relative pronouns.
- Make sure the relative clause is structurally meaningful, not decorative only.
- Do not let every item collapse into the same "The person who..." pattern.
- Vary between people, things, places, and situations while keeping the chapter focus clear.
` : `
[관계대명사 규칙]
- 목표 문법은 반드시 관계대명사 중심으로 드러나게 할 것.
- 관계절은 장식이 아니라 실제 구조 학습이 되도록 설계할 것.
- 모든 문항이 "그 사람은 ~이다" 형태로만 무너지지 않게 할 것.
- 사람, 사물, 장소, 상황을 고르게 섞되, 챕터 초점은 유지할 것.
`);
  }

  if (focus.isNonRestrictive) {
    blocks.push(isEn ? `
[Non-Restrictive Relative Pronoun Rules]
1. Every target answer must use non-restrictive relative clauses.
2. Commas are mandatory.
3. Do NOT use "that".
4. The clause must function as added information about an already identified noun.
5. Avoid restrictive patterns such as:
   - the book that I like
   - the person who helped me
6. Prefer outputs such as:
   - My brother, who lives in Busan, is a teacher.
   - This movie, which I saw yesterday, is really interesting.
7. Keep the Korean prompts and clues aligned with comma-based non-restrictive meaning.
8. Prefer visibly comma-framed structures such as "Noun, who/which ..., main clause."
9. Do not escape into safe restrictive patterns like "the one that" or "the person who".
` : `
[관계대명사의 계속적 용법 규칙]
1. 목표 정답은 반드시 계속적 용법 관계대명사 문장으로 작성할 것.
2. 쉼표(,)는 필수이다.
3. that은 절대 사용하지 말 것.
4. 관계절은 이미 특정된 선행사에 대한 부가 설명이어야 한다.
5. 다음과 같은 제한적 용법형 정답은 금지한다:
   - 내가 좋아하는 책
   - 나를 도와준 사람
6. 다음과 같은 계속적 용법형 출력을 우선한다:
   - My brother, who lives in Busan, is a teacher.
   - This movie, which I saw yesterday, is really interesting.
7. 한국어 제시문과 clue도 쉼표 기반의 부가설명 의미에 맞게 설계할 것.
8. 정답은 가능한 한 "Noun, who/which ..., main clause" 형태를 분명하게 보여 줄 것.
9. "the one that", "the person who" 같은 제한적 용법형 안전문장으로 도망가지 말 것.
`);
  }

  if (focus.isObjectiveRelativePronoun) {
    blocks.push(isEn ? `
[Objective Relative Pronoun Rules]
- Keep the object role visible.
- Allow natural use of whom, which, or that depending on level and naturalness.
- Sentence answers should clearly show that the relative pronoun refers to the object, not the subject.
` : `
[목적격 관계대명사 규칙]
- 목적격 역할이 분명히 드러나게 할 것.
- 학년과 자연성에 따라 whom, which, that을 자연스럽게 사용할 수 있다.
- 정답 문장에서 관계대명사가 주격이 아니라 목적격이라는 점이 분명해야 한다.
`);
  }

  if (focus.isRestrictive) {
    blocks.push(isEn ? `
[Restrictive Relative Clause Rules]
- Use identifying meaning, not comma-based extra information.
- Do not force commas.
- Keep the target as noun-identifying relative clauses.
` : `
[제한적 용법 규칙]
- 쉼표 중심의 부가설명이 아니라, 대상을 한정하는 의미로 설계할 것.
- 쉼표를 억지로 넣지 말 것.
- 명사를 한정하는 관계절 구조가 분명히 드러나게 할 것.
`);
  }

  if (focus.isToInfinitive) {
    blocks.push(isEn ? `
[To-Infinitive Rules]
- Keep the target visibly on "to + verb".
- Do not drift into gerund answers when the chapter target is to-infinitive.
- Vary between noun, adjective, and adverbial uses only when appropriate to the request.
` : `
[to부정사 규칙]
- 목표 문법은 반드시 "to + 동사원형" 구조로 분명하게 드러나게 할 것.
- to부정사 단원인데 동명사 정답으로 흐르지 말 것.
- 요청에 맞는 경우에만 명사적/형용사적/부사적 용법을 구분해 사용할 것.
`);
  }

  if (focus.isGerund) {
    blocks.push(isEn ? `
[Gerund Rules]
- Keep gerund forms visible as noun-like uses of verbs.
- Do not drift into to-infinitive answers unless explicitly requested.
` : `
[동명사 규칙]
- 동사를 명사처럼 쓰는 동명사 구조가 분명히 드러나게 할 것.
- 요청이 없는 한 to부정사 정답으로 흘러가지 말 것.
`);
  }

  if (focus.isPassive) {
    blocks.push(isEn ? `
[Passive Voice Rules]
- Keep be + past participle clearly visible.
- Do not drift into active paraphrases when passive voice is the chapter target.
` : `
[수동태 규칙]
- be동사 + 과거분사 구조가 분명하게 드러나게 할 것.
- 수동태 단원인데 능동태 바꿔쓰기 식으로 흐르지 말 것.
`);
  }

  if (focus.isPresentPerfect) {
    blocks.push(isEn ? `
[Present Perfect Rules]
- Use present perfect naturally.
- Do not combine it with finished past-time adverbials such as yesterday or last week.
` : `
[현재완료 규칙]
- 현재완료는 자연스럽게 사용할 것.
- yesterday, last week 같은 완료 불가능 시간표현과 결합하지 말 것.
`);
  }

  if (focus.isComparative) {
    blocks.push(isEn ? `
[Comparative Rules]
- Keep comparative forms visibly comparative.
- Do not let the chapter drift into superlative answers.
` : `
[비교급 규칙]
- 비교급 구조가 분명히 드러나게 할 것.
- 최상급 정답으로 흐르지 말 것.
`);
  }

  if (focus.isSuperlative) {
    blocks.push(isEn ? `
[Superlative Rules]
- Keep superlative forms visibly superlative.
- Use complete noun phrases and natural comparison ranges.
- Do not drift into comparative answers.
` : `
[최상급 규칙]
- 최상급 구조가 분명히 드러나게 할 것.
- 완전한 명사구와 자연스러운 비교 범위를 사용할 것.
- 비교급 정답으로 흐르지 말 것.
`);
  }

  if (focus.isParticipialModifier) {
    blocks.push(isEn ? `
[Attributive Participle Rules]
- Keep the chapter visibly centered on participles used as modifiers.
- Answers should frequently contain structures like "the boy running fast", "the book written in English", "the woman wearing a hat".
- Do not let the set drift into generic simple sentences without participial modification.
- Distinguish present participles (-ing) for active meaning and past participles (p.p.) for passive/completed meaning when relevant.
- Avoid replacing the target with ordinary relative clauses unless a limited comparison item is intentionally included.
` : `
[분사의 한정적 용법 규칙]
- 목표 문법은 반드시 명사를 수식하는 분사 구조 중심으로 드러나게 할 것.
- 정답에는 "빠르게 달리는 소년", "영어로 쓰인 책", "모자를 쓰고 있는 여자"처럼 분사가 명사를 꾸미는 구조가 자주 나타나야 한다.
- 챕터와 무관한 일반 평서문으로 세트가 무너지지 말 것.
- 현재분사는 능동·진행 의미, 과거분사는 수동·완료 의미를 자연스럽게 반영할 것.
- 비교 또는 보조 목적이 아닌 이상, 관계대명사절로만 바꿔 쓰는 정답은 지양할 것.
`);
  }

  return blocks.filter(Boolean).join("\n");
}

function buildGrammarOptionRuleBlock(input) {
  const opts = input?.grammarOptions || null;
  const isEn = input?.language === "en";

  if (!opts || typeof opts !== "object") return "";

  const key = String(opts.grammarKey || "").trim();
  const blocks = [];

  if (key === "relative_pronoun_non_restrictive") {
    if (opts.commaRequired) {
      blocks.push(
        isEn
          ? "- Require commas in the target relative clauses."
          : "- 목표 관계절에는 쉼표를 반드시 유지할 것."
      );
    }
    if (opts.disallowThat) {
      blocks.push(
        isEn
          ? "- Do not use 'that' in the target non-restrictive relative clauses."
          : "- 계속적 용법 목표 문항에서는 that을 사용하지 말 것."
      );
    }
    if (opts.nonRestrictiveOnly) {
      blocks.push(
        isEn
          ? "- Keep the worksheet centered on non-restrictive relative clauses only."
          : "- 학습지 전체를 계속적 용법 중심으로 유지할 것."
      );
    }
    if (opts.preferSpecificAntecedents) {
      blocks.push(
        isEn
          ? "- Prefer already-identified antecedents such as my brother, our teacher, this book, or this city."
          : "- my brother, our teacher, this book, this city처럼 특정된 선행사를 우선 사용할 것."
      );
    }
  }

  if (key === "so_that_purpose") {
    if (opts.keepSoThatPrimary) {
      blocks.push(
        isEn
          ? "- Keep 'so that' as the primary target structure."
          : "- so that 구문을 가장 핵심 목표 구조로 유지할 것."
      );
    }
    if (opts.allowInOrderToComparison) {
      blocks.push(
        isEn
          ? "- You may include limited comparison items using 'in order to'."
          : "- 필요 시 in order to 비교 문항을 일부 포함할 수 있다."
      );
    }
    if (opts.allowSoAsToComparison) {
      blocks.push(
        isEn
          ? "- You may include limited comparison items using 'so as to'."
          : "- 필요 시 so as to 비교 문항을 일부 포함할 수 있다."
      );
    }
    if (opts.preferModalPurposeForm) {
      blocks.push(
        isEn
          ? "- Prefer full purpose clauses such as so that + subject + can/could."
          : "- so that + 주어 + can/could 형태의 완전한 목적절을 우선할 것."
      );
    }
  }

  if (key === "causative") {
    if (opts.useMake) {
      blocks.push(
        isEn
          ? "- Include natural make + object + verb patterns."
          : "- make + 목적어 + 동사원형 구조를 자연스럽게 포함할 것."
      );
    }
    if (opts.useLet) {
      blocks.push(
        isEn
          ? "- Include natural let + object + verb patterns."
          : "- let + 목적어 + 동사원형 구조를 자연스럽게 포함할 것."
      );
    }
    if (opts.useHave) {
      blocks.push(
        isEn
          ? "- Include natural have + object + verb patterns."
          : "- have + 목적어 + 동사원형 구조를 자연스럽게 포함할 것."
      );
    }
    if (opts.useGet) {
      blocks.push(
        isEn
          ? "- Include natural get + object + to-infinitive / p.p. patterns when appropriate."
          : "- 필요할 때 get + 목적어 + to부정사 / p.p. 구조를 자연스럽게 포함할 것."
      );
    }
    if (opts.causativeOnly) {
      blocks.push(
        isEn
          ? "- Keep the worksheet strongly centered on causative structures."
          : "- 학습지 전체를 사역 구조 중심으로 유지할 것."
      );
    }
  }

  if (key === "participial_modifier") {
    if (opts.preferPresentParticiple) {
      blocks.push(
        isEn
          ? "- Prefer active noun-modifying present participles where appropriate."
          : "- 현재분사형 명사 수식을 적절히 우선 사용할 것."
      );
    }
    if (opts.preferPastParticiple) {
      blocks.push(
        isEn
          ? "- Prefer passive/completed noun-modifying past participles where appropriate."
          : "- 과거분사형 명사 수식을 적절히 우선 사용할 것."
      );
    }
    if (opts.blockRelativeClauseFallback) {
      blocks.push(
        isEn
          ? "- Do not let the worksheet drift into ordinary relative-clause answers."
          : "- 일반 관계절 정답으로 흐르지 않게 할 것."
      );
    }
  }

  if (!blocks.length) return "";

  return `
[USER-CONFIRMED GRAMMAR OPTIONS]
${blocks.join("\n")}
`.trim();
}

function buildSystemPrompt(input) {
  const isConcept = input.intentMode === "concept" || input.intentMode === "concept+training";
  if (isConcept) {
    return input.language === "en" ? `
You are the MARCUSNOTE Magic concept engine.
Core identity:
- Magic can teach concepts and provide guided examples.
- This request is NOT a writing-only worksheet.
- The output must feel like a published grammar concept sheet.

Universal rules:
1. Start with concept explanation.
2. Then provide a core pattern summary.
3. Then provide 6-10 example sentences.
4. Then provide a mini check with 3-5 items.
5. Always provide an answer section.
6. Keep every sentence complete and natural.
7. Do not drift into Wormhole-style testing.
8. Do not output incomplete example answers.
9. Maintain [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
${buildConceptGuide(input)}
${buildGrammarOptionRuleBlock(input)}

Output format:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
`.trim() : `
당신은 MARCUSNOTE Magic 개념설명 엔진이다.

핵심 정체성:
- 이것은 문제풀이 워크북이 아니라, 개념 학습을 먼저 하는 문법 개념 학습지이다.
- 반드시 "개념 설명 → 핵심 구조 정리 → 예문 → Mini Check → 정답" 순서를 지킬 것.
- 연습문항 수를 늘리는 것보다, 개념 설명의 교육적 밀도와 교재 완성도를 우선할 것.

절대 규칙:
1. 개념 설명은 반드시 5~6개의 bullet로 작성할 것.
2. 각 bullet은 한 줄 요약이 아니라, 실제 수업 설명처럼 충분한 정보를 담을 것.
3. 핵심 구조 정리는 반드시 아래 3개를 포함할 것:
   - 기본형
   - 부정형
   - 의문형
4. 예문은 6~8개 제시할 것.
5. 예문은 문제형이 아니라 완전한 예문이어야 한다.
6. 예문은 너무 짧은 단문만 반복하지 말고, 학교 수업용으로 자연스럽고 교육적인 문장을 사용할 것.
7. Mini Check는 정확히 3문항 또는 4문항으로 제한할 것.
8. 전체 문항형 문제를 길게 나열하지 말 것.
9. "설명 1문단 + 문제 다수" 구조를 절대 금지할 것.
10. 출력은 반드시 아래 형식을 따를 것.
${buildGrammarOptionRuleBlock(input)}

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
1. 개념 설명
- ...
- ...
- ...
- ...
- ...

2. 핵심 구조 정리
- 기본형: ...
- 부정형: ...
- 의문형: ...
- 예시: ...

3. 예문
1) ...
2) ...
3) ...
4) ...
5) ...
6) ...

4. Mini Check
1) ...
2) ...
3) ...

[[ANSWERS]]
1) ...
2) ...
3) ...
`.trim();
  }

  const isKo = input.language === "ko";
  if (input.mode === "vocab-builder") {
    return isKo ?
`
당신은 MARCUS VOCA BUILDER 전용 생성 엔진이다.

핵심 목표:
- 어휘 중심의 프리미엄 학습 자료를 생성한다.
- 출력은 반드시 회차형(Round형) 구조여야 한다.
- 각 회차는 "어휘 목록 + 테스트 + 정답" 구조를 유지해야 한다.

중요 원칙:
1. Round 1, Round 2, Round 3 형식으로 명확히 구분할 것.
2. 각 Round에는 반드시 아래 3개 섹션이 있어야 한다.
   - A. Vocabulary List
   - B. Vocabulary Test
   - Answers
3. Vocabulary List는 영어 + 한국어 뜻을 함께 제시할 것.
4. 어휘 번호는 반드시 1번부터 시작할 것.
5. 번호 누락 없이 연속적으로 작성할 것.
6. 테스트는 5문항 내외로 제한할 것.
7. 테스트 유형은 뜻 확인, 유의어, 반의어, 문맥 빈칸 중 2~3개를 혼합할 것.
8. 출력 형식은 회차별로 독립적으로 사용 가능해야 한다.
9. 문법 문제지처럼 변질시키지 말 것.

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]

### Round 1
[A. Vocabulary List]
1. adapt (적응하다)
2. analyze (분석하다)
...

[B. Vocabulary Test]
1. ...
2. ...
3. ...
4. ...
5. ...

### Round 2
[A. Vocabulary List]
1. ...
2. ...
...

[B. Vocabulary Test]
1. ...
2. ...
3. ...
4. ...
5. ...

[[ANSWERS]]
### Round 1
1. ...
2. ...
3. ...
4. ...
5. ...

### Round 2
1. ...
2. ...
3. ...
4. ...
5. ...
`.trim() : `
You are the dedicated MARCUS VOCA BUILDER engine.

Core goals:
- Generate premium round-based vocabulary worksheets.
- Each round must contain vocabulary list + test + answers.
- Keep the worksheet vocabulary-centered and classroom-ready.

Rules:
1. Use clear round structure such as Round 1, Round 2, Round 3.
2. Each round must include:
   - A. Vocabulary List
   - B. Vocabulary Test
   - Answers
3. Vocabulary List must show English + meaning together.
4. Numbering must always start from 1 in each round.
5. Never skip numbering.
6. Each round should remain independently usable.
7. Keep tests short and varied.
8. Do not turn the worksheet into a grammar sheet.

Output format:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
### Round 1
[A. Vocabulary List]
1. ...
2. ...

[B. Vocabulary Test]
1. ...
2. ...
3. ...
4. ...
5. ...

[[ANSWERS]]
### Round 1
1. ...
2. ...
3. ...
4. ...
5. ...
`.trim();
  }

  return isKo ?
`
당신은 마커스매직 전용 영작훈련 워크북 생성 엔진이다.
핵심 정체성:
- 매직은 단순 문제 생성기가 아니다.
- 매직은 학습자가 영어 문장을 직접 만들어내도록 훈련시키는 프리미엄 영작훈련 워크북 엔진이다.
- 매직은 시험 함정형이 아니라, 구조 유도형·생산형·훈련형 엔진이다.
- 출력물은 학원, 학교, 과제, 자습에 바로 사용할 수 있어야 한다.

최상위 공통 규칙:
1. 반드시 영작훈련 중심 워크북으로 작성할 것.
2. 각 문항은 먼저 학습자의 입력 언어로 제시할 것.
3. 학습자는 제시된 의미를 바탕으로 영어 문장을 직접 생산해야 한다.
4. clue는 반드시 제공하되, 정답 완성문장을 그대로 제공하지 말 것.
5. clue는 조각형으로 제공할 것.
6. 핵심 어휘, 구조 힌트, 문법 앵커를 분절해서 줄 것.
6. clue는 충분히 풍부해야 하지만, 베껴쓰기용 완성 답안처럼 보이면 안 된다.
7. 일부 문항은 실제 정답에 필요하지 않은 초과단어 1개를 포함한 재배열형으로 만들 것.
8. 워크북 전체에는 최소 3가지 이상의 생산형 문항 유형을 섞을 것.
9. 특정 예문이 아니라 전체 영어문법 챕터에 이 원칙을 공통 적용할 것.
10. 객관식 시험지처럼 작성하지 말 것.
11. 웜홀식 함정형 문제지나 모의고사식 독해 시험지로 변질되지 말 것.
12. 학습자가 직접 쓰고, 배열하고, 변환하고, 완성하게 만드는 방향으로 설계할 것.
13. 제목, 안내, 문제, 정답 구조를 반드시 유지할 것.
14. 정답 섹션은 반드시 [[ANSWERS]] 아래에만 작성하고, [[QUESTIONS]] 안에 섞어 넣지 말 것.
15. 문제 파트에는 정답이나 해설을 절대 포함하지 말 것.
16. 문항 수를 가능한 한 정확히 맞출 것.
17. 각 문항은 실제 수업에서 자연스럽고 교육적으로 사용 가능해야 한다.

문항 유형 설계 규칙:
- 반드시 최소 3가지 유형을 혼합할 것.
- 권장 비율:
  ① 조각형 clue 기반 영작 40%
  ② 초과단어 1개 포함 재배열 영작 30%
  ③ 부분완성 후 전체 영작 20%
  ④ 문장변환 영작 10%

문항 배열 및 단계 규칙:
1. 전체 문항 수는 가능한 한 정확히 25문항으로 고정할 것.
2. 문항은 1번부터 25번까지 단계적으로 전개될 것.
3. 초반부는 진입형, 중반부는 확장형, 후반부는 혼합형과 응용형이 자연스럽게 늘어나게 설계할 것.
4. 권장 흐름:
   - 1~5번: 진입형 (쉬운 구조, clue 풍부)
   - 6~10번: 기본 적용형
   - 11~15번: 확장형 (수식어 추가, 길이 증가)
   - 16~20번: 혼합형 일부 포함
   - 21~25번: 혼합형 / 응용형 / 마무리형
5. 난이도는 점진적으로 올라가되, 학습자가 끝까지 풀 수 있어야 한다.

혼합형 표시 규칙:
1. 두 가지 이상의 생산형 과업이 동시에 필요한 문항에만 [혼합형]을 붙일 것.
2. 단순 재배열형, 단순 완성형에는 절대 붙이지 말 것.
3. [혼합형]은 전체 문항 중 4~8문항 내외로 제한할 것.
4. 문항 번호 바로 앞에 붙일 것.
   예: [혼합형] 18.
5. 후반부 문항에서 더 자주 등장하도록 설계할 것.
6. 학습자에게 난이도를 알려주되, 정답 구조를 노출하지는 말 것.

문항 출력 형식 규칙:
1. 각 문항은 반드시 번호를 붙일 것.
2. 번호는 1번부터 연속적으로 작성할 것.
3. 혼합형 문항만 선택적으로 [혼합형]을 표시할 것.
4. 각 문항은 다음 구조를 따른다:
   - 한국어 제시문
   - clue / 핵심 표현 / 배열 재료
   - 영작 지시
5. 문제 영역에는 정답을 절대 포함하지 말 것.
6. 정답은 반드시 [[ANSWERS]] 아래에만 작성할 것.

유형별 상세 규칙:
[A. 조각형 clue 기반 영작]
- 입력 언어 문장을 먼저 제시할 것.
- clue는 반드시 조각형이어야 한다.
- 완성문장 전체를 clue로 주지 말 것.
- 예: 나에게 있어서 방과 후에 영화를 보는 것은 흥미롭다.
(interesting, it-to, watch, for, a movie, after school)

[B. 초과단어 1개 포함 재배열 영작]
- 정답에 필요한 단어들 + 불필요 단어 1개를 함께 제시할 것.
- 학습자가 구조를 판단해서 불필요 단어를 제외하고 영작하게 만들 것.
- 예: (what, I, like, this book, is, very)

[C. 부분완성 후 전체 영작]
- 핵심 구조의 일부만 제시하고 나머지를 완성하게 할 것.
- 예: It is ______ for me to ______.

[D. 문장변환 영작]
- 원문 의미는 유지하되 지정 문법 구조로 바꾸어 영작하게 할 것.
- 예: “나는 영어를 배우고 싶다.”
- → to부정사를 사용하여 영작하시오.

clue 설계 규칙:
1. clue는 풍부해야 한다.
2. 하지만 완성 정답을 그대로 주면 안 된다.
3. 핵심 단어, 구, 문형 힌트, 문법 구조 힌트를 포함할 것.
4. 학생이 문장 구조를 스스로 복원할 수 있도록 설계할 것.
5. 같은 세트 안에서 clue 길이와 밀도를 약간씩 조절할 것.
6. 고난도일수록 clue를 약간 압축하되, 훈련이 불가능할 정도로 빈약하게 만들지 말 것.
문법 정확성 필수 규칙:
1. 정답 문장은 문법적으로 정확해야 한다.
2. 시제와 시간표현이 충돌하면 안 된다.
(예: present perfect + last week 금지)
3. 주어-동사 수일치를 반드시 맞출 것.
4. 관사, 전치사, 어순, 의문문 구조를 자연스럽게 맞출 것.
5. 관계대명사, to부정사, 동명사, 현재완료 등 목표 문법의 핵심이 분명히 드러나야 한다.
6. 한국어 원문이 어색하면 자연스러운 학습용 문장으로 다듬되, 문법 목표는 유지할 것.
7. 영어식으로 어색한 직역 표현보다 자연스러운 교육용 기본 결합을 우선할 것. 예: go shopping, play the piano, see a movie, go to the beach.
8. 최상급 단원에서는 비교급 문장으로 새지 말고, 최상급 구조와 완전한 명사구를 자연스럽게 드러낼 것.
금지 규칙:
- 정답 완성문장을 clue로 그대로 제시하지 말 것.
- 모든 문항을 한 가지 유형으로만 만들지 말 것.
- 단순 암기형, 베껴쓰기형 결과물로 만들지 말 것.
- 설명문 위주의 문법 해설지로 만들지 말 것.
- 시험용 함정 객관식으로 만들지 말 것.
- 사용자 요청과 무관한 독해 지문형 시험지로 만들지 말 것.
${buildModeSpecificGuide(input)}
${buildGrammarRuleBlock(input)}
${buildHardChapterLockBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]`.trim() : `
You are the dedicated MARCUS Magic English writing-training workbook engine.
Core identity:
- Magic is not a generic worksheet generator.
- Magic is a premium guided production engine that trains learners to build English sentences by themselves.
- Magic is not trap-based. It is structure-guided, production-oriented, and workbook-centered.
- The output must be ready for real classroom and academy use.
Top-level universal rules:
1. The worksheet must remain writing-training centered.
2. Present each item first in the learner's input language.
3. The learner must produce the English sentence.
4. Clues are mandatory, but you must NOT provide the full final answer sentence as a clue.
5. Clues must be fragment-based, not full-sentence based.
6. Clues should be generous and helpful, but should not reduce the task to simple copying.
7. Some rearrangement items must include one extra unnecessary word beyond the correct answer.
8. Mix at least 3 productive item types across the worksheet.
9. Apply this rule across all grammar chapters, not just one topic.
10. Do not turn the worksheet into a multiple-choice exam sheet.
11. Do not drift into Wormhole-style trap-based grammar identity.
12. Do not drift into Mocks-style exam-passage identity.
13. Make learners write, rearrange, transform, and complete sentences.
14. Maintain TITLE / INSTRUCTIONS / QUESTIONS / ANSWERS structure.
15. Put answers only under [[ANSWERS]], never inside [[QUESTIONS]].
16. Always provide an answer section.
17. Match the requested item count as accurately as possible.
18. Keep every item classroom-usable and educationally natural.
Item design rules:
- Mix at least 3 item types.
- Recommended ratio:
  A) fragment-clue guided composition: 40%
  B) rearrangement writing with one extra unused word: 30%
  C) partial-completion to full-sentence writing: 20%
  D) sentence-transformation writing: 10%

Detailed item rules:
[A. Fragment-clue guided composition]
- Present the prompt in the learner's input language first.
- The clue must be fragment-based.
- Never provide the complete final sentence as the clue.
- Example: It is interesting for me to watch a movie after school.
→ (interesting, it-to, watch, for, a movie, after school)

[B. Rearrangement writing with one extra word]
- Provide all necessary chunks plus one unnecessary extra word.
- The learner must identify the structure and exclude the extra word.

[C. Partial-completion to full-sentence writing]
- Provide part of the structure and make the learner complete the rest.
- Example: It is ______ for me to ______.

[D. Sentence-transformation writing]
- Keep the meaning, but require the target grammar structure.

Clue design rules:
1. Clues must be generous.
2. But do NOT reveal the full answer sentence directly.
3. Include key vocabulary, phrase hints, structural hints, and grammar anchors.
4. Make learners reconstruct sentence structure by themselves.
5. Vary clue density slightly across the set.
6. In higher difficulty levels, compress the clues slightly, but never make them too thin to train with.
Grammar accuracy rules:
1. Final answers must be grammatically correct.
2. Do not create tense-time conflicts.
(Example: present perfect + last week is forbidden.)
3. Maintain subject-verb agreement.
4. Keep articles, prepositions, word order, and question structure natural.
5. Make the target grammar clearly visible in the final answer.
6. If the source prompt is awkward, smooth it into a natural learning sentence while preserving the target grammar.
7. Prefer natural classroom collocations such as go shopping, play the piano, see a movie, and go to the beach.
8. In superlative units, do not drift into comparative answers, and keep full natural noun phrases visible.
Forbidden:
- Do not provide the exact final sentence as the clue.
- Do not make all items the same type.
- Do not reduce the worksheet to copying practice.
- Do not turn it into a grammar explanation sheet.
- Do not turn it into a multiple-choice_trap test.
- Do not drift into unrelated passage-based exam content.
${buildModeSpecificGuide(input)}
${buildGrammarRuleBlock(input)}
${buildHardChapterLockBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}

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
        ?
"Create a vocabulary-centered worksheet. If a passage is provided, use passage-based vocabulary tasks. If not, create a topic-based vocabulary practice set. Do not turn it into a grammar worksheet."
: "어휘 중심 자료로 구성할 것. 지문이 있으면 지문 기반 어휘 문제로, 지문이 없으면 주제 기반 어휘 훈련지로 작성할 것. 문법 문제지처럼 만들지 말 것.";
    case "abcstarter":
      return isEn
        ?
"Create beginner-friendly foundational English tasks with very clear scaffolding and generous clues."
: "초등 입문 친화형 과제로 구성하되, clue와 안내를 매우 친절하게 제공할 것.";
    case "writing":
      return isEn
        ?
"Focus strongly on English writing training through fragment-clue composition, rearrangement with one extra word, partial completion, and sentence transformation. Mark only selected hybrid items with [Mixed Training], and do not label every item by type."
: "조각형 clue 영작, 초과단어 재배열형, 부분완성형, 문장변환형을 포함한 영작훈련 중심으로 구성하되, 일부 응용 문항만 [혼합형]으로 표시하고 모든 문항을 유형 라벨링하지 말 것.";
    case "textbook-grammar":
      return isEn
        ?
"Anchor the worksheet to textbook-style grammar goals, but keep it as a guided writing workbook with mixed productive item types."
: "교과서 문법 학습목표에 맞추되, 복수의 생산형 문항 유형이 섞인 안내형 영작 워크북으로 구성할 것.";
    case "chapter-grammar":
      return isEn
        ?
"Focus tightly on the chapter grammar and make learners produce sentences with fragment-based clues and mixed writing task types."
: "챕터 문법에 집중하되, 조각형 clue와 혼합 영작 유형을 통해 문장을 직접 생산하게 만들 것.";
    default:
      return isEn
        ?
"Create a premium guided English writing-training workbook with fragment-based clues, mixed item types, and one-extra-word rearrangement tasks. Mark only selected hybrid items with [Mixed Training], and do not label every item by type."
: "조각형 clue, 혼합 생산형 문항, 초과단어 재배열형이 포함된 프리미엄 영작훈련 워크북으로 구성하되, 일부 응용 문항만 [혼합형]으로 표시하고 모든 문항을 유형 라벨링하지 말 것.";
  }
}

function buildUserPrompt(input) {
  const title = buildMagicTitle(input);
  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);
  const modeLabel = getModeLabel(input.mode, input.language);
  const taskGuide = buildTaskGuide(input);

  if (input.mode === "vocab-builder") {
    const vocabSeriesBlock = buildVocabSeriesBlock(input);

    return input.language === "en"
      ? `
${vocabSeriesBlock}

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

${buildGrammarOptionRuleBlock(input)}

Original request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim()
      : `
${vocabSeriesBlock}

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

${buildGrammarOptionRuleBlock(input)}

사용자 원문:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
  }

  return input.language === "en"
    ? `
Generate a MARCUS Magic English writing-training workbook.
Title: ${title}
Mode: ${input.mode} (${modeLabel})
Topic: ${input.topic}
Difficulty: ${input.difficulty} (${difficultyLabel})
Item count: ${input.count}
Requirement: ${taskGuide}
${buildGrammarRuleBlock(input)}
${buildHardChapterLockBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}
${buildGrammarOptionRuleBlock(input)}

Mandatory Magic rules:
- Present prompts in the learner's input language first.
- Make learners produce English sentences by themselves.
- Never use the full final answer sentence as the clue.
- Use fragment-based clues instead of full-sentence clues.
- Mix at least 3 productive item types across the set.
- Include rearrangement items with one extra unnecessary word.
- Include some partial-completion writing items.
- Include some sentence-transformation writing items.
- Keep the worksheet production-oriented, not copy-based.
- Keep the grammar accurate and classroom-usable.

Quality control:
- Do not create present perfect + finished past-time conflicts.
- Do not generate weak copy-the-answer style items.
- Do not output broken, incomplete, or awkward sentences.
- If a clue would naturally produce a broken sentence, rewrite the output into a correct teachable sentence instead of forcing the clue literally.
- Reject answers that are grammatical only on the surface but unnatural in real classroom English.
- Do not make all ${input.count} items the same pattern.
- Prefer natural classroom English and common collocations.
- Prefer go shopping, play the piano, see a movie, and go to the beach over awkward literal phrasing.
- In superlative units, keep the target structure visibly superlative and avoid drifting into comparative answers unless explicitly requested.
- In superlative answers, use complete and natural phrases such as "the tallest boy in the class", "the most beautiful city", and "among the people I know."
- Avoid awkward endings like "the most beneficial I take" or bare endings like "This city is the most beautiful."
- Make the output feel like premium guided training.

Original request:
${input.userPrompt || "(No additional user prompt provided.)"}
`.trim()
    : `
마커스매직 스타일 영어 영작훈련 워크북 세트를 생성하시오.

제목: ${title}
모드: ${input.mode} (${modeLabel})
주제: ${input.topic}
난이도: ${input.difficulty} (${difficultyLabel})
문항 수: ${input.count}
요구사항: ${taskGuide}
${buildGrammarRuleBlock(input)}
${buildHardChapterLockBlock(input)}
${buildTargetCoverageRuleBlock(input)}
${buildStabilityLockRuleBlock(input)}
${buildLearningVariationRuleBlock(input)}
${buildGrammarOptionRuleBlock(input)}

매직 필수 규칙:
- 문제는 먼저 학습자의 입력 언어로 제시할 것.
- 학습자가 영어 문장을 직접 생산하게 만들 것.
- 정답 완성문장을 clue로 그대로 주지 말 것.
- clue는 반드시 조각형 clue 중심으로 설계할 것.
- 세트 전체에 최소 3가지 이상의 생산형 문항 유형을 섞을 것.
- 일부 문항은 초과단어 1개가 포함된 재배열형으로 만들 것.
- 일부 문항은 부분완성 후 전체 영작형으로 만들 것.
- 일부 문항은 문장변환 영작형으로 만들 것.
- 베껴쓰기형이 아니라 생산형 훈련 워크북처럼 보이게 할 것.
- 문법은 정확하고 실제 수업에서 사용할 수 있어야 한다.

품질 통제:
- 현재완료 + last week 같은 시제 충돌을 만들지 말 것.
- 답을 거의 그대로 베끼는 약한 문제를 만들지 말 것.
- 비문, 미완성문, 어색한 교재체 문장을 출력하지 말 것.
- clue를 문자 그대로 억지로 맞추다가 깨진 문장을 만들지 말고, 출력 단계에서 자연스러운 교재용 문장으로 바로잡을 것.
- 겉보기에만 문법적이고 실제 교실 영어로는 부자연스러운 정답은 폐기할 것.
- ${input.count}문항이 모두 같은 패턴이 되지 않게 할 것.
- 영어 문장은 실제 교실에서 바로 읽어줄 수 있을 정도로 자연스러워야 할 것.
- 어색한 직역보다 자연스러운 기본 결합을 우선할 것. 예: go shopping, play the piano, see a movie, go to the beach.
- 최상급 단원에서는 비교급으로 흐르지 말고 최상급 구조가 정답에 분명히 드러나게 할 것.
- 최상급 문장은 "the tallest boy in the class", "the most beautiful city", "among the people I know"처럼 완전하고 자연스럽게 작성할 것.
- "the most beneficial I take", "This city is the most beautiful." 같은 어색한 문장을 만들지 말 것.
- 결과물은 프리미엄 guided training 워크북처럼 느껴져야 한다.

사용자 원문:
${input.userPrompt || "(추가 요청 없음)"}
`.trim();
}

function buildMagicResponse(rawText, input) {
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

  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}


/* =========================
   S8.5 Integrated Core Layer
   ========================= */

function buildGrammarVisibilityLock(input = {}) {
  const focus = input?.grammarFocus || {};
  const isKo = input?.language !== "en";
  const rules = [];

  if (focus.isRelativePronoun) {
    rules.push(
      isKo
        ? "- 관계대명사 챕터이면 관계절이 실제 문항과 정답에 분명히 드러나야 한다."
        : "- In a relative-pronoun chapter, the relative clause must be clearly visible in items and answers."
    );
  }

  if (focus.isNonRestrictive) {
    rules.push(
      isKo
        ? "- 계속적 용법이면 쉼표를 사용하고 who/which를 우선 사용하며 that은 쓰지 않는다."
        : "- For non-restrictive relative clauses, use commas and prefer who/which. Do not use that."
    );
  }

  if (focus.isRestrictive) {
    rules.push(
      isKo
        ? "- 제한적 용법이면 쉼표 없이 필수 정보 관계절로 유지한다."
        : "- For restrictive relative clauses, keep the clause essential and do not use commas."
    );
  }

  if (focus.isObjectiveRelativePronoun) {
    rules.push(
      isKo
        ? "- 목적격 관계대명사 챕터이면 목적격 관계절이 드러나야 하며, 주격 관계절만 반복하지 않는다."
        : "- In an objective-relative chapter, visibly use object relative clauses rather than repeating only subject relative clauses."
    );
  }

  if (focus.isParticipialModifier) {
    rules.push(
      isKo
        ? "- 분사의 한정적 용법 챕터이면 문항과 정답의 다수에서 명사를 직접 수식하는 분사 구조(-ing / p.p.)를 보여야 한다."
        : "- In a participle-modifier chapter, most items and answers must show participles directly modifying nouns (-ing / past participle)."
    );
  }

  if (focus.isCausative) {
    rules.push(
      isKo
        ? "- 사역동사 챕터이면 make / let / have / get 등의 사역 구조가 실제 정답에 드러나야 한다."
        : "- In a causative-verb chapter, real causative structures such as make / let / have / get must appear in the answers."
    );
  }

  if (focus.isSoThatPurpose) {
    rules.push(
      isKo
        ? "- so that 구문(목적) 챕터이면 so that + 주어 + can/could 구조를 분명히 유지하고 문장을 미완성으로 끝내지 않는다."
        : "- In a so-that purpose chapter, clearly keep so that + subject + can/could and never leave the sentence incomplete."
    );
  }

  if (focus.isToInfinitive) {
    rules.push(
      isKo
        ? "- to부정사 챕터이면 to + 동사원형 구조가 목표 문법으로 분명히 드러나야 한다."
        : "- In a to-infinitive chapter, the target to + base verb structure must be clearly visible."
    );
  }

  if (focus.isGerund) {
    rules.push(
      isKo
        ? "- 동명사 챕터이면 동명사(-ing)가 명사 역할로 쓰이는 구조가 실제 정답에 드러나야 한다."
        : "- In a gerund chapter, the -ing form used as a noun must be clearly visible in the final answers."
    );
  }

  if (focus.isPassive) {
    rules.push(
      isKo
        ? "- 수동태 챕터이면 be + p.p. 구조를 실제 정답에 유지한다."
        : "- In a passive chapter, keep real be + past participle structures in the final answers."
    );
  }

  if (focus.isPresentPerfect) {
    rules.push(
      isKo
        ? "- 현재완료 챕터이면 have/has + p.p.를 유지하고 finished past-time expression과 충돌시키지 않는다."
        : "- In a present-perfect chapter, preserve have/has + past participle and avoid conflicts with finished past-time expressions."
    );
  }

  if (focus.isComparative) {
    rules.push(
      isKo
        ? "- 비교급 챕터이면 비교급 구조가 눈에 보이게 유지되어야 한다."
        : "- In a comparative chapter, visibly preserve comparative structures."
    );
  }

  if (focus.isSuperlative) {
    rules.push(
      isKo
        ? "- 최상급 챕터이면 최상급 구조가 분명히 보여야 하며 비교급이나 막연한 일반문장으로 흐르지 않는다."
        : "- In a superlative chapter, visibly preserve superlative structures and do not drift into comparative or vague generic sentences."
    );
  }

  if (!rules.length) {
    rules.push(
      isKo
        ? "- 원래 문법 타깃이 정답과 문항에 실제로 드러나도록 유지하라."
        : "- Keep the original grammar target visibly present in both items and answers."
    );
  }

  return `
[GRAMMAR VISIBILITY LOCK]
${rules.join("\n")}`.trim();
}

function validateStructureStrict(text = "") {
  if (!text.includes("[[TITLE]]")) return "Missing TITLE";
  if (!text.includes("[[INSTRUCTIONS]]")) return "Missing INSTRUCTIONS";
  if (!text.includes("[[QUESTIONS]]")) return "Missing QUESTIONS";
  if (!text.includes("[[ANSWERS]]")) return "Missing ANSWERS";
  return "";
}

function validateQualityStrict(text = "") {
  const badPatterns = [
    /made me interesting/i,
    /made me enjoyable/i,
    /let me comfortable/i,
    /made us touched/i,
    /a little books/i,
    /much candies/i,
    /a few foods/i,
  ];

  for (const pattern of badPatterns) {
    if (pattern.test(text)) return "Unnatural sentence";
  }

  return "";
}

function validateLengthStrict(text = "", input = {}) {
  const isConcept =
    input?.intentMode === "concept" ||
    input?.intentMode === "concept+training";

  const minLength = isConcept ? 300 : 400;
  if (String(text || "").trim().length < minLength) {
    return "Too short";
  }

  return "";
}

function buildCoreUserPrompt(input) {
  const basePrompt = buildUserPrompt(input);
  const grammarLock = buildGrammarVisibilityLock(input);

  return `
${basePrompt}

${grammarLock}

[STRICT OUTPUT REMINDER]
- Return exactly 4 sections:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
- Do not add markdown or commentary outside the required sections.
- Keep workbook identity.
- Keep questions and answers separable.
- Keep numbering stable.
- Keep the requested grammar clearly visible in the final worksheet.
`.trim();
}

function buildCoreRepairPrompt(lastError, input) {
  return `
Fix previous output.

Error:
${lastError}

Repair rules:
- Return exactly 4 sections:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
- Fix broken grammar.
- Fix broken structure.
- Expand if too short.
- Preserve worksheet identity.
- Keep the target grammar clearly visible.
- Preserve item count as closely as possible.
- Keep output teacher-ready and workbook-style.

${buildGrammarVisibilityLock(input)}
`.trim();
}

async function generateMagicCore(input) {
  const systemPrompt = buildSystemPrompt(input);
  let userPrompt = buildCoreUserPrompt(input);
  let lastError = "";

  for (let i = 0; i < 5; i += 1) {
    const out = await callOpenAI(systemPrompt, userPrompt);

    const e1 = validateStructureStrict(out);
    const e2 = validateQualityStrict(out);
    const e3 = validateLengthStrict(out, input);

    if (!e1 && !e2 && !e3) {
      return out;
    }

    lastError = e1 || e2 || e3;

    userPrompt = `
${buildCoreUserPrompt(input)}

[PREVIOUS OUTPUT]
${out}

${buildCoreRepairPrompt(lastError, input)}
`.trim();
  }

  throw new Error(`MAGIC_CORE_GENERATION_FAILED: ${lastError || "unknown"}`);
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  return end === -1 ?
rawText.slice(from).trim() : rawText.slice(from, end).trim();
}

function countWorksheetItems(text = "") {
  const source = String(text || "");
  const patterns = [
    /^\s*\d+\./gm,
    /^\s*\d+\)/gm,
    /^\s*[A-Z]\./gm,
    /^\s*[A-Z]\)/gm,
  ];

  let maxCount = 0;
  for (const pattern of patterns) {
    const matches = source.match(pattern) || [];
    if (matches.length > maxCount) maxCount = matches.length;
  }
  return maxCount;
}

function smoothGeneratedEnglish(text = "", input = {}) {
  let output = String(text || "");
  if (!output) return output;

  const replacements = [
    [/\bdo shopping\b/gi, "go shopping"],
    [/\blearn piano\b/gi, "learn the piano"],
    [/\bplay piano\b/gi, "play the piano"],
    [/\bsee movie\b/gi, "see a movie"],
    [/\bgo beach\b/gi, "go to the beach"],
    [/\bamong friends\b/gi, "among his friends"],
    [/\bamong classmates\b/gi, "among her classmates"],
  ];

  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }

  if (String(input?.topic || "").includes("최상급")) {
    output = output
      .replace(/\bmost beneficial I take\b/gi, "most beneficial class I take")
      .replace(/\bThis city is the most beautiful\.(?!\w)/g, "This is the most beautiful city.");
  }

  return output;
}

function hasMeaningfulWorksheetBody(text = "") {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length >= 80;
}

function isGenerationSuccessful(formatted, input) {
  if (!formatted || typeof formatted !== "object") {
    return { ok: false, reason: "formatted_missing" };
  }

  const contentOk = hasMeaningfulWorksheetBody(formatted.content);
  const answerOk = hasMeaningfulWorksheetBody(formatted.answerSheet);
  const questionsOk = hasMeaningfulWorksheetBody(formatted.questions);
  const requestedCount = Number(input?.count || 0);
  const actualCount = Number(formatted.actualCount || 0);
  const isConcept = ["concept", "concept+training"].includes(input?.intentMode);
  const isVocabSeries = input?.mode === "vocab-builder" && Number(input?.vocabSeriesEnd || 1) > Number(input?.vocabSeriesStart || 1);

  if (!contentOk) {
    return { ok: false, reason: "content_too_short" };
  }
  if (!answerOk) {
    return { ok: false, reason: "answer_sheet_missing" };
  }
  if (!questionsOk) {
    return { ok: false, reason: "questions_missing" };
  }
  if (requestedCount > 0 && !isConcept && !isVocabSeries) {
    const minimumAcceptable = Math.max(1, Math.ceil(requestedCount * 0.6));
    if (actualCount < minimumAcceptable) {
      return {
        ok: false,
        reason: "actual_count_too_low",
        requestedCount,
        actualCount,
        minimumAcceptable,
      };
    }
  }

  return { ok: true };
}

function formatMagicResponse(rawText, input) {
  const safeRawText = String(rawText || "");

  let title = extractSection(safeRawText, "[[TITLE]]", "[[INSTRUCTIONS]]");
  let instructions = extractSection(safeRawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]");
  let questions = extractSection(safeRawText, "[[QUESTIONS]]", "[[ANSWERS]]");
  let answers = extractSection(safeRawText, "[[ANSWERS]]", null);

  if (!title) title = extractSection(safeRawText, "[[TITLE]]", "[[안내]]");
  if (!instructions) instructions = extractSection(safeRawText, "[[안내]]", "[[문항]]");
  if (!questions) questions = extractSection(safeRawText, "[[문항]]", "[[정답]]");
  if (!answers) answers = extractSection(safeRawText, "[[정답]]", null);

  const finalTitle = (title || "").trim() || buildMagicTitle(input);

  const normalizedInstructions = (instructions || "").trim();
  let normalizedQuestions = (questions || "").trim();
  let normalizedAnswers = (answers || "").trim();

  if (!normalizedQuestions && safeRawText.trim()) {
    const cleaned = safeRawText
      .replace(/\[\[TITLE\]\]/g, "")
      .replace(/\[\[INSTRUCTIONS\]\]/g, "")
      .replace(/\[\[QUESTIONS\]\]/g, "")
      .replace(/\[\[ANSWERS\]\]/g, "")
      .replace(/\[\[안내\]\]/g, "")
      .replace(/\[\[문항\]\]/g, "")
      .replace(/\[\[정답\]\]/g, "")
      .trim();

    normalizedQuestions = cleaned;
  }

  const integratedAnswerMarkers = ["\n[[ANSWERS]]", "\n[[정답]]", "\n[정답]", "\n정답", "\nAnswers"];
  let splitIndex = -1;
  let splitMarker = "";

  for (const marker of integratedAnswerMarkers) {
    const idx = normalizedQuestions.indexOf(marker);
    if (idx !== -1 && (splitIndex === -1 || idx < splitIndex)) {
      splitIndex = idx;
      splitMarker = marker;
    }
  }

  if (splitIndex !== -1) {
    if (!normalizedAnswers) {
      normalizedAnswers = normalizedQuestions
        .slice(splitIndex + splitMarker.length)
        .trim()
        .replace(/^[:：\s-]+/, "");
    }
    normalizedQuestions = normalizedQuestions.slice(0, splitIndex).trim();
  }

  normalizedQuestions = smoothGeneratedEnglish(normalizedQuestions, input);
  normalizedAnswers = smoothGeneratedEnglish(normalizedAnswers, input);

  const contentParts = [
    finalTitle,
    normalizedInstructions,
    normalizedQuestions
  ].filter(Boolean);

  const fullParts = [...contentParts];
  if (normalizedAnswers) {
    fullParts.push((input.language === "en" ? "Answers\n" : "정답\n") + normalizedAnswers);
  }

  return {
    title: finalTitle,
    instructions: normalizedInstructions,
    questions: normalizedQuestions,
    content: contentParts.join("\n\n"),
    answerSheet: normalizedAnswers,
    fullText: fullParts.join("\n\n"),
    actualCount: countWorksheetItems(normalizedQuestions)
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
    data = text ?
JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Memberstack request failed: ${response.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

function normalizeCostKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getRequiredMp(reqBody = {}) {
  const explicit = Number(reqBody.mpCost);
  if (Number.isFinite(explicit)) {
    return sanitizeMp(explicit, 5);
  }

  const modeKey = normalizeCostKey(reqBody.mode);
  const engineKey = normalizeCostKey(reqBody.engine);

  if (modeKey && Number.isFinite(MP_COST_TABLE[modeKey])) {
    return MP_COST_TABLE[modeKey];
  }

  if (engineKey && Number.isFinite(MP_COST_TABLE[engineKey])) {
    return MP_COST_TABLE[engineKey];
  }

  return 5;
}

function getInitialTrialMp() {
  return sanitizeMp(DEFAULT_TRIAL_MP, 15);
}

function extractBearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ?
match[1] : "";
}

function extractMemberId(req) {
  return sanitizeString(
    req?.body?.memberId ||
    req?.headers?.["x-member-id"] ||
    req?.headers?.["X-Member-Id"] ||
    ""
  );
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
      return sanitizeMp(num, 0);
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
      ?
member.customFields
      : {};
  const currentMetaData =
    member?.metaData && typeof member.metaData === "object"
      ?
member.metaData
      : {};

  const safeMp = sanitizeMp(nextMp, 0);
  const patchBody = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeMp,
      mp: safeMp,
      MP: safeMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeMp,
      mp: safeMp,
      MP: safeMp,
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
      deducted: false,
    };
  }

  let member = memberContext.member;
  let currentMp = readMpFromMember(member);
  let trialGranted = false;
  if (!Number.isFinite(currentMp)) {
    currentMp = getInitialTrialMp();
    member = (await updateMemberMp(member, currentMp)) || member;
    currentMp = readMpFromMember(member);
    trialGranted = true;
  }

  if (!Number.isFinite(currentMp)) {
    currentMp = 0;
  }

  return {
    enabled: true,
    reason: memberContext.reason,
    requiredMp,
    member,
    currentMp,
    remainingMp: currentMp,
    trialGranted,
    deducted: false,
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
    member: updatedMember ||
mpState.member,
    currentMp: nextMp,
    remainingMp: nextMp,
    deducted: true,
  };
}


/* =========================
   Main Handler
   ========================= */

module.exports = async function handler(req, res) {
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
      return json(res, 403, {
        success: false,
        error: "INSUFFICIENT_MP",
        message: "MP가 부족합니다.",
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: mpState.currentMp,
        trialGranted: Boolean(mpState.trialGranted),
        mpSyncEnabled: Boolean(mpState.enabled),
        mpSyncReason: mpState.reason || "unknown",
        mp: {
          requiredMp: mpState.requiredMp,
          currentMp: mpState.currentMp,
          remainingMp: mpState.currentMp,
          deducted: false,
          trialGranted: Boolean(mpState.trialGranted),
        },
      });
    }

    const rawText = await generateMagicCore(input);
    const formatted = formatMagicResponse(rawText, input);
    const generationCheck = isGenerationSuccessful(formatted, input);

    if (!generationCheck.ok) {
      return json(res, 502, {
        success: false,
        message: "생성 결과 구조가 불완전하여 MP를 차감하지 않았습니다. 다시 시도해주세요.",
        detail: generationCheck.reason,
        meta: {
          language: input.language,
          requestedCount: input.count,
          actualCount: formatted.actualCount,
          generatedAt: new Date().toISOString()
        },
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: mpState.currentMp,
        trialGranted: Boolean(mpState.trialGranted),
        mpSyncEnabled: Boolean(mpState.enabled),
        mpSyncReason: mpState.reason || "unknown",
        mp: {
          requiredMp: mpState.requiredMp,
          currentMp: mpState.currentMp,
          remainingMp: mpState.currentMp,
          deducted: false,
          trialGranted: Boolean(mpState.trialGranted),
        }
      });
    }

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
      requiredMp: mpState.requiredMp,
      currentMp: mpState.currentMp,
      remainingMp: finalMpState?.remainingMp ?? null,
      trialGranted: Boolean(mpState.trialGranted),
      mpSyncEnabled: Boolean(mpState.enabled),
      mpSyncReason: mpState.reason || "unknown",
      mp: {
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: finalMpState?.remainingMp ?? null,
        deducted: Boolean(finalMpState?.deducted),
        trialGranted: Boolean(mpState.trialGranted),
      }
    });
  } catch (error) {
    console.error("Handler error:", error);
    return json(res, 500, { success: false, message: "매직 워크북 생성에 실패했습니다.", detail: error.message });
  }
}
