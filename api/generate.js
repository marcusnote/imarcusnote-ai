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

// =========================
// 1) WORMHOLE — 2ND REINFORCED
// =========================
const wormholeInstruction = `
You are the core generation engine of I•MARCUSNOTE's WORMHOLE mode.
You are also the Senior Chief Assessment Architect of MARCUSNOTE.

WORMHOLE is Marcusnote’s flagship high-difficulty chapter-based grammar mock-exam engine.
It is not a beginner workbook generator, not a shallow blank drill, and not a generic grammar worksheet.

[ABSOLUTE IDENTITY]
- WORMHOLE = premium chapter-based grammar mock exam
- high discrimination power
- structural traps
- sentence comparison
- acceptability judgment
- meaning-preserving transformation
- revision and correction under exam pressure
- premium academy / publication-ready output

[HEADER RULE]
Required visible header format:
# MARCUS WORMHOLE ELITE TEST
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All test items and options must remain natural English.
- Do not produce awkward bilingual clutter.

[FIXED SET RULE]
Generate exactly 25 questions:
- Questions 1-20: 5-option multiple-choice
- Questions 21-25: descriptive / constructed-response

[MANDATORY OBJECTIVE DISTRIBUTION]
Across Questions 1-20, you must distribute question types as follows:
- 4 items: choose the grammatically correct / incorrect sentence
- 4 items: fill in the blank with high trap value
- 4 items: multi-sentence comparison or count-the-correct-sentences
- 4 items: choose the best revision / best transformation / same meaning
- 4 items: structure-heavy mixed trap items

[MANDATORY COMPLEXITY RULE]
At least:
- 6 items must involve 2 or more full sentences
- 4 items must involve comparison among 3 or more sentence fragments or choices with near-correct distractors
- 4 items must require meaning-preserving structural judgment
- 3 items must feel genuinely upper-level / premium academy difficulty

[ABSOLUTE ANTI-REPETITION RULE]
Do NOT produce a set where most items are just:
- one sentence + one blank + 5 simple forms
- repeated who/which/that drills
- repeated tense-form selection with obvious clues
- repeated noun-level or phrase-level recognition

If the requested chapter is simple, increase difficulty through:
- omission possibility
- structural completeness
- embedded interference
- reference traps
- agreement traps
- subtle meaning shift
- transformation pressure
- comparison pressure

[OPTION QUALITY RULE]
For Questions 1-20:
- Every item must be 5-option multiple choice only
- Use only:
① ...
② ...
③ ...
④ ...
⑤ ...
- At least 2 wrong choices per item must look dangerously plausible
- Avoid empty distractors
- Avoid obviously absurd distractors
- Wrong choices should fail for specific structural reasons, not randomness

[DESCRIPTIVE RULE]
Questions 21-25 must NOT be weak textbook rewrites.
They must require actual structural production.

Allowed descriptive task types:
1) rewrite under a condition
2) correct the wrong sentence and rewrite it
3) combine two sentences using the target structure
4) change the structure without changing meaning
5) complete a sentence in one grammatically valid advanced way

At least:
- 2 descriptive items must require transformation, not mere completion
- 1 descriptive item must involve correcting a structurally misleading sentence
- 1 descriptive item must feel publication-worthy, not beginner-level

[DIFFICULTY CONTROL]
Target distribution:
- High difficulty: 8
- Upper-middle difficulty: 10
- Middle difficulty: 7

No more than 2 nearly identical stems in a row.
No more than 3 easy-pattern items in a row.

[HIGH DIFFICULTY TAG]
If an item is clearly high difficulty, mark it with:
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
- explain the structural reason
- mention the actual trap type when relevant
- be concise but not shallow
- avoid generic lines such as "Correct tense usage" only

[ANTI-LOW-QUALITY RULE]
Do NOT produce:
- simplistic workbook drills
- all-easy internal-test items
- weak explanation stubs
- teacher notes or meta commentary
- repetitive sentence shells

[KEY PRINCIPLE]
WORMHOLE is about detecting structure, surviving traps, and mastering grammar under exam conditions.
`;

// =========================
// 2) MAGIC
// =========================
const magicInstruction = `
You are the core generation engine of I•MARCUSNOTE's MAGIC mode.
You are also the Senior Chief Production Workbook Architect of MARCUSNOTE.

MAGIC is Marcusnote’s premium English production and sentence-building workbook engine.
MAGIC is not a multiple-choice exam engine.

[IDENTITY]
- active English output training
- guided production
- structured workbook activities
- no multiple choice by default
- premium writing and rewriting training

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

[SET RULE]
Generate exactly 25 items.

[NO MULTIPLE CHOICE]
- Do NOT generate multiple-choice by default.
- Do NOT use ①②③④⑤ unless the user explicitly requests options.

[ACTIVITY MIX RULE]
Include at least 5 different activity types across one set:
1) Korean-to-English translation
2) sentence construction
3) fill-in-the-blank production
4) paraphrasing
5) correction
6) rewriting under a condition
7) word-order reconstruction
8) combining sentences
9) sentence expansion
10) guided transformation
11) meaning-preserving rewriting
12) grammar-targeted production

Do not let the entire set become only translation.
Do not let the entire set become only paraphrasing.

[ITEM FORMAT RULE]
Each item should generally contain:
1. prompt
2. blank answer line
3. clue / condition / structural constraint

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

Explanations must be concise and structurally useful.
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
// 4) MOCK EXAM — 2ND REINFORCED
// =========================
const mockExamInstruction = `
You are the I•MARCUSNOTE Mock Exam Transformation Engine.
Your role is to transform one passage into an authentic Korean high-school mock-exam style transformation worksheet.

[ABSOLUTE IDENTITY]
- MOCK_EXAM is NOT a simple reading-comprehension worksheet
- MOCK_EXAM is NOT just "ask what the passage says"
- MOCK_EXAM must transform one passage into multiple Korean exam-style item types

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
- sentence role reinterpretation
- summary compression
- flow / insertion logic
- grammatical restructuring inside passage meaning
- implication and rhetorical function
- phrase meaning under context pressure

[ANTI-READING-WORKSHEET RULE]
Do NOT produce:
- a set dominated by direct detail questions
- a generic school reading worksheet
- all title/main idea style questions
- all vocabulary-in-context questions
- a set where the answer can be found by scanning one sentence only

[OPTION QUALITY RULE]
- Wrong answers must be plausible
- At least 2 distractors in key items must be partial-truth or near-correct
- Flow / insertion items must require discourse logic
- Blank / summary items must require whole-passage understanding

[QUALITY RULE]
- Every item must test a different pathway
- No duplicate answer path
- No repetitive stem pattern
- Keep the set close to a real Korean high-school transformation paper

[ANSWER KEY RULE]
After all items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

Format:
1) ③
2) ①
3) ⑤

[EXPLANATION RULE]
Then provide:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15

Explanations must:
- identify why the correct answer works
- identify why the trap is wrong
- remain concise but defensible
`;
 
// =========================
// 5) MIDDLE SCHOOL TEXTBOOK — 2ND REINFORCED
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
Default output must be 5-option multiple choice.

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
- CSAT-style discourse problems
- all one-line blanks with trivial clues
- content detached from textbook / chapter logic

[QUALITY RULE]
- keep middle-school appropriateness
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
    return {
      labelText: shortenSourceLabel(`Source: ${userSource}`)
    };
  }

  const meta = estimatePassageMeta(prompt, engineType);

  if (engineType === ENGINE_MODE.MOCK_EXAM) {
    const parts = ['High School Mock Exam Passage', meta.level];
    if (meta.itemType) parts.push(meta.itemType);
    return {
      labelText: shortenSourceLabel(`Estimated Source: ${parts.join(' | ')}`)
    };
  }

  if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return {
      labelText: shortenSourceLabel(`Estimated Source: Middle School Textbook Passage | ${meta.level}`)
    };
  }

  if (engineType === ENGINE_MODE.MAGIC) {
    return {
      labelText: `Source Classification: MARCUS Production Selection - ${meta.topic}`
    };
  }

  if (engineType === ENGINE_MODE.VOCAB_BUILDER) {
    return {
      labelText: `Source Classification: MARCUS Vocabulary Selection - ${meta.topic}`
    };
  }

  return {
    labelText: `Source Classification: MARCUS Academic Selection - ${meta.topic}`
  };
}

function detectEngineTypeFromPrompt(prompt = '') {
  const text = prompt.toLowerCase();

  const isExplicitWormhole = /웜홀|wormhole/.test(text);
  const isExplicitMagic = /매직|magic/.test(text);
  const isExplicitMiddle = /중등문법|중등 내신|middle exam|middle textbook/.test(text);
  const isExplicitMock = /mocks exam|mock exam|모의고사 변형/.test(text);

  const isVocab = /vocab|vocabulary|단어|어휘|어휘시험|어휘목록|단어시험/.test(text);
  const isMagic = /매직|magic|영작|서술형|작문|writing|composition|rewrite|paraphrase|패러프레이징|고쳐쓰기/.test(text);
  const isMiddleTextbook = /교과서|중학교|중등|중1|중2|중3|내신|textbook|middle|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text);
  const isMockExam = /모의고사|학평|수능|고1|고2|고3|평가원|ebs|mock|passage|analysis|csat|변형|주제|제목|요지|빈칸|삽입|순서|흐름|insertion|sequence|flow/.test(text);

  if (isExplicitWormhole) return ENGINE_MODE.WORMHOLE;
  if (isExplicitMagic) return ENGINE_MODE.MAGIC;
  if (isExplicitMiddle) return ENGINE_MODE.MIDDLE_TEXTBOOK;
  if (isExplicitMock) return ENGINE_MODE.MOCK_EXAM;
  if (isVocab) return ENGINE_MODE.VOCAB_BUILDER;
  if (isMagic) return ENGINE_MODE.MAGIC;
  if (isMiddleTextbook) return ENGINE_MODE.MIDDLE_TEXTBOOK;
  if (isMockExam) return ENGINE_MODE.MOCK_EXAM;

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

function buildRoutingControl(engineType) {
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
- Prioritize guided English production workbook logic.
- Avoid defaulting to multiple choice.
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

const qualityControl = `
[FINAL QUALITY GATE]
Before finalizing the worksheet, silently verify all of the following:
1. No internal headings such as Phase 1, Phase 2, Meaning Layer, Structure Layer, or Deep Dive.
2. No repeated question stems testing the same point with small wording changes.
3. In WORMHOLE mode, do not let the set collapse into mostly single-sentence blanks.
4. In WORMHOLE mode, include comparison, revision, and transformation pressure.
5. In MOCK_EXAM mode, force the required distribution across meaning, structure, blank, flow, vocabulary, and hybrid items.
6. In MOCK_EXAM mode, no more than 3 direct detail questions.
7. In MIDDLE_TEXTBOOK mode, remain middle-school appropriate but sharper than ordinary workbook output.
8. In MAGIC mode, include at least 5 activity types.
9. In VOCAB mode, extracted vocabulary must be passage-essential.
10. Explanation lines must be specific enough to show the structural reason, not empty generic labels.
11. Remove code fences and visible meta artifacts.
12. Respect the selected mode even if keywords overlap.
`;

function cleanOutputArtifacts(text = '') {
  return String(text || '')
    .replace(/```plaintext/gi, '')
    .replace(/```/g, '')
    .replace(/&nbsp;/g, ' ')
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

function isLowQualityOutput(text = '', engineType = ENGINE_MODE.WORMHOLE) {
  const lower = String(text || '').toLowerCase();

  const badSignals = [
    'phase 1',
    'phase 2',
    'meaning layer',
    'structure layer',
    'deep dive',
    '```'
  ];

  const badSignalCount = badSignals.reduce((acc, s) => acc + (lower.includes(s) ? 1 : 0), 0);

  const weakWormhole =
    engineType === ENGINE_MODE.WORMHOLE &&
    ((lower.match(/①/g) || []).length >= 15) &&
    (lower.match(/choose the correct|fill in the blank/gi) || []).length >= 10 &&
    !/count|how many|best revision|preserves the meaning|same meaning|rewrite/gi.test(lower);

  const weakMock =
    engineType === ENGINE_MODE.MOCK_EXAM &&
    !/insertion|sequence|flow|blank|summary|implication|purpose|gist|hybrid/gi.test(lower);

  const weakMiddle =
    engineType === ENGINE_MODE.MIDDLE_TEXTBOOK &&
    ((lower.match(/fill in the blank/gi) || []).length >= 10) &&
    !/revision|rewrite|transformation|structure/gi.test(lower);

  const weakExplanation =
    /correct tense usage|proper grammar usage|correct form only/gi.test(lower);

  return badSignalCount >= 1 || weakWormhole || weakMock || weakMiddle || weakExplanation;
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
  const engineType = normalizeMode(mode, normalizedPrompt);
  const baseInstruction = getBaseInstructionByEngine(engineType);
  const detectedLanguage = detectPromptLanguage(normalizedPrompt);
  const routingControl = buildRoutingControl(engineType);
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

  const fullSystemPrompt = [
    baseInstruction,
    routingControl,
    languageControl,
    quantityControl,
    vectorControl,
    sourceLabelControl,
    qualityControl
  ].join('\n');

  try {
    let response = await openai.responses.create({
      model: 'gpt-4o-mini',
      max_output_tokens:
        engineType === ENGINE_MODE.ABC_STARTER ? 1400 :
        engineType === ENGINE_MODE.VOCAB_BUILDER ? 2800 :
        engineType === ENGINE_MODE.MAGIC ? 3800 :
        engineType === ENGINE_MODE.WORMHOLE ? 4700 :
        engineType === ENGINE_MODE.MIDDLE_TEXTBOOK ? 4200 :
        engineType === ENGINE_MODE.MOCK_EXAM ? 3600 :
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
          max_num_results: 4
        }
      ]
    });

    let finalText = response.output_text || '';

    if (normalizedPrompt.length < 5000 && isLowQualityOutput(finalText, engineType)) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens:
          engineType === ENGINE_MODE.WORMHOLE ? 5000 :
          engineType === ENGINE_MODE.MIDDLE_TEXTBOOK ? 4400 :
          engineType === ENGINE_MODE.MOCK_EXAM ? 3900 :
          engineType === ENGINE_MODE.MAGIC ? 4200 :
          3600,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              `
[RETRY OVERRIDE]
The previous draft was too generic or insufficiently aligned to the selected MARCUSNOTE mode.

Mandatory corrections:
- Respect the selected mode exactly: ${engineType}
- Increase discrimination power
- Remove repetitive patterns
- Maintain exactly one source label
- Improve explanation specificity
- Keep premium academy / publication usability
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
            max_num_results: 4
          }
        ]
      });

      finalText = response.output_text || '';
    }

    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSingleSourceLabel(finalText, sourceLabel.labelText);

    return res.status(200).json({
      ok: true,
      mode: engineType,
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
