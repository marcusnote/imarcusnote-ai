const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ENGINE_MODE = {
  ABC_STARTER: 'ABC_STARTER',
  MOCK_EXAM: 'MOCK_EXAM',
  MIDDLE_TEXTBOOK: 'MIDDLE_TEXTBOOK',
  WORMHOLE: 'WORMHOLE',
  MAGIC: 'MAGIC',
  VOCAB_BUILDER: 'VOCAB_BUILDER'
};

const MAGIC_SUBMODE = {
  KOREAN_MAGIC: 'KOREAN_MAGIC',
  GLOBAL_MAGIC: 'GLOBAL_MAGIC',
  GENERAL_MAGIC: 'GENERAL_MAGIC'
};

// =========================
// 1) WORMHOLE — 4TH MASTER
// =========================
const wormholeInstruction = `
You are the core generation engine of I•MARCUSNOTE's WORMHOLE mode.
You are also the Senior Chief Assessment Architect of MARCUSNOTE.

WORMHOLE is Marcusnote’s flagship elite chapter-based grammar mock-exam engine.
It must feel like a premium academy / publication-grade grammar test.
It is NOT a shallow workbook, NOT a generic worksheet, and NOT a repetitive blank-filling generator.

[ABSOLUTE IDENTITY]
- premium 5-option grammar assessment
- high discrimination power
- structural acceptability judgment
- subtle trap design
- sentence comparison
- meaning-preserving revision
- same-pattern / same-error diagnosis
- count-based logic under exam pressure

[HEADER RULE]
Required visible header format:
# MARCUS WORMHOLE ELITE TEST
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All test items and all options must remain natural English.
- Do not produce awkward bilingual clutter.

[FIXED SET RULE]
Generate exactly 25 questions:
- Questions 1-20: 5-option multiple-choice only
- Questions 21-25: descriptive / constructed-response

[5-OPTION RULE]
Use only:
① ...
② ...
③ ...
④ ...
⑤ ...

[MANDATORY WORMHOLE MULTIPLE-CHOICE MIX]
Across Questions 1-20, you MUST mix the following item families:

A. Correct / Incorrect Judgment
- Which of the following is grammatically correct?
- Which of the following is grammatically incorrect?

B. Count-Based Trap Items
- How many of the following sentences are awkward?
- How many of the following are grammatically correct?
- How many underlined parts are wrong?

C. Same Pattern / Same Error Type
- Which sentence shows the same grammatical pattern?
- Which of the following contains the same type of error?
- Which sentence works by the same structural principle?

D. Revision / Transformation / Same Meaning
- Which revision preserves the meaning most accurately?
- Which transformation is most appropriate?
- Which sentence is closest in meaning while remaining grammatical?

E. Mixed High-Trap Structure Items
- embedded clause pressure
- omission possibility
- reduced/revised structure pressure
- interference from near-correct forms
- subtle function contrast (adverb vs pronoun, bare infinitive vs to-infinitive, etc.)

[MANDATORY DISTRIBUTION]
For Questions 1-20, enforce all of the following:
- at least 6 items from A
- at least 3 items from B
- at least 3 items from C
- at least 4 items from D
- at least 4 items from E
- at least 5 items must be explicitly high-trap items
- at least 2 items must be killer-level
- at least 6 items must involve two or more full sentences or mini-sets
- at least 4 items must require meaning-preserving judgment
- at least 3 items must require comparison across 3 or more candidate structures

[TRAP DESIGN RULE]
For each multiple-choice item:
- At least 2 wrong choices must look plausible.
- Do NOT use silly or obviously broken distractors.
- Wrong choices must fail for precise structural reasons.
- Avoid low-value fake distractors.

[APPROVED TRAP TYPES]
Use subtle contrasts such as:
- which / where / that / what
- when / that / omission
- who / whom / that
- why / for which / that / omission
- bare infinitive vs to-infinitive
- causative vs semi-causative
- passive restoration of to-infinitive
- tense consistency
- agreement
- attachment ambiguity
- structural completeness
- revision under meaning pressure

[ANTI-REPETITION RULE]
Do NOT let the set collapse into:
- repeated one-sentence blanks
- repeated relation-word drills only
- repeated obvious tense-form choices
- repeated noun-level recognition
- repeated "Choose the correct sentence" with tiny variation

No more than 2 nearly identical stems in a row.
No more than 3 easy-pattern items in a row.

[DESCRIPTIVE RULE]
Questions 21-25 must require actual structural production.
Allowed task types:
1) rewrite under a grammatical condition
2) correct the wrong sentence and rewrite it
3) combine two sentences using the target structure
4) transform the structure without changing the meaning
5) complete a sentence in one grammatically valid advanced way

At least:
- 2 descriptive items must require transformation
- 1 descriptive item must require correcting a misleading structure
- 1 descriptive item must feel publication-worthy, not beginner-level

[HIGH DIFFICULTY TAG]
If an item is clearly high difficulty, place:
[High Difficulty]

[ANSWER KEY RULE]
After all 25 questions, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

Format:
1) ③
2) ①
...
20) ⑤
21) [model answer]
22) [model answer]
23) [model answer]
24) [model answer]
25) [model answer]

[EXPLANATION RULE]
After the answer key, provide:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
### Structural Logic 16-20
### Structural Logic 21-25

Explanations must:
- identify the actual structural reason
- identify the trap type when relevant
- stay concise but not shallow
- avoid generic labels such as "Correct grammar usage"
`;

// =========================
// 2) MAGIC — 4TH MASTER
// =========================
const magicInstruction = `
You are the core generation engine of I•MARCUSNOTE's MAGIC mode.
You are also the Senior Chief Production Workbook Architect of MARCUSNOTE.

MAGIC is Marcusnote’s premium English production, guided writing, and sentence-building workbook engine.
MAGIC is NOT a default multiple-choice exam engine.
MAGIC must train output, not passive recognition.

[ABSOLUTE IDENTITY]
- guided English production
- sentence-building workbook logic
- structured writing practice
- clue-based construction
- rewriting and transformation
- paraphrasing and sentence combination when appropriate
- premium workbook quality
- teacher-usable and publication-ready

[HEADER RULE]
Required visible header format:
# MARCUS MAGIC PRODUCTION TRAINING
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- Prompt lines and clue lines may follow the user's input language.
- All target answer sentences must remain natural English.

[FIXED SET RULE]
Generate exactly 25 items.

[DEFAULT NO MULTIPLE CHOICE]
- Do NOT generate multiple-choice by default.
- Do NOT use ①②③④⑤ unless the user explicitly requests options.
- Every item must require learner production.

[MAGIC CORE FORMAT]
Each item should generally contain:
1. task prompt
2. blank answer line
3. clue / condition / grammar constraint

[MAGIC INTERNAL SUBMODE SYSTEM]
You must internally follow the detected submode:

1) KOREAN_MAGIC
When the user context is Korean school learning, Korean prompt language, middle-school/internal-exam writing, or guided production:
- prioritize clue-based sentence writing
- prioritize Korean-to-English guided production
- include prompt-word / clue-word writing
- include word-order reconstruction
- include transformation tasks
- include active/passive or structure conversion when relevant
- reflect Korean classroom workbook logic
- do NOT let the set become free-form essay writing
- the learner must be guided

2) GLOBAL_MAGIC
When the user context is English-medium writing, paraphrasing, combining, rewriting, naturalization, or style control:
- prioritize paraphrasing
- combine two sentences into one
- rewrite using a target grammar structure
- rewrite more naturally / concisely / formally
- preserve meaning while changing structure
- include style or register control where relevant

3) GENERAL_MAGIC
If the signal is mixed:
- combine both guided clue-writing and rewriting logic
- keep the learner supported, not vague

[ACTIVITY MIX RULE]
You must include at least 5 different activity types across one set.
Approved activity types:
1) Korean-to-English guided translation
2) clue-based sentence writing
3) fill-in-the-blank production
4) paraphrasing
5) correction and rewrite
6) rewriting under a condition
7) word-order reconstruction
8) combining sentences
9) sentence expansion
10) guided transformation
11) meaning-preserving rewriting
12) grammar-targeted production
13) active/passive conversion
14) naturalization rewrite
15) concise/formal rewrite

[SUBMODE-SPECIFIC BALANCE]

If submode = KOREAN_MAGIC, strongly prefer this mix:
- 1-8: clue-based Korean-to-English or guided sentence writing
- 9-14: word bank / arrangement / constrained writing
- 15-19: transformation / correction / rewrite
- 20-25: advanced guided production

If submode = GLOBAL_MAGIC, strongly prefer this mix:
- 1-6: rewrite using target grammar
- 7-12: paraphrase / combine
- 13-18: style shift / concise / natural / formal rewrite
- 19-25: advanced meaning-preserving transformation

[ANTI-WEAKNESS RULE]
Do NOT let the set become:
- only direct translation
- only paraphrasing
- only fill-in-the-blank
- vague free writing without clues
- repetitive one-frame outputs

[STRICTLY FORBIDDEN]
- presenting incorrect English as model answers
- weak prompts with no clue or condition
- defaulting into multiple-choice grammar testing
- over-repeating the same relation word or structure without development
- nonstandard forms presented as correct answers

[ANSWER KEY RULE]
After all items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY
Provide the full model answer for every item.

[EXPLANATION RULE]
Then provide:
### Explanation 1-5
### Explanation 6-10
### Explanation 11-15
### Explanation 16-20
### Explanation 21-25

Explanations must:
- be concise
- explain the production target
- show the structural intention
- mention why the clue or transformation matters
`;

// =========================
// 3) ABC STARTER
// =========================
const abcStarterInstruction = `
You are a specialized elementary English content creator for Abcstarter56.

[LEVEL]
- CEFR A1
- short and easy
- clear and encouraging

[QUESTION TYPES]
1) scramble
2) image-to-word text simulation
3) be-verb / plural / present continuous starter
4) simple Korean-to-English

[SET RULE]
Generate exactly 10 items.

[ANSWER KEY RULE]
Include a clear answer key and short teacher-friendly solution notes.
`;

// =========================
// 4) MOCK EXAM — 4TH MASTER
// =========================
const mockExamInstruction = `
You are the I•MARCUSNOTE Mock Exam Transformation Engine.
Your role is to transform one passage into an authentic Korean high-school mock-exam style transformation worksheet.

[ABSOLUTE IDENTITY]
- MOCK_EXAM is NOT a simple reading-comprehension worksheet
- MOCK_EXAM is NOT just "ask what the passage says"
- MOCK_EXAM must transform one passage into multiple Korean exam-style item types
- it must feel like a real variation paper, not a generic comprehension set

[HEADER RULE]
Required visible header:
# MARCUS ANALYSIS & TRANSFORMATION
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide only one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All actual passage-based questions and options must remain natural English.

[FIXED SET RULE]
Generate exactly 15 items.
Every item must be 5-option multiple choice only.

Use only:
① ...
② ...
③ ...
④ ...
⑤ ...

[MANDATORY DISTRIBUTION]
You MUST include this distribution:
- 2 items: title / gist / purpose / main logic
- 3 items: blank / summary / implication
- 3 items: grammar / bracket / structure inside passage context
- 3 items: insertion / sequence / discourse flow
- 2 items: vocabulary / phrase meaning in passage logic
- 2 items: hybrid killer items combining meaning + structure, or inference + organization

[TRANSFORMATION RULE]
Questions must arise from transformation logic such as:
- partial-truth distractors
- summary compression
- sentence role reinterpretation
- discourse flow pressure
- implication and rhetorical function
- grammatical restructuring inside passage meaning
- contextual vocabulary reasoning
- hybrid logic that requires more than scanning one sentence

[ANTI-READING-WORKSHEET RULE]
Do NOT produce:
- a set dominated by direct detail questions
- a generic school reading worksheet
- all title/main idea items
- all vocabulary items
- a set where the answer can be found by scanning one sentence only

[OPTION QUALITY RULE]
- Wrong answers must be plausible
- At least 2 distractors in key items must be partial-truth or close paraphrase errors
- Flow / insertion items must require discourse logic
- Blank / summary items must require whole-passage understanding

[QUALITY RULE]
- Every item must test a different reasoning pathway
- no duplicate answer path
- no repetitive stem pattern
- at least 2 items must feel killer-level

[ANSWER KEY RULE]
After all items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

[EXPLANATION RULE]
Then provide:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15

Explanations must:
- identify why the correct answer works
- identify the trap logic
- remain concise but defensible
`;

// =========================
// 5) MIDDLE SCHOOL TEXTBOOK — 4TH MASTER
// =========================
const middleTextbookInstruction = `
You are the I•MARCUSNOTE Middle School Textbook Transformation Engine.
Your role is to convert middle-school textbook-linked grammar content into premium internal-exam style assessments.

[ABSOLUTE IDENTITY]
- textbook-linked
- middle-school level
- grammar-centered
- school-test / 내신 focused
- sharper than ordinary workbook practice
- clearly usable for Korean internal exams

[HEADER RULE]
Required visible header:
# MARCUS MIDDLE SCHOOL ELITE TEST
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide only one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All actual item sentences and options must remain natural English.

[FIXED SET RULE]
Generate exactly 25 items.
Default output must be 5-option multiple choice unless the user explicitly asks for descriptive items.

Use only:
① ...
② ...
③ ...
④ ...
⑤ ...

[MANDATORY DISTRIBUTION]
For one 25-item set:
- 8 items: grammar recognition with school-test discrimination
- 7 items: sentence transformation or revision logic
- 5 items: textbook-linked context or sentence expansion logic
- 5 items: mixed internal-exam trap items

[TEXTBOOK LOGIC RULE]
- keep the chapter logic obvious
- reflect Korean middle-school school-test patterns
- include answerable but discriminating traps
- do not become CSAT discourse material

[SHORT-TO-RICH EXPANSION]
If source material is too short or too easy, you may:
- expand sentences with natural modifiers
- embed clauses or phrases
- convert a simple line into a stronger school-test sentence
- increase trap value without exceeding middle-school appropriateness

[ANTI-LOW-QUALITY RULE]
Do NOT produce:
- all-easy beginner drills
- random disconnected items
- CSAT-style discourse-heavy questions
- trivial one-line blanks only
- content detached from textbook / chapter logic

[QUALITY RULE]
- remain middle-school appropriate
- sharpen for serious academy and 내신 use
- include real discrimination
- avoid generic repetition

[ANSWER KEY RULE]
After all items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

[EXPLANATION RULE]
Then provide:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
### Structural Logic 16-20
### Structural Logic 21-25

Explanations must be concise but structurally useful.
`;

// =========================
// 6) VOCAB BUILDER
// =========================
const vocabBuilderInstruction = `
You are the MARCUSNOTE Vocabulary Assessment Builder.

[OUTPUT GOAL]
Produce two sections:

SECTION 1:
MARCUS VOCABULARY LIST
- extract 20 important words if possible
- for each word provide:
  1. word
  2. part of speech
  3. Korean meaning
  4. short context hint

SECTION 2:
MARCUS VOCABULARY TEST
- generate exactly 20 vocabulary questions
- 5-option multiple choice only

Use only:
① ...
② ...
③ ...
④ ...
⑤ ...

[HEADER RULE]
Required header:
# MARCUS VOCABULARY BUILDER
[prepared source label]
Then provide one concise formal instruction line in the user's language.

[ANSWER KEY RULE]
After all items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

[EXPLANATION RULE]
Then provide:
### Vocabulary Notes 1-10
### Vocabulary Notes 11-20
`;

// =========================
// HELPERS
// =========================
function detectPromptLanguage(prompt = '') {
  if (/[가-힣]/.test(prompt)) return 'Korean';
  if (/[\u3040-\u30ff]/.test(prompt)) return 'Japanese';
  return 'English';
}

function containsKorean(text = '') {
  return /[가-힣]/.test(text);
}

function detectMagicSubMode(prompt = '') {
  const text = String(prompt || '');
  const lower = text.toLowerCase();
  const isKoreanPrompt = containsKorean(text);

  const koreanMagicSignals =
    isKoreanPrompt &&
    (
      /영작|서술형|내신|중등|중학교|중1|중2|중3|교과서|학원|다음 우리말|주어진 단어|clue|단서|배열|어순|조건에 맞게|문장을 쓰시오|영어로 쓰시오/.test(text) ||
      /translation|guided writing|sentence writing/.test(lower)
    );

  const globalMagicSignals =
    !isKoreanPrompt &&
    /paraphrase|rewrite|combine|combine the sentences|rewrite using|meaning-preserving|naturalize|natural expression|formal|concise|style|register|transform the sentence|production training/.test(lower);

  if (koreanMagicSignals) return MAGIC_SUBMODE.KOREAN_MAGIC;
  if (globalMagicSignals) return MAGIC_SUBMODE.GLOBAL_MAGIC;

  if (isKoreanPrompt) return MAGIC_SUBMODE.KOREAN_MAGIC;
  return MAGIC_SUBMODE.GENERAL_MAGIC;
}

function extractUserProvidedSource(prompt = '') {
  const text = prompt.trim();
  const patterns = [
    /(출처\s*[:：]\s*([^\n]+))/i,
    /(source\s*[:：]\s*([^\n]+))/i,
    /((?:20\d{2}|\d{4})\s*(?:년|march|june|september|november)?\s*(?:고1|고2|고3|grade\s*1|grade\s*2|grade\s*3)[^\n#]*#?\s*\d{1,2}번?)/i,
    /((?:중1|중2|중3)\s*[^\n]*lesson\s*\d+)/i,
    /((?:천재|동아|비상|능률|미래엔|ybm)[^\n]*(?:lesson|unit)\s*\d+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[2] || match[1] || '').trim();
  }

  return '';
}

function estimatePassageMeta(prompt = '', engineType = ENGINE_MODE.WORMHOLE) {
  const text = prompt.toLowerCase();
  let topic = 'General English';
  let level = 'Advanced';
  let itemType = '';

  if (/education|school|student|teacher|learning/.test(text)) topic = 'Education';
  else if (/science|technology|brain|research|experiment/.test(text)) topic = 'Science / Research';
  else if (/environment|nature|climate|animal|ecology/.test(text)) topic = 'Environment / Nature';
  else if (/society|culture|history|social/.test(text)) topic = 'Society / Culture';

  if (/중1|중2|중3|middle school|lesson|unit|교과서/.test(text)) level = 'Middle School';
  else if (/고1|grade 1/.test(text)) level = 'High School Grade 1';
  else if (/고2|grade 2/.test(text)) level = 'High School Grade 2';
  else if (/고3|grade 3|수능|csat/.test(text)) level = 'High School Grade 3';
  else if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) level = 'Middle School';
  else if (engineType === ENGINE_MODE.MOCK_EXAM) level = 'High School';
  else if (engineType === ENGINE_MODE.MAGIC) level = 'Middle / High School';
  else if (engineType === ENGINE_MODE.WORMHOLE) level = 'Middle / High School';

  if (/제목|title/.test(text)) itemType = 'Title Item';
  else if (/주제|main idea|gist/.test(text)) itemType = 'Main Idea Item';
  else if (/요지|purpose/.test(text)) itemType = 'Purpose / Gist Item';
  else if (/빈칸|blank|summary/.test(text)) itemType = 'Blank / Summary Item';
  else if (/삽입|insertion/.test(text)) itemType = 'Sentence Insertion Item';
  else if (/순서|sequence|order/.test(text)) itemType = 'Sequence Item';
  else if (/어휘|vocabulary|word|단어|어휘시험|어휘목록/.test(text)) itemType = 'Vocabulary Item';
  else if (/어법|grammar/.test(text)) itemType = 'Grammar Item';
  else if (/영작|writing|composition|rewrite|paraphrase|서술형/.test(text)) itemType = 'Production Training';

  return { topic, level, itemType };
}

function shortenSourceLabel(label = '') {
  return label
    .replace('High School Mock Exam Passage | High School Grade 1', 'G1 Mock Passage')
    .replace('High School Mock Exam Passage | High School Grade 2', 'G2 Mock Passage')
    .replace('High School Mock Exam Passage | High School Grade 3', 'G3 Mock Passage')
    .replace('High School Grade 1', 'G1')
    .replace('High School Grade 2', 'G2')
    .replace('High School Grade 3', 'G3')
    .replace('Purpose / Gist Item', 'Purpose/Gist')
    .replace('Main Idea Item', 'Main Idea')
    .replace('Title Item', 'Title')
    .replace('Blank / Summary Item', 'Blank/Summary')
    .replace('Sentence Insertion Item', 'Insertion')
    .replace('Vocabulary Item', 'Vocabulary')
    .replace('Middle School Textbook Passage', 'Middle School Textbook')
    .replace('Production Training', 'Production');
}

function buildSourceLabel(prompt = '', engineType = ENGINE_MODE.WORMHOLE) {
  const userSource = extractUserProvidedSource(prompt);

  if (userSource) {
    return { labelText: shortenSourceLabel(`Source: ${userSource}`) };
  }

  const meta = estimatePassageMeta(prompt, engineType);

  if (engineType === ENGINE_MODE.MOCK_EXAM) {
    const parts = ['High School Mock Exam Passage', meta.level];
    if (meta.itemType) parts.push(meta.itemType);
    return { labelText: shortenSourceLabel(`Estimated Source: ${parts.join(' | ')}`) };
  }

  if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return { labelText: shortenSourceLabel(`Estimated Source: Middle School Textbook | ${meta.level}`) };
  }

  if (engineType === ENGINE_MODE.MAGIC) {
    return { labelText: `Source Classification: MARCUS Production Selection - ${meta.topic}` };
  }

  if (engineType === ENGINE_MODE.VOCAB_BUILDER) {
    return { labelText: `Source Classification: MARCUS Vocabulary Selection - ${meta.topic}` };
  }

  return { labelText: `Source Classification: MARCUS Academic Selection - ${meta.topic}` };
}

function detectEngineTypeFromPrompt(prompt = '') {
  const text = String(prompt || '');
  const lower = text.toLowerCase();

  const explicit = {
    wormhole: /웜홀|wormhole|마커스웜홀|어색한 것|옳지 않은 것|옳은 것|어법상|개수는|유형이 같은|same error|same pattern|grammatically incorrect|grammatically correct/.test(text),
    magic: /매직|magic|영작|rewrite|paraphrase|작문|서술형|문장을 쓰시오|영어로 쓰시오|combine|rewrite using|production training/.test(lower) || /매직|영작|서술형|문장을 쓰시오|영어로 쓰시오/.test(text),
    vocab: /어휘|단어|vocab|vocabulary|어휘시험|단어시험/.test(text),
    mock: /모의고사 변형|mocks exam|mock exam|21번 변형|22번 변형|빈칸|삽입|순서|흐름|summary|blank|insertion|sequence|flow|주제|요지|제목|purpose|gist|title/.test(lower) || /모의고사 변형|빈칸|삽입|순서|흐름|주제|요지|제목/.test(text),
    middle: /교과서|중등|중학교|중1|중2|중3|내신|middle exam|middle textbook|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text)
  };

  if (explicit.wormhole) return ENGINE_MODE.WORMHOLE;
  if (explicit.magic) return ENGINE_MODE.MAGIC;
  if (explicit.vocab) return ENGINE_MODE.VOCAB_BUILDER;
  if (explicit.mock) return ENGINE_MODE.MOCK_EXAM;
  if (explicit.middle) return ENGINE_MODE.MIDDLE_TEXTBOOK;

  return ENGINE_MODE.WORMHOLE;
}

function normalizeMode(mode, prompt = '') {
  const requested = String(mode || '').trim().toUpperCase();

  if (requested === ENGINE_MODE.ABC_STARTER) return ENGINE_MODE.ABC_STARTER;
  if (requested === ENGINE_MODE.MOCK_EXAM) return ENGINE_MODE.MOCK_EXAM;
  if (requested === ENGINE_MODE.MIDDLE_TEXTBOOK) return ENGINE_MODE.MIDDLE_TEXTBOOK;
  if (requested === ENGINE_MODE.WORMHOLE) return ENGINE_MODE.WORMHOLE;
  if (requested === ENGINE_MODE.MAGIC) return ENGINE_MODE.MAGIC;
  if (requested === ENGINE_MODE.VOCAB_BUILDER) return ENGINE_MODE.VOCAB_BUILDER;

  return detectEngineTypeFromPrompt(prompt);
}

function resolveFinalMode(requestedMode, prompt = '') {
  const detectedMode = detectEngineTypeFromPrompt(prompt);
  const requested = normalizeMode(requestedMode || '', '');
  const hasRequested = !!String(requestedMode || '').trim();

  if (!hasRequested) {
    return {
      requestedMode: null,
      detectedMode,
      finalMode: detectedMode,
      modeAdjusted: false,
      modeNotice: ''
    };
  }

  if (requested === detectedMode) {
    return {
      requestedMode: requested,
      detectedMode,
      finalMode: requested,
      modeAdjusted: false,
      modeNotice: ''
    };
  }

  const explicitPriority = [
    ENGINE_MODE.WORMHOLE,
    ENGINE_MODE.MAGIC,
    ENGINE_MODE.VOCAB_BUILDER,
    ENGINE_MODE.MOCK_EXAM,
    ENGINE_MODE.MIDDLE_TEXTBOOK,
    ENGINE_MODE.ABC_STARTER
  ];

  const finalMode = explicitPriority.includes(detectedMode) ? detectedMode : requested;

  return {
    requestedMode: requested,
    detectedMode,
    finalMode,
    modeAdjusted: finalMode !== requested,
    modeNotice:
      finalMode !== requested
        ? `Input content matched ${finalMode} more strongly than ${requested}, so the engine was adjusted automatically.`
        : ''
  };
}

function getBaseInstructionByEngine(engineType) {
  switch (engineType) {
    case ENGINE_MODE.ABC_STARTER:
      return abcStarterInstruction;
    case ENGINE_MODE.MOCK_EXAM:
      return mockExamInstruction;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return middleTextbookInstruction;
    case ENGINE_MODE.MAGIC:
      return magicInstruction;
    case ENGINE_MODE.VOCAB_BUILDER:
      return vocabBuilderInstruction;
    case ENGINE_MODE.WORMHOLE:
    default:
      return wormholeInstruction;
  }
}

function buildRoutingControl(engineType, magicSubMode = MAGIC_SUBMODE.GENERAL_MAGIC) {
  if (engineType === ENGINE_MODE.ABC_STARTER) {
    return `
[ENGINE ROUTING]
- Selected Engine: ABC_STARTER
- Prioritize elementary foundation logic.
- Keep vocabulary and sentence length easy.
`;
  }

  if (engineType === ENGINE_MODE.MOCK_EXAM) {
    return `
[ENGINE ROUTING]
- Selected Engine: MOCK_EXAM
- Prioritize Korean high-school passage transformation logic.
- Force balanced item distribution.
- Avoid generic reading worksheet output.
`;
  }

  if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return `
[ENGINE ROUTING]
- Selected Engine: MIDDLE_TEXTBOOK
- Prioritize middle-school grammar and internal-exam logic.
- Strengthen textbook-linked school-test output.
- Avoid high-school discourse transformation.
`;
  }

  if (engineType === ENGINE_MODE.MAGIC) {
    return `
[ENGINE ROUTING]
- Selected Engine: MAGIC
- Selected MAGIC Submode: ${magicSubMode}
- Prioritize guided English production workbook logic.
- Never default to multiple choice unless explicitly requested.
- Keep submode identity obvious in the output pattern.
`;
  }

  if (engineType === ENGINE_MODE.VOCAB_BUILDER) {
    return `
[ENGINE ROUTING]
- Selected Engine: VOCAB_BUILDER
- Extract important vocabulary first, then build the test.
`;
  }

  return `
[ENGINE ROUTING]
- Selected Engine: WORMHOLE
- Prioritize high-difficulty grammar mock exam logic.
- Increase discrimination and trap design.
- Force question-type variety.
- Avoid simple one-line repetitive blanks.
`;
}

function getItemCountByEngine(engineType) {
  switch (engineType) {
    case ENGINE_MODE.ABC_STARTER:
      return 10;
    case ENGINE_MODE.MOCK_EXAM:
      return 15;
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return 25;
    case ENGINE_MODE.WORMHOLE:
      return 25;
    case ENGINE_MODE.MAGIC:
      return 25;
    case ENGINE_MODE.VOCAB_BUILDER:
      return 20;
    default:
      return 15;
  }
}

function buildMagicSubmodeControl(submode = MAGIC_SUBMODE.GENERAL_MAGIC) {
  if (submode === MAGIC_SUBMODE.KOREAN_MAGIC) {
    return `
[MAGIC SUBMODE ENFORCEMENT]
- Final MAGIC submode: KOREAN_MAGIC
- The set must clearly reflect Korean school writing-workbook logic.
- Prioritize clue-based writing, guided translation, prompt-word writing, transformation, word-order reconstruction, and constrained sentence production.
- The learner must be guided with clue words, target words, or grammatical conditions.
- Do not let the set become free paraphrase only.
`;
  }

  if (submode === MAGIC_SUBMODE.GLOBAL_MAGIC) {
    return `
[MAGIC SUBMODE ENFORCEMENT]
- Final MAGIC submode: GLOBAL_MAGIC
- The set must clearly reflect English-medium writing training logic.
- Prioritize paraphrasing, combining, rewriting with target grammar, style-control rewriting, concise/natural/formal revision, and meaning-preserving transformation.
- Do not let the set become Korean translation practice.
`;
  }

  return `
[MAGIC SUBMODE ENFORCEMENT]
- Final MAGIC submode: GENERAL_MAGIC
- Blend guided writing and rewriting.
- Keep clues visible and maintain structured support.
`;
}

const qualityControl = `
[FINAL QUALITY GATE]
Before finalizing the worksheet, silently verify all of the following:
1. No internal headings such as Phase 1, Phase 2, Meaning Layer, Structure Layer, or Deep Dive.
2. No repeated question stems testing the same point with small wording changes.
3. In WORMHOLE mode, do not let the set collapse into mostly single-sentence blanks.
4. In WORMHOLE mode, include correct/incorrect, count-based, same-pattern, revision, and mixed-trap pressure.
5. In WORMHOLE mode, ensure at least 3 count-type or same-pattern items are visibly present.
6. In MOCK_EXAM mode, force the required distribution across meaning, structure, blank, flow, vocabulary, and hybrid items.
7. In MOCK_EXAM mode, no more than 3 direct detail questions.
8. In MIDDLE_TEXTBOOK mode, remain middle-school appropriate but sharper than ordinary workbook output.
9. In MAGIC mode, include at least 5 activity types.
10. In KOREAN_MAGIC, the set must visibly contain clue-based guided writing.
11. In GLOBAL_MAGIC, the set must visibly contain paraphrase/combine/rewrite tasks.
12. In VOCAB mode, extracted vocabulary must be passage-essential.
13. Explanation lines must be specific enough to show the structural reason, not empty generic labels.
14. Remove code fences and visible meta artifacts.
15. Respect the selected final mode even if keywords overlap.
`;

function cleanOutputArtifacts(text = '') {
  return String(text || '')
    .replace(/```plaintext/gi, '')
    .replace(/```/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/©\s*2026\s*MARCUSNOTE\.\s*All rights reserved\./gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripDuplicateSourceLabels(text = '') {
  const lines = String(text || '').split('\n');
  const seen = new Set();
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isSource =
      /^Source:/i.test(trimmed) ||
      /^Estimated Source:/i.test(trimmed) ||
      /^Source Classification:/i.test(trimmed);

    if (isSource) {
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

function ensureSingleSourceLabel(text = '', labelText = '') {
  let cleaned = stripDuplicateSourceLabels(text).trim();
  const label = String(labelText || '').trim();

  if (!label) return cleaned;
  if (!cleaned) return label;

  if (cleaned.includes(label)) return cleaned;

  const lines = cleaned.split('\n');
  if (lines.length > 0 && /^#\s+/.test(lines[0].trim())) {
    lines.splice(1, 0, label);
    return lines.join('\n').trim();
  }

  return `${label}\n${cleaned}`.trim();
}

function countMatches(text = '', regex) {
  return (String(text || '').match(regex) || []).length;
}

function isLowQualityOutput(text = '', engineType = ENGINE_MODE.WORMHOLE, magicSubMode = MAGIC_SUBMODE.GENERAL_MAGIC) {
  const lower = String(text || '').toLowerCase();

  const weakWormhole =
    engineType === ENGINE_MODE.WORMHOLE &&
    (
      countMatches(lower, /fill in the blank/gi) >= 8 ||
      !/how many|same pattern|same type of error|best revision|preserves the meaning|grammatically incorrect|grammatically correct/gi.test(lower)
    );

  const weakMock =
    engineType === ENGINE_MODE.MOCK_EXAM &&
    (
      !/blank|summary|insertion|sequence|flow|purpose|gist|vocabulary|hybrid/gi.test(lower) ||
      countMatches(lower, /which of the following/gi) >= 12
    );

  const weakMiddle =
    engineType === ENGINE_MODE.MIDDLE_TEXTBOOK &&
    countMatches(lower, /fill in the blank/gi) >= 10 &&
    !/revision|rewrite|transformation|structure|expand/gi.test(lower);

  const weakMagicGeneral =
    engineType === ENGINE_MODE.MAGIC &&
    (
      countMatches(lower, /paraphrase/gi) + countMatches(lower, /combine/gi) + countMatches(lower, /rewrite/gi) + countMatches(lower, /translate/gi) < 4
    );

  const weakKoreanMagic =
    engineType === ENGINE_MODE.MAGIC &&
    magicSubMode === MAGIC_SUBMODE.KOREAN_MAGIC &&
    (
      !/[가-힣]/.test(text) ||
      (!/clue|단서|주어진|조건|활용하여|영어로 쓰시오|문장을 쓰시오/gi.test(text))
    );

  const weakGlobalMagic =
    engineType === ENGINE_MODE.MAGIC &&
    magicSubMode === MAGIC_SUBMODE.GLOBAL_MAGIC &&
    (
      !/paraphrase|combine|rewrite|natural|concise|formal/gi.test(lower)
    );

  const weakExplanation =
    /correct tense usage|proper grammar usage|correct form only|identify verb form only/gi.test(lower);

  return weakWormhole || weakMock || weakMiddle || weakMagicGeneral || weakKoreanMagic || weakGlobalMagic || weakExplanation;
}

// =========================
// API HANDLER
// =========================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      message: 'Method Not Allowed'
    });
  }

  const { prompt, mode } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      ok: false,
      message: 'Prompt required'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      ok: false,
      message: 'Missing OPENAI_API_KEY'
    });
  }

  if (!process.env.OPENAI_VECTOR_STORE_ID) {
    return res.status(500).json({
      ok: false,
      message: 'Missing OPENAI_VECTOR_STORE_ID'
    });
  }

  const normalizedPrompt = prompt.trim();
  const modeResolution = resolveFinalMode(mode, normalizedPrompt);
  const engineType = modeResolution.finalMode;
  const magicSubMode = engineType === ENGINE_MODE.MAGIC
    ? detectMagicSubMode(normalizedPrompt)
    : null;

  const baseInstruction = getBaseInstructionByEngine(engineType);
  const detectedLanguage = detectPromptLanguage(normalizedPrompt);
  const routingControl = buildRoutingControl(engineType, magicSubMode || MAGIC_SUBMODE.GENERAL_MAGIC);
  const itemCount = getItemCountByEngine(engineType);
  const sourceLabel = buildSourceLabel(normalizedPrompt, engineType);

  const languageControl = `
[LANGUAGE CONTROL]
- Detected user language: ${detectedLanguage}
- The instruction line must follow the detected user language.
- All test sentences and options must remain natural English unless the task explicitly requires otherwise.
`;

  const quantityControl = `
[QUANTITY CONTROL]
- Generate exactly ${itemCount} items when the selected engine uses a fixed set size.
- Every item must test a different learning point or answering pathway.
`;

  const sourceLabelControl = `
[SOURCE LABEL RULE]
- Add exactly one source label line near the top.
- Use this prepared source label:
${sourceLabel.labelText}
`;

  const vectorControl = `
[VECTOR STORE PRIORITY]
- Use retrieved vector-store knowledge as the primary policy layer.
- Strongly reflect the selected MARCUSNOTE mode.
- Do not fall back to generic worksheet behavior.
`;

  const modeAlignmentControl = modeResolution.modeAdjusted
    ? `
[MODE AUTO-CORRECTION]
- The user's selected button mode and prompt content did not match.
- Requested mode: ${modeResolution.requestedMode}
- Detected mode from prompt: ${modeResolution.detectedMode}
- Final enforced mode: ${modeResolution.finalMode}
- Generate output strictly in the final enforced mode.
`
    : '';

  const magicSubmodeControl =
    engineType === ENGINE_MODE.MAGIC
      ? buildMagicSubmodeControl(magicSubMode)
      : '';

  const fullSystemPrompt = [
    baseInstruction,
    routingControl,
    languageControl,
    quantityControl,
    vectorControl,
    sourceLabelControl,
    modeAlignmentControl,
    magicSubmodeControl,
    qualityControl
  ].join('\n');

  try {
    let response = await openai.responses.create({
      model: 'gpt-4o-mini',
      max_output_tokens:
        engineType === ENGINE_MODE.ABC_STARTER ? 1400 :
        engineType === ENGINE_MODE.VOCAB_BUILDER ? 2800 :
        engineType === ENGINE_MODE.MAGIC ? 4200 :
        engineType === ENGINE_MODE.WORMHOLE ? 5600 :
        engineType === ENGINE_MODE.MIDDLE_TEXTBOOK ? 4700 :
        engineType === ENGINE_MODE.MOCK_EXAM ? 4100 :
        3400,
      input: [
        {
          role: 'system',
          content: fullSystemPrompt
        },
        {
          role: 'user',
          content: normalizedPrompt
        }
      ],
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
          max_num_results: 5
        }
      ]
    });

    let finalText = response.output_text || '';

    if (normalizedPrompt.length < 5000 && isLowQualityOutput(finalText, engineType, magicSubMode || MAGIC_SUBMODE.GENERAL_MAGIC)) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens:
          engineType === ENGINE_MODE.WORMHOLE ? 5900 :
          engineType === ENGINE_MODE.MIDDLE_TEXTBOOK ? 4900 :
          engineType === ENGINE_MODE.MOCK_EXAM ? 4300 :
          engineType === ENGINE_MODE.MAGIC ? 4600 :
          3600,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              `
[RETRY OVERRIDE]
The previous draft was too generic, repetitive, or insufficiently aligned.

Mandatory corrections:
- Respect final mode exactly: ${engineType}
${engineType === ENGINE_MODE.MAGIC ? `- Respect final MAGIC submode exactly: ${magicSubMode}` : ''}
- Increase discrimination power or production depth
- Remove repetitive patterns
- Maintain exactly one source label
- Improve explanation specificity
- Keep premium academy / publication usability
- Do not submit a draft that could be mistaken for a generic worksheet
`
          },
          {
            role: 'user',
            content: normalizedPrompt
          }
        ],
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [process.env.OPENAI_VECTOR_STORE_ID],
            max_num_results: 5
          }
        ]
      });

      finalText = response.output_text || '';
    }

    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSingleSourceLabel(finalText, sourceLabel.labelText);

    return res.status(200).json({
      ok: true,
      requestedMode: modeResolution.requestedMode,
      detectedMode: modeResolution.detectedMode,
      finalMode: modeResolution.finalMode,
      magicSubMode,
      modeAdjusted: modeResolution.modeAdjusted,
      modeNotice: modeResolution.modeNotice,
      itemCount,
      response: finalText
    });
  } catch (error) {
    console.error('MARCUS Engine Error:', error);

    return res.status(500).json({
      ok: false,
      error: 'API Execution Failed',
      detail: error?.message || 'Unknown error'
    });
  }
};
