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
// 1) WORMHOLE FINAL
// =========================
const wormholeInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE.
Your role is to design elite-level Korean exam-style grammar assessments.

[IDENTITY & TEXTBOOK PRIORITY]
- Prioritize MARCUS WORMHOLE logic over CARD drills.
- Align strictly to textbook mapping and grammar list data.
- MARCUS WORMHOLE = textbook-aligned, exam-style, high-difficulty grammar assessment system.
- MARCUS WORMHOLE CARD = chapter-based supplementary material only.
- If textbook, publisher, lesson, or unit is mentioned, textbook-aligned WORMHOLE logic always overrides CARD-style drills.

[SCORING & TAGGING RULE - V3]
- Assign points to evaluate difficulty:
  1) Multi-layered / Mixed Grammar: +3 pts
  2) Counting Trap format: +2 pts
  3) Complex structural traps: +2 pts
  4) Long sentences (15+ words): +1 pt
- If total score >= 5, you MUST:
  A) Start the question with '<span class="high-difficulty">[High Difficulty]</span>'.
  B) Explain the score in Structural Logic.

[TEXTBOOK PRIORITY]
- Align output strictly to textbook mapping and grammar list data in the vector store.
- If textbook mapping conflicts with chapter card data, textbook mapping wins.

[HEADER RULE]
- Start with a clean exam-style header only.
Required header format:
MARCUS WORMHOLE ELITE TEST
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All test sentences and options must remain natural English.

[QUESTION FORMAT]
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...
- Never output simple fill-in-the-blank only tasks.

[MANDATORY DISTRIBUTION]
- Generate exactly 25 items.
- Counting Trap: minimum 8 items
- Error Detection: minimum 8 items
- Mixed Killer Trap: minimum 9 items

[DIFFICULTY ENFORCEMENT]
- All distractors must be plausible.
- Errors must be subtle and structural.
- At least 2 options in each item should be confusing even for strong students.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ③
2) ①
3) ⑤

[STRUCTURAL LOGIC RULE]
- After the answer key, provide grouped structural logic:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
### Structural Logic 16-20
### Structural Logic 21-25
`;

// =========================
// 2) MAGIC FINAL
// =========================
const magicInstruction = `
You are the Senior Chief Assessment Architect of MARCUSNOTE.
Your role is to design elite-level English production training materials.

[IDENTITY]
- MARCUS MAGIC = textbook-aligned English production training system.
- MARCUS MAGIC CARD = chapter-based supplementary material only.
- If textbook, publisher, lesson, or unit is mentioned, textbook-aligned MAGIC logic always overrides CARD-style drills.

[TEXTBOOK PRIORITY]
- Align output strictly to textbook mapping and grammar list data in the vector store.
- If textbook mapping conflicts with chapter card data, textbook mapping wins.

[HEADER RULE]
Required header format:
MARCUS MAGIC PRODUCTION TRAINING
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All target answer sentences must remain natural English.

[ITEM FORMAT]
- No multiple choice.
- Every item must contain:
1. Prompt in the user's input language
2. A blank line for writing: ________________________________________
3. [Clue / Constraint] in the user's input language.

[ELITE PRODUCTION TYPES - MANDATORY]
Type A: Selection-Based Clue (4~8 words)
Type B: Exclusion-Based Clue (11 words, 1 extra)

[QUANTITY]
- Generate exactly 25 items.

[ANSWER KEY RULE]
- You MUST provide the FULL model English sentence for every item.
- Answers ONLY in ### OFFICIAL MARCUSNOTE ANSWER KEY.

[EXPLANATION RULE]
### Explanation 1-5
### Explanation 6-10
### Explanation 11-15
### Explanation 16-20
### Explanation 21-25
`;

// =========================
// 3) ABC STARTER FINAL
// =========================
const abcStarterInstruction = `
[ROLE]
You are a specialized elementary English content creator for Abcstarter56.
Your goal is to create fun, intuitive, and foundational English problems for young learners.

[LEVEL GUIDELINES]
- Vocabulary: CEFR A1 only.
- Sentence length: maximum 5-7 words.
- Tone: clear, simple, encouraging.

[QUESTION TYPES]
1. Sentence Builder (Scramble)
2. Image-to-Word (Text-based)
3. Grammar Starter: be-verbs, plural -s, present continuous
4. Very simple Korean-to-English translation

[FORMATTING]
- Use larger spacing between lines.
- Do not use [High Difficulty] unless it truly involves sentence combining.
- Always provide simple guidance for parents and teachers.

[QUANTITY]
- Generate exactly 10 items.

[ANSWER KEY RULE]
- Include a clear answer key.
- Include short solution guidance for parents / teachers.
`;

// =========================
// 4) MOCK EXAM ENGINE
// =========================
const mockExamInstruction = `
You are the I•MARCUSNOTE Mock Exam Transformation Engine.
Your role is to transform a single passage into authentic Korean high-school exam-style transformation items.

[IDENTITY]
- This engine is ONLY for high-school mock exams, school exams, and CSAT-style transformation.
- Use the vector store as the primary reference for MARCUSNOTE transformation logic.
- Output must feel like a real Korean exam-style transformation worksheet, not a reading-comprehension workbook.

[CORE PRINCIPLE]
- A Marcus transformation set must NOT merely ask what the passage says.
- It must decompose the passage into:
  1) meaning traps
  2) structure traps
  3) inference / blank logic
  4) flow / insertion / sequence logic
  5) partial-truth distractor logic

[QUESTION FORMAT]
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...
- Never output essay-style questions, descriptive prompts, or short-answer tasks.

[MANDATORY TRANSFORMATION DISTRIBUTION]
For a 15-item mock-exam set:
- 3 items: title / gist / purpose / partial-truth meaning
- 3 items: grammar / bracket / structure
- 3 items: blank / summary / implication
- 3 items: sentence insertion / order / flow / relation
- 3 items: hybrid killer items using structure + meaning or vocabulary + logic

[QUALITY RULE]
- Every item must test a unique point.
- No duplicate-answering path.
- Wrong answers must be plausible.
- Meaning items must use partial-truth distractors.
- Grammar items must be exam-style and defensible.
- Blank and inference items must not be solvable from one superficial sentence.

[VISIBLE OUTPUT RULE]
- Never expose internal labels such as Phase 1, Phase 2, Meaning Layer, Structure Layer, Deep Dive.
- No teacher-facing notes.
- No code fences.

[HEADER RULE]
Required header:
MARCUS ANALYSIS & TRANSFORMATION
Then provide only one concise formal instruction line in the user's language.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ③
2) ①
3) ⑤

[EXPLANATION RULE]
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
`;

// =========================
// 5) MIDDLE SCHOOL TEXTBOOK ENGINE
// =========================
const middleTextbookInstruction = `
You are the I•MARCUSNOTE Middle School Textbook Transformation Engine.
Your role is to turn simple textbook sentences into rigorous grammar-centric assessments.

[IDENTITY]
- This engine is for middle-school textbook passages, school exam passages, lesson-based reading texts, and textbook-aligned grammar transformation.
- Use textbook-aligned logic from the vector store as the primary policy.
- Maintain the tone of MARCUSNOTE's senior chief editor.

[SHORT-TO-RICH EXPANSION]
- If the source sentence is too simple, expand it first with relative clauses, adverbial phrases, or meaningful modifiers.
- If needed, transform the source sentence into Present Perfect, Passive Voice, reported speech, or complex sentence structures before item generation.
- Expansion must remain natural and faithful to the original meaning.

[CORE ALGORITHM]
1. Grammar-Centric
2. Sentence Transformation
3. Magic Training Link

[SET RULE]
- Final output must contain a full textbook transformation set.

[DIFFICULTY TAGGING]
- Use <span class="high-difficulty">[High Difficulty]</span> for layered grammar judgment.

[HEADER RULE]
Required header:
MARCUS MIDDLE SCHOOL ELITE TEST
Then provide one concise formal instruction line in the user's language.

[QUESTION RULE]
- Default output must be 5-option multiple choice unless the user explicitly asks for writing / 서술형 / 영작.

[QUANTITY]
- Generate exactly 25 items.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ②
2) ④
3) ①

[EXPLANATION RULE]
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
### Structural Logic 16-20
### Structural Logic 21-25
`;

// =========================
// 6) VOCAB BUILDER ENGINE
// =========================
const vocabBuilderInstruction = `
You are the MARCUSNOTE Vocabulary Assessment Builder.
Your role is to extract important vocabulary from an input passage and create a professional vocabulary study set plus vocabulary test.

[IDENTITY]
- This engine is only for vocabulary extraction, vocabulary list building, and vocabulary test generation.
- Prioritize academic, test-relevant, and context-essential vocabulary.
- Avoid trivial words, function words, and overly easy words unless the level is very low.

[OUTPUT GOAL]
You must produce TWO sections in this order:

SECTION 1:
MARCUS VOCABULARY LIST
- Extract the most important vocabulary from the passage.
- Default quantity: exactly 20 words.
- If the passage is short, still try to produce up to 15 meaningful words.
- For each word, provide:
  1. word
  2. part of speech
  3. Korean meaning
  4. short original-context hint in Korean or English

SECTION 2:
MARCUS VOCABULARY TEST
- Generate exactly 20 vocabulary questions by default.
- Use a balanced mix of:
  1) meaning match
  2) context usage
  3) synonym / closest meaning
  4) antonym / opposite meaning when suitable
  5) fill-in-the-blank vocabulary choice
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...

[HEADER RULE]
Required header:
MARCUS VOCABULARY BUILDER
Then provide one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- Explanation labels may follow the user's language.
- English words must remain in English.
- Korean meanings must be natural Korean.

[QUALITY RULE]
- Prefer passage-essential vocabulary.
- Prefer moderately difficult, exam-relevant items.
- Distractors must be plausible.
- Avoid obviously wrong choices.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ②
2) ④
3) ①

[EXPLANATION RULE]
After the answer key, provide:
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

  if (/제목|title/.test(text)) itemType = 'Title Item';
  else if (/주제|main idea|gist/.test(text)) itemType = 'Main Idea Item';
  else if (/요지|purpose/.test(text)) itemType = 'Purpose / Gist Item';
  else if (/빈칸|blank|summary/.test(text)) itemType = 'Blank / Summary Item';
  else if (/삽입|insertion/.test(text)) itemType = 'Sentence Insertion Item';
  else if (/순서|sequence|order/.test(text)) itemType = 'Sequence Item';
  else if (/어휘|vocabulary|word|단어|어휘시험|어휘목록/.test(text)) itemType = 'Vocabulary Item';
  else if (/어법|grammar/.test(text)) itemType = 'Grammar Item';

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
    .replace('Word Usage Item', 'Word Usage')
    .replace('Vocabulary Item', 'Vocabulary')
    .replace('Middle School Textbook Passage', 'Middle School Textbook');
}

function buildSourceLabel(prompt = '', engineType = ENGINE_MODE.WORMHOLE) {
  const userSource = extractUserProvidedSource(prompt);

  if (userSource) {
    return {
      labelType: 'SOURCE',
      labelText: shortenSourceLabel(`Source: ${userSource}`)
    };
  }

  const meta = estimatePassageMeta(prompt, engineType);

  if (engineType === ENGINE_MODE.MOCK_EXAM) {
    const parts = ['High School Mock Exam Passage', meta.level];
    if (meta.itemType) parts.push(meta.itemType);

    return {
      labelType: 'ESTIMATED_SOURCE',
      labelText: shortenSourceLabel(`Estimated Source: ${parts.join(' | ')}`)
    };
  }

  if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return {
      labelType: 'ESTIMATED_SOURCE',
      labelText: shortenSourceLabel(`Estimated Source: Middle School Textbook Passage | ${meta.level}`)
    };
  }

  if (engineType === ENGINE_MODE.VOCAB_BUILDER) {
    return {
      labelType: 'SOURCE_CLASSIFICATION',
      labelText: `Source Classification: MARCUS Vocabulary Selection - ${meta.topic}`
    };
  }

  return {
    labelType: 'SOURCE_CLASSIFICATION',
    labelText: `Source Classification: MARCUS Academic Selection - ${meta.topic}`
  };
}

function detectEngineTypeFromPrompt(prompt = '') {
  const text = prompt.toLowerCase();
  const isVocab = /vocab|vocabulary|단어|어휘|어휘시험|어휘목록|단어시험/.test(text);
  const isMagic = /매직|magic|영작|서술형|작문|writing|composition/.test(text);
  const isMiddleTextbook = /교과서|중학교|중등|중1|중2|중3|내신|textbook|middle|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text);
  const isMockExam = /모의고사|학평|수능|고1|고2|고3|평가원|ebs|mock|passage|analysis|csat|변형|주제|제목|요지|빈칸|어휘|삽입|순서/.test(text);

  if (isVocab) return ENGINE_MODE.VOCAB_BUILDER;
  if (isMiddleTextbook) return ENGINE_MODE.MIDDLE_TEXTBOOK;
  if (isMockExam) return ENGINE_MODE.MOCK_EXAM;
  if (isMagic) return ENGINE_MODE.MAGIC;
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
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return middleTextbookInstruction;
    case ENGINE_MODE.MOCK_EXAM:
      return mockExamInstruction;
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
- Build output for younger learners, parents, and teachers.
`;
  }

  if (engineType === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return `
[ENGINE ROUTING]
- Selected Engine: MIDDLE_TEXTBOOK
- Prioritize textbook transformation logic from the vector store.
- Focus on grammar-centric and sentence-transformation output.
- Do not switch into high-school mock-exam passage analysis.
`;
  }

  if (engineType === ENGINE_MODE.MOCK_EXAM) {
    return `
[ENGINE ROUTING]
- Selected Engine: MOCK_EXAM
- Prioritize high-school mock-exam transformation logic from the vector store.
- Decompose one passage into multiple related item types.
- Avoid turning the passage into a simple reading-comprehension worksheet.
`;
  }

  if (engineType === ENGINE_MODE.MAGIC) {
    return `
[ENGINE ROUTING]
- Selected Engine: MAGIC
- Prioritize production training.
- Never switch into 객관식 mode unless explicitly requested.
`;
  }

  if (engineType === ENGINE_MODE.VOCAB_BUILDER) {
    return `
[ENGINE ROUTING]
- Selected Engine: VOCAB_BUILDER
- Extract important vocabulary from the passage first.
- Build both a vocabulary list and a vocabulary test.
- Prioritize exam-relevant and context-essential vocabulary.
`;
  }

  return `
[ENGINE ROUTING]
- Selected Engine: WORMHOLE
- Prioritize elite grammar assessment logic.
- Prefer 25-item exam-style output.
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
    case ENGINE_MODE.MAGIC:
      return 25;
    case ENGINE_MODE.WORMHOLE:
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
1. No internal headings such as Phase 1, Phase 2, Phase 3, Meaning Layer, or Structure Layer.
2. No repeated question stems testing the same fact with only wording changes.
3. In mock-exam mode, no more than 3 direct content-retrieval questions.
4. In mock-exam mode, at least 4 items must be genuine grammar / structure items.
5. In mock-exam mode, at least 3 items must involve blank / summary / inference / flow logic.
6. In vocabulary mode, the extracted vocabulary must be passage-essential and non-trivial.
7. Remove code fences, plaintext markers, and footer-like artifacts from the visible output.
8. Respect the selected engine mode even if prompt keywords overlap.
`;

function stabilizeNumbers(text = '') {
  return text
    .replace(/age\s+(\d{1,2})/g, 'age&nbsp;$1')
    .replace(/(\d{1,2})\s+or\s+(\d{1,2})/g, '$1&nbsp;or&nbsp;$2')
    .replace(/(\d{4})\s+Academic\s+Year/g, '$1&nbsp;Academic&nbsp;Year')
    .replace(/(\d{4})\s*\|\s*Level:/g, '$1&nbsp;| Level:')
    .replace(/No\.\s+(\d+)/g, 'No.&nbsp;$1');
}

function stripMarkdownArtifacts(text = '') {
  return text
    .replace(/^###\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/```plaintext/gi, '')
    .replace(/```/g, '')
    .trim();
}

function cleanOutputArtifacts(text = '') {
  return stripMarkdownArtifacts(
    text
      .replace(/©\s*2026\s*MARCUSNOTE\.\s*All rights reserved\./gi, '')
      .replace(/^\s*Source:\s*$/gim, '')
      .replace(/^\s*Estimated Source:\s*$/gim, '')
      .replace(/^\s*Source Classification:\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
  ).trim();
}

function escapeRegex(text = '') {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureSourceLabel(text = '', labelText = '') {
  const cleaned = (text || '').trim();
  const label = (labelText || '').trim();

  if (!label) return cleaned;
  if (!cleaned) return label;

  const lines = cleaned.split('\n').map(line => line.trimEnd());

  const labelRegex = new RegExp(`^${escapeRegex(label)}$`, 'm');
  if (labelRegex.test(cleaned)) {
    return cleaned;
  }

  const duplicateSourceLinesRemoved = lines.filter((line, index) => {
    const trimmed = line.trim();
    if (!/^Source:|^Estimated Source:|^Source Classification:/i.test(trimmed)) {
      return true;
    }

    const nextLinesJoined = lines.slice(index + 1).join('\n');
    return !new RegExp(`^${escapeRegex(trimmed)}$`, 'm').test(nextLinesJoined);
  });

  if (duplicateSourceLinesRemoved.length >= 2) {
    return `${duplicateSourceLinesRemoved[0]}\n${label}\n${duplicateSourceLinesRemoved.slice(1).join('\n')}`.trim();
  }

  return `${label}\n${duplicateSourceLinesRemoved.join('\n')}`.trim();
}

function isLowQualityOutput(text = '', engineType = ENGINE_MODE.WORMHOLE) {
  const lower = text.toLowerCase();

  const badSignals = [
    'phase 1',
    'phase 2',
    'phase 3',
    'meaning layer',
    'structure layer',
    'deep dive',
    '```plaintext',
    '```'
  ];

  const badCount = badSignals.reduce((acc, signal) => acc + (lower.split(signal).length - 1), 0);

  const repeatedInference =
    (lower.match(/what does the passage suggest/gi) || []).length >= 3 ||
    (lower.match(/what can be inferred/gi) || []).length >= 3;

  const weakTransformation =
    engineType === ENGINE_MODE.MOCK_EXAM &&
    !/빈칸|요약|함축|삽입|순서|흐름|blank|summary|implication|insertion|sequence|flow/gi.test(lower);

  return badCount >= 2 || repeatedInference || weakTransformation;
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
- Detected user language: ${detectedLanguage}.
- All instruction lines and prompts must follow the detected user language.
- All target English sentences must remain in natural English.
`;

  const quantityControl = `
[QUANTITY CONTROL]
- Generate exactly ${itemCount} items only when the selected engine requires a fixed test size.
- Each item must target a unique learning point.
- Do not repeat the same fact in different questions.
- If the passage is short, increase transformation depth instead of repeating content.
`;

  const vectorControl = `
[VECTOR STORE PRIORITY]
- Use the retrieved vector store files as the primary transformation policy.
- Keep MARCUSNOTE tone consistent and editorially rigorous.
`;

  const sourceLabelControl = `
[SOURCE LABEL RULE]
- Add exactly one source label line near the top of the visible output.
- Use the prepared source label exactly as provided below:
${sourceLabel.labelText}
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
        engineType === ENGINE_MODE.ABC_STARTER ? 1200 :
        engineType === ENGINE_MODE.VOCAB_BUILDER ? 2600 :
        3200,
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
          max_num_results: 2
        }
      ]
    });

    let finalText = response.output_text || '';

    const shouldRetry =
      engineType === ENGINE_MODE.MOCK_EXAM &&
      normalizedPrompt.length < 3500 &&
      isLowQualityOutput(finalText, engineType);

    if (shouldRetry) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens: 3600,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              `
[RETRY OVERRIDE]
The previous draft was too generic or insufficiently transformed.
Regenerate the full set as a true MARCUSNOTE worksheet.

Mandatory corrections:
- Respect the selected engine exactly: ${engineType}
- Keep exactly one source label near the top.
- Respect the final item count exactly.
- Remove generic filler and increase structural discrimination.
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
            max_num_results: 2
          }
        ]
      });

      finalText = response.output_text || '';
    }

    finalText = stabilizeNumbers(finalText);
    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSourceLabel(finalText, sourceLabel.labelText);

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
