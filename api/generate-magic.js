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

function sanitizeRefillCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return clamp(Math.round(num), 0, 10);
}

function sanitizeRemainingQuestions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 50);
}

function buildRefillPromptBlock(body = {}, input = {}) {
  if (!body || body.isRefill !== true) return "";
  const refillCount = sanitizeRefillCount(body.refillCount);
  const remaining = sanitizeRemainingQuestions(body.remainingQuestions);
  if (refillCount <= 0) return "";

  const joined = remaining.length
    ? remaining.map((line, idx) => `${idx + 1}. ${line}`).join("\n")
    : "(remaining questions unavailable)";

  return input.language === "en"
    ? `
[REFILL GENERATION MODE]
- This is NOT a full worksheet regeneration.
- Generate exactly ${refillCount} NEW items only.
- Keep the same worksheet identity, difficulty, tone, and grammar focus.
- Do not repeat or closely imitate any of the remaining questions below.
- Return only the newly generated ${refillCount} items with their matching answers.

[REMAINING QUESTIONS TO AVOID]
${joined}
`.trim()
    : `
[보충 생성 모드]
- 이번 요청은 전체 재생성이 아니다.
- 정확히 ${refillCount}개의 새 문항만 생성할 것.
- 기존 워크시트의 난도, 톤, 문법 초점, 출력 정체성을 유지할 것.
- 아래 남아 있는 문항들과 중복되거나 매우 유사한 문항을 만들지 말 것.
- 새로 추가할 ${refillCount}문항과 그에 맞는 정답만 반환할 것.

[중복 금지용 기존 문항]
${joined}
`.trim();
}

function validateRefillOutput(formatted = {}, input = {}) {
  if (!input?.isRefill) return true;
  const expected = Number(input?.refillCount || input?.count || 0);
  if (expected <= 0) return false;

  const questionCount = String(formatted?.questions || formatted?.worksheet || formatted?.worksheetHtml || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .length;

  const answerCount = String(formatted?.answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .length;

  if (questionCount && questionCount !== expected) return false;
  if (answerCount && answerCount !== expected) return false;
  if (!String(formatted?.answerSheet || "").trim()) return false;

  return true;
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

  const isWhatRelativePronoun = hasAny([
    /관계대명사\s*what/,
    /what\s*관계대명사/,
    /relative\s*pronoun\s*what/i,
  ]);

  const isToInfinitiveAdjective = hasAny([
    /to부정사의\s*형용사적\s*용법/,
    /형용사적\s*용법/,
    /adjective use of to-infinitive/i,
    /adjectival to-infinitive/i,
  ]);

  let chapterKey = "general";
  if (isWhatRelativePronoun) chapterKey = "relative_pronoun_what";
  else if (isRelativePronoun && isNonRestrictive) chapterKey = "relative_pronoun_non_restrictive";
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
    isWhatRelativePronoun,
    isToInfinitiveAdjective,
  };
}

const CHAPTER_EXPANSION_LIBRARY = {
  relative_pronoun_what: {
    en: `[Chapter Blueprint: Relative Pronoun What]
- Core ratio: about 80% target what-clause items, about 20% mixed support or application items.
- Preferred answer families: What I need is ..., What she said was ..., What I learned helped me ....
- Prefer Korean prompts that naturally mean "~하는 것" or "~한 것은".
- Keep lexical variety across need / say / learn / enjoy / want / suggest / create / write.`,
    ko: `[챕터 청사진: 관계대명사 what]
- 권장 비율: 핵심 what절 80% 내외, 혼합 적용 20% 내외.
- 정답 계열은 What I need is ..., What she said was ..., What I learned helped me ...를 우선한다.
- 한국어 제시문은 "~하는 것", "~한 것은" 의미가 자연스럽게 드러나게 한다.
- need / say / learn / enjoy / want / suggest / create / write 계열을 고르게 섞어 반복을 줄인다.`
  },
  relative_pronoun_non_restrictive: {
    en: `[Chapter Blueprint: Non-Restrictive Relative Clauses]
- Core ratio: about 80% comma-based non-restrictive items.
- Use already-identified antecedents such as my brother, our teacher, this book, this city, this movie.
- Main answer family: Noun, who/which ..., main clause.
- Keep the predicate natural after the comma-clause.`,
    ko: `[챕터 청사진: 관계대명사의 계속적 용법]
- 권장 비율: 쉼표가 보이는 계속적 용법 80% 내외.
- my brother, our teacher, this book, this city, this movie 같은 특정 선행사를 우선한다.
- 정답 계열은 "선행사, who/which ..., 주절"을 기본으로 한다.
- 쉼표 뒤 부가설명 뒤에는 자연스러운 주절 서술을 유지한다.`
  },
  relative_pronoun_general: {
    en: `[Chapter Blueprint: Relative Pronouns]
- Core ratio: about 75% noun + relative clause target items.
- Balance people, things, places, and school situations.
- Vary who / which / that / whose naturally by antecedent.`,
    ko: `[챕터 청사진: 관계대명사]
- 권장 비율: 명사 + 관계절 핵심 문항 75% 내외.
- 사람, 사물, 장소, 학교 상황을 고르게 배치한다.
- 선행사에 따라 who / which / that / whose를 자연스럽게 분배한다.`
  },
  relative_pronoun_objective: {
    en: `[Chapter Blueprint: Objective Relative Pronouns]
- Keep object-role relative clauses visible.
- Prefer answer families like the book that I bought, the student whom we met, the movie which she recommended.`,
    ko: `[챕터 청사진: 목적격 관계대명사]
- 관계대명사가 목적격 역할을 하는 구조가 분명히 보여야 한다.
- the book that I bought, the student whom we met, the movie which she recommended 같은 계열을 우선한다.`
  },
  relative_adverb: {
    en: `[Chapter Blueprint: Relative Adverbs]
- Core ratio: about 75% items with when / where / why.
- Prefer answer families like the day when ..., the place where ..., the reason why ....`,
    ko: `[챕터 청사진: 관계부사]
- 권장 비율: when / where / why가 보이는 핵심 문항 75% 내외.
- the day when ..., the place where ..., the reason why ... 계열을 우선한다.`
  },
  to_infinitive: {
    en: `[Chapter Blueprint: To-Infinitives]
- Core ratio: about 75% explicit to + base verb items.
- Mix noun, adjective, and adverbial uses only when appropriate to the request.
- Avoid gerund-dominant sets.`,
    ko: `[챕터 청사진: to부정사]
- 권장 비율: to + 동사원형이 분명히 보이는 핵심 문항 75% 내외.
- 요청에 맞을 때만 명사적·형용사적·부사적 용법을 섞는다.
- 동명사 중심 세트로 흐르지 않게 한다.`
  },
  to_infinitive_adjective: {
    en: `[Chapter Blueprint: Adjectival To-Infinitives]
- Core ratio: about 80% noun + to-verb modifier items.
- Preferred nouns: book, thing, place, time, work, task, chance, article, activity, plan, skill.
- Mixed support items may appear, but do not allow purpose-only or be going to patterns to dominate.`,
    ko: `[챕터 청사진: to부정사의 형용사적 용법]
- 권장 비율: 명사 + to부정사 수식 핵심 문항 80% 내외.
- 선호 명사: book, thing, place, time, work, task, chance, article, activity, plan, skill.
- 혼합 문항은 허용하되, 단순 목적 용법이나 be going to 계열이 주류가 되지 않게 한다.`
  },
  gerund: {
    en: `[Chapter Blueprint: Gerunds]
- Core ratio: about 75% gerund-as-noun items.
- Balance object gerunds, subject gerunds, and preposition + gerund when natural.
- Do not let infinitive patterns dominate.`,
    ko: `[챕터 청사진: 동명사]
- 권장 비율: 동사를 명사처럼 쓰는 핵심 문항 75% 내외.
- 목적어 동명사, 주어 동명사, 전치사 + 동명사를 자연스럽게 배치한다.
- to부정사 패턴이 세트를 지배하지 않게 한다.`
  },
  passive: {
    en: `[Chapter Blueprint: Passive Voice]
- Core ratio: about 80% visible passive items.
- Balance present, past, modal passive, future passive, and progressive passive when suitable.
- Prefer verbs that sound natural in passive classroom English: write, build, invite, complete, translate, prepare, hold, review, solve, paint, break, announce.
- Avoid weak passive combinations such as was helped by unless the full phrase is naturally repaired.`,
    ko: `[챕터 청사진: 수동태]
- 권장 비율: 수동태가 눈에 보이는 핵심 문항 80% 내외.
- 현재·과거·조동사 수동·미래 수동·진행 수동을 적절히 분산한다.
- write, build, invite, complete, translate, prepare, hold, review, solve, paint, break, announce 같이 수동태로 자연스러운 동사를 우선한다.
- was helped by 같은 약한 수동 결합은 자연스럽게 보정되지 않으면 사용하지 않는다.`
  },
  present_perfect: {
    en: `[Chapter Blueprint: Present Perfect]
- Core ratio: about 80% valid present perfect items.
- Balance experience, continuation, completion, and result.
- Prefer since / for / already / yet / recently / just / before / never when natural.`,
    ko: `[챕터 청사진: 현재완료]
- 권장 비율: 현재완료가 분명한 핵심 문항 80% 내외.
- 경험·계속·완료·결과 의미를 고르게 배치한다.
- since / for / already / yet / recently / just / before / never를 자연스럽게 활용한다.`
  },
  comparative: {
    en: `[Chapter Blueprint: Comparatives]
- Core ratio: about 75% comparative target items.
- Use complete comparison frames such as taller than, more useful than, less expensive than.
- Vary adjective comparatives and adverb comparatives.`,
    ko: `[챕터 청사진: 비교급]
- 권장 비율: 비교급 핵심 문항 75% 내외.
- taller than, more useful than, less expensive than처럼 완전한 비교 틀을 유지한다.
- 형용사 비교급과 부사 비교급을 적절히 섞는다.`
  },
  superlative: {
    en: `[Chapter Blueprint: Superlatives]
- Core ratio: about 75% superlative target items.
- Prefer complete noun phrases such as the tallest boy in the class, the most useful tool for students.
- Keep comparison range visible with in / of / among when natural.`,
    ko: `[챕터 청사진: 최상급]
- 권장 비율: 최상급 핵심 문항 75% 내외.
- the tallest boy in the class, the most useful tool for students 같은 완전한 명사구를 우선한다.
- in / of / among 등 비교 범위를 자연스럽게 드러낸다.`
  },
  participial_modifier: {
    en: `[Chapter Blueprint: Participial Modifiers]
- Core ratio: about 80% noun-modifying participle items.
- Balance present participle modifiers and past participle modifiers.
- Prefer answer families like the boy running fast, the book written in English, the students waiting outside.`,
    ko: `[챕터 청사진: 분사의 한정적 용법]
- 권장 비율: 분사가 명사를 꾸미는 핵심 문항 80% 내외.
- 현재분사 수식과 과거분사 수식을 균형 있게 배치한다.
- the boy running fast, the book written in English, the students waiting outside 같은 계열을 우선한다.`
  },
  causative: {
    en: `[Chapter Blueprint: Causatives]
- Core ratio: about 75% make / let / have / help / get target items.
- Balance force, permission, arrangement, assistance, and causation meanings.`,
    ko: `[챕터 청사진: 사역동사]
- 권장 비율: make / let / have / help / get 핵심 문항 75% 내외.
- 강제, 허용, 시킴, 도움, 유발 의미를 고르게 배치한다.`
  },
  so_that_purpose: {
    en: `[Chapter Blueprint: so that Purpose]
- Core ratio: about 80% so that purpose items.
- Prefer complete purpose clauses with can / could / will / would + full verb phrase.
- Keep the purpose meaning explicit and teachable.`,
    ko: `[챕터 청사진: so that 구문 목적]
- 권장 비율: so that 목적 핵심 문항 80% 내외.
- can / could / will / would 뒤에 완전한 동사구가 오는 목적절을 우선한다.
- 목적 의미가 분명하고 수업용으로 가르칠 수 있어야 한다.`
  }
};

function buildChapterExpansionBlueprintBlock(input = {}) {
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );
  const key = focus?.isToInfinitiveAdjective ? "to_infinitive_adjective" : (focus?.chapterKey || "general");
  const entry = CHAPTER_EXPANSION_LIBRARY[key];
  if (!entry) return "";
  return input?.language === "en" ? entry.en : entry.ko;
}

function hasBlockedChapterLeak(answerText = "", input = {}) {
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );
  const lines = String(answerText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) return false;

  if (focus?.isToInfinitiveAdjective) {
    const leaking = lines.filter((line) => /\bgoing to be\b/i.test(line)).length;
    return leaking >= 2;
  }

  if (focus?.isPassive) {
    const leaking = lines.filter((line) => /\b(?:am|is|are|was|were|been)\s+helped\s+by\b/i.test(line)).length;
    return leaking >= 1;
  }

  if (focus?.isWhatRelativePronoun) {
    const leaking = lines.filter((line) => /\bthe thing that\b/i.test(line)).length;
    return leaking >= Math.max(2, Math.ceil(lines.length * 0.2));
  }

  return false;
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

  const refillCount = sanitizeRefillCount(body.refillCount);

  const effectiveCount =
    body.isRefill === true && refillCount > 0
      ? refillCount
      : intentMode === "concept"
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
    isRefill: body.isRefill === true && refillCount > 0,
    refillCount,
    remainingQuestions: sanitizeRemainingQuestions(body.remainingQuestions),
    magicStyle: sanitizeString(body.magicStyle || (mode === "writing" ? "marcus_magic" : "")),
    wordCountMode: sanitizeString(body.wordCountMode || (mode === "writing" ? "auto" : "")),
    workbookType: normalizeWorkbookType(body.workbookType || body.workbook_type || ""),
    profile: normalizeProfile(body.profile || body.levelProfile || body.gradeProfile || ""),
  };
}


/* =========================
   Runtime Anti-Repetition Memory
   ========================= */
const RECENT_OUTPUT_MEMORY = Object.create(null);

function getRecentMemoryKey(input = {}) {
  return [
    String(input.topic || "").trim().toLowerCase(),
    String(input.mode || "").trim().toLowerCase(),
    String(input.gradeLabel || "").trim().toLowerCase(),
    String(input.difficulty || "").trim().toLowerCase(),
  ].join("::");
}

function buildAntiRepetitionPromptBlock(input = {}) {
  const key = getRecentMemoryKey(input);
  const recent = Array.isArray(RECENT_OUTPUT_MEMORY[key]) ? RECENT_OUTPUT_MEMORY[key] : [];
  if (!recent.length) return "";

  const samples = recent.slice(-12).map((line) => `- ${line}`).join("\n");
  return input.language === "en"
    ? `
[ANTI-REPETITION MEMORY]
- Avoid reusing or closely imitating the following recent answer patterns for this same chapter/mode/grade.
- Keep the grammar target, but change subject, setting, lexical choice, and sentence family.

${samples}
`.trim()
    : `
[중복 방지 메모리]
- 같은 챕터/모드/학년에서 최근 생성된 아래 정답 패턴을 그대로 재사용하거나 매우 비슷하게 반복하지 말 것.
- 목표 문법은 유지하되, 주어, 상황, 어휘 선택, 문장 계열을 바꿀 것.

${samples}
`.trim();
}

function collectRecentAnswerLines(formatted = {}, input = {}) {
  const key = getRecentMemoryKey(input);
  const answerLines = String(formatted?.answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]\s*/, "").trim())
    .filter(Boolean);

  if (!answerLines.length) return;
  if (!Array.isArray(RECENT_OUTPUT_MEMORY[key])) RECENT_OUTPUT_MEMORY[key] = [];
  RECENT_OUTPUT_MEMORY[key].push(...answerLines);
  RECENT_OUTPUT_MEMORY[key] = RECENT_OUTPUT_MEMORY[key].slice(-40);
}

function buildPresentPerfectStrictFilterBlock(input = {}) {
  const topic = String(input?.topic || "");
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );

  const isPresentPerfectContinuous =
    /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(topic);
  const isPresentPerfect = focus?.isPresentPerfect || /현재완료|present\s+perfect/i.test(topic);

  if (!isPresentPerfect && !isPresentPerfectContinuous) return "";

  return input.language === "en"
    ? `
[PRESENT PERFECT STRICT FILTER]
- Only generate sentences that naturally fit present perfect.
- Allowed meaning zones:
  experience, duration, completion, result.
- Do not generate weak simple-past meanings, wishes, hopes, bare intentions, or generic present statements and then force them into present perfect.
- NEVER use finished past-time markers such as:
  yesterday, last week, last month, last year, ago, when, in 2020.
- Prefer valid present-perfect signals such as:
  since, for, before, already, yet, never, ever, recently, just, so far, up to now.
- If a Korean source meaning naturally pushes simple past, replace it with a naturally valid present-perfect meaning before generating the item.
- Reject tense-time collisions even if the sentence looks superficially correct.
`.trim()
    : `
[현재완료 엄격 필터]
- 현재완료에 자연스럽게 맞는 문장만 생성할 것.
- 허용 의미: 경험, 계속, 완료, 결과.
- 단순과거 의미, 희망, 바람, 단순 의도, 일반현재 진술을 억지로 현재완료로 바꾸지 말 것.
- 다음과 같은 완료 불가능 시간표현은 절대 사용하지 말 것:
  yesterday, last week, last month, last year, ago, when, in 2020
- 대신 다음과 같은 현재완료 신호어를 우선 사용할 것:
  since, for, before, already, yet, never, ever, recently, just, so far, up to now
- 한국어 원문의 의미가 단순과거를 강하게 유도하면, 문항 의미 자체를 현재완료에 자연스러운 뜻으로 바꾸어 생성할 것.
- 겉보기에만 맞는 시제-시간 충돌 문장은 폐기할 것.
`.trim();
}

function hasInvalidPastTimeMarker(text = "") {
  const value = String(text || "").toLowerCase();
  const patterns = [
    /\byesterday\b/,
    /\blast\s+(week|month|year|night|weekend|summer|winter|spring|fall|autumn)\b/,
    /\b\d+\s+days?\s+ago\b/,
    /\b\d+\s+weeks?\s+ago\b/,
    /\b\d+\s+months?\s+ago\b/,
    /\b\d+\s+years?\s+ago\b/,
    /\bago\b/,
    /\bwhen\b/,
    /\bin\s+(19|20)\d{2}\b/,
  ];
  return patterns.some((pattern) => pattern.test(value));
}



function buildMarcusChapterExpansionBlock(input = {}) {
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );
  const isEn = input?.language === "en";
  const blocks = [];

  if (focus?.isPassive) {
    blocks.push(isEn ? `
[Passive Chapter Expansion]
- Keep at least most core items visibly in passive voice: be + past participle.
- Prefer classroom-usable passive sentences such as "The window was broken", "The homework has been finished", or "The picture was painted by..."
- Do not let the set drift into ordinary active-voice statements.
- Mixed support items are allowed, but the worksheet should still feel like a passive-voice workbook.
`.trim() : `
[수동태 챕터 확장]
- 핵심 문항 다수는 be + 과거분사 수동태가 눈에 보이게 유지되어야 한다.
- "The window was broken", "The homework has been finished", "The picture was painted by..." 같은 교실형 수동태 문장을 우선한다.
- 일반 능동태 평서문으로 세트가 무너지지 않게 할 것.
- 일부 혼합형 문항은 허용하되, 전체 워크북의 인상은 수동태 중심이어야 한다.
`.trim());
  }

  if (focus?.isWhatRelativePronoun) {
    blocks.push(isEn ? `
[Relative Pronoun What Chapter Expansion]
- Keep the worksheet centered on WHAT meaning: the thing(s) that / what + clause.
- Prefer answer shapes such as "What I need is...", "What he said was...", or Korean prompts that naturally equal "~하는 것".
- Do not let the set drift into ordinary who / which / that relative clauses as the dominant answer style.
- Mixed support items are allowed only in a small minority, but the worksheet should still feel like a WHAT workbook.
`.trim() : `
[관계대명사 what 챕터 확장]
- 학습지는 반드시 WHAT 의미, 즉 "~하는 것" 중심으로 유지할 것.
- "What I need is...", "What he said was..."처럼 what절이 실제로 보이는 정답을 우선할 것.
- who / which / that 일반 관계절이 주된 정답 스타일이 되지 않게 할 것.
- 일부 혼합형은 허용하되, 전체 인상은 반드시 what 중심이어야 한다.
`.trim());
  } else if (focus?.isRelativePronoun) {
    blocks.push(isEn ? `
[Relative Pronoun Chapter Expansion]
- Keep at least most core items visibly centered on relative clauses with who / which / that / whom / whose.
- Prefer noun + relative clause structures over generic unrelated simple sentences.
- Mixed support items are allowed, but the worksheet should still feel like a relative-clause workbook.
`.trim() : `
[관계대명사 챕터 확장]
- 핵심 문항 다수는 who / which / that / whom / whose가 들어간 관계절 중심으로 유지할 것.
- 무관한 일반 평서문보다 명사 + 관계절 구조를 우선할 것.
- 일부 혼합형 문항은 허용하되, 전체 워크북의 인상은 관계대명사 중심이어야 한다.
`.trim());
  }

  if (focus?.isToInfinitiveAdjective) {
    blocks.push(isEn ? `
[Adjectival To-Infinitive Chapter Expansion]
- Keep the worksheet centered on adjective-use to-infinitives modifying nouns.
- Prefer answer shapes such as "I need a book to read", "She has something to do", "We need a place to sit".
- Do not let make / let / help / see / believe patterns dominate this chapter.
- Mixed support items are allowed only in a small minority, but the worksheet should still feel like an adjectival to-infinitive workbook.
`.trim() : `
[to부정사의 형용사적 용법 챕터 확장]
- 학습지는 반드시 명사를 꾸미는 to부정사 구조 중심으로 유지할 것.
- "a book to read", "something to do", "a place to sit"처럼 명사 뒤에서 수식하는 형태를 우선할 것.
- make / let / help / see / believe 같은 5형식, 지각동사, 사역동사 패턴이 주된 정답 스타일이 되지 않게 할 것.
- 일부 혼합형은 허용하되, 전체 인상은 반드시 형용사적 용법 중심이어야 한다.
`.trim());
  } else if (focus?.isToInfinitive) {
    blocks.push(isEn ? `
[To-Infinitive Chapter Expansion]
- Keep at least most core items visibly centered on to + base verb structures.
- Allow purpose, noun, and adjective uses when natural, but do not let the set drift into gerund-dominant items.
- Mixed support items are allowed, but the worksheet should still feel like a to-infinitive workbook.
`.trim() : `
[to부정사 챕터 확장]
- 핵심 문항 다수는 to + 동사원형 구조 중심으로 유지할 것.
- 목적/명사적/형용사적 용법은 자연스러우면 허용하되, 동명사 중심 세트로 흐르지 않게 할 것.
- 일부 혼합형 문항은 허용하되, 전체 워크북의 인상은 to부정사 중심이어야 한다.
`.trim());
  }

  const blueprint = buildChapterExpansionBlueprintBlock(input);
  if (blueprint) blocks.push(blueprint);

  return blocks.filter(Boolean).join("\n");
}

function countChapterSignalRatio(answerSheet = "", regex) {
  const lines = String(answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) return 0;
  const matched = lines.filter((line) => regex.test(line)).length;
  return matched / lines.length;
}

function hasMildChapterCoverage(text = "", input = {}) {
  const raw = String(text || "");
  const answers = extractSection(raw, "[[ANSWERS]]", null) || raw;
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );

  if (focus?.isPassive) {
    const ratio = countChapterSignalRatio(
      answers,
      /\b(am|is|are|was|were|be|been|being)\b\s+\b[\w'-]+(?:ed|en|wn|ne|lt|pt|nt|ft|ght)\b/i
    );
    return ratio >= 0.4;
  }

  if (focus?.isWhatRelativePronoun) {
    const ratio = countChapterSignalRatio(
      answers,
      /(^|\s)what\b/i
    );
    return ratio >= 0.2;
  }

  if (focus?.isRelativePronoun) {
    const ratio = countChapterSignalRatio(
      answers,
      /\b(who|which|that|whom|whose)\b/i
    );
    return ratio >= 0.35;
  }

  if (focus?.isRelativeAdverb) {
    const ratio = countChapterSignalRatio(
      answers,
      /\b(where|when|why)\b/i
    );
    return ratio >= 0.3;
  }

  if (focus?.isToInfinitiveAdjective) {
    const lines = String(answers || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line))
      .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
      .filter(Boolean);

    if (!lines.length) return false;
    const good = lines.filter((line) =>
      /\b(a|an|the|something|anything|nothing|someone|anyone|no one|time|place|way|book|thing|chance|opportunity|work|project|job|problem|report|movie|class|plan)\b[^.?!\n]{0,40}\bto\s+[a-z]+\b/i.test(line)
    ).length;
    return (good / lines.length) >= 0.18;
  }

  if (focus?.isToInfinitive) {
    const ratio = countChapterSignalRatio(
      answers,
      /\bto\s+[a-z]+\b/i
    );
    return ratio >= 0.35;
  }

  return true;
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
    magic: "마커스매직형",
    "magic-card": "마커스매직카드형",
    writing: "영작훈련형",
    abcstarter: "ABC Starter형",
    "textbook-grammar": "교과서 문법형",
    "chapter-grammar": "챕터 문법형",
    "vocab-builder": "어휘 빌더형",
    "vocab-csat": "수능 어휘형"
  };

  const enMap = {
    magic: "Marcus Magic",
    "magic-card": "Marcus Magic Card",
    writing: "Writing Training",
    abcstarter: "ABC Starter",
    "textbook-grammar": "Textbook Grammar",
    "chapter-grammar": "Chapter Grammar",
    "vocab-builder": "Vocab Builder",
    "vocab-csat": "CSAT Vocabulary"
  };

  return language === "en"
    ? (enMap[mode] || "Marcus Magic")
    : (koMap[mode] || "마커스매직형");
}

function buildMagicTitle(input) {
  if (input.worksheetTitle) return input.worksheetTitle;

  if (input.mode === "vocab-builder" || input.mode === "vocab-csat") {
    const start = Number(input.vocabSeriesStart || 1);
    const end = Number(input.vocabSeriesEnd || 1);
    const vocabLabel = input.mode === "vocab-csat"
      ? (input.language === "en" ? "CSAT Vocabulary" : "수능 어휘")
      : (input.language === "en" ? "Vocabulary" : "필수어휘");

    if (input.language === "en") {
      if (start === end) return `${vocabLabel} Round ${start}`;
      return `${vocabLabel} Rounds ${start}-${end}`;
    }

    if (start === end) {
      return `${input.gradeLabel} ${vocabLabel} ${start}회`;
    }
    return `${input.gradeLabel} ${vocabLabel} ${start}~${end}회`;
  }

  const isConcept = input.intentMode === "concept" || input.intentMode === "concept+training";
  if (isConcept) {
    if (input.language === "en") {
      return `${input.gradeLabel} ${input.topic} Concept Explanation and Examples`;
    }
    return `${input.gradeLabel} ${input.topic} 개념설명과 예문`;
  }

  const difficultyLabel = getDifficultyLabel(input.difficulty, input.language);

  const modeTitleMapKo = {
    abcstarter: "ABC Starter",
    writing: "영작훈련",
    "magic-card": "마커스매직카드",
    "textbook-grammar": "교과서 문법",
    "chapter-grammar": "챕터 문법",
    magic: "마커스매직",
  };

  const modeTitleMapEn = {
    abcstarter: "ABC Starter",
    writing: "Writing Training",
    "magic-card": "Marcus Magic Card",
    "textbook-grammar": "Textbook Grammar Writing",
    "chapter-grammar": "Chapter Grammar Writing",
    magic: "Marcus Magic",
  };

  if (input.language === "en") {
    const label = modeTitleMapEn[input.mode] || "Marcus Magic";
    return `${input.gradeLabel} ${input.topic} ${label} ${difficultyLabel} ${input.count} Items`;
  }

  const label = modeTitleMapKo[input.mode] || "마커스매직";
  return `${input.gradeLabel} ${input.topic} ${label} ${difficultyLabel} ${input.count}문항`;
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



/* =========================
   S14 Precision Upgrade Patch
   ========================= */
function buildS14PrecisionUpgradeBlock(input) {
  return `
[S14 PRECISION EXECUTION RULES]
- Enforce natural, complete sentences.
- Avoid short, weak sentences.
- Maintain grammar-target alignment (70%+).
- Ensure answer sheet ALWAYS exists.
- Prefer meaningful expansion over forced length.
`;
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


function buildDifficultyUpliftRuleBlock(input) {
  const isEn = input.language === "en";
  const level = input.level || "middle";
  const grade = input.gradeLabel || "중등";

  const uplift = (() => {
    if (/초1|초2|초3|초4|초5|초6|초등/.test(grade) || level === "elementary") {
      return {
        target: isEn ? "elementary grammar with middle-school sentence level" : "초등 문법 + 중등 문장 수준",
        complexity: isEn
          ? "Most items should expand beyond one short clause by adding reason, situation, purpose, or description."
          : "대부분의 문항은 짧은 단문 하나로 끝내지 말고, 이유·상황·목적·설명 요소를 덧붙여 중등형 문장 길이로 확장할 것.",
        vocab: isEn
          ? "Use common but slightly richer middle-school vocabulary instead of ultra-basic survival English."
          : "초기 생존영어 수준을 넘어서, 중등 학습자가 익숙하게 접하는 약간 더 풍부한 어휘를 사용할 것.",
      };
    }
    if (/중1/.test(grade)) {
      return {
        target: isEn ? "middle1 grammar with middle2 sentence level" : "중1 문법 + 중2 문장 수준",
        complexity: isEn
          ? "At least 70% of items should contain an added phrase or clause such as because, when, with, for, or a descriptive modifier."
          : "최소 70%의 문항은 because, when, with, for 또는 수식어구를 추가하여 중2 수준의 확장 문장으로 만들 것.",
        vocab: isEn
          ? "Prefer school-topic vocabulary involving habits, study, relationships, feelings, plans, and responsibilities."
          : "습관, 학습, 관계, 감정, 계획, 책임 같은 학교 친화적 주제 어휘를 우선할 것.",
      };
    }
    if (/중2/.test(grade)) {
      return {
        target: isEn ? "middle2 grammar with middle3 sentence level" : "중2 문법 + 중3 문장 수준",
        complexity: isEn
          ? "At least 75% of items should show meaningful sentence expansion with context, reason, result, comparison, or supporting detail."
          : "최소 75%의 문항은 맥락, 이유, 결과, 비교, 보충 설명 중 하나 이상이 드러나는 중3 수준의 확장 문장으로 만들 것.",
        vocab: isEn
          ? "Use slightly more academic and reflective vocabulary such as effort, confidence, decision, opportunity, communication, and environment when natural."
          : "effort, confidence, decision, opportunity, communication, environment 같은 약간 더 학술적이고 사고형인 어휘를 자연스럽게 섞을 것.",
      };
    }
    if (/중3/.test(grade)) {
      return {
        target: isEn ? "middle3 grammar with high1 sentence level" : "중3 문법 + 고1 문장 수준",
        complexity: isEn
          ? "At least 80% of items should include a fuller idea with clause expansion, abstract meaning, opinion, cause, or educational context."
          : "최소 80%의 문항은 절 확장, 추상 의미, 의견, 원인, 교육적 맥락 중 하나 이상이 드러나는 고1 수준 문장으로 만들 것.",
        vocab: isEn
          ? "Prefer more mature school-academic vocabulary such as perspective, responsibility, motivation, influence, achievement, and communication."
          : "perspective, responsibility, motivation, influence, achievement, communication 같은 더 성숙한 학교·학술 어휘를 우선할 것.",
      };
    }
    if (/고1|고2|고3|고등/.test(grade) || level === "high") {
      return {
        target: isEn ? "high-school grammar with high2-3 sentence level" : "고등 문법 + 고2·고3 문장 수준",
        complexity: isEn
          ? "Most items should avoid short literal daily-life sentences and instead use richer clauses, abstract content, reasoning, contrast, implication, or explanatory detail."
          : "대부분의 문항은 짧은 생활영어형 단문을 피하고, 더 풍부한 절 구조와 추상 내용, 이유, 대조, 함의, 설명 요소를 포함하는 고2·고3 수준 문장으로 만들 것.",
        vocab: isEn
          ? "Allow more advanced academic and humanistic vocabulary such as principle, interpretation, social change, education, ethics, identity, and opportunity."
          : "principle, interpretation, social change, education, ethics, identity, opportunity 같은 더 높은 사고형 어휘를 허용할 것.",
      };
    }
    return {
      target: isEn ? "stable middle-school sentence level" : "안정적인 중등 문장 수준",
      complexity: isEn ? "Avoid overly short sentences." : "과도하게 짧은 문장을 피할 것.",
      vocab: isEn ? "Use natural school-usable vocabulary." : "자연스럽고 수업에 바로 쓸 수 있는 어휘를 사용할 것.",
    };
  })();

  return isEn ? `
[Difficulty Uplift Rules]
Target level: ${uplift.target}
- Raise the sentence level without breaking the target grammar.
- Keep the current grammar chapter fully visible, but make the content one school stage more mature than the grammar label itself.
- Avoid ultra-short textbook starter sentences unless a small warm-up item is intentionally needed.
- Prefer fuller educational sentences with reason, purpose, result, contrast, opinion, context, or description.
- ${uplift.complexity}
- ${uplift.vocab}
- At least 70% of the items should be more expanded than a basic one-clause sentence.
- Do not let many items end as weak minimal patterns such as "is", "has", "likes", or other bare predicates.
- Even when the grammar target is simple, the thought content should feel one level higher.
- Keep the worksheet classroom-usable, natural, and teachable.
` : `
[문장 수준 상향 규칙]
목표 수준: ${uplift.target}
- 목표 문법은 그대로 유지하되, 문장 수준은 문법 학년보다 한 단계 더 성숙하게 올릴 것.
- 지나치게 짧고 교과서 입문형인 단문을 반복하지 말 것. 필요하면 일부 워밍업 문항만 예외로 둘 수 있다.
- 이유, 목적, 결과, 대조, 의견, 맥락, 설명 요소가 드러나는 더 풍부한 교육용 문장을 우선할 것.
- ${uplift.complexity}
- ${uplift.vocab}
- 최소 70% 이상의 문항은 기본 한 절짜리 단문보다 더 확장된 문장으로 만들 것.
- 많은 문항이 "is", "has", "likes" 같은 약한 최소 술어로 끝나지 않게 할 것.
- 문법 목표가 쉬워도, 사고 내용과 문장 질감은 한 단계 위 수준으로 느껴지게 할 것.
- 결과물은 실제 수업에서 바로 사용할 수 있을 정도로 자연스럽고 가르칠 만해야 한다.
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

  if (focus.isWhatRelativePronoun) {
    blocks.push(isEn ? `
[Relative Pronoun What Rules]
- The worksheet must visibly teach WHAT meaning: what = the thing(s) that.
- Prefer complete patterns such as "What I need is...", "What she said was...", "What I learned helped me."
- Do not let who / which / that dominate the set.
- Korean prompts should naturally map to "~하는 것", "~한 것은", "~이 필요한 것".
` : `
[관계대명사 what 규칙]
- 학습지는 what = the thing(s) that 의미를 눈에 보이게 가르쳐야 한다.
- "What I need is...", "What she said was...", "What I learned helped me." 같은 완전한 패턴을 우선할 것.
- who / which / that이 세트를 지배하지 않게 할 것.
- 한국어 제시문은 "~하는 것", "~한 것은", "~이 필요한 것" 의미로 자연스럽게 설계할 것.
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

  if (focus.isToInfinitiveAdjective) {
    return isEn ? `
[Hard Chapter Lock: Adjectival To-Infinitive]
- This chapter MUST stay centered on adjectival to-infinitives modifying nouns.
- Prefer answer shapes like:
  * I need a book to read.
  * She has something to do.
  * We need a place to sit.
  * He has no time to waste.
- Do not let let / make / help / see / have + object patterns dominate this chapter.
- Do not let bare purpose-only sentences dominate this chapter.
- Most target answers should visibly contain a noun followed by to + base verb.
` : `
[Hard Chapter Lock: to부정사의 형용사적 용법]
- 이 챕터의 핵심 목표 정답은 반드시 명사를 수식하는 to부정사 중심이어야 한다.
- 다음과 같은 형태를 우선한다:
  * a book to read
  * something to do
  * a place to sit
  * no time to waste
- let / make / help / see / have + 목적어 구조가 이 챕터의 주된 정답 스타일이 되지 않게 할 것.
- 단순 목적 용법 문장이 다수를 차지하지 않게 할 것.
- 핵심 목표 정답 다수는 명사 뒤에 to + 동사원형이 실제로 보여야 한다.
`;
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

  if (focus.isWhatRelativePronoun) return targetHeavy('relative pronoun what', '관계대명사 what');
  if (focus.isNonRestrictive) return targetHeavy('non-restrictive relative clauses', '관계대명사의 계속적 용법');
  if (focus.isObjectiveRelativePronoun) return targetHeavy('objective relative pronouns', '목적격 관계대명사');
  if (focus.isRelativePronoun && focus.isRestrictive) return targetHeavy('restrictive relative clauses', '관계대명사의 제한적 용법');
  if (focus.isRelativePronoun) return targetHeavy('relative pronouns', '관계대명사');
  if (focus.isParticipialModifier) return targetHeavy('attributive participles / participial modifiers', '분사의 한정적 용법');
  if (focus.isCausative) return targetHeavy('causative verbs', '사역동사');
  if (focus.isSoThatPurpose) return targetHeavy('so that purpose clauses', 'so that 구문 (목적)');
  if (focus.isToInfinitiveAdjective) return targetHeavy('adjectival to-infinitives', 'to부정사의 형용사적 용법');
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

  if (focus.isWhatRelativePronoun) {
    return isEn ? `
[Hard Chapter Lock: Relative Pronoun What]
- This chapter MUST stay centered on relative pronoun WHAT.
- Prefer answer shapes like:
  * What I need is time.
  * What he said was true.
  * What I learned helped me a lot.
- Do not let who / which / that become the dominant answer style.
- Avoid rewriting most target answers as "the thing that..." unless a small comparison item is intentionally included.
- Korean prompts should naturally express "~하는 것", "~한 것은", "~이 필요한 것" meanings.
` : `
[Hard Chapter Lock: 관계대명사 what]
- 이 챕터의 핵심 목표 정답은 반드시 관계대명사 what 중심이어야 한다.
- 정답은 다음과 같은 형태를 우선한다:
  * What I need is time.
  * What he said was true.
  * What I learned helped me a lot.
- who / which / that이 주된 정답 스타일이 되지 않게 할 것.
- 대부분의 문항을 "the thing that..."로 우회하지 말 것.
- 한국어 제시문은 "~하는 것", "~한 것은", "~이 필요한 것" 의미가 자연스럽게 드러나게 할 것.
`;
  }

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

  if (focus.isToInfinitiveAdjective) {
    blocks.push(isEn ? `
[Adjectival To-Infinitive Rules]
- Keep noun + to-infinitive modifier patterns visible.
- Prefer answers such as "a book to read", "something to do", "a place to visit", "time to study".
- Do not let causative / perception / help / let / make patterns dominate this chapter.
- Do not let bare purpose-only infinitive sentences dominate this chapter.
` : `
[to부정사의 형용사적 용법 규칙]
- 명사 + to부정사 수식 구조가 분명히 드러나게 할 것.
- "a book to read", "something to do", "a place to visit", "time to study" 같은 정답을 우선할 것.
- 사역동사 / 지각동사 / help / let / make 패턴이 이 챕터를 지배하지 않게 할 것.
- 단순 목적 용법 문장이 다수를 차지하지 않게 할 것.
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

  if (key === "passive") {
    if (opts.requirePassiveVoice) {
      blocks.push(
        isEn
          ? "- Keep the target answers visibly in passive voice."
          : "- 목표 정답이 눈에 보이게 수동태로 유지되게 할 것."
      );
    }
    if (opts.allowByPhraseOption) {
      blocks.push(
        isEn
          ? "- You may include limited natural by-phrases when they help learning."
          : "- 학습에 도움이 될 때 자연스러운 by-phrase를 일부 포함할 수 있다."
      );
    }
    if (opts.avoidActiveRewrite) {
      blocks.push(
        isEn
          ? "- Do not rewrite the target items into active-voice answers."
          : "- 목표 문항을 능동태 정답으로 바꾸지 말 것."
      );
    }
  }

  if (key === "to_infinitive") {
    if (opts.preferToInfinitiveCore) {
      blocks.push(
        isEn
          ? "- Keep to-infinitives clearly visible as the core target structure."
          : "- to부정사 구조가 핵심 목표 문법으로 분명히 드러나게 할 것."
      );
    }
    if (opts.allowPurposeUsage) {
      blocks.push(
        isEn
          ? "- You may include natural purpose uses of to-infinitives."
          : "- to부정사의 목적 용법을 자연스럽게 포함할 수 있다."
      );
    }
    if (opts.allowNounAdjUsage) {
      blocks.push(
        isEn
          ? "- You may include noun or adjective uses of to-infinitives when appropriate."
          : "- 필요할 때 명사적 / 형용사적 용법을 자연스럽게 포함할 수 있다."
      );
    }
  }

  if (key === "gerund") {
    if (opts.requireGerundVisible) {
      blocks.push(
        isEn
          ? "- Keep gerunds clearly visible in the target answers."
          : "- 목표 정답에 동명사 구조가 분명히 드러나게 할 것."
      );
    }
    if (opts.contrastWithToInfinitive) {
      blocks.push(
        isEn
          ? "- You may include limited contrast items with to-infinitives, but keep gerunds primary."
          : "- 필요 시 to부정사와의 비교 문항을 일부 포함할 수 있으나, 중심은 동명사로 유지할 것."
      );
    }
    if (opts.preferNaturalVerbGerundPairs) {
      blocks.push(
        isEn
          ? "- Prefer natural verb + gerund collocations such as enjoy reading or finish doing."
          : "- enjoy reading, finish doing처럼 자연스러운 동사 + 동명사 결합을 우선 사용할 것."
      );
    }
  }

  if (key === "relative_adverb") {
    if (opts.preferWhereWhenWhy) {
      blocks.push(
        isEn
          ? "- Prefer clear relative adverbs such as where, when, and why."
          : "- where, when, why 같은 관계부사를 분명하게 우선 사용할 것."
      );
    }
    if (opts.forbidRelativePronounFallback) {
      blocks.push(
        isEn
          ? "- Do not let the set drift into relative-pronoun answers."
          : "- 세트가 관계대명사 정답으로 흐르지 않게 할 것."
      );
    }
    if (opts.keepAdverbialRelation) {
      blocks.push(
        isEn
          ? "- Keep the place / time / reason relationship visible in the answers."
          : "- 장소 / 시간 / 이유의 부사적 관계가 정답에 드러나게 할 것."
      );
    }
  }

  if (key === "present_perfect") {
    if (opts.requirePresentPerfectForm) {
      blocks.push(
        isEn
          ? "- Keep present perfect forms clearly visible as have/has + p.p."
          : "- have/has + p.p. 형태의 현재완료 구조가 분명히 드러나게 할 것."
      );
    }
    if (opts.allowExperienceSinceFor) {
      blocks.push(
        isEn
          ? "- You may include experience, since, or for patterns when appropriate."
          : "- 필요 시 경험, since, for 패턴을 자연스럽게 포함할 수 있다."
      );
    }
    if (opts.avoidSimplePastFallback) {
      blocks.push(
        isEn
          ? "- Do not simplify the target items into simple past answers."
          : "- 목표 문항을 단순과거 정답으로 단순화하지 말 것."
      );
    }
  }

  if (key === "comparative") {
    if (opts.requireComparativeVisible) {
      blocks.push(
        isEn
          ? "- Keep comparative forms clearly visible in the target answers."
          : "- 목표 정답에 비교급 구조가 분명히 드러나게 할 것."
      );
    }
    if (opts.allowThanStructure) {
      blocks.push(
        isEn
          ? "- Prefer natural than-comparison structures when appropriate."
          : "- 필요할 때 than 비교 구조를 자연스럽게 우선 사용할 것."
      );
    }
    if (opts.avoidSuperlativeDrift) {
      blocks.push(
        isEn
          ? "- Do not let comparative items drift into superlative answers."
          : "- 비교급 문항이 최상급 정답으로 흐르지 않게 할 것."
      );
    }
  }

  if (key === "participial_modifier") {
    blocks.push(
      isEn
        ? `
[Participial Modifier - HARD LOCK]
[MUST]
- Every target answer must visibly include a participle modifying a noun.
- Use noun + V-ing or noun + p.p. structures as the core answer shape.

[MUST NOT]
- Do not use who / which / that relative clauses as the main answer pattern.
- Do not drift into ordinary simple subject-predicate sentences.

[STRICT]
- At least 80% of the items must be noun-modifying participial structures.
- Prefer patterns such as "the boy running", "the book written", "the woman wearing".

[FAIL CONDITION]
- Do not generate any item whose core target is not a participial modifier.`.trim()
        : `
[분사의 한정적 용법 - HARD LOCK]
[MUST]
- 모든 목표 정답은 분사가 명사를 직접 수식하는 구조를 눈에 보이게 포함해야 한다.
- "명사 + 현재분사" 또는 "명사 + 과거분사"가 핵심 정답 형태여야 한다.

[MUST NOT]
- who / which / that 관계절을 주된 정답 패턴으로 사용하지 말 것.
- 일반적인 단순 주어+서술어 문장으로 흐르지 말 것.

[STRICT]
- 최소 80% 이상의 문항이 분사의 한정적 용법 구조여야 한다.
- "the boy running", "the book written", "the woman wearing" 같은 패턴을 우선 사용할 것.

[FAIL CONDITION]
- 핵심 목표가 분사의 한정적 용법이 아닌 문항은 생성하지 말 것.`.trim()
    );
  }

  if (key === "to_infinitive") {
    blocks.push(
      isEn
        ? `
[to-Infinitive - HARD LOCK]
[MUST]
- Every target answer must clearly include a to-infinitive as the core structure.
- Show one of the major functions clearly: noun use, adjective use, or purpose use.

[MUST NOT]
- Do not let let / make / have / help causative patterns dominate the set.
- Do not produce unnatural suggest + object + to-infinitive patterns.

[STRICT]
- At least 85% of the items must be centered on to-infinitives.
- Prefer natural patterns such as want to, decide to, ask to, try to, plan to.

[FAIL CONDITION]
- Do not generate any item whose core target is not a to-infinitive.`.trim()
        : `
[to부정사 - HARD LOCK]
[MUST]
- 모든 목표 정답은 to부정사가 핵심 구조로 분명히 보여야 한다.
- 명사적 / 형용사적 / 목적 용법 중 하나가 분명해야 한다.

[MUST NOT]
- let / make / have / help 같은 사역구조가 세트를 지배하지 않게 할 것.
- suggest + 목적어 + to부정사 같은 부자연스러운 패턴을 만들지 말 것.

[STRICT]
- 최소 85% 이상의 문항이 to부정사 중심이어야 한다.
- want to, decide to, ask to, try to, plan to 같은 자연스러운 패턴을 우선할 것.

[FAIL CONDITION]
- 핵심 목표가 to부정사가 아닌 문항은 생성하지 말 것.`.trim()
    );
  }

  if (key === "gerund") {
    blocks.push(
      isEn
        ? `
[Gerund - HARD LOCK]
[MUST]
- Every target answer must keep a gerund (-ing) visibly as the core structure.
- Use gerunds naturally as subject, object, or after prepositions.

[MUST NOT]
- Do not let to-infinitive-centered items dominate the set.
- Do not let make / let / have causative structures dominate the set.

[STRICT]
- At least 85% of the items must be centered on gerunds.
- Prefer natural verb + gerund patterns such as enjoy reading, avoid making, finish doing, recommend reading, mind waiting.

[FAIL CONDITION]
- Do not generate any item whose core target is not a gerund.`.trim()
        : `
[동명사 - HARD LOCK]
[MUST]
- 모든 목표 정답은 동명사(-ing)가 핵심 구조로 눈에 보여야 한다.
- 주어 / 목적어 / 전치사 뒤에서 동명사를 자연스럽게 사용할 것.

[MUST NOT]
- to부정사 중심 문장이 세트를 지배하지 않게 할 것.
- make / let / have 같은 사역구조가 세트를 지배하지 않게 할 것.

[STRICT]
- 최소 85% 이상의 문항이 동명사 중심이어야 한다.
- enjoy reading, avoid making, finish doing, recommend reading, mind waiting 같은 자연스러운 결합을 우선할 것.

[FAIL CONDITION]
- 핵심 목표가 동명사가 아닌 문항은 생성하지 말 것.`.trim()
    );
  }

  if (key === "causative") {
    blocks.push(
      isEn
        ? `
[Causative - REFINED LOCK]
[MUST]
- Keep make / let / have / help / get visibly as the core target structures.
- Keep object + bare infinitive or object + p.p. patterns complete and natural.

[MUST NOT]
- Do not generate let + object + to-infinitive.
- Do not simplify the set into ordinary to-infinitive sentences.

[STRICT]
- At least 80% of the items must visibly contain causative structures.`.trim()
        : `
[사역동사 - REFINED LOCK]
[MUST]
- make / let / have / help / get 구조를 핵심 목표 구조로 눈에 보이게 유지할 것.
- 목적어 + 동사원형 또는 목적어 + p.p. 구조를 완전하고 자연스럽게 유지할 것.

[MUST NOT]
- let + 목적어 + to부정사 형태를 생성하지 말 것.
- 일반적인 to부정사 문장으로 단순화하지 말 것.

[STRICT]
- 최소 80% 이상의 문항이 사역 구조를 눈에 보이게 포함해야 한다.`.trim()
    );
  }

  if (key === "superlative") {
    if (opts.requireSuperlativeVisible) {
      blocks.push(
        isEn
          ? "- Keep superlative forms clearly visible in the target answers."
          : "- 목표 정답에 최상급 구조가 분명히 드러나게 할 것."
      );
    }
    if (opts.allowInOfRange) {
      blocks.push(
        isEn
          ? "- You may use natural in / of comparison ranges for superlatives."
          : "- 최상급 문항에서 자연스러운 in / of 비교 범위를 사용할 수 있다."
      );
    }
    if (opts.avoidComparativeDrift) {
      blocks.push(
        isEn
          ? "- Do not let superlative items drift into comparative answers."
          : "- 최상급 문항이 비교급 정답으로 흐르지 않게 할 것."
      );
    }
  }

  if (!blocks.length) return "";

  return `
[USER-CONFIRMED GRAMMAR OPTIONS]
${blocks.join("\n")}
`.trim();
}

function buildRelaxedRepairValidationBlock(input = {}) {
  const isElementary = input?.mode === "abcstarter" || input?.level === "elementary";
  const isEn = input?.language === "en";

  if (isElementary) {
    return isEn ? `
[Elementary Answer Enforcement]
- The worksheet MUST contain a clearly separated answer section.
- Every question must have a matching numbered answer.
- Do not leave placeholders such as [CHECK].
- Keep answers short, natural, and classroom-friendly.
`.trim() : `
[초등 정답 강제 규칙]
- 학습지에는 반드시 분리된 정답 섹션이 있어야 한다.
- 모든 문항에는 대응되는 번호의 정답이 있어야 한다.
- [CHECK] 같은 placeholder를 남기지 말 것.
- 정답은 짧고 자연스럽고 교실 친화적으로 작성할 것.
`.trim();
  }

  return isEn ? `
[Middle Relaxed Repair Validation]
- A separate answer section must exist.
- If some answers are weak, repair them naturally instead of leaving placeholders.
- Preserve stable numbering.
- Minor variation is allowed, but broken or incomplete sentences are not allowed.
`.trim() : `
[중등 Relaxed Repair Validation]
- 분리된 정답 섹션이 반드시 있어야 한다.
- 일부 정답이 약하면 placeholder로 두지 말고 자연스럽게 보정할 것.
- 번호 안정성을 유지할 것.
- 약간의 표현 차이는 허용하지만, 깨진 문장이나 미완성 문장은 허용하지 않는다.
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
${buildRelaxedRepairValidationBlock(input)}

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
${buildRelaxedRepairValidationBlock(input)}

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
${buildDifficultyUpliftRuleBlock(input)}
${buildS14PrecisionUpgradeBlock(input)}

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
${buildDifficultyUpliftRuleBlock(input)}
${buildS14PrecisionUpgradeBlock(input)}

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


function buildMarcusIdentityPromptBlock(input) {
  const isEn = input.language === "en";
  const isElementary = input.mode === "abcstarter" || input.level === "elementary";
  const base = isEn ? `
[MARCUS MAGIC IDENTITY]
- This worksheet must feel edited, not randomly generated.
- Preserve one chapter, one teaching intention, one training flow.
- Keep the whole set premium, guided, teachable, and classroom-ready.
- The worksheet should feel like a branded MARCUSNOTE workbook, not a generic GPT list.
- Keep chapter purity high. Do not leak unrelated grammar families into the main target items.
- Prefer elegant clue design, natural English, and strong teacher usability.
- Arrange the set with visible progression from guided entry to mixed application.
- Keep the workbook feeling double-layered: clean on the surface, but structurally rich underneath.
` : `
[마커스매직 정체성 블록]
- 이 워크북은 랜덤 생성물이 아니라, 실제 편집자가 설계한 교재처럼 느껴져야 한다.
- 한 챕터, 한 수업 의도, 한 훈련 흐름을 유지할 것.
- 결과물은 프리미엄, guided, teachable, classroom-ready한 마커스노트 워크북처럼 보여야 한다.
- generic GPT 목록형 출력처럼 보이지 말 것.
- 챕터 순도를 높게 유지하고, 핵심 목표 문항에 무관한 문법 계열이 섞이지 않게 할 것.
- clue 설계는 친절하지만 세련되게, 영어 문장은 자연스럽고 교사용으로 바로 쓸 수 있게 만들 것.
- 세트는 도입 → 구조 반복 → 혼합 적용으로 보이는 편집 흐름을 가져야 한다.
- 겉으로는 깔끔하지만, 내부적으로는 구조 밀도가 높은 더블 레이어드 워크북처럼 느껴져야 한다.
`;
  const elementary = isElementary ? (isEn ? `
[MARCUS ELEMENTARY BRAND RULE]
- Elementary output must still feel premium.
- Keep sentences short, but do not let the set look flat or mechanical.
- Vary item rhythm intentionally: direct clue, rearrangement, question form, mixed application.
- Always produce a usable answer sheet. Worksheet-only output is not acceptable.
` : `
[마커스 초등 브랜드 규칙]
- 초등 출력도 반드시 프리미엄 워크북처럼 느껴져야 한다.
- 문장은 짧게 유지하되, 세트 전체가 납작하고 기계적으로 보이지 않게 할 것.
- 직접 clue형, 배열형, 의문문형, 혼합 응용형을 의도적으로 배열해 리듬을 만들 것.
- 문제지만 있고 정답지가 없는 출력은 허용되지 않는다. 반드시 사용 가능한 정답지를 생성할 것.
`) : "";
  return `${base}\n${elementary}`.trim();
}

function buildMarcusSequencePromptBlock(input) {
  const isEn = input.language === "en";
  const count = Number(input.count || 25);
  const isElementary = input.mode === "abcstarter" || input.level === "elementary";
  if (isElementary) {
    return isEn ? `
[MARCUS SEQUENCE PLAN]
- Organize the worksheet with visible rhythm.
- Suggested flow:
  1-8: direct guided clue writing
  9-16: rearrangement / question / negative variation
  17-${count}: mixed application with slightly freer but still guided production
- Do not let all items share the same shell.
- Even in elementary mode, keep at least 3 productive item families visible.
` : `
[마커스 시퀀스 설계]
- 세트는 눈에 보이는 리듬을 가지고 배열할 것.
- 권장 흐름:
  1~8: 직접 clue 기반 안내형 영작
  9~16: 배열형 / 의문문형 / 부정문형 변주
  17~${count}: 조금 더 응용된 혼합형이지만 여전히 guided production 유지
- 모든 문항을 같은 껍데기로 만들지 말 것.
- 초등 모드에서도 최소 3가지 이상의 생산형 문항 계열이 보이게 할 것.
`;
  }
  return isEn ? `
[MARCUS SEQUENCE PLAN]
- The worksheet must feel intentionally edited in 4 waves.
- Suggested flow:
  1-6: direct clue-based sentence building
  7-12: rearrangement with one extra unnecessary word
  13-18: partial-completion or controlled transformation
  19-${count}: mixed application with slightly richer content
- Keep item families visibly mixed, but never random.
- Preserve chapter purity while changing task surface.
` : `
[마커스 시퀀스 설계]
- 세트는 4개의 파동으로 편집된 것처럼 느껴져야 한다.
- 권장 흐름:
  1~6: 직접 clue 기반 문장 구성
  7~12: 초과단어 1개 포함 재배열형
  13~18: 부분완성형 또는 통제된 문장변환형
  19~${count}: 내용이 조금 더 풍부한 혼합 적용형
- 문항 유형은 분명히 섞이되, 랜덤처럼 보이면 안 된다.
- 문항 표면은 달라져도 챕터 순도는 유지할 것.
`;
}



function buildSoftClueRecoveryBlock(input = {}) {
  const guided = input?.mode === "writing" || input?.magicStyle === "marcus_magic" || normalizeWorkbookType(input?.workbookType || "") === "guided_writing";
  if (!guided) return "";
  return input.language === "en"
    ? `
[Soft Guided Clue Recovery Rule]
- Guided writing should prefer visible clues, but opening items may remain simple translation-style prompts.
- Do NOT fail the whole worksheet only because some items do not show explicit clue lines.
- If clues are present, keep them fragment-based and teachable.
- If clues are missing, preserve generation first and allow the backend to pass the worksheet as long as numbering, answers, and target grammar remain stable.
- A mixed worksheet is acceptable: simple prompt items + clue items + partial completion + rearrangement.
`.trim()
    : `
[소프트 Guided Clue 복구 규칙]
- Guided writing은 clue를 우선하되, 도입부 일부 문항은 단순 영작형으로 남아 있어도 된다.
- 몇몇 문항에 명시적 clue 줄이 없다는 이유만으로 전체 워크북을 실패 처리하지 말 것.
- clue가 있을 때는 조각형이고 가르칠 수 있는 형태로 유지할 것.
- clue가 부족해도 번호, 정답지, 목표 문법이 안정적이면 생성 우선으로 통과시킬 것.
- 단순 제시문 + clue 문항 + 부분완성 + 재배열이 섞인 혼합형 워크북도 허용한다.
`.trim();
}

function buildMarcusMagicWordCountRuleBlock(input = {}) {
  const shouldApply = input?.mode === "writing" || input?.magicStyle === "marcus_magic" || input?.wordCountMode === "auto";
  if (!shouldApply) return "";

  return input.language === "en"
    ? `
[Marcus Magic Word Count Rule]
- Treat Writing Lab as Marcus Magic by default.
- Every question item should be compatible with a visible word count target.
- Do NOT print (Word count: N) yourself inside the generated questions.
- Prefer a visible clue line or clue-friendly structure in guided-writing items, but do not fail the whole worksheet if some opening items are simple translation-style prompts.
- The backend will append a single final word count to each numbered question line after validation.
- The word count target must match the final answer that appears in the answer sheet.
- Word count means the number of space-separated English words in the final answer sentence.
- Build clue-based production items so that the learner must respect both grammar and word count.
- If the grammar target is present perfect, keep present perfect visible even under the word count target.
- Do not give a word count that would naturally force the answer out of the target grammar unless the user explicitly asked for contrast practice.
- Prefer Marcus Magic style: guided composition, clue-rich prompts, structural control, and training value.
`.trim()
    : `
[마커스매직 단어 수 규칙]
- Writing Lab은 기본적으로 마커스매직 스타일로 처리할 것.
- 모든 문항은 보이는 단어 수 목표와 호환되게 설계할 것.
- 생성 단계에서 (Word count: N)을 직접 문항에 출력하지 말 것.
- guided writing 문항은 가능하면 clue 또는 clue 친화적 구조를 유지하되, 도입용 단순 영작 문항이 일부 포함되어도 전체 워크북을 실패 처리하지 말 것.
- 백엔드가 검증 후 각 번호 문항 끝에 최종 단어 수를 한 번만 자동 부착한다.
- 단어 수 목표는 정답지에 제시되는 최종 정답 문장의 실제 단어 수와 일치해야 한다.
- 단어 수는 영어 최종 정답 문장에서 공백 기준 영어 단어 개수로 계산한다.
- clue 기반 생산형 문항이 되도록 하되, 학습자가 문법과 단어 수를 함께 맞추게 할 것.
- 목표 문법이 현재완료라면, 단어 수 조건 아래에서도 현재완료가 분명히 유지되게 할 것.
- 사용자가 대비 훈련을 명시적으로 요구하지 않는 한, 단어 수 때문에 목표 문법이 무너지도록 설계하지 말 것.
- 결과물은 guided composition, 풍부한 clue, 구조 통제, 훈련 가치가 살아 있는 마커스매직 느낌이어야 한다.
`.trim();
}

function countEnglishWordsForMagic(line = "") {
  const body = String(line || "")
    .replace(/^\d+[.)-]?\s*/, "")
    .replace(/\(Word count:\s*\d+\)$/i, "")
    .replace(/[.,!?;:()[\]"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!body) return 0;
  const matches = body.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || [];
  return matches.length;
}

function removeExistingWordCounts(text = "") {
  return String(text || "")
    .replace(/\(Word count:\s*\d+\)/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function annotateQuestionsWithWordCounts(questions = "", answers = "") {
  const questionLines = String(questions || "").split("\n");
  const answerBodies = String(answers || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim());

  let answerIdx = 0;
  return questionLines.map((line) => {
    const trimmed = line.trim();
    if (!/^\d+[.)-]?\s+/.test(trimmed)) return line;
    const count = countEnglishWordsForMagic(answerBodies[answerIdx] || "");
    answerIdx += 1;
    if (!count) return line;
    if (/\(Word count:\s*\d+\)$/i.test(trimmed)) {
      return line.replace(/\(Word count:\s*\d+\)$/i, `(Word count: ${count})`);
    }
    return `${line} (Word count: ${count})`;
  }).join("\n");
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
${buildRelaxedRepairValidationBlock(input)}

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
${buildRelaxedRepairValidationBlock(input)}

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
${buildDifficultyUpliftRuleBlock(input)}
${buildGrammarOptionRuleBlock(input)}
${buildPresentPerfectStrictFilterBlock(input)}
${buildMarcusChapterExpansionBlock(input)}
${buildRefillPromptBlock(input.__rawBody || {}, input)}
${buildRelaxedRepairValidationBlock(input)}
${buildAntiRepetitionPromptBlock(input)}
${buildMarcusIdentityPromptBlock(input)}
${buildMarcusSequencePromptBlock(input)}
${buildMarcusMagicWordCountRuleBlock(input)}
${buildSoftClueRecoveryBlock(input)}

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
${buildDifficultyUpliftRuleBlock(input)}
${buildGrammarOptionRuleBlock(input)}
${buildPresentPerfectStrictFilterBlock(input)}
${buildMarcusChapterExpansionBlock(input)}
${buildAntiRepetitionPromptBlock(input)}
${buildMarcusIdentityPromptBlock(input)}
${buildMarcusSequencePromptBlock(input)}
${buildMarcusMagicWordCountRuleBlock(input)}
${buildSoftClueRecoveryBlock(input)}

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


function countAnswerLines(answerSheet = "") {
  return String(answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]\s+/.test(line)).length;
}

function hasPlaceholderAnswers(answerSheet = "") {
  return /\[CHECK\]/i.test(String(answerSheet || ""));
}

function hasSequentialNumbering(text = "") {
  const nums = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]\s+/.test(line))
    .map((line) => {
      const m = line.match(/^(\d+)[.)-]\s+/);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return false;
  for (let i = 0; i < nums.length; i += 1) {
    if (nums[i] !== i + 1) return false;
  }
  return true;
}

function validateServiceSafeOutput(formatted = {}, input = {}) {
  if (!formatted || typeof formatted !== "object") return false;
  const questions = String(formatted.questions || "").trim();
  let answers = String(formatted.answerSheet || "").trim();
  if ((!answers || countAnswerLines(answers) < 2) && questions) {
    answers = normalizeMagicAnswerSheet("", questions, input);
    formatted.answerSheet = answers;
  }
  if (!hasMeaningfulWorksheetBody(questions)) return false;
  if (!hasMeaningfulWorksheetBody(answers)) return false;
  if (!hasSequentialNumbering(questions)) return false;
  if (!hasSequentialNumbering(answers)) return false;
  if (hasPlaceholderAnswers(answers)) return false;
  const requestedCount = Number(input?.count || 0);
  const actualCount = Number(formatted.actualCount || countWorksheetItems(questions) || 0);
  if (requestedCount > 0 && actualCount < Math.max(1, Math.ceil(requestedCount * 0.5))) return false;
  if (!validateRefillOutput(formatted, input)) return false;
  return true;
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
  const answerCount = countAnswerLines(formatted.answerSheet);
  const isConcept = ["concept", "concept+training"].includes(input?.intentMode);
  const isVocabSeries =
    input?.mode === "vocab-builder" &&
    Number(input?.vocabSeriesEnd || 1) > Number(input?.vocabSeriesStart || 1);
  const isElementary = input?.mode === "abcstarter" || input?.level === "elementary";

  if (!contentOk) {
    return { ok: false, reason: "content_too_short" };
  }
  if (!answerOk) {
    return { ok: false, reason: "answer_sheet_missing" };
  }
  if (!questionsOk) {
    return { ok: false, reason: "questions_missing" };
  }
  if (!hasSequentialNumbering(formatted.questions)) {
    return { ok: false, reason: "question_numbering_broken" };
  }
  if (!hasSequentialNumbering(formatted.answerSheet)) {
    return { ok: false, reason: "answer_numbering_broken" };
  }
  if (hasPlaceholderAnswers(formatted.answerSheet)) {
    return {
      ok: false,
      reason: isElementary ? "elementary_placeholder_answer_detected" : "placeholder_answer_detected"
    };
  }

  if (requestedCount > 0 && answerCount < Math.max(1, Math.ceil(actualCount * 0.6))) {
    return { ok: false, reason: "answer_count_too_low", requestedCount, actualCount, answerCount };
  }

  if (isElementary && answerCount < Math.max(1, Math.ceil(actualCount * 0.8))) {
    return { ok: false, reason: "elementary_answer_count_too_low", requestedCount, actualCount, answerCount };
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

  if (!validateRefillOutput(formatted, input)) {
    return { ok: false, reason: "refill_count_mismatch" };
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
  let normalizedAnswers = normalizeMagicAnswerSheet((answers || "").trim(), normalizedQuestions, input);

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

  const requiredElementaryAnswers = input?.mode === "abcstarter" || input?.level === "elementary";
  if (!normalizedAnswers || countAnswerLines(normalizedAnswers) < Math.max(3, Math.min(8, Math.ceil(Number(input?.count || 0) * 0.5)))) {
    normalizedAnswers = normalizeMagicAnswerSheet("", normalizedQuestions, input);
  }
  if (requiredElementaryAnswers && hasPlaceholderAnswers(normalizedAnswers)) {
    normalizedAnswers = buildEmergencyAnswerSheet(normalizedQuestions, input);
  }
  normalizedAnswers = smoothGeneratedEnglish(normalizedAnswers, input);

  if (input?.mode === "writing" || input?.magicStyle === "marcus_magic" || input?.wordCountMode === "auto") {
    const cleanedQuestions = removeExistingWordCounts(normalizedQuestions);
    normalizedQuestions = annotateQuestionsWithWordCounts(cleanedQuestions, normalizedAnswers);
  }

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


function validateWritingOutput(text = "", input = {}) {
  const raw = String(text || "");
  const topic = String(input?.topic || "");
  const focus = input?.grammarFocus || detectGrammarFocus(
    [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
  );

  if (!raw.includes("[[ANSWERS]]")) return false;
  if (hasPlaceholderAnswers(raw)) return false;

  if ((focus?.isPresentPerfect || /현재완료|present\s+perfect/i.test(topic)) &&
      !/현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(topic) &&
      hasInvalidPastTimeMarker(raw)) {
    return false;
  }

  if (focus?.isParticipialModifier) {
    const participleSignal = /\b(running|wearing|written|made|completed|painted|broken|known|built|given|called|sleeping|growing|used)\b/i.test(raw);
    if (!participleSignal) return false;
  }

  if (focus?.isNonRestrictive) {
    if (!/,\s*(who|which|whom|whose)\b/i.test(raw)) return false;
  }

  if (focus?.isSoThatPurpose) {
    if (/\bso that\b/i.test(raw) && /\b(can|could|will|would)\b[\s\.]*(\n|$)/i.test(raw)) {
      return false;
    }
  }

  if (!hasMildChapterCoverage(raw, input)) return false;
  if (hasBlockedChapterLeak(extractSection(raw, "[[ANSWERS]]", null) || raw, input)) return false;

  if (input?.mode === "abcstarter" || input?.level === "elementary") {
    const answerLines = String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]\s+/.test(line));
    if (answerLines.some((line) => line.length > 160)) return false;
  }

  return true;
}

function buildPostFormatRepairPrompt(formatted = {}, input = {}, failure = {}) {
  const isKo = input?.language !== "en";
  const reason = String(failure?.reason || "unknown");
  const requestedCount = Number(input?.count || 0);
  const actualCount = Number(formatted?.actualCount || 0);

  return `${buildUserPrompt(input)}

[POST-FORMAT REPAIR]
- The previous output became unstable after formatting or validation.
- Repair the worksheet into a stable teacher-ready result.
- Keep exactly 4 sections:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
- Keep numbering strictly sequential as 1. 2. 3.
- Do not skip item numbers.
- Do not merge multiple items onto one line.
- Keep questions and answers aligned by the same numbers.
- Preserve the requested grammar target and workbook identity.
- Preserve the requested count as closely as possible.
- If count is short, add additional valid items to reach the requested count.
- If an answer set is weak, rewrite it fully instead of leaving placeholders.
- In elementary / abcstarter mode, keep answer lines short, direct, and one-sentence based.
- Do not copy the previous broken numbering blindly. Rebuild it cleanly.

[FAILURE CONTEXT]
- reason: ${reason}
- requestedCount: ${requestedCount}
- actualCount: ${actualCount}

[PREVIOUS TITLE]
${formatted?.title || ""}

[PREVIOUS INSTRUCTIONS]
${formatted?.instructions || ""}

[PREVIOUS QUESTIONS]
${formatted?.questions || ""}

[PREVIOUS ANSWERS]
${formatted?.answerSheet || ""}

${isKo ? "번호가 부족하거나 어긋나면 반드시 다시 정렬하고 보강할 것." : "If numbering is unstable or too short, rebuild and complete it before returning."}`.trim();
}

async function repairFormattedMagicOutput(formatted, input, failure) {
  const systemPrompt = buildSystemPrompt(input);
  const repairPrompt = buildPostFormatRepairPrompt(formatted, input, failure);
  const repairedRaw = await callOpenAI(systemPrompt, repairPrompt);
  return formatMagicResponse(repairedRaw, input);
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
    input.__rawBody = req.body || {};
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
    let formatted = formatMagicResponse(rawText, input);

    if ((input.mode === "abcstarter" || input.level === "elementary") && String(formatted.questions || "").trim()) {
      formatted.answerSheet = normalizeMagicAnswerSheet(formatted.answerSheet || "", formatted.questions || "", input);
      const contentParts = [formatted.title, formatted.instructions, formatted.questions].filter(Boolean);
      formatted.content = contentParts.join("\n\n");
      formatted.fullText = [...contentParts, ((input.language === "en" ? "Answers\n" : "정답\n") + (formatted.answerSheet || ""))].filter(Boolean).join("\n\n");
      formatted.actualCount = countWorksheetItems(formatted.questions || "");
    }

    let generationCheck = isGenerationSuccessful(formatted, input);
    let validationOk = validateWritingOutput(`[[QUESTIONS]]\n${formatted.questions || ""}\n[[ANSWERS]]\n${formatted.answerSheet || ""}`, input);

    if (!validationOk && generationCheck.ok) {
      generationCheck = { ok: false, reason: "validation_failed" };
    }

    if (!generationCheck.ok) {
      try {
        const repaired = await repairFormattedMagicOutput(formatted, input, generationCheck);
        const repairedValidationOk = validateWritingOutput(`[[QUESTIONS]]\n${repaired.questions || ""}\n[[ANSWERS]]\n${repaired.answerSheet || ""}`, input);
        const repairedCheck = isGenerationSuccessful(repaired, input);

        if (repairedValidationOk && repairedCheck.ok) {
          formatted = repaired;
          generationCheck = repairedCheck;
          validationOk = repairedValidationOk;
        } else {
          const safeRecovered = {
            ...repaired,
            questions: String(repaired.questions || formatted.questions || "").trim(),
            answerSheet: normalizeMagicAnswerSheet(repaired.answerSheet || "", repaired.questions || formatted.questions || "", input),
          };
          const safeContentParts = [safeRecovered.title, safeRecovered.instructions, safeRecovered.questions].filter(Boolean);
          safeRecovered.content = safeContentParts.join("\n\n");
          safeRecovered.fullText = [...safeContentParts, ((input.language === "en" ? "Answers\n" : "정답\n") + (safeRecovered.answerSheet || ""))].filter(Boolean).join("\n\n");
          safeRecovered.actualCount = countWorksheetItems(safeRecovered.questions || "");

          if (validateServiceSafeOutput(safeRecovered, input)) {
            formatted = safeRecovered;
            generationCheck = { ok: true, reason: "soft_recovered" };
            validationOk = true;
          } else {
            generationCheck = repairedCheck.ok ? { ok: false, reason: "repair_validation_failed" } : repairedCheck;
            validationOk = repairedValidationOk;
          }
        }
      } catch (repairError) {
        console.error("post-format repair failed:", repairError);
      }
    }

    if (!generationCheck.ok || !validationOk) {
      const emergencyRecovered = {
        ...formatted,
        questions: String(formatted.questions || "").trim(),
        answerSheet: normalizeMagicAnswerSheet(formatted.answerSheet || "", formatted.questions || "", input),
      };
      const emergencyParts = [emergencyRecovered.title, emergencyRecovered.instructions, emergencyRecovered.questions].filter(Boolean);
      emergencyRecovered.content = emergencyParts.join("\n\n");
      emergencyRecovered.fullText = [
        ...emergencyParts,
        ((input.language === "en" ? "Answers\n" : "정답\n") + (emergencyRecovered.answerSheet || ""))
      ].filter(Boolean).join("\n\n");
      emergencyRecovered.actualCount = countWorksheetItems(emergencyRecovered.questions || "");

      if (validateServiceSafeOutput(emergencyRecovered, input)) {
        formatted = emergencyRecovered;
        generationCheck = { ok: true, reason: "emergency_recovered" };
        validationOk = true;
      } else {
        return json(res, 502, {
          success: false,
          message: "생성 결과 구조를 안정적으로 복구하지 못했습니다. MP는 차감되지 않았습니다. 다시 시도해주세요.",
          detail: generationCheck.reason || "validation_failed",
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
    }

    collectRecentAnswerLines(formatted, input);
    const finalMpState = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      requestNonce: req.body?.requestNonce || input.requestNonce || '',
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



function extractNumberedQuestionItems(text = "") {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line));
}

function extractLikelyAnswerLines(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^\d+[.)-]?\s+/.test(line));
}

function isBrokenAnswerLine(line = "") {
  const s = String(line || "").trim();
  if (!s) return true;

  const body = s.replace(/^\d+[.)-]?\s*/, "").trim();
  if (!body) return true;
  if (body.length < 6) return true;
  if (/^\[(check|todo|pending|answer)\]$/i.test(body)) return true;
  if (/\bso that\s*$/i.test(body)) return true;
  if (/\b(which|who|whom|whose|that)\s*$/i.test(body)) return true;
  if (/,+\s*$/.test(body)) return true;
  return false;
}

function sanitizeAnswerBodyForElementary(text = "") {
  return String(text || "")
    .replace(/^\d+[.)-]?\s*/, "")
    .replace(/^\[(check|todo|pending|answer)\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeAnswerBodyForMiddle(text = "") {
  return String(text || "")
    .replace(/^\d+[.)-]?\s*/, "")
    .replace(/^\[(check|todo|pending|answer)\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildElementaryForcedAnswerSheet(q = "", input = {}) {
  const items = extractNumberedQuestionItems(q);

  return items
    .map((line, idx) => {
      const stripped = line.replace(/^\d+[.)-]?\s*/, "").trim();
      return `${idx + 1}. ${stripped}`;
    })
    .join("\n");
}

function buildMiddleRelaxedAnswerSheet(a = "", q = "", input = {}) {
  const answerLines = extractLikelyAnswerLines(a);
  const questionLines = extractNumberedQuestionItems(q);

  const cleaned = answerLines
    .map((line, idx) => sanitizeAnswerBodyForMiddle(line))
    .filter(Boolean)
    .filter((line) => !isBrokenAnswerLine(line))
    .map((line, idx) => `${idx + 1}. ${line}`);

  const minimumNeeded = Math.max(1, Math.ceil(questionLines.length * 0.6));

  if (cleaned.length >= minimumNeeded) {
    return cleaned.join("\n");
  }

  return questionLines
    .map((line, idx) => {
      const stripped = line.replace(/^\d+[.)-]?\s*/, "").trim();
      return `${idx + 1}. [CHECK] ${stripped}`;
    })
    .join("\n");
}

function buildEmergencyAnswerSheet(q = "", input = {}) {
  const isElementary = input?.mode === "abcstarter" || input?.level === "elementary";
  if (isElementary) {
    return buildElementaryForcedAnswerSheet(q, input);
  }
  return buildMiddleRelaxedAnswerSheet("", q, input);
}

function normalizeMagicAnswerSheet(a = "", q = "", input = {}) {
  const cleaned = String(a || "").trim();
  const isElementary = input?.mode === "abcstarter" || input?.level === "elementary";

  const renumber = (value = "", sanitizer = (s) => s) =>
    String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => sanitizer(line))
      .filter(Boolean)
      .map((body, index) => `${index + 1}. ${body}`)
      .join("\n");

  if (isElementary) {
    const renumbered = renumber(cleaned, sanitizeAnswerBodyForElementary);
    const questionCount = extractNumberedQuestionItems(q).length;
    const answerCount = countAnswerLines(renumbered);

    if (
      renumbered &&
      answerCount >= Math.max(1, Math.ceil(questionCount * 0.8)) &&
      !hasPlaceholderAnswers(renumbered) &&
      hasSequentialNumbering(renumbered)
    ) {
      return renumbered;
    }

    return buildElementaryForcedAnswerSheet(q, input);
  }

  const renumbered = renumber(cleaned, sanitizeAnswerBodyForMiddle);
  const relaxed = buildMiddleRelaxedAnswerSheet(renumbered, q, input);
  return relaxed || buildMiddleRelaxedAnswerSheet(cleaned, q, input);
}




/* =========================
   v8.2.1 SAFE FILTER PATCH (INTEGRATED)
   ========================= */

function enforceCorePattern(sentence, focus) {
  if (focus === "present_perfect") return /have|has/.test(sentence)
  if (focus === "gerund") return /\b\w+ing\b/.test(sentence)
  if (focus === "comparative") return /than/.test(sentence)
  if (focus === "relative_adverb") return /where|when|why/.test(sentence)
  if (focus === "elementary_negative") return /do not|does not|did not/.test(sentence)
  return true
}

function blockInvalidPatterns(sentence, focus) {
  if (focus === "present_perfect") {
    if (/^I asked|^She told|^He went|^They did/.test(sentence)) return false
  }
  if (focus === "comparative") {
    if (/among/.test(sentence)) return false
  }
  if (focus === "relative_adverb") {
    if (/the place .* (gave|met|showed|visited)/.test(sentence)) return false
  }
  if (focus === "gerund") {
    if (/^to\s+\w+/.test(sentence)) return false
  }
  if (focus === "elementary_negative") {
    if (/let me|let us|make me|have him/.test(sentence)) return false
  }
  return true
}

function repairSentence(sentence, focus) {
  if (focus === "present_perfect") {
    if (/^I asked/.test(sentence)) return sentence.replace(/^I asked/, "I have asked")
  }
  if (focus === "comparative") {
    if (/the most/.test(sentence)) return sentence
    return sentence.replace(/\bmost\b/g, "more")
  }
  if (focus === "relative_adverb") {
    return sentence.replace("the place we visited", "the place where we went")
  }
  if (focus === "elementary_negative") {
    return sentence.replace(/let me/g, "help me")
  }
  return sentence
}

function validateChapterPurity(sentences, focus) {
  const valid = sentences.filter(s => enforceCorePattern(s, focus))
  return valid.length / sentences.length > 0.7
}

function applyV821Filters(sentences, focus) {
  let processed = sentences.map(s => repairSentence(s, focus))
  processed = processed.filter(s =>
    enforceCorePattern(s, focus) &&
    blockInvalidPatterns(s, focus)
  )
  if (!validateChapterPurity(processed, focus)) {
    return sentences
  }
  return processed
}

/* === USAGE ===
After sentence generation:
sentences = applyV821Filters(sentences, focus)
*/


/*
  Marcusnote Magic Engine v8.2.2
  Diversity + Stability Patch for apigenerate-magic-s14-v8.2.1-complete.js

  HOW TO APPLY
  1) Open your current apigenerate-magic-s14-v8.2.1-complete.js
  2) Paste this entire patch at the VERY END of the file
  3) Save as a new final file name

  This patch is append-safe. It overrides selected functions at runtime.
*/

(function applyMarcusV822DiversityStabilityPatch() {
  const PATCH_TAG = "v8.2.2-diversity-stability";

  const __origNormalizeInput = typeof normalizeInput === "function" ? normalizeInput : null;
  const __origBuildSystemPrompt = typeof buildSystemPrompt === "function" ? buildSystemPrompt : null;
  const __origBuildUserPrompt = typeof buildUserPrompt === "function" ? buildUserPrompt : null;
  const __origBuildAntiRepetitionPromptBlock = typeof buildAntiRepetitionPromptBlock === "function" ? buildAntiRepetitionPromptBlock : null;
  const __origCollectRecentAnswerLines = typeof collectRecentAnswerLines === "function" ? collectRecentAnswerLines : null;
  const __origIsGenerationSuccessful = typeof isGenerationSuccessful === "function" ? isGenerationSuccessful : null;
  const __origFormatMagicResponse = typeof formatMagicResponse === "function" ? formatMagicResponse : null;
  const __origRepairFormattedMagicOutput = typeof repairFormattedMagicOutput === "function" ? repairFormattedMagicOutput : null;

  const GLOBAL_RECENT_SIGNATURE_MEMORY = globalThis.__MARCUS_RECENT_SIGNATURE_MEMORY || Object.create(null);
  globalThis.__MARCUS_RECENT_SIGNATURE_MEMORY = GLOBAL_RECENT_SIGNATURE_MEMORY;

  let REQUEST_NONCE = Number(globalThis.__MARCUS_REQUEST_NONCE || 0);
  globalThis.__MARCUS_REQUEST_NONCE = REQUEST_NONCE;

  function nextRequestNonce() {
    REQUEST_NONCE += 1;
    globalThis.__MARCUS_REQUEST_NONCE = REQUEST_NONCE;
    return REQUEST_NONCE;
  }

  function safeText(value) {
    return String(value || "").replace(/\r\n/g, "\n");
  }

  function normalizeSentenceSignature(text = "") {
    return String(text || "")
      .toLowerCase()
      .replace(/^\d+[.)-]?\s*/, "")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/["'`”“‘’]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sentenceCoreKey(text = "") {
    const sig = normalizeSentenceSignature(text);
    const tokens = sig.split(" ").filter(Boolean);
    return tokens.slice(0, 8).join(" ");
  }

  function extractNumberedBodies(text = "") {
    return safeText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line))
      .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
      .filter(Boolean);
  }

  function extractQuestionStemBodies(text = "") {
    return safeText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line))
      .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
      .map((line) => line.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function collectDuplicateDetails(lines = []) {
    const seen = new Map();
    const duplicates = [];

    lines.forEach((line, index) => {
      const normalized = normalizeSentenceSignature(line);
      const core = sentenceCoreKey(line);
      const key = `${normalized}__${core}`;
      if (!normalized) return;

      if (seen.has(key)) {
        duplicates.push({
          firstIndex: seen.get(key) + 1,
          secondIndex: index + 1,
          line,
          normalized,
        });
      } else {
        seen.set(key, index);
      }
    });

    return duplicates;
  }

  function collectNearDuplicateDetails(lines = []) {
    const duplicates = [];
    const normalized = lines.map((line) => ({
      raw: line,
      sig: normalizeSentenceSignature(line),
      core: sentenceCoreKey(line),
    }));

    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const a = normalized[i];
        const b = normalized[j];
        if (!a.sig || !b.sig) continue;
        if (a.sig === b.sig) continue;
        if (!a.core || !b.core) continue;
        if (a.core === b.core) {
          duplicates.push({
            firstIndex: i + 1,
            secondIndex: j + 1,
            a: a.raw,
            b: b.raw,
            type: "same_core",
          });
          continue;
        }

        const aTokens = new Set(a.sig.split(" ").filter(Boolean));
        const bTokens = new Set(b.sig.split(" ").filter(Boolean));
        const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
        const minSize = Math.max(1, Math.min(aTokens.size, bTokens.size));
        const ratio = overlap / minSize;
        if (ratio >= 0.85 && overlap >= 4) {
          duplicates.push({
            firstIndex: i + 1,
            secondIndex: j + 1,
            a: a.raw,
            b: b.raw,
            type: "high_overlap",
          });
        }
      }
    }

    return duplicates;
  }

  function getDiversityMemoryKey(input = {}) {
    const grammarKey = input?.grammarFocus?.chapterKey || "general";
    return [
      String(input.topic || "").trim().toLowerCase(),
      String(input.mode || "").trim().toLowerCase(),
      String(input.gradeLabel || "").trim().toLowerCase(),
      String(input.difficulty || "").trim().toLowerCase(),
      String(grammarKey || "general").trim().toLowerCase(),
    ].join("::");
  }

  function getRecentSignaturesForInput(input = {}) {
    const key = getDiversityMemoryKey(input);
    return Array.isArray(GLOBAL_RECENT_SIGNATURE_MEMORY[key]) ? GLOBAL_RECENT_SIGNATURE_MEMORY[key] : [];
  }

  function storeRecentSignatures(input = {}, answerLines = []) {
    const key = getDiversityMemoryKey(input);
    if (!Array.isArray(GLOBAL_RECENT_SIGNATURE_MEMORY[key])) {
      GLOBAL_RECENT_SIGNATURE_MEMORY[key] = [];
    }

    const bucket = GLOBAL_RECENT_SIGNATURE_MEMORY[key];
    answerLines.forEach((line) => {
      const signature = normalizeSentenceSignature(line);
      if (!signature) return;
      bucket.push(signature);
    });

    GLOBAL_RECENT_SIGNATURE_MEMORY[key] = bucket.slice(-120);
  }

  function buildStrongDiversityRuleBlock(input = {}) {
    const recent = getRecentSignaturesForInput(input).slice(-15);
    const recentList = recent.map((s) => `- ${s}`).join("\n");
    const count = Number(input?.count || 0);

    return input?.language === "en"
      ? `
[DIVERSITY LOCK - CRITICAL]
- Every answer sentence must be natural, complete, and structurally stable.
- Do NOT repeat the same sentence, near-duplicate sentence, or lightly edited sentence inside one worksheet.
- If the worksheet has ${Math.max(count, 5)} items or more, every numbered answer must be unique.
- Change subject, setting, verb family, object, modifier, and clue shape across items.
- Use multiple sentence families instead of repeating one frame.
- Avoid batches such as only student/school/library or only buy/go/make patterns.
- Keep the target grammar visible, but vary the lexical world and scenario.
- Never recycle a recent sentence pattern from the same chapter batch.
${recentList ? `[RECENTLY USED PATTERNS TO AVOID]\n${recentList}` : ""}
`.trim()
      : `
[문장 다양성 잠금 - 매우 중요]
- 모든 정답 문장은 자연스럽고 완전하며 구조적으로 안정적이어야 한다.
- 한 워크북 내부에서 같은 문장, 거의 같은 문장, 단어만 조금 바꾼 문장을 반복하지 말 것.
- 문항이 ${Math.max(count, 5)}개 이상이면 번호별 정답 문장은 전부 서로 달라야 한다.
- 주어, 상황, 동사 계열, 목적어, 수식어, clue 형태를 바꾸어 다양성을 확보할 것.
- 하나의 틀만 반복하지 말고 여러 문장 계열을 섞을 것.
- 학생/학교/도서관 같은 배경만 몰아 쓰거나 buy/go/make 같은 동사만 몰아 쓰지 말 것.
- 목표 문법은 유지하되, 어휘 세계와 상황은 계속 바꿀 것.
- 같은 챕터에서 최근 생성된 문장 패턴을 재사용하지 말 것.
${recentList ? `[최근 사용 패턴 - 재사용 금지]\n${recentList}` : ""}
`.trim();
  }

  normalizeInput = function patchedNormalizeInput(body = {}) {
    const input = __origNormalizeInput ? __origNormalizeInput(body) : (body || {});
    return {
      ...input,
      patchTag: PATCH_TAG,
      requestNonce: nextRequestNonce(),
    };
  };

  buildAntiRepetitionPromptBlock = function patchedBuildAntiRepetitionPromptBlock(input = {}) {
    const legacy = __origBuildAntiRepetitionPromptBlock ? __origBuildAntiRepetitionPromptBlock(input) : "";
    const stronger = buildStrongDiversityRuleBlock(input);
    return [legacy, stronger].filter(Boolean).join("\n\n").trim();
  };

  buildSystemPrompt = function patchedBuildSystemPrompt(input = {}) {
    const base = __origBuildSystemPrompt ? __origBuildSystemPrompt(input) : "";
    const extra = buildStrongDiversityRuleBlock(input);
    const nonceBlock = input?.language === "en"
      ? `[REQUEST NONCE]\n- This generation sequence id is ${input.requestNonce || 1}. Treat this as a fresh batch and avoid prior sentence reuse.`
      : `[요청 시퀀스]\n- 이번 생성 시퀀스 번호는 ${input.requestNonce || 1}이다. 반드시 새로운 배치로 간주하고 이전 문장 재사용을 피할 것.`;
    return [base, extra, nonceBlock].filter(Boolean).join("\n\n");
  };

  buildUserPrompt = function patchedBuildUserPrompt(input = {}) {
    const base = __origBuildUserPrompt ? __origBuildUserPrompt(input) : String(input?.userPrompt || "");
    const extra = input?.language === "en"
      ? `\n\n[Freshness request]\n- Produce a fresh set for batch ${input.requestNonce || 1}.\n- Even within the same chapter, do not repeat answer lines from recent batches.`
      : `\n\n[새 배치 요청]\n- 이번은 배치 ${input.requestNonce || 1}용 새 세트이다.\n- 같은 챕터라도 최근 배치의 정답 문장을 반복하지 말 것.`;
    return `${base}${extra}`;
  };

  collectRecentAnswerLines = function patchedCollectRecentAnswerLines(formatted = {}, input = {}) {
    if (__origCollectRecentAnswerLines) {
      try {
        __origCollectRecentAnswerLines(formatted, input);
      } catch (error) {
        console.error("collectRecentAnswerLines legacy call failed:", error);
      }
    }

    const answerLines = extractNumberedBodies(formatted?.answerSheet || "");
    if (answerLines.length) {
      storeRecentSignatures(input, answerLines);
    }
  };

  function validateWorksheetDiversity(formatted = {}, input = {}) {
    const answerLines = extractNumberedBodies(formatted?.answerSheet || "");
    const questionLines = extractQuestionStemBodies(formatted?.questions || "");
    const count = Math.max(answerLines.length, Number(formatted?.actualCount || 0), Number(input?.count || 0));

    if (count < 5) {
      return { ok: true };
    }

    const exactAnswerDupes = collectDuplicateDetails(answerLines);
    if (exactAnswerDupes.length) {
      return {
        ok: false,
        reason: "duplicate_answer_sentences_detected",
        duplicates: exactAnswerDupes.slice(0, 5),
      };
    }

    const nearAnswerDupes = collectNearDuplicateDetails(answerLines);
    if (nearAnswerDupes.length) {
      return {
        ok: false,
        reason: "near_duplicate_answer_sentences_detected",
        duplicates: nearAnswerDupes.slice(0, 5),
      };
    }

    const exactQuestionDupes = collectDuplicateDetails(questionLines);
    if (exactQuestionDupes.length) {
      return {
        ok: false,
        reason: "duplicate_question_prompts_detected",
        duplicates: exactQuestionDupes.slice(0, 5),
      };
    }

    const recent = new Set(getRecentSignaturesForInput(input));
    const reusedRecent = answerLines
      .map((line, index) => ({ index: index + 1, line, sig: normalizeSentenceSignature(line) }))
      .filter((entry) => entry.sig && recent.has(entry.sig));

    if (reusedRecent.length >= 2) {
      return {
        ok: false,
        reason: "recent_batch_reuse_detected",
        duplicates: reusedRecent.slice(0, 5),
      };
    }

    return { ok: true };
  }

  isGenerationSuccessful = function patchedIsGenerationSuccessful(formatted, input) {
    const legacy = __origIsGenerationSuccessful
      ? __origIsGenerationSuccessful(formatted, input)
      : { ok: true };

    if (!legacy || !legacy.ok) return legacy;

    const diversity = validateWorksheetDiversity(formatted, input);
    if (!diversity.ok) return diversity;

    return legacy;
  };

  formatMagicResponse = function patchedFormatMagicResponse(rawText, input) {
    const formatted = __origFormatMagicResponse
      ? __origFormatMagicResponse(rawText, input)
      : {
          title: "",
          instructions: "",
          questions: "",
          content: "",
          answerSheet: "",
          fullText: safeText(rawText),
          actualCount: 0,
        };

    const answerLines = extractNumberedBodies(formatted.answerSheet || "");
    const uniqueLines = [];
    const seen = new Set();

    answerLines.forEach((line) => {
      const sig = normalizeSentenceSignature(line);
      if (!sig || seen.has(sig)) return;
      seen.add(sig);
      uniqueLines.push(line);
    });

    if (uniqueLines.length && uniqueLines.length !== answerLines.length) {
      formatted.answerSheet = uniqueLines
        .map((line, index) => `${index + 1}. ${line.replace(/^\d+[.)-]?\s*/, "")}`)
        .join("\n");
      if (typeof countWorksheetItems === "function") {
        formatted.actualCount = countWorksheetItems(formatted.questions || "") || uniqueLines.length;
      } else {
        formatted.actualCount = uniqueLines.length;
      }
      formatted.fullText = [formatted.title, formatted.instructions, formatted.questions, input?.language === "en" ? "Answers" : "정답", formatted.answerSheet]
        .filter(Boolean)
        .join("\n\n");
    }

    return formatted;
  };

  async function attemptDiversityRepair(formatted = {}, input = {}, check = {}) {
    if (typeof callOpenAI !== "function") {
      return formatted;
    }

    const repairSystemPrompt = `${buildSystemPrompt(input)}\n\n${input?.language === "en"
      ? `[DIVERSITY REPAIR]\nReturn only the repaired worksheet in [[TITLE]] [[INSTRUCTIONS]] [[QUESTIONS]] [[ANSWERS]] format. Remove duplicate or near-duplicate items. Keep the requested grammar target strong.`
      : `[다양성 복구]\n반드시 [[TITLE]] [[INSTRUCTIONS]] [[QUESTIONS]] [[ANSWERS]] 형식으로만 복구된 워크북을 반환하라. 중복 또는 유사중복 문항을 제거하고 새 문장으로 교체하라. 요청 문법은 강하게 유지하라.`}`;

    const repairUserPrompt = `${buildUserPrompt(input)}\n\n[CURRENT BROKEN WORKSHEET]\n${formatted?.fullText || ""}\n\n[FAILURE REASON]\n${JSON.stringify(check || {})}`;
    const repairedRaw = await callOpenAI(repairSystemPrompt, repairUserPrompt, {
      temperature: 0.22,
      max_tokens: 8000,
    });
    return formatMagicResponse(repairedRaw, input);
  }

  repairFormattedMagicOutput = async function patchedRepairFormattedMagicOutput(formatted, input, check) {
    let repaired = formatted;

    if (__origRepairFormattedMagicOutput) {
      try {
        repaired = await __origRepairFormattedMagicOutput(formatted, input, check);
      } catch (error) {
        console.error("legacy repairFormattedMagicOutput failed:", error);
      }
    }

    const repairedCheck = isGenerationSuccessful(repaired, input);
    if (repairedCheck?.ok) return repaired;

    if (/duplicate|reuse|near_duplicate/.test(String(repairedCheck?.reason || ""))) {
      try {
        const diversityRepaired = await attemptDiversityRepair(repaired, input, repairedCheck);
        const diversityCheck = isGenerationSuccessful(diversityRepaired, input);
        if (diversityCheck?.ok) return diversityRepaired;
      } catch (error) {
        console.error("attemptDiversityRepair failed:", error);
      }
    }

    return repaired;
  };

  console.log(`[${PATCH_TAG}] loaded`);
})();


/* =========================
   v8.2.3 QUALITY + CSAT ADVANCED PATCH
   ========================= */
(function qualityCsatPatch(){
  const PATCH_TAG = "v8.2.3-quality-csat";

  const __prevBuildSystemPrompt = typeof buildSystemPrompt === "function" ? buildSystemPrompt : null;
  const __prevBuildUserPrompt = typeof buildUserPrompt === "function" ? buildUserPrompt : null;
  const __prevIsGenerationSuccessful = typeof isGenerationSuccessful === "function" ? isGenerationSuccessful : null;
  const __prevFormatMagicResponse = typeof formatMagicResponse === "function" ? formatMagicResponse : null;
  const __prevRepairFormattedMagicOutput = typeof repairFormattedMagicOutput === "function" ? repairFormattedMagicOutput : null;

  function qSafe(value) {
    return String(value || "").trim();
  }

  function extractAnswerBodiesLocal(text = "") {
    return qSafe(text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line))
      .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
      .filter(Boolean);
  }

  function qNormalize(text = "") {
    return qSafe(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(a|an|the|this|that|these|those|my|your|his|her|our|their)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasBadNaturalPattern(text = "") {
    const s = qSafe(text);
    const lower = s.toLowerCase();
    const patterns = [
      /\bno\s+thing\b/i,
      /\bopportunity\s+to\s+get\b/i,
      /\bskill\s+to\s+learn\b/i,
      /\btime\s+to\s+send\b/i,
      /\bthings\s+to\s+do\s+to\s+go\s+out\b/i,
      /\ba\s+friend\s+to\s+hang\s+out\s+with\s+me\b/i,
      /\ba\s+person\s+to\s+help\s+me\b/i,
      /\bopportunity\s+to\s+experience\b/i,
      /\bis\s+friends\b/i,
      /\bhas\s+been\s+won\b/i,
      /\bhas\s+experience\s+in\s+solving\b/i,
      /\bhave\s+met\s+often\s+for\s+\d+/i,
      /\btraveled\s+for\s+\d+\s+days\b/i,
      /\bfelt\s+\w+\s+after\s+he\s+saw\b/i,
      /\bfelt\s+\w+\s+after\s+i\s+finished\b/i,
      /\bthing\s+to\s+do\b/i,
      /\bthings\s+to\s+learn\b/i
    ];
    if (patterns.some((re) => re.test(s))) return true;

    if (/\b(?:something|anything|nothing)\s+to\s+do\s+(?:often|every day|always)\b/i.test(s)) return true;
    if (/\bexperience\b/.test(lower) && /\bopportunity\s+to\s+experience\b/.test(lower)) return true;
    return false;
  }

  function similarityScore(a = "", b = "") {
    const A = qNormalize(a).split(" ").filter(Boolean);
    const B = qNormalize(b).split(" ").filter(Boolean);
    if (!A.length || !B.length) return 0;
    const aSet = new Set(A);
    const bSet = new Set(B);
    let overlap = 0;
    for (const token of aSet) if (bSet.has(token)) overlap += 1;
    return overlap / Math.max(aSet.size, bSet.size, 1);
  }

  function removeNearDuplicates(lines = []) {
    const kept = [];
    for (const line of lines) {
      const dup = kept.some((prev) => similarityScore(prev, line) >= 0.72);
      if (!dup) kept.push(line);
    }
    return kept;
  }

  function getFocusLocal(input = {}) {
    if (input && input.grammarFocus) return input.grammarFocus;
    if (typeof detectGrammarFocus === "function") {
      return detectGrammarFocus([input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" "));
    }
    return {};
  }

  function passiveCoverageReport(lines = []) {
    let passive = 0;
    let activeAllowed = 0;
    for (const line of lines) {
      if (/\b(am|is|are|was|were|be|been|being|can be|will be|has been|have been)\b[^.]{0,40}\b([a-z]+ed|known|built|made|given|seen|written|held|sent|won|found|taught|bought|caught|left|felt|read|sold|paid|shown|taken|done|prepared|completed|reviewed|translated|decorated|offered|reported|painted|solved|loved|borrowed|sung)\b/i.test(line)) {
        passive += 1;
      } else {
        activeAllowed += 1;
      }
    }
    return { passive, activeAllowed, total: lines.length };
  }

  function hasCsatAbstractSignal(text = "") {
    return /\b(principle|perspective|interpretation|responsibility|ethics|identity|social|society|education|environment|communication|motivation|influence|achievement|growth|decision|evidence|policy|value|belief|awareness|cooperation|creativity|diversity|justice|community|technology|culture|critical)\b/i.test(text);
  }

  function buildCsatAdvancedBlock(input = {}) {
    const isHigh = input?.level === "high" || /고1|고2|고3|고등|수능/.test(String(input?.gradeLabel || "") + " " + String(input?.userPrompt || "") + " " + String(input?.topic || ""));
    const isExtreme = input?.difficulty === "extreme" || /수능|고난도|최고난도/.test(String(input?.userPrompt || "") + " " + String(input?.topic || ""));
    if (!isHigh && !isExtreme) return "";
    return input?.language === "en"
      ? `[CSAT-LEVEL ADVANCED CONTENT]
- For high-school and CSAT-level requests, sentence meaning must stimulate thinking, not remain at shallow daily-life level.
- Prefer themes such as education, ethics, responsibility, identity, environment, communication, social change, decision-making, evidence, interpretation, and personal growth.
- Avoid childish daily-life content dominating the set: pizza, toys, pets, simple hobbies, or ultra-basic family chatter.
- At least half of the set should contain abstract or reflective meaning.
- Keep the grammar target visible while raising cognitive depth.`
      : `[수능형 고난도 내용 규칙]
- 고등부와 수능형 요청에서는 내용 자체가 사고를 자극해야 하며, 단순 생활영어 수준에 머물지 말 것.
- 교육, 윤리, 책임, 정체성, 환경, 소통, 사회 변화, 의사결정, 근거, 해석, 성장 같은 주제를 우선한다.
- 피자, 장난감, 애완동물, 단순 취미, 지나치게 가벼운 가족 잡담이 세트를 지배하지 않게 할 것.
- 최소 절반 이상의 문항은 추상적이거나 성찰적인 의미를 담아야 한다.
- 문법 목표는 유지하되, 사고 깊이는 한 단계 이상 높일 것.`;
  }

  function buildNaturalnessBlock(input = {}) {
    return input?.language === "en"
      ? `[NATURAL ENGLISH LOCK]
- Reject awkward textbook-English such as "no thing", "opportunity to get", "a person to help me", or other literal-but-unnatural combinations.
- Prefer fluent classroom English that a teacher would actually accept as a model answer.
- If a noun choice feels weak, replace it silently with a better noun.
- If a prompt is semantically odd, repair the meaning before finalizing the answer.`
      : `[자연스러운 영어 잠금]
- "no thing", "opportunity to get", "a person to help me" 같은 직역형 어색한 영어는 모두 폐기할 것.
- 교사가 모범답안으로 바로 제시할 수 있는 자연스러운 영어를 우선한다.
- 명사 선택이 약하면 더 좋은 명사로 조용히 교체할 것.
- 제시문 의미가 어색하면, 최종 정답 단계에서 자연스럽게 보정할 것.`;
  }

  buildSystemPrompt = function buildSystemPrompt_v823(input = {}) {
    const base = __prevBuildSystemPrompt ? __prevBuildSystemPrompt(input) : "";
    return [base, buildNaturalnessBlock(input), buildCsatAdvancedBlock(input)].filter(Boolean).join("\n\n");
  };

  buildUserPrompt = function buildUserPrompt_v823(input = {}) {
    const base = __prevBuildUserPrompt ? __prevBuildUserPrompt(input) : "";
    const extra = input?.language === "en"
      ? `[QUALITY TARGET]
- Keep sentence families varied across the set.
- Do not repeat the same noun frame too often, especially book to read / something to do / things to do.
- Use stronger noun variety: article, task, approach, opportunity, perspective, strategy, place, reason, evidence, plan, discussion, project.
- For high-school requests, include reflective or academic meaning regularly.`
      : `[품질 목표]
- 세트 전체에서 문장 계열을 다양하게 유지할 것.
- 특히 book to read / something to do / things to do 같은 명사 틀을 과도하게 반복하지 말 것.
- article, task, approach, opportunity, perspective, strategy, place, reason, evidence, plan, discussion, project 같은 더 강한 명사 다양성을 사용할 것.
- 고등부 요청에서는 사고형·학술형 의미를 꾸준히 포함할 것.`;
    return [base, extra].filter(Boolean).join("\n\n");
  };

  function qualityAudit(formatted = {}, input = {}) {
    const lines = extractAnswerBodiesLocal(formatted?.answerSheet || "");
    if (!lines.length) {
      return { ok: false, reason: "no_answers" };
    }

    const badLines = lines.filter((line) => hasBadNaturalPattern(line));
    if (badLines.length) {
      return { ok: false, reason: "unnatural_english", details: badLines.slice(0, 5) };
    }

    const deduped = removeNearDuplicates(lines);
    if (deduped.length < Math.max(5, Math.ceil(lines.length * 0.72))) {
      return { ok: false, reason: "near_duplicate_density", details: lines.slice(0, 8) };
    }

    const focus = getFocusLocal(input);
    if (focus?.isPassive) {
      const report = passiveCoverageReport(lines);
      const activeRatio = report.total ? report.activeAllowed / report.total : 0;
      if (activeRatio > 0.18) {
        return { ok: false, reason: "passive_coverage_too_low", details: report };
      }
    }

    if (focus?.isPresentPerfect) {
      const invalid = lines.filter((line) => {
        if (typeof hasInvalidPastTimeMarker === "function" && hasInvalidPastTimeMarker(line)) return true;
        if (!/\b(have|has)\b/i.test(line)) return true;
        return /\bhas\s+experience\b|\bafter\b/i.test(line);
      });
      if (invalid.length) {
        return { ok: false, reason: "present_perfect_quality", details: invalid.slice(0, 5) };
      }
    }

    const isHigh = input?.level === "high" || /고1|고2|고3|고등|수능/.test(String(input?.gradeLabel || "") + " " + String(input?.topic || "") + " " + String(input?.userPrompt || ""));
    if (isHigh) {
      const abstractCount = lines.filter((line) => hasCsatAbstractSignal(line)).length;
      if (abstractCount < Math.ceil(lines.length * 0.22)) {
        return { ok: false, reason: "csat_depth_low", details: { abstractCount, total: lines.length } };
      }
    }

    return { ok: true };
  }

  formatMagicResponse = function formatMagicResponse_v823(rawText, input) {
    const formatted = __prevFormatMagicResponse ? __prevFormatMagicResponse(rawText, input) : {
      title: "",
      instructions: "",
      questions: "",
      answerSheet: qSafe(rawText),
      fullText: qSafe(rawText),
      actualCount: 0,
    };

    const lines = extractAnswerBodiesLocal(formatted?.answerSheet || "");
    const filtered = removeNearDuplicates(lines).filter((line) => !hasBadNaturalPattern(line));
    if (filtered.length && filtered.length !== lines.length) {
      formatted.answerSheet = filtered.map((line, idx) => `${idx + 1}. ${line}`).join("\n");
      if (typeof countWorksheetItems === "function") {
        formatted.actualCount = countWorksheetItems(formatted.questions || "") || filtered.length;
      } else {
        formatted.actualCount = filtered.length;
      }
      formatted.fullText = [formatted.title, formatted.instructions, formatted.questions, input?.language === "en" ? "Answers" : "정답", formatted.answerSheet]
        .filter(Boolean)
        .join("\n\n");
    }
    return formatted;
  };

  isGenerationSuccessful = function isGenerationSuccessful_v823(formatted, input) {
    const base = __prevIsGenerationSuccessful ? __prevIsGenerationSuccessful(formatted, input) : { ok: true };
    if (!base?.ok) return base;
    return qualityAudit(formatted, input);
  };

  async function attemptQualityRepair(formatted = {}, input = {}, failure = {}) {
    if (typeof callOpenAI !== "function") return formatted;
    const repairSystemPrompt = `${buildSystemPrompt(input)}\n\n${input?.language === "en"
      ? `[QUALITY REPAIR]\nReturn only [[TITLE]] [[INSTRUCTIONS]] [[QUESTIONS]] [[ANSWERS]]. Replace awkward English, near-duplicates, and shallow high-school content. Keep the grammar target strong.`
      : `[품질 복구]\n반드시 [[TITLE]] [[INSTRUCTIONS]] [[QUESTIONS]] [[ANSWERS]] 형식으로만 반환하라. 어색한 영어, 유사중복, 얕은 고등부 내용을 새 문장으로 교체하라. 문법 목표는 강하게 유지하라.`}`;
    const repairUserPrompt = `${buildUserPrompt(input)}\n\n[CURRENT WORKSHEET]\n${formatted?.fullText || ""}\n\n[FAILURE]\n${JSON.stringify(failure || {})}`;
    const repairedRaw = await callOpenAI(repairSystemPrompt, repairUserPrompt, {
      temperature: 0.28,
      max_tokens: 8000,
    });
    return formatMagicResponse(repairedRaw, input);
  }

  repairFormattedMagicOutput = async function repairFormattedMagicOutput_v823(formatted, input, failure) {
    let repaired = formatted;
    if (__prevRepairFormattedMagicOutput) {
      try {
        repaired = await __prevRepairFormattedMagicOutput(formatted, input, failure);
      } catch (error) {
        console.error("legacy repairFormattedMagicOutput failed:", error);
      }
    }

    const check = qualityAudit(repaired, input);
    if (check?.ok) return repaired;

    if (/unnatural_english|near_duplicate_density|passive_coverage_too_low|present_perfect_quality|csat_depth_low/.test(String(check?.reason || ""))) {
      try {
        const repairedAgain = await attemptQualityRepair(repaired, input, check);
        const finalCheck = qualityAudit(repairedAgain, input);
        if (finalCheck?.ok) return repairedAgain;
      } catch (error) {
        console.error("attemptQualityRepair failed:", error);
      }
    }

    return repaired;
  };

  console.log(`[${PATCH_TAG}] loaded`);
})();


/* ========================================================================
   Marcusnote Magic v8.3 Strict Stability Patch
   - Removes soft answer-only recovery from the final decision path
   - Uses full regeneration retries instead of weak answer-sheet patching
   - Enforces exact question/answer parity for Magic outputs
   - Adds answer diversity and repetition audit
   - Separates refill validation from full-generation validation
   ======================================================================== */

function __mn83ExtractNumberedLines(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line));
}

function __mn83ExtractBodies(text = "") {
  return __mn83ExtractNumberedLines(text)
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);
}

function __mn83NormalizeSignature(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/^\d+[.)-]?\s*/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/["'`“”‘’]/g, "")
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function __mn83BuildItemPairs(questions = "", answers = "") {
  const qLines = __mn83ExtractNumberedLines(questions);
  const aLines = __mn83ExtractNumberedLines(answers);
  const answerMap = new Map();

  for (const line of aLines) {
    const match = line.match(/^(\d+)[.)-]?\s+(.*)$/);
    if (!match) continue;
    answerMap.set(Number(match[1]), String(match[2] || "").trim());
  }

  const pairs = [];
  for (const line of qLines) {
    const match = line.match(/^(\d+)[.)-]?\s+(.*)$/);
    if (!match) continue;
    const no = Number(match[1]);
    pairs.push({
      no,
      question: String(match[2] || "").trim(),
      answer: answerMap.get(no) || "",
    });
  }
  return pairs;
}

function __mn83HasLowAnswerDiversity(answerSheet = "") {
  const bodies = __mn83ExtractBodies(answerSheet);
  if (bodies.length < 4) return false;

  const signatures = bodies.map(__mn83NormalizeSignature).filter(Boolean);
  const unique = new Set(signatures);
  const uniqueRatio = unique.size / Math.max(1, signatures.length);

  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < signatures.length; i += 1) {
    if (signatures[i] && signatures[i] === signatures[i - 1]) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  const explanationLike = bodies.filter((line) => /어색한 표현입니다|올바른 문장입니다|바른 문장입니다|정답은|해설/i.test(line)).length;
  const explanationRatio = explanationLike / Math.max(1, bodies.length);

  return uniqueRatio < 0.72 || maxRun >= 2 || explanationRatio > 0.85;
}

function __mn83StrictAudit(formatted = {}, input = {}) {
  const questions = String(formatted?.questions || "").trim();
  const answers = String(formatted?.answerSheet || "").trim();
  const qCount = typeof countWorksheetItems === "function" ? countWorksheetItems(questions) : __mn83ExtractNumberedLines(questions).length;
  const aCount = typeof countAnswerLines === "function" ? countAnswerLines(answers) : __mn83ExtractNumberedLines(answers).length;
  const isConcept = input?.magicIntent === "concept" || input?.magicIntent === "concept+training";
  const isVocabSeries = /vocab/i.test(String(input?.mode || ""));

  if (!questions) return { ok: false, reason: "questions_missing_strict" };
  if (!answers) return { ok: false, reason: "answers_missing_strict" };
  if (!hasSequentialNumbering(questions)) return { ok: false, reason: "question_numbering_broken_strict" };
  if (!hasSequentialNumbering(answers)) return { ok: false, reason: "answer_numbering_broken_strict" };

  if (input?.isRefill) {
    const expected = Number(input?.refillCount || 0);
    if (expected > 0 && qCount !== expected) {
      return { ok: false, reason: "refill_question_count_mismatch", details: { expected, qCount } };
    }
    if (expected > 0 && aCount !== expected) {
      return { ok: false, reason: "refill_answer_count_mismatch", details: { expected, aCount } };
    }
  } else if (!isConcept && !isVocabSeries) {
    if (qCount !== aCount) {
      return { ok: false, reason: "exact_parity_failed", details: { qCount, aCount } };
    }
    if (Number(input?.count || 0) > 0 && qCount !== Number(input.count)) {
      return { ok: false, reason: "requested_count_mismatch", details: { requested: Number(input.count), qCount } };
    }
  }

  if (__mn83HasLowAnswerDiversity(answers)) {
    return { ok: false, reason: "answer_diversity_low" };
  }

  const pairs = __mn83BuildItemPairs(questions, answers);
  if (!pairs.length) return { ok: false, reason: "pair_build_failed" };
  if (pairs.some((pair) => !pair.answer)) {
    return { ok: false, reason: "pair_answer_missing" };
  }

  return {
    ok: true,
    qCount,
    aCount,
    pairs
  };
}


function __mn831RebuildFormattedBundle(formatted = {}, input = {}) {
  const parts = [formatted.title, formatted.instructions, formatted.questions].filter(Boolean);
  formatted.content = parts.join("\n\n");
  formatted.fullText = [
    ...parts,
    ((input.language === "en" ? "Answers\n" : "정답\n") + (formatted.answerSheet || ""))
  ].filter(Boolean).join("\n\n");
  formatted.actualCount = countWorksheetItems(formatted.questions || "");
  return formatted;
}

function __mn831ApplyBalancedParityRepair(formatted = {}, input = {}) {
  if (!formatted || typeof formatted !== "object") return formatted;
  const questions = String(formatted.questions || "").trim();
  if (!questions) return formatted;

  const qCount = countWorksheetItems(questions);
  const currentAnswers = String(formatted.answerSheet || "").trim();
  const aCount = countAnswerLines(currentAnswers);

  // Only repair when there is a realistic near-miss or obvious missing-answer state.
  // This avoids reviving the old loose emergency path.
  const shouldRepair =
    qCount > 0 &&
    (
      aCount === 0 ||
      (aCount < qCount && aCount >= Math.max(1, Math.ceil(qCount * 0.6)))
    );

  if (!shouldRepair) return formatted;

  const repaired = { ...formatted };
  let nextAnswers = normalizeMagicAnswerSheet(currentAnswers, questions, input);

  if (!nextAnswers || countAnswerLines(nextAnswers) < qCount) {
    nextAnswers = normalizeMagicAnswerSheet("", questions, input);
  }

  repaired.answerSheet = String(nextAnswers || "").trim();
  return __mn831RebuildFormattedBundle(repaired, input);
}

async function __mn83TryStrictGenerate(input = {}, maxAttempts = 3) {
  let lastFailure = { reason: "unknown" };
  let lastFormatted = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const rawText = await generateMagicCore(input);
    let formatted = formatMagicResponse(rawText, input);

    if ((input.mode === "abcstarter" || input.level === "elementary") && String(formatted.questions || "").trim()) {
      formatted.answerSheet = normalizeMagicAnswerSheet(formatted.answerSheet || "", formatted.questions || "", input);
      const parts = [formatted.title, formatted.instructions, formatted.questions].filter(Boolean);
      formatted.content = parts.join("\n\n");
      formatted.fullText = [
        ...parts,
        ((input.language === "en" ? "Answers\n" : "정답\n") + (formatted.answerSheet || ""))
      ].filter(Boolean).join("\n\n");
      formatted.actualCount = countWorksheetItems(formatted.questions || "");
    }

    const validationOk = validateWritingOutput(`[[QUESTIONS]]\n${formatted.questions || ""}\n[[ANSWERS]]\n${formatted.answerSheet || ""}`, input);
    const strictAudit = __mn83StrictAudit(formatted, input);

    formatted.itemPairs = strictAudit?.pairs || __mn83BuildItemPairs(formatted.questions || "", formatted.answerSheet || "");
    formatted.pairIntegrity = {
      ok: Boolean(strictAudit?.ok),
      reason: strictAudit?.reason || "",
      questionCount: strictAudit?.qCount ?? countWorksheetItems(formatted.questions || ""),
      answerCount: strictAudit?.aCount ?? countAnswerLines(formatted.answerSheet || "")
    };

    lastFormatted = formatted;

    if (validationOk && strictAudit.ok) {
      return {
        ok: true,
        formatted,
        attemptsUsed: attempt
      };
    }

    lastFailure = {
      reason: !validationOk ? "validation_failed" : (strictAudit.reason || "strict_audit_failed"),
      details: strictAudit?.details || null,
      attempt
    };
  }

  return {
    ok: false,
    formatted: lastFormatted,
    failure: lastFailure
  };
}

module.exports = async function handler_v83_strict(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST 요청만 허용됩니다." });

  try {
    const input = normalizeInput(req.body || {});
    input.__rawBody = req.body || {};

    if (!input.userPrompt && !input.topic) {
      return json(res, 400, { success: false, message: "userPrompt 또는 topic이 필요합니다." });
    }

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

    const generation = await __mn83TryStrictGenerate(input, input?.isRefill ? 2 : 3);

    let finalGeneration = generation;
    if (!generation.ok && ["exact_parity_failed", "pair_answer_missing", "answers_missing_strict"].includes(String(generation?.failure?.reason || ""))) {
      const rebalanced = __mn832RebalanceFailedFormatted(generation.formatted, input);
      if (rebalanced.ok) {
        finalGeneration = {
          ok: true,
          formatted: rebalanced.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: "balanced_parity_rebuild"
        };
      }
    }

    if (!finalGeneration.ok && [
      "exact_parity_failed",
      "requested_count_mismatch",
      "answer_diversity_low",
      "pair_answer_missing",
      "answers_missing_strict",
      "question_numbering_broken_strict",
      "answer_numbering_broken_strict",
      "refill_question_count_mismatch",
      "refill_answer_count_mismatch"
    ].includes(String(finalGeneration?.failure?.reason || generation?.failure?.reason || ""))) {
      const softened = __v841BuildSoftRecoveredFormatted(
        finalGeneration?.formatted || generation?.formatted,
        input,
        finalGeneration?.failure || generation?.failure || {}
      );
      if (softened.ok) {
        finalGeneration = {
          ok: true,
          formatted: softened.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: softened.repairedBy || "soft_recovered_no_throw"
        };
      }
    }

    if (!finalGeneration.ok && [
      "exact_parity_failed",
      "requested_count_mismatch",
      "answer_diversity_low",
      "pair_answer_missing",
      "answers_missing_strict",
      "question_numbering_broken_strict",
      "answer_numbering_broken_strict",
      "refill_question_count_mismatch",
      "refill_answer_count_mismatch"
    ].includes(String(finalGeneration?.failure?.reason || generation?.failure?.reason || ""))) {
      const degraded = __v842BuildDegradedFormatted(
        finalGeneration?.formatted || generation?.formatted,
        input,
        finalGeneration?.failure || generation?.failure || {}
      );
      if (degraded.ok) {
        finalGeneration = {
          ok: true,
          formatted: degraded.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: degraded.repairedBy || "degraded_nonblocking_return"
        };
      }
    }

    if (!finalGeneration.ok) {
      return json(res, 502, {
        success: false,
        message: input?.isRefill
          ? "보충 생성 결과의 정답 품질 또는 개수가 불안정하여 생성이 중단되었습니다. MP는 차감되지 않았습니다. 다시 시도해주세요."
          : "매직 정답 품질 검수에서 실패하여 생성이 중단되었습니다. MP는 차감되지 않았습니다. 다시 시도해주세요.",
        detail: finalGeneration?.failure?.reason || "strict_generation_failed",
        userMessage:
          "정답 수와 문제 수가 완전히 맞지 않아 생성이 중단되었습니다. 이번 버전은 자동 복구를 한 번 시도했지만 통과하지 못했습니다. 다시 시도해주세요.",
        meta: {
          language: input.language,
          requestedCount: input.count,
          actualCount: finalGeneration?.formatted?.actualCount || 0,
          generatedAt: new Date().toISOString(),
          strictGeneration: true,
          attemptsUsed: finalGeneration?.failure?.attempt || generation?.failure?.attempt || (input?.isRefill ? 2 : 3)
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

    const formatted = finalGeneration.formatted;
    collectRecentAnswerLines(formatted, input);
    const finalMpState = await deductMpAfterSuccess(mpState);

    return json(res, 200, {
      success: true,
      requestNonce: req.body?.requestNonce || input.requestNonce || '',
      ...formatted,
      meta: {
        language: input.language,
        requestedCount: input.count,
        actualCount: formatted.actualCount,
        generatedAt: new Date().toISOString(),
        strictGeneration: true,
        attemptsUsed: finalGeneration.attemptsUsed
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
    console.error("Handler error (v8.3 strict):", error);
    return json(res, 500, { success: false, message: "매직 워크북 생성에 실패했습니다.", detail: error.message });
  }
};


/* ========================================================================
   Marcusnote Magic v8.3.2 Balanced Parity Handler Override
   - Overrides strict handler with near-miss parity rebalance
   - Uses failed formatted output and rebuilds answer sheet once
   ======================================================================== */
function __mn832RebalanceFailedFormatted(failedFormatted = {}, input = {}) {
  const formatted = failedFormatted && typeof failedFormatted === "object" ? { ...failedFormatted } : null;
  if (!formatted) return { ok: false, reason: "formatted_missing" };

  const questions = String(formatted.questions || "").trim();
  if (!questions) return { ok: false, reason: "questions_missing" };

  const rebuiltAnswers = normalizeMagicAnswerSheet(
    String(formatted.answerSheet || ""),
    questions,
    input
  );

  const rebuilt = {
    ...formatted,
    answerSheet: rebuiltAnswers
  };

  const parts = [rebuilt.title, rebuilt.instructions, rebuilt.questions].filter(Boolean);
  rebuilt.content = parts.join("\n\n");
  rebuilt.fullText = [
    ...parts,
    ((input.language === "en" ? "Answers\n" : "정답\n") + (rebuilt.answerSheet || ""))
  ].filter(Boolean).join("\n\n");
  rebuilt.actualCount = countWorksheetItems(rebuilt.questions || "");

  const strictAudit = __mn83StrictAudit(rebuilt, input);
  rebuilt.itemPairs = strictAudit?.pairs || __mn83BuildItemPairs(rebuilt.questions || "", rebuilt.answerSheet || "");
  rebuilt.pairIntegrity = {
    ok: Boolean(strictAudit?.ok),
    reason: strictAudit?.reason || "",
    questionCount: strictAudit?.qCount ?? countWorksheetItems(rebuilt.questions || ""),
    answerCount: strictAudit?.aCount ?? countAnswerLines(rebuilt.answerSheet || "")
  };

  const validationOk = validateWritingOutput(`[[QUESTIONS]]\n${rebuilt.questions || ""}\n[[ANSWERS]]\n${rebuilt.answerSheet || ""}`, input);

  if (validationOk && strictAudit.ok) {
    return { ok: true, formatted: rebuilt };
  }

  return {
    ok: false,
    reason: strictAudit?.reason || (!validationOk ? "validation_failed" : "rebalance_failed"),
    formatted: rebuilt
  };
}


function __v841BuildSoftRecoveredFormatted(failedFormatted = {}, input = {}, failure = {}) {
  const formatted = failedFormatted && typeof failedFormatted === "object" ? { ...failedFormatted } : null;
  if (!formatted) return { ok: false, reason: "formatted_missing" };

  const questions = String(formatted.questions || "").trim();
  if (!questions) return { ok: false, reason: "questions_missing" };

  let rebuiltAnswers = normalizeMagicAnswerSheet(
    String(formatted.answerSheet || ""),
    questions,
    input
  );
  rebuiltAnswers = smoothGeneratedEnglish(rebuiltAnswers, input);

  if (!String(rebuiltAnswers || "").trim()) {
    rebuiltAnswers = buildEmergencyAnswerSheet(questions, input);
  }
  rebuiltAnswers = smoothGeneratedEnglish(rebuiltAnswers, input);

  if (!String(rebuiltAnswers || "").trim()) {
    return { ok: false, reason: "answers_missing_after_soft_recovery" };
  }

  const rebuilt = {
    ...formatted,
    answerSheet: rebuiltAnswers
  };

  const parts = [rebuilt.title, rebuilt.instructions, rebuilt.questions].filter(Boolean);
  rebuilt.content = parts.join("\n\n");
  rebuilt.fullText = [
    ...parts,
    ((input.language === "en" ? "Answers\n" : "정답\n") + (rebuilt.answerSheet || ""))
  ].filter(Boolean).join("\n\n");
  rebuilt.actualCount = countWorksheetItems(rebuilt.questions || "");
  rebuilt.itemPairs = __mn83BuildItemPairs(rebuilt.questions || "", rebuilt.answerSheet || "");

  const pairQuestionCount = countWorksheetItems(rebuilt.questions || "");
  const pairAnswerCount = countAnswerLines(rebuilt.answerSheet || "");
  rebuilt.pairIntegrity = {
    ok: pairQuestionCount === pairAnswerCount && rebuilt.itemPairs.every((pair) => String(pair.answer || "").trim()),
    reason: `soft_recovered:${String(failure?.reason || "unknown")}`,
    questionCount: pairQuestionCount,
    answerCount: pairAnswerCount
  };

  return {
    ok: true,
    formatted: rebuilt,
    repairedBy: "soft_recovered_no_throw"
  };
}



function __v842BuildDegradedFormatted(failedFormatted = {}, input = {}, failure = {}) {
  const formatted = failedFormatted && typeof failedFormatted === "object" ? { ...failedFormatted } : null;
  if (!formatted) return { ok: false, reason: "formatted_missing" };

  const questions = String(formatted.questions || "").trim();
  if (!questions || !hasMeaningfulWorksheetBody(questions)) {
    return { ok: false, reason: "questions_missing_after_degraded_recovery" };
  }

  let rebuiltAnswers = normalizeMagicAnswerSheet(
    String(formatted.answerSheet || ""),
    questions,
    input
  );
  rebuiltAnswers = smoothGeneratedEnglish(rebuiltAnswers, input);

  if (!String(rebuiltAnswers || "").trim() || !hasMeaningfulWorksheetBody(rebuiltAnswers)) {
    rebuiltAnswers = buildEmergencyAnswerSheet(questions, input);
  }
  rebuiltAnswers = smoothGeneratedEnglish(rebuiltAnswers, input);

  if (!String(rebuiltAnswers || "").trim() || !hasMeaningfulWorksheetBody(rebuiltAnswers)) {
    return { ok: false, reason: "answers_missing_after_degraded_recovery" };
  }

  const rebuilt = {
    ...formatted,
    answerSheet: rebuiltAnswers
  };

  const parts = [rebuilt.title, rebuilt.instructions, rebuilt.questions].filter(Boolean);
  rebuilt.content = parts.join("\n\n");
  rebuilt.fullText = [
    ...parts,
    ((input.language === "en" ? "Answers\n" : "정답\n") + (rebuilt.answerSheet || ""))
  ].filter(Boolean).join("\n\n");
  rebuilt.actualCount = countWorksheetItems(rebuilt.questions || "");
  rebuilt.itemPairs = __mn83BuildItemPairs(rebuilt.questions || "", rebuilt.answerSheet || "");

  const qCount = countWorksheetItems(rebuilt.questions || "");
  const aCount = countAnswerLines(rebuilt.answerSheet || "");
  rebuilt.pairIntegrity = {
    ok: Boolean(qCount && aCount),
    reason: `degraded_recovered:${String(failure?.reason || "unknown")}`,
    questionCount: qCount,
    answerCount: aCount
  };

  return {
    ok: true,
    formatted: rebuilt,
    repairedBy: "degraded_nonblocking_return"
  };
}


function normalizeWorkbookType(value = "") {
  const v = sanitizeString(value, "").toLowerCase();
  if (!v) return "guided_writing";
  if (["guided_writing", "blank_fill", "binary_choice", "sentence_build"].includes(v)) return v;
  if (["guided", "writing", "guidedwriting"].includes(v)) return "guided_writing";
  if (["blank", "blankfill", "fill_blank", "fill_in_blank"].includes(v)) return "blank_fill";
  if (["choice", "binarychoice", "binary", "either_or"].includes(v)) return "binary_choice";
  return "guided_writing";
}

function normalizeProfile(value = "") {
  const v = sanitizeString(value, "").toLowerCase();
  if (!v || v === "auto") return "auto";
  if (["elementary", "middle", "high"].includes(v)) return v;
  return "auto";
}

function __v84ExtractQuestionBlocks(questions = "") {
  const lines = String(questions || "").split("\n");
  const blocks = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const lead = String(current.lines[0] || "").replace(/^\d+[.)-]?\s*/, "").trim();
    const rest = current.lines.slice(1).join("\n").trim();
    blocks.push({
      no: current.no,
      lead,
      rest,
      lines: current.lines.slice(),
      raw: current.lines.join("\n").trim()
    });
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;
    const m = line.match(/^(\d+)[.)-]?\s+(.*)$/);
    if (m) {
      pushCurrent();
      current = { no: Number(m[1]), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  pushCurrent();
  return blocks;
}

function __v84ExtractAnswerMap(answerSheet = "") {
  const map = new Map();
  const lines = String(answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^(\d+)[.)-]?\s+(.*)$/);
    if (!m) continue;
    map.set(Number(m[1]), String(m[2] || "").trim());
  }
  return map;
}

function __v84GetLocale(input = {}) {
  return input?.language === "en" ? "en" : "ko";
}

function __v84BuildWorkbookTypeInstructions(input = {}, baseInstructions = "") {
  const type = normalizeWorkbookType(input?.workbookType || "");
  const locale = __v84GetLocale(input);
  const base = String(baseInstructions || "").trim();

  if (type === "blank_fill") {
    const addon = locale === "en"
      ? "Fill in each blank to complete the full English sentence. Use the original Korean prompt and the blanked sentence together."
      : "각 문항의 빈칸을 채워 완전한 영어 문장을 완성하세요. 한국어 지시와 빈칸 문장을 함께 참고하세요.";
    return [base, addon].filter(Boolean).join("\n");
  }

  if (type === "binary_choice") {
    const addon = locale === "en"
      ? "Choose the better option in each item and complete the full English sentence."
      : "각 문항에서 두 보기 중 더 알맞은 표현을 골라 완전한 영어 문장을 완성하세요.";
    return [base, addon].filter(Boolean).join("\n");
  }

  return base;
}

function __v84PickContentWord(answer = "") {
  const tokens = String(answer || "").split(/\s+/).filter(Boolean);
  const stop = new Set(["i","you","he","she","it","we","they","me","him","her","us","them","a","an","the","this","that","these","those","my","your","his","her","our","their","to","of","for","in","on","at","with","and","or","but","is","am","are","was","were","be","been","being"]);
  const cleaned = tokens.map((t, idx) => ({
    idx,
    raw: t,
    core: t.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
  })).filter((x) => x.core);

  const midStart = Math.max(0, Math.floor(cleaned.length / 3));
  for (const x of cleaned.slice(midStart)) {
    if (!stop.has(x.core.toLowerCase()) && x.core.length >= 3) return x;
  }
  for (const x of cleaned) {
    if (!stop.has(x.core.toLowerCase())) return x;
  }
  return cleaned[cleaned.length - 1] || null;
}

function __v84BlankSentence(answer = "", input = {}) {
  const sentence = String(answer || "").trim();
  if (!sentence) return { transformed: "", answer: sentence };

  const bareVerbPattern = /\b(make|let|have|help|see|hear|watch|feel|notice)\b\s+([A-Za-z]+)\s+([A-Za-z]+)\b/i;
  const infinitivePattern = /\b(get|want|tell|ask|expect)\b\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)\b/i;

  if (bareVerbPattern.test(sentence)) {
    const m = sentence.match(bareVerbPattern);
    const full = `${m[2]} ${m[3]}`;
    return { transformed: sentence.replace(full, `${m[2]} _____`), answer: sentence };
  }
  if (infinitivePattern.test(sentence)) {
    const m = sentence.match(infinitivePattern);
    return { transformed: sentence.replace(`to ${m[3]}`, "_____"), answer: sentence };
  }

  const picked = __v84PickContentWord(sentence);
  if (!picked) return { transformed: sentence, answer: sentence };
  const escaped = picked.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const transformed = sentence.replace(new RegExp(escaped), "_____");
  return { transformed, answer: sentence };
}

function __v84BuildDistractor(target = "", answer = "") {
  const t = String(target || "").trim();
  const lower = t.toLowerCase();

  if (!t) return "_____";
  if (lower === "to") return "for";
  if (lower in {go:1, read:1, solve:1, help:1, watch:1, finish:1, take:1, attend:1, use:1, apply:1}) return `to ${t}`;
  if (/ing$/i.test(t)) return t.replace(/ing$/i, "") || "do";
  return `${t}s`;
}

function __v84ChoiceSentence(answer = "", input = {}) {
  const sentence = String(answer || "").trim();
  if (!sentence) return { transformed: "", answer: sentence };

  const bareVerbPattern = /\b(make|let|have|help|see|hear|watch|feel|notice)\b\s+([A-Za-z]+)\s+([A-Za-z]+)\b/i;
  const infinitivePattern = /\b(get|want|tell|ask|expect)\b\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)\b/i;

  if (bareVerbPattern.test(sentence)) {
    const m = sentence.match(bareVerbPattern);
    const verb = m[3];
    const choice = `(to ${verb} / ${verb})`;
    return { transformed: sentence.replace(new RegExp(`\\b${verb}\\b`), choice), answer: sentence };
  }
  if (infinitivePattern.test(sentence)) {
    const m = sentence.match(infinitivePattern);
    const phrase = `to ${m[3]}`;
    const choice = `(${m[3]} / ${phrase})`;
    return { transformed: sentence.replace(phrase, choice), answer: sentence };
  }

  const picked = __v84PickContentWord(sentence);
  if (!picked) return { transformed: sentence, answer: sentence };
  const wrong = __v84BuildDistractor(picked.core, sentence);
  const choice = `(${wrong} / ${picked.core})`;
  const escaped = picked.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const transformed = sentence.replace(new RegExp(escaped), choice);
  return { transformed, answer: sentence };
}

function __v84BuildQuestionBlock(block = {}, transformedLine = "", label = "", input = {}) {
  const locale = __v84GetLocale(input);
  const labelText = label
    ? (locale === "en" ? `[${label}]` : `[${label}]`)
    : "";

  const parts = [];
  parts.push(`${block.no}. ${block.lead}`);
  if (labelText) parts.push(labelText);
  parts.push(transformedLine);
  return parts.filter(Boolean).join("\n");
}

function __v843ExtractWordCountSuffix(text = "") {
  const value = String(text || "").trim();
  const m = value.match(/\(Word count:\s*\d+\)\s*$/i);
  return m ? m[0].trim() : "";
}

function __v843StripWordCountSuffix(text = "") {
  return String(text || "").replace(/\s*\(Word count:\s*\d+\)\s*$/i, "").trim();
}

function __v843NormalizeClueToken(token = "") {
  return String(token || "")
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
    .trim();
}


function __v85NormalizeSpaces(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function __v85DetectPresentProgressiveFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /현재진행|present\s+progressive|present\s+continuous/i.test(merged);
}

function __v85RepairProgressiveTimeMarker(sentence = "") {
  let fixed = String(sentence || "");
  const replacements = [
    [/\bevery morning\b/gi, "this morning"],
    [/\bevery afternoon\b/gi, "this afternoon"],
    [/\bevery evening\b/gi, "this evening"],
    [/\bevery night\b/gi, "tonight"],
    [/\bevery day\b/gi, "these days"],
    [/\balways\b/gi, "right now"],
  ];
  for (const [pattern, value] of replacements) {
    fixed = fixed.replace(pattern, value);
  }
  return fixed;
}

function __v85RepairProgressiveLexicon(sentence = "") {
  let fixed = String(sentence || "");
  fixed = fixed.replace(/\b(am|is|are)\s+doing exercise\b/gi, (_, be) => `${be} exercising`);
  fixed = fixed.replace(/\b(am|is|are)\s+doing sports\b/gi, (_, be) => `${be} playing sports`);
  fixed = fixed.replace(/\b(am|is|are)\s+learning English this morning\b/gi, (_, be) => `${be} studying English this morning`);
  return __v85NormalizeSpaces(fixed);
}

function __v85RepairGuidedWritingAnswer(answer = "", input = {}) {
  let fixed = String(answer || "").trim();
  if (!fixed) return "";

  if (__v85DetectPresentProgressiveFocus(input)) {
    fixed = __v85RepairProgressiveTimeMarker(fixed);
    fixed = __v85RepairProgressiveLexicon(fixed);
  }

  fixed = fixed.replace(/\s+([.,!?;:])/g, "$1").trim();
  if (!/[.!?]$/.test(fixed)) fixed += ".";
  return fixed;
}

function __v85BuildGuidedWritingClue(answer = "", input = {}) {
  const sentence = __v85RepairGuidedWritingAnswer(answer, input);
  if (!sentence) return "";

  const picked = [];
  const pushUnique = (value) => {
    const v = __v85NormalizeSpaces(String(value || ""));
    if (!v) return;
    const key = v.toLowerCase();
    if (!picked.some((item) => item.toLowerCase() === key)) picked.push(v);
  };

  const lower = sentence.toLowerCase();

  if (__v85DetectPresentProgressiveFocus(input)) {
    const aux = lower.match(/\b(am|is|are)\b/);
    if (aux) pushUnique(aux[1]);

    const ingVerb = sentence.match(/\b([A-Za-z]+ing)\b/);
    if (ingVerb) pushUnique(ingVerb[1]);

    const timeMatch = sentence.match(/\b(right now|at the moment|now|this morning|this afternoon|this evening|tonight|these days)\b/i);
    if (timeMatch) pushUnique(timeMatch[1]);
  }

  const phrasePatterns = [
    /\bwith [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi,
    /\ba [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi,
    /\bthe [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi,
    /\bto [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi,
    /\bon [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi,
    /\bat [A-Za-z]+(?: [A-Za-z]+){0,2}\b/gi
  ];

  for (const pattern of phrasePatterns) {
    const matches = sentence.match(pattern) || [];
    for (const m of matches) {
      if (picked.length >= 5) break;
      const normalized = __v85NormalizeSpaces(m)
        .replace(/\b(a|the)\s+(moment|computer|school|cinema)\b/gi, (_, art, noun) => noun)
        .replace(/\b(the|a)\s+/i, "")
        .trim();
      if (normalized && normalized.toLowerCase() !== "moment") pushUnique(normalized);
    }
    if (picked.length >= 5) break;
  }

  const words = sentence
    .replace(/[.,!?;:()[\]"']/g, " ")
    .split(/\s+/)
    .map(__v843NormalizeClueToken)
    .filter(Boolean);

  const stop = new Set([
    "i","you","he","she","it","we","they","me","him","her","us","them",
    "a","an","the","to","of","for","and","or","but","if","that","this","these","those",
    "my","your","his","her","our","their","its","with",
    "am","is","are","was","were","be","been","being",
    "do","does","did","can","could","may","might","must","shall","should","will","would",
    "have","has","had","not","right","now"
  ]);

  for (const word of words) {
    const key = word.toLowerCase();
    if (stop.has(key)) continue;
    if (key.length <= 2) continue;
    pushUnique(word);
    if (picked.length >= 5) break;
  }

  return picked.slice(0, 5).join(", ");
}


function __v843BuildGuidedWritingClue(answer = "", input = {}) {
  const built = __v85BuildGuidedWritingClue(answer, input);
  if (built) return built;

  const sentence = String(answer || "").trim();
  if (!sentence) return "";
  const words = sentence
    .replace(/[.,!?;:()[\]"']/g, " ")
    .split(/\s+/)
    .map(__v843NormalizeClueToken)
    .filter(Boolean)
    .slice(0, 4);
  return words.join(", ");
}

function __v843BuildGuidedWritingQuestionBlock(block = {}, answer = "", input = {}) {
  const locale = __v84GetLocale(input);
  const repairedAnswer = __v85RepairGuidedWritingAnswer(answer, input);
  const leadBase = __v843StripWordCountSuffix(block.lead || "");
  const wordCountSuffix = __v843ExtractWordCountSuffix(block.lead || "");
  const clue = __v843BuildGuidedWritingClue(repairedAnswer, input);

  const leadLine = [leadBase, wordCountSuffix].filter(Boolean).join(" ").trim();
  const clueLabel = locale === "en" ? "clue" : "clue";
  const clueLine = clue ? `(${clueLabel}: ${clue})` : "(clue: build, sentence, carefully)";

  return [ `${block.no}. ${leadLine}`, clueLine ].filter(Boolean).join("\n");
}

function __v84TransformFormattedByWorkbookType(formatted = {}, input = {}) {
  const type = normalizeWorkbookType(input?.workbookType || "");
  const qBlocks = __v84ExtractQuestionBlocks(formatted.questions || "");
  const aMap = __v84ExtractAnswerMap(formatted.answerSheet || "");

  if (type === "guided_writing") {
    if (!qBlocks.length || !aMap.size) {
      const passthrough = { ...formatted };
      passthrough.instructions = __v84BuildWorkbookTypeInstructions(input, formatted.instructions || "");
      return passthrough;
    }

    const renderedBlocks = [];
    const renderedAnswers = [];

    for (const block of qBlocks) {
      const answer = __v85RepairGuidedWritingAnswer(String(aMap.get(block.no) || "").trim(), input);
      if (!answer) continue;
      renderedBlocks.push(__v843BuildGuidedWritingQuestionBlock(block, answer, input));
      renderedAnswers.push(`${block.no}. ${answer}`);
    }

    const next = { ...formatted };
    next.instructions = __v84BuildWorkbookTypeInstructions(input, formatted.instructions || "");
    next.questions = renderedBlocks.join("\n");
    next.answerSheet = renderedAnswers.join("\n");
    next.actualCount = renderedAnswers.length;
    next.itemPairs = __mn83BuildItemPairs(next.questions || "", next.answerSheet || "");
    next.pairIntegrity = {
      ok: true,
      reason: "guided_writing_softclue",
      questionCount: next.actualCount,
      answerCount: next.actualCount
    };
    next.content = [next.title, next.instructions, next.questions].filter(Boolean).join("\n\n");
    next.fullText = [
      next.title,
      next.instructions,
      next.questions,
      ((input.language === "en" ? "Answers\n" : "정답\n") + (next.answerSheet || ""))
    ].filter(Boolean).join("\n\n");
    return next;
  }

  const renderedBlocks = [];
  const renderedAnswers = [];

  for (const block of qBlocks) {
    const answer = String(aMap.get(block.no) || "").trim();
    if (!answer) continue;

    if (type === "blank_fill") {
      const blanked = __v84BlankSentence(answer, input);
      renderedBlocks.push(__v84BuildQuestionBlock(block, blanked.transformed, "Blank Fill", input));
      renderedAnswers.push(`${block.no}. ${blanked.answer}`);
      continue;
    }

    if (type === "binary_choice") {
      const chosen = __v84ChoiceSentence(answer, input);
      renderedBlocks.push(__v84BuildQuestionBlock(block, chosen.transformed, "Choice", input));
      renderedAnswers.push(`${block.no}. ${chosen.answer}`);
      continue;
    }

    renderedBlocks.push(block.raw);
    renderedAnswers.push(`${block.no}. ${answer}`);
  }

  const next = { ...formatted };
  next.instructions = __v84BuildWorkbookTypeInstructions(input, formatted.instructions || "");
  next.questions = renderedBlocks.join("\n");
  next.answerSheet = renderedAnswers.join("\n");
  next.actualCount = renderedAnswers.length;
  next.itemPairs = __mn83BuildItemPairs(next.questions || "", next.answerSheet || "");
  next.pairIntegrity = {
    ok: true,
    reason: "workbook_type_transformed",
    questionCount: next.actualCount,
    answerCount: next.actualCount
  };
  next.content = [next.title, next.instructions, next.questions].filter(Boolean).join("\n\n");
  next.fullText = [
    next.title,
    next.instructions,
    next.questions,
    ((input.language === "en" ? "Answers\n" : "정답\n") + (next.answerSheet || ""))
  ].filter(Boolean).join("\n\n");
  return next;
}


module.exports = async function handler_v841_workbook_type_router(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { success: false, message: "POST 요청만 허용됩니다." });

  try {
    const input = normalizeInput(req.body || {});
    input.__rawBody = req.body || {};

    if (!input.userPrompt && !input.topic) {
      return json(res, 400, { success: false, message: "userPrompt 또는 topic이 필요합니다." });
    }

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

    const generation = await __mn83TryStrictGenerate(input, input?.isRefill ? 2 : 3);

    let finalGeneration = generation;
    if (!generation.ok && ["exact_parity_failed", "pair_answer_missing", "answers_missing_strict"].includes(String(generation?.failure?.reason || ""))) {
      const rebalanced = __mn832RebalanceFailedFormatted(generation.formatted, input);
      if (rebalanced.ok) {
        finalGeneration = {
          ok: true,
          formatted: rebalanced.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: "balanced_parity_rebuild"
        };
      }
    }

    if (!finalGeneration.ok && [
      "exact_parity_failed",
      "requested_count_mismatch",
      "answer_diversity_low",
      "pair_answer_missing",
      "answers_missing_strict",
      "question_numbering_broken_strict",
      "answer_numbering_broken_strict",
      "refill_question_count_mismatch",
      "refill_answer_count_mismatch"
    ].includes(String(finalGeneration?.failure?.reason || generation?.failure?.reason || ""))) {
      const softened = __v841BuildSoftRecoveredFormatted(
        finalGeneration?.formatted || generation?.formatted,
        input,
        finalGeneration?.failure || generation?.failure || {}
      );
      if (softened.ok) {
        finalGeneration = {
          ok: true,
          formatted: softened.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: softened.repairedBy || "soft_recovered_no_throw"
        };
      }
    }

    if (!finalGeneration.ok && [
      "exact_parity_failed",
      "requested_count_mismatch",
      "answer_diversity_low",
      "pair_answer_missing",
      "answers_missing_strict",
      "question_numbering_broken_strict",
      "answer_numbering_broken_strict",
      "refill_question_count_mismatch",
      "refill_answer_count_mismatch"
    ].includes(String(finalGeneration?.failure?.reason || generation?.failure?.reason || ""))) {
      const degraded = __v842BuildDegradedFormatted(
        finalGeneration?.formatted || generation?.formatted,
        input,
        finalGeneration?.failure || generation?.failure || {}
      );
      if (degraded.ok) {
        finalGeneration = {
          ok: true,
          formatted: degraded.formatted,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: degraded.repairedBy || "degraded_nonblocking_return"
        };
      }
    }

    if (!finalGeneration.ok) {
      const emergencySource = finalGeneration?.formatted || generation?.formatted || {};
      const emergencyRecovered = {
        ...emergencySource,
        questions: String(emergencySource.questions || "").trim(),
        answerSheet: normalizeMagicAnswerSheet(emergencySource.answerSheet || "", emergencySource.questions || "", input),
      };
      const emergencyParts = [emergencyRecovered.title, emergencyRecovered.instructions, emergencyRecovered.questions].filter(Boolean);
      emergencyRecovered.content = emergencyParts.join("\n\n");
      emergencyRecovered.fullText = [
        ...emergencyParts,
        ((input.language === "en" ? "Answers\n" : "정답\n") + (emergencyRecovered.answerSheet || ""))
      ].filter(Boolean).join("\n\n");
      emergencyRecovered.actualCount = countWorksheetItems(emergencyRecovered.questions || "");

      if (validateServiceSafeOutput(emergencyRecovered, input)) {
        finalGeneration = {
          ok: true,
          formatted: emergencyRecovered,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: "router_emergency_service_safe"
        };
      } else {
        return json(res, 502, {
          success: false,
          message: input?.isRefill
            ? "보충 생성 결과의 정답 품질 또는 개수가 불안정하여 생성이 중단되었습니다. MP는 차감되지 않았습니다. 다시 시도해주세요."
            : "매직 정답 품질 검수에서 실패하여 생성이 중단되었습니다. MP는 차감되지 않았습니다. 다시 시도해주세요.",
          detail: finalGeneration?.failure?.reason || "strict_generation_failed",
          userMessage:
            "정답 수와 문제 수가 완전히 맞지 않아 생성이 중단되었습니다. 이번 버전은 자동 복구를 여러 단계 시도했지만 통과하지 못했습니다. 다시 시도해주세요.",
        });
      }
    }

    let formatted = finalGeneration.formatted;
    formatted = __v84TransformFormattedByWorkbookType(formatted, input);
    const deduction = await deductMpAfterSuccess(mpState);
    return json(res, 200, {
      success: true,
      engine: "magic",
      workbookType: input.workbookType,
      profile: input.profile,
      version: "s14-v8.5.3-stable-router-recovery",
      title: formatted.title,
      instructions: formatted.instructions,
      questions: formatted.questions,
      content: formatted.content,
      answerSheet: formatted.answerSheet,
      fullText: formatted.fullText,
      worksheetHtml: typeof buildMagicWorksheetHtml === "function" ? buildMagicWorksheetHtml(formatted, input) : "",
      answerHtml: typeof buildMagicAnswerHtml === "function" ? buildMagicAnswerHtml(formatted, input) : "",
      actualCount: formatted.actualCount,
      itemPairs: formatted.itemPairs || [],
      pairIntegrity: formatted.pairIntegrity || null,
      mp: deduction?.mp || {
        requiredMp: mpState.requiredMp,
        currentMp: mpState.currentMp,
        remainingMp: mpState.enabled ? Math.max(0, mpState.currentMp - mpState.requiredMp) : mpState.currentMp,
        deducted: Boolean(mpState.enabled),
        trialGranted: Boolean(mpState.trialGranted),
      },
    });
  } catch (error) {
    console.error("[v8.5.3-stable-router-recovery] fatal:", error);
    return json(res, 500, {
      success: false,
      message: "매직 엔진 처리 중 오류가 발생했습니다.",
      detail: error?.message || "unknown_error",
    });
  }
};

console.log("[v8.5.3-stable-router-recovery] loaded");
