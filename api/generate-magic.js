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

function hasSentenceBankGradeFolders(rootPath) {
  try {
    return fs.existsSync(rootPath) && fs.readdirSync(rootPath, { withFileTypes: true })
      .some((entry) => entry.isDirectory() && /^(elementary|middle|high)\d+$/i.test(entry.name));
  } catch (error) {
    return false;
  }
}

function pickSentenceBankRoot() {
  const candidates = [
    path.join(process.cwd(), "data", "sentence_bank"),
    path.join(process.cwd(), "data"),
    path.join(__dirname, "..", "data", "sentence_bank"),
    path.join(__dirname, "..", "data"),
  ];
  return candidates.find(hasSentenceBankGradeFolders) || candidates[0];
}

const SENTENCE_BANK_ROOT = pickSentenceBankRoot();

const CANONICAL_DB_FILENAME_REGISTRY = Object.freeze({
  middle1: Object.freeze({
    after_before: "middle1_after_before.json",
    and: "middle1_and.json",
    a_few_few: "middle1_a_few_few.json",
    a_little_little: "middle1_a_little_little.json",
    because: "middle1_because.json",
    be_negative: "middle1_be_negative.json",
    be_question: "middle1_be_question.json",
    be_verb: "middle1_be_verb.json",
    but: "middle1_but.json",
    can: "middle1_can.json",
    causative: "middle1_causative.json",
    comparatives: "middle1_comparatives.json",
    conjunction_that: "middle1_conjunction_that.json",
    conjunction_when: "middle1_conjunction_when.json",
    conjunction_while: "middle1_conjunction_while.json",
    do_negative: "middle1_do_negative.json",
    do_question: "middle1_do_question.json",
    do_verb: "middle1_do_verb.json",
    exclamation: "middle1_exclamation.json",
    five_form: "middle1_five_form.json",
    frequency_adverbs: "middle1_frequency_adverbs.json",
    gerund_object: "middle1_gerund_object.json",
    gerund_total: "middle1_gerund_total.json",
    have_to: "middle1_have_to.json",
    imperatives: "middle1_imperatives.json",
    many_much: "middle1_many_much.json",
    may: "middle1_may.json",
    will: "middle1_will.json",
    must: "middle1_must.json",
    passive: "middle1_passive.json",
    passive_advanced: "middle1_passive_advanced.json",
    past: "middle1_past.json",
    prepositions_basic: "middle1_prepositions_basic.json",
    present_continuous: "middle1_present_continuous.json",
    quantifiers: "middle1_quantifiers.json",
    reflexive_pronoun: "middle1_reflexive_pronoun.json",
    semi_causative: "middle1_semi_causative.json",
    perception_verb: "middle1_perception_verb.json",
    sensory_verb: "middle1_sensory_verb.json",
    should: "middle1_should.json",
    so: "middle1_so.json",
    superlatives: "middle1_superlatives.json",
    there_is_are: "middle1_there_is_are.json",
    to_infinitive_noun: "middle1_to_infinitive_noun.json",
    to_infinitive_total: "middle1_to_infinitive_total.json",
    wh_question: "middle1_wh_question.json",
  }),
  middle2: Object.freeze({
    after_before: "middle2_after_before.json",
    although: "middle2_although.json",
    as_as: "middle2_as_as.json",
    as_conjunction: "middle2_as_conjunction.json",
    because_of: "middle2_because_of.json",
    because: "middle2_because.json",
    causative_verbs: "middle2_causative_verbs.json",
    comparative_emphasis: "middle2_comparative_emphasis.json",
    comparative: "middle2_comparative.json",
    ditransitive: "middle2_ditransitive.json",
    do_emphasis: "middle2_do_emphasis.json",
    dont_have_to: "middle2_dont_have_to.json",
    frequency_adverbs: "middle2_frequency_adverbs.json",
    gerund: "middle2_gerund.json",
    had_better: "middle2_had_better.json",
    here_there_inversion: "middle2_here_there_inversion.json",
    if_condition: "middle2_if_condition.json",
    imperatives: "middle2_imperatives.json",
    indefinite_pronouns: "middle2_indefinite_pronouns.json",
    indirect_question: "middle2_indirect_question.json",
    it_to: "middle2_it_to.json",
    modal_extended: "middle2_modal_extended.json",
    not_only_but_also: "middle2_not_only_but_also.json",
    object_complement_adj: "middle2_object_complement_adj.json",
    objective_relative_pronouns: "middle2_objective_relative_pronouns.json",
    participles: "middle2_participles.json",
    passive: "middle2_passive.json",
    perception_verbs: "middle2_perception_verbs.json",
    possessive_relative_pronouns: "middle2_possessive_relative_pronouns.json",
    present_perfect: "middle2_present_perfect.json",
    quantity_adjectives: "middle2_quantity_adjectives.json",
    quantity_agreement: "middle2_quantity_agreement.json",
    quasi_causative: "middle2_quasi_causative.json",
    reflexive_pronouns: "middle2_reflexive_pronouns.json",
    relative_adverbs: "middle2_relative_adverbs.json",
    relative_pronoun_what: "middle2_relative_pronoun_what.json",
    sensory_verb: "middle2_sensory_verb.json",
    since: "middle2_since.json",
    so_that_purpose: "middle2_so_that_purpose.json",
    so_that: "middle2_so_that.json",
    something_adjective: "middle2_something_adjective.json",
    subject_relative_pronouns: "middle2_subject_relative_pronouns.json",
    subjunctive_past: "middle2_subjunctive_past.json",
    superlative: "middle2_superlative.json",
    tag_questions: "middle2_tag_questions.json",
    tense_agreement: "middle2_tense_agreement.json",
    that: "middle2_that.json",
    the_comparative_the_comparative: "middle2_the_comparative_the_comparative.json",
    to_infinitive_adjective: "middle2_to_infinitive_adjective.json",
    to_infinitive_adverbial: "middle2_to_infinitive_adverbial.json",
    to_infinitive_noun: "middle2_to_infinitive_noun.json",
    too_to_enough_to: "middle2_too_to_enough_to.json",
    used_to: "middle2_used_to.json",
    wh_questions: "middle2_wh_questions.json",
    wh_to_infinitive: "middle2_wh_to_infinitive.json",
    while_when: "middle2_while_when.json",
    with_noun_phrase_be: "middle2_with_noun_phrase_be.json",
    with_noun_phrase_have: "middle2_with_noun_phrase_have.json",
  }),
  middle3: Object.freeze({
    after_before_advanced: "middle3_after_before_advanced.json",
    after_before: "middle3_after_before.json",
    as_as: "middle3_as_as.json",
    because_because_of: "middle3_because_because of.json",
    causative_verbs_advanced: "middle3_causative_verbs_advanced.json",
    causative_verbs: "middle3_causative_verbs.json",
    cleft_it_that: "middle3_cleft_it_that.json",
    comparative_emphasis_adverbs: "middle3_comparative_emphasis_adverbs.json",
    comparative: "middle3_comparative.json",
    continuative_relative_clauses: "middle3_continuative_relative_clauses.json",
    do_emphasis: "middle3_do_emphasis.json",
    gerund_idiomatic_expressions: "middle3_gerund_idiomatic_expressions.json",
    have_object_pp: "middle3_have_object_pp.json",
    however_therefore: "middle3_however_therefore.json",
    if_whether: "middle3_if_whether.json",
    indefinite_pronouns: "middle3_indefinite_pronouns.json",
    indirect_question: "middle3_indirect_question.json",
    inversion_so_neither: "middle3_inversion_so_neither.json",
    it_object_infinitive: "middle3_it_object_infinitive.json",
    it_seems_that: "middle3_it_seems_that.json",
    it_that_expletive_subject: "middle3_it_that_expletive_subject.json",
    it_to_infinitive_subject: "middle3_it_to_infinitive_subject.json",
    its_time_subjunctive: "middle3_its_time_subjunctive.json",
    modal_have_pp: "middle3_modal_have_pp.json",
    modal_passive: "middle3_modal_passive.json",
    not_only_but_also: "middle3_not_only_but_also.json",
    not_to_infinitive: "middle3_not_to_infinitive.json",
    object_complement_5th_form: "middle3_object_complement_5th_form.json",
    objective_relative_pronouns: "middle3_objective_relative_pronouns.json",
    participial_construction: "middle3_participial_construction.json",
    participles_attributive: "middle3_participles_attributive.json",
    past_perfect: "middle3_past_perfect.json",
    perceptual_verbs: "middle3_perceptual_verbs.json",
    possessive_relative_pronouns: "middle3_possessive_relative_pronouns.json",
    present_perfect_progressive: "middle3_present_perfect_progressive.json",
    present_perfect: "middle3_present_perfect.json",
    quasi_causative_verbs: "middle3_quasi_causative_verbs.json",
    relative_adverbs: "middle3_relative_adverbs.json",
    relative_pronoun_what: "middle3_relative_pronoun_what.json",
    reported_speech: "middle3_reported_speech.json",
    should_have_pp: "middle3_should_have_pp.json",
    since: "middle3_since.json",
    so_that_purpose_advanced: "middle3_so_that_purpose_advanced.json",
    so_that_purpose: "middle3_so_that_purpose.json",
    so_that: "middle3_so_that.json",
    subject_relative_pronouns: "middle3_subject_relative_pronouns.json",
    subjunctive_past_perfect: "middle3_subjunctive_past_perfect.json",
    subjunctive_past: "middle3_subjunctive_past.json",
    superlative: "middle3_superlative.json",
    sva_of_structure: "middle3_sva_of_structure.json",
    that_clause_statement: "middle3_that_clause_statement.json",
    that_clause_subjunctive: "middle3_that_clause_subjunctive.json",
    the_comparative_the_comparative: "middle3_the_comparative_the_comparative.json",
    time_conjunctions: "middle3_time_conjunctions.json",
    to_infinitive_adverbial: "middle3_to_infinitive_adverbial.json",
    to_infinitive_gerund_verbs: "middle3_to_infinitive_gerund_verbs.json",
    to_infinitive_noun_adjective_quality_fix: "middle3_to_infinitive_noun_adjective_quality_fix.json",
    to_infinitive_noun_adjective: "middle3_to_infinitive_noun_adjective.json",
    too_enough_to: "middle3_too_enough_to.json",
    total_vs_partial_negation: "middle3_total_vs_partial_negation.json",
    wh_to_infinitive: "middle3_wh_to_infinitive.json",
    while_when: "middle3_while_when.json",
    wish_subjunctive: "middle3_wish_subjunctive.json",
    with_object_participle: "middle3_with_object_participle.json",
  }),
});

function getCanonicalDbFilename(bucket = "", chapterKey = "") {
  const normalizedBucket = normalizeChapterKey(bucket);
  const normalizedChapter = normalizeChapterKey(chapterKey);
  return CANONICAL_DB_FILENAME_REGISTRY[normalizedBucket]?.[normalizedChapter] || "";
}

function getCanonicalDbPath(bucket = "", chapterKey = "") {
  const normalizedBucket = normalizeChapterKey(bucket);
  const filename = getCanonicalDbFilename(normalizedBucket, chapterKey);
  return filename ? path.join(SENTENCE_BANK_ROOT, normalizedBucket, filename) : "";
}

function normalizeChapterKey(value = "") {
  return String(value || "")
    .replace(/\.json$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function extractSentenceBankChapterFromFilename(grade, fileName) {
  const base = String(fileName || "")
    .replace(/\.json$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  const normalizedGrade = String(grade || "").toLowerCase();
  if (base === normalizedGrade) return "";
  if (base.startsWith(`${normalizedGrade}_`)) return base.slice(normalizedGrade.length + 1);
  return base;
}

const GRAMMAR_FAMILY_MAP = Object.freeze({
  gerund: [
    "gerund_total",
    "gerund_object",
    "gerund_idiomatic_expressions",
    "gerund",
  ],
  to_infinitive: [
    "to_infinitive_total",
    "to_infinitive_noun",
    "to_infinitive_adjective",
    "to_infinitive_adverbial",
    "wh_to_infinitive",
    "to_infinitive_gerund_verbs",
    "to_infinitive_noun_adjective",
    "to_infinitive_noun_adjective_quality_fix",
    "it_to_infinitive_subject",
    "it_object_infinitive",
    "not_to_infinitive",
  ],
  relative_pronoun: [
    "subject_relative_pronouns",
    "objective_relative_pronouns",
    "possessive_relative_pronouns",
    "relative_pronoun_what",
  ],
  comparative: [
    "comparatives",
    "comparative",
    "comparative_emphasis",
    "comparative_emphasis_adverbs",
    "the_comparative_the_comparative",
  ],
});

const SPECIALIZED_ALIAS_MAP = Object.freeze({
  "to부정사의 명사적 용법": "to_infinitive_noun",
  "to 부정사의 명사적 용법": "to_infinitive_noun",
  "to부정사 명사적 용법": "to_infinitive_noun",
  "to 부정사 명사적 용법": "to_infinitive_noun",
  "명사적 용법": "to_infinitive_noun",
  "to부정사의 형용사적 용법": "to_infinitive_adjective",
  "to 부정사의 형용사적 용법": "to_infinitive_adjective",
  "to부정사 형용사적 용법": "to_infinitive_adjective",
  "to 부정사 형용사적 용법": "to_infinitive_adjective",
  "형용사적 용법": "to_infinitive_adjective",
  "to부정사의 부사적 용법": "to_infinitive_adverbial",
  "to 부정사의 부사적 용법": "to_infinitive_adverbial",
  "to부정사 부사적 용법": "to_infinitive_adverbial",
  "to 부정사 부사적 용법": "to_infinitive_adverbial",
  "부사적 용법": "to_infinitive_adverbial",
  "의문사 to부정사": "wh_to_infinitive",
  "의문사 to 부정사": "wh_to_infinitive",
  "wh to infinitive": "wh_to_infinitive",
  "wh_to_infinitive": "wh_to_infinitive",
  "not to부정사": "not_to_infinitive",
  "not to 부정사": "not_to_infinitive",
  "not to infinitive": "not_to_infinitive",
  "not_to_infinitive": "not_to_infinitive",
  "to부정사와 동명사": "to_infinitive_gerund_verbs",
  "to부정사 동명사": "to_infinitive_gerund_verbs",
  "동명사 to부정사": "to_infinitive_gerund_verbs",
  "to infinitive gerund verbs": "to_infinitive_gerund_verbs",
  "to_infinitive_gerund_verbs": "to_infinitive_gerund_verbs",
  "to부정사 명사 형용사 보정": "to_infinitive_noun_adjective_quality_fix",
  "to infinitive noun adjective quality fix": "to_infinitive_noun_adjective_quality_fix",
  "to_infinitive_noun_adjective_quality_fix": "to_infinitive_noun_adjective_quality_fix",
  "to부정사 명사 형용사": "to_infinitive_noun_adjective",
  "to부정사 명사적 형용사적 용법": "to_infinitive_noun_adjective",
  "to infinitive noun adjective": "to_infinitive_noun_adjective",
  "to_infinitive_noun_adjective": "to_infinitive_noun_adjective",
  "동명사 목적어": "gerund_object",
  "목적어 동명사": "gerund_object",
  "gerund object": "gerund_object",
  "동명사 관용 표현": "gerund_idiomatic_expressions",
  "동명사 관용표현": "gerund_idiomatic_expressions",
  "gerund idiomatic expressions": "gerund_idiomatic_expressions",
  "gerund_idiomatic_expressions": "gerund_idiomatic_expressions",
  "주격 관계대명사": "subject_relative_pronouns",
  "주격관계대명사": "subject_relative_pronouns",
  "subject relative pronouns": "subject_relative_pronouns",
  "목적격 관계대명사": "objective_relative_pronouns",
  "목적격관계대명사": "objective_relative_pronouns",
  "objective relative pronouns": "objective_relative_pronouns",
  "소유격 관계대명사": "possessive_relative_pronouns",
  "소유격관계대명사": "possessive_relative_pronouns",
  "possessive relative pronouns": "possessive_relative_pronouns",
  "관계대명사 what": "relative_pronoun_what",
  "what 관계대명사": "relative_pronoun_what",
  "relative pronoun what": "relative_pronoun_what",
  "relative_pronoun_what": "relative_pronoun_what",
  "비교급 강조": "comparative_emphasis",
  "비교급 강조어": "comparative_emphasis",
  "comparative emphasis": "comparative_emphasis",
  "comparative_emphasis": "comparative_emphasis",
  "비교급 강조 부사": "comparative_emphasis_adverbs",
  "비교급 강조부사": "comparative_emphasis_adverbs",
  "comparative emphasis adverbs": "comparative_emphasis_adverbs",
  "comparative_emphasis_adverbs": "comparative_emphasis_adverbs",
  "the 비교급 the 비교급": "the_comparative_the_comparative",
  "the 비교급, the 비교급": "the_comparative_the_comparative",
  "the comparative the comparative": "the_comparative_the_comparative",
  "the_comparative_the_comparative": "the_comparative_the_comparative",
});

const FAMILY_ALIAS_MAP = Object.freeze({
  "to부정사": "to_infinitive",
  "to 부정사": "to_infinitive",
  "to infinitive": "to_infinitive",
  "to_infinitive": "to_infinitive",
  "동명사": "gerund",
  "gerund": "gerund",
  "관계대명사": "relative_pronoun",
  "관계 대명사": "relative_pronoun",
  "relative pronoun": "relative_pronoun",
  "relative_pronoun": "relative_pronoun",
  "비교급": "comparative",
  "comparative": "comparative",
  "comparatives": "comparative",
});

const FAMILY_REPRESENTATIVE_HINTS = ["total", "representative", "standard"];
const SPECIALIZED_CHAPTER_KEYS = Object.freeze([...new Set(Object.values(SPECIALIZED_ALIAS_MAP))]);

function inferGrammarFamily(chapter = "") {
  const key = normalizeChapterKey(chapter);
  if (!key) return "";
  for (const [family, candidates] of Object.entries(GRAMMAR_FAMILY_MAP)) {
    if (key === family || candidates.includes(key)) return family;
  }
  if (key.includes("to_infinitive") || key === "wh_to_infinitive" || key === "it_to") return "to_infinitive";
  if (key.includes("gerund")) return "gerund";
  if (key.includes("relative_pronoun") || key.includes("relative_pronouns") || key.endsWith("_relative_clauses")) return "relative_pronoun";
  if (key.includes("comparative") || key === "comparatives") return "comparative";
  return key.split("_")[0] || "";
}

function inferGrammarSubtype(chapter = "", family = "") {
  const key = normalizeChapterKey(chapter);
  const familyKey = normalizeChapterKey(family);
  if (!key || !familyKey || key === familyKey) return "";
  if (key.startsWith(`${familyKey}_`)) return key.slice(familyKey.length + 1);
  if (familyKey === "to_infinitive" && key === "wh_to_infinitive") return "wh";
  if (familyKey === "relative_pronoun") return key.replace(/_relative_pronouns?$/, "").replace(/^relative_pronoun_/, "");
  return key;
}

function normalizeChapterAliasIndexKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readSentenceBankChapterMetas(filePath = "") {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const metaMap = new Map();
    for (const item of items) {
      if (!item || typeof item !== "object" || !item.chapterMeta) continue;
      const chapterMeta = item.chapterMeta;
      const canonical = normalizeChapterKey(chapterMeta.canonical || chapterMeta.chapterKey || item.chapterKey || "");
      if (!canonical || metaMap.has(canonical)) continue;
      metaMap.set(canonical, chapterMeta);
    }
    return [...metaMap.values()];
  } catch (error) {
    return [];
  }
}

function buildSentenceBankRegistry() {
  const registry = { byGrade: {}, files: [], families: {}, aliases: {}, aliasList: {} };
  if (!fs.existsSync(SENTENCE_BANK_ROOT)) return registry;

  let gradeDirs = [];
  try {
    gradeDirs = fs.readdirSync(SENTENCE_BANK_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^(elementary|middle|high)\d+$/i.test(name));
  } catch (error) {
    return registry;
  }

  for (const gradeDir of gradeDirs) {
    const grade = gradeDir.toLowerCase();
    const gradePath = path.join(SENTENCE_BANK_ROOT, gradeDir);
    registry.byGrade[grade] = registry.byGrade[grade] || {};
    registry.families[grade] = registry.families[grade] || {};
    registry.aliases[grade] = registry.aliases[grade] || {};
    registry.aliasList[grade] = registry.aliasList[grade] || [];

    let files = [];
    try {
      files = fs.readdirSync(gradePath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
        .map((entry) => entry.name);
    } catch (error) {
      continue;
    }

    for (const fileName of files) {
      const chapter = extractSentenceBankChapterFromFilename(grade, fileName);
      if (!chapter) continue;
      const filePath = path.join(gradePath, fileName);
      const chapterMetas = readSentenceBankChapterMetas(filePath);
      const entryMetas = chapterMetas.length ? chapterMetas : [{ canonical: chapter }];

      for (const chapterMeta of entryMetas) {
        const canonicalChapter = normalizeChapterKey(chapterMeta?.canonical || chapterMeta?.chapterKey || chapter);
        const family = normalizeChapterKey(chapterMeta?.family || inferGrammarFamily(canonicalChapter || chapter));
        const subtype = normalizeChapterKey(chapterMeta?.subtype || inferGrammarSubtype(canonicalChapter || chapter, family));
        const representativeCandidate = (
          canonicalChapter === family ||
          canonicalChapter === `${family}_total` ||
          chapter === family ||
          chapter === `${family}_total` ||
          FAMILY_REPRESENTATIVE_HINTS.some((hint) => canonicalChapter === `${family}_${hint}` || chapter === `${family}_${hint}`)
        );
        const meta = { grade, chapter, canonicalChapter, family, subtype, representativeCandidate, fileName, filePath, chapterMeta };
        registry.byGrade[grade][chapter] = registry.byGrade[grade][chapter] || meta;
        if (canonicalChapter && !registry.byGrade[grade][canonicalChapter]) registry.byGrade[grade][canonicalChapter] = meta;
        registry.files.push(meta);
        registry.families[grade][family] = registry.families[grade][family] || [];
        registry.families[grade][family].push(meta);

        const aliasValues = [
          canonicalChapter,
          chapter,
          ...(Array.isArray(chapterMeta?.aliases?.ko) ? chapterMeta.aliases.ko : []),
          ...(Array.isArray(chapterMeta?.aliases?.en) ? chapterMeta.aliases.en : []),
        ];
        for (const alias of aliasValues) {
          const aliasKey = normalizeChapterAliasIndexKey(alias);
          if (!aliasKey) continue;
          const resolvedChapter = canonicalChapter || chapter;
          registry.aliases[grade][aliasKey] = resolvedChapter;
          registry.aliasList[grade].push({ aliasKey, chapter: resolvedChapter, fileName });
        }
      }
    }
  }

  return registry;
}

function getAvailableGradeBuckets() {
  return Object.keys(SENTENCE_BANK_REGISTRY || {});
}

// STRICT DB-FIRST LOCK REMOVED LEGACY ROUTING



const MIDDLE1_EXPLICIT_ALIAS_MAP = Object.freeze({
  past_tense: "past",
  present_continuous: "present_continuous",
  there_is_are: "there_is_are",
  be_question: "be_question",
  be_negative: "be_negative",
  be_verb: "be_verb",
  do_question: "do_question",
  do_negative: "do_negative",
  do_verb: "do_verb",
  reflexive_pronoun: "reflexive_pronoun",
  reflexive_pronouns: "reflexive_pronoun",
  perception_verb: "perception_verb",
  perception_verbs: "perception_verb",
  sensory_verb: "sensory_verb",
  sensory_verbs: "sensory_verb",
  will: "will",
  causative_verbs: "causative",
  semi_causative: "semi_causative",
});

function applyExplicitMiddle1Alias(bucket = "", chapterKey = "") {
  if (String(bucket || "").toLowerCase() !== "middle1") {
    return normalizeChapterKey(chapterKey);
  }

  const normalized = normalizeChapterKey(chapterKey);

  if (MIDDLE1_EXPLICIT_ALIAS_MAP[normalized]) {
    return MIDDLE1_EXPLICIT_ALIAS_MAP[normalized];
  }

  return normalized;
}

const DB_REGISTRY = buildSentenceBankRegistry();
const SENTENCE_BANK_REGISTRY = Object.fromEntries(
  Object.entries(DB_REGISTRY.byGrade || {}).map(([grade, chapters]) => [
    grade,
    Object.fromEntries(Object.entries(chapters).map(([chapter]) => [chapter, getCanonicalDbPath(grade, chapter)])),
  ])
);
const ROUTING_MODES = Object.freeze({
  SPECIALIZED_EXACT_MATCH: "SPECIALIZED_EXACT_MATCH",
  FAMILY_REPRESENTATIVE_MATCH: "FAMILY_REPRESENTATIVE_MATCH",
  FAMILY_FALLBACK_MATCH: "FAMILY_FALLBACK_MATCH",
  EXACT_DB_MATCH: "EXACT_DB_MATCH",
  NORMALIZED_DB_MATCH: "NORMALIZED_DB_MATCH",
  
  UNDER_CONSTRUCTION: "UNDER_CONSTRUCTION",
});

function buildRoutingText(input = {}, chapterKey = "") {
  return [
    chapterKey,
    input?.topic,
    input?.worksheetTitle,
    input?.title,
    input?.chapter,
    input?.unit,
    input?.grammar,
    input?.prompt,
    input?.rawText,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function normalizeRoutingText(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findSpecializedAlias(rawText = "") {
  const normalized = normalizeRoutingText(rawText);
  if (!normalized) return null;
  const normalizedChapterKey = normalizeChapterKey(rawText);
  if (SPECIALIZED_CHAPTER_KEYS.includes(normalizedChapterKey)) {
    return { alias: normalizedChapterKey, chapter: normalizedChapterKey, internalKey: true };
  }
  for (const chapter of SPECIALIZED_CHAPTER_KEYS
    .slice()
    .sort((a, b) => normalizeRoutingText(b).length - normalizeRoutingText(a).length)) {
    if (normalized.includes(chapter)) {
      return { alias: chapter, chapter, internalKey: true };
    }
  }
  const entries = Object.entries(SPECIALIZED_ALIAS_MAP)
    .sort((a, b) => normalizeRoutingText(b[0]).length - normalizeRoutingText(a[0]).length);
  for (const [alias, chapter] of entries) {
    if (normalized.includes(normalizeRoutingText(alias))) {
      return { alias, chapter };
    }
  }
  return null;
}

function detectGrammarFamilyFromRequest(rawText = "", chapterKey = "") {
  const normalizedChapter = normalizeChapterKey(chapterKey);
  const directFamily = inferGrammarFamily(normalizedChapter);
  if (GRAMMAR_FAMILY_MAP[normalizedChapter]) return normalizedChapter;
  if (GRAMMAR_FAMILY_MAP[directFamily]) return directFamily;

  const normalizedText = normalizeRoutingText(rawText);
  const entries = Object.entries(FAMILY_ALIAS_MAP)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [alias, family] of entries) {
    if (normalizedText.includes(normalizeRoutingText(alias))) return family;
  }
  return "";
}

function getDbMeta(bucket = "", chapter = "") {
  return DB_REGISTRY?.byGrade?.[bucket]?.[chapter] || null;
}

function pickFamilyRepresentative(bucket = "", family = "") {
  const metas = DB_REGISTRY?.families?.[bucket]?.[family] || [];
  if (!metas.length) return null;
  const priority = [];
  for (const hint of FAMILY_REPRESENTATIVE_HINTS) {
    priority.push(`${family}_${hint}`);
  }
  priority.push(`${family}`);
  for (const candidate of GRAMMAR_FAMILY_MAP[family] || []) {
    if (candidate.endsWith("_total")) priority.unshift(candidate);
  }
  for (const chapter of [...new Set(priority)]) {
    const found = metas.find((meta) => meta.chapter === chapter);
    if (found) return found;
  }
  const representativeCandidate = metas.find((meta) => meta.representativeCandidate);
  if (representativeCandidate) return representativeCandidate;
  return null;
}

function pickFamilyFallback(bucket = "", family = "") {
  const metas = DB_REGISTRY?.families?.[bucket]?.[family] || [];
  if (!metas.length) return null;
  const ordered = GRAMMAR_FAMILY_MAP[family] || [];
  for (const chapter of ordered) {
    const found = metas.find((meta) => meta.chapter === chapter);
    if (found) return found;
  }
  return metas.slice().sort((a, b) => a.chapter.localeCompare(b.chapter))[0] || null;
}

function buildRoutingAuditReport() {
  const families = {};
  for (const [grade, familyMap] of Object.entries(DB_REGISTRY.families || {})) {
    families[grade] = Object.fromEntries(
      Object.entries(familyMap).map(([family, metas]) => [
        family,
        metas.map((meta) => meta.fileName),
      ])
    );
  }

  const aliasEntries = Object.entries(SPECIALIZED_ALIAS_MAP);
  const duplicateAliases = aliasEntries
    .map(([alias]) => alias)
    .filter((alias, index, aliases) => aliases.indexOf(alias) !== index);
  const unresolvedAliases = aliasEntries
    .filter(([, chapter]) => !Object.values(DB_REGISTRY.byGrade || {}).some((chapters) => chapters[chapter]))
    .map(([alias, chapter]) => ({ alias, chapter }));
  const missingRepresentatives = [];
  const fallbackRoutingChains = {};

  for (const [grade, familyMap] of Object.entries(DB_REGISTRY.families || {})) {
    fallbackRoutingChains[grade] = {};
    for (const family of Object.keys(familyMap)) {
      const representative = pickFamilyRepresentative(grade, family);
      if ((GRAMMAR_FAMILY_MAP[family] || []).length && !representative) {
        missingRepresentatives.push({ grade, family });
      }
      fallbackRoutingChains[grade][family] = (GRAMMAR_FAMILY_MAP[family] || [])
        .filter((chapter) => Boolean(getDbMeta(grade, chapter)));
    }
  }

  return {
    detectedDbFiles: DB_REGISTRY.files.map((meta) => getCanonicalDbPath(meta.grade, meta.canonicalChapter || meta.chapter)).filter(Boolean),
    familyGrouping: families,
    unresolvedAliases,
    duplicateAliases,
    missingRepresentatives,
    fallbackRoutingChains,
  };
}

function logStartupRoutingAudit() {
  const report = buildRoutingAuditReport();
  console.info("[DB_ROUTING_AUDIT]", {
    detectedDbFileCount: report.detectedDbFiles.length,
    detectedDbFiles: report.detectedDbFiles,
    familyGrouping: report.familyGrouping,
    unresolvedAliases: report.unresolvedAliases,
    duplicateAliases: report.duplicateAliases,
    missingRepresentatives: report.missingRepresentatives,
    fallbackRoutingChains: report.fallbackRoutingChains,
  });
}

logStartupRoutingAudit();

const CHAPTER_ALIAS_PATTERNS = [
  { key: "be_question", patterns: [/중1\s*be동사\s*의문문/i, /be동사\s*의문문/i] },
  { key: "be_negative", patterns: [/중1\s*be동사\s*부정문/i, /be동사\s*부정문/i] },
  { key: "be_verb", patterns: [/중1\s*be동사/i] },
  { key: "do_question", patterns: [/중1\s*일반동사\s*의문문/i, /일반동사\s*의문문/i] },
  { key: "do_negative", patterns: [/중1\s*일반동사\s*부정문/i, /일반동사\s*부정문/i] },
  { key: "do_verb", patterns: [/중1\s*일반동사/i] },
  { key: "present_continuous", patterns: [/중1\s*현재진행형/i, /현재진행형/i] },
  { key: "there_is_are", patterns: [/there_is_are/i, /there\s*is\s*\(are\)/i] },
  { key: "will", patterns: [/중1\s*조동사\s*will/i] },
  { key: "must", patterns: [/중1\s*조동사\s*must/i] },
  { key: "may", patterns: [/중1\s*조동사\s*may/i] },
  { key: "can", patterns: [/중1\s*조동사\s*can/i] },
  { key: "reflexive_pronoun", patterns: [/재귀대명사/i] },
  { key: "five_form", patterns: [/5형식/i, /오형식/i] },
  { key: "passive", patterns: [/중2\s*수동태/i, /수동태/i] },
  { key: "subjunctive_past", patterns: [/가정법\s*과거/i] },
  { key: "have_object_pp", patterns: [/have\s*object\s*pp/i] },
  {
    key: "present_perfect",
    patterns: [
      /현재완료/i,
      /present\s*perfect/i
    ]
  },
  {
    key: "past_perfect",
    patterns: [
      /과거완료/i,
      /past\s*perfect/i
    ]
  },
  {
    key: "whether",
    patterns: [
      /접속사\s*whether/i,
      /\bwhether\b/i
    ]
  },
  {
    key: "have_object_pp",
    patterns: [
      /have\s*목적어\s*과거분사/i,
      /have\s*object\s*past\s*participle/i
    ]
  },
  {
    key: "relative_pronouns_subject",
    patterns: [
      /주격\s*관계대명사/i
    ]
  },
  {
    key: "relative_pronouns_object",
    patterns: [
      /목적격\s*관계대명사/i
    ]
  },
  {
    key: "passive_advanced",
    patterns: [
      /심화\s*수동태/i,
      /advanced\s*passive/i
    ]
  },
];



function isInvalidInternalCode(value = '') {
  const v = String(value).trim().toLowerCase();

  return (
    /^\d+(?:_\d+)+$/.test(v) ||
    /^\d+_[a-z]+_\d+_[a-z]+_\d+$/.test(v) ||
    /^\d+_[a-z]+_\d+$/.test(v)
  );
}

function normalizeSelectedGrade(value = "") {
  const grade = normalizeChapterKey(value);
  return /^(middle|high|elementary)\d+$/.test(grade) ? grade : "auto";
}

function detectGradeBucket(input = {}) {
  const rawBody = input.rawBody || {};
  const selectedGrade = normalizeSelectedGrade(input.selectedGrade || rawBody.selectedGrade || "auto");
  if (selectedGrade !== "auto") return selectedGrade;

  const merged = [
    input.grade || "",
    input.gradeLabel || "",
    input.level || "",
    input.userPrompt || "",
    input.topic || "",
    input.worksheetTitle || "",
    rawBody.profile || "",
    rawBody.grade || "",
    rawBody.gradeLabel || "",
    rawBody.level || "",
    rawBody.userPrompt || "",
    rawBody.topic || "",
  ].join("\n").toLowerCase();

  const explicitGrade = normalizeChapterKey(input.grade || input.gradeLabel || input.level || rawBody.grade || rawBody.gradeLabel || rawBody.level || "");
  if (SENTENCE_BANK_REGISTRY[explicitGrade]) return explicitGrade;

  const directMatch = merged.match(/\b(elementary|middle|high)\s*([1-9][0-9]?)\b/i);
  if (directMatch) {
    const bucket = `${directMatch[1].toLowerCase()}${directMatch[2]}`;
    if (SENTENCE_BANK_REGISTRY[bucket] || /^(elementary|middle|high)\d+$/.test(bucket)) return bucket;
  }

  const compactMatch = merged.match(/\b(elementary|middle|high)([1-9][0-9]?)\b/i);
  if (compactMatch) {
    const bucket = `${compactMatch[1].toLowerCase()}${compactMatch[2]}`;
    if (SENTENCE_BANK_REGISTRY[bucket] || /^(elementary|middle|high)\d+$/.test(bucket)) return bucket;
  }

  const shortMatch = merged.match(/\b([emh])\s*([1-9][0-9]?)\b/i);
  if (shortMatch) {
    const prefix = { e: "elementary", m: "middle", h: "high" }[shortMatch[1].toLowerCase()];
    const bucket = `${prefix}${shortMatch[2]}`;
    if (SENTENCE_BANK_REGISTRY[bucket] || /^(elementary|middle|high)\d+$/.test(bucket)) return bucket;
  }

  const gradeNumberMatch = merged.match(/\bgrade\s*([1-9][0-9]?)\b/i);
  if (gradeNumberMatch) {
    const number = Number(gradeNumberMatch[1]);
    const bucket = number <= 6 ? `elementary${number}` : number <= 9 ? `middle${number - 6}` : `high${number - 9}`;
    if (SENTENCE_BANK_REGISTRY[bucket] || /^(elementary|middle|high)\d+$/.test(bucket)) return bucket;
  }

  if (/(중\s*1|중1|중학교\s*1|middle\s*1|middle1|m1\b|grade\s*7)/i.test(merged)) return "middle1";
  if (/(중\s*2|중2|중학교\s*2|middle\s*2|middle2|m2\b|grade\s*8)/i.test(merged)) return "middle2";
  if (/(중\s*3|중3|중학교\s*3|middle\s*3|middle3|m3\b|grade\s*9)/i.test(merged)) return "middle3";
  if (/(고\s*1|고1|고등\s*1|high\s*1|high1|h1\b|grade\s*10)/i.test(merged)) return "high1";
  if (/(고\s*2|고2|고등\s*2|high\s*2|high2|h2\b|grade\s*11)/i.test(merged)) return "high2";
  if (/(고\s*3|고3|고등\s*3|high\s*3|high3|h3\b|grade\s*12)/i.test(merged)) return "high3";
  if (/(초\s*5|초5|elementary\s*5|elementary5|e5\b|grade\s*5)/i.test(merged)) return "elementary5";
  if (/(초\s*6|초6|elementary\s*6|elementary6|e6\b|grade\s*6)/i.test(merged)) return "elementary6";
  return "";
}

function stripGradeTokensForChapterLookup(value = "") {
  return normalizeChapterKey(value)
    .replace(/^(middle|high|elementary)_?\d+_?/, "")
    .replace(/^(m|h|e)_?\d+_?/, "")
    .replace(/^grade_?\d+_?/, "");
}

function resolveRegistryExactChapter(raw = "", input = {}) {
  const selectedGrade = normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto");
  const bucket = selectedGrade !== "auto"
    ? selectedGrade
    : detectGradeBucket({
      gradeLabel: raw,
      worksheetTitle: raw,
      topic: raw,
      userPrompt: raw,
      rawBody: input.rawBody || {},
    });
  if (!bucket) return "";

  const registry = SENTENCE_BANK_REGISTRY[bucket] || {};
  const aliasKey = normalizeChapterAliasIndexKey(raw);
  const exactAliasChapter = DB_REGISTRY?.aliases?.[bucket]?.[aliasKey];
  if (exactAliasChapter && registry[exactAliasChapter]) return exactAliasChapter;

  const aliasMatches = (DB_REGISTRY?.aliasList?.[bucket] || [])
    .filter((entry) => entry.aliasKey && aliasKey && aliasKey.includes(entry.aliasKey) && registry[entry.chapter])
    .sort((a, b) => b.aliasKey.length - a.aliasKey.length);
  if (aliasMatches.length) return aliasMatches[0].chapter;

  const candidates = [
    normalizeChapterKey(raw),
    stripGradeTokensForChapterLookup(raw),
  ].filter(Boolean);

  for (const chapter of [...new Set(candidates)]) {
    if (registry[chapter]) return chapter;
  }

  return "";
}

function isSafeLegacyPartialAlias(aliasKey = "") {
  const key = normalizeRoutingText(aliasKey);
  if (!key) return false;
  if (key.length < 4) return false;
  if (!/[\s_/,-]/.test(key) && key.length < 8) return false;
  return true;
}

function resolveChapterAlias(raw = '', input = {}) {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const specializedAlias = findSpecializedAlias(raw);
  if (specializedAlias) {
    console.log('[GRAMMAR DETECTED SPECIALIZED]', {
      rawInput: raw,
      matchedAlias: specializedAlias.alias,
      resolved: specializedAlias.chapter
    });

    return specializedAlias.chapter;
  }

  const aliasMap = {
    "중1 be동사 의문문": "be_question",
    "be동사 의문문": "be_question",
    "중2 수동태": "passive",
    "중3 의문사 to부정사 구문": "wh_to_infinitive",
    "의문사 to부정사 구문": "wh_to_infinitive",
    "중3 접속사 because": "because_because_of",
    "중3 after, before": "after_before",
    "after, before": "after_before",
    "중3 가주어 진주어": "it_that_expletive_subject",
    "가주어 진주어": "it_that_expletive_subject",
    "middle3 to infinitive noun adjective quality fix": "to_infinitive_noun_adjective_quality_fix",
    "middle3 to_infinitive_noun_adjective_quality_fix": "to_infinitive_noun_adjective_quality_fix",
    "중3 to infinitive noun adjective quality fix": "to_infinitive_noun_adjective_quality_fix",
    "중3 to_infinitive_noun_adjective_quality_fix": "to_infinitive_noun_adjective_quality_fix",
    "to infinitive noun adjective quality fix": "to_infinitive_noun_adjective_quality_fix",
    "to_infinitive_noun_adjective_quality_fix": "to_infinitive_noun_adjective_quality_fix",
    "to-infinitive-noun-adjective-quality-fix": "to_infinitive_noun_adjective_quality_fix",
    "middle2 the comparative the comparative": "the_comparative_the_comparative",
    "middle2 the_comparative_the_comparative": "the_comparative_the_comparative",
    "middle3 the comparative the comparative": "the_comparative_the_comparative",
    "middle3 the_comparative_the_comparative": "the_comparative_the_comparative",
    "middle3 continuative relative clauses": "continuative_relative_clauses",
    "middle3 continuative_relative_clauses": "continuative_relative_clauses",
    "middle2 possessive relative pronouns": "possessive_relative_pronouns",
    "middle2 possessive_relative_pronouns": "possessive_relative_pronouns",
    "middle3 comparative emphasis adverbs": "comparative_emphasis_adverbs",
    "middle3 comparative_emphasis_adverbs": "comparative_emphasis_adverbs",
    "middle3 gerund idiomatic expressions": "gerund_idiomatic_expressions",
    "middle3 gerund_idiomatic_expressions": "gerund_idiomatic_expressions",
    "middle3 possessive relative pronouns": "possessive_relative_pronouns",
    "middle3 possessive_relative_pronouns": "possessive_relative_pronouns",
    "middle3 to infinitive noun adjective": "to_infinitive_noun_adjective",
    "middle3 to_infinitive_noun_adjective": "to_infinitive_noun_adjective",
    "middle2 objective relative pronouns": "objective_relative_pronouns",
    "middle2 objective_relative_pronouns": "objective_relative_pronouns",
    "middle3 objective relative pronouns": "objective_relative_pronouns",
    "middle3 objective_relative_pronouns": "objective_relative_pronouns",
    "middle3 present perfect progressive": "present_perfect_progressive",
    "middle3 present_perfect_progressive": "present_perfect_progressive",
    "중2 the comparative the comparative": "the_comparative_the_comparative",
    "중2 the_comparative_the_comparative": "the_comparative_the_comparative",
    "중3 the comparative the comparative": "the_comparative_the_comparative",
    "중3 the_comparative_the_comparative": "the_comparative_the_comparative",
    "middle3 object complement 5th form": "object_complement_5th_form",
    "middle3 object_complement_5th_form": "object_complement_5th_form",
    "middle3 to infinitive gerund verbs": "to_infinitive_gerund_verbs",
    "middle3 to_infinitive_gerund_verbs": "to_infinitive_gerund_verbs",
    "middle2 subject relative pronouns": "subject_relative_pronouns",
    "middle2 subject_relative_pronouns": "subject_relative_pronouns",
    "middle3 it that expletive subject": "it_that_expletive_subject",
    "middle3 it_that_expletive_subject": "it_that_expletive_subject",
    "middle3 subject relative pronouns": "subject_relative_pronouns",
    "middle3 subject_relative_pronouns": "subject_relative_pronouns",
    "middle3 total vs partial negation": "total_vs_partial_negation",
    "middle3 total_vs_partial_negation": "total_vs_partial_negation",
    "중3 continuative relative clauses": "continuative_relative_clauses",
    "중3 continuative_relative_clauses": "continuative_relative_clauses",
    "middle3 causative verbs advanced": "causative_verbs_advanced",
    "middle3 causative_verbs_advanced": "causative_verbs_advanced",
    "middle3 it to infinitive subject": "it_to_infinitive_subject",
    "middle3 it_to_infinitive_subject": "it_to_infinitive_subject",
    "middle3 participial construction": "participial_construction",
    "middle3 participial_construction": "participial_construction",
    "middle3 so that purpose advanced": "so_that_purpose_advanced",
    "middle3 so_that_purpose_advanced": "so_that_purpose_advanced",
    "middle3 subjunctive past perfect": "subjunctive_past_perfect",
    "middle3 subjunctive_past_perfect": "subjunctive_past_perfect",
    "중2 possessive relative pronouns": "possessive_relative_pronouns",
    "중2 possessive_relative_pronouns": "possessive_relative_pronouns",
    "중3 comparative emphasis adverbs": "comparative_emphasis_adverbs",
    "중3 comparative_emphasis_adverbs": "comparative_emphasis_adverbs",
    "중3 gerund idiomatic expressions": "gerund_idiomatic_expressions",
    "중3 gerund_idiomatic_expressions": "gerund_idiomatic_expressions",
    "중3 possessive relative pronouns": "possessive_relative_pronouns",
    "중3 possessive_relative_pronouns": "possessive_relative_pronouns",
    "중3 to infinitive noun adjective": "to_infinitive_noun_adjective",
    "중3 to_infinitive_noun_adjective": "to_infinitive_noun_adjective",
    "middle2 to infinitive adjective": "to_infinitive_adjective",
    "middle2 to infinitive adverbial": "to_infinitive_adverbial",
    "middle2 to_infinitive_adjective": "to_infinitive_adjective",
    "middle2 to_infinitive_adverbial": "to_infinitive_adverbial",
    "middle3 participles attributive": "participles_attributive",
    "middle3 participles_attributive": "participles_attributive",
    "middle3 that clause subjunctive": "that_clause_subjunctive",
    "middle3 that_clause_subjunctive": "that_clause_subjunctive",
    "middle3 to infinitive adverbial": "to_infinitive_adverbial",
    "middle3 to_infinitive_adverbial": "to_infinitive_adverbial",
    "the comparative the comparative": "the_comparative_the_comparative",
    "the_comparative_the_comparative": "the_comparative_the_comparative",
    "the-comparative-the-comparative": "the_comparative_the_comparative",
    "중2 objective relative pronouns": "objective_relative_pronouns",
    "중2 objective_relative_pronouns": "objective_relative_pronouns",
    "중3 objective relative pronouns": "objective_relative_pronouns",
    "중3 objective_relative_pronouns": "objective_relative_pronouns",
    "중3 present perfect progressive": "present_perfect_progressive",
    "중3 present_perfect_progressive": "present_perfect_progressive",
    "middle3 with object participle": "with_object_participle",
    "middle3 with_object_participle": "with_object_participle",
    "중3 object complement 5th form": "object_complement_5th_form",
    "중3 object_complement_5th_form": "object_complement_5th_form",
    "중3 to infinitive gerund verbs": "to_infinitive_gerund_verbs",
    "중3 to_infinitive_gerund_verbs": "to_infinitive_gerund_verbs",
    "continuative relative clauses": "continuative_relative_clauses",
    "continuative_relative_clauses": "continuative_relative_clauses",
    "continuative-relative-clauses": "continuative_relative_clauses",
    "middle2 object complement adj": "object_complement_adj",
    "middle2 object_complement_adj": "object_complement_adj",
    "middle2 relative pronoun what": "relative_pronoun_what",
    "middle2 relative_pronoun_what": "relative_pronoun_what",
    "middle2 with noun phrase have": "with_noun_phrase_have",
    "middle2 with_noun_phrase_have": "with_noun_phrase_have",
    "middle3 after before advanced": "after_before_advanced",
    "middle3 after_before_advanced": "after_before_advanced",
    "middle3 quasi causative verbs": "quasi_causative_verbs",
    "middle3 quasi_causative_verbs": "quasi_causative_verbs",
    "middle3 relative pronoun what": "relative_pronoun_what",
    "middle3 relative_pronoun_what": "relative_pronoun_what",
    "middle3 that clause statement": "that_clause_statement",
    "middle3 that_clause_statement": "that_clause_statement",
    "중2 subject relative pronouns": "subject_relative_pronouns",
    "중2 subject_relative_pronouns": "subject_relative_pronouns",
    "중3 it that expletive subject": "it_that_expletive_subject",
    "중3 it_that_expletive_subject": "it_that_expletive_subject",
    "중3 subject relative pronouns": "subject_relative_pronouns",
    "중3 subject_relative_pronouns": "subject_relative_pronouns",
    "중3 total vs partial negation": "total_vs_partial_negation",
    "중3 total_vs_partial_negation": "total_vs_partial_negation",
    "comparative emphasis adverbs": "comparative_emphasis_adverbs",
    "comparative_emphasis_adverbs": "comparative_emphasis_adverbs",
    "comparative-emphasis-adverbs": "comparative_emphasis_adverbs",
    "gerund idiomatic expressions": "gerund_idiomatic_expressions",
    "gerund_idiomatic_expressions": "gerund_idiomatic_expressions",
    "gerund-idiomatic-expressions": "gerund_idiomatic_expressions",
    "middle2 comparative emphasis": "comparative_emphasis",
    "middle2 comparative_emphasis": "comparative_emphasis",
    "middle2 here there inversion": "here_there_inversion",
    "middle2 here_there_inversion": "here_there_inversion",
    "middle3 inversion so neither": "inversion_so_neither",
    "middle3 inversion_so_neither": "inversion_so_neither",
    "middle3 it object infinitive": "it_object_infinitive",
    "middle3 it_object_infinitive": "it_object_infinitive",
    "middle3 its time subjunctive": "its_time_subjunctive",
    "middle3 its_time_subjunctive": "its_time_subjunctive",
    "possessive relative pronouns": "possessive_relative_pronouns",
    "possessive_relative_pronouns": "possessive_relative_pronouns",
    "possessive-relative-pronouns": "possessive_relative_pronouns",
    "to infinitive noun adjective": "to_infinitive_noun_adjective",
    "to_infinitive_noun_adjective": "to_infinitive_noun_adjective",
    "to-infinitive-noun-adjective": "to_infinitive_noun_adjective",
    "중3 causative verbs advanced": "causative_verbs_advanced",
    "중3 causative_verbs_advanced": "causative_verbs_advanced",
    "중3 it to infinitive subject": "it_to_infinitive_subject",
    "중3 it_to_infinitive_subject": "it_to_infinitive_subject",
    "중3 participial construction": "participial_construction",
    "중3 participial_construction": "participial_construction",
    "중3 so that purpose advanced": "so_that_purpose_advanced",
    "중3 so_that_purpose_advanced": "so_that_purpose_advanced",
    "중3 subjunctive past perfect": "subjunctive_past_perfect",
    "중3 subjunctive_past_perfect": "subjunctive_past_perfect",
    "have object past participle": "have_object_pp",
    "middle1 to infinitive total": "to_infinitive_total",
    "middle1 to_infinitive_total": "to_infinitive_total",
    "middle2 indefinite pronouns": "indefinite_pronouns",
    "middle2 indefinite_pronouns": "indefinite_pronouns",
    "middle2 quantity adjectives": "quantity_adjectives",
    "middle2 quantity_adjectives": "quantity_adjectives",
    "middle2 something adjective": "something_adjective",
    "middle2 something_adjective": "something_adjective",
    "middle2 with noun phrase be": "with_noun_phrase_be",
    "middle2 with_noun_phrase_be": "with_noun_phrase_be",
    "middle3 indefinite pronouns": "indefinite_pronouns",
    "middle3 indefinite_pronouns": "indefinite_pronouns",
    "objective relative pronouns": "objective_relative_pronouns",
    "objective_relative_pronouns": "objective_relative_pronouns",
    "objective-relative-pronouns": "objective_relative_pronouns",
    "present perfect progressive": "present_perfect_progressive",
    "present_perfect_progressive": "present_perfect_progressive",
    "present-perfect-progressive": "present_perfect_progressive",
    "중2 to infinitive adjective": "to_infinitive_adjective",
    "중2 to infinitive adverbial": "to_infinitive_adverbial",
    "중2 to_infinitive_adjective": "to_infinitive_adjective",
    "중2 to_infinitive_adverbial": "to_infinitive_adverbial",
    "중3 participles attributive": "participles_attributive",
    "중3 participles_attributive": "participles_attributive",
    "중3 that clause subjunctive": "that_clause_subjunctive",
    "중3 that_clause_subjunctive": "that_clause_subjunctive",
    "중3 to infinitive adverbial": "to_infinitive_adverbial",
    "중3 to_infinitive_adverbial": "to_infinitive_adverbial",
    "middle1 prepositions basic": "prepositions_basic",
    "middle1 prepositions_basic": "prepositions_basic",
    "middle1 present continuous": "present_continuous",
    "middle1 present_continuous": "present_continuous",
    "middle1 to infinitive noun": "to_infinitive_noun",
    "middle1 to_infinitive_noun": "to_infinitive_noun",
    "middle2 quantity agreement": "quantity_agreement",
    "middle2 quantity_agreement": "quantity_agreement",
    "middle2 reflexive pronouns": "reflexive_pronouns",
    "middle2 reflexive_pronouns": "reflexive_pronouns",
    "middle3 because because of": "because_because_of",
    "middle3 because_because_of": "because_because_of",
    "object complement 5th form": "object_complement_5th_form",
    "object_complement_5th_form": "object_complement_5th_form",
    "object-complement-5th-form": "object_complement_5th_form",
    "to infinitive gerund verbs": "to_infinitive_gerund_verbs",
    "to_infinitive_gerund_verbs": "to_infinitive_gerund_verbs",
    "to-infinitive-gerund-verbs": "to_infinitive_gerund_verbs",
    "중3 with object participle": "with_object_participle",
    "중3 with_object_participle": "with_object_participle",
    "it that expletive subject": "it_that_expletive_subject",
    "it_that_expletive_subject": "it_that_expletive_subject",
    "it-that-expletive-subject": "it_that_expletive_subject",
    "middle1 conjunction while": "conjunction_while",
    "middle1 conjunction_while": "conjunction_while",
    "middle1 frequency adverbs": "frequency_adverbs",
    "middle1 frequency_adverbs": "frequency_adverbs",
    "middle1 reflexive pronoun": "reflexive_pronoun",
    "middle1 reflexive_pronoun": "reflexive_pronoun",
    "middle2 frequency adverbs": "frequency_adverbs",
    "middle2 frequency_adverbs": "frequency_adverbs",
    "middle2 indirect question": "indirect_question",
    "middle2 indirect_question": "indirect_question",
    "middle2 not only but also": "not_only_but_also",
    "middle2 not_only_but_also": "not_only_but_also",
    "middle3 however therefore": "however_therefore",
    "middle3 however_therefore": "however_therefore",
    "middle3 indirect question": "indirect_question",
    "middle3 indirect_question": "indirect_question",
    "middle3 not only but also": "not_only_but_also",
    "middle3 not to infinitive": "not_to_infinitive",
    "middle3 not_only_but_also": "not_only_but_also",
    "middle3 not_to_infinitive": "not_to_infinitive",
    "middle3 time conjunctions": "time_conjunctions",
    "middle3 time_conjunctions": "time_conjunctions",
    "subject relative pronouns": "subject_relative_pronouns",
    "subject_relative_pronouns": "subject_relative_pronouns",
    "subject-relative-pronouns": "subject_relative_pronouns",
    "total vs partial negation": "total_vs_partial_negation",
    "total_vs_partial_negation": "total_vs_partial_negation",
    "total-vs-partial-negation": "total_vs_partial_negation",
    "중2 object complement adj": "object_complement_adj",
    "중2 object_complement_adj": "object_complement_adj",
    "중2 relative pronoun what": "relative_pronoun_what",
    "중2 relative_pronoun_what": "relative_pronoun_what",
    "중2 with noun phrase have": "with_noun_phrase_have",
    "중2 with_noun_phrase_have": "with_noun_phrase_have",
    "중3 after before advanced": "after_before_advanced",
    "중3 after_before_advanced": "after_before_advanced",
    "중3 quasi causative verbs": "quasi_causative_verbs",
    "중3 quasi_causative_verbs": "quasi_causative_verbs",
    "중3 relative pronoun what": "relative_pronoun_what",
    "중3 relative_pronoun_what": "relative_pronoun_what",
    "중3 that clause statement": "that_clause_statement",
    "중3 that_clause_statement": "that_clause_statement",
    "causative verbs advanced": "causative_verbs_advanced",
    "causative_verbs_advanced": "causative_verbs_advanced",
    "causative-verbs-advanced": "causative_verbs_advanced",
    "it to infinitive subject": "it_to_infinitive_subject",
    "it_to_infinitive_subject": "it_to_infinitive_subject",
    "it-to-infinitive-subject": "it_to_infinitive_subject",
    "middle1 conjunction that": "conjunction_that",
    "middle1 conjunction when": "conjunction_when",
    "middle1 conjunction_that": "conjunction_that",
    "middle1 conjunction_when": "conjunction_when",
    "middle1 passive advanced": "passive_advanced",
    "middle1 passive_advanced": "passive_advanced",
    "middle2 perception verbs": "perception_verbs",
    "middle2 perception_verbs": "perception_verbs",
    "middle2 relative adverbs": "relative_adverbs",
    "middle2 relative_adverbs": "relative_adverbs",
    "middle2 subjunctive past": "subjunctive_past",
    "middle2 subjunctive_past": "subjunctive_past",
    "middle2 too to enough to": "too_to_enough_to",
    "middle2 too_to_enough_to": "too_to_enough_to",
    "middle2 wh to infinitive": "wh_to_infinitive",
    "middle2 wh_to_infinitive": "wh_to_infinitive",
    "middle3 perceptual verbs": "perceptual_verbs",
    "middle3 perceptual_verbs": "perceptual_verbs",
    "middle3 relative adverbs": "relative_adverbs",
    "middle3 relative_adverbs": "relative_adverbs",
    "middle3 subjunctive past": "subjunctive_past",
    "middle3 subjunctive_past": "subjunctive_past",
    "middle3 sva of structure": "sva_of_structure",
    "middle3 sva_of_structure": "sva_of_structure",
    "middle3 wh to infinitive": "wh_to_infinitive",
    "middle3 wh_to_infinitive": "wh_to_infinitive",
    "middle3 wish subjunctive": "wish_subjunctive",
    "middle3 wish_subjunctive": "wish_subjunctive",
    "participial construction": "participial_construction",
    "participial_construction": "participial_construction",
    "participial-construction": "participial_construction",
    "so that purpose advanced": "so_that_purpose_advanced",
    "so_that_purpose_advanced": "so_that_purpose_advanced",
    "so-that-purpose-advanced": "so_that_purpose_advanced",
    "subjunctive past perfect": "subjunctive_past_perfect",
    "subjunctive_past_perfect": "subjunctive_past_perfect",
    "subjunctive-past-perfect": "subjunctive_past_perfect",
    "to infinitive subjective": "to_infinitive_subjective",
    "to_infinitive_subjective": "to_infinitive_subjective",
    "to-infinitive-subjective": "to_infinitive_subjective",
    "중2 comparative emphasis": "comparative_emphasis",
    "중2 comparative_emphasis": "comparative_emphasis",
    "중2 here there inversion": "here_there_inversion",
    "중2 here_there_inversion": "here_there_inversion",
    "중3 inversion so neither": "inversion_so_neither",
    "중3 inversion_so_neither": "inversion_so_neither",
    "중3 it object infinitive": "it_object_infinitive",
    "중3 it_object_infinitive": "it_object_infinitive",
    "중3 its time subjunctive": "its_time_subjunctive",
    "중3 its_time_subjunctive": "its_time_subjunctive",
    "middle1 a little little": "a_little_little",
    "middle1 a_little_little": "a_little_little",
    "middle2 causative verbs": "causative_verbs",
    "middle2 causative_verbs": "causative_verbs",
    "middle2 present perfect": "present_perfect",
    "middle2 present_perfect": "present_perfect",
    "middle2 quasi causative": "quasi_causative",
    "middle2 quasi_causative": "quasi_causative",
    "middle2 so that purpose": "so_that_purpose",
    "middle2 so_that_purpose": "so_that_purpose",
    "middle2 tense agreement": "tense_agreement",
    "middle2 tense_agreement": "tense_agreement",
    "middle3 causative verbs": "causative_verbs",
    "middle3 causative_verbs": "causative_verbs",
    "middle3 present perfect": "present_perfect",
    "middle3 present_perfect": "present_perfect",
    "middle3 reported speech": "reported_speech",
    "middle3 reported_speech": "reported_speech",
    "middle3 so that purpose": "so_that_purpose",
    "middle3 so_that_purpose": "so_that_purpose",
    "participles attributive": "participles_attributive",
    "participles_attributive": "participles_attributive",
    "participles-attributive": "participles_attributive",
    "that clause subjunctive": "that_clause_subjunctive",
    "that_clause_subjunctive": "that_clause_subjunctive",
    "that-clause-subjunctive": "that_clause_subjunctive",
    "to infinitive adjective": "to_infinitive_adjective",
    "to infinitive adverbial": "to_infinitive_adverbial",
    "to_infinitive_adjective": "to_infinitive_adjective",
    "to_infinitive_adverbial": "to_infinitive_adverbial",
    "to-infinitive-adjective": "to_infinitive_adjective",
    "to-infinitive-adverbial": "to_infinitive_adverbial",
    "중1 to infinitive total": "to_infinitive_total",
    "중1 to_infinitive_total": "to_infinitive_total",
    "중2 indefinite pronouns": "indefinite_pronouns",
    "중2 indefinite_pronouns": "indefinite_pronouns",
    "중2 quantity adjectives": "quantity_adjectives",
    "중2 quantity_adjectives": "quantity_adjectives",
    "중2 something adjective": "something_adjective",
    "중2 something_adjective": "something_adjective",
    "중2 with noun phrase be": "with_noun_phrase_be",
    "중2 with_noun_phrase_be": "with_noun_phrase_be",
    "중3 indefinite pronouns": "indefinite_pronouns",
    "중3 indefinite_pronouns": "indefinite_pronouns",
    "after, before advanced": "after_before_advanced",
    "middle1 semi causative": "semi_causative",
    "middle1 semi_causative": "semi_causative",
    "middle2 as conjunction": "as_conjunction",
    "middle2 as_conjunction": "as_conjunction",
    "middle2 modal extended": "modal_extended",
    "middle2 modal_extended": "modal_extended",
    "middle3 have object pp": "have_object_pp",
    "middle3 have_object_pp": "have_object_pp",
    "middle3 should have pp": "should_have_pp",
    "middle3 should_have_pp": "should_have_pp",
    "with object participle": "with_object_participle",
    "with_object_participle": "with_object_participle",
    "with-object-participle": "with_object_participle",
    "수량형용사 a little little": "a_little_little",
    "중1 prepositions basic": "prepositions_basic",
    "중1 prepositions_basic": "prepositions_basic",
    "중1 present continuous": "present_continuous",
    "중1 present_continuous": "present_continuous",
    "중1 to infinitive noun": "to_infinitive_noun",
    "중1 to_infinitive_noun": "to_infinitive_noun",
    "중2 quantity agreement": "quantity_agreement",
    "중2 quantity_agreement": "quantity_agreement",
    "중2 reflexive pronouns": "reflexive_pronouns",
    "중2 reflexive_pronouns": "reflexive_pronouns",
    "중3 because because of": "because_because_of",
    "중3 because_because_of": "because_because_of",
    "after before advanced": "after_before_advanced",
    "after_before_advanced": "after_before_advanced",
    "after-before-advanced": "after_before_advanced",
    "it's time subjunctive": "its_time_subjunctive",
    "middle1 gerund object": "gerund_object",
    "middle1 gerund_object": "gerund_object",
    "middle2 tag questions": "tag_questions",
    "middle2 tag_questions": "tag_questions",
    "middle3 cleft it that": "cleft_it_that",
    "middle3 cleft_it_that": "cleft_it_that",
    "middle3 it seems that": "it_seems_that",
    "middle3 it_seems_that": "it_seems_that",
    "middle3 modal have pp": "modal_have_pp",
    "middle3 modal passive": "modal_passive",
    "middle3 modal_have_pp": "modal_have_pp",
    "middle3 modal_passive": "modal_passive",
    "middle3 too enough to": "too_enough_to",
    "middle3 too_enough_to": "too_enough_to",
    "not only a but also b": "not_only_but_also",
    "object complement adj": "object_complement_adj",
    "object_complement_adj": "object_complement_adj",
    "object-complement-adj": "object_complement_adj",
    "quasi causative verbs": "quasi_causative_verbs",
    "quasi_causative_verbs": "quasi_causative_verbs",
    "quasi-causative-verbs": "quasi_causative_verbs",
    "relative pronoun what": "relative_pronoun_what",
    "relative_pronoun_what": "relative_pronoun_what",
    "relative-pronoun-what": "relative_pronoun_what",
    "something + adjective": "something_adjective",
    "that clause statement": "that_clause_statement",
    "that_clause_statement": "that_clause_statement",
    "that-clause-statement": "that_clause_statement",
    "with noun phrase have": "with_noun_phrase_have",
    "with_noun_phrase_have": "with_noun_phrase_have",
    "with-noun-phrase-have": "with_noun_phrase_have",
    "중1 conjunction while": "conjunction_while",
    "중1 conjunction_while": "conjunction_while",
    "중1 frequency adverbs": "frequency_adverbs",
    "중1 frequency_adverbs": "frequency_adverbs",
    "중1 reflexive pronoun": "reflexive_pronoun",
    "중1 reflexive_pronoun": "reflexive_pronoun",
    "중2 frequency adverbs": "frequency_adverbs",
    "중2 frequency_adverbs": "frequency_adverbs",
    "중2 indirect question": "indirect_question",
    "중2 indirect_question": "indirect_question",
    "중2 not only but also": "not_only_but_also",
    "중2 not_only_but_also": "not_only_but_also",
    "중3 however therefore": "however_therefore",
    "중3 however_therefore": "however_therefore",
    "중3 indirect question": "indirect_question",
    "중3 indirect_question": "indirect_question",
    "중3 not only but also": "not_only_but_also",
    "중3 not to infinitive": "not_to_infinitive",
    "중3 not_only_but_also": "not_only_but_also",
    "중3 not_to_infinitive": "not_to_infinitive",
    "중3 time conjunctions": "time_conjunctions",
    "중3 time_conjunctions": "time_conjunctions",
    "comparative emphasis": "comparative_emphasis",
    "comparative_emphasis": "comparative_emphasis",
    "comparative-emphasis": "comparative_emphasis",
    "here there inversion": "here_there_inversion",
    "here_there_inversion": "here_there_inversion",
    "here-there-inversion": "here_there_inversion",
    "inversion so neither": "inversion_so_neither",
    "inversion_so_neither": "inversion_so_neither",
    "inversion-so-neither": "inversion_so_neither",
    "it object infinitive": "it_object_infinitive",
    "it_object_infinitive": "it_object_infinitive",
    "it-object-infinitive": "it_object_infinitive",
    "its time subjunctive": "its_time_subjunctive",
    "its_time_subjunctive": "its_time_subjunctive",
    "its-time-subjunctive": "its_time_subjunctive",
    "middle1 after before": "after_before",
    "middle1 after_before": "after_before",
    "middle1 comparatives": "comparatives",
    "middle1 gerund total": "gerund_total",
    "middle1 gerund_total": "gerund_total",
    "middle1 perception verb": "perception_verb",
    "middle1 perception_verb": "perception_verb",
    "middle1 sensory verb": "sensory_verb",
    "middle1 sensory_verb": "sensory_verb",
    "middle1 superlatives": "superlatives",
    "middle1 there is are": "there_is_are",
    "middle1 there_is_are": "there_is_are",
    "middle2 after before": "after_before",
    "middle2 after_before": "after_before",
    "middle2 ditransitive": "ditransitive",
    "middle2 dont have to": "dont_have_to",
    "middle2 dont_have_to": "dont_have_to",
    "middle2 if condition": "if_condition",
    "middle2 if_condition": "if_condition",
    "middle2 sensory verb": "sensory_verb",
    "middle2 sensory_verb": "sensory_verb",
    "middle2 wh questions": "wh_questions",
    "middle2 wh_questions": "wh_questions",
    "middle3 after before": "after_before",
    "middle3 after_before": "after_before",
    "middle3 past perfect": "past_perfect",
    "middle3 past_perfect": "past_perfect",
    "not only but also 구문": "not_only_but_also",
    "시간 접속사 after before": "after_before",
    "중1 conjunction that": "conjunction_that",
    "중1 conjunction when": "conjunction_when",
    "중1 conjunction_that": "conjunction_that",
    "중1 conjunction_when": "conjunction_when",
    "중1 passive advanced": "passive_advanced",
    "중1 passive_advanced": "passive_advanced",
    "중2 perception verbs": "perception_verbs",
    "중2 perception_verbs": "perception_verbs",
    "중2 relative adverbs": "relative_adverbs",
    "중2 relative_adverbs": "relative_adverbs",
    "중2 subjunctive past": "subjunctive_past",
    "중2 subjunctive_past": "subjunctive_past",
    "중2 too to enough to": "too_to_enough_to",
    "중2 too_to_enough_to": "too_to_enough_to",
    "중2 wh to infinitive": "wh_to_infinitive",
    "중2 wh_to_infinitive": "wh_to_infinitive",
    "중3 perceptual verbs": "perceptual_verbs",
    "중3 perceptual_verbs": "perceptual_verbs",
    "중3 relative adverbs": "relative_adverbs",
    "중3 relative_adverbs": "relative_adverbs",
    "중3 subjunctive past": "subjunctive_past",
    "중3 subjunctive_past": "subjunctive_past",
    "중3 sva of structure": "sva_of_structure",
    "중3 sva_of_structure": "sva_of_structure",
    "중3 wh to infinitive": "wh_to_infinitive",
    "중3 wh_to_infinitive": "wh_to_infinitive",
    "중3 wish subjunctive": "wish_subjunctive",
    "중3 wish_subjunctive": "wish_subjunctive",
    "because, because of": "because_because_of",
    "because와 because of": "because_because_of",
    "indefinite pronouns": "indefinite_pronouns",
    "indefinite_pronouns": "indefinite_pronouns",
    "indefinite-pronouns": "indefinite_pronouns",
    "middle1 be negative": "be_negative",
    "middle1 be question": "be_question",
    "middle1 be_negative": "be_negative",
    "middle1 be_question": "be_question",
    "middle1 do negative": "do_negative",
    "middle1 do question": "do_question",
    "middle1 do_negative": "do_negative",
    "middle1 do_question": "do_question",
    "middle1 exclamation": "exclamation",
    "middle1 imperatives": "imperatives",
    "middle1 quantifiers": "quantifiers",
    "middle1 wh question": "wh_question",
    "middle1 wh_question": "wh_question",
    "middle2 comparative": "comparative",
    "middle2 do emphasis": "do_emphasis",
    "middle2 do_emphasis": "do_emphasis",
    "middle2 imperatives": "imperatives",
    "middle2 participles": "participles",
    "middle2 superlative": "superlative",
    "middle3 comparative": "comparative",
    "middle3 do emphasis": "do_emphasis",
    "middle3 do_emphasis": "do_emphasis",
    "middle3 superlative": "superlative",
    "quantity adjectives": "quantity_adjectives",
    "quantity_adjectives": "quantity_adjectives",
    "quantity-adjectives": "quantity_adjectives",
    "something adjective": "something_adjective",
    "something_adjective": "something_adjective",
    "something-adjective": "something_adjective",
    "to infinitive total": "to_infinitive_total",
    "to_infinitive_total": "to_infinitive_total",
    "to-infinitive-total": "to_infinitive_total",
    "with noun phrase be": "with_noun_phrase_be",
    "with_noun_phrase_be": "with_noun_phrase_be",
    "with-noun-phrase-be": "with_noun_phrase_be",
    "시간접속사 after before": "after_before",
    "중1 a little little": "a_little_little",
    "중1 a_little_little": "a_little_little",
    "중2 causative verbs": "causative_verbs",
    "중2 causative_verbs": "causative_verbs",
    "중2 present perfect": "present_perfect",
    "중2 present_perfect": "present_perfect",
    "중2 quasi causative": "quasi_causative",
    "중2 quasi_causative": "quasi_causative",
    "중2 so that purpose": "so_that_purpose",
    "중2 so_that_purpose": "so_that_purpose",
    "중2 tense agreement": "tense_agreement",
    "중2 tense_agreement": "tense_agreement",
    "중3 causative verbs": "causative_verbs",
    "중3 causative_verbs": "causative_verbs",
    "중3 present perfect": "present_perfect",
    "중3 present_perfect": "present_perfect",
    "중3 reported speech": "reported_speech",
    "중3 reported_speech": "reported_speech",
    "중3 so that purpose": "so_that_purpose",
    "중3 so_that_purpose": "so_that_purpose",
    "because because of": "because_because_of",
    "because_because_of": "because_because_of",
    "because-because-of": "because_because_of",
    "because/because of": "because_because_of",
    "however, therefore": "however_therefore",
    "middle1 modal will": "will",
    "middle1 will": "will",
    "middle2 because of": "because_of",
    "middle2 because_of": "because_of",
    "middle2 had better": "had_better",
    "middle2 had_better": "had_better",
    "middle2 while when": "while_when",
    "middle2 while_when": "while_when",
    "middle3 if whether": "if_whether",
    "middle3 if_whether": "if_whether",
    "middle3 while when": "while_when",
    "middle3 while_when": "while_when",
    "prepositions basic": "prepositions_basic",
    "prepositions_basic": "prepositions_basic",
    "prepositions-basic": "prepositions_basic",
    "present continuous": "present_continuous",
    "present_continuous": "present_continuous",
    "present-continuous": "present_continuous",
    "quantity agreement": "quantity_agreement",
    "quantity_agreement": "quantity_agreement",
    "quantity-agreement": "quantity_agreement",
    "reflexive pronouns": "reflexive_pronouns",
    "reflexive_pronouns": "reflexive_pronouns",
    "reflexive-pronouns": "reflexive_pronouns",
    "to infinitive noun": "to_infinitive_noun",
    "to_infinitive_noun": "to_infinitive_noun",
    "to-infinitive-noun": "to_infinitive_noun",
    "접속사 after, before": "after_before",
    "중1 semi causative": "semi_causative",
    "중1 semi_causative": "semi_causative",
    "중2 as conjunction": "as_conjunction",
    "중2 as_conjunction": "as_conjunction",
    "중2 modal extended": "modal_extended",
    "중2 modal_extended": "modal_extended",
    "중3 have object pp": "have_object_pp",
    "중3 have_object_pp": "have_object_pp",
    "중3 should have pp": "should_have_pp",
    "중3 should_have_pp": "should_have_pp",
    "a little / little": "a_little_little",
    "conjunction while": "conjunction_while",
    "conjunction_while": "conjunction_while",
    "conjunction-while": "conjunction_while",
    "frequency adverbs": "frequency_adverbs",
    "frequency_adverbs": "frequency_adverbs",
    "frequency-adverbs": "frequency_adverbs",
    "however therefore": "however_therefore",
    "however_therefore": "however_therefore",
    "however-therefore": "however_therefore",
    "however/therefore": "however_therefore",
    "indirect question": "indirect_question",
    "indirect_question": "indirect_question",
    "indirect-question": "indirect_question",
    "middle1 a few few": "a_few_few",
    "middle1 a_few_few": "a_few_few",
    "middle1 causative": "causative",
    "middle1 five form": "five_form",
    "middle1 five_form": "five_form",
    "middle1 many much": "many_much",
    "middle1 many_much": "many_much",
    "not only but also": "not_only_but_also",
    "not to infinitive": "not_to_infinitive",
    "not_only_but_also": "not_only_but_also",
    "not_to_infinitive": "not_to_infinitive",
    "not-only-but-also": "not_only_but_also",
    "not-to-infinitive": "not_to_infinitive",
    "reflexive pronoun": "reflexive_pronoun",
    "reflexive_pronoun": "reflexive_pronoun",
    "reflexive-pronoun": "reflexive_pronoun",
    "should have pp 구문": "should_have_pp",
    "time conjunctions": "time_conjunctions",
    "time_conjunctions": "time_conjunctions",
    "time-conjunctions": "time_conjunctions",
    "to부정사 명사적 형용사적 용법": "to_infinitive_noun_adjective",
    "간접의문문 if whether": "if_whether",
    "접속사 after before": "after_before",
    "중1 gerund object": "gerund_object",
    "중1 gerund_object": "gerund_object",
    "중2 tag questions": "tag_questions",
    "중2 tag_questions": "tag_questions",
    "중3 cleft it that": "cleft_it_that",
    "중3 cleft_it_that": "cleft_it_that",
    "중3 it seems that": "it_seems_that",
    "중3 it_seems_that": "it_seems_that",
    "중3 modal have pp": "modal_have_pp",
    "중3 modal passive": "modal_passive",
    "중3 modal_have_pp": "modal_have_pp",
    "중3 modal_passive": "modal_passive",
    "중3 too enough to": "too_enough_to",
    "중3 too_enough_to": "too_enough_to",
    "a little와 little": "a_little_little",
    "after, before 심화": "after_before_advanced",
    "be verb negative": "be_negative",
    "be verb question": "be_question",
    "conjunction that": "conjunction_that",
    "conjunction when": "conjunction_when",
    "conjunction_that": "conjunction_that",
    "conjunction_when": "conjunction_when",
    "conjunction-that": "conjunction_that",
    "conjunction-when": "conjunction_when",
    "don't have to 구문": "dont_have_to",
    "it seems that 구문": "it_seems_that",
    "it seems that 문장": "it_seems_that",
    "middle2 although": "although",
    "passive advanced": "passive_advanced",
    "passive_advanced": "passive_advanced",
    "passive-advanced": "passive_advanced",
    "perception verbs": "perception_verbs",
    "perception_verbs": "perception_verbs",
    "perception-verbs": "perception_verbs",
    "perceptual verbs": "perceptual_verbs",
    "perceptual_verbs": "perceptual_verbs",
    "perceptual-verbs": "perceptual_verbs",
    "relative adverbs": "relative_adverbs",
    "relative_adverbs": "relative_adverbs",
    "relative-adverbs": "relative_adverbs",
    "should have p.p.": "should_have_pp",
    "subjunctive past": "subjunctive_past",
    "subjunctive_past": "subjunctive_past",
    "subjunctive-past": "subjunctive_past",
    "sva of structure": "sva_of_structure",
    "sva_of_structure": "sva_of_structure",
    "sva-of-structure": "sva_of_structure",
    "the 비교급, the 비교급": "the_comparative_the_comparative",
    "too to enough to": "too_to_enough_to",
    "too_to_enough_to": "too_to_enough_to",
    "too-to-enough-to": "too_to_enough_to",
    "too~to enough to": "too_to_enough_to",
    "wh to infinitive": "wh_to_infinitive",
    "wh_to_infinitive": "wh_to_infinitive",
    "wh-to-infinitive": "wh_to_infinitive",
    "wish subjunctive": "wish_subjunctive",
    "wish_subjunctive": "wish_subjunctive",
    "wish-subjunctive": "wish_subjunctive",
    "수량형용사 a few few": "a_few_few",
    "중1 after before": "after_before",
    "중1 after_before": "after_before",
    "중1 comparatives": "comparatives",
    "중1 gerund total": "gerund_total",
    "중1 gerund_total": "gerund_total",
    "중1 perception verb": "perception_verb",
    "중1 perception_verb": "perception_verb",
    "중1 superlatives": "superlatives",
    "중1 there is are": "there_is_are",
    "중1 there_is_are": "there_is_are",
    "중2 after before": "after_before",
    "중2 after_before": "after_before",
    "중2 ditransitive": "ditransitive",
    "중2 dont have to": "dont_have_to",
    "중2 dont_have_to": "dont_have_to",
    "중2 if condition": "if_condition",
    "중2 if_condition": "if_condition",
    "\uC9112 sensory verb": "sensory_verb",
    "\uC9112 sensory_verb": "sensory_verb",
    "중2 wh questions": "wh_questions",
    "중2 wh_questions": "wh_questions",
    "중3 after before": "after_before",
    "중3 after_before": "after_before",
    "중3 past perfect": "past_perfect",
    "중3 past_perfect": "past_perfect",
    "a little little": "a_little_little",
    "a_little_little": "a_little_little",
    "a-little-little": "a_little_little",
    "after before 심화": "after_before_advanced",
    "causative verbs": "causative_verbs",
    "causative_verbs": "causative_verbs",
    "causative-verbs": "causative_verbs",
    "little a little": "a_little_little",
    "middle1 be verb": "be_verb",
    "middle1 be_verb": "be_verb",
    "middle1 because": "because",
    "middle1 do verb": "do_verb",
    "middle1 do_verb": "do_verb",
    "middle1 have to": "have_to",
    "middle1 have_to": "have_to",
    "middle1 passive": "passive",
    "middle2 because": "because",
    "middle2 passive": "passive",
    "middle2 so that": "so_that",
    "middle2 so_that": "so_that",
    "middle2 used to": "used_to",
    "middle2 used_to": "used_to",
    "middle3 so that": "so_that",
    "middle3 so_that": "so_that",
    "modal have p.p.": "modal_have_pp",
    "present perfect": "present_perfect",
    "present_perfect": "present_perfect",
    "present-perfect": "present_perfect",
    "quasi causative": "quasi_causative",
    "quasi_causative": "quasi_causative",
    "quasi-causative": "quasi_causative",
    "reported speech": "reported_speech",
    "reported_speech": "reported_speech",
    "reported-speech": "reported_speech",
    "so that purpose": "so_that_purpose",
    "so_that_purpose": "so_that_purpose",
    "so-that-purpose": "so_that_purpose",
    "tense agreement": "tense_agreement",
    "tense_agreement": "tense_agreement",
    "tense-agreement": "tense_agreement",
    "the 비교급 the 비교급": "the_comparative_the_comparative",
    "to부정사 명사 형용사 보정": "to_infinitive_noun_adjective_quality_fix",
    "전치사 because of": "because_of",
    "접속사 while when": "while_when",
    "중1 be negative": "be_negative",
    "중1 be question": "be_question",
    "중1 be_negative": "be_negative",
    "중1 be_question": "be_question",
    "중1 do negative": "do_negative",
    "중1 do question": "do_question",
    "중1 do_negative": "do_negative",
    "중1 do_question": "do_question",
    "중1 exclamation": "exclamation",
    "중1 imperatives": "imperatives",
    "중1 quantifiers": "quantifiers",
    "중1 wh question": "wh_question",
    "중1 wh_question": "wh_question",
    "중2 comparative": "comparative",
    "중2 do emphasis": "do_emphasis",
    "중2 do_emphasis": "do_emphasis",
    "중2 imperatives": "imperatives",
    "중2 participles": "participles",
    "중2 superlative": "superlative",
    "중3 comparative": "comparative",
    "중3 do emphasis": "do_emphasis",
    "중3 do_emphasis": "do_emphasis",
    "중3 superlative": "superlative",
    "as conjunction": "as_conjunction",
    "as_conjunction": "as_conjunction",
    "as-conjunction": "as_conjunction",
    "do not have to": "dont_have_to",
    "have object pp": "have_object_pp",
    "have_object_pp": "have_object_pp",
    "have-object-pp": "have_object_pp",
    "it is time 가정법": "its_time_subjunctive",
    "middle1 should": "should",
    "middle2 gerund": "gerund",
    "modal extended": "modal_extended",
    "modal_extended": "modal_extended",
    "modal-extended": "modal_extended",
    "semi causative": "semi_causative",
    "semi_causative": "semi_causative",
    "semi-causative": "semi_causative",
    "should have pp": "should_have_pp",
    "should_have_pp": "should_have_pp",
    "should-have-pp": "should_have_pp",
    "to 부정사 형용사적 용법": "to_infinitive_adjective",
    "with object pp": "with_object_participle",
    "과거 습관 used to": "used_to",
    "도치 here there": "here_there_inversion",
    "조동사 have p.p.": "modal_have_pp",
    "중1 modal will": "will",
    "중1 will": "will",
    "중2 because of": "because_of",
    "중2 because_of": "because_of",
    "중2 had better": "had_better",
    "중2 had_better": "had_better",
    "중2 while when": "while_when",
    "중2 while_when": "while_when",
    "중3 if whether": "if_whether",
    "중3 if_whether": "if_whether",
    "중3 while when": "while_when",
    "중3 while_when": "while_when",
    "after와 before": "after_before",
    "because of 구문": "because_of",
    "cleft it that": "cleft_it_that",
    "cleft_it_that": "cleft_it_that",
    "cleft-it-that": "cleft_it_that",
    "don't have to": "dont_have_to",
    "gerund object": "gerund_object",
    "gerund_object": "gerund_object",
    "gerund-object": "gerund_object",
    "had better 구문": "had_better",
    "have 목적어 p.p.": "have_object_pp",
    "here there 도치": "here_there_inversion",
    "here/there 도치": "here_there_inversion",
    "it 가목적어 to부정사": "it_object_infinitive",
    "it seems that": "it_seems_that",
    "it_seems_that": "it_seems_that",
    "it-seems-that": "it_seems_that",
    "it's time 가정법": "its_time_subjunctive",
    "make let have": "causative",
    "middle2 as as": "as_as",
    "middle2 as_as": "as_as",
    "middle2 it to": "it_to",
    "middle2 it_to": "it_to",
    "middle2 since": "since",
    "middle3 as as": "as_as",
    "middle3 as_as": "as_as",
    "middle3 since": "since",
    "modal have pp": "modal_have_pp",
    "modal passive": "modal_passive",
    "modal_have_pp": "modal_have_pp",
    "modal_passive": "modal_passive",
    "modal-have-pp": "modal_have_pp",
    "modal-passive": "modal_passive",
    "passive voice": "passive",
    "so neither 도치": "inversion_so_neither",
    "so that 목적 심화": "so_that_purpose_advanced",
    "so/neither 도치": "inversion_so_neither",
    "something 형용사": "something_adjective",
    "tag questions": "tag_questions",
    "tag_questions": "tag_questions",
    "tag-questions": "tag_questions",
    "to 부정사 명사적 용법": "to_infinitive_noun",
    "to 부정사 부사적 용법": "to_infinitive_adverbial",
    "to부정사 동명사 목적어": "to_infinitive_gerund_verbs",
    "to부정사 형용사적 용법": "to_infinitive_adjective",
    "too enough to": "too_enough_to",
    "too_enough_to": "too_enough_to",
    "too-enough-to": "too_enough_to",
    "with 명사구 have": "with_noun_phrase_have",
    "접속사 although": "although",
    "주어 동사 수일치 of": "sva_of_structure",
    "중1 a few few": "a_few_few",
    "중1 a_few_few": "a_few_few",
    "중1 causative": "causative",
    "중1 five form": "five_form",
    "중1 five_form": "five_form",
    "중1 many much": "many_much",
    "중1 many_much": "many_much",
    "after before": "after_before",
    "after_before": "after_before",
    "after-before": "after_before",
    "after/before": "after_before",
    "although 접속사": "although",
    "comparatives": "comparatives",
    "ditransitive": "ditransitive",
    "dont have to": "dont_have_to",
    "dont_have_to": "dont_have_to",
    "dont-have-to": "dont_have_to",
    "enough to 구문": "too_to_enough_to",
    "gerund total": "gerund_total",
    "gerund_total": "gerund_total",
    "gerund-total": "gerund_total",
    "if condition": "if_condition",
    "if_condition": "if_condition",
    "if-condition": "if_condition",
    "it that 강조구문": "cleft_it_that",
    "middle1 must": "must",
    "middle1 past": "past",
    "middle2 that": "that",
    "past perfect": "past_perfect",
    "past_perfect": "past_perfect",
    "past-perfect": "past_perfect",
    "perception verb": "perception_verb",
    "perception_verb": "perception_verb",
    "perception-verb": "perception_verb",
    "sensory verb": "sensory_verb",
    "sensory_verb": "sensory_verb",
    "sensory-verb": "sensory_verb",
    "superlatives": "superlatives",
    "there is are": "there_is_are",
    "there is/are": "there_is_are",
    "there_is_are": "there_is_are",
    "there-is-are": "there_is_are",
    "to부정사 명사 형용사": "to_infinitive_noun_adjective",
    "to부정사 명사적 용법": "to_infinitive_noun",
    "to부정사 부사적 용법": "to_infinitive_adverbial",
    "wh questions": "wh_questions",
    "wh_questions": "wh_questions",
    "wh-questions": "wh_questions",
    "with 명사 have": "with_noun_phrase_have",
    "목적의 so that": "so_that_purpose",
    "분사의 형용사적 용법": "participles_attributive",
    "전체 부정 부분 부정": "total_vs_partial_negation",
    "접속사 because": "because",
    "조동사 have pp": "modal_have_pp",
    "중1 일반동사 부정문": "do_negative",
    "중1 일반동사 의문문": "do_question",
    "중1 be동사 부정문": "be_negative",
    "중2 although": "although",
    "a few / few": "a_few_few",
    "be negative": "be_negative",
    "be question": "be_question",
    "be_negative": "be_negative",
    "be_question": "be_question",
    "be-negative": "be_negative",
    "be-question": "be_question",
    "because 접속사": "because",
    "comparative": "comparative",
    "do emphasis": "do_emphasis",
    "do negative": "do_negative",
    "do question": "do_question",
    "do_emphasis": "do_emphasis",
    "do_negative": "do_negative",
    "do_question": "do_question",
    "do-emphasis": "do_emphasis",
    "do-negative": "do_negative",
    "do-question": "do_question",
    "exclamation": "exclamation",
    "have 목적어 pp": "have_object_pp",
    "if, whether": "if_whether",
    "imperatives": "imperatives",
    "it that 가주어": "it_that_expletive_subject",
    "middle1 and": "and",
    "middle1 but": "but",
    "middle1 can": "can",
    "middle1 may": "may",
    "participles": "participles",
    "quantifiers": "quantifiers",
    "superlative": "superlative",
    "wh question": "wh_question",
    "wh_question": "wh_question",
    "wh-question": "wh_question",
    "while, when": "while_when",
    "with 명사구 be": "with_noun_phrase_be",
    "with 목적어 분사": "with_object_participle",
    "관계대명사 what": "relative_pronoun_what",
    "관계사 계속적 용법": "continuative_relative_clauses",
    "의무 have to": "have_to",
    "조동사 should": "should",
    "중1 be verb": "be_verb",
    "중1 be_verb": "be_verb",
    "중1 because": "because",
    "중1 do verb": "do_verb",
    "중1 do_verb": "do_verb",
    "중1 have to": "have_to",
    "중1 have_to": "have_to",
    "중1 passive": "passive",
    "중2 because": "because",
    "중2 passive": "passive",
    "중2 so that": "so_that",
    "중2 so_that": "so_that",
    "중2 used to": "used_to",
    "중2 used_to": "used_to",
    "중3 so that": "so_that",
    "중3 so_that": "so_that",
    "a few와 few": "a_few_few",
    "because of": "because_of",
    "because_of": "because_of",
    "because-of": "because_of",
    "had better": "had_better",
    "had_better": "had_better",
    "had-better": "had_better",
    "have to 구문": "have_to",
    "i wish 가정법": "wish_subjunctive",
    "if whether": "if_whether",
    "if_whether": "if_whether",
    "if-whether": "if_whether",
    "if/whether": "if_whether",
    "it-that 강조": "cleft_it_that",
    "many, much": "many_much",
    "many와 much": "many_much",
    "middle1 so": "so",
    "modal will": "will",
    "will": "will",
    "modal-will": "will",
    "past tense": "past",
    "should 조동사": "should",
    "so that 구문": "so_that",
    "so that 목적": "so_that_purpose",
    "that 절 가정법": "that_clause_subjunctive",
    "to부정사와 동명사": "to_infinitive_gerund_verbs",
    "used to 구문": "used_to",
    "what 관계대명사": "relative_pronoun_what",
    "when while": "while_when",
    "while when": "while_when",
    "while_when": "while_when",
    "while-when": "while_when",
    "while/when": "while_when",
    "with 명사 be": "with_noun_phrase_be",
    "5형식 목적격보어": "object_complement_5th_form",
    "가목적어 진목적어": "it_object_infinitive",
    "가정법 과거 완료": "subjunctive_past_perfect",
    "가주어 to부정사": "it_to",
    "동명사 관용 표현": "gerund_idiomatic_expressions",
    "동명사 to부정사": "to_infinitive_gerund_verbs",
    "목적격 관계대명사": "objective_relative_pronouns",
    "목적격보어 5형식": "object_complement_5th_form",
    "목적격보어 형용사": "object_complement_adj",
    "비교급 강조 부사": "comparative_emphasis_adverbs",
    "소유격 관계대명사": "possessive_relative_pronouns",
    "의문사 to부정사": "wh_to_infinitive",
    "일반 동사 부정문": "do_negative",
    "일반 동사 의문문": "do_question",
    "전체부정 부분부정": "total_vs_partial_negation",
    "접속사 since": "since",
    "접속사 while": "conjunction_while",
    "조동사 be pp": "modal_passive",
    "중1 should": "should",
    "중2 gerund": "gerund",
    "a few few": "a_few_few",
    "a_few_few": "a_few_few",
    "a-few-few": "a_few_few",
    "be 동사 부정문": "be_negative",
    "be 동사 의문문": "be_question",
    "causative": "causative",
    "few a few": "a_few_few",
    "five form": "five_form",
    "five_form": "five_form",
    "five-form": "five_form",
    "many much": "many_much",
    "many_much": "many_much",
    "many-much": "many_much",
    "many/much": "many_much",
    "not to부정사": "not_to_infinitive",
    "of 구조 수일치": "sva_of_structure",
    "since 접속사": "since",
    "so that 절": "so_that",
    "that절 가정법": "that_clause_subjunctive",
    "there are": "there_is_are",
    "to 부정사 종합": "to_infinitive_total",
    "to부정사 가주어": "it_to_infinitive_subject",
    "too to 구문": "too_to_enough_to",
    "while 접속사": "conjunction_while",
    "가정법 과거완료": "subjunctive_past_perfect",
    "그러나 그러므로": "however_therefore",
    "동명사 관용표현": "gerund_idiomatic_expressions",
    "목적격관계대명사": "objective_relative_pronouns",
    "비교급 강조부사": "comparative_emphasis_adverbs",
    "사역 동사 심화": "causative_verbs_advanced",
    "소유격관계대명사": "possessive_relative_pronouns",
    "일반동사 부정문": "do_negative",
    "일반동사 의문문": "do_question",
    "접속사 that": "conjunction_that",
    "접속사 when": "conjunction_when",
    "조동사 must": "must",
    "조동사 will": "will",
    "주격 관계대명사": "subject_relative_pronouns",
    "중2 as as": "as_as",
    "중2 as_as": "as_as",
    "중2 it to": "it_to",
    "중2 it_to": "it_to",
    "중2 since": "since",
    "중3 as as": "as_as",
    "중3 as_as": "as_as",
    "중3 since": "since",
    "현재 완료 진행": "present_perfect_progressive",
    "although": "although",
    "be동사 부정문": "be_negative",
    "it to 구문": "it_to",
    "must 조동사": "must",
    "that 명사절": "that_clause_statement",
    "that 접속사": "conjunction_that",
    "that절 진술": "that_clause_statement",
    "there is": "there_is_are",
    "to부정사 부정": "not_to_infinitive",
    "to부정사 종합": "to_infinitive_total",
    "when 접속사": "conjunction_when",
    "will 조동사": "will",
    "wish 가정법": "wish_subjunctive",
    "5형식 형용사": "object_complement_adj",
    "계속적 관계사": "continuative_relative_clauses",
    "동명사 목적어": "gerund_object",
    "몇몇 거의없는": "a_few_few",
    "목적어 동명사": "gerund_object",
    "비교급 강조어": "comparative_emphasis",
    "비록 일지라도": "although",
    "사역동사 심화": "causative_verbs_advanced",
    "의문사 의문문": "wh_question",
    "접속사 and": "and",
    "접속사 but": "but",
    "조동사 수동태": "modal_passive",
    "조동사 can": "can",
    "조동사 may": "may",
    "주격관계대명사": "subject_relative_pronouns",
    "중1 일반동사": "do_verb",
    "중1 be동사": "be_verb",
    "중1 must": "must",
    "중1 past": "past",
    "중2 that": "that",
    "하는 게 낫다": "had_better",
    "and 접속사": "and",
    "as ~ as": "as_as",
    "as...as": "as_as",
    "be verb": "be_verb",
    "be_verb": "be_verb",
    "be-verb": "be_verb",
    "because": "because",
    "but 접속사": "but",
    "can 조동사": "can",
    "do verb": "do_verb",
    "do_verb": "do_verb",
    "do-verb": "do_verb",
    "have to": "have_to",
    "have_to": "have_to",
    "have-to": "have_to",
    "may 조동사": "may",
    "passive": "passive",
    "so that": "so_that",
    "so_that": "so_that",
    "so-that": "so_that",
    "used to": "used_to",
    "used_to": "used_to",
    "used-to": "used_to",
    "가정법 과거": "subjunctive_past",
    "간접 의문문": "indirect_question",
    "감탄문 구문": "exclamation",
    "강조의 do": "do_emphasis",
    "계속적 용법": "continuative_relative_clauses",
    "기본 전치사": "prepositions_basic",
    "동명사 전체": "gerund_total",
    "동명사 종합": "gerund_total",
    "부가 의문문": "tag_questions",
    "부정 대명사": "indefinite_pronouns",
    "불필요 표현": "dont_have_to",
    "비교급 강조": "comparative_emphasis",
    "비교급 구문": "comparatives",
    "수동태 심화": "passive_advanced",
    "수량 형용사": "quantity_adjectives",
    "시간 접속사": "time_conjunctions",
    "재귀 대명사": "reflexive_pronoun",
    "전치사 기초": "prepositions_basic",
    "접속사 as": "as_conjunction",
    "접속사 so": "so",
    "조건문 if": "if_condition",
    "조건의 if": "if_condition",
    "조동사 심화": "modal_extended",
    "조동사 확장": "modal_extended",
    "준사역 동사": "semi_causative",
    "중1 and": "and",
    "중1 but": "but",
    "중1 can": "can",
    "중1 may": "may",
    "한정적 분사": "participles_attributive",
    "현재 진행형": "present_continuous",
    "현재완료진행": "present_perfect_progressive",
    "as 접속사": "as_conjunction",
    "gerund": "gerund",
    "if 조건문": "if_condition",
    "should": "should",
    "so 접속사": "so",
    "wh 의문문": "wh_question",
    "간접의문문": "indirect_question",
    "지각 동사": "perception_verb",
    "과거 시제": "past",
    "과거 완료": "past_perfect",
    "관계 부사": "relative_adverbs",
    "동등 비교": "as_as",
    "부가의문문": "tag_questions",
    "부정대명사": "indefinite_pronouns",
    "분사 구문": "participial_construction",
    "빈도 부사": "frequency_adverbs",
    "사역 동사": "causative",
    "수량 일치": "quantity_agreement",
    "수량 표현": "quantifiers",
    "수량형용사": "quantity_adjectives",
    "시간접속사": "time_conjunctions",
    "시제 일치": "tense_agreement",
    "원급 비교": "as_as",
    "일반 동사": "do_verb",
    "재귀대명사": "reflexive_pronoun",
    "준사역동사": "semi_causative",
    "중1 so": "so",
    "\uC9C0\uAC01 \uB3D9\uC0AC": "perception_verb",
    "\uAC10\uAC01 \uB3D9\uC0AC": "sensory_verb",
    "현재 완료": "present_perfect",
    "현재진행형": "present_continuous",
    "as as": "as_as",
    "as_as": "as_as",
    "as-as": "as_as",
    "be 동사": "be_verb",
    "do 강조": "do_emphasis",
    "it to": "it_to",
    "it_to": "it_to",
    "it-to": "it_to",
    "since": "since",
    "4 형식": "ditransitive",
    "5 형식": "five_form",
    "간접화법": "reported_speech",
    "지각동사": "perception_verb",
    "강조구문": "cleft_it_that",
    "과거시제": "past",
    "과거완료": "past_perfect",
    "관계부사": "relative_adverbs",
    "동등비교": "as_as",
    "부분부정": "total_vs_partial_negation",
    "분사구문": "participial_construction",
    "빈도부사": "frequency_adverbs",
    "사역동사": "causative",
    "수 일치": "quantity_agreement",
    "수여동사": "ditransitive",
    "시제일치": "tense_agreement",
    "왜냐하면": "because",
    "원급비교": "as_as",
    "일반동사": "do_verb",
    "\uC9C0\uAC01\uB3D9\uC0AC": "perception_verb",
    "\uAC10\uAC01\uB3D9\uC0AC": "sensory_verb",
    "직접화법": "reported_speech",
    "현재완료": "present_perfect",
    "be동사": "be_verb",
    "must": "must",
    "past": "past",
    "that": "that",
    "will": "will",
    "4형식": "ditransitive",
    "5형식": "five_form",
    "감탄문": "exclamation",
    "그러나": "but",
    "그리고": "and",
    "동명사": "gerund",
    "명령문": "imperatives",
    "비교급": "comparatives",
    "수동태": "passive",
    "수량사": "quantifiers",
    "최상급": "superlatives",
    "and": "and",
    "but": "but",
    "can": "can",
    "may": "may",
    "분사": "participles",
    "화법": "reported_speech",
    "so": "so"
  };

  const exactRegistryChapter = resolveRegistryExactChapter(raw, input);
  if (exactRegistryChapter) {
    console.log('[GRAMMAR DETECTED REGISTRY EXACT]', {
      rawInput: raw,
      resolved: exactRegistryChapter
    });

    return exactRegistryChapter;
  }

  const family = detectGrammarFamilyFromRequest(raw, normalized);
  if (family) {
    console.log('[GRAMMAR FAMILY DETECTED]', {
      rawInput: raw,
      resolvedFamily: family
    });

    return family;
  }

  for (const entry of CHAPTER_ALIAS_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(raw))) {
      console.log('[GRAMMAR DETECTED PATTERN FALLBACK]', {
        rawInput: raw,
        resolved: entry.key
      });

      return entry.key;
    }
  }

  if (aliasMap[normalized]) {
    console.log('[GRAMMAR DETECTED LEGACY FALLBACK]', {
      rawInput: raw,
      resolved: aliasMap[normalized]
    });

    return aliasMap[normalized];
  }

for (const [aliasKey, aliasValue] of Object.entries(aliasMap)
  .sort((a, b) => normalizeRoutingText(b[0]).length - normalizeRoutingText(a[0]).length)) {
  if (isSafeLegacyPartialAlias(aliasKey) && normalized.includes(aliasKey)) {
    console.log('[GRAMMAR DETECTED LEGACY PARTIAL FALLBACK]', {
      rawInput: raw,
      matchedAlias: aliasKey,
      resolved: aliasValue
    });

    return aliasValue;
  }
}

  return "";
}


function getSentenceBankPathInfo(input = {}, chapterKey = "") {
  const bucket = detectGradeBucket(input);
  const registry = SENTENCE_BANK_REGISTRY[bucket] || {};
  const metaRegistry = DB_REGISTRY?.byGrade?.[bucket] || {};

  let rawKey = String(chapterKey || "").trim();

  if (isInvalidInternalCode(rawKey)) {
    console.log('[INVALID INTERNAL CHAPTER BLOCKED]', rawKey);
    rawKey = '';
  }

  if (!rawKey) {
    console.log('[GRAMMAR DETECTION FAILED]');
  }
  const normalizedKey = applyExplicitMiddle1Alias(bucket, rawKey);
  const routingText = buildRoutingText(input, rawKey);
  let resolvedKey = "";
  let matchType = "";
  let routingMode = ROUTING_MODES.UNDER_CONSTRUCTION;
  let filePath = "";
  let matchedMeta = null;
  let family = "";
  let specializedMatch = null;
  let specializedLocked = false;
  let fallbackUsed = false;
  console.log("[ROUTING_DEBUG]", {
    requested: rawKey,
    normalized: normalizedKey,
    matchedCanonical: resolvedKey,
    selectedFile: filePath
  });

  console.log("[ROUTING_INPUT]", {
    rawKey,
    normalizedKey,
    routingText,
  });
  console.log("[GRADE_BUCKET]", {
    bucket,
    availableGrades: getAvailableGradeBuckets(),
  });
  console.log("[DB_NAMESPACE_LOCK]", {
    selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
    resolvedBucket: bucket,
    resolvedChapter: "",
  });

  // PRIORITY 1: specialized exact match. Stop immediately; no family mixing.
  specializedMatch = findSpecializedAlias(routingText);
  if (specializedMatch && metaRegistry[specializedMatch.chapter]) {
    matchedMeta = metaRegistry[specializedMatch.chapter];
    resolvedKey = matchedMeta.chapter;
    family = matchedMeta.family;
    matchType = "specialized_exact";
    routingMode = ROUTING_MODES.SPECIALIZED_EXACT_MATCH;
    filePath = getCanonicalDbPath(bucket, resolvedKey);
    console.log("[SPECIALIZED_MATCH]", {
      matchedAlias: specializedMatch.alias,
      resolvedChapter: resolvedKey,
      internalKey: Boolean(specializedMatch.internalKey),
    });
  } else if (specializedMatch) {
    specializedLocked = true;
    family = inferGrammarFamily(specializedMatch.chapter);
    console.log("[SPECIALIZED_MATCH]", {
      matchedAlias: specializedMatch.alias,
      resolvedChapter: specializedMatch.chapter,
      missingInGrade: bucket,
      internalKey: Boolean(specializedMatch.internalKey),
    });
  } else {
    console.log("[SPECIALIZED_MATCH]", null);
  }

  // Direct DB filename match remains DB-first and canonical.
  if (!filePath && rawKey && registry[rawKey]) {
    resolvedKey = rawKey;
    matchedMeta = metaRegistry[rawKey] || null;
    family = matchedMeta?.family || inferGrammarFamily(rawKey);
    matchType = "exact";
    routingMode = ROUTING_MODES.EXACT_DB_MATCH;
    filePath = getCanonicalDbPath(bucket, resolvedKey);
  }

  else if (!filePath && normalizedKey && registry[normalizedKey]) {
    resolvedKey = normalizedKey;
    matchedMeta = metaRegistry[normalizedKey] || null;
    family = matchedMeta?.family || inferGrammarFamily(normalizedKey);
    matchType = "normalized";
    routingMode = ROUTING_MODES.NORMALIZED_DB_MATCH;
    filePath = getCanonicalDbPath(bucket, resolvedKey);
  }
  console.log("[ROUTING_DEBUG]", {
    requested: rawKey,
    normalized: normalizedKey,
    matchedCanonical: resolvedKey,
    selectedFile: filePath
  });

  // PRIORITY 2: family representative match for generic grammar requests.
  if (!filePath && !specializedLocked) {
    family = detectGrammarFamilyFromRequest(routingText, normalizedKey);
    const representative = family ? pickFamilyRepresentative(bucket, family) : null;
    if (representative) {
      matchedMeta = representative;
      resolvedKey = representative.chapter;
      matchType = "family_representative";
      routingMode = ROUTING_MODES.FAMILY_REPRESENTATIVE_MATCH;
      filePath = getCanonicalDbPath(bucket, resolvedKey);
      console.log("[FAMILY_MATCH]", {
        family,
        representative: resolvedKey,
      });
      console.log("[REPRESENTATIVE_MATCH]", {
        family,
        chapter: resolvedKey,
        filePath,
      });
    } else {
      console.log("[FAMILY_MATCH]", {
        family,
        representative: "",
      });
      console.log("[REPRESENTATIVE_MATCH]", {
        family,
        chapter: "",
        filePath: "",
      });
    }
  } else {
    console.log("[FAMILY_MATCH]", {
      family,
      representative: routingMode === ROUTING_MODES.FAMILY_REPRESENTATIVE_MATCH ? resolvedKey : "",
      skipped: true,
    });
    console.log("[REPRESENTATIVE_MATCH]", {
      family,
      chapter: routingMode === ROUTING_MODES.FAMILY_REPRESENTATIVE_MATCH ? resolvedKey : "",
      skipped: true,
    });
  }

  // PRIORITY 3: safe family fallback only when no representative exists.
  if (!filePath && !specializedLocked && family) {
    const fallback = pickFamilyFallback(bucket, family);
    if (fallback) {
      matchedMeta = fallback;
      resolvedKey = fallback.chapter;
      matchType = "family_fallback";
      routingMode = ROUTING_MODES.FAMILY_FALLBACK_MATCH;
      filePath = getCanonicalDbPath(bucket, resolvedKey);
      fallbackUsed = true;
    }
  }
  console.log("[FALLBACK_USED]", {
    used: fallbackUsed,
    family,
    resolvedChapter: fallbackUsed ? resolvedKey : "",
  });


  const expectedKey =
    resolvedKey ||
    normalizedKey ||
    rawKey;

  const canonicalExpectedFile = matchedMeta?.fileName || getCanonicalDbFilename(bucket, expectedKey);
  const canonicalExpectedPath = getCanonicalDbPath(bucket, expectedKey);

  if (!filePath && canonicalExpectedPath && fs.existsSync(canonicalExpectedPath)) {
    filePath = canonicalExpectedPath;
    resolvedKey = expectedKey;
    matchType = matchType || "canonical_filename";
    routingMode = routingMode === ROUTING_MODES.UNDER_CONSTRUCTION
      ? ROUTING_MODES.EXACT_DB_MATCH
      : routingMode;
  }

  const expectedFile = canonicalExpectedFile;
  const expectedPath = canonicalExpectedPath;

  const fileExists = Boolean(
    filePath &&
    fs.existsSync(filePath)
  );
  console.log("[ROUTING_DEBUG]", {
    requested: rawKey,
    normalized: normalizedKey,
    matchedCanonical: resolvedKey,
    selectedFile: filePath
  });

  console.log("[FINAL_DB]", {
    filePath: fileExists ? filePath : "",
    expectedFile,
    expectedPath,
  });
  console.log("[FINAL_DB_FILE]", {
    filePath: fileExists ? filePath : "",
    expectedFile,
    expectedPath,
  });
  console.log("[ROUTING_MODE]", routingMode);
  console.log("[DB_NAMESPACE_LOCK]", {
    selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
    resolvedBucket: bucket,
    resolvedChapter: expectedKey,
  });
  const engineNamespaceMode = normalizeChapterKey(input.engine || input.mode || input.rawBody?.engine || input.rawBody?.mode || "");
  if (engineNamespaceMode.includes("wormhole")) {
    console.log("[WORMHOLE_NAMESPACE_LOCK]", {
      selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedBucket: bucket,
      resolvedChapter: expectedKey,
    });
  }
  if (engineNamespaceMode.includes("mock")) {
    console.log("[MOCKS_NAMESPACE_LOCK]", {
      selectedGrade: normalizeSelectedGrade(input.selectedGrade || input.rawBody?.selectedGrade || "auto"),
      resolvedBucket: bucket,
      resolvedChapter: expectedKey,
    });
  }

  return {
    bucket,
    chapterKey: expectedKey,
    requestedChapterKey: rawKey,
    normalizedChapterKey: normalizedKey,
    matchType,
    routingMode: fileExists
      ? routingMode
      : ROUTING_MODES.UNDER_CONSTRUCTION,
    family,
    subtype: matchedMeta?.subtype || "",
    specializedMatch: specializedMatch?.alias || "",
    fallbackUsed,
    expectedFile,
    expectedPath,
    filePath: fileExists ? filePath : "",
    fileExists,
    availableGrades: getAvailableGradeBuckets(),
    availableChapters: Object.keys(registry),
  };
}
// STRICT DB-FIRST LOCK REMOVED LEGACY ROUTING

// STRICT DB-FIRST LOCK REMOVED LEGACY ROUTING


// STRICT DB-FIRST LOCK REMOVED LEGACY ROUTING


// STRICT DB-FIRST LOCK REMOVED LEGACY ROUTING



function logMagicRouting(info = {}) {
  console.info(
    "[STRICT DB ROUTING]",
    {
      requestedChapter: info.requestedChapterKey || "",
      normalizedChapter: info.normalizedChapterKey || "",
      resolvedChapter: info.chapterKey || "",
      matchedFile: info.filePath || "",
      routingMode: info.routingMode || "UNDER_CONSTRUCTION"
    }
  );
}

function resolveSentenceBankFile(input = {}, chapterKey = "") {
  return getSentenceBankPathInfo(input, chapterKey).filePath || null;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function stableClueHash(value = "") {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function splitCluePiece(value = "") {
  return String(value || "")
    .split(/\s+(?:\/|\\||;|→|->)\s+|\s*(?:→|->)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLikelyGrammarClue(value = "") {
  return /\b(pattern|use|tense|clause|subject|object|complement|base verb|verb phrase|as \+|if \+|to-infinitive|to \+|not as|would|could)\b|[+~]|구조|문법|주의|역할|일치|금지|용법/i.test(String(value || ""));
}

function scrambleCluePieces(pieces = [], seed = {}, answer = "") {
  const answerText = String(answer || "").trim();
  const answerLower = answerText.toLowerCase();
  const firstToken = answerLower.split(/\s+/).filter(Boolean)[0] || "";
  const hashBase = stableClueHash([seed.id, seed.seedId, seed.grammar, answerText].filter(Boolean).join("|"));
  const seen = new Set();
  const chunks = [];

  for (const piece of pieces) {
    for (const chunk of splitCluePiece(piece)) {
      const value = String(chunk || "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      chunks.push(value);
    }
  }

  if (chunks.length <= 1) return chunks;

  const scored = chunks.map((value, index) => {
    const lower = value.toLowerCase();
    const answerIndex = answerLower.indexOf(lower);
    const grammar = isLikelyGrammarClue(value);
    const startsLikeAnswer = firstToken && lower.startsWith(firstToken);
    const longAnswerLeak = answerText && value.length > answerText.length * 0.65 && answerLower.includes(lower);
    const laterAnswerChunk = answerIndex > Math.max(0, Math.floor(answerText.length * 0.25));
    const verbObjectHint = /\b(to\s+[a-z]+|[a-z]+ed\b|[a-z]+ing\b|would\s+[a-z]+|could\s+[a-z]+|blamed|taught|introduced|prepared|built|made|kept|found|gave|took)\b/i.test(value);
    const jitter = (stableClueHash(String(hashBase) + ":" + value + ":" + String(index)) % 17) / 100;
    let score = 3 + jitter;

    if (laterAnswerChunk) score -= 2.2;
    if (verbObjectHint) score -= 1.4;
    if (grammar) score += 0.7;
    if (startsLikeAnswer) score += 2.8;
    if (longAnswerLeak) score += 3.4;

    return { value, score, index };
  });

  scored.sort((a, b) => (a.score - b.score) || (a.index - b.index));
  return scored.map((item) => item.value);
}

function pickEnglishClueFromSeed(seed = {}, answer = "") {
  if (Array.isArray(seed.clueUnits)) {
    const pieces = seed.clueUnits
      .map((unit) => Array.isArray(unit) ? String(unit[1] || "").trim() : String(unit || "").trim())
      .filter(Boolean);
    if (pieces.length) return scrambleCluePieces(pieces, seed, answer).join(" / ");
  }
  if (Array.isArray(seed.extraClueWordPool) && seed.extraClueWordPool.length) {
    return scrambleCluePieces(seed.extraClueWordPool.slice(0, 6), seed, answer).join(" / ");
  }
  return scrambleCluePieces(buildGuidedClue(answer).split(/\s*\/\s*/g), seed, answer).join(" / ");
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

function shuffleArraySafe(arr = []) {
  const cloned = Array.isArray(arr) ? [...arr] : [];

  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }

  return cloned;
}

function loadSentenceBank(input = {}) {
  const chapterKey = String(input?.grammarFocus?.chapterKey || "").trim();
  const pathInfo = getSentenceBankPathInfo(input, chapterKey);
  const filePath = pathInfo.filePath || "";
  const specializedExactLoad = pathInfo.routingMode === ROUTING_MODES.SPECIALIZED_EXACT_MATCH
    || pathInfo.matchType === "specialized_exact";

  logMagicRouting(pathInfo);

  if (filePath) {
    const preloadFilePaths = specializedExactLoad ? [filePath] : [filePath];
    const raw = safeReadJson(preloadFilePaths[0]);
    const normalized = normalizeSentenceBankEntries(
      raw,
      pathInfo.chapterKey || chapterKey
    );

    // RANDOMIZE BEFORE ANY SELECTION
    const randomizedItems = shuffleArraySafe(normalized);

    console.log(
      "[DB LOAD]",
      {
        chapterKey,
        filePath,
        itemCount: randomizedItems.length,
        routingMode: pathInfo.routingMode,
      }
    );

    if (randomizedItems.length) {
      return {
        chapterKey: pathInfo.chapterKey || chapterKey,
        requestedChapterKey: chapterKey,
        filePath,
        source: "json_file",
        routingMode: pathInfo.routingMode,
        matchType: pathInfo.matchType,
        pathInfo,
        items: randomizedItems,
      };
    }
  }

  return {
    chapterKey,
    requestedChapterKey: chapterKey,
    filePath: null,
    filePaths: [],
    relatedFiles: [],
    source: "none",
    routingMode: ROUTING_MODES.UNDER_CONSTRUCTION,
    matchType: "none",
    pathInfo,
    items: [],
  };
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
  return "";
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



function detectGrammarFocus(text = "", input = {}) {
  const raw = String(text || "").trim();

  const alias = resolveChapterAlias(raw, input);

let chapterKey = alias || "";

if (!chapterKey) {
  console.log('[GRAMMAR DETECTION FAILED]');
}

  if (isInvalidInternalCode(chapterKey)) {
    console.log('[INVALID INTERNAL CHAPTER BLOCKED]', chapterKey);
    chapterKey = '';
  }

  if (!chapterKey) {
    console.log('[GRAMMAR DETECTION FAILED]');
  }

  return {
    chapterKey,
    strictDbRouting: true,
  };
}



function resolveWorkbookType(input) {
  const mode = input.mode;
  const focus = input.grammarFocus.chapterKey;
  const requested = input.requestedWorkbookType;

  const normalizedRequested = normalizeWorkbookTypeLoose(requested);

if (["guided_writing", "blank_fill", "binary_choice", "choice"].includes(normalizedRequested)) {
  return normalizedRequested;
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

  // S56 emergency chapter-lock fix:
  // Prefer the user-visible request/title over hidden or stale frontend topic values.
  // This prevents cases like visible "there is(are)" being overridden by a stale hidden "must" topic.
  const primaryChapterText = [
    userPrompt,
    sanitizeString(body.worksheetTitle || body.title || ""),
    sanitizeString(body.rawBody?.worksheetTitle || body.rawBody?.title || ""),
  ].filter(Boolean).join("\n");
  const selectedGrade = normalizeSelectedGrade(body.selectedGrade || body.rawBody?.selectedGrade || "auto");
  const grammarFocusContext = { selectedGrade, rawBody: body };
  const primaryGrammarFocus = detectGrammarFocus(primaryChapterText, grammarFocusContext);
  const grammarFocus = detectGrammarFocus(primaryChapterText, grammarFocusContext);

  const requestedWorkbookType = normalizeWorkbookTypeLoose(sanitizeString(
  body.workbookType ||
  body.worksheetType ||
  body.rawBody?.workbookType ||
  body.rawBody?.worksheetType ||
  body.workbook ||
  body.type ||
  "guided_writing"
));

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
    selectedGrade,
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


  return (input.language === "en"
    ? `Generate a MARCUS Magic worksheet.\nTitle: ${title}\nGrade: ${input.gradeLabel}\nLevel: ${input.level}\nMode: ${input.mode}\nWorkbookType: ${input.workbookType}\nTopic: ${input.topic}\nDifficulty: ${input.difficulty}\nItemCount: ${input.count}\nTask: ${buildTaskGuide(input)}\n\nRules:\n- ${strictFocusRule}\n- ${absoluteGrammarLock}\n- ${noMixedGrammarRule}\n- ${writingRule}\n- ${styleRule}\n- ${repairRule}\n- ${formRule}${sourceBlock}${noteBlock}\n\n[User Request]\n${input.userPrompt || "(none)"}`
    : `MARCUS Magic 워크시트를 생성하시오.\n제목: ${title}\n학년: ${input.gradeLabel}\n레벨: ${input.level}\n모드: ${input.mode}\nWorkbookType: ${input.workbookType}\n주제: ${input.topic}\n난이도: ${input.difficulty}\n문항수: ${input.count}\n과업: ${buildTaskGuide(input)}\n\n규칙:\n- ${strictFocusRule}\n- ${absoluteGrammarLock}\n- ${noMixedGrammarRule}\n- ${writingRule}\n- ${styleRule}\n- ${repairRule}\n- ${formRule}${sourceBlock}${noteBlock}\n\n[사용자 요청]\n${input.userPrompt || "(없음)"}`);
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
  const basePrompt = `${input.topic}에 맞는 문장을 영작하시오.`;
  const baseAnswer = `Sample answer ${index + 1}.`;
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
  if ([
  "guided_writing",
  "guided-writing",
  "guided writing",
  "guided",
  "guide",
  "writing",
  "writing_lab",
  "writing-lab",
  "writing lab",
  "guided writing training",
  "guided_writing_training"
].includes(v)) return "guided_writing";
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


function buildDbFirstWorksheet(input, preloadedBankInfo = null) {
  const bankInfo = preloadedBankInfo || loadSentenceBank(input);
  const bank = bankInfo.items || [];

  console.log(
    "[DB WORKSHEET BUILD]",
    {
      chapterKey: bankInfo.chapterKey,
      itemCount: bank.length,
      source: bankInfo.source,
      routingMode: bankInfo.routingMode,
    }
  );

  if (!Array.isArray(bank) || bank.length === 0) {
    console.error(
      "[EMPTY DB ITEMS]",
      {
        chapterKey: bankInfo.chapterKey,
        filePath: bankInfo.filePath,
        routingMode: bankInfo.routingMode,
      }
    );

    return null;
  }

  const worksheetType = normalizeWorkbookTypeLoose(
  input.requestedWorkbookType ||
  input.rawBody?.workbookType ||
  input.rawBody?.worksheetType ||
  input.workbookType ||
  "guided_writing"
);
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

    if (worksheetType === "choice" || worksheetType === "binary_choice") {
      const choiceBundle = buildChoiceOptionsFromSeed(seed, answer, input, i + 1);
      questions.push({
        number: i + 1,
        type: "choice",
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
      routingMode: bankInfo.routingMode || ROUTING_MODES.EXACT_DB_MATCH,
      dbDebug: getDbDebugInfo(input, bankInfo),
    },
  };

  return Object.assign(worksheet, createWorkbookRenderBundle(worksheet, input), {
    questions,
    answers,
    dbMode: true,
    dbForced: true,
    gptFallbackBlocked: true,
    meta: Object.assign({}, worksheet.meta || {}, {
      dbFirst: true,
      layoutLock: true,
      dbSource: bankInfo.source,
      dbFilePath: bankInfo.filePath || "",
      dbItemCount: bank.length,
      routingMode: bankInfo.routingMode || ROUTING_MODES.EXACT_DB_MATCH,
      dbDebug: getDbDebugInfo(input, bankInfo),
    }),
  });
}



function getDbDebugInfo(input = {}, bankInfo = null) {
  const grade = detectGradeBucket(input);
  const chapterKey = String(input?.grammarFocus?.chapterKey || "").trim();
  const pathInfo = getSentenceBankPathInfo(input, chapterKey);
  const resolvedBankInfo = bankInfo || loadSentenceBank(input);

  return {
    grade,
    chapterKey,
    requestedChapter: input?.topic || input?.worksheetTitle || chapterKey,
    detectedChapter: chapterKey,
    requestedWorkbookType: input?.requestedWorkbookType,
    workbookType: input?.workbookType,
    mode: input?.mode,
    dbSource: resolvedBankInfo?.source || "none",
    dbFilePath: resolvedBankInfo?.filePath || "",
    dbItemCount: Array.isArray(resolvedBankInfo?.items) ? resolvedBankInfo.items.length : 0,
    routingMode: resolvedBankInfo?.routingMode || pathInfo.routingMode || ROUTING_MODES.UNDER_CONSTRUCTION,
    matchType: resolvedBankInfo?.matchType || pathInfo.matchType || "none",
    matchedFile: resolvedBankInfo?.filePath || pathInfo.filePath || "",
    relatedFiles: Array.isArray(resolvedBankInfo?.relatedFiles) ? resolvedBankInfo.relatedFiles.map((entry) => ({ chapterKey: entry.chapterKey, filePath: entry.filePath, itemCount: entry.itemCount || 0 })) : [],
    expectedFile: pathInfo.expectedFile,
    expectedPath: pathInfo.expectedPath,
    fileExists: pathInfo.fileExists,
  };
}

function isStrictDbRequest(input = {}) {
  const grade = detectGradeBucket(input);
  return ["middle1","middle2","middle3"].includes(grade) &&
         Boolean(String(input?.grammarFocus?.chapterKey || "").trim());
}

function shouldUseDbFirst(input = {}) {
  if (isStrictDbRequest(input)) return true;

  const rawWorkbookType = String(
    input?.requestedWorkbookType ||
    input?.workbookType ||
    input?.rawBody?.workbookType ||
    input?.rawBody?.worksheetType ||
    ""
  ).trim().toLowerCase();

  const workbookType = normalizeWorkbookTypeLoose(rawWorkbookType);

  const supportedType = [
    "guided_writing",
    "blank_fill",
    "choice",
    "binary_choice",
  ].includes(workbookType);

  const supportedMode = [
    "magic",
    "writing",
    "magic-card",
    "writing_lab",
  ].includes(String(input?.mode || "").trim().toLowerCase());

  return supportedMode && supportedType;
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
      dbFirst: !!worksheet?.meta?.dbFirst,
      dbFallback: !!worksheet?.meta?.dbFallback,
      dbSource: worksheet?.meta?.dbSource || "",
      dbDebug: worksheet?.meta?.dbDebug || null,
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
    const shouldTryDbFirst = shouldUseDbFirst(input);
    const middle1StrictDb = isStrictDbRequest(input);
    let worksheet = null;

    const bankInfo = shouldTryDbFirst ? loadSentenceBank(input) : null;

    if (shouldTryDbFirst) {
      logMagicRouting({
        bucket: bankInfo?.pathInfo?.bucket || detectGradeBucket(input),
        requestedChapterKey: bankInfo?.requestedChapterKey || input.grammarFocus.chapterKey,
        detectedChapterKey: input.grammarFocus.chapterKey,
        matchedFile: bankInfo?.filePath || "",
        routingMode: bankInfo?.routingMode || ROUTING_MODES.UNDER_CONSTRUCTION,
      });

      if (
        bankInfo.routingMode === ROUTING_MODES.SPECIALIZED_EXACT_MATCH ||
        bankInfo.routingMode === ROUTING_MODES.FAMILY_REPRESENTATIVE_MATCH ||
        bankInfo.routingMode === ROUTING_MODES.FAMILY_FALLBACK_MATCH ||
        bankInfo.routingMode === ROUTING_MODES.EXACT_DB_MATCH ||
        bankInfo.routingMode === ROUTING_MODES.NORMALIZED_DB_MATCH
      ) {
        worksheet = buildDbFirstWorksheet(input, bankInfo);

        console.log(
          "[WORKSHEET RESULT]",
          {
            success: !!worksheet,
            chapterKey: input.grammarFocus.chapterKey,
            routingMode: bankInfo.routingMode,
          }
        );

        if (middle1StrictDb && !worksheet) {
          return json(res, 200, {
            success: false,
            ok: false,
            mode: ROUTING_MODES.UNDER_CONSTRUCTION,
            message: "현재 제작중인 챕터입니다. 곧 업데이트될 예정입니다.",
            meta: {
              dbFirst: true,
              routingMode: ROUTING_MODES.UNDER_CONSTRUCTION,
              dbDebug: getDbDebugInfo(input, bankInfo),
            },
          });
        }
      } else {
        return json(res, 200, {
          success: false,
          ok: false,
          mode: ROUTING_MODES.UNDER_CONSTRUCTION,
          message: "현재 제작중인 챕터입니다. 곧 업데이트될 예정입니다.",
          meta: {
            dbFirst: true,
            routingMode: ROUTING_MODES.UNDER_CONSTRUCTION,
            dbDebug: getDbDebugInfo(input, bankInfo),
          },
        });
      }
    }

    if (middle1StrictDb && !worksheet) {
      return json(res, 200, {
        success: false,
        ok: false,
        mode: ROUTING_MODES.UNDER_CONSTRUCTION,
        message: "현재 제작중인 챕터입니다. 곧 업데이트될 예정입니다.",
        meta: {
          dbFirst: true,
          routingMode: ROUTING_MODES.UNDER_CONSTRUCTION,
          dbDebug: getDbDebugInfo(input, bankInfo),
        },
      });
    }

    if (!worksheet) {
      worksheet = await generateWithOpenAI(input);
    }
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
