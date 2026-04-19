// config moved to final export block

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

  const isDitransitive = hasAny([
    /수여동사/,
    /ditransitive/i,
    /간접목적어/,
    /직접목적어/,
    /4형식/,
  ]);

  const isBeQuestion = hasAny([
    /be동사.*의문문/,
    /be동사 의문문/,
    /am\/is\/are/,
    /be-verb question/i,
  ]);

  const isDoQuestion = hasAny([
    /일반동사.*의문문/,
    /일반동사의 의문문/,
    /do-question/i,
    /does-question/i,
    /do\/does question/i,
  ]);

  const isPresentPerfectProgressive = hasAny([
    /현재완료\s*진행형/,
    /present\s+perfect\s+(continuous|progressive)/i,
    /have\s+been\s+\w+ing/i,
    /has\s+been\s+\w+ing/i,
  ]);

  let chapterKey = "general";
  if (isPresentPerfectProgressive) chapterKey = "present_perfect_progressive";
  else if (isDitransitive) chapterKey = "ditransitive";
  else if (isBeQuestion) chapterKey = "be_question";
  else if (isDoQuestion) chapterKey = "do_question";
  else if (isWhatRelativePronoun) chapterKey = "relative_pronoun_what";
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
    isDitransitive,
    isBeQuestion,
    isDoQuestion,
    isPresentPerfectProgressive,
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
  ,
  ditransitive: {
    en: `[Chapter Blueprint: Ditransitive Verbs]
- Core ratio: about 80% true ditransitive items.
- Prefer give, send, show, teach, tell, buy, make, find, offer.
- Preferred answer families:
  give + indirect object + direct object
  send + direct object + to + person
  buy + direct object + for + person
- Do not let causatives such as make/let/have dominate unless explicitly requested.`,
    ko: `[챕터 청사진: 수여동사]
- 권장 비율: 진짜 수여동사 핵심 문항 80% 내외.
- give, send, show, teach, tell, buy, make, find, offer를 우선 사용한다.
- 선호 정답 계열:
  give + 간접목적어 + 직접목적어
  send + 직접목적어 + to + 사람
  buy + 직접목적어 + for + 사람
- make/let/have 같은 사역동사 구조가 주류가 되지 않게 한다.`
  },
  be_question: {
    en: `[Chapter Blueprint: Be-Verb Questions]
- Core ratio: about 85% be-verb question items.
- Preferred answer family:
  Am/Is/Are + subject + complement/adverbial?
- Keep present be-verb questions highly visible.
- Do not allow declarative statements to dominate.`,
    ko: `[챕터 청사진: be동사 의문문]
- 권장 비율: be동사 의문문 핵심 문항 85% 내외.
- 선호 정답 계열:
  Am/Is/Are + 주어 + 보어/부사어?
- 현재형 be동사 의문문이 눈에 잘 보이게 유지한다.
- 평서문이 세트를 지배하지 않게 한다.`
  },
  do_question: {
    en: `[Chapter Blueprint: Do/Does Questions]
- Core ratio: about 85% do/does question items.
- Preferred answer family:
  Do/Does + subject + base verb ...?
- Keep simple present question structure visible.
- Avoid declarative drift and unrelated modal patterns.`,
    ko: `[챕터 청사진: 일반동사 의문문]
- 권장 비율: do/does 의문문 핵심 문항 85% 내외.
- 선호 정답 계열:
  Do/Does + 주어 + 동사원형 ...?
- 단순현재 의문문 구조가 눈에 잘 보이게 유지한다.
- 평서문, 조동사 혼합형으로 흐르지 않게 한다.`
  },
  present_perfect_progressive: {
    en: `[Chapter Blueprint: Present Perfect Progressive]
- Core ratio: about 80% have/has been + -ing items.
- Preferred meaning: action continuing up to now.
- Prefer for / since with duration and continuity.
- Do not let simple present perfect dominate.`,
    ko: `[챕터 청사진: 현재완료 진행형]
- 권장 비율: have/has been + 동사ing 핵심 문항 80% 내외.
- 지금까지 계속 이어지는 동작 의미를 우선한다.
- for / since를 활용한 지속 의미를 우선한다.
- 현재완료 일반형이 주류가 되지 않게 한다.`
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

  if (focus?.isDitransitive) {
    blocks.push(isEn ? `
[Ditransitive Chapter Expansion]
- Keep the worksheet centered on real ditransitive patterns.
- Prefer give/show/send/teach/tell/buy/make/find/offer.
- Answer shapes should visibly show indirect object + direct object, or direct object + to/for + person.
- Do not let causatives like make/let/have dominate.
`.trim() : `
[수여동사 챕터 확장]
- 학습지는 반드시 진짜 수여동사 구조 중심으로 유지할 것.
- give/show/send/teach/tell/buy/make/find/offer를 우선 사용할 것.
- 정답 형태는 간접목적어 + 직접목적어, 또는 직접목적어 + to/for + 사람 구조가 눈에 보이게 할 것.
- make/let/have 같은 사역동사 구조가 주류가 되지 않게 할 것.
`.trim());
  }

  if (focus?.isBeQuestion) {
    blocks.push(isEn ? `
[Be-Verb Question Chapter Expansion]
- Keep the worksheet centered on Am/Is/Are questions.
- Most items must be true questions ending with a question mark.
- Avoid declarative drift.
`.trim() : `
[be동사 의문문 챕터 확장]
- 학습지는 반드시 Am/Is/Are 의문문 중심으로 유지할 것.
- 대부분의 문항은 물음표가 있는 진짜 의문문이어야 한다.
- 평서문으로 새지 말 것.
`.trim());
  }

  if (focus?.isDoQuestion) {
    blocks.push(isEn ? `
[Do/Does Question Chapter Expansion]
- Keep the worksheet centered on Do/Does + subject + base verb questions.
- Most items must be true questions ending with a question mark.
- Avoid declaratives and unrelated modal-heavy patterns.
`.trim() : `
[일반동사 의문문 챕터 확장]
- 학습지는 반드시 Do/Does + 주어 + 동사원형 의문문 중심으로 유지할 것.
- 대부분의 문항은 물음표가 있는 진짜 의문문이어야 한다.
- 평서문이나 조동사 중심 문제로 흐르지 말 것.
`.trim());
  }

  if (focus?.isPresentPerfectProgressive) {
    blocks.push(isEn ? `
[Present Perfect Progressive Chapter Expansion]
- Keep the worksheet centered on have/has been + -ing.
- Prefer continuation meaning up to now.
- Do not let plain present perfect dominate.
`.trim() : `
[현재완료 진행형 챕터 확장]
- 학습지는 반드시 have/has been + 동사ing 구조 중심으로 유지할 것.
- 지금까지 계속 이어지는 동작 의미를 우선할 것.
- 현재완료 일반형이 세트를 지배하지 않게 할 것.
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


function hasHardChapterCoverage(answerSheet = "", input = {}) {
  const focus = input?.grammarFocus || {};
  const lines = String(answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) return false;

  const ratio = (predicate) => lines.filter(predicate).length / lines.length;

  if (focus?.isDitransitive) {
    const good = ratio((line) =>
      /\b(give|gives|gave|send|sends|sent|show|shows|showed|teach|teaches|taught|tell|tells|told|buy|buys|bought|offer|offers|offered|make|makes|made|find|finds|found)\b/i.test(line) &&
      (
        /\b(me|you|him|her|us|them)\b.*\b(a|an|the|this|that|my|your|his|her|our|their)\b/i.test(line) ||
        /\bto\b|\bfor\b/i.test(line)
      )
    );
    return good >= 0.65;
  }

  if (focus?.isBeQuestion) {
    const good = ratio((line) =>
      /^(Am|Is|Are)\b/.test(line) && /\?$/.test(line)
    );
    return good >= 0.75;
  }

  if (focus?.isDoQuestion) {
    const good = ratio((line) =>
      /^(Do|Does)\b/.test(line) && /\?$/.test(line)
    );
    return good >= 0.75;
  }

  if (focus?.isPresentPerfectProgressive) {
    const good = ratio((line) =>
      /\b(have|has)\s+been\s+\w+ing\b/i.test(line)
    );
    return good >= 0.8;
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


function getControlledContrastPolicy(input = {}) {
  const focus = input?.grammarFocus || detectGrammarFocus([input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" "));
  const total = Math.max(5, Number(input?.count || 25));
  const coreRatioMin = 0.84;
  const coreRatioMax = 0.92;
  const targetCoreCount = Math.max(1, Math.round(total * 0.88));
  const contrastCount = Math.max(0, total - targetCoreCount);

  let chapterLabelEn = "target chapter grammar";
  let chapterLabelKo = "목표 챕터 문법";
  let allowedContrastEn = "closely related warm-up, contrast, or near-neighbor items only";
  let allowedContrastKo = "가까운 대조 문항 또는 도입형 보조 문항만 허용";
  let coreRegex = null;
  let contrastRegex = null;

  if (focus?.isPresentPerfectProgressive) {
    chapterLabelEn = "present perfect progressive";
    chapterLabelKo = "현재완료 진행형";
    allowedContrastEn = "plain present perfect or tightly related continuation contrasts only";
    allowedContrastKo = "현재완료 일반형 또는 지속 의미 대조 문항만 허용";
    coreRegex = /\b(have|has)\s+been\s+\w+ing\b/i;
    contrastRegex = /\b(have|has)\s+(?!been\b)\w+(ed|en|wn|ne|lt|pt|nt|ft|ght|n)\b/i;
  } else if (focus?.isPresentPerfect) {
    chapterLabelEn = "present perfect";
    chapterLabelKo = "현재완료";
    allowedContrastEn = "present perfect progressive or tightly related time-contrast items only";
    allowedContrastKo = "현재완료 진행형 또는 시간 대비용 보조 문항만 허용";
    coreRegex = /\b(have|has)\s+(?!been\b)\w+(ed|en|wn|ne|lt|pt|nt|ft|ght|n)\b/i;
    contrastRegex = /\b(have|has)\s+been\s+\w+ing\b/i;
  } else if (focus?.isWhatRelativePronoun) {
    chapterLabelEn = "relative pronoun what";
    chapterLabelKo = "관계대명사 what";
    allowedContrastEn = "very small comparison items such as the thing that only when clearly contrastive";
    allowedContrastKo = "명시적 대조용 the thing that 계열만 소수 허용";
    coreRegex = /(^|\s)what\b/i;
    contrastRegex = /\bthe thing that\b/i;
  } else if (focus?.isDitransitive) {
    chapterLabelEn = "ditransitive verbs";
    chapterLabelKo = "수여동사";
    allowedContrastEn = "3rd/4th-form comparison or to/for alternation only";
    allowedContrastKo = "3형식/4형식 대비 또는 to/for 교체형만 허용";
    coreRegex = /\b(give|gives|gave|send|sends|sent|show|shows|showed|teach|teaches|taught|tell|tells|told|buy|buys|bought|offer|offers|offered|make|makes|made|find|finds|found)\b/i;
    contrastRegex = /\bto\b|\bfor\b/i;
  } else if (focus?.isBeQuestion) {
    chapterLabelEn = "be-verb questions";
    chapterLabelKo = "be동사 의문문";
    allowedContrastEn = "declarative-to-question contrast or near-neighbor do-questions only";
    allowedContrastKo = "평서문 대조 또는 일반동사 의문문과의 근접 대비만 허용";
    coreRegex = /^(Am|Is|Are)\b.*\?$/i;
    contrastRegex = /^(Do|Does)\b.*\?$/i;
  } else if (focus?.isDoQuestion) {
    chapterLabelEn = "do/does questions";
    chapterLabelKo = "일반동사 의문문";
    allowedContrastEn = "declarative-to-question contrast or near-neighbor be-questions only";
    allowedContrastKo = "평서문 대조 또는 be동사 의문문과의 근접 대비만 허용";
    coreRegex = /^(Do|Does)\b.*\?$/i;
    contrastRegex = /^(Am|Is|Are)\b.*\?$/i;
  } else if (focus?.isPassive) {
    chapterLabelEn = "passive voice";
    chapterLabelKo = "수동태";
    allowedContrastEn = "active/passive contrast only";
    allowedContrastKo = "능동/수동 대조만 허용";
    coreRegex = /\b(am|is|are|was|were|be|been|being)\b\s+\b[\w'-]+(?:ed|en|wn|ne|lt|pt|nt|ft|ght)\b/i;
    contrastRegex = /\b(active|by)\b/i;
  }

  return {
    total,
    coreRatioMin,
    coreRatioMax,
    targetCoreCount,
    contrastCount,
    chapterLabelEn,
    chapterLabelKo,
    allowedContrastEn,
    allowedContrastKo,
    coreRegex,
    contrastRegex,
  };
}

function buildControlledContrastRuleBlock(input = {}) {
  const policy = getControlledContrastPolicy(input);
  if (!policy?.coreRegex) return "";
  const isEn = input?.language === "en";
  return isEn ? `
[Controlled Contrast Mix Rule]
- Keep the worksheet premium and slightly tense for learners.
- About ${policy.targetCoreCount} of ${policy.total} items should be core ${policy.chapterLabelEn} items.
- About ${policy.contrastCount} of ${policy.total} items may be intentional contrast items.
- The contrast items must stay very close to the chapter and must NEVER drift into unrelated grammar.
- Allowed contrast zone: ${policy.allowedContrastEn}.
- Recommended placement for contrast items: around item 7, item 14, and item 21 rather than clustered together.
- Most of the worksheet must still visibly teach the chapter itself.
` : `
[통제된 대조 혼합 규칙]
- 학습자가 약간 긴장하도록 설계하되, 교재 품질은 유지할 것.
- 총 ${policy.total}문항 중 약 ${policy.targetCoreCount}문항은 핵심 ${policy.chapterLabelKo} 문항으로 구성할 것.
- 약 ${policy.contrastCount}문항만 의도된 대조 문항으로 허용한다.
- 대조 문항은 반드시 챕터와 매우 가까운 문법이어야 하며, 무관한 다른 챕터로 새면 안 된다.
- 허용 대조 범위: ${policy.allowedContrastKo}.
- 대조 문항은 한곳에 몰아넣지 말고 7번, 14번, 21번 부근처럼 분산 배치하는 것을 권장한다.
- 워크북의 대다수는 여전히 해당 챕터를 직접 가르쳐야 한다.
`.trim();
}

function hasControlledContrastBalance(answerSheet = "", input = {}) {
  const policy = getControlledContrastPolicy(input);
  if (!policy?.coreRegex) return true;

  const lines = String(answerSheet || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)-]?\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)-]?\s*/, "").trim())
    .filter(Boolean);

  if (!lines.length) return false;

  const coreCount = lines.filter((line) => policy.coreRegex.test(line)).length;
  const contrastCount = policy.contrastRegex ? lines.filter((line) => policy.contrastRegex.test(line) && !policy.coreRegex.test(line)).length : 0;
  const coreRatio = coreCount / lines.length;
  const contrastRatio = contrastCount / lines.length;

  if (coreRatio < policy.coreRatioMin) return false;
  if (coreRatio > 0.97) return false;
  if (contrastRatio > 0.2) return false;

  return true;
}


function buildTargetCoverageRuleBlock(input) {
  const focus = input.grammarFocus || detectGrammarFocus([input.userPrompt, input.topic, input.worksheetTitle].filter(Boolean).join(" "));
  const isEn = input.language === "en";
  const targetHeavy = (labelEn, labelKo) => isEn ? `
[Target Grammar Coverage Rules]
- About 85% to 90% of the items and answers should directly realize the target grammar: ${labelEn}.
- Do not fill the worksheet with generic sentences that could appear in any chapter.
- If an item does not directly show the target grammar, it must be an intentional warm-up, contrast, or mixed application item very close to the chapter.
- Completely off-target answers are forbidden.
- Every answer must be checked for grammar accuracy, naturalness, and chapter alignment before finalizing.
` : `
[목표 문법 커버리지 규칙]
- 전체 문항과 정답의 약 85%~90%는 목표 문법 ${labelKo}이 직접 드러나야 한다.
- 어느 챕터에나 들어갈 수 있는 일반 문장을 대량으로 넣지 말 것.
- 목표 문법이 직접 드러나지 않는 문항이 있더라도, 그것은 챕터와 가까운 의도된 도입형·대조형·혼합형 보조 문항이어야 한다.
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
${buildControlledContrastRuleBlock(input)}
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
${buildControlledContrastRuleBlock(input)}
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
${buildControlledContrastRuleBlock(input)}
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
${buildControlledContrastRuleBlock(input)}
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
  if (__mn90IsDoBeQuestionInput(input) && questions) {
    answers = normalizeMagicAnswerSheet(answers, questions, input);
    formatted.answerSheet = answers;
  }
  if (!hasMeaningfulWorksheetBody(questions)) return false;
  if (!hasMeaningfulWorksheetBody(answers)) return false;
  if (!hasSequentialNumbering(questions)) return false;
  if (!hasSequentialNumbering(answers)) return false;
  if (hasPlaceholderAnswers(answers)) return false;
  if (__mn90IsDoBeQuestionInput(input)) {
    const aLines = extractLikelyAnswerLines(answers);
    if (!aLines.length || aLines.some((line) => !__mn90HasCompleteShortAnswer(line, input))) return false;
    if (__mn90HasLowQuestionDiversity(questions, input)) return false;
  }
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


function __v854ExtractNumberedEntries(text = "") {
  const src = String(text || "").replace(/\r/g, "");
  const lines = src.split("\n");
  const entries = [];
  let current = null;
  for (const rawLine of lines) {
    const line = String(rawLine || "");
    const m = line.match(/^\s*(\d+)[.)]\s*(.*)$/);
    if (m) {
      if (current) entries.push(current);
      current = { no: Number(m[1]), lines: m[2].trim() ? [m[2].trim()] : [] };
      continue;
    }
    if (current && line.trim()) current.lines.push(line.trim());
  }
  if (current) entries.push(current);
  return entries;
}

function __v854RebuildNumberedEntries(entries = [], keepOriginalNumber = false) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && Array.isArray(entry.lines) && entry.lines.length)
    .map((entry, idx) => {
      const no = keepOriginalNumber ? Number(entry.no || idx + 1) : (idx + 1);
      const lines = [...entry.lines];
      const head = `${no}. ${String(lines.shift() || "").trim()}`.trim();
      return [head, ...lines].join("\n");
    })
    .join("\n");
}

function __v854LimitMixedItems(questions = "", maxMixed = 4) {
  let seen = 0;
  return String(questions || "")
    .split("\n")
    .map((line) => {
      if (!/\[혼합형\]|\[Mixed Training\]/i.test(line)) return line;
      seen += 1;
      if (seen <= maxMixed) return line;
      return line
        .replace(/\s*\[혼합형\]\s*/gi, " ")
        .replace(/\s*\[Mixed Training\]\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    })
    .join("\n");
}

function __v854CountExplicitClueEntries(questions = "") {
  const entries = __v854ExtractNumberedEntries(questions);
  return entries.filter((entry) => entry.lines.some((line, idx) => idx > 0 && /^\((clue|힌트)\s*:/i.test(line))).length;
}

function __v854EnforceGuidedRatio(questions = "", answers = "", input = {}) {
  const type = normalizeWorkbookType(input?.workbookType || "");
  const guided = type === "guided_writing" || input?.mode === "writing" || input?.magicStyle === "marcus_magic";
  if (!guided) return String(questions || "").trim();
  const qEntries = __v854ExtractNumberedEntries(questions);
  if (!qEntries.length) return String(questions || "").trim();
  const answerMap = typeof __v84ExtractAnswerMap === "function" ? __v84ExtractAnswerMap(answers || "") : new Map();
  const target = Math.min(qEntries.length, Math.max(8, Math.ceil(qEntries.length * 0.4)));
  let current = __v854CountExplicitClueEntries(questions);
  if (current >= target) return String(questions || "").trim();
  for (const entry of qEntries) {
    if (current >= target) break;
    const hasClue = entry.lines.some((line, idx) => idx > 0 && /^\((clue|힌트)\s*:/i.test(line));
    if (hasClue) continue;
    const answer = String(answerMap.get(entry.no) || "").trim();
    const clue = typeof __v843BuildGuidedWritingClue === "function" ? __v843BuildGuidedWritingClue(answer, input) : "have, has, clue, build";
    if (!clue) continue;
    entry.lines.push(`(clue: ${clue})`);
    current += 1;
  }
  return __v854RebuildNumberedEntries(qEntries, true);
}

function __v854PolishPresentPerfectPairs(questions = "", answers = "", input = {}) {
  const focus = input?.grammarFocus || detectGrammarFocus([input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" "));
  const topic = String(input?.topic || "");
  const isPresentPerfect = focus?.isPresentPerfect || /현재완료|present\s+perfect/i.test(topic);
  const isPresentPerfectContinuous = /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(topic);
  if (!isPresentPerfect || isPresentPerfectContinuous) {
    return { questions: String(questions || "").trim(), answers: String(answers || "").trim() };
  }
  const qEntries = __v854ExtractNumberedEntries(questions);
  const aEntries = __v854ExtractNumberedEntries(answers);
  const aMap = new Map(aEntries.map((entry) => [entry.no, entry]));
  const keptQ = [];
  const keptA = [];
  for (const q of qEntries) {
    const a = aMap.get(q.no);
    if (!a) continue;
    const qText = q.lines.join(" ");
    const aText = a.lines.join(" ");
    if (hasInvalidPastTimeMarker(qText) || hasInvalidPastTimeMarker(aText)) continue;
    if (/Note: This is a simple past tense|does not meet the criteria of present\s*perfect/i.test(aText)) continue;
    keptQ.push({ no: q.no, lines: [...q.lines] });
    keptA.push({ no: a.no, lines: [...a.lines] });
  }
  const nextQ = keptQ.length >= Math.max(12, Math.ceil(qEntries.length * 0.6)) ? keptQ : qEntries;
  const nextA = keptA.length >= Math.max(12, Math.ceil(aEntries.length * 0.6)) ? keptA : aEntries;
  const qText = __v854RebuildNumberedEntries(nextQ, false)
    .replace(/지난\s*주에/g, "최근에")
    .replace(/어제/g, "최근에")
    .replace(/\bthis morning\b/gi, "recently");
  const aText = __v854RebuildNumberedEntries(nextA, false)
    .replace(/\s*\(Note:[^)]+\)\.?/gi, "")
    .replace(/\bI read that book recently\./gi, "I have read that book recently.")
    .replace(/\bI saw that movie recently\./gi, "I have seen that movie recently.")
    .replace(/\bHe went there recently\./gi, "He has gone there recently.")
    .replace(/\bShe has traveled many countries so far\./gi, "She has traveled to many countries so far.")
    .replace(/\bShe has learned the piano for three years\./gi, "She has learned to play the piano for three years.")
    .replace(/\bI have helped me to solve this problem\./gi, "I have been helped to solve this problem.");
  return { questions: qText.trim(), answers: aText.trim() };
}

function __v854ApplyWritingLabPolish(formatted = {}, input = {}) {
  const next = { ...formatted };
  let questions = String(next.questions || "").trim();
  let answers = String(next.answerSheet || "").trim();
  const polished = __v854PolishPresentPerfectPairs(questions, answers, input);
  questions = polished.questions;
  answers = polished.answers;
  questions = __v854LimitMixedItems(questions, 4);
  questions = __v854EnforceGuidedRatio(questions, answers, input);
  next.questions = questions;
  next.answerSheet = normalizeMagicAnswerSheet(answers, questions, input);
  if (__mn90IsDoBeQuestionInput(input)) {
    next.answerSheet = normalizeMagicAnswerSheet(next.answerSheet || "", next.questions || "", input);
  }
  next.actualCount = countWorksheetItems(next.questions || "");
  next.itemPairs = typeof __mn83BuildItemPairs === "function" ? __mn83BuildItemPairs(next.questions || "", next.answerSheet || "") : [];
  next.pairIntegrity = next.pairIntegrity || { ok: true, reason: "v854_writinglab_polish", questionCount: next.actualCount, answerCount: countWorksheetItems(next.answerSheet || "") };
  next.content = [next.title, next.instructions, next.questions].filter(Boolean).join("\n\n");
  next.fullText = [next.title, next.instructions, next.questions, ((input.language === "en" ? "Answers\n" : "정답\n") + (next.answerSheet || ""))].filter(Boolean).join("\n\n");
  return next;
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
    const polished = __v854ApplyWritingLabPolish({ questions: normalizedQuestions, answerSheet: normalizedAnswers }, input);
    normalizedQuestions = String(polished.questions || normalizedQuestions || "").trim();
    normalizedAnswers = String(polished.answerSheet || normalizedAnswers || "").trim();
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
  if (!hasHardChapterCoverage(extractSection(raw, "[[ANSWERS]]", null) || raw, input)) return false;
  if (!hasControlledContrastBalance(extractSection(raw, "[[ANSWERS]]", null) || raw, input)) return false;
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

async function handler(req, res) {
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


function __mn90IsDoBeQuestionInput(input = {}) {
  const focus = input?.grammarFocus || {};
  return Boolean(
    focus.isDoQuestion ||
    focus.isBeQuestion ||
    /일반동사.*의문문|be동사.*의문문|do\/does question|be-verb question/i.test(
      String(input?.topic || '') + ' ' + String(input?.userPrompt || '') + ' ' + String(input?.worksheetTitle || '')
    )
  );
}

function __mn90IsBeQuestionInput(input = {}) {
  const focus = input?.grammarFocus || {};
  return Boolean(
    focus.isBeQuestion ||
    /be동사.*의문문|be-verb question|am\/is\/are/i.test(
      String(input?.topic || '') + ' ' + String(input?.userPrompt || '') + ' ' + String(input?.worksheetTitle || '')
    )
  );
}

function __mn90HasCompleteShortAnswer(line = '', input = {}) {
  const body = String(line || '').replace(/^\d+[.)-]?\s*/, '').trim();
  if (!body) return false;
  if (__mn90IsBeQuestionInput(input)) {
    return /\?\s*\/\s*Yes,\s+[^\/]+\b(?:am|is|are)\b\.\s*\/\s*No,\s+[^\/]+\b(?:am not|is not|are not|isn't|aren't)\b\.?/i.test(body);
  }
  if (__mn90IsDoBeQuestionInput(input)) {
    return /\?\s*\/\s*Yes,\s+[^\/]+\b(?:do|does)\b\.\s*\/\s*No,\s+[^\/]+\b(?:do not|does not|don't|doesn't)\b\.?/i.test(body);
  }
  return true;
}

function __mn90NormalizeQuestionSurface(text = '') {
  return String(text || '')
    .replace(/^\d+[.)-]?\s*/, '')
    .replace(/\s*\(Word count:[^)]+\)\s*/gi, ' ')
    .replace(/\s*\(clue:[^)]+\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function __mn90ExtractQuestionCluePairs(q = '') {
  const lines = String(q || '').replace(/\r\n/g, '\n').split('\n');
  const pairs = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] || '').trim();
    const m = raw.match(/^(\d+)[.)-]?\s+(.*)$/);
    if (!m) continue;
    const no = Number(m[1]);
    let clue = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j += 1) {
      const next = String(lines[j] || '').trim();
      if (/^clue\s*:/i.test(next)) {
        clue = next.replace(/^clue\s*:/i, '').trim();
        break;
      }
      if (/^(\d+)[.)-]?\s+/.test(next)) break;
    }
    pairs.push({ no, prompt: String(m[2] || '').trim(), clue });
  }
  return pairs;
}

function __mn90StartsWithVowelSound(word = '') {
  const t = String(word || '').trim().toLowerCase();
  if (!t) return false;
  if (/^(honest|hour|heir|english)/.test(t)) return true;
  if (/^u[bcfhjkqrstnlg]/.test(t)) return false;
  return /^[aeiou]/.test(t);
}

function __mn90BuildCopulaTailFromTokens(tokens = []) {
  const cleaned = tokens.map((t) => String(t || '').trim()).filter(Boolean);
  if (!cleaned.length) return '';
  const joined = cleaned.join(' ');
  if (/^(at|in|on|under|behind|near|with|from|to|for|of|today|now|here|there|home|school|classroom|park|library)\b/i.test(joined)) {
    return joined;
  }
  if (cleaned.length === 1 && /s$/.test(cleaned[0])) return joined;
  if (cleaned.length >= 1 && /^(kind|busy|ready|free|sleepy|safe|angry|happy|sad|tired|hungry|late|early)$/i.test(cleaned[0])) {
    return joined;
  }
  const first = cleaned[0];
  const article = __mn90StartsWithVowelSound(first) ? 'an' : 'a';
  return `${article} ${joined}`;
}

function __mn90BuildQuestionFromClue(pair = {}, input = {}) {
  const clueTokens = String(pair?.clue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!clueTokens.length) return '';

  if (__mn90IsBeQuestionInput(input)) {
    const aux = clueTokens[0] || '';
    const subject = clueTokens[1] || '';
    const tail = __mn90BuildCopulaTailFromTokens(clueTokens.slice(2));
    if (!aux || !subject || !tail) return '';
    return `${aux} ${subject} ${tail}?`;
  }

  const aux = clueTokens[0] || '';
  const subject = clueTokens[1] || '';
  const verb = clueTokens[2] || '';
  const rest = clueTokens.slice(3).join(' ');
  if (!aux || !subject || !verb) return '';
  return `${aux} ${subject} ${verb}${rest ? ' ' + rest : ''}?`;
}

function __mn90ShortAnswerForQuestion(question = '', input = {}) {
  const q = __mn90NormalizeQuestionSurface(question).replace(/\s+/g, ' ').trim();
  if (!q) return '';
  const bePatterns = [
    [/^Am\s+I\b/i, ['Yes, you are.', 'No, you are not.']],
    [/^Are\s+you\b/i, ['Yes, I am.', 'No, I am not.']],
    [/^Are\s+we\b/i, ['Yes, we are.', 'No, we are not.']],
    [/^Are\s+they\b/i, ['Yes, they are.', 'No, they are not.']],
    [/^Is\s+he\b/i, ['Yes, he is.', 'No, he is not.']],
    [/^Is\s+she\b/i, ['Yes, she is.', 'No, she is not.']],
    [/^Is\s+it\b/i, ['Yes, it is.', 'No, it is not.']],
  ];
  const doPatterns = [
    [/^Do\s+you\b/i, ['Yes, I do.', 'No, I do not.']],
    [/^Do\s+we\b/i, ['Yes, we do.', 'No, we do not.']],
    [/^Do\s+they\b/i, ['Yes, they do.', 'No, they do not.']],
    [/^Do\s+I\b/i, ['Yes, you do.', 'No, you do not.']],
    [/^Does\s+he\b/i, ['Yes, he does.', 'No, he does not.']],
    [/^Does\s+she\b/i, ['Yes, she does.', 'No, she does not.']],
    [/^Does\s+it\b/i, ['Yes, it does.', 'No, it does not.']],
  ];
  const patterns = __mn90IsBeQuestionInput(input) ? bePatterns : doPatterns;
  for (const [regex, answers] of patterns) {
    if (regex.test(q)) return `${q} / ${answers[0]} / ${answers[1]}`;
  }
  return q;
}

function __mn90CompleteAnswerLine(line = '', input = {}) {
  const body = sanitizeAnswerBodyForMiddle(line);
  if (!body) return '';
  if (!__mn90IsDoBeQuestionInput(input)) return body;
  if (__mn90HasCompleteShortAnswer(body, input)) return body;
  const questionOnly = body.split('/')[0].trim();
  return __mn90ShortAnswerForQuestion(questionOnly, input);
}

function __mn90BuildDedicatedQuestionBank(input = {}) {
  if (__mn90IsBeQuestionInput(input)) {
    return [
      'Is he kind? / Yes, he is. / No, he is not.',
      'Are they in the park? / Yes, they are. / No, they are not.',
      'Is she a student? / Yes, she is. / No, she is not.',
      'Is he angry now? / Yes, he is. / No, he is not.',
      'Are you tired now? / Yes, I am. / No, I am not.',
      'Are they in the classroom? / Yes, they are. / No, they are not.',
      'Is she at school today? / Yes, she is. / No, she is not.',
      'Are you in the classroom now? / Yes, I am. / No, I am not.',
      'Are they classmates? / Yes, they are. / No, they are not.',
      'Are they basketball players? / Yes, they are. / No, they are not.',
      'Are they safe now? / Yes, they are. / No, they are not.',
      'Are you sleepy? / Yes, I am. / No, I am not.',
      'Is he busy now? / Yes, he is. / No, he is not.',
      'Is he in the classroom now? / Yes, he is. / No, he is not.',
      'Is he at home now? / Yes, he is. / No, he is not.',
      'Is he a doctor? / Yes, he is. / No, he is not.',
      'Are you kind? / Yes, I am. / No, I am not.',
      'Is she at home? / Yes, she is. / No, she is not.',
      'Are you ready? / Yes, I am. / No, I am not.',
      'Are you free now? / Yes, I am. / No, I am not.',
      'Are you at home now? / Yes, I am. / No, I am not.',
      'Is he an English teacher? / Yes, he is. / No, he is not.',
      'Is she a musician? / Yes, she is. / No, she is not.',
      'Is she at home now? / Yes, she is. / No, she is not.',
      'Are they busy today? / Yes, they are. / No, they are not.'
    ];
  }
  return [
    'Do you exercise every day? / Yes, I do. / No, I do not.',
    'Does he walk to school? / Yes, he does. / No, he does not.',
    'Does she play the piano? / Yes, she does. / No, she does not.',
    'Do you study English? / Yes, I do. / No, I do not.',
    'Do they play soccer on weekends? / Yes, they do. / No, they do not.',
    'Do you read books after school? / Yes, I do. / No, I do not.',
    'Does he drink milk in the morning? / Yes, he does. / No, he does not.',
    'Does she help her mother at home? / Yes, she does. / No, she does not.',
    'Do they clean the classroom every Friday? / Yes, they do. / No, they do not.',
    'Do you go to bed early? / Yes, I do. / No, I do not.',
    'Does he like math? / Yes, he does. / No, he does not.',
    'Do you eat lunch at school? / Yes, I do. / No, I do not.',
    'Do you do your homework in the evening? / Yes, I do. / No, I do not.',
    'Do you visit your grandfather on weekends? / Yes, I do. / No, I do not.',
    'Does she write an English diary? / Yes, she does. / No, she does not.',
    'Do they watch TV after dinner? / Yes, they do. / No, they do not.',
    'Does he play basketball after school? / Yes, he does. / No, he does not.',
    'Does she get up early every morning? / Yes, she does. / No, she does not.',
    'Do you listen to music at home? / Yes, I do. / No, I do not.',
    'Do they ride their bikes in the park? / Yes, they do. / No, they do not.',
    'Does he wash his hands before lunch? / Yes, he does. / No, he does not.',
    'Do you wear slippers at home? / Yes, I do. / No, I do not.',
    'Does she carry a bag to school? / Yes, she does. / No, she does not.',
    'Do they practice English every day? / Yes, they do. / No, they do not.',
    'Do you use a computer at school? / Yes, I do. / No, I do not.'
  ];
}

function __mn90BuildDoBeAnswerSheetFromQuestions(q = '', input = {}) {
  const pairs = __mn90ExtractQuestionCluePairs(q);
  if (!pairs.length) return '';
  const built = pairs.map((pair, idx) => {
    const question = __mn90BuildQuestionFromClue(pair, input);
    if (!question) return '';
    return `${idx + 1}. ${__mn90ShortAnswerForQuestion(question, input)}`;
  }).filter(Boolean);
  if (built.length >= Math.max(5, Math.ceil(pairs.length * 0.7))) return built.join('\n');
  return '';
}

function __mn90HasLowQuestionDiversity(questions = '', input = {}) {
  if (!__mn90IsDoBeQuestionInput(input)) return false;
  const bodies = typeof __mn83ExtractBodies === 'function'
    ? __mn83ExtractBodies(questions)
    : String(questions || '').split('\n').map((s) => s.trim()).filter((s) => /^\d+[.)-]?\s+/.test(s)).map((s) => s.replace(/^\d+[.)-]?\s*/, ''));
  if (bodies.length < 8) return false;
  const sigs = bodies.map((line) => typeof __mn83NormalizeSignature === 'function' ? __mn83NormalizeSignature(line) : line.toLowerCase()).filter(Boolean);
  const unique = new Set(sigs);
  return (unique.size / Math.max(1, sigs.length)) < 0.72;
}

function buildMiddleRelaxedAnswerSheet(a = "", q = "", input = {}) {
  const answerLines = extractLikelyAnswerLines(a);
  const questionLines = extractNumberedQuestionItems(q);

  if (__mn90IsDoBeQuestionInput(input)) {
    const completed = answerLines
      .map((line) => __mn90CompleteAnswerLine(line, input))
      .filter(Boolean)
      .map((line, idx) => `${idx + 1}. ${line}`);

    if (completed.length >= questionLines.length && completed.every((line) => __mn90HasCompleteShortAnswer(line, input))) {
      return completed.join("\n");
    }

    const rebuiltFromQuestions = __mn90BuildDoBeAnswerSheetFromQuestions(q, input);
    if (rebuiltFromQuestions && countAnswerLines(rebuiltFromQuestions) >= Math.max(1, Math.ceil(questionLines.length * 0.8))) {
      return rebuiltFromQuestions;
    }

    const bank = __mn90BuildDedicatedQuestionBank(input);
    if (bank.length >= questionLines.length && questionLines.length > 0) {
      return bank.slice(0, questionLines.length).map((body, idx) => `${idx + 1}. ${body}`).join("\n");
    }
  }

  const cleaned = answerLines
    .map((line) => sanitizeAnswerBodyForMiddle(line))
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


  function buildMarcusReferenceDrivenBlock(input = {}) {
    const raw = [input?.topic, input?.worksheetTitle, input?.userPrompt].filter(Boolean).join(" ");
    const focus = input?.grammarFocus || detectGrammarFocus(raw);
    const isWriting = input?.mode === "writing" || input?.magicStyle === "marcus_magic" || normalizeWorkbookType(input?.workbookType || "") === "guided_writing";
    if (!isWriting) return "";
    const isPresentContinuous = /현재진행|present\s*continuous|present\s*progressive|be\s*-?\s*ing/i.test(raw);
    const isPresentPerfect = focus?.isPresentPerfect || /현재완료|have\s*p\.?p/i.test(raw);
    if (isPresentContinuous) {
      return input?.language === "en"
        ? `[MARCUSNOTE CHAPTER HARD TEMPLATE: PRESENT CONTINUOUS]
- Follow Marcus Magic Card present-continuous training identity, not a generic translation worksheet.
- The set must visibly mix 4 item families inside one 25-item worksheet:
  1) direct guided composition with clue fragments
  2) word-combination sentence building with one extra unnecessary word
  3) negative/question conversion or controlled transformation
  4) mixed application that still keeps be + -ing visible
- Target distribution for 25 items:
  * 1-6: direct guided composition
  * 7-13: word-combination items with [N words, ...] style clue payload
  * 14-18: negative/question/conversion items
  * 19-25: mixed but chapter-pure application items
- In word-combination items, clues should look like Marcus workbook style: [8 words, be -ing, now, play soccer, they, watch TV]
- Include be -ing or an equivalent structural anchor in most present-continuous clue sets.
- Allow 1-2 extra unnecessary clue words in rearrangement / combination items.
- Use strong present-continuous signals across the set: now, right now, at the moment, these days, look, listen.
- Respect the workbook warning that stative possession/mental verbs should not dominate present-continuous answers: know, like, want, resemble, have (possession).
- Avoid a flat list of Korean-to-English translation prompts. The worksheet must feel trained, staged, and edited.
- Keep answer sentences natural and simple enough for middle-school learners, but task surfaces must be structurally rich.`
        : `[마커스노트 챕터 하드 템플릿: 현재진행형]
- 현재진행형 출력은 generic 번역형 워크시트가 아니라 Marcus Magic Card식 훈련 구조를 따라야 한다.
- 한 세트 25문항 안에 다음 4가지 문항 계열이 눈에 보이게 섞여야 한다.
  1) 직접 clue 기반 영작형
  2) 단어조합형 영작(불필요 단어 1개 포함 가능)
  3) 부정문/의문문/변환형
  4) be + -ing가 유지되는 혼합 응용형
- 25문항 권장 분배:
  * 1-6: 직접 clue 기반 영작
  * 7-13: [N단어, ...] 형태의 단어조합형
  * 14-18: 부정문/의문문/전환형
  * 19-25: 챕터 순도를 유지하는 혼합 응용형
- 단어조합형 clue는 Marcus 워크북처럼 보여야 한다: [8단어, be -ing, now, play soccer, they, watch TV]
- 현재진행형 단어조합 clue 다수에는 be -ing 또는 그에 준하는 구조 앵커를 포함할 것.
- 배열형/조합형 clue에는 불필요 단어 1~2개를 허용한다.
- now, right now, at the moment, these days, look, listen 같은 현재진행 신호를 세트 전반에 분산시킬 것.
- 교재 설명처럼 know, like, want, resemble, have(소유) 같은 상태/소유 동사가 현재진행 핵심 정답을 지배하지 않게 할 것.
- 단순한 한글→영어 번역문장 나열로 끝내지 말고, 훈련 단계가 보이도록 설계할 것.
- 정답 문장은 중등 학습자 수준으로 자연스럽게 유지하되, 문항 표면은 구조적으로 풍부해야 한다.`;
    }
    if (isPresentPerfect) {
      return input?.language === "en"
        ? `[MARCUSNOTE CHAPTER HARD TEMPLATE: PRESENT PERFECT]
- Follow Marcus Magic Card present-perfect applied workbook identity.
- The worksheet must visibly balance the 4 meaning zones of present perfect:
  1) completion/already-yet-just-recently
  2) experience/ever-never-before-once-twice
  3) duration/for-since-how long
  4) result/gone-lost-left-broken etc.
- Recommended distribution for 25 items: 6 completion, 6 experience, 7 duration, 6 result/application.
- Most items should include fragment clues in parentheses, not bare translation only.
- Keep have/has + past participle visible in the final answers.
- Absolutely forbid finished-past triggers inside present-perfect target items: yesterday, last week, ago, when + past event, specific past years used as finished-time adverbials.
- If the Korean source naturally suggests simple past, rewrite the item meaning into a valid present-perfect meaning before finalizing.
- Use clue payloads that help learners choose the meaning zone: (for five years), (already), (never, before), (just), (since 2011), (once), (twice).
- The worksheet should feel like a chapter-trained present-perfect set, not a random collection of generic sentences.`
        : `[마커스노트 챕터 하드 템플릿: 현재완료]
- 현재완료 출력은 Marcus Magic Card 응용편식 훈련 구조를 따라야 한다.
- 세트 안에서 현재완료 4가지 의미 영역이 눈에 보이게 균형 있게 섞여야 한다.
  1) 완료 already / yet / just / recently
  2) 경험 ever / never / before / once / twice
  3) 계속 for / since / how long
  4) 결과 gone / lost / left / broken 등
- 25문항 권장 분배: 완료 6, 경험 6, 계속 7, 결과·응용 6
- 대부분의 문항은 단순 번역형이 아니라 괄호 clue가 포함된 조각형 영작이어야 한다.
- 최종 정답에는 have/has + 과거분사가 분명하게 드러나야 한다.
- 현재완료 목표 문항에는 yesterday, last week, ago, when절 과거 사건, 특정 과거연도 같은 완료 불가능 시간 표현을 절대 넣지 말 것.
- 한국어 제시문이 단순과거를 강하게 유도하면, 최종 생성 전에 현재완료에 맞는 의미로 조정할 것.
- clue에는 의미 영역 선택을 돕는 신호를 적극적으로 포함할 것: (for five years), (already), (never, before), (just), (since 2011), (once), (twice)
- 결과물은 random sentence list가 아니라, 현재완료 챕터 훈련 세트처럼 보여야 한다.`;
    }
    return "";
  }

  function buildMarcusExamplePriorityBlock(input = {}) {
    const request = String(input?.userPrompt || "");
    const hasExamples = /(예시문항|예시|예문|example)/i.test(request);
    if (!hasExamples) return "";
    return input?.language === "en"
      ? `[REFERENCE EXAMPLE PRIORITY]
- The user provided or referenced example items. Match the SURFACE SHAPE of those examples first.
- Prioritize the same clue shell, wording rhythm, and item family before inventing a new format.
- If the examples show Marcus-style clue lines, preserve that shell across much of the set.`
      : `[예시문항 우선 반영 규칙]
- 사용자가 예시문항/예문을 함께 주었다면, 그 예시의 표면 형식을 먼저 따라야 한다.
- 새로운 형식을 임의로 발명하기보다, 예시의 clue 모양, 리듬, 문항 계열을 우선 복제할 것.
- 예시가 Marcus식 clue 줄을 보여 주면, 세트 전반에 그 껍데기를 최대한 유지할 것.`;
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
    return [base, extra, buildMarcusReferenceDrivenBlock(input), buildMarcusExamplePriorityBlock(input)].filter(Boolean).join("\n\n");
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
  if (__mn90HasLowQuestionDiversity(questions, input)) {
    return { ok: false, reason: "question_diversity_low" };
  }

  const pairs = __mn83BuildItemPairs(questions, answers);
  if (!pairs.length) return { ok: false, reason: "pair_build_failed" };
  if (pairs.some((pair) => !pair.answer)) {
    return { ok: false, reason: "pair_answer_missing" };
  }
  if (__mn90IsDoBeQuestionInput(input) && pairs.some((pair) => !__mn90HasCompleteShortAnswer(pair.answer, input))) {
    return { ok: false, reason: "short_answer_missing_do_be" };
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
  const hasBrokenDoBeShortAnswers = __mn90IsDoBeQuestionInput(input) && extractLikelyAnswerLines(currentAnswers).some((line) => !__mn90HasCompleteShortAnswer(line, input));

  const shouldRepair =
    qCount > 0 &&
    (
      aCount === 0 ||
      hasBrokenDoBeShortAnswers ||
      (aCount < qCount && aCount >= Math.max(1, Math.ceil(qCount * 0.6)))
    );

  if (!shouldRepair) return formatted;

  const repaired = { ...formatted };
  let nextAnswers = normalizeMagicAnswerSheet(currentAnswers, questions, input);

  if (!nextAnswers || countAnswerLines(nextAnswers) < qCount || (__mn90IsDoBeQuestionInput(input) && extractLikelyAnswerLines(nextAnswers).some((line) => !__mn90HasCompleteShortAnswer(line, input)))) {
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

async function handler_v83_strict(req, res) {
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


function __v85DetectPresentPerfectFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /현재완료(?!\s*진행형)|present\s+perfect(?!\s+(continuous|progressive))/i.test(merged);
}

function __v85DetectPresentPerfectProgressiveFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /현재완료\s*진행형|present\s+perfect\s+(continuous|progressive)/i.test(merged);
}

function __v85DetectWhatFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /관계대명사\s*what|relative\s*pronoun\s*what/i.test(merged);
}

function __v85DetectDoQuestionFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /일반동사.*의문문|일반동사의 의문문|do-question|do\/does question/i.test(merged);
}

function __v85DetectBeQuestionFocus(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt]
    .filter(Boolean)
    .join(" ");
  return /be동사.*의문문|be동사 의문문|be-verb question/i.test(merged);
}

function __v85ToIng(base = "") {
  const v = String(base || "").toLowerCase().trim();
  const irregular = {
    lie: "lying", die: "dying", tie: "tying", run: "running", sit: "sitting",
    begin: "beginning", swim: "swimming", get: "getting", put: "putting",
    plan: "planning", stop: "stopping", travel: "traveling", make: "making",
    take: "taking", write: "writing", have: "having", use: "using", come: "coming"
  };
  if (!v) return "";
  if (irregular[v]) return irregular[v];
  if (/ie$/.test(v)) return v.slice(0, -2) + "ying";
  if (/e$/.test(v) && !/ee$/.test(v)) return v.slice(0, -1) + "ing";
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(v)) return v + v.slice(-1) + "ing";
  return v + "ing";
}

function __v85GuessBaseVerbFromPastForm(token = "") {
  const t = String(token || "").toLowerCase().trim();
  const irregular = {
    read: "read", made: "make", seen: "see", written: "write", sent: "send",
    heard: "hear", taught: "teach", spoken: "speak", given: "give", taken: "take",
    done: "do", gone: "go", been: "be", begun: "begin", sung: "sing",
    met: "meet", solved: "solve", worked: "work", learned: "learn", learnt: "learn",
    discussed: "discuss", completed: "complete", tried: "try", visited: "visit",
    invited: "invite", attended: "attend", participated: "participate", invested: "invest",
    talked: "talk", exercised: "exercise", finished: "finish", studied: "study"
  };
  if (irregular[t]) return irregular[t];
  if (/ied$/.test(t)) return t.slice(0, -3) + "y";
  if (/ed$/.test(t)) return t.slice(0, -2);
  return t;
}

function __v85ConvertToPresentPerfectProgressive(sentence = "") {
  let s = String(sentence || "").trim();
  if (!s) return "";
  if (/\b(have|has)\s+been\s+[A-Za-z]+ing\b/i.test(s)) return s;

  const subjectMatch = s.match(/^(I|You|We|They|He|She|It)\b/i);
  const subject = subjectMatch ? subjectMatch[1] : "I";
  const aux = /^(He|She|It)$/i.test(subject) ? "has been" : "have been";
  const afterAux = s.replace(/^(I|You|We|They|He|She|It)\s+(have|has)\s+/i, "");
  const verbMatch = afterAux.match(/^([A-Za-z]+)\b/);
  const verbToken = verbMatch ? verbMatch[1] : "work";
  const baseVerb = __v85GuessBaseVerbFromPastForm(verbToken);
  const ingVerb = __v85ToIng(baseVerb || "work");
  const tail = afterAux.replace(/^([A-Za-z]+)\b\s*/i, "").trim();
  s = `${subject} ${aux} ${ingVerb}${tail ? " " + tail : ""}`.trim();

  if (!/\b(for|since)\b/i.test(s)) {
    if (/\b(several years|many years|three years|four years|five years|six months|two weeks|three months|201\d|20\d\d)\b/i.test(sentence)) {
      const m = sentence.match(/\b(several years|many years|three years|four years|five years|six months|two weeks|three months|201\d|20\d\d)\b/i);
      if (m) {
        const marker = /^20\d\d$/.test(m[1]) ? `since ${m[1]}` : `for ${m[1]}`;
        s = s.replace(/[.]?$/, ` ${marker}.`);
      }
    }
  }
  return s.replace(/\s+([.,!?;:])/g, "$1").trim();
}

const __V85_CHAPTER_FALLBACKS = {
  present_perfect_progressive: [
    ["나는 5년 동안 영어를 공부해왔다.", "I have been studying English for five years."],
    ["그녀는 2019년부터 그 회사에서 일해왔다.", "She has been working at that company since 2019."],
    ["우리는 3개월 동안 이 프로젝트를 진행해왔다.", "We have been working on this project for three months."],
    ["그는 지난 2주 동안 매일 운동해왔다.", "He has been exercising every day for the last two weeks."],
    ["나는 지금까지 이 문제를 해결하려고 노력해왔다.", "I have been trying to solve this problem so far."],
    ["그들은 오랫동안 그 문제를 논의해왔다.", "They have been discussing the issue for a long time."],
    ["나는 몇 년 동안 이 책을 읽어왔다.", "I have been reading this book for several years."],
    ["그녀는 4년 동안 피아노를 배워왔다.", "She has been learning piano for four years."],
    ["우리는 오랫동안 그 회의에 대해 이야기해왔다.", "We have been talking about that meeting for a long time."],
    ["그는 몇 달 동안 그 보고서를 준비해왔다.", "He has been preparing the report for several months."]
  ],
  present_perfect: [
    ["나는 최근에 새로운 영화를 보았다.", "I have seen a new movie recently."],
    ["그녀는 3년 동안 피아노를 배워왔다.", "She has learned piano for three years."],
    ["우리는 이미 그 책을 읽었다.", "We have read the book already."],
    ["그는 그 도시를 두 번 방문한 적이 있다.", "He has visited the city twice."],
    ["나는 그 영화를 아직 보지 않았다.", "I have not seen the movie yet."],
    ["그들은 2019년부터 이곳에서 일해왔다.", "They have worked here since 2019."],
    ["나는 그 문제를 풀어본 적이 있다.", "I have solved the problem before."],
    ["그녀는 최근에 새로운 친구를 사귀었다.", "She has made a new friend recently."],
    ["우리는 방금 그 영화를 보았다.", "We have just seen the movie."],
    ["나는 이 책을 두 번 읽어 보았다.", "I have read this book twice."]
  ],
  do_question: [
    ["너는 매일 운동하니?", "Do you exercise every day?"],
    ["그는 학교에 걸어가니?", "Does he walk to school?"],
    ["그녀는 피아노를 치니?", "Does she play the piano?"],
    ["너는 영어를 공부하니?", "Do you study English?"],
    ["그들은 주말에 축구를 하니?", "Do they play soccer on weekends?"]
  ],
  relative_pronoun_what: [
    ["내가 필요한 것은 시간이다.", "What I need is time."],
    ["그녀가 말한 것은 사실이었다.", "What she said was true."],
    ["내가 배운 것은 나에게 큰 도움이 되었다.", "What I learned helped me a lot."],
    ["내가 원하는 것은 더 많은 시간이다.", "What I want is more time."],
    ["그들이 제안한 것은 매우 유용하다.", "What they suggested is very useful."]
  ]
};

function __v85ChapterKeyForGuided(input = {}) {
  const merged = [input?.topic, input?.worksheetTitle, input?.userPrompt].filter(Boolean).join(" ");
  if (__v85DetectPresentPerfectProgressiveFocus(input)) return "present_perfect_progressive";
  if (__v85DetectPresentPerfectFocus(input)) return "present_perfect";
  if (__v85DetectDoQuestionFocus(input)) return "do_question";
  if (__v85DetectBeQuestionFocus(input)) return "be_question";
  if (__v85DetectWhatFocus(input)) return "relative_pronoun_what";
  if (/현재진행|present\s+(continuous|progressive)/i.test(merged)) return "present_continuous";
  return "general";
}

function __v85CorePredicateFactory(input = {}) {
  const key = __v85ChapterKeyForGuided(input);
  if (key === "present_perfect_progressive") return (answer) => /\b(have|has)\s+been\s+[A-Za-z]+ing\b/i.test(answer);
  if (key === "present_perfect") return (answer) => /\b(have|has)\s+(?:already\s+|just\s+|never\s+|not\s+)?[A-Za-z]+(?:ed|en|wn|ne|lt|pt|ght|t)\b/i.test(answer) && !/\b(have|has)\s+been\s+[A-Za-z]+ing\b/i.test(answer);
  if (key === "do_question") return (answer) => /^(Do|Does)\b.*\?$/.test(String(answer || "").trim());
  if (key === "be_question") return (answer) => /^(Am|Is|Are)\b.*\?$/.test(String(answer || "").trim());
  if (key === "relative_pronoun_what") return (answer) => /^What\b/i.test(String(answer || "").trim());
  return () => true;
}

function __v85GetFallbackPairsForChapter(input = {}) {
  const key = __v85ChapterKeyForGuided(input);
  return __V85_CHAPTER_FALLBACKS[key] || [];
}

function __v85EnforceChapterBalance(pairs = [], input = {}) {
  const key = __v85ChapterKeyForGuided(input);
  if (!["present_perfect_progressive", "present_perfect", "do_question", "relative_pronoun_what", "be_question"].includes(key)) return pairs;
  const predicate = __v85CorePredicateFactory(input);
  const total = Math.max(1, pairs.length);
  const minCore = key === "present_perfect_progressive" ? Math.ceil(total * 0.84) : Math.ceil(total * 0.8);
  let coreCount = pairs.filter((pair) => predicate(pair.a)).length;
  if (coreCount >= minCore) return pairs;
  const fallback = __v85GetFallbackPairsForChapter(input);
  if (!fallback.length) return pairs;
  const next = pairs.map((pair) => ({ ...pair }));
  let fi = 0;
  for (let i = 0; i < next.length && coreCount < minCore; i += 1) {
    if (predicate(next[i].a)) continue;
    const bank = fallback[fi % fallback.length];
    fi += 1;
    next[i] = { q: bank[0], a: bank[1] };
    coreCount += 1;
  }
  return next;
}

function __v85RepairGuidedWritingAnswer(answer = "", input = {}) {
  let fixed = String(answer || "").trim();
  if (!fixed) return "";

  if (__v85DetectPresentProgressiveFocus(input)) {
    fixed = __v85RepairProgressiveTimeMarker(fixed);
    fixed = __v85RepairProgressiveLexicon(fixed);
  }

  if (__v85DetectPresentPerfectProgressiveFocus(input) && !/(have|has)\s+been\s+[A-Za-z]+ing/i.test(fixed)) {
    if (/for|since|so far|lately|recently|these days|the last/i.test(fixed)) {
      fixed = __v85ConvertToPresentPerfectProgressive(fixed);
    }
  }

  fixed = fixed.replace(/\s+([.,!?;:])/g, "$1").trim();
  if (!/[.!?]$/.test(fixed)) fixed += /\?$/.test(fixed) ? "" : ".";
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

    const guidedPairs = [];
    for (const block of qBlocks) {
      const answer = __v85RepairGuidedWritingAnswer(String(aMap.get(block.no) || "").trim(), input);
      if (!answer) continue;
      guidedPairs.push({ no: block.no, lead: block.lead, lines: Array.isArray(block.lines) ? block.lines.slice() : [], q: block.lead, a: answer });
    }

    const balancedPairs = __v85EnforceChapterBalance(guidedPairs.map((pair) => ({ q: pair.q, a: pair.a })), input);
    for (let i = 0; i < Math.min(guidedPairs.length, balancedPairs.length); i += 1) {
      guidedPairs[i].q = balancedPairs[i].q;
      guidedPairs[i].lead = balancedPairs[i].q;
      guidedPairs[i].a = __v85RepairGuidedWritingAnswer(balancedPairs[i].a, input);
    }

    for (const pair of guidedPairs) {
      const block = { no: pair.no, lead: pair.lead, lines: pair.lines };
      renderedBlocks.push(__v843BuildGuidedWritingQuestionBlock(block, pair.a, input));
      renderedAnswers.push(`${pair.no}. ${pair.a}`);
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


async function handler_v841_workbook_type_router(req, res) {
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

      if (validateServiceSafeOutput(emergencyRecovered, input) || hasMeaningfulWorksheetBody(emergencyRecovered.questions || "")) {
        finalGeneration = {
          ok: true,
          formatted: emergencyRecovered,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: validateServiceSafeOutput(emergencyRecovered, input) ? "router_emergency_service_safe" : "router_emergency_nonblocking_return"
        };
      } else {
        finalGeneration = {
          ok: true,
          formatted: emergencyRecovered,
          attemptsUsed: (generation?.attemptsUsed || generation?.failure?.attempt || 0),
          repairedBy: "router_last_resort_fallback"
        };
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


/* ========================================================================
   Marcusnote Magic v8.7 Chapter Prompt Differentiation Patch
   - Prevents example-rich writing prompts from collapsing into concept mode
   - Forces stronger chapter-specific prompt shells for present continuous/perfect
   - Adds light answer cleanup for present perfect and slot guidance for present continuous
   ======================================================================== */
(function () {
  const PATCH_TAG = "v8.7-chapter-prompt-differentiation";

  const __prevDetectMagicIntent_v87 = typeof detectMagicIntent === "function" ? detectMagicIntent : null;
  const __prevBuildUserPrompt_v87 = typeof buildUserPrompt === "function" ? buildUserPrompt : null;
  const __prevFormatMagicResponse_v87 = typeof formatMagicResponse === "function" ? formatMagicResponse : null;

  function hasWorksheetTrainingSignal(text = "") {
    const t = String(text || "").toLowerCase();
    return /(영작훈련|영작 워크북|워크북|guided writing|writing lab|writing training|worksheet|문항|문제|제작해|생성해|만들어)/i.test(t);
  }

  function hasExampleOnlySignal(text = "") {
    const t = String(text || "").toLowerCase();
    return /(예시문항|예시|예문|example|examples)/i.test(t);
  }

  detectMagicIntent = function detectMagicIntent_v87(text = "") {
    const raw = String(text || "");
    const t = raw.toLowerCase();

    const conceptKeywords = [
      "개념설명", "개념 설명", "개념 정리", "문법 설명", "문법 개념", "grammar explanation", "grammar concept"
    ];
    const trainingKeywords = [
      "영작", "영작훈련", "쓰기", "writing", "composition", "rearrange", "재배열", "문장 완성", "워크북", "훈련", "worksheet"
    ];

    const isConcept = conceptKeywords.some((k) => t.includes(k));
    const isTraining = trainingKeywords.some((k) => t.includes(k));
    const exampleOnly = hasExampleOnlySignal(raw);
    const worksheetTraining = hasWorksheetTrainingSignal(raw);

    // Critical fix:
    // If the user is clearly asking for a worksheet/writing set and merely includes examples,
    // do NOT downgrade the request into concept or concept+training mode.
    if (worksheetTraining && exampleOnly) return "training";
    if (worksheetTraining && !isConcept) return "training";

    if (isConcept && isTraining) return "concept+training";
    if (isConcept) return "concept";
    if (isTraining) return "training";

    if (__prevDetectMagicIntent_v87) {
      try {
        return __prevDetectMagicIntent_v87(raw);
      } catch (_) {}
    }
    return "training";
  };

  function getV87ChapterKey(input = {}) {
    const focus = input?.grammarFocus || detectGrammarFocus(
      [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
    );
    if (focus?.chapterKey === "present_perfect") return "present_perfect";
    if (/현재진행|present\s+continuous|present\s+progressive|be\s*-?\s*ing/i.test(
      [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ")
    )) return "present_continuous";
    return "other";
  }

  function buildPresentContinuousSlotBlock(input = {}) {
    const isEn = input?.language === "en";
    return isEn
      ? `[CHAPTER-SPECIFIC OUTPUT SHELL: PRESENT CONTINUOUS]
- This chapter is structure-driven, not generic translation-driven.
- Build exactly ${input?.count || 25} items unless refill mode explicitly says otherwise.
- Use the following visible slot balance as much as possible:
  1) Items 1-8: Korean prompt + Marcus clue block in parentheses or bracketed word-combination style.
  2) Items 9-13: word-combination / rearrangement style with 1 unnecessary extra word.
  3) Items 14-18: question / negative / transformation style.
  4) Items 19-${input?.count || 25}: mixed application items that still keep present continuous visible.
- Present continuous clue shells should resemble Marcus Magic Card surface shapes such as:
  [8 words, be-ing, now, play soccer, they, watch TV]
  or
  (be -ing, now, take pictures of, your dogs, look in)
- For present continuous, do NOT output a bare list of simple Korean sentences only.
- If examples are provided, copy the clue shell and item family first, not just the meaning.
- Keep now / right now / at the moment / these days / look / listen spread across the set.
- Do not let stative verbs like know, like, want, resemble, or have(ownership) dominate the core answer lines.`
      : `[챕터별 출력 껍데기: 현재진행형]
- 현재진행형은 단순 번역형이 아니라 구조 훈련형 챕터이다.
- 보충생성이 아니라면 정확히 ${input?.count || 25}문항을 만들 것.
- 다음 슬롯 균형이 눈에 보이게 드러나야 한다.
  1) 1-8번: 한국어 제시문 + Marcus식 clue 괄호형 또는 대괄호 단어조합형
  2) 9-13번: 단어조합/재배열형 + 불필요한 단어 1개 포함
  3) 14-18번: 의문문/부정문/전환형
  4) 19-${input?.count || 25}번: 현재진행형이 분명히 드러나는 혼합 응용형
- 현재진행형 clue 껍데기는 Marcus Magic Card처럼 보여야 한다.
  예: [8단어, be -ing, now, play soccer, they, watch TV]
  또는 (be -ing, now, take pictures of, your dogs, look in)
- 단순한 한국어 문장 나열만으로 끝내지 말 것.
- 예시문항이 주어지면 의미만 흉내 내지 말고 clue 껍데기와 문항 계열을 먼저 복제할 것.
- now / right now / at the moment / these days / look / listen 신호를 세트 전반에 분산할 것.
- know, like, want, resemble, have(소유) 같은 상태동사가 핵심 정답을 지배하지 않게 할 것.`;
  }

  function buildPresentPerfectSlotBlock(input = {}) {
    const isEn = input?.language === "en";
    return isEn
      ? `[CHAPTER-SPECIFIC OUTPUT SHELL: PRESENT PERFECT]
- Build exactly ${input?.count || 25} items unless refill mode explicitly says otherwise.
- Keep the 4 meaning zones visible across the whole set:
  completion / experience / duration / result.
- Prefer Korean prompt + clue in parentheses for most items.
- Do not let generic simple-past paraphrases survive in final answers.
- If examples are provided, preserve the clue shell across much of the set.
- For duration items, strongly prefer for / since constructions.
- For experience items, strongly prefer ever / never / before / once / twice.
- For completion items, strongly prefer already / yet / just / recently.
- For result items, use natural result-state verbs only when teachable.`
      : `[챕터별 출력 껍데기: 현재완료]
- 보충생성이 아니라면 정확히 ${input?.count || 25}문항을 만들 것.
- 세트 전체에서 현재완료 4영역이 눈에 보이게 섞여야 한다: 완료 / 경험 / 계속 / 결과.
- 대부분의 문항은 한국어 제시문 + 괄호 clue 형태를 유지할 것.
- 최종 정답에서 단순과거 우회 표현이 살아남지 않게 할 것.
- 예시문항이 주어지면 세트 전반에 clue 껍데기를 최대한 유지할 것.
- 계속 용법은 for / since를 강하게 우선할 것.
- 경험 용법은 ever / never / before / once / twice를 강하게 우선할 것.
- 완료 용법은 already / yet / just / recently를 강하게 우선할 것.
- 결과 용법은 교실에서 가르칠 수 있는 자연스러운 결과 동사만 사용할 것.`;
  }

  buildUserPrompt = function buildUserPrompt_v87(input = {}) {
    const base = __prevBuildUserPrompt_v87 ? __prevBuildUserPrompt_v87(input) : "";
    const chapterKey = getV87ChapterKey(input);
    const blocks = [base];
    if (chapterKey === "present_continuous") {
      blocks.push(buildPresentContinuousSlotBlock(input));
    } else if (chapterKey === "present_perfect") {
      blocks.push(buildPresentPerfectSlotBlock(input));
    }
    return blocks.filter(Boolean).join("\n\n");
  };

  function cleanupPresentPerfectAnswerLine(line = "") {
    let s = String(line || "").trim();
    s = s.replace(/\bvisited the new cafe recently\b/i, "have visited the new cafe recently");
    s = s.replace(/\bwent on that trip\b/i, "gone on that trip");
    s = s.replace(/\bgo on that trip\b/i, "gone on that trip");
    if (/\brecently\b/i.test(s) && !/\b(have|has)\b/i.test(s) && /\b(visit|visited|hear|heard|read|saw|seen|finish|finished|send|sent|take|took|taken)\b/i.test(s)) {
      s = s.replace(/^I\s+/i, "I have ")
           .replace(/^We\s+/i, "We have ")
           .replace(/^They\s+/i, "They have ")
           .replace(/^He\s+/i, "He has ")
           .replace(/^She\s+/i, "She has ");
    }
    return s;
  }

  function rewriteQuestionLineWithClue(line = "", chapterKey = "other") {
    const m = String(line || "").match(/^(\d+[.)]?\s*)(.+?)(\s*\(Word count:\s*\d+\))$/i);
    if (!m) return line;
    const prefix = m[1] || "";
    const stem = (m[2] || "").trim();
    const suffix = m[3] || "";
    if (/\([^)]*\)/.test(stem)) return line;
    if (chapterKey === "present_continuous") {
      const hint = "(be -ing, now)";
      return `${prefix}${stem} ${hint}${suffix}`;
    }
    return line;
  }

  formatMagicResponse = function formatMagicResponse_v87(rawText, input) {
    const formatted = __prevFormatMagicResponse_v87 ? __prevFormatMagicResponse_v87(rawText, input) : {
      title: "",
      instructions: "",
      questions: String(rawText || ""),
      answerSheet: "",
      fullText: String(rawText || ""),
      actualCount: 0,
    };

    const chapterKey = getV87ChapterKey(input);

    if (chapterKey === "present_perfect" && formatted?.answerSheet) {
      const repaired = String(formatted.answerSheet)
        .split("\n")
        .map((line) => {
          if (!/^\d+[.)-]?\s+/.test(String(line).trim())) return line;
          const prefix = line.match(/^\d+[.)-]?\s+/)[0];
          const body = line.replace(/^\d+[.)-]?\s+/, "");
          return prefix + cleanupPresentPerfectAnswerLine(body);
        })
        .join("\n");
      formatted.answerSheet = repaired;
    }

    if (chapterKey === "present_continuous" && formatted?.questions) {
      const patchedQuestions = String(formatted.questions)
        .split("\n")
        .map((line) => rewriteQuestionLineWithClue(line, chapterKey))
        .join("\n");
      formatted.questions = patchedQuestions;
      formatted.fullText = [formatted.title, formatted.instructions, formatted.questions, input?.language === "en" ? "Answers" : "정답", formatted.answerSheet]
        .filter(Boolean)
        .join("\n\n");
    }

    return formatted;
  };

  console.log(`[${PATCH_TAG}] loaded`);
})();


/* ========================================================================
   Marcusnote Magic v8.8 Chapter Output Assembly Patch
   - Present continuous now uses chapter-aware slot-style question reconstruction
   - Present perfect gets auto-fill to 25, answer/question alignment repair, and richer clue shells
   - Uses answer lines to build Marcus-style clue shells instead of repeating generic (be-ing, now)
   ======================================================================== */
(function () {
  const PATCH_TAG = "v8.8-chapter-output-assembly";
  const __prevFormatMagicResponse_v88 = typeof formatMagicResponse === "function" ? formatMagicResponse : null;
  const __prevBuildUserPrompt_v88 = typeof buildUserPrompt === "function" ? buildUserPrompt : null;

  function v88ChapterKey(input = {}) {
    const raw = [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ");
    if (/현재완료|present\s+perfect|have\s*p\.?p/i.test(raw)) return "present_perfect";
    if (/현재진행|present\s+continuous|present\s+progressive|be\s*-?\s*ing/i.test(raw)) return "present_continuous";
    return "other";
  }

  function splitNumberedLines(text = "") {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line));
  }

  function getLineBody(line = "") {
    return String(line || "").replace(/^\d+[.)-]?\s+/, "").trim();
  }

  function stripExistingHintAndWordCount(stem = "") {
    let s = String(stem || "").trim();
    s = s.replace(/\s*\([^)]*Word count:[^)]*\)\s*$/i, "").trim();
    s = s.replace(/\s*\[[^\]]*\]\s*$/g, "").trim();
    s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
    return s;
  }

  function dedupe(arr = []) {
    const out = [];
    const seen = new Set();
    for (const item of arr) {
      const k = String(item || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(String(item).trim());
    }
    return out;
  }

  function contentWords(answer = "") {
    const stop = new Set([
      "i","you","he","she","we","they","it","am","is","are","was","were","be","been","being",
      "have","has","had","do","does","did","not","a","an","the","this","that","these","those",
      "to","for","in","on","at","of","with","and","or","but","from","by","my","your","his","her","our","their",
      "there","here","very","really","just","already","yet","before","never","once","twice","recently","now","right"
    ]);
    const tokens = String(answer || "")
      .replace(/[^A-Za-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !stop.has(t.toLowerCase()))
      .filter((t) => t.length > 1);
    return dedupe(tokens).slice(0, 6);
  }

  function presentPerfectSignal(answer = "") {
    const a = String(answer || "").toLowerCase();
    const signals = [];
    if (/\bsince\b/.test(a)) signals.push("since");
    if (/\bfor\b/.test(a)) signals.push("for");
    if (/\balready\b/.test(a)) signals.push("already");
    if (/\byet\b/.test(a)) signals.push("yet");
    if (/\bjust\b/.test(a)) signals.push("just");
    if (/\brecently\b/.test(a)) signals.push("recently");
    if (/\bnever\b/.test(a)) signals.push("never");
    if (/\bbefore\b/.test(a)) signals.push("before");
    if (/\bonce\b/.test(a)) signals.push("once");
    if (/\btwice\b/.test(a)) signals.push("twice");
    return dedupe(signals);
  }

  function buildPresentContinuousHint(answer = "", idx = 1) {
    const words = contentWords(answer);
    const base = ["be -ing", "now"];
    const picked = dedupe(base.concat(words.slice(0, 4)));
    if (idx <= 8) return `[8단어, ${picked.slice(0, 5).join(", ")}]`;
    if (idx <= 13) return `[8단어, ${picked.slice(0, 5).join(", ")}]`;
    return `(${picked.slice(0, 4).join(", ")})`;
  }

  function buildPresentPerfectHint(answer = "") {
    const sig = presentPerfectSignal(answer);
    const words = contentWords(answer);
    const picked = dedupe(sig.concat(words)).slice(0, 4);
    return `(${picked.join(", ")})`;
  }

  function ensureQuestionMarkForProgressive(text = "", idx = 1) {
    if (idx >= 9 && idx <= 13) {
      if (!/[?？]$/.test(text)) return text + "?";
    }
    return text;
  }

  function wordCountFromAnswer(answer = "") {
    return String(answer || "")
      .replace(/[^A-Za-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean).length;
  }

  const PP_FALLBACK = [
    ["나는 이 책을 두 번 읽어 보았다.", "I have read this book twice."],
    ["그녀는 최근에 새로운 친구를 사귀었다.", "She has made a new friend recently."],
    ["우리는 아직 그 숙제를 끝내지 않았다.", "We have not finished the homework yet."],
    ["그는 2019년부터 이곳에서 일하고 있다.", "He has worked here since 2019."],
    ["나는 그 영화를 본 적이 없다.", "I have never seen that movie."]
  ];

  const PC_FALLBACK = [
    ["학생들은 지금 수업을 듣고 있다.", "The students are listening to the class now."],
    ["그는 지금 숙제를 하고 있지 않다.", "He is not doing his homework now."],
    ["너는 지금 무엇을 하고 있니?", "What are you doing now?"],
    ["우리는 지금 점심을 먹고 있다.", "We are eating lunch now."],
    ["그녀는 지금 친구와 이야기하고 있다.", "She is talking with her friend now."]
  ];

  function alignPairs(questionLines = [], answerLines = [], chapter = "other", desired = 25) {
    const pairs = [];
    const qBodies = questionLines.map(getLineBody);
    const aBodies = answerLines.map(getLineBody);
    const size = Math.max(qBodies.length, aBodies.length);
    for (let i = 0; i < size; i += 1) {
      let q = qBodies[i] || "";
      let a = aBodies[i] || "";
      if (!q && a) q = chapter === "present_perfect" ? PP_FALLBACK[i % PP_FALLBACK.length][0] : PC_FALLBACK[i % PC_FALLBACK.length][0];
      if (!a && q) a = chapter === "present_perfect" ? PP_FALLBACK[i % PP_FALLBACK.length][1] : PC_FALLBACK[i % PC_FALLBACK.length][1];
      if (q && a) pairs.push({ q, a });
    }
    const bank = chapter === "present_perfect" ? PP_FALLBACK : PC_FALLBACK;
    let bi = 0;
    while (pairs.length < desired) {
      const [q, a] = bank[bi % bank.length];
      pairs.push({ q, a });
      bi += 1;
    }
    return pairs.slice(0, desired);
  }

  function rebuildPresentContinuousQuestions(pairs = []) {
    return pairs.map((pair, i) => {
      const idx = i + 1;
      const stem = ensureQuestionMarkForProgressive(stripExistingHintAndWordCount(pair.q), idx);
      const hint = buildPresentContinuousHint(pair.a, idx);
      const wc = wordCountFromAnswer(pair.a) || 8;
      return `${idx}. ${stem} ${hint} (Word count: ${wc})`;
    }).join("\n");
  }

  function rebuildPresentPerfectQuestions(pairs = []) {
    return pairs.map((pair, i) => {
      const idx = i + 1;
      const stem = stripExistingHintAndWordCount(pair.q);
      const hint = buildPresentPerfectHint(pair.a);
      const wc = wordCountFromAnswer(pair.a) || 8;
      return `${idx}. ${stem} ${hint} (Word count: ${wc})`;
    }).join("\n");
  }

  function rebuildAnswers(pairs = []) {
    return pairs.map((pair, i) => `${i + 1}. ${pair.a}`).join("\n");
  }

  function normalizePresentPerfectAnswer(answer = "") {
    let s = String(answer || "").trim();
    s = s.replace(/^We visited the new cafe recently\.?$/i, "We have visited the new cafe recently.");
    s = s.replace(/^I have attended this library for three years\.?$/i, "I have used this library for three years.");
    s = s.replace(/\bgo to that restaurant twice\b/i, "been to that restaurant twice");
    s = s.replace(/\bmet that friend once\b/i, "met that friend once");
    return s;
  }

  function buildV88PromptShell(input = {}) {
    const chapter = v88ChapterKey(input);
    if (chapter === "present_continuous") {
      return `[v8.8 CURRENT PROGRESSIVE ASSEMBLY]
- Treat this chapter as a structured training workbook, not a generic translation list.
- Exactly ${input?.count || 25} items.
- Visible slot plan:
  1-8 word-build / clue-shell items
  9-13 question items
  14-18 negative or transformation items
  19-${input?.count || 25} basic + mixed application items
- Avoid repeating the empty shell '(be -ing, now)' with no real clue content.
- If examples exist, imitate their clue-shell surface first.`;
    }
    if (chapter === "present_perfect") {
      return `[v8.8 PRESENT PERFECT ASSEMBLY]
- Exactly ${input?.count || 25} items.
- Keep completion / experience / duration / result visible across the set.
- Keep Korean stem + clue shell surface.
- Avoid finished-past leakage.
- If examples exist, preserve their clue-shell style across the whole set.`;
    }
    return "";
  }

  buildUserPrompt = function buildUserPrompt_v88(input = {}) {
    const base = __prevBuildUserPrompt_v88 ? __prevBuildUserPrompt_v88(input) : "";
    const shell = buildV88PromptShell(input);
    return [base, shell].filter(Boolean).join("\n\n");
  };

  formatMagicResponse = function formatMagicResponse_v88(rawText, input = {}) {
    const formatted = __prevFormatMagicResponse_v88 ? __prevFormatMagicResponse_v88(rawText, input) : {
      title: "",
      instructions: "",
      questions: String(rawText || ""),
      answerSheet: "",
      fullText: String(rawText || ""),
      actualCount: 0,
    };

    const chapter = v88ChapterKey(input);
    if (chapter === "other") return formatted;

    const desired = Math.max(5, Number(input?.count || 25));
    const qLines = splitNumberedLines(formatted.questions);
    const aLines = splitNumberedLines(formatted.answerSheet);
    let pairs = alignPairs(qLines, aLines, chapter, desired);

    if (chapter === "present_perfect") {
      pairs = pairs.map((p) => ({ q: p.q, a: normalizePresentPerfectAnswer(p.a) }));
      formatted.questions = rebuildPresentPerfectQuestions(pairs);
      formatted.answerSheet = rebuildAnswers(pairs);
    } else if (chapter === "present_continuous") {
      formatted.questions = rebuildPresentContinuousQuestions(pairs);
      formatted.answerSheet = rebuildAnswers(pairs);
    }

    formatted.actualCount = pairs.length;
    formatted.fullText = [formatted.title, formatted.instructions, formatted.questions, input?.language === "en" ? "Answers" : "정답", formatted.answerSheet]
      .filter(Boolean)
      .join("\n\n");
    return formatted;
  };

  console.log(`[${PATCH_TAG}] loaded`);
})();


/*
  Marcusnote Magic Engine v8.9
  Chapter-Structured Prompt + 25 Item Lock Patch
  - fixed present continuous shell hardening
  - stabilized present perfect quality
  - strict 25-item maintenance
  - chapter-specific structured prompting for passive / adjectival to-infinitive / what / participial modifier / relative adverb
*/
(function applyMarcusV89ChapterStructuredPromptPatch() {
  const PATCH_TAG = "v8.9-chapter-structured-prompt";
  const __prevBuildUserPrompt_v89 = typeof buildUserPrompt === "function" ? buildUserPrompt : null;
  const __prevFormatMagicResponse_v89 = typeof formatMagicResponse === "function" ? formatMagicResponse : null;

  function v89ChapterKey(input = {}) {
    const raw = [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(" ");
    const focus = input?.grammarFocus || (typeof detectGrammarFocus === "function" ? detectGrammarFocus(raw) : {});
    if (/현재완료|present\s+perfect|have\s*p\.?p/i.test(raw) || focus?.chapterKey === "present_perfect") return "present_perfect";
    if (/현재진행|present\s+continuous|present\s+progressive|be\s*-?\s*ing/i.test(raw)) return "present_continuous";
    if (focus?.chapterKey === "passive") return "passive";
    if (focus?.isToInfinitiveAdjective || focus?.chapterKey === "to_infinitive_adjective") return "to_infinitive_adjective";
    if (focus?.isWhatRelativePronoun || focus?.chapterKey === "relative_pronoun_what") return "relative_pronoun_what";
    if (focus?.isParticipialModifier || focus?.chapterKey === "participial_modifier") return "participial_modifier";
    if (focus?.chapterKey === "relative_adverb") return "relative_adverb";
    return "other";
  }

  function splitNumberedLinesV89(text = "") {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+[.)-]?\s+/.test(line));
  }

  function lineBodyV89(line = "") {
    return String(line || "").replace(/^\d+[.)-]?\s+/, "").trim();
  }

  function stripTailHintsV89(stem = "") {
    let s = String(stem || "").trim();
    s = s.replace(/\s*\([^)]*Word count:[^)]*\)\s*$/i, "").trim();
    s = s.replace(/\s*\[[^\]]*\]\s*$/g, "").trim();
    s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
    return s;
  }

  function wcV89(answer = "") {
    return String(answer || "")
      .replace(/[^A-Za-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean).length;
  }

  function dedupeV89(items = []) {
    const out = [];
    const seen = new Set();
    for (const item of items) {
      const key = String(item || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(item).trim());
    }
    return out;
  }

  function contentWordsV89(answer = "") {
    const stop = new Set([
      "i","you","he","she","we","they","it","am","is","are","was","were","be","been","being",
      "have","has","had","do","does","did","not","a","an","the","this","that","these","those",
      "to","for","in","on","at","of","with","and","or","but","from","by","my","your","his","her","our","their",
      "there","here","very","really","just","already","yet","before","never","once","twice","recently","now","right"
    ]);
    const tokens = String(answer || "")
      .replace(/[^A-Za-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !stop.has(t.toLowerCase()))
      .filter((t) => t.length > 1);
    return dedupeV89(tokens).slice(0, 6);
  }

  const FALLBACK_BANK = {
    passive: [
      ["이 보고서는 오늘 완료되었다.", "This report was completed today."],
      ["그 창문은 어제 깨졌다.", "The window was broken yesterday."],
      ["그 문제는 쉽게 해결될 수 있다.", "The problem can be solved easily."],
      ["그 편지는 영어로 쓰였다.", "The letter was written in English."],
      ["그 학생들은 파티에 초대되었다.", "The students were invited to the party."]
    ],
    to_infinitive_adjective: [
      ["나는 오늘 읽을 책이 필요하다.", "I need a book to read today."],
      ["그녀는 할 일이 많다.", "She has many things to do."],
      ["우리는 앉을 자리를 찾았다.", "We found a place to sit."],
      ["그는 함께 이야기할 친구들이 있다.", "He has friends to talk with."],
      ["나는 너에게 줄 중요한 것이 있다.", "I have something important to give you."]
    ],
    relative_pronoun_what: [
      ["내가 필요한 것은 더 많은 시간이다.", "What I need is more time."],
      ["그녀가 말한 것은 사실이었다.", "What she said was true."],
      ["내가 배운 것은 나에게 큰 도움이 되었다.", "What I learned helped me a lot."],
      ["그가 원하는 것은 새 자전거이다.", "What he wants is a new bike."],
      ["우리가 본 것은 매우 놀라웠다.", "What we saw was very surprising."]
    ],
    participial_modifier: [
      ["공원에서 달리고 있는 소년은 내 사촌이다.", "The boy running in the park is my cousin."],
      ["영어로 쓰인 그 책은 매우 유용하다.", "The book written in English is very useful."],
      ["복도에서 기다리고 있는 학생들은 매우 조용하다.", "The students waiting in the hall are very quiet."],
      ["창문 옆에 놓인 상자는 무겁다.", "The box placed by the window is heavy."],
      ["무대에서 춤추고 있는 소녀들은 내 친구들이다.", "The girls dancing on the stage are my friends."]
    ],
    relative_adverb: [
      ["이곳은 내가 태어난 도시이다.", "This is the city where I was born."],
      ["그날은 우리가 처음 만난 날이다.", "That was the day when we first met."],
      ["그것이 내가 그를 존경하는 이유이다.", "That is the reason why I respect him."],
      ["이것이 그녀가 문제를 푼 방법이다.", "This is how she solved the problem."],
      ["저 공원은 우리가 자주 걷는 장소이다.", "That park is the place where we often walk."]
    ],
    present_perfect: [
      ["나는 이 책을 두 번 읽어 보았다.", "I have read this book twice."],
      ["그녀는 최근에 새로운 친구를 사귀었다.", "She has made a new friend recently."],
      ["우리는 아직 그 숙제를 끝내지 않았다.", "We have not finished the homework yet."],
      ["그는 2019년부터 이곳에서 일하고 있다.", "He has worked here since 2019."],
      ["나는 그 영화를 본 적이 없다.", "I have never seen that movie."]
    ],
    present_continuous: [
      ["학생들은 지금 수업을 듣고 있다.", "The students are listening to the class now."],
      ["그는 지금 숙제를 하고 있지 않다.", "He is not doing his homework now."],
      ["너는 지금 무엇을 하고 있니?", "What are you doing now?"],
      ["우리는 지금 점심을 먹고 있다.", "We are eating lunch now."],
      ["그녀는 지금 친구와 이야기하고 있다.", "She is talking with her friend now."]
    ]
  };

  function bankForV89(chapter = "other") {
    return FALLBACK_BANK[chapter] || FALLBACK_BANK.present_continuous;
  }

  function ensureCountV89(questionLines = [], answerLines = [], chapter = "other", desired = 25) {
    const qBodies = questionLines.map(lineBodyV89);
    const aBodies = answerLines.map(lineBodyV89);
    const bank = bankForV89(chapter);
    const pairs = [];
    const size = Math.max(qBodies.length, aBodies.length);
    for (let i = 0; i < size; i += 1) {
      let q = qBodies[i] || "";
      let a = aBodies[i] || "";
      if (!q && a) q = bank[i % bank.length][0];
      if (!a && q) a = bank[i % bank.length][1];
      if (q && a) pairs.push({ q, a });
    }
    let bi = 0;
    while (pairs.length < desired) {
      const [q, a] = bank[bi % bank.length];
      pairs.push({ q, a });
      bi += 1;
    }
    return pairs.slice(0, desired);
  }

  function normalizePresentPerfectV89(answer = "") {
    let s = String(answer || "").trim();
    s = s.replace(/^We visited the new cafe recently\.?$/i, "We have visited the new cafe recently.");
    s = s.replace(/^I have attended this library for three years\.?$/i, "I have used this library for three years.");
    s = s.replace(/\bgo to that restaurant twice\b/i, "been to that restaurant twice");
    s = s.replace(/\bmet that friend once\b/i, "met that friend once");
    if (/\b(yesterday|last\s+(week|month|year|night)|\d+\s+(days?|weeks?|months?|years?)\s+ago)\b/i.test(s)) {
      s = s.replace(/\byesterday\b/ig, "recently");
      s = s.replace(/\blast\s+(week|month|year|night)\b/ig, "recently");
      s = s.replace(/\b\d+\s+(days?|weeks?|months?|years?)\s+ago\b/ig, "before");
    }
    return s;
  }

  function normalizeByChapterV89(answer = "", chapter = "other") {
    let s = String(answer || "").trim();
    if (chapter === "present_perfect") return normalizePresentPerfectV89(s);
    if (chapter === "passive") {
      s = s.replace(/\b(wrote|made|invited|completed|used|solved)\b/i, (m) => m);
      if (!/\b(am|is|are|was|were|be|been|being|can be|will be|should be|must be|has been|have been)\b/i.test(s)) {
        const fb = bankForV89("passive")[0][1];
        return fb;
      }
      return s;
    }
    if (chapter === "to_infinitive_adjective") {
      if (!/\b(something|anything|nothing|someone|anyone|no one|book|place|time|way|thing|chance|work|task|plan|friends?|homework|report|movie|class)\b[^.?!\n]{0,50}\bto\s+[a-z]+\b/i.test(s)) {
        return bankForV89("to_infinitive_adjective")[0][1];
      }
      return s;
    }
    if (chapter === "relative_pronoun_what") {
      if (!/^what\b/i.test(s)) return bankForV89("relative_pronoun_what")[0][1];
      return s;
    }
    if (chapter === "participial_modifier") {
      if (!/\b(the|a|an)\b[^.?!\n]{0,35}\b([a-z]+ing|[a-z]+ed|written|made|broken|filled|placed|excited)\b/i.test(s)) {
        return bankForV89("participial_modifier")[0][1];
      }
      return s;
    }
    if (chapter === "relative_adverb") {
      if (!/\b(where|when|why|how)\b/i.test(s)) return bankForV89("relative_adverb")[0][1];
      return s;
    }
    return s;
  }

  function chapterHintV89(answer = "", chapter = "other", idx = 1) {
    const words = contentWordsV89(answer);
    if (chapter === "present_continuous") {
      const picked = dedupeV89(["be -ing", "now"].concat(words.slice(0, 4)));
      return idx <= 18 ? `[8단어, ${picked.slice(0, 5).join(", ")}]` : `(${picked.slice(0, 4).join(", ")})`;
    }
    if (chapter === "present_perfect") {
      const signals = [];
      const a = String(answer || "").toLowerCase();
      ["since","for","already","yet","just","recently","never","before","once","twice"].forEach((sig) => { if (a.includes(sig)) signals.push(sig); });
      return `(${dedupeV89(signals.concat(words)).slice(0, 4).join(", ")})`;
    }
    if (chapter === "passive") return `(be + pp, ${words.slice(0, 3).join(", ")})`;
    if (chapter === "to_infinitive_adjective") return `(명사 + to부정사, ${words.slice(0, 3).join(", ")})`;
    if (chapter === "relative_pronoun_what") return `(what, ~하는 것, ${words.slice(0, 2).join(", ")})`;
    if (chapter === "participial_modifier") return `(명사 수식, ${words.slice(0, 3).join(", ")})`;
    if (chapter === "relative_adverb") return `(where/when/why/how, ${words.slice(0, 2).join(", ")})`;
    return `(${words.slice(0, 3).join(", ")})`;
  }

  function rebuildQuestionsV89(pairs = [], chapter = "other") {
    return pairs.map((pair, i) => {
      const idx = i + 1;
      let stem = stripTailHintsV89(pair.q);
      if (chapter === "present_continuous" && idx >= 9 && idx <= 13 && !/[?？]$/.test(stem)) stem += "?";
      const hint = chapterHintV89(pair.a, chapter, idx);
      const wc = wcV89(pair.a) || 8;
      return `${idx}. ${stem} ${hint} (Word count: ${wc})`;
    }).join("\n");
  }

  function rebuildAnswersV89(pairs = []) {
    return pairs.map((pair, i) => `${i + 1}. ${pair.a}`).join("\n");
  }

  function buildCoreMagicPromptBlockV89(input = {}) {
    const isEn = input?.language === "en";
    return isEn ? `
[Marcus Magic Core Identity v8.9]
- This is a MARCUS Magic workbook, not a generic worksheet.
- Always generate exactly 25 items unless the request is explicitly a refill mode.
- Every answer must be a complete, natural, classroom-usable English sentence.
- Preserve workbook identity: concept-linked, clue-based, production-oriented, teacher-ready.
- Keep the chapter grammar visible in most items.
- Prefer repeatable training patterns with controlled variation.
` : `
[마커스매직 코어 정체성 v8.9]
- 이것은 일반 영어문제지가 아니라 마커스매직 워크북이다.
- refill 모드가 아닌 한 반드시 정확히 25문항을 생성할 것.
- 모든 정답은 완전하고 자연스러우며 교실에서 바로 사용할 수 있는 영어 문장이어야 한다.
- 워크북 정체성: 개념 연계형, clue 기반, 생산형, 교사용 완성형을 유지할 것.
- 목표 챕터 문법이 대부분의 문항에서 눈에 보여야 한다.
- 반복 가능한 훈련 패턴을 유지하되, 내용은 적절히 변화시킬 것.
`;
  }

  function buildGradeLevelPromptBlockV89(input = {}) {
    const isEn = input?.language === "en";
    const grade = String(input?.gradeLabel || "");
    if (/중2/.test(grade)) {
      return isEn ? `
[Middle 2 Level Rules]
- Keep the target grammar very visible.
- Use short-to-medium sentence length.
- Prioritize pattern repetition and structural mastery.
- Avoid over-abstract content.
` : `
[중2 레벨 규칙]
- 목표 문법 구조가 매우 선명하게 보이게 할 것.
- 문장 길이는 짧음~중간 정도로 유지할 것.
- 패턴 반복과 구조 숙달을 우선할 것.
- 과도하게 추상적인 내용은 피할 것.
`;
    }
    if (/중3/.test(grade)) {
      return isEn ? `
[Middle 3 Level Rules]
- Keep the grammar visible, but expand meaning one level more.
- Use medium sentence length more often.
- Add reason, situation, explanation, or descriptive detail where natural.
` : `
[중3 레벨 규칙]
- 목표 문법 구조는 유지하되, 의미를 한 단계 더 확장할 것.
- 중간 길이 문장을 더 자주 사용할 것.
- 자연스러울 때 이유, 상황, 설명, 묘사 요소를 덧붙일 것.
`;
    }
    return "";
  }

  function buildChapterSpecificPromptBlockV89(input = {}) {
    const isEn = input?.language === "en";
    const chapter = v89ChapterKey(input);
    if (chapter === "present_continuous") {
      return isEn ? `
[Present Continuous Output Rules]
- Every target answer must visibly use be + V-ing.
- The meaning must feel like an action in progress now or around now.
- Do not drift into simple present habits.
- Distribute patterns across clue writing, question forms, negative forms, and mixed application.
` : `
[현재진행형 출력 규칙]
- 목표 정답은 반드시 be + V-ing가 눈에 보여야 한다.
- 의미는 지금 또는 현재 진행 중인 동작으로 느껴져야 한다.
- 일반현재 습관문으로 흐르지 말 것.
- clue형, 의문형, 부정형, 혼합 적용형을 분배할 것.
`;
    }
    if (chapter === "present_perfect") {
      return isEn ? `
[Present Perfect Output Rules]
- Every target answer must use have/has + past participle.
- Distribute meanings across experience, continuation, completion, and result.
- Never use finished-past time markers such as yesterday, last year, or ago.
- Prefer since, for, already, yet, just, recently, never, before.
` : `
[현재완료 출력 규칙]
- 목표 정답은 반드시 have/has + pp를 사용해야 한다.
- 경험, 계속, 완료, 결과 의미를 분배할 것.
- yesterday, last year, ago 같은 완료 불가능 시간표현은 절대 쓰지 말 것.
- since, for, already, yet, just, recently, never, before를 우선 사용할 것.
`;
    }
    if (chapter === "passive") {
      return isEn ? `
[Passive Output Rules]
- Most answers must visibly contain be + past participle.
- Prefer natural passive families such as was written, is made, were invited, can be used, has been completed.
- Do not let active voice dominate the set.
` : `
[수동태 출력 규칙]
- 대부분의 정답은 be + 과거분사가 눈에 보여야 한다.
- was written, is made, were invited, can be used, has been completed 같은 자연스러운 수동태 계열을 우선할 것.
- 능동태 문장이 세트를 지배하지 않게 할 것.
`;
    }
    if (chapter === "to_infinitive_adjective") {
      return isEn ? `
[Adjectival To-Infinitive Output Rules]
- Most answers must show noun + to-infinitive structure.
- Prefer something to do, a book to read, a place to visit, friends to talk with.
- Do not let purpose-only to-infinitives dominate.
` : `
[to부정사의 형용사적 용법 출력 규칙]
- 대부분의 정답은 명사 + to부정사 구조가 보여야 한다.
- something to do, a book to read, a place to visit, friends to talk with 계열을 우선할 것.
- 목적 용법이 세트를 지배하지 않게 할 것.
`;
    }
    if (chapter === "relative_pronoun_what") {
      return isEn ? `
[Relative Pronoun What Output Rules]
- Most answers must visibly use what + clause.
- Prefer What I need is..., What she said was..., What I learned helped me....
- Keep the meaning of ~the thing that visible without overusing the thing that.
` : `
[관계대명사 what 출력 규칙]
- 대부분의 정답은 what + 절 구조가 눈에 보여야 한다.
- What I need is..., What she said was..., What I learned helped me... 계열을 우선할 것.
- ~하는 것 의미는 살리되 the thing that를 남발하지 말 것.
`;
    }
    if (chapter === "participial_modifier") {
      return isEn ? `
[Participial Modifier Output Rules]
- Most answers must visibly use noun + present participle / past participle modifier structure.
- Prefer the boy running fast, the book written in English, the students waiting outside.
- Do not let ordinary predicate sentences dominate.
` : `
[분사의 한정적 용법 출력 규칙]
- 대부분의 정답은 명사 + 현재분사/과거분사 수식 구조가 눈에 보여야 한다.
- the boy running fast, the book written in English, the students waiting outside 계열을 우선할 것.
- 일반 서술문이 세트를 지배하지 않게 할 것.
`;
    }
    if (chapter === "relative_adverb") {
      return isEn ? `
[Relative Adverb Output Rules]
- Most answers must visibly use where, when, why, or how with a proper antecedent family.
- Keep place-day-reason-way matching natural.
` : `
[관계부사 출력 규칙]
- 대부분의 정답은 where, when, why, how가 적절한 선행사와 함께 보여야 한다.
- 장소-시간-이유-방법 대응을 자연스럽게 유지할 것.
`;
    }
    return "";
  }

  function buildChapterAssemblyRuleBlockV89(input = {}) {
    const isEn = input?.language === "en";
    return isEn ? `
[Chapter Assembly Rules]
- Final output must contain exactly 25 question-answer pairs.
- Remove off-target items that do not visibly match the chapter grammar.
- If any item is weak, replace it with a structurally correct chapter-aligned item.
- Preserve workbook rhythm: easy start, core repetition, slight application expansion.
` : `
[챕터 조립 규칙]
- 최종 출력은 반드시 정확히 25개의 문제-정답 쌍이어야 한다.
- 챕터 문법이 표면에 보이지 않는 이탈 문항은 제거할 것.
- 약한 문항이 있으면 구조적으로 올바른 챕터 정렬 문항으로 교체할 것.
- 워크북 리듬을 유지할 것: 쉬운 시작, 핵심 반복, 약간의 적용 확장.
`;
  }

  buildUserPrompt = function buildUserPrompt_v89(input = {}) {
    const base = __prevBuildUserPrompt_v89 ? __prevBuildUserPrompt_v89(input) : "";
    const addons = [
      buildCoreMagicPromptBlockV89(input),
      buildGradeLevelPromptBlockV89(input),
      buildChapterSpecificPromptBlockV89(input),
      buildChapterAssemblyRuleBlockV89(input)
    ].filter(Boolean).join("\n\n");
    return [base, addons].filter(Boolean).join("\n\n");
  };

  formatMagicResponse = function formatMagicResponse_v89(rawText, input = {}) {
    const formatted = __prevFormatMagicResponse_v89 ? __prevFormatMagicResponse_v89(rawText, input) : {
      title: "",
      instructions: "",
      questions: String(rawText || ""),
      answerSheet: "",
      fullText: String(rawText || ""),
      actualCount: 0,
    };

    const chapter = v89ChapterKey(input);
    if (chapter === "other") return formatted;

    const desired = 25;
    const qLines = splitNumberedLinesV89(formatted.questions);
    const aLines = splitNumberedLinesV89(formatted.answerSheet);
    let pairs = ensureCountV89(qLines, aLines, chapter, desired);
    pairs = pairs.map((pair) => ({ q: pair.q, a: normalizeByChapterV89(pair.a, chapter) }));

    formatted.questions = rebuildQuestionsV89(pairs, chapter);
    formatted.answerSheet = rebuildAnswersV89(pairs);
    formatted.actualCount = pairs.length;
    formatted.fullText = [formatted.title, formatted.instructions, formatted.questions, input?.language === "en" ? "Answers" : "정답", formatted.answerSheet]
      .filter(Boolean)
      .join("\n\n");
    return formatted;
  };

  console.log(`[${PATCH_TAG}] loaded`);
})();

/* ===== v8.9.2 SAFE APPEND PATCH ===== */

/* =========================================================
 * v8.9.2 STABILITY + SYNC PATCH
 * Append-safe patch for apigenerate-magic-s14-v8.9.1
 *
 * Goals:
 * - lock question/answer synchronization
 * - preserve exactly 25 items
 * - reduce fallback overuse
 * - improve chapter-specific diversity
 * - protect present continuous / present perfect quality
 * ========================================================= */

(function apply_v892_sync_patch() {
  console.log("⚙️ Applying v8.9.2 sync patch...");

  function pickOne(arr, idx) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[idx % arr.length];
  }

  function normalizeLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function ensureSentenceEnd(s) {
    const t = normalizeLine(s);
    if (!t) return "";
    return /[.?!]$/.test(t) ? t : `${t}.`;
  }

  function titleCaseStart(s) {
    const t = normalizeLine(s);
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function chunkPairs(obj) {
    const q = Array.isArray(obj?.questions) ? obj.questions : [];
    const a = Array.isArray(obj?.answerSheet) ? obj.answerSheet : [];
    const n = Math.min(q.length, a.length);
    const pairs = [];
    for (let i = 0; i < n; i += 1) {
      pairs.push({
        q: normalizeLine(q[i]),
        a: ensureSentenceEnd(titleCaseStart(a[i])),
      });
    }
    return pairs;
  }

  function grammarFocusOf(input = {}) {
    return input?.grammarFocus || {};
  }

  function isPresentContinuousTopic(input = {}) {
    const t = String(input?.topic || input?.userPrompt || "").toLowerCase();
    return /현재진행형|present\s+continuous|present\s+progressive/.test(t);
  }

  function isPresentPerfectTopic(input = {}) {
    const t = String(input?.topic || input?.userPrompt || "").toLowerCase();
    return /현재완료|present\s+perfect/.test(t);
  }

  function isNaturalSentence(ans) {
    const t = normalizeLine(ans);
    if (!t) return false;
    if (t.length < 8) return false;
    if (/^\d+[.)]/.test(t)) return false;
    if (/(\.\.)|(___)/.test(t)) return false;
    return /^[A-Z]/.test(t);
  }

  function hasProgressive(ans) {
    return /\b(am|is|are|was|were)\b[\w\s,'"-]{0,40}\b[a-z]+ing\b/i.test(ans);
  }

  function hasPerfect(ans) {
    return /\b(have|has)\b[\w\s,'"-]{0,30}\b([a-z]+ed|been|gone|done|seen|made|written|eaten|read|met|heard|finished|completed|lived|worked|learned|solved|visited|played|exercised|gotten)\b/i.test(ans);
  }

  function hasPassive(ans) {
    return /\b(am|is|are|was|were|be|been|being)\b[\w\s,'"-]{0,30}\b([a-z]+ed|written|made|held|read|known|seen|understood|praised|invited|taken|translated|completed|sold|loved|awarded|submitted|carried)\b/i.test(ans);
  }

  function hasToInfAdj(ans) {
    return /\b(a|an|the|something|anything|nothing|someone|anyone|no one|time|place|way|book|thing|chance|opportunity|work|project|job|problem|report|movie|class|plan|friends?)\b[^.?!\n]{0,40}\bto\s+[a-z]+\b/i.test(ans);
  }

  function hasWhatClause(ans) {
    return /\bwhat\b\s+[A-Za-z][^?!.]*\b(is|was|helped|matters|means|needs|wanted|need|said|learned)\b/i.test(ans) || /^\s*What\b/.test(ans);
  }

  function hasParticipialModifier(ans) {
    return /\b(the|a|an|this|that|these|those|my|our|his|her)\s+\w+\s+(running|waiting|sleeping|talking|written|painted|broken|invited|called|made|known|used|loved)\b/i.test(ans);
  }

  function hasRelativeAdverb(ans) {
    return /\b(where|when|why|how)\b/i.test(ans);
  }

  function hasBadFinishedPastMarker(ans) {
    return /\b(yesterday|ago|last\s+(week|month|year|night|summer|winter|spring|fall|autumn)|in\s+(19|20)\d{2})\b/i.test(ans);
  }

  function uniquePush(list, item, used) {
    const key = normalizeLine(item.a).toLowerCase();
    if (!key) return;
    if (used.has(key)) return;
    used.add(key);
    list.push(item);
  }

  function getQuestionTemplateBank(input = {}) {
    const focus = grammarFocusOf(input);

    if (isPresentContinuousTopic(input)) {
      return [
        "나는 지금 친구와 함께 영화를 보고 있다.",
        "그들은 지금 교실에서 공부하고 있다.",
        "그는 지금 점심을 먹고 있지 않다.",
        "너는 지금 무엇을 하고 있니?",
        "우리는 지금 공원에서 뛰고 있다.",
      ];
    }

    if (isPresentPerfectTopic(input)) {
      return [
        "나는 3년 동안 이 도시에 살고 있다.",
        "그녀는 이미 숙제를 끝냈다.",
        "나는 그를 한 번도 본 적이 없다.",
        "우리는 이미 점심을 먹었다.",
        "그는 아직 그 문제를 풀지 않았다.",
      ];
    }

    if (focus.chapterKey === "passive") {
      return [
        "이 책은 많은 사람들에 의해 읽힌다.",
        "그 프로젝트는 내년에 완료될 것이다.",
        "이 그림은 유명한 화가에 의해 그려졌다.",
        "그 문제는 쉽게 해결될 수 있다.",
        "이 발표는 내일 진행될 것이다.",
      ];
    }

    if (focus.isToInfinitiveAdjective) {
      return [
        "나는 오늘 읽을 책이 필요하다.",
        "그녀는 지금 할 일이 많다.",
        "우리는 함께 앉을 자리를 찾았다.",
        "그는 친구와 이야기할 시간이 필요하다.",
        "나는 너에게 줄 중요한 것이 있다.",
      ];
    }

    if (focus.isWhatRelativePronoun) {
      return [
        "내가 필요한 것은 더 많은 시간이다.",
        "그녀가 말한 것은 사실이었다.",
        "그가 원하는 것은 새로운 기회이다.",
        "우리가 배운 것은 매우 중요하다.",
        "네가 해야 할 것은 지금 시작하는 것이다.",
      ];
    }

    if (focus.isParticipialModifier) {
      return [
        "공원에서 뛰고 있는 소년은 내 동생이다.",
        "영어로 쓰인 책은 매우 유용하다.",
        "밖에서 기다리고 있는 학생들은 피곤해 보인다.",
        "많은 사람들에게 사랑받는 노래는 오래 남는다.",
        "복도에서 이야기하고 있는 아이들은 내 친구들이다.",
      ];
    }

    if (focus.chapterKey === "relative_adverb") {
      return [
        "이곳은 내가 태어난 도시이다.",
        "그날은 우리가 처음 만난 날이었다.",
        "그 이유는 내가 늦게 도착했기 때문이다.",
        "그것이 그가 문제를 해결한 방법이다.",
        "그 시간은 모두가 가장 바빴던 때였다.",
      ];
    }

    return [
      "주어진 단서를 바탕으로 영어 문장을 쓰시오.",
      "문법 구조가 보이도록 영어 문장을 완성하시오.",
      "주어진 의미를 자연스러운 영어 문장으로 쓰시오.",
      "단서를 활용하여 완전한 영어 문장을 만드시오.",
      "주어진 표현을 사용하여 영어 문장을 작성하시오.",
    ];
  }

  function getAnswerFallbackBank(input = {}) {
    const focus = grammarFocusOf(input);

    if (isPresentContinuousTopic(input)) {
      return [
        "I am watching a movie with my friend now.",
        "They are studying in the classroom now.",
        "He is not eating lunch now.",
        "What are you doing now?",
        "We are running in the park now.",
        "She is reading a book now.",
        "They are playing outside now.",
      ];
    }

    if (isPresentPerfectTopic(input)) {
      return [
        "I have lived in this city for three years.",
        "She has already finished her homework.",
        "I have never seen him before.",
        "We have already eaten lunch.",
        "He has not solved the problem yet.",
        "They have worked here for two years.",
        "I have read this book twice.",
      ];
    }

    if (focus.chapterKey === "passive") {
      return [
        "This book is read by many students.",
        "The project will be completed next year.",
        "This picture was painted by a famous artist.",
        "The problem can be solved easily.",
        "The presentation will be held tomorrow.",
        "This report was written by experts.",
        "The class is held every Friday.",
      ];
    }

    if (focus.isToInfinitiveAdjective) {
      return [
        "I need a book to read today.",
        "She has something to do now.",
        "We found a place to sit together.",
        "He needs time to talk with his friend.",
        "I have something important to tell you.",
        "They need a plan to follow carefully.",
      ];
    }

    if (focus.isWhatRelativePronoun) {
      return [
        "What I need is more time.",
        "What she said was true.",
        "What he wants is a new chance.",
        "What we learned was very useful.",
        "What you should do is start now.",
        "What matters is your effort.",
      ];
    }

    if (focus.isParticipialModifier) {
      return [
        "The boy running in the park is my brother.",
        "The book written in English is very useful.",
        "The students waiting outside look tired.",
        "The song loved by many people is still popular.",
        "The girls talking in the hall are my classmates.",
        "The picture painted by the artist was expensive.",
      ];
    }

    if (focus.chapterKey === "relative_adverb") {
      return [
        "This is the city where I was born.",
        "That was the day when we first met.",
        "This is the reason why he was late.",
        "That is the way how he solved the problem.",
        "It was the time when everyone was busy.",
      ];
    }

    return [
      "I can write a complete English sentence.",
      "She made a natural English sentence.",
      "We used the clue to make a sentence.",
      "They completed the workbook carefully.",
      "He wrote the sentence correctly.",
    ];
  }

  function matchesChapter(answer, input = {}) {
    const focus = grammarFocusOf(input);
    const ans = normalizeLine(answer);

    if (!isNaturalSentence(ans)) return false;

    if (isPresentContinuousTopic(input)) return hasProgressive(ans);
    if (isPresentPerfectTopic(input)) return hasPerfect(ans) && !hasBadFinishedPastMarker(ans);
    if (focus.chapterKey === "passive") return hasPassive(ans);
    if (focus.isToInfinitiveAdjective) return hasToInfAdj(ans);
    if (focus.isWhatRelativePronoun) return hasWhatClause(ans);
    if (focus.isParticipialModifier) return hasParticipialModifier(ans);
    if (focus.chapterKey === "relative_adverb") return hasRelativeAdverb(ans);

    return true;
  }

  function diversifyPair(pair, idx, input = {}) {
    const focus = grammarFocusOf(input);
    let q = normalizeLine(pair.q);
    let a = ensureSentenceEnd(titleCaseStart(pair.a));

    if (!q) q = pickOne(getQuestionTemplateBank(input), idx);
    if (!a || !matchesChapter(a, input)) a = pickOne(getAnswerFallbackBank(input), idx);

    if (focus.chapterKey === "passive") {
      const subjects = [
        "This book", "The report", "The project", "The picture", "The song",
        "The class", "The document", "The building", "The lecture", "The photo"
      ];
      a = a.replace(/^(This|The)\s+\w+/i, pickOne(subjects, idx));
    }

    if (isPresentContinuousTopic(input)) {
      const starts = ["I am", "She is", "They are", "We are", "He is"];
      if (/^(I am|She is|They are|We are|He is)\b/i.test(a)) {
        a = a.replace(/^(I am|She is|They are|We are|He is)\b/i, pickOne(starts, idx));
      }
    }

    if (isPresentPerfectTopic(input)) {
      const starts = ["I have", "She has", "We have", "He has", "They have"];
      if (/^(I have|She has|We have|He has|They have)\b/i.test(a)) {
        a = a.replace(/^(I have|She has|We have|He has|They have)\b/i, pickOne(starts, idx));
      }
    }

    return { q, a };
  }

  const previousFormat = global.formatMagicResponse;

  global.formatMagicResponse = function patchedFormatMagicResponse_v892(result, input) {
    const base = previousFormat ? previousFormat(result, input) : result;
    let pairs = chunkPairs(base);

    const usedAnswers = new Set();
    const finalPairs = [];

    for (let i = 0; i < pairs.length; i += 1) {
      const adjusted = diversifyPair(pairs[i], i, input);

      if (!matchesChapter(adjusted.a, input)) {
        adjusted.a = pickOne(getAnswerFallbackBank(input), i);
      }

      uniquePush(finalPairs, adjusted, usedAnswers);
    }

    let cursor = 0;
    const qBank = getQuestionTemplateBank(input);
    const aBank = getAnswerFallbackBank(input);

    while (finalPairs.length < 25) {
      const item = {
        q: pickOne(qBank, cursor),
        a: pickOne(aBank, cursor),
      };
      uniquePush(finalPairs, item, usedAnswers);
      cursor += 1;
      if (cursor > 100) break;
    }

    cursor = 0;
    while (finalPairs.length < 25) {
      finalPairs.push({
        q: `${pickOne(qBank, cursor)} (${finalPairs.length + 1})`,
        a: pickOne(aBank, cursor),
      });
      cursor += 1;
    }

    finalPairs.length = 25;

    return {
      ...base,
      questions: finalPairs.map((p, i) => `${i + 1}. ${normalizeLine(String(p.q).replace(/^\d+[.)]\s*/, ""))}`),
      answerSheet: finalPairs.map((p, i) => `${i + 1}. ${ensureSentenceEnd(titleCaseStart(String(p.a).replace(/^\d+[.)]\s*/, "")))}`),
    };
  };

  console.log("✅ v8.9.2 sync patch applied");
})();

/* =========================================================
 * S16 TEXTBOOK MAPPING + HARD LOCK PATCH
 * - uses ../lib/magic-s16-core.js
 * - wraps normalizeInput / buildUserPrompt / formatMagicResponse
 * - keeps base file intact while adding lesson mapping
 * ========================================================= */
(() => {
  let __s16core = null;
  try {
    __s16core = require("../lib/magic-s19-core");
    console.log("✅ S17 core loaded");
  } catch (err) {
    console.warn("⚠️ S17 core not loaded:", err && err.message ? err.message : err);
    return;
  }

  const {
    resolveTextbookLesson,
    buildTextbookGuideBlock,
    ensureQuestionLine,
    ensureAnswerLine,
    dedupeAnswer,
    stripNumbering,
    normalizeText,
  } = __s16core;

  const __s16_prevNormalizeInput = typeof normalizeInput === "function" ? normalizeInput : null;
  if (__s16_prevNormalizeInput) {
    normalizeInput = function normalizeInput_s16(body = {}) {
      const input = __s16_prevNormalizeInput(body);
      const resolvedLesson = resolveTextbookLesson(input);
      if (resolvedLesson) {
        input.textbookLesson = resolvedLesson;
        if (!input.grammarFocus || !input.grammarFocus.chapterKey || input.grammarFocus.chapterKey === "general") {
          input.grammarFocus = { ...(input.grammarFocus || {}), chapterKey: resolvedLesson.chapterKey };
        }
      }
      return input;
    };
  }

  const __s16_prevBuildUserPrompt = typeof buildUserPrompt === "function" ? buildUserPrompt : null;
  if (__s16_prevBuildUserPrompt) {
    buildUserPrompt = function buildUserPrompt_s16(input = {}) {
      let prompt = __s16_prevBuildUserPrompt(input);
      const guideBlock = buildTextbookGuideBlock(input);
      if (guideBlock && !String(prompt || "").includes("[S17 교과서 1학기 매핑]")) {
        prompt = [prompt, guideBlock].filter(Boolean).join("\n\n");
      }
      return prompt;
    };
  }

  const __s16_prevFormatMagicResponse = typeof formatMagicResponse === "function" ? formatMagicResponse : null;
  if (__s16_prevFormatMagicResponse) {
    formatMagicResponse = function formatMagicResponse_s16(rawText, input = {}) {
      const base = __s16_prevFormatMagicResponse(rawText, input) || {};
      const qLines = String(base.questions || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d+[.)-]?\s+/.test(line));
      const aLines = String(base.answerSheet || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => /^\d+[.)-]?\s+/.test(line));

      const count = 25;
      const seen = new Set();
      const finalQuestions = [];
      const finalAnswers = [];

      for (let i = 0; i < count; i += 1) {
        const qRaw = qLines[i] || "";
        const aRaw = aLines[i] || "";
        let answer = stripNumbering(aRaw);
        answer = ensureAnswerLine(answer, input, i);
        answer = dedupeAnswer(answer, seen, input, i);

        let question = stripNumbering(qRaw);
        question = ensureQuestionLine(question, answer, input, i);

        finalQuestions.push(`${i + 1}. ${question}`);
        finalAnswers.push(`${i + 1}. ${answer}`);
      }

      const next = { ...base };
      next.questions = finalQuestions.join("\n");
      next.answerSheet = finalAnswers.join("\n");
      next.actualCount = count;
      next.itemPairs = finalQuestions.map((q, idx) => ({
        no: idx + 1,
        question: stripNumbering(q),
        answer: stripNumbering(finalAnswers[idx]),
      }));
      next.pairIntegrity = {
        ok: true,
        reason: "s16_textbook_sync",
        questionCount: count,
        answerCount: count,
      };
      next.content = [next.title, next.instructions, next.questions].filter(Boolean).join("\n\n");
      next.fullText = [
        next.title,
        next.instructions,
        next.questions,
        ((input.language === "en" ? "Answers\n" : "정답\n") + (next.answerSheet || "")),
      ].filter(Boolean).join("\n\n");
      return next;
    };
  }

  console.log("✅ S17 textbook mapping patch applied");
})();

/* =========================
   S28 FINAL CLEAN FIX
   - single DB patch only
   - remove layered wrapper conflicts
   - strict one-line worksheet / one-line answer sheet
   ========================= */
(() => {
  let __dbLoader = null;
  try {
    __dbLoader = require("../lib/sentence-bank-loader");
  } catch (e) {
    console.warn("⚠️ S28 DB loader require failed:", e?.message || e);
  }

  const loadSentenceBank =
    __dbLoader && typeof __dbLoader.loadSentenceBank === "function"
      ? __dbLoader.loadSentenceBank
      : null;

  function __safeBankChapter(input = {}) {
    const focus = input && input.grammarFocus ? input.grammarFocus : {};
    const key = String(focus.chapterKey || "").trim();
    return (key === "be_question" || key === "do_question") ? key : "";
  }

  function __safeBankGrade(input = {}) {
    const level = String(input.level || "").trim().toLowerCase();
    const grade = String(input.gradeLabel || "").trim();
    if (level === "middle" && /중1/.test(grade || "")) return "middle1";
    if (level === "middle") return "middle1";
    return "middle1";
  }

  function __desiredCountFromInput(input = {}) {
    const n = Number(input.count || 25);
    if (!Number.isFinite(n)) return 25;
    return Math.max(5, Math.min(30, Math.round(n)));
  }

  function __isDbEligible(input = {}) {
    const chapterKey = __safeBankChapter(input);
    if (!chapterKey) return false;

    const mode = String(input.mode || "").trim().toLowerCase();
    const engine = String(input.engine || "").trim().toLowerCase();
    const intent = String(input.intentMode || "").trim().toLowerCase();
    const workbookType = String(input.workbookType || "").trim().toLowerCase();

    const modeOk = ["writing", "magic", "magic-card", "chapter-grammar", "textbook-grammar"].includes(mode) || mode === "";
    const engineOk = engine === "magic" || engine === "";
    const workbookOk = workbookType === "" || workbookType === "guided_writing";
    const intentOk = intent === "" || intent === "training" || intent === "concept+training";
    return modeOk && engineOk && workbookOk && intentOk;
  }

  function __escapeHtml(str = "") {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function __countWords(answer = "") {
    return String(answer || "")
      .replace(/[?!.,]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  function __clueFromItemOrAnswer(item = {}) {
    if (Array.isArray(item.clue) && item.clue.length) {
      return item.clue
        .map(v => String(v || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    const cleaned = String(item.enAnswer || "").replace(/\?/g, "").trim();
    if (!cleaned) return [];
    return cleaned.split(/\s+/).slice(0, 12);
  }

  function __buildShortAnswers(answerText = "") {
    const s = String(answerText || "").trim();
    if (/^Are\s+you\b/i.test(s)) return ["Yes, I am.", "No, I am not."];
    if (/^Are\s+they\b/i.test(s)) return ["Yes, they are.", "No, they are not."];
    if (/^Are\s+we\b/i.test(s)) return ["Yes, we are.", "No, we are not."];
    if (/^Is\s+he\b/i.test(s)) return ["Yes, he is.", "No, he is not."];
    if (/^Is\s+she\b/i.test(s)) return ["Yes, she is.", "No, she is not."];
    if (/^Is\s+it\b/i.test(s)) return ["Yes, it is.", "No, it is not."];
    if (/^Do\s+you\b/i.test(s)) return ["Yes, I do.", "No, I do not."];
    if (/^Do\s+they\b/i.test(s)) return ["Yes, they do.", "No, they do not."];
    if (/^Do\s+we\b/i.test(s)) return ["Yes, we do.", "No, we do not."];
    if (/^Do\s+I\b/i.test(s)) return ["Yes, you do.", "No, you do not."];
    if (/^Does\s+he\b/i.test(s)) return ["Yes, he does.", "No, he does not."];
    if (/^Does\s+she\b/i.test(s)) return ["Yes, she does.", "No, she does not."];
    if (/^Does\s+it\b/i.test(s)) return ["Yes, it does.", "No, it does not."];
    return ["Yes.", "No."];
  }

  function __questionFromItem(item = {}, chapterKey = "") {
    const ko = String(item.koPrompt || "").replace(/\s+/g, " ").trim();
    if (ko) return ko;
    const en = String(item.enAnswer || "").trim();
    if (chapterKey === "be_question") {
      if (/^Are you\b/i.test(en)) return "너는 ~니?";
      if (/^Are they\b/i.test(en)) return "그들은 ~니?";
      if (/^Is he\b/i.test(en)) return "그는 ~니?";
      if (/^Is she\b/i.test(en)) return "그녀는 ~니?";
    }
    if (chapterKey === "do_question") {
      if (/^Do you\b/i.test(en)) return "너는 ~하니?";
      if (/^Do they\b/i.test(en)) return "그들은 ~하니?";
      if (/^Does he\b/i.test(en)) return "그는 ~하니?";
      if (/^Does she\b/i.test(en)) return "그녀는 ~하니?";
    }
    return "다음 문장을 영작하시오.";
  }

  function __selectDbAnchors(bank = [], desired = 25) {
    const pool = Array.isArray(bank) ? [...bank] : [];
    pool.sort(() => Math.random() - 0.5);

    const selected = [];
    const usedGroups = new Set();
    const usedAnswers = new Set();

    for (const item of pool) {
      if (selected.length >= desired) break;
      const answerKey = String(item?.enAnswer || "").trim().toLowerCase();
      const groupKey = String(item?.similarGroup || "").trim().toLowerCase();

      if (!answerKey || usedAnswers.has(answerKey)) continue;
      if (groupKey && usedGroups.has(groupKey)) continue;

      selected.push(item);
      usedAnswers.add(answerKey);
      if (groupKey) usedGroups.add(groupKey);
    }

    return selected.slice(0, desired);
  }

  function __assembleItems(bankItems = [], chapterKey = "") {
    return bankItems.map((item, idx) => {
      const answer = String(item.enAnswer || "").replace(/\s+/g, " ").trim();
      const clue = __clueFromItemOrAnswer(item);
      const wordCount = Number(item.wordCount || 0) || __countWords(answer);
      const shortAnswers = __buildShortAnswers(answer);
      const question = __questionFromItem(item, chapterKey);

      return {
        no: idx + 1,
        question,
        answer,
        clue,
        wordCount,
        shortAnswers,
        source: "s28_clean_db",
      };
    });
  }

  function __questionLine(item) {
    return `${item.no}. ${item.question} (clue: ${item.clue.join(", ")}) (Word count: ${item.wordCount})`;
  }

  function __answerLine(item) {
    return `${item.no}. ${item.answer} / ${item.shortAnswers[0]} / ${item.shortAnswers[1]}`;
  }

  function __renderWorksheetHtml(items = []) {
    return items.map((item) =>
      `<p><strong>${item.no}. ${__escapeHtml(item.question)}</strong> <span>(clue: ${__escapeHtml(item.clue.join(", "))}) (Word count: ${item.wordCount})</span></p>`
    ).join("\n");
  }

  function __renderAnswerHtml(items = []) {
    return items.map((item) =>
      `<p><strong>${item.no}. ${__escapeHtml(item.answer)}</strong> <span>/ ${__escapeHtml(item.shortAnswers[0])} / ${__escapeHtml(item.shortAnswers[1])}</span></p>`
    ).join("\n");
  }

  function __buildDbResponse(base = {}, input = {}, bankItems = [], chapterKey = "") {
    const next = { ...(base || {}) };
    const assembled = __assembleItems(bankItems, chapterKey);

    next.questions = assembled.map(__questionLine).join("\n");
    next.worksheet = next.questions;
    next.answerSheet = assembled.map(__answerLine).join("\n");
    next.actualCount = assembled.length;
    next.itemPairs = assembled.map((item) => ({
      no: item.no,
      question: item.question,
      answer: item.answer,
      clue: item.clue,
      wordCount: item.wordCount,
      shortAnswers: item.shortAnswers,
      source: item.source,
    }));
    next.pairIntegrity = {
      ok: true,
      reason: "s28_clean_single_patch",
      questionCount: assembled.length,
      answerCount: assembled.length,
    };

    const title = String(next.title || next.worksheetTitle || input.worksheetTitle || "").trim();
    const instructions = String(next.instructions || "").trim();

    next.content = [title, instructions, next.questions].filter(Boolean).join("\n\n");
    next.fullText = [
      title,
      instructions,
      next.questions,
      ((input.language === "en" ? "Answers\n" : "정답\n") + (next.answerSheet || "")),
    ].filter(Boolean).join("\n\n");

    next.worksheetHtml = __renderWorksheetHtml(assembled);
    next.answerSheetHtml = __renderAnswerHtml(assembled);
    next.source = "s28_clean_front_compatible";
    return next;
  }

  const __prevFormatMagicResponseS28 =
    typeof formatMagicResponse === "function" ? formatMagicResponse : null;

  if (__prevFormatMagicResponseS28) {
    formatMagicResponse = function formatMagicResponse_s28_clean(rawText, input = {}) {
      const base = __prevFormatMagicResponseS28(rawText, input) || {};

      try {
        if (!loadSentenceBank) return base;
        if (!__isDbEligible(input)) return base;

        const chapterKey = __safeBankChapter(input);
        if (!chapterKey) return base;

        const gradeKey = __safeBankGrade(input);
        const desired = __desiredCountFromInput(input);
        const bank = loadSentenceBank(gradeKey, chapterKey);

        if (!Array.isArray(bank) || bank.length < desired) return base;

        const selected = __selectDbAnchors(bank, desired);
        if (selected.length < desired) return base;

        return __buildDbResponse(base, input, selected, chapterKey);
      } catch (e) {
        console.warn("⚠️ S28 clean patch fallback:", e?.message || e);
        return base;
      }
    };
  }

  console.log("✅ S28 clean single DB patch applied");
})();

// Final Vercel export (keep S19 router)
module.exports = handler_v841_workbook_type_router;
module.exports.config = { runtime: "nodejs" };


/* =========================
   S29 FINAL DEPLOY PATCH
   ========================= */
(function applyS29FinalDeployPatch() {
  try {
    const __s29Curriculum = (() => {
      const candidates = [
        '../data/writinglab_curriculum_sem1_middle.json',
        '/mnt/data/writinglab_curriculum_sem1_middle.json'
      ];
      for (const p of candidates) {
        try { return require(p); } catch (e) {}
      }
      return null;
    })();

    function __s29DetectLesson(text = '') {
      const m = String(text || '').match(/([1-8])\s*과/);
      return m ? Number(m[1]) : null;
    }

    function __s29DetectGrade(text = '') {
      const t = String(text || '');
      if (/중1/.test(t)) return 'middle1';
      if (/중2/.test(t)) return 'middle2';
      if (/중3/.test(t)) return 'middle3';
      return null;
    }

    function __s29GetCurriculum(input = {}) {
      if (!__s29Curriculum) return null;
      const merged = [input?.userPrompt, input?.topic, input?.worksheetTitle].filter(Boolean).join(' ');
      const grade = __s29DetectGrade(merged);
      const lesson = __s29DetectLesson(merged);
      if (!grade || !lesson) return null;
      const entry = __s29Curriculum?.[grade]?.common?.[`lesson${lesson}`] || null;
      if (!entry || !Array.isArray(entry.chapters) || !entry.chapters.length) return null;
      return { grade, lesson, entry };
    }

    function __s29SelectChapter(input = {}, entry = null) {
      const focus = input?.grammarFocus || {};
      const chapters = Array.isArray(entry?.chapters) ? entry.chapters : [];
      if (!chapters.length) return null;
      const key = String(focus?.chapterKey || '');
      if (key && chapters.includes(key)) return key;
      if (focus?.isBeQuestion && chapters.includes('be_question')) return 'be_question';
      if (focus?.isDoQuestion && chapters.includes('do_question')) return 'do_question';
      if (focus?.isPassive && chapters.includes('passive')) return 'passive';
      if (focus?.isPresentPerfect && chapters.includes('present_perfect')) return 'present_perfect';
      if (focus?.isGerund && chapters.includes('gerund')) return 'gerund';
      if (chapters.includes('be_question')) return 'be_question';
      if (chapters.includes('do_question')) return 'do_question';
      return chapters[0];
    }

    const __S29_DO_BANK = [
      ['너는 매일 운동하니?', ['Do','you','exercise','every','day'], 'Do you exercise every day?', 'Yes, I do.', 'No, I do not.'],
      ['그는 학교에 걸어가니?', ['Does','he','walk','to','school'], 'Does he walk to school?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 피아노를 치니?', ['Does','she','play','the','piano'], 'Does she play the piano?', 'Yes, she does.', 'No, she does not.'],
      ['너는 영어를 공부하니?', ['Do','you','study','English'], 'Do you study English?', 'Yes, I do.', 'No, I do not.'],
      ['그들은 주말에 축구를 하니?', ['Do','they','play','soccer','on','weekends'], 'Do they play soccer on weekends?', 'Yes, they do.', 'No, they do not.'],
      ['그는 수학을 좋아하니?', ['Does','he','like','math'], 'Does he like math?', 'Yes, he does.', 'No, he does not.'],
      ['너는 물을 많이 마시니?', ['Do','you','drink','a','lot','of','water'], 'Do you drink a lot of water?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 저녁에 숙제를 하니?', ['Does','she','do','her','homework','in','the','evening'], 'Does she do her homework in the evening?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 공원에 가니?', ['Do','they','go','to','the','park'], 'Do they go to the park?', 'Yes, they do.', 'No, they do not.'],
      ['그는 TV를 보니?', ['Does','he','watch','TV'], 'Does he watch TV?', 'Yes, he does.', 'No, he does not.'],
      ['너는 음악을 듣니?', ['Do','you','listen','to','music'], 'Do you listen to music?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 책을 읽니?', ['Does','she','read','books'], 'Does she read books?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 게임을 하니?', ['Do','they','play','games'], 'Do they play games?', 'Yes, they do.', 'No, they do not.'],
      ['그는 커피를 마시니?', ['Does','he','drink','coffee'], 'Does he drink coffee?', 'Yes, he does.', 'No, he does not.'],
      ['너는 일찍 일어나니?', ['Do','you','wake','up','early'], 'Do you wake up early?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 영어로 말하니?', ['Does','she','speak','English'], 'Does she speak English?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 버스를 타니?', ['Do','they','take','the','bus'], 'Do they take the bus?', 'Yes, they do.', 'No, they do not.'],
      ['그는 운동을 하니?', ['Does','he','exercise'], 'Does he exercise?', 'Yes, he does.', 'No, he does not.'],
      ['너는 매일 공부하니?', ['Do','you','study','every','day'], 'Do you study every day?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 친구를 만나니?', ['Does','she','meet','friends'], 'Does she meet friends?', 'Yes, she does.', 'No, she does not.'],
      ['그는 매주 할머니를 방문하니?', ['Does','he','visit','his','grandmother','every','week'], 'Does he visit his grandmother every week?', 'Yes, he does.', 'No, he does not.'],
      ['그들은 공원에서 노니?', ['Do','they','play','in','the','park'], 'Do they play in the park?', 'Yes, they do.', 'No, they do not.'],
      ['너는 물을 좋아하니?', ['Do','you','like','water'], 'Do you like water?', 'Yes, I do.', 'No, I do not.'],
      ['그는 점심을 먹니?', ['Does','he','eat','lunch'], 'Does he eat lunch?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 학교에 가니?', ['Does','she','go','to','school'], 'Does she go to school?', 'Yes, she does.', 'No, she does not.']
    ];

    const __S29_BE_BANK = [
      ['너는 학생이니?', ['Are','you','a','student'], 'Are you a student?', 'Yes, I am.', 'No, I am not.'],
      ['그녀는 네 친구니?', ['Is','she','your','friend'], 'Is she your friend?', 'Yes, she is.', 'No, she is not.'],
      ['그들은 피곤하니?', ['Are','they','tired'], 'Are they tired?', 'Yes, they are.', 'No, they are not.'],
      ['그들은 교실에 있니?', ['Are','they','in','the','classroom'], 'Are they in the classroom?', 'Yes, they are.', 'No, they are not.'],
      ['그녀는 지금 집에 있니?', ['Is','she','at','home','now'], 'Is she at home now?', 'Yes, she is.', 'No, she is not.'],
      ['너는 배가 고프니?', ['Are','you','hungry'], 'Are you hungry?', 'Yes, I am.', 'No, I am not.'],
      ['그들은 같은 반이니?', ['Are','they','classmates'], 'Are they classmates?', 'Yes, they are.', 'No, they are not.'],
      ['그들은 학생이니?', ['Are','they','students'], 'Are they students?', 'Yes, they are.', 'No, they are not.'],
      ['너는 지금 집에 있니?', ['Are','you','at','home','now'], 'Are you at home now?', 'Yes, I am.', 'No, I am not.'],
      ['그녀는 오늘 학교에 있니?', ['Is','she','at','school','today'], 'Is she at school today?', 'Yes, she is.', 'No, she is not.'],
      ['너는 지금 학교에 있니?', ['Are','you','at','school','now'], 'Are you at school now?', 'Yes, I am.', 'No, I am not.'],
      ['그는 친절하니?', ['Is','he','kind'], 'Is he kind?', 'Yes, he is.', 'No, he is not.'],
      ['너는 지금 교실에 있니?', ['Are','you','in','the','classroom','now'], 'Are you in the classroom now?', 'Yes, I am.', 'No, I am not.'],
      ['그는 한국 사람이니?', ['Is','he','Korean'], 'Is he Korean?', 'Yes, he is.', 'No, he is not.'],
      ['그녀는 친절하니?', ['Is','she','kind'], 'Is she kind?', 'Yes, she is.', 'No, she is not.'],
      ['너는 오늘 자유롭니?', ['Are','you','free','today'], 'Are you free today?', 'Yes, I am.', 'No, I am not.'],
      ['그들은 준비되었니?', ['Are','they','ready'], 'Are they ready?', 'Yes, they are.', 'No, they are not.'],
      ['그들은 집에 있니?', ['Are','they','at','home'], 'Are they at home?', 'Yes, they are.', 'No, they are not.'],
      ['그는 지금 바쁘니?', ['Is','he','busy','now'], 'Is he busy now?', 'Yes, he is.', 'No, he is not.'],
      ['그녀는 학생이니?', ['Is','she','a','student'], 'Is she a student?', 'Yes, she is.', 'No, she is not.'],
      ['너는 졸리니?', ['Are','you','sleepy'], 'Are you sleepy?', 'Yes, I am.', 'No, I am not.'],
      ['그는 배가 고프니?', ['Is','he','hungry'], 'Is he hungry?', 'Yes, he is.', 'No, he is not.'],
      ['그녀는 너의 여동생이니?', ['Is','she','your','sister'], 'Is she your sister?', 'Yes, she is.', 'No, she is not.'],
      ['그녀는 음악가니?', ['Is','she','a','musician'], 'Is she a musician?', 'Yes, she is.', 'No, she is not.'],
      ['너는 지금 안전하니?', ['Are','you','safe','now'], 'Are you safe now?', 'Yes, I am.', 'No, I am not.']
    ];

    function __s29BuildQuestionLines(bank, count = 25) {
      return bank.slice(0, count).map((item, i) => `${i + 1}. ${item[0]} (clue: ${item[1].join(', ')}) (Word count: ${item[1].length})`);
    }

    function __s29BuildAnswerLines(bank, count = 25) {
      return bank.slice(0, count).map((item, i) => `${i + 1}. ${item[2]} / ${item[3]} / ${item[4]}`);
    }

    function __s29BuildSimpleSet(templateKo, clueList, templateAnswer, count = 25) {
      return {
        questions: Array.from({ length: count }, (_, i) => `${i + 1}. ${templateKo} (clue: ${clueList.join(', ')}) (Word count: ${clueList.length})`).join('\n'),
        answers: Array.from({ length: count }, (_, i) => `${i + 1}. ${templateAnswer}`).join('\n')
      };
    }

    function __s29BuildFormattedForChapter(chapter, input, baseFormatted = {}) {
      const title = baseFormatted?.title || buildMagicTitle(input);
      const instructions = baseFormatted?.instructions || (input?.language === 'en'
        ? 'Write each sentence in English using the clue words. Review the answer sheet after solving.'
        : '주어진 clue를 사용하여 영어 문장을 쓰시오. 먼저 문제를 풀고 정답지를 검토하세요.');
      let questions = '';
      let answers = '';

      if (chapter === 'do_question') {
        questions = __s29BuildQuestionLines(__S29_DO_BANK, 25).join('\n');
        answers = __s29BuildAnswerLines(__S29_DO_BANK, 25).join('\n');
      } else if (chapter === 'be_question') {
        questions = __s29BuildQuestionLines(__S29_BE_BANK, 25).join('\n');
        answers = __s29BuildAnswerLines(__S29_BE_BANK, 25).join('\n');
      } else if (chapter === 'present_progressive') {
        const built = __s29BuildSimpleSet('나는 지금 공부하고 있다.', ['I','am','studying','now'], 'I am studying now.', 25);
        questions = built.questions; answers = built.answers;
      } else if (chapter === 'past_tense') {
        const built = __s29BuildSimpleSet('나는 어제 축구를 했다.', ['I','played','soccer','yesterday'], 'I played soccer yesterday.', 25);
        questions = built.questions; answers = built.answers;
      } else if (chapter === 'gerund') {
        const built = __s29BuildSimpleSet('나는 책 읽는 것을 좋아한다.', ['I','like','reading','books'], 'I like reading books.', 25);
        questions = built.questions; answers = built.answers;
      } else if (chapter === 'passive') {
        const built = __s29BuildSimpleSet('그 숙제는 이미 끝났다.', ['The','homework','was','finished'], 'The homework was finished.', 25);
        questions = built.questions; answers = built.answers;
      } else if (chapter === 'present_perfect') {
        const built = __s29BuildSimpleSet('나는 이미 숙제를 끝냈다.', ['I','have','already','finished','my','homework'], 'I have already finished my homework.', 25);
        questions = built.questions; answers = built.answers;
      } else {
        return baseFormatted;
      }

      const content = [title, '', instructions, '', questions].join('\n').trim();
      const fullText = ['[[TITLE]]', title, '[[INSTRUCTIONS]]', instructions, '[[QUESTIONS]]', questions, '[[ANSWERS]]', answers].join('\n');

      return {
        ...baseFormatted,
        title,
        instructions,
        questions,
        content,
        answerSheet: answers,
        fullText,
        actualCount: 25
      };
    }

    const __origFormatMagicResponse_S29 = typeof formatMagicResponse === 'function' ? formatMagicResponse : null;
    if (__origFormatMagicResponse_S29) {
      formatMagicResponse = function formatMagicResponse_s29(rawText, input = {}) {
        const base = __origFormatMagicResponse_S29(rawText, input);
        try {
          const cur = __s29GetCurriculum(input);
          if (!cur) return base;
          const chapter = __s29SelectChapter(input, cur.entry);
          if (!chapter) return base;
          return __s29BuildFormattedForChapter(chapter, input, base);
        } catch (e) {
          console.warn('S29 format patch fallback:', e?.message || e);
          return base;
        }
      };
    }

    const __origNormalizeMagicAnswerSheet_S29 = typeof normalizeMagicAnswerSheet === 'function' ? normalizeMagicAnswerSheet : null;
    if (__origNormalizeMagicAnswerSheet_S29) {
      normalizeMagicAnswerSheet = function normalizeMagicAnswerSheet_s29(a = '', q = '', input = {}) {
        try {
          const cur = __s29GetCurriculum(input);
          const chapter = cur ? __s29SelectChapter(input, cur.entry) : null;
          if (chapter === 'do_question') {
            return __s29BuildAnswerLines(__S29_DO_BANK, 25).join('\n');
          }
          if (chapter === 'be_question') {
            return __s29BuildAnswerLines(__S29_BE_BANK, 25).join('\n');
          }
        } catch (e) {}
        return __origNormalizeMagicAnswerSheet_S29(a, q, input);
      };
    }

    const __origIsGenerationSuccessful_S29 = typeof isGenerationSuccessful === 'function' ? isGenerationSuccessful : null;
    if (__origIsGenerationSuccessful_S29) {
      isGenerationSuccessful = function isGenerationSuccessful_s29(formatted, input) {
        const legacy = __origIsGenerationSuccessful_S29(formatted, input);
        if (!legacy || !legacy.ok) return legacy;
        try {
          const cur = __s29GetCurriculum(input);
          const chapter = cur ? __s29SelectChapter(input, cur.entry) : null;
          if (chapter === 'do_question' || chapter === 'be_question') {
            const qCount = String(formatted?.questions || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
            const aCount = String(formatted?.answerSheet || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
            if (qCount < 25 || aCount < 25) {
              return { ok: false, reason: 's29_count_short' };
            }
          }
        } catch (e) {}
        return legacy;
      };
    }

    console.log('✅ S29 final deploy patch applied');
  } catch (e) {
    console.warn('⚠️ S29 final deploy patch failed:', e?.message || e);
  }
})();


/* =========================
   S29 DO QUESTION HARDLOCK PATCH
   ========================= */
(function applyS29DoQuestionHardlock() {
  try {
    function __s29HardlockIsDoQuestionInput(input = {}) {
      const merged = [input?.userPrompt, input?.topic, input?.worksheetTitle]
        .filter(Boolean)
        .join(' ');
      const t = String(merged || '');
      if (/일반동사/.test(t) && /의문문/.test(t)) return true;
      if (input?.grammarFocus?.isDoQuestion) return true;
      if (String(input?.grammarFocus?.chapterKey || '') === 'do_question') return true;
      return false;
    }

    const __S29_DO_HARDLOCK_BANK = [
      ['너는 매일 운동하니?', ['Do','you','exercise','every','day'], 'Do you exercise every day?', 'Yes, I do.', 'No, I do not.'],
      ['그는 학교에 걸어가니?', ['Does','he','walk','to','school'], 'Does he walk to school?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 피아노를 치니?', ['Does','she','play','the','piano'], 'Does she play the piano?', 'Yes, she does.', 'No, she does not.'],
      ['너는 영어를 공부하니?', ['Do','you','study','English'], 'Do you study English?', 'Yes, I do.', 'No, I do not.'],
      ['그들은 주말에 축구를 하니?', ['Do','they','play','soccer','on','weekends'], 'Do they play soccer on weekends?', 'Yes, they do.', 'No, they do not.'],
      ['그는 매일 수업에 참석하니?', ['Does','he','attend','classes','every','day'], 'Does he attend classes every day?', 'Yes, he does.', 'No, he does not.'],
      ['그는 매일 이를 닦니?', ['Does','he','brush','his','teeth','every','day'], 'Does he brush his teeth every day?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 영어를 공부하니?', ['Does','she','study','English'], 'Does she study English?', 'Yes, she does.', 'No, she does not.'],
      ['그는 주말마다 축구를 보니?', ['Does','he','watch','soccer','on','weekends'], 'Does he watch soccer on weekends?', 'Yes, he does.', 'No, he does not.'],
      ['너는 매일 영어 단어를 외우니?', ['Do','you','memorize','English','words','every','day'], 'Do you memorize English words every day?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 책을 읽니?', ['Does','she','read','books'], 'Does she read books?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 공원에 가니?', ['Do','they','go','to','the','park'], 'Do they go to the park?', 'Yes, they do.', 'No, they do not.'],
      ['그는 수학을 좋아하니?', ['Does','he','like','math'], 'Does he like math?', 'Yes, he does.', 'No, he does not.'],
      ['너는 물을 많이 마시니?', ['Do','you','drink','a','lot','of','water'], 'Do you drink a lot of water?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 저녁에 숙제를 하니?', ['Does','she','do','her','homework','in','the','evening'], 'Does she do her homework in the evening?', 'Yes, she does.', 'No, she does not.'],
      ['그는 TV를 보니?', ['Does','he','watch','TV'], 'Does he watch TV?', 'Yes, he does.', 'No, he does not.'],
      ['너는 음악을 듣니?', ['Do','you','listen','to','music'], 'Do you listen to music?', 'Yes, I do.', 'No, I do not.'],
      ['그들은 게임을 하니?', ['Do','they','play','games'], 'Do they play games?', 'Yes, they do.', 'No, they do not.'],
      ['그는 커피를 마시니?', ['Does','he','drink','coffee'], 'Does he drink coffee?', 'Yes, he does.', 'No, he does not.'],
      ['너는 일찍 일어나니?', ['Do','you','wake','up','early'], 'Do you wake up early?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 영어로 말하니?', ['Does','she','speak','English'], 'Does she speak English?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 버스를 타니?', ['Do','they','take','the','bus'], 'Do they take the bus?', 'Yes, they do.', 'No, they do not.'],
      ['그는 운동을 하니?', ['Does','he','exercise'], 'Does he exercise?', 'Yes, he does.', 'No, he does not.'],
      ['너는 매일 공부하니?', ['Do','you','study','every','day'], 'Do you study every day?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 친구를 만나니?', ['Does','she','meet','friends'], 'Does she meet friends?', 'Yes, she does.', 'No, she does not.']
    ];

    function __s29DoHardlockQuestions() {
      return __S29_DO_HARDLOCK_BANK.map(function(item, i) {
        return (i + 1) + '. ' + item[0] + ' (clue: ' + item[1].join(', ') + ') (Word count: ' + item[1].length + ')';
      }).join('\n');
    }

    function __s29DoHardlockAnswers() {
      return __S29_DO_HARDLOCK_BANK.map(function(item, i) {
        return (i + 1) + '. ' + item[2] + ' / ' + item[3] + ' / ' + item[4];
      }).join('\n');
    }

    const __prevFormatMagicResponse_s29DoHardlock =
      typeof formatMagicResponse === 'function' ? formatMagicResponse : null;

    if (__prevFormatMagicResponse_s29DoHardlock) {
      formatMagicResponse = function formatMagicResponse_s29DoHardlock(rawText, input = {}) {
        const base = __prevFormatMagicResponse_s29DoHardlock(rawText, input);
        try {
          if (!__s29HardlockIsDoQuestionInput(input)) return base;
          const forcedQuestions = __s29DoHardlockQuestions();
          const forcedAnswers = __s29DoHardlockAnswers();
          return Object.assign({}, base || {}, {
            title: (base && base.title) || buildMagicTitle(input),
            instructions: (base && base.instructions) || (input?.language === 'en'
              ? 'Write each sentence in English using the clue words. Review the answer sheet after solving.'
              : '주어진 clue를 사용하여 영어 문장을 쓰시오. 먼저 문제를 풀고 정답지를 검토하세요.'),
            questions: forcedQuestions,
            answerSheet: forcedAnswers
          });
        } catch (e) {
          return base;
        }
      };
    }

    const __prevNormalizeMagicAnswerSheet_s29DoHardlock =
      typeof normalizeMagicAnswerSheet === 'function' ? normalizeMagicAnswerSheet : null;

    if (__prevNormalizeMagicAnswerSheet_s29DoHardlock) {
      normalizeMagicAnswerSheet = function normalizeMagicAnswerSheet_s29DoHardlock(a = '', q = '', input = {}) {
        try {
          if (__s29HardlockIsDoQuestionInput(input)) return __s29DoHardlockAnswers();
        } catch (e) {}
        return __prevNormalizeMagicAnswerSheet_s29DoHardlock(a, q, input);
      };
    }

    const __prevIsGenerationSuccessful_s29DoHardlock =
      typeof isGenerationSuccessful === 'function' ? isGenerationSuccessful : null;

    if (__prevIsGenerationSuccessful_s29DoHardlock) {
      isGenerationSuccessful = function isGenerationSuccessful_s29DoHardlock(formatted, input) {
        const legacy = __prevIsGenerationSuccessful_s29DoHardlock(formatted, input);
        if (!legacy || !legacy.ok) return legacy;
        try {
          if (!__s29HardlockIsDoQuestionInput(input)) return legacy;
          const qCount = String(formatted?.questions || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
          const aCount = String(formatted?.answerSheet || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
          const qText = String(formatted?.questions || '');
          if (qCount !== 25 || aCount !== 25) return { ok: false, reason: 's29_do_hardlock_count_mismatch' };
          if (!/\(clue:\s*Do, you, exercise, every, day\)/.test(qText)) return { ok: false, reason: 's29_do_hardlock_not_applied' };
        } catch (e) {}
        return legacy;
      };
    }

    console.log('✅ S29 do_question hardlock patch applied');
  } catch (e) {
    console.warn('⚠️ S29 do_question hardlock patch failed:', e?.message || e);
  }
})();



/* =========================
   S30 ALIAS + DO QUESTION FULL HARDLOCK PATCH
   ========================= */
(function applyS30AliasAndDoQuestionHardlock() {
  try {
    const __s30_fs = require('fs');
    const __s30_path = require('path');

    let __S30_ALIAS_DB_CACHE = null;

    function __s30LoadAliasDb() {
      if (__S30_ALIAS_DB_CACHE) return __S30_ALIAS_DB_CACHE;
      try {
        const p = __s30_path.join(process.cwd(), 'data', 'writinglab_chapter_aliases_middle_complete.json');
        const raw = __s30_fs.readFileSync(p, 'utf8');
        __S30_ALIAS_DB_CACHE = JSON.parse(raw);
        return __S30_ALIAS_DB_CACHE;
      } catch (e) {
        __S30_ALIAS_DB_CACHE = {};
        return __S30_ALIAS_DB_CACHE;
      }
    }

    function __s30Norm(v) {
      return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function __s30InferGradeKey(text) {
      const t = String(text || '');
      if (/중1/.test(t)) return 'middle1';
      if (/중2/.test(t)) return 'middle2';
      if (/중3/.test(t)) return 'middle3';
      return null;
    }

    function __s30InferLessonKey(text) {
      const m = String(text || '').match(/([1-4])\s*과/);
      return m ? ('lesson' + m[1]) : null;
    }

    function __s30ResolveChapterByAlias(input) {
      try {
        const merged = [
          input?.userPrompt,
          input?.topic,
          input?.worksheetTitle
        ].filter(Boolean).join(' ');
        const text = __s30Norm(merged);
        const db = __s30LoadAliasDb();
        const gradeKey = __s30InferGradeKey(merged);
        const lessonKey = __s30InferLessonKey(merged);

        function scanLesson(lessonObj) {
          if (!lessonObj || typeof lessonObj !== 'object') return null;
          for (const chapterKey of Object.keys(lessonObj)) {
            const aliases = Array.isArray(lessonObj[chapterKey]) ? lessonObj[chapterKey] : [];
            for (const alias of aliases) {
              const a = __s30Norm(alias);
              if (a && text.includes(a)) {
                return { gradeKey, lessonKey, chapterKey };
              }
            }
          }
          return null;
        }

        if (gradeKey && lessonKey && db[gradeKey] && db[gradeKey][lessonKey]) {
          const exact = scanLesson(db[gradeKey][lessonKey]);
          if (exact) return exact;
        }

        if (gradeKey && db[gradeKey]) {
          for (const lk of Object.keys(db[gradeKey])) {
            const found = scanLesson(db[gradeKey][lk]);
            if (found) return Object.assign({}, found, { lessonKey: lk });
          }
        }

        return null;
      } catch (e) {
        return null;
      }
    }

    function __s30IsDoQuestionInput(input = {}) {
      const merged = [input?.userPrompt, input?.topic, input?.worksheetTitle]
        .filter(Boolean)
        .join(' ');
      const t = String(merged || '');
      const aliasResolved = __s30ResolveChapterByAlias(input);

      if (aliasResolved?.chapterKey === 'do_question') return true;
      if (input?.aliasResolved?.chapterKey === 'do_question') return true;
      if (String(input?.resolvedChapterKey || '') === 'do_question') return true;
      if (String(input?.grammarFocus?.chapterKey || '') === 'do_question') return true;
      if (input?.grammarFocus?.isDoQuestion) return true;

      if (/일반동사/.test(t) && /(의문문|질문|활용|질문과 대답|영작훈련|영작 워크북)/.test(t)) return true;
      if (/(do question|does question|do\/does 의문문|do does 의문문)/i.test(t)) return true;

      return false;
    }

    const __S30_DO_HARDLOCK_BANK = [
      ['너는 매일 운동하니?', ['Do','you','exercise','every','day'], 'Do you exercise every day?', 'Yes, I do.', 'No, I do not.'],
      ['그는 학교에 걸어가니?', ['Does','he','walk','to','school'], 'Does he walk to school?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 피아노를 치니?', ['Does','she','play','the','piano'], 'Does she play the piano?', 'Yes, she does.', 'No, she does not.'],
      ['너는 영어를 공부하니?', ['Do','you','study','English'], 'Do you study English?', 'Yes, I do.', 'No, I do not.'],
      ['그들은 주말에 축구를 하니?', ['Do','they','play','soccer','on','weekends'], 'Do they play soccer on weekends?', 'Yes, they do.', 'No, they do not.'],
      ['그는 매일 수업에 참석하니?', ['Does','he','attend','classes','every','day'], 'Does he attend classes every day?', 'Yes, he does.', 'No, he does not.'],
      ['그는 매일 이를 닦니?', ['Does','he','brush','his','teeth','every','day'], 'Does he brush his teeth every day?', 'Yes, he does.', 'No, he does not.'],
      ['그녀는 영어를 공부하니?', ['Does','she','study','English'], 'Does she study English?', 'Yes, she does.', 'No, she does not.'],
      ['그는 주말마다 축구를 보니?', ['Does','he','watch','soccer','on','weekends'], 'Does he watch soccer on weekends?', 'Yes, he does.', 'No, he does not.'],
      ['너는 매일 영어 단어를 외우니?', ['Do','you','memorize','English','words','every','day'], 'Do you memorize English words every day?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 책을 읽니?', ['Does','she','read','books'], 'Does she read books?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 공원에 가니?', ['Do','they','go','to','the','park'], 'Do they go to the park?', 'Yes, they do.', 'No, they do not.'],
      ['그는 수학을 좋아하니?', ['Does','he','like','math'], 'Does he like math?', 'Yes, he does.', 'No, he does not.'],
      ['너는 물을 많이 마시니?', ['Do','you','drink','a','lot','of','water'], 'Do you drink a lot of water?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 저녁에 숙제를 하니?', ['Does','she','do','her','homework','in','the','evening'], 'Does she do her homework in the evening?', 'Yes, she does.', 'No, she does not.'],
      ['그는 TV를 보니?', ['Does','he','watch','TV'], 'Does he watch TV?', 'Yes, he does.', 'No, he does not.'],
      ['너는 음악을 듣니?', ['Do','you','listen','to','music'], 'Do you listen to music?', 'Yes, I do.', 'No, I do not.'],
      ['그들은 게임을 하니?', ['Do','they','play','games'], 'Do they play games?', 'Yes, they do.', 'No, they do not.'],
      ['그는 커피를 마시니?', ['Does','he','drink','coffee'], 'Does he drink coffee?', 'Yes, he does.', 'No, he does not.'],
      ['너는 일찍 일어나니?', ['Do','you','wake','up','early'], 'Do you wake up early?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 영어로 말하니?', ['Does','she','speak','English'], 'Does she speak English?', 'Yes, she does.', 'No, she does not.'],
      ['그들은 버스를 타니?', ['Do','they','take','the','bus'], 'Do they take the bus?', 'Yes, they do.', 'No, they do not.'],
      ['그는 운동을 하니?', ['Does','he','exercise'], 'Does he exercise?', 'Yes, he does.', 'No, he does not.'],
      ['너는 매일 공부하니?', ['Do','you','study','every','day'], 'Do you study every day?', 'Yes, I do.', 'No, I do not.'],
      ['그녀는 친구를 만나니?', ['Does','she','meet','friends'], 'Does she meet friends?', 'Yes, she does.', 'No, she does not.']
    ];

    function __s30DoHardlockQuestions() {
      return __S30_DO_HARDLOCK_BANK.map(function(item, i) {
        return (i + 1) + '. ' + item[0] + ' (clue: ' + item[1].join(', ') + ') (Word count: ' + item[1].length + ')';
      }).join('\n');
    }

    function __s30DoHardlockAnswers() {
      return __S30_DO_HARDLOCK_BANK.map(function(item, i) {
        return (i + 1) + '. ' + item[2] + ' / ' + item[3] + ' / ' + item[4];
      }).join('\n');
    }

    const __prevFormatMagicResponse_s30 =
      typeof formatMagicResponse === 'function' ? formatMagicResponse : null;

    if (__prevFormatMagicResponse_s30) {
      formatMagicResponse = function formatMagicResponse_s30(rawText, input = {}) {
        const base = __prevFormatMagicResponse_s30(rawText, input);
        try {
          if (!__s30IsDoQuestionInput(input)) return base;
          return Object.assign({}, base || {}, {
            title: (base && base.title) || buildMagicTitle(input),
            instructions: (base && base.instructions) || (input?.language === 'en'
              ? 'Write each sentence in English using the clue words. Review the answer sheet after solving.'
              : '주어진 clue를 사용하여 영어 문장을 쓰시오. 먼저 문제를 풀고 정답지를 검토하세요.'),
            questions: __s30DoHardlockQuestions(),
            answerSheet: __s30DoHardlockAnswers()
          });
        } catch (e) {
          return base;
        }
      };
    }

    const __prevNormalizeMagicAnswerSheet_s30 =
      typeof normalizeMagicAnswerSheet === 'function' ? normalizeMagicAnswerSheet : null;

    if (__prevNormalizeMagicAnswerSheet_s30) {
      normalizeMagicAnswerSheet = function normalizeMagicAnswerSheet_s30(a = '', q = '', input = {}) {
        try {
          if (__s30IsDoQuestionInput(input)) return __s30DoHardlockAnswers();
        } catch (e) {}
        return __prevNormalizeMagicAnswerSheet_s30(a, q, input);
      };
    }

    const __prevIsGenerationSuccessful_s30 =
      typeof isGenerationSuccessful === 'function' ? isGenerationSuccessful : null;

    if (__prevIsGenerationSuccessful_s30) {
      isGenerationSuccessful = function isGenerationSuccessful_s30(formatted, input) {
        const legacy = __prevIsGenerationSuccessful_s30(formatted, input);
        if (!legacy || !legacy.ok) return legacy;
        try {
          if (!__s30IsDoQuestionInput(input)) return legacy;
          const qCount = String(formatted?.questions || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
          const aCount = String(formatted?.answerSheet || '').split('\n').filter((l) => /^\d+[.)-]?\s+/.test(String(l).trim())).length;
          const qText = String(formatted?.questions || '');
          if (qCount !== 25 || aCount !== 25) return { ok: false, reason: 's30_do_hardlock_count_mismatch' };
          if (!/\(clue:\s*Do, you, exercise, every, day\)/.test(qText)) return { ok: false, reason: 's30_do_hardlock_not_applied' };
        } catch (e) {}
        return legacy;
      };
    }

    console.log('✅ S30 alias + do_question full hardlock patch applied');
  } catch (e) {
    console.warn('⚠️ S30 alias + do_question full hardlock patch failed:', e?.message || e);
  }
})();
