const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

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

const MIDDLE1_SENTENCE_BANK = {
  be_question: [
    { ko: "그는 학생이니?", en: "Is he a student?" },
    { ko: "그녀는 지금 집에 있니?", en: "Is she at home now?" },
    { ko: "너는 바쁘니?", en: "Are you busy?" },
    { ko: "그들은 교실에 있니?", en: "Are they in the classroom?" },
    { ko: "오늘은 춥니?", en: "Is it cold today?" },
    { ko: "너의 부모님은 집에 계시니?", en: "Are your parents at home?" },
    { ko: "이것은 네 가방이니?", en: "Is this your bag?" },
    { ko: "저 소년들은 행복하니?", en: "Are those boys happy?" },
  ],
  do_question: [
    { ko: "너는 축구를 하니?", en: "Do you play soccer?" },
    { ko: "그는 매일 영어를 공부하니?", en: "Does he study English every day?" },
    { ko: "그녀는 버스로 학교에 가니?", en: "Does she go to school by bus?" },
    { ko: "너희는 주말에 숙제를 하니?", en: "Do you do your homework on weekends?" },
    { ko: "그는 아침에 우유를 마시니?", en: "Does he drink milk in the morning?" },
    { ko: "그들은 공원에서 뛰니?", en: "Do they run in the park?" },
    { ko: "너는 피아노를 치니?", en: "Do you play the piano?" },
    { ko: "그녀는 책을 많이 읽니?", en: "Does she read many books?" },
  ],
  present_continuous: [
    { ko: "나는 지금 숙제를 하고 있다.", en: "I am doing my homework now." },
    { ko: "그는 공원에서 달리고 있다.", en: "He is running in the park." },
    { ko: "그녀는 영어를 공부하고 있다.", en: "She is studying English." },
    { ko: "우리는 점심을 먹고 있다.", en: "We are having lunch." },
    { ko: "그들은 사진을 찍고 있다.", en: "They are taking pictures." },
  ],
  present_perfect: [
    { ko: "나는 이미 내 숙제를 끝냈다.", en: "I have already finished my homework." },
    { ko: "그는 방을 청소했다.", en: "He has cleaned his room." },
    { ko: "우리는 그 영화를 본 적이 있다.", en: "We have seen that movie." },
    { ko: "그녀는 아직 점심을 먹지 않았다.", en: "She has not had lunch yet." },
    { ko: "그들은 서울에 가 본 적이 있다.", en: "They have been to Seoul." },
  ],
};


const SENTENCE_BANK_ROOT = path.join(process.cwd(), "data", "sentence_bank");

const SENTENCE_BANK_FILE_MAP = {
  middle1: {
    be_negative: "middle1_be_negative.json",
    be_question: "middle1_be_question.json",
    be_verb: "middle1_be_verb.json",
    can: "middle1_can.json",
    do_negative: "middle1_do_negative.json",
    do_question: "middle1_do_question.json",
    do_verb: "middle1_do_verb.json",
    frequency_adverbs: "middle1_frequency_adverbs.json",
    modal_will: "middle1_modal_will.json",
    present_continuous: "middle1_present_continuous.json",
    there_is_are: "middle1_there_is_are.json",
    wh_question: "middle1_wh_question.json",
    conjunction_when: "middle1_conjunction_when.json",
    conjunction_while: "middle1_conjunction_while.json",
    conjunction_that: "middle1_conjunction_that.json",
    because: "middle1_because.json",
    so: "middle1_so.json",
    but: "middle1_but.json",
    and: "middle1_and.json",
    causative: "middle1_causative.json",
    semi_causative: "middle1_semi_causative.json",
    gerund_object: "middle1_gerund_object.json",
    gerund_total: "middle1_gerund_total.json",
    to_infinitive_noun: "middle1_to_infinitive_noun.json",
    to_infinitive_total: "middle1_to_infinitive_total.json",
    prepositions_basic: "middle1_prepositions_basic.json",
    a_few_few: "middle1_a_few_few.json",
    a_little_little: "middle1_a_little_little.json",
    quantifiers: "middle1_quantifiers.json",
    many_much: "middle1_many_much.json",
    comparatives: "middle1_comparatives.json",
    imperatives: "middle1_imperatives.json",
    superlatives: "middle1_superlatives.json",
    exclamation: "middle1_exclamation.json",
    reflexive_pronoun: "middle1_reflexive_pronoun.json",
    five_form: "middle1_five_form.json",
    passive: "middle1_passive.json",
  },
};

const CHAPTER_ALIAS_PATTERNS = [
  { key: "be_question", patterns: [/be동사\s*의문문/i, /be동사.*의문문/i, /be-?verb question/i, /am\/is\/are/i] },
  { key: "be_negative", patterns: [/be동사\s*부정문/i, /be동사.*부정문/i, /be-?verb negative/i] },
  { key: "be_verb", patterns: [/be동사(?!\s*(의문문|부정문))/i, /\bbe verb\b/i] },
  { key: "do_question", patterns: [/일반동사\s*의문문/i, /일반동사.*의문문/i, /do(?:es)?-?question/i] },
  { key: "do_negative", patterns: [/일반동사\s*부정문/i, /일반동사.*부정문/i, /do(?:es)?-?negative/i] },
  { key: "do_verb", patterns: [/일반동사(?!\s*(의문문|부정문))/i, /\bgeneral verb\b/i] },
  { key: "present_continuous", patterns: [/현재진행형/i, /present continuous/i, /be \w+ing/i] },
  { key: "modal_will", patterns: [/조동사\s*will/i, /\bwill\b/i] },
  { key: "there_is_are", patterns: [/there\s+is\s*\/?\s*are/i, /there is are/i, /there\s+is/i, /there\s+are/i] },
  { key: "wh_question", patterns: [/의문사\s*의문문/i, /wh-?\s*question/i, /\bwho\b|\bwhat\b|\bwhen\b|\bwhere\b|\bwhy\b|\bhow\b/i] },
  { key: "frequency_adverbs", patterns: [/빈도부사/i, /frequency adverb/i] },
  { key: "can", patterns: [/\bcan\b/i, /조동사\s*can/i] },
  { key: "conjunction_when", patterns: [/접속사\s*when/i, /conjunction\s*when/i] },
  { key: "conjunction_while", patterns: [/접속사\s*while/i, /conjunction\s*while/i] },
  { key: "conjunction_that", patterns: [/접속사\s*that/i, /conjunction\s*that/i] },
  { key: "because", patterns: [/접속사\s*because/i, /\bbecause\b/i] },
  { key: "so", patterns: [/접속사\s*so/i, /\bso\b/i] },
  { key: "but", patterns: [/접속사\s*but/i, /\bbut\b/i] },
  { key: "and", patterns: [/접속사\s*and/i, /\band\b/i] },
  { key: "causative", patterns: [/사역동사/i, /causative/i] },
  { key: "semi_causative", patterns: [/준사역동사/i, /semi-?\s*causative/i] },
  { key: "gerund_object", patterns: [/동명사를\s*목적어로\s*취하는/i, /gerund object/i] },
  { key: "gerund_total", patterns: [/동명사(?!\s*를\s*목적어로)/i, /gerund/i] },
  { key: "to_infinitive_noun", patterns: [/to부정사\s*명사적\s*용법/i, /to-?infinitive noun/i] },
  { key: "to_infinitive_total", patterns: [/to부정사(?!\s*명사적)/i, /to-?infinitive/i, /\binfinitive\b/i] },
  { key: "prepositions_basic", patterns: [/전치사/i, /preposition/i] },
  { key: "a_few_few", patterns: [/\ba few\b/i, /\bfew\b/i] },
  { key: "a_little_little", patterns: [/\ba little\b/i, /\blittle\b/i] },
  { key: "quantifiers", patterns: [/수량형용사/i, /quantifier/i] },
  { key: "many_much", patterns: [/\bmany\b/i, /\bmuch\b/i] },
  { key: "comparatives", patterns: [/비교급/i, /comparative/i] },
  { key: "imperatives", patterns: [/명령문/i, /imperative/i] },
  { key: "superlatives", patterns: [/최상급/i, /superlative/i] },
  { key: "exclamation", patterns: [/감탄문/i, /exclamation/i] },
  { key: "reflexive_pronoun", patterns: [/재귀대명사/i, /reflexive pronoun/i] },
  { key: "five_form", patterns: [/5형식/i, /오형식/i, /five form/i] },
  { key: "passive", patterns: [/수동태/i, /passive/i] },
];

function detectGradeBucket(input = {}) {
  const merged = [input.gradeLabel || "", input.level || "", input.userPrompt || "", input.topic || "", input.worksheetTitle || "", input.rawBody?.profile || ""].join("\n").toLowerCase();
  if (/중1|middle1|middle 1/.test(merged)) return "middle1";
  if (/중2|middle2|middle 2/.test(merged)) return "middle2";
  if (/중3|middle3|middle 3/.test(merged)) return "middle3";
  if (/고1|high1|high 1/.test(merged)) return "high1";
  if (/고2|high2|high 2/.test(merged)) return "high2";
  if (/고3|high3|high 3/.test(merged)) return "high3";
  return "";
}

function resolveChapterAlias(text = "") {
  const raw = String(text || "");
  for (const entry of CHAPTER_ALIAS_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(raw))) return entry.key;
  }
  return "";
}

function resolveSentenceBankFile(input = {}, chapterKey = "") {
  const bucket = detectGradeBucket(input);
  if (!bucket || !chapterKey) return null;
  const bucketMap = SENTENCE_BANK_FILE_MAP[bucket] || {};
  const filename = bucketMap[chapterKey] || `${bucket}_${chapterKey}.json`;
  const filePath = path.join(SENTENCE_BANK_ROOT, bucket, filename);
  return fs.existsSync(filePath) ? filePath : null;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function pickEnglishClueFromSeed(seed = {}, answer = "") {
  if (Array.isArray(seed.clueUnits)) {
    const pieces = seed.clueUnits
      .map((unit) => Array.isArray(unit) ? String(unit[1] || "").trim() : String(unit || "").trim())
      .filter(Boolean);
    if (pieces.length) return pieces.join(" / ");
  }
  if (Array.isArray(seed.extraClueWordPool) && seed.extraClueWordPool.length) {
    return seed.extraClueWordPool.slice(0, 6).join(" / ");
  }
  return buildGuidedClue(answer);
}

function buildBlankFromSeed(seed = {}, answer = "") {
  const rawAnswer = String(answer || "").trim();
  const targets = Array.isArray(seed.blankTargets) ? seed.blankTargets.map((v) => String(v || "").trim()).filter(Boolean) : [];
  if (!rawAnswer) return "";
  if (!targets.length) return blankLastLexical(rawAnswer);
  let masked = rawAnswer;
  let replaced = false;
  for (const target of targets) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`\\b${escaped}\\b`, "i");
    if (rx.test(masked)) {
      masked = masked.replace(rx, "_____");
      replaced = true;
      break;
    }
  }
  return replaced ? masked : blankLastLexical(rawAnswer);
}

function buildChoiceOptionsFromSeed(seed = {}, answer = "", input = {}, seedIndex = 0) {
  const base = String(answer || "").trim();
  const distractors = [];
  const ds = seed?.distractorSeeds || {};
  if (typeof ds.auxError === "string" && ds.auxError.trim()) distractors.push(ds.auxError.trim());
  if (Array.isArray(ds.statementForm)) distractors.push(...ds.statementForm.map((v) => String(v || "").trim()).filter(Boolean));
  if (typeof ds.fragmentForm === "string" && ds.fragmentForm.trim()) distractors.push(ds.fragmentForm.trim());

  const options = [];
  if (base) options.push(base);
  for (const item of distractors) {
    if (item && !options.includes(item)) options.push(item);
    if (options.length >= 4) break;
  }

  while (options.length < 4) {
    const fallbackBundle = makeChoiceOptions(base, input, seedIndex + options.length);
    const fallback = Array.isArray(fallbackBundle.options) ? fallbackBundle.options.find((opt) => !options.includes(opt)) : "";
    if (!fallback) break;
    options.push(fallback);
  }

  return rotateOptionsWithAnswer(options.slice(0, 4), base, seedIndex);
}

function normalizeSentenceBankEntries(rawEntries = [], chapterKey = "") {
  const rows = Array.isArray(rawEntries) ? rawEntries : [];
  return rows
    .map((row, idx) => {
      if (!row || typeof row !== "object") return null;
      const korean = String(row.korean || row.ko || row.prompt || "").trim();
      const english = String(row.english || row.en || row.answer || "").trim();
      if (!korean || !english) return null;
      return {
        id: row.id || `${chapterKey}_${idx + 1}`,
        seedId: row.seedId || `${chapterKey}_${idx + 1}`,
        korean,
        english,
        clueUnits: Array.isArray(row.clueUnits) ? row.clueUnits : [],
        extraClueWordPool: Array.isArray(row.extraClueWordPool) ? row.extraClueWordPool : [],
        blankTargets: Array.isArray(row.blankTargets) ? row.blankTargets : [],
        distractorSeeds: row.distractorSeeds && typeof row.distractorSeeds === "object" ? row.distractorSeeds : {},
        grammar: row.grammar || chapterKey,
        wordCount: Number.isFinite(Number(row.wordCount)) ? Number(row.wordCount) : wordCountOf(english),
        tags: Array.isArray(row.tags) ? row.tags : [],
      };
    })
    .filter(Boolean);
}

function loadSentenceBank(input = {}) {
  const chapterKey = String(input?.grammarFocus?.chapterKey || "").trim();
  const filePath = resolveSentenceBankFile(input, chapterKey);
  if (filePath) {
    const raw = safeReadJson(filePath);
    const normalized = normalizeSentenceBankEntries(raw, chapterKey);
    if (normalized.length) {
      return { chapterKey, filePath, source: "json_file", items: normalized };
    }
  }

  if (detectGradeBucket(input) === "middle1" && Array.isArray(MIDDLE1_SENTENCE_BANK[chapterKey]) && MIDDLE1_SENTENCE_BANK[chapterKey].length) {
    return {
      chapterKey,
      filePath: null,
      source: "embedded_fallback",
      items: normalizeSentenceBankEntries(MIDDLE1_SENTENCE_BANK[chapterKey], chapterKey),
    };
  }

  return { chapterKey, filePath: null, source: "none", items: [] };
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
  if (/초등|초[1-6]|abc\s*starter|elementary|junior/.test(t)) return "elementary";
  if (/고1|고2|고3|고등|수능|high/.test(t)) return "high";
  if (/중1|중2|중3|중등|middle/.test(t)) return "middle";
  return "middle";
}

function inferMode(text = "") {
  const t = String(text || "").toLowerCase();
  if (/vocab|vocabulary|어휘|단어|단어장|단어시험|어휘시험|어휘테스트|뜻쓰기|유의어|반의어/.test(t)) return "vocab-builder";
  if (/abc\s*starter|starter|phonics|파닉스|기초영어|알파벳/.test(t)) return "abcstarter";
  if (/영작|writing|composition|rewrite|재배열|문장 재구성|guided writing/.test(t)) return "writing";
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
    "알파벳", "파닉스", "be동사", "일반동사", "현재진행형", "현재완료", "현재완료 진행형",
    "과거시제", "조동사", "명사", "대명사", "형용사", "부사", "비교급", "최상급",
    "수동태", "관계대명사", "관계부사", "동명사", "to부정사", "가정법", "접속사",
    "전치사", "시제", "수일치", "문장구조", "영작훈련", "사역동사", "수여동사"
  ];
  for (const topic of topicPatterns) {
    if (t.includes(topic)) return topic;
  }
  const lower = t.toLowerCase();
  if (/relative pronoun/.test(lower)) return "관계대명사";
  if (/passive/.test(lower)) return "수동태";
  if (/gerund/.test(lower)) return "동명사";
  if (/infinitive/.test(lower)) return "to부정사";
  if (/present perfect progressive/.test(lower)) return "현재완료 진행형";
  if (/present perfect/.test(lower)) return "현재완료";
  if (/be verb question/.test(lower)) return "be동사 의문문";
  if (/do question/.test(lower)) return "일반동사 의문문";
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


function detectGrammarFocus(text = "") {
  const raw = String(text || "");
  const has = (...patterns) => patterns.some((p) => p.test(raw));
  const aliasKey = resolveChapterAlias(raw);

  const flags = {
    beQuestion: aliasKey === "be_question" || has(/be동사\s*의문문/i, /be동사.*의문문/i, /am\/is\/are/i, /be-?verb question/i),
    doQuestion: aliasKey === "do_question" || has(/일반동사\s*의문문/i, /일반동사.*의문문/i, /do(?:es)?-?question/i),
    presentContinuous: aliasKey === "present_continuous" || has(/현재진행형/i, /present continuous/i, /be \w+ing/i),
    presentPerfect: has(/현재완료(?!\s*진행형)/i, /present perfect(?!\s*(continuous|progressive))/i),
    presentPerfectProgressive: has(/현재완료\s*진행형/i, /present perfect\s*(continuous|progressive)/i),
    passive: aliasKey === "passive" || has(/수동태/i, /passive/i),
    gerund: aliasKey === "gerund_total" || aliasKey === "gerund_object" || has(/동명사/i, /gerund/i),
    toInfinitive: aliasKey === "to_infinitive_total" || aliasKey === "to_infinitive_noun" || has(/to부정사/i, /to-infinitive/i, /infinitive/i),
    relativePronoun: has(/관계대명사/i, /relative pronoun/i),
    relativeAdverb: has(/관계부사/i, /relative adverb/i),
    participialModifier: has(/분사의\s*한정적\s*용법/i, /participial modifier/i),
    causative: aliasKey === "causative" || aliasKey === "semi_causative" || has(/사역동사/i, /causative/i),
    ditransitive: aliasKey === "five_form" || has(/수여동사/i, /4형식/i, /ditransitive/i, /5형식/i, /오형식/i, /five form/i),
  };

  let chapterKey = aliasKey || "general";
  if (!aliasKey) {
    if (flags.beQuestion) chapterKey = "be_question";
    else if (flags.doQuestion) chapterKey = "do_question";
    else if (flags.presentPerfectProgressive) chapterKey = "present_perfect_progressive";
    else if (flags.presentPerfect) chapterKey = "present_perfect";
    else if (flags.presentContinuous) chapterKey = "present_continuous";
    else if (flags.passive) chapterKey = "passive";
    else if (flags.gerund) chapterKey = "gerund_total";
    else if (flags.toInfinitive) chapterKey = "to_infinitive_total";
    else if (flags.relativePronoun) chapterKey = "relative_pronoun";
    else if (flags.relativeAdverb) chapterKey = "relative_adverb";
    else if (flags.participialModifier) chapterKey = "participial_modifier";
    else if (flags.causative) chapterKey = "causative";
    else if (flags.ditransitive) chapterKey = "five_form";
  }

  return { chapterKey, ...flags };
}


function resolveWorkbookType(input) {
  const mode = input.mode;
  const focus = input.grammarFocus.chapterKey;
  const requested = input.requestedWorkbookType;

  if (["guided_writing", "blank_fill", "binary_choice", "choice"].includes(requested)) {
    return requested === "choice" ? "binary_choice" : requested;
  }

  if (mode === "abcstarter") return "junior_starter";
  if (mode === "vocab-builder") return input.level === "high" ? "vocab_csat" : "vocab_workbook";
  if (mode === "writing" || mode === "magic-card") return "writing_lab";
  if (mode === "textbook-grammar" || mode === "chapter-grammar") return "grammar_intensive";
  if (mode === "magic" && ["be_question", "do_question", "present_continuous", "present_perfect"].includes(focus)) {
    return "writing_lab";
  }
  return mode || "magic";
}

function buildWorkbookFallbacks(input) {
  const out = new Set();
  out.add(resolveWorkbookType(input));
  out.add(input.mode);
  if (input.mode === "magic-card") out.add("writing");
  if (input.mode === "chapter-grammar") out.add("textbook-grammar");
  if (input.mode === "textbook-grammar") out.add("chapter-grammar");
  if (input.level === "middle") out.add("magic");
  return Array.from(out).filter(Boolean);
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
  ].filter(Boolean).join("\n");

  const level = ["elementary", "middle", "high"].includes(body.level) ? body.level : inferLevel(mergedText);
  const modeCandidates = ["magic", "magic-card", "writing", "abcstarter", "textbook-grammar", "chapter-grammar", "vocab-builder"];
  const mode = modeCandidates.includes(body.mode) ? body.mode : inferMode(mergedText);
  const difficulty = ["basic", "standard", "high", "extreme"].includes(body.difficulty) ? body.difficulty : inferDifficulty(mergedText);
  const language = ["ko", "en"].includes(body.language) ? body.language : inferLanguage(mergedText);
  const topic = sanitizeString(body.topic || "") || inferTopic(mergedText);
  const examType = sanitizeString(body.examType || body.exam || "");
  const count = sanitizeCount(body.count || body.itemCount || body.questionCount || 25);
  const gradeLabel = sanitizeString(body.gradeLabel || "") || inferGradeLabel(mergedText, level);
  const grammarFocus = detectGrammarFocus(`${mergedText} ${topic}`);

  const requestedWorkbookType = sanitizeString(
    body.workbookType || body.worksheetType || body.rawBody?.workbookType || ""
  ).toLowerCase();

  const normalized = {
    userPrompt,
    sourceText: sanitizeString(body.sourceText || body.passage || body.text || ""),
    additionalNotes: sanitizeString(body.additionalNotes || body.notes || ""),
    language,
    level,
    mode,
    difficulty,
    topic,
    examType,
    count,
    gradeLabel,
    grammarFocus,
    worksheetTitle: sanitizeString(body.worksheetTitle || body.title || ""),
    memberId: sanitizeString(body.memberId || body.msMemberId || body.userId || ""),
    useMp: body.useMp !== false,
    requestedWorkbookType,
    rawBody: body,
  };

  normalized.workbookType = resolveWorkbookType(normalized);
  normalized.workbookFallbacks = buildWorkbookFallbacks(normalized);
  normalized.mpCost = MP_COST_TABLE[normalized.workbookType] || MP_COST_TABLE[normalized.mode] || 4;
  return normalized;
}


function getMiddle1SentenceBank(input) {
  const bank = loadSentenceBank(input);
  return bank.items.slice(0, 8).map((item) => ({ ko: item.korean, en: item.english }));
}

function buildSentenceBankBlock(input) {
  const bank = getMiddle1SentenceBank(input);
  if (!bank.length) return "";
  const lines = bank.map((item, i) => `${i + 1}. ${item.ko} → ${item.en}`).join("\n");
  return input.language === "en"
    ? `\n[SENTENCE BANK]\nUse the tone and difficulty of these seed patterns, but do not copy them directly.\n${lines}`
    : `\n[문장 은행]\n아래 예문들의 난도와 톤을 참고하되, 그대로 복사하지 말고 변형하여 활용할 것.\n${lines}`;
}

function buildTaskGuide(input) {
  const guideMap = {
    writing: input.language === "en"
      ? "Create a guided English writing workbook with clear clues, controlled sentence length, and answerable Korean prompts."
      : "명확한 clue와 통제된 문장 길이를 가진 guided writing 영작 훈련 워크북을 작성할 것.",
    "magic-card": input.language === "en"
      ? "Create a Marcus Magic Card style workbook with rich clues and sentence-building support."
      : "마커스매직카드 스타일로 풍부한 clue와 문장 구성 지원이 있는 워크북을 작성할 것.",
    abcstarter: input.language === "en"
      ? "Create a very accessible starter workbook for younger learners."
      : "초등 기초 학습자를 위한 매우 쉬운 starter 워크북을 작성할 것.",
    "vocab-builder": input.language === "en"
      ? "Create a vocabulary-centered worksheet rather than a grammar-centered worksheet."
      : "문법 중심이 아니라 어휘 중심 워크시트를 작성할 것.",
  };
  return guideMap[input.mode] || (input.language === "en"
    ? "Create a stable Marcus Magic grammar writing workbook."
    : "안정적인 Marcus Magic 문법 영작 워크북을 작성할 것.");
}

function buildPrompt(input) {
  const title = input.worksheetTitle || `${input.gradeLabel} ${input.topic} - 영작훈련 워크북`;
  const sourceBlock = input.sourceText
    ? (input.language === "en" ? `\n[Source Text]\n${input.sourceText}` : `\n[지문/자료]\n${input.sourceText}`)
    : "";
  const noteBlock = input.additionalNotes
    ? (input.language === "en" ? `\n[Additional Notes]\n${input.additionalNotes}` : `\n[추가 메모]\n${input.additionalNotes}`)
    : "";
  const sentenceBankBlock = buildSentenceBankBlock(input);
  const focus = input.grammarFocus.chapterKey;

  const strictFocusRule = input.language === "en"
    ? `Keep the worksheet strictly focused on ${focus}. Do not drift into unrelated grammar chapters.`
    : `${focus} 초점을 엄격하게 유지하고, 관련 없는 다른 문법 챕터로 새지 말 것.`;

  const formRule = input.language === "en"
    ? `Return valid JSON only with keys: title, worksheetType, questions, answers, meta. questions and answers must be arrays of exactly ${input.count} items.`
    : `반드시 JSON만 반환할 것. 키는 title, worksheetType, questions, answers, meta 만 사용할 것. questions와 answers는 정확히 ${input.count}개여야 한다.`;

  const writingRule = input.language === "en"
    ? `For writing-oriented worksheets, each question must include a Korean prompt and a clue line. Prefer clue-rich guided production over multiple choice.`
    : `영작형 워크시트에서는 각 문항에 한국어 제시문과 clue 줄을 포함할 것. 객관식보다 clue-rich guided production을 우선할 것.`;

  const styleRule = input.language === "en"
    ? `Sentence length should be learner-appropriate. Middle school outputs should sound academic but teachable. High school outputs may use abstract nouns, thought, education, philosophy, or humanities themes when appropriate.`
    : `문장 길이는 학습자 수준에 맞출 것. 중등은 학습 가능한 학문적 톤, 고등은 필요 시 추상명사·사고력·교육·인문 주제를 사용할 수 있다.`;

  const repairRule = input.language === "en"
    ? `If your first instinct would produce weak or repetitive items, self-repair before output. Avoid duplicate stems, duplicate answers, and shallow variations.`
    : `약하거나 반복적인 문항이 떠오르면 출력 전에 스스로 보정할 것. 중복 stem, 중복 답, 얕은 변형을 피할 것.`;

  const absoluteGrammarLock = input.language === "en"
    ? `ABSOLUTE RULE: Only use "${focus}" grammar. If any sentence uses a different grammar concept, it is invalid and must be rewritten.`
    : `절대 규칙: "${focus}" 문법만 사용해야 한다. 다른 문법이 포함되면 무효이며 다시 작성해야 한다.`;

  const noMixedGrammarRule = input.language === "en"
    ? `Do NOT mix grammar types such as do/does, past, perfect, or continuous unless they are part of "${focus}".`
    : `${focus} 외의 문법(do/does, 과거, 완료, 진행형 등)을 절대 섞지 말 것.`;

  const dbHardlockActive = shouldUseDbFirst(input);
  const dbOnlyRule = input.language === "en"
    ? `DB-FIRST ABSOLUTE RULE: For this request, use only the approved sentence bank. Do not invent, paraphrase, expand, or mix in GPT-generated grammar patterns.`
    : `DB-FIRST 절대 규칙: 이번 요청은 승인된 sentence bank만 사용해야 한다. GPT가 문법 패턴을 새로 만들거나 바꾸거나 섞어서는 안 된다.`;

  return (input.language === "en"
    ? `Generate a MARCUS Magic worksheet.\nTitle: ${title}\nGrade: ${input.gradeLabel}\nLevel: ${input.level}\nMode: ${input.mode}\nWorkbookType: ${input.workbookType}\nTopic: ${input.topic}\nDifficulty: ${input.difficulty}\nItemCount: ${input.count}\nTask: ${buildTaskGuide(input)}\n\nRules:\n- ${strictFocusRule}\n- ${absoluteGrammarLock}\n- ${noMixedGrammarRule}\n- ${writingRule}\n- ${styleRule}\n- ${repairRule}\n- ${formRule}${sentenceBankBlock}${sourceBlock}${noteBlock}\n\n[User Request]\n${input.userPrompt || "(none)"}`
    : `MARCUS Magic 워크시트를 생성하시오.\n제목: ${title}\n학년: ${input.gradeLabel}\n레벨: ${input.level}\n모드: ${input.mode}\nWorkbookType: ${input.workbookType}\n주제: ${input.topic}\n난이도: ${input.difficulty}\n문항수: ${input.count}\n과업: ${buildTaskGuide(input)}\n\n규칙:\n- ${strictFocusRule}\n- ${absoluteGrammarLock}\n- ${noMixedGrammarRule}\n- ${writingRule}\n- ${styleRule}\n- ${repairRule}\n- ${formRule}${sentenceBankBlock}${sourceBlock}${noteBlock}\n\n[사용자 요청]\n${input.userPrompt || "(없음)"}`);
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeQuestionItem(item, index, input) {
  if (typeof item === "string") {
    return {
      number: index + 1,
      prompt: item.trim(),
      clue: input.mode === "writing" || input.workbookType === "writing_lab" ? "" : undefined,
    };
  }
  return {
    number: index + 1,
    prompt: sanitizeString(item?.prompt || item?.question || item?.korean || `Question ${index + 1}`),
    clue: sanitizeString(item?.clue || item?.hint || ""),
    answer: sanitizeString(item?.answer || item?.english || ""),
  };
}

function normalizeAnswerItem(item, index, question) {
  if (typeof item === "string") {
    return { number: index + 1, answer: item.trim() };
  }
  return {
    number: index + 1,
    answer: sanitizeString(item?.answer || item?.english || question?.answer || ""),
  };
}

function buildFallbackQuestion(input, index) {
  const chapter = input.grammarFocus.chapterKey;
  const bank = MIDDLE1_SENTENCE_BANK[chapter] || [];
  const sample = bank[index % Math.max(bank.length, 1)] || null;
  const basePrompt = sample?.ko || `${input.topic}에 맞는 문장을 영작하시오.`;
  const baseAnswer = sample?.en || `Sample answer ${index + 1}.`;
  return {
    number: index + 1,
    prompt: basePrompt,
    clue: input.workbookType === "writing_lab" ? extractClueFromAnswer(baseAnswer) : "",
    answer: baseAnswer,
  };
}

function extractClueFromAnswer(answer = "") {
  return String(answer)
    .replace(/[.?!]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
}

function enforceWorksheetShape(data, input) {
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const answers = Array.isArray(data?.answers) ? data.answers : [];

  const normalizedQuestions = [];
  const normalizedAnswers = [];

  for (let i = 0; i < input.count; i += 1) {
    const q = questions[i] ? normalizeQuestionItem(questions[i], i, input) : buildFallbackQuestion(input, i);
    if ((input.workbookType === "writing_lab" || input.mode === "writing" || input.mode === "magic-card") && !q.clue) {
      q.clue = extractClueFromAnswer(q.answer || answers[i]?.answer || "");
    }
    const a = answers[i] ? normalizeAnswerItem(answers[i], i, q) : { number: i + 1, answer: q.answer || "" };
    normalizedQuestions.push(q);
    normalizedAnswers.push(a);
  }

  return {
    title: sanitizeString(data?.title || input.worksheetTitle || `${input.gradeLabel} ${input.topic} - 영작훈련 워크북`),
    worksheetType: sanitizeString(data?.worksheetType || input.workbookType || input.mode || "magic"),
    questions: normalizedQuestions.map((q, idx) => ({
      number: q.number || idx + 1,
      type: q.type || input.workbookType,
      prompt: sanitizeString(q.prompt || ""),
      clue: sanitizeString(q.clue || ""),
      wordCount: Number.isFinite(Number(q.wordCount)) ? Number(q.wordCount) : wordCountOf(normalizedAnswers[idx]?.answer || q.answer || ""),
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : undefined,
    })),
    answers: normalizedAnswers,
    meta: {
      gradeLabel: input.gradeLabel,
      level: input.level,
      mode: input.mode,
      workbookType: input.workbookType,
      fallbacks: input.workbookFallbacks,
      topic: input.topic,
      difficulty: input.difficulty,
      grammarFocus: input.grammarFocus.chapterKey,
    },
  };
}


function wordCountOf(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function blankLastLexical(answer = "") {
  const tokens = String(answer).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "_____";
  if (tokens.length === 1) return "_____";
  const last = tokens[tokens.length - 1];
  const cleanLast = last.replace(/[.?!,]/g, "");
  tokens[tokens.length - 1] = last.replace(cleanLast, "_____");
  return tokens.join("\n");
}

function buildGuidedClue(answer = "") {
  const cleaned = String(answer || "").trim().replace(/[?!.]+$/g, "");
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return "";

  const auxSet = new Set(["is", "are", "am", "do", "does", "did"]);
  const articleSet = new Set(["a", "an", "the"]);
  const prepSet = new Set(["at", "in", "on", "to", "from", "with", "for", "of"]);

  const tokens = rawTokens.map((t) => String(t || "").trim()).filter(Boolean);
  const parts = [];

  if (tokens.length && auxSet.has(tokens[0].toLowerCase())) {
    parts.push(tokens.shift());
  }

  if (tokens.length) {
    parts.push(tokens.shift());
  }

  while (tokens.length) {
    const token = tokens.shift();
    const lower = token.toLowerCase();

    if (articleSet.has(lower)) {
      if (tokens.length) {
        parts.push(`${token} ${tokens.shift()}`);
      } else {
        parts.push(token);
      }
      continue;
    }

    if (prepSet.has(lower)) {
      if (tokens.length) {
        const next = tokens.shift();
        const nextLower = String(next || "").toLowerCase();
        if (articleSet.has(nextLower) && tokens.length) {
          parts.push(`${token} ${next} ${tokens.shift()}`);
        } else {
          parts.push(`${token} ${next}`);
        }
      } else {
        parts.push(token);
      }
      continue;
    }

    parts.push(token);
  }

  const deduped = [];
  for (const part of parts) {
    const value = String(part || "").trim();
    if (!value) continue;
    if (!deduped.includes(value)) deduped.push(value);
  }

  return deduped.join(' / ');
}

function buildDeclarativeDistractor(answer = "") {
  const cleaned = String(answer || "").trim().replace(/[?!.]+$/g, "");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return cleaned + '.';
  const first = tokens[0].toLowerCase();
  if (["is", "are", "am", "was", "were"].includes(first)) {
    const subject = tokens[1] || '';
    const rest = tokens.slice(2).join(' ');
    return [subject, tokens[0].toLowerCase(), rest].filter(Boolean).join(' ') + '.';
  }
  if (["do", "does", "did"].includes(first)) {
    const subject = tokens[1] || '';
    const rest = tokens.slice(2).join(' ');
    return [subject, rest].filter(Boolean).join(' ') + '.';
  }
  return cleaned + '.';
}

function buildBeQuestionGrammarDistractor(answer = "") {
  const cleaned = String(answer || "").trim().replace(/[?!.]+$/g, "");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return cleaned;
  const aux = tokens[0].toLowerCase();
  if (aux === 'is') tokens[0] = 'Are';
  else if (aux === 'are') tokens[0] = 'Is';
  else if (aux === 'am') tokens[0] = 'Is';
  return tokens.join(' ') + '?';
}

function buildDoQuestionGrammarDistractor(answer = "") {
  const cleaned = String(answer || "").trim().replace(/[?!.]+$/g, "");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return cleaned;
  const aux = tokens[0].toLowerCase();
  if (aux === 'do') tokens[0] = 'Does';
  else if (aux === 'does') tokens[0] = 'Do';
  else if (aux === 'did') tokens[0] = 'Does';
  return tokens.join(' ') + '?';
}

function buildMissingAuxDistractor(answer = "", chapterKey = "") {
  const cleaned = String(answer || "").trim().replace(/[?!.]+$/g, "");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return cleaned;
  const first = tokens[0].toLowerCase();
  if (chapterKey === 'be_question' && ["is", "are", "am"].includes(first)) {
    return tokens.slice(1).join(' ') + '?';
  }
  if (chapterKey === 'do_question' && ["do", "does", "did"].includes(first)) {
    return tokens.slice(1).join(' ') + '?';
  }
  return tokens.slice(1).join(' ') + '?';
}

function rotateOptionsWithAnswer(options = [], answer = "", seed = 0) {
  const cleanOptions = Array.isArray(options) ? options.slice(0, 4) : [];
  const correctIndex = cleanOptions.findIndex((opt) => String(opt || '').trim() === String(answer || '').trim());
  if (cleanOptions.length !== 4 || correctIndex < 0) {
    return { options: cleanOptions, answerIndex: Math.max(0, correctIndex) };
  }
  const targetIndex = Math.abs(Number(seed) || 0) % 4;
  if (correctIndex === targetIndex) {
    return { options: cleanOptions, answerIndex: targetIndex };
  }
  const rotated = cleanOptions.slice();
  const temp = rotated[targetIndex];
  rotated[targetIndex] = rotated[correctIndex];
  rotated[correctIndex] = temp;
  return { options: rotated, answerIndex: targetIndex };
}

function makeChoiceOptions(answer = "", input, seed = 0) {
  const base = String(answer).trim();
  const normalizedChapter = String(input?.grammarFocus?.chapterKey || '').trim();
  const candidates = [base];

  if (normalizedChapter === 'be_question') {
    candidates.push(buildBeQuestionGrammarDistractor(base));
    candidates.push(buildDeclarativeDistractor(base));
    candidates.push(buildMissingAuxDistractor(base, normalizedChapter));
  } else if (normalizedChapter === 'do_question') {
    candidates.push(buildDoQuestionGrammarDistractor(base));
    candidates.push(buildDeclarativeDistractor(base));
    candidates.push(buildMissingAuxDistractor(base, normalizedChapter));
  } else {
    candidates.push(buildDeclarativeDistractor(base));
    candidates.push(buildMissingAuxDistractor(base, normalizedChapter));
    candidates.push(base.replace(/\b(is|are|am|do|does|did)\b/i, 'Be'));
  }

  const options = [];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;
    if (!options.includes(value)) options.push(value);
  }

  while (options.length < 4) {
    const filler = buildDeclarativeDistractor(base).replace(/[.]$/, '') + ' again';
    if (!options.includes(filler)) options.push(filler);
    else break;
  }

  const finalized = options.slice(0, 4);
  return rotateOptionsWithAnswer(finalized, base, seed);
}

function normalizeWorkbookTypeLoose(value = "") {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "guided_writing";
  if (["guided_writing", "guided-writing", "guided writing", "guided", "guide", "writing"].includes(v)) return "guided_writing";
  if (["blank_fill", "blank-fill", "blank fill", "blank", "blankfill", "fill_blank", "fill_in_blank"].includes(v)) return "blank_fill";
  if (["choice", "binary_choice", "binary-choice", "multiple choice", "mcq", "binarychoice", "binary", "either_or"].includes(v)) return "choice";
  if (["sentence_build", "sentence-build", "sentence build", "build", "rearrange"].includes(v)) return "sentence_build";
  return v;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildItemPairsFromWorksheetParts(questions = [], answers = [], workbookType = "guided_writing") {
  const answerByNumber = new Map();
  (Array.isArray(answers) ? answers : []).forEach((row, idx) => {
    const no = Number(row?.number) || (idx + 1);
    answerByNumber.set(no, String(row?.answer || row?.english || "").trim());
  });

  return (Array.isArray(questions) ? questions : []).map((row, idx) => {
    const no = Number(row?.number) || (idx + 1);
    const answer = String(answerByNumber.get(no) || row?.answer || row?.english || "").trim();
    const normalizedType = normalizeWorkbookTypeLoose(row?.type || workbookType);
    const rawPrompt = String(row?.prompt || row?.question || row?.korean || "").trim();
    const clue = String(row?.clue || row?.hint || "").trim();
    const blankSentence = String(row?.blankSentence || (normalizedType === "blank_fill" ? rawPrompt : "")).trim();
    let prompt = rawPrompt;
    let question = rawPrompt;
    let korean = String(row?.korean || "").trim();

    if (normalizedType === "blank_fill") {
      prompt = String(row?.korean || "").trim();
      question = prompt;
      korean = prompt || clue;
    } else {
      korean = korean || rawPrompt;
    }

    let options = Array.isArray(row?.options) ? row.options.slice(0, 4).map((v) => String(v || "").trim()).filter(Boolean) : [];
    if (normalizedType === "choice") {
      if (!options.includes(answer) && answer) options.unshift(answer);
      options = Array.from(new Set(options)).slice(0, 4);
      while (options.length < 4) options.push(`Option ${options.length + 1}`);
    }
    const answerIndex = normalizedType === "choice" ? Math.max(0, options.findIndex((opt) => opt === answer)) : 0;

    return {
      no,
      number: no,
      workbookType: normalizedType,
      type: normalizedType,
      prompt,
      question,
      clue,
      wordCount: Number.isFinite(Number(row?.wordCount)) ? Number(row.wordCount) : wordCountOf(answer),
      options,
      answerIndex,
      answer,
      english: answer,
      blankSentence,
      korean,
    };
  }).filter((row) => row.prompt || row.question || row.blankSentence || row.answer);
}

function renderWorksheetHtmlFromItemPairs(items = [], workbookType = "guided_writing") {
  const normalizedType = normalizeWorkbookTypeLoose(workbookType);
  const rows = Array.isArray(items) ? items : [];
  return `<div class="iaw-rendered worksheet-root ${normalizedType}-root">` + rows.map((item) => {
    const no = Number(item.no || item.number || 0);
    const prompt = escapeHtml(item.prompt || item.question || item.korean || "");
    const clue = escapeHtml(item.clue || "");
    const wordCount = String(item.wordCount || "").trim();
    if (normalizedType === "blank_fill") {
      const blankSentence = escapeHtml(item.blankSentence || item.question || "");
      return `<div class="worksheet-item blank-item" data-item-no="${no}" style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 18px;">${blankSentence ? `<div class="blank-sentence-line"><span class="blank-no">${no}.</span> <span class="blank-sentence">${blankSentence}</span></div>` : ``}${clue ? `<div class="blank-clue-line"><span class="blank-meta-label">clue:</span> <span class="blank-clue">${clue}</span></div>` : ``}${wordCount ? `<div class="blank-wordcount-line"><span class="blank-meta-label">word count:</span> <span class="blank-wordcount">${wordCount}</span></div>` : ``}</div>`;
    }
    if (normalizedType === "choice") {
      const options = Array.isArray(item.options) ? item.options.slice(0, 4) : [];
      return `<div class="worksheet-item choice-item" data-item-no="${no}" style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 18px;"><div class="choice-question-line"><span class="choice-no">${no}.</span> <span class="choice-question">${prompt}</span></div><div class="choice-options-wrap">${options.map((opt, idx) => `<div class="choice-option-line"><span class="choice-option-no">${idx + 1})</span> <span class="choice-option-text">${escapeHtml(String(opt || "").replace(/^\d+[.)]\s*/, ""))}</span></div>`).join("\n")}</div>${clue ? `<div class="choice-clue-line"><span class="choice-meta-label">clue:</span> <span class="choice-clue">${clue}</span></div>` : ``}</div>`;
    }
    return `<div class="worksheet-item guided-item" data-item-no="${no}" style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 18px;"><div class="guided-question-line"><span class="guided-no">${no}.</span> <span class="guided-question">${prompt}</span></div>${clue ? `<div class="guided-clue-line"><span class="guided-meta-label">clue:</span> <span class="guided-clue">${clue}</span></div>` : ``}${wordCount ? `<div class="guided-wordcount-line"><span class="guided-meta-label">word count:</span> <span class="guided-wordcount">${wordCount}</span></div>` : ``}</div>`;
  }).join("\n") + `</div>`;
}

function renderAnswerHtmlFromItemPairs(items = [], workbookType = "guided_writing") {
  const normalizedType = normalizeWorkbookTypeLoose(workbookType);
  const rows = Array.isArray(items) ? items : [];
  return `<div class="iaw-rendered answer-root ${normalizedType}-answer-root">` + rows.map((item) => {
    const no = Number(item.no || item.number || 0);
    const answer = escapeHtml(item.answer || item.english || "");
    if (normalizedType === "choice") {
      return `<div class="answer-item" data-item-no="${no}"><span class="answer-no">${no}.</span> <span class="answer-text">정답 ${Number(item.answerIndex || 0) + 1}번 — ${answer}</span></div>`;
    }
    return `<div class="answer-item" data-item-no="${no}"><span class="answer-no">${no}.</span> <span class="answer-text">${answer}</span></div>`;
  }).join("\n") + `</div>`;
}

function createWorkbookRenderBundle(worksheet, input = {}) {
  if (!worksheet || typeof worksheet !== "object") return null;
  const workbookType = normalizeWorkbookTypeLoose(worksheet.worksheetType || input.workbookType || input.requestedWorkbookType || "guided_writing");
  const itemPairs = buildItemPairsFromWorksheetParts(worksheet.questions, worksheet.answers, workbookType);
  const answerSheet = itemPairs.map((row) => workbookType === "choice" ? `${row.no}. 정답 ${Number(row.answerIndex || 0) + 1}번 — ${row.answer}` : `${row.no}. ${row.answer}`).join("\n");
  const content = itemPairs.map((row) => {
    if (workbookType === "blank_fill") {
      return `${row.no}. ${row.blankSentence || row.question}${row.clue ? `
(clue: ${row.clue})` : ``}${row.wordCount ? `
(word count: ${row.wordCount})` : ``}`;
    }
    if (workbookType === "choice") {
      const optionLines = (Array.isArray(row.options) ? row.options : []).map((opt, idx) => `${idx + 1}) ${opt}`).join("\n");
      return `${row.no}. ${row.question}${optionLines ? `
${optionLines}` : ``}${row.clue ? `
(clue: ${row.clue})` : ``}`;
    }
    return `${row.no}. ${row.question}${row.clue ? `
(clue: ${row.clue})` : ``}${row.wordCount ? `
(word count: ${row.wordCount})` : ``}`;
  }).join("\n");
  return { workbookType, itemPairs, worksheetHtml: renderWorksheetHtmlFromItemPairs(itemPairs, workbookType), answerHtml: renderAnswerHtmlFromItemPairs(itemPairs, workbookType), answerSheetHtml: renderAnswerHtmlFromItemPairs(itemPairs, workbookType), answerSheet, questions: content, content, fullText: content + (answerSheet ? `

정답
${answerSheet}` : "") };
}


function buildDbFirstWorksheet(input) {
  const bankInfo = loadSentenceBank(input);
  const bank = bankInfo.items || [];
  if (!bank.length) return null;

  const worksheetType = normalizeWorkbookTypeLoose(input.workbookType || input.requestedWorkbookType || "guided_writing");
  const questions = [];
  const answers = [];

  for (let i = 0; i < input.count; i += 1) {
    const seed = bank[i % bank.length];
    const answer = String(seed.english || "").trim();
    const promptKo = String(seed.korean || "").trim();
    const itemWordCount = Number.isFinite(Number(seed.wordCount)) ? Number(seed.wordCount) : wordCountOf(answer);

    if (worksheetType === "guided_writing") {
      questions.push({
        number: i + 1,
        type: "guided_writing",
        prompt: promptKo,
        clue: pickEnglishClueFromSeed(seed, answer),
        wordCount: itemWordCount,
      });
      answers.push({ number: i + 1, answer });
      continue;
    }

    if (worksheetType === "blank_fill") {
      questions.push({
        number: i + 1,
        type: "blank_fill",
        prompt: buildBlankFromSeed(seed, answer),
        clue: promptKo,
        wordCount: itemWordCount,
      });
      answers.push({ number: i + 1, answer });
      continue;
    }

    if (worksheetType === "choice") {
      const choiceBundle = buildChoiceOptionsFromSeed(seed, answer, input, i + 1);
      questions.push({
        number: i + 1,
        type: "binary_choice",
        prompt: promptKo,
        options: choiceBundle.options,
        answerIndex: choiceBundle.answerIndex,
        clue: "",
        wordCount: itemWordCount,
      });
      answers.push({
        number: i + 1,
        answer,
        answerIndex: choiceBundle.answerIndex,
      });
      continue;
    }
  }

  const worksheet = {
    title: sanitizeString(input.worksheetTitle || `${input.gradeLabel} ${input.topic} - Writing Lab`),
    worksheetType,
    questions,
    answers,
    meta: {
      gradeLabel: input.gradeLabel,
      level: input.level,
      mode: input.mode,
      workbookType: worksheetType,
      fallbacks: input.workbookFallbacks,
      topic: input.topic,
      difficulty: input.difficulty,
      grammarFocus: input.grammarFocus.chapterKey,
      dbFirst: true,
      layoutLock: true,
      dbSource: bankInfo.source,
      dbFilePath: bankInfo.filePath || "",
      dbItemCount: bank.length,
    },
  };

  return Object.assign(worksheet, createWorkbookRenderBundle(worksheet, input), {
    dbMode: true,
    dbForced: true,
    gptFallbackBlocked: true,
    meta: Object.assign({}, worksheet.meta || {}, {
      dbFirst: true,
      layoutLock: true,
      dbSource: bankInfo.source,
      dbFilePath: bankInfo.filePath || "",
      dbItemCount: bank.length,
    }),
  });
}


function shouldUseDbFirst(input) {
  const workbookType = normalizeWorkbookTypeLoose(input?.workbookType || input?.requestedWorkbookType || "");
  const supportedType = ["guided_writing", "blank_fill", "choice"].includes(workbookType);
  const supportedMode = ["magic", "writing", "magic-card"].includes(String(input?.mode || "").toLowerCase());
  const bankInfo = loadSentenceBank(input);
  return supportedMode && supportedType && Array.isArray(bankInfo.items) && bankInfo.items.length > 0;
}


async function generateWithOpenAI(input) {
  if (!client) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const prompt = buildPrompt(input);
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are a precise worksheet generator. Output JSON only. No markdown fences.",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    max_output_tokens: 4000,
  });

  const text = response.output_text || "";
  const parsed = extractJson(text);
  if (!parsed) {
    throw new Error("Model output was not valid JSON.");
  }
  return enforceWorksheetShape(parsed, input);
}

async function readMemberMp(memberId) {
  if (!memberId || !MEMBERSTACK_SECRET_KEY || !MEMBERSTACK_APP_ID) return null;
  const res = await fetch(`${MEMBERSTACK_BASE_URL}/${memberId}.json?appId=${MEMBERSTACK_APP_ID}`, {
    headers: { Authorization: `Bearer ${MEMBERSTACK_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const customFields = data?.data?.customFields || data?.customFields || {};
  return sanitizeMp(customFields?.[MEMBERSTACK_MP_FIELD], 0);
}

async function writeMemberMp(memberId, nextMp) {
  if (!memberId || !MEMBERSTACK_SECRET_KEY || !MEMBERSTACK_APP_ID) return false;
  const res = await fetch(`${MEMBERSTACK_BASE_URL}/${memberId}.json?appId=${MEMBERSTACK_APP_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${MEMBERSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customFields: {
        [MEMBERSTACK_MP_FIELD]: String(nextMp),
      },
    }),
  });
  return res.ok;
}


function buildResponsePayload({ input, worksheet, renderBundle, mp }) {
  const workbookType = normalizeWorkbookTypeLoose(worksheet?.worksheetType || renderBundle?.workbookType || input.workbookType || 'guided_writing');
  const itemPairs = Array.isArray(renderBundle?.itemPairs) && renderBundle.itemPairs.length
    ? renderBundle.itemPairs
    : (Array.isArray(worksheet?.itemPairs) ? worksheet.itemPairs : []);
  const questions = Array.isArray(worksheet?.questions) ? worksheet.questions : [];
  const answers = Array.isArray(worksheet?.answers) ? worksheet.answers : [];
  const answerSheet = String(renderBundle?.answerSheet || worksheet?.answerSheet || itemPairs.map((row, idx) => {
    const no = Number(row?.no || row?.number || idx + 1);
    if (workbookType === 'choice') return `${no}. ${Number(row?.answerIndex || 0) + 1}) ${String(row?.answer || row?.english || '').trim()}`;
    return `${no}. ${String(row?.answer || row?.english || '').trim()}`;
  }).filter(Boolean).join('\n')).trim();
  const content = String(renderBundle?.content || renderBundle?.questions || worksheet?.content || itemPairs.map((row, idx) => {
    const no = Number(row?.no || row?.number || idx + 1);
    const prompt = String(row?.prompt || row?.question || row?.korean || '').trim();
    const clue = String(row?.clue || '').trim();
    const wc = String(row?.wordCount || '').trim();
    return `${no}. ${prompt}${clue ? `\n(clue: ${clue})` : ''}${wc ? `\n(word count: ${wc})` : ''}`;
  }).filter(Boolean).join('\n')).trim();
  const worksheetHtml = String(renderBundle?.worksheetHtml || worksheet?.worksheetHtml || '').trim();
  const answerHtml = String(renderBundle?.answerHtml || worksheet?.answerHtml || worksheet?.answerSheetHtml || '').trim();
  const answerSheetHtml = String(renderBundle?.answerSheetHtml || worksheet?.answerSheetHtml || worksheet?.answerHtml || answerHtml).trim();
  const fullText = String(renderBundle?.fullText || worksheet?.fullText || [content, answerSheet ? `정답\n${answerSheet}` : ''].filter(Boolean).join('\n\n')).trim();
  return {
    ok: true,
    title: worksheet?.title || input.worksheetTitle || `${input.gradeLabel} ${input.topic}`,
    workbookType,
    worksheetHtml,
    answerHtml,
    answerSheetHtml,
    answerSheet,
    content,
    fullText,
    itemPairs,
    questions,
    answers,
    worksheet: Object.assign({}, worksheet || {}, {
      worksheetType: workbookType,
      questions,
      answers,
      itemPairs,
      worksheetHtml,
      answerHtml,
      answerSheetHtml,
      answerSheet,
      content,
      fullText,
    }),
    meta: {
      workbookType,
      fallbacks: input.workbookFallbacks,
      grammarFocus: input.grammarFocus.chapterKey,
      mp,
      cleanRebuild: true,
      dbForced: !!worksheet?.dbForced,
      removedLayers: [
        's30-8R safe pair recovery',
        's30-9 guided print block lock',
        's41~s47 additive patch layers',
      ],
    },
  };
}

async function consumeMpIfNeeded(input) {
  if (!input.useMp || !input.memberId) {
    return { enabled: false, cost: input.mpCost, remaining: null };
  }

  const currentMp = await readMemberMp(input.memberId);
  if (currentMp == null) {
    return { enabled: false, cost: input.mpCost, remaining: null, warning: "MP lookup skipped." };
  }
  if (currentMp < input.mpCost) {
    const error = new Error("Not enough MP.");
    error.code = "INSUFFICIENT_MP";
    error.currentMp = currentMp;
    error.requiredMp = input.mpCost;
    throw error;
  }

  const nextMp = currentMp - input.mpCost;
  const updated = await writeMemberMp(input.memberId, nextMp);
  return {
    enabled: true,
    cost: input.mpCost,
    remaining: updated ? nextMp : currentMp,
    warning: updated ? null : "MP update failed; generation returned without MP writeback.",
  };
}

async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only." });
  }

  try {
    const input = normalizeInput(req.body || {});
    const worksheet = shouldUseDbFirst(input)
      ? buildDbFirstWorksheet(input)
      : await generateWithOpenAI(input);
    const renderBundle = createWorkbookRenderBundle(worksheet, input) || {};
    const mp = await consumeMpIfNeeded(input);
    return json(res, 200, buildResponsePayload({ input, worksheet, renderBundle, mp }));
  } catch (error) {
    const code = error?.code || "GENERATION_ERROR";
    const status = code === "INSUFFICIENT_MP" ? 402 : 500;
    return json(res, status, {
      ok: false,
      error: error?.message || "Generation failed.",
      code,
      currentMp: error?.currentMp ?? null,
      requiredMp: error?.requiredMp ?? null,
    });
  }
}


module.exports = handler;
module.exports.config = config;
