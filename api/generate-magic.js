module.exports.config = { runtime: "nodejs" };

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

function sanitizeEngine(value) {
  const v = sanitizeString(value).toLowerCase();

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
14. 정답 섹션을 반드시 제공할 것.
15. 문항 수를 가능한 한 정확히 맞출 것.
16. 각 문항은 실제 수업에서 자연스럽고 교육적으로 사용 가능해야 한다.

문항 유형 설계 규칙:
- 반드시 최소 3가지 유형을 혼합할 것.
- 권장 비율:
  ① 조각형 clue 기반 영작 40%
  ② 초과단어 1개 포함 재배열 영작 30%
  ③ 부분완성 후 전체 영작 20%
  ④ 문장변환 영작 10%

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
금지 규칙:
- 정답 완성문장을 clue로 그대로 제시하지 말 것.
- 모든 문항을 한 가지 유형으로만 만들지 말 것.
- 단순 암기형, 베껴쓰기형 결과물로 만들지 말 것.
- 설명문 위주의 문법 해설지로 만들지 말 것.
- 시험용 함정 객관식으로 만들지 말 것.
- 사용자 요청과 무관한 독해 지문형 시험지로 만들지 말 것.
${buildModeSpecificGuide(input)}

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
15. Always provide an answer section.
16. Match the requested item count as accurately as possible.
17. Keep every item classroom-usable and educationally natural.
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
Forbidden:
- Do not provide the exact final sentence as the clue.
- Do not make all items the same type.
- Do not reduce the worksheet to copying practice.
- Do not turn it into a grammar explanation sheet.
- Do not turn it into a multiple-choice_trap test.
- Do not drift into unrelated passage-based exam content.
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
"Focus strongly on English writing training through fragment-clue composition, rearrangement with one extra word, partial completion, and sentence transformation."
: "조각형 clue 영작, 초과단어 재배열형, 부분완성형, 문장변환형을 포함한 영작훈련 중심으로 구성할 것.";
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
"Create a premium guided English writing-training workbook with fragment-based clues, mixed item types, and one-extra-word rearrangement tasks."
: "조각형 clue, 혼합 생산형 문항, 초과단어 재배열형이 포함된 프리미엄 영작훈련 워크북으로 구성할 것.";
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
- Do not make all ${input.count} items the same pattern.
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
- ${input.count}문항이 모두 같은 패턴이 되지 않게 할 것.
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

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  return end === -1 ?
rawText.slice(from).trim() : rawText.slice(from, end).trim();
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
    throw new Error(`Memberstack request failed: ${response.status}`);
  }

  return data;
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
  const data = await memberstackRequest("/verify-token", {
    method: "POST",
    body: JSON.stringify({ token }),
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

function sanitizeEngine(value) {
  const v = sanitizeString(value).toLowerCase();

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
      return json(res, 403, { success: false, error: "INSUFFICIENT_MP", message: "MP가 부족합니다.", requiredMp: mpState.requiredMp, remainingMp: mpState.currentMp });
    }

    const rawText = await callOpenAI(buildSystemPrompt(input), buildUserPrompt(input));
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
    return json(res, 500, { success: false, message: "매직 워크북 생성에 실패했습니다.", detail: error.message });
  }
}
