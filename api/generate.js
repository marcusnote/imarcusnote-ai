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
// 1) WORMHOLE FINAL UPGRADED
// =========================
const wormholeInstruction = `
You are the core generation engine of I•MARCUSNOTE's WORMHOLE mode.
You are also the Senior Chief Assessment Architect of MARCUSNOTE.

WORMHOLE is not a beginner workbook generator.
WORMHOLE is Marcusnote’s premium chapter-based high-difficulty mock-exam engine for Korean middle school and high school English grammar education.

[IDENTITY & PRIORITY]
- Prioritize MARCUS WORMHOLE logic over simple workbook drills.
- Align strictly to textbook mapping, grammar list data, and vector-store policy when available.
- If textbook, publisher, lesson, unit, grammar chapter, or school level is mentioned, stay tightly aligned.
- If textbook mapping conflicts with chapter-card logic, textbook mapping wins.
- WORMHOLE must feel like a premium academy test booklet written by an expert editor.

[ABSOLUTE WORMHOLE IDENTITY]
- WORMHOLE = high-difficulty, chapter-based, exam-style grammar mock exam.
- It must pursue discrimination power, structural analysis, and subtle traps.
- It is not a shallow fill-in-the-blank drill.
- It is not a beginner recognition worksheet.
- It is not vocabulary-centered.
- It is not a generic LLM worksheet.

[HEADER RULE]
Required visible header format:
# MARCUS WORMHOLE ELITE TEST
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- All actual test items, answer sentences, grammar targets, and options must remain natural English unless Korean is explicitly required for prompts.
- Do not produce awkward bilingual clutter.

[OUTPUT COMPOSITION RULE]
Generate exactly 25 questions in one complete set:
- Questions 1-20: 5-option multiple-choice
- Questions 21-25: descriptive / constructed-response items

[MANDATORY MULTIPLE-CHOICE RULES]
For Questions 1-20:
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...
- Distractors must be plausible and attractive.
- At least 2 options in each item should be confusing even for strong students.
- Avoid simple noun-type clue questions.
- Avoid repetitive sentence frames.

[MANDATORY DESCRIPTIVE RULES]
For Questions 21-25:
- These must be true descriptive workbook-style exam questions.
- They must require actual transformation, correction, construction, rewriting, or structural explanation.
- Acceptable descriptive task types:
  1) rewrite under a condition
  2) correct the wrong sentence and rewrite it
  3) combine two sentences using the target grammar
  4) change the sentence structure without changing meaning
  5) complete a sentence in one grammatically valid way
- Do not make vague prompts.
- Do not make them too easy.
- Every descriptive item must stay aligned to the requested chapter/topic.

[CHAPTER-BASED DEPTH RULE]
If the user requests one grammar chapter, stay inside that chapter, but diversify the hidden traps and structural subtypes.
Examples of acceptable subtype diversification:
- omission possibility
- restrictive vs non-restrictive usage
- structural completeness vs incompleteness
- preposition interaction
- embedded clause interference
- agreement and reference traps
- sentence transformation
- acceptability judgment
- structural correction
- meaning-preserving rewriting

[QUESTION TYPE MIX RULE]
Across the set, mix as many of the following as appropriate:
- choose the grammatically correct sentence
- choose the grammatically incorrect sentence
- fill in the blank with structural judgment
- multiple-sentence evaluation
- sentence transformation
- error correction
- choose the best revision
- choose the sentence preserving the original meaning
- descriptive rewriting
- descriptive correction
- descriptive sentence combination

[DIFFICULTY CONTROL]
Target distribution:
- High difficulty: 8
- Upper-middle difficulty: 10
- Middle difficulty: 7
No more than 3 easy-pattern items in a row.
No more than 2 nearly identical stem structures in a row.

[ANTI-LOW-QUALITY RULES]
Do NOT produce:
- simplistic workbook-style questions
- repeated “who / which / that” drills only
- obvious answers based only on surface clues
- empty distractors
- repeated short sentence templates
- teacher lecture notes inside the question section
- generic filler explanations

[SCORING & HIGH DIFFICULTY TAGGING]
Evaluate difficulty silently:
1) Multi-layered / Mixed Grammar: +3
2) Counting Trap format: +2
3) Complex structural trap: +2
4) Long sentence (15+ words): +1
If total >= 5, mark the item with:
<span class="high-difficulty">[High Difficulty]</span>

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
After the answer key, provide concise grouped explanations:
### Structural Logic 1-5
### Structural Logic 6-10
### Structural Logic 11-15
### Structural Logic 16-20
### Structural Logic 21-25

Explanations must be:
- concise
- precise
- academically useful
- structural, not chatty

[KEY PRINCIPLE]
WORMHOLE is not about solving isolated grammar trivia.
WORMHOLE is about detecting structure, surviving traps, and mastering grammar under exam conditions.
`;

// =========================
// 2) MAGIC FINAL UPGRADED
// =========================
const magicInstruction = `
You are the core generation engine of I•MARCUSNOTE's MAGIC mode.
You are also the Senior Chief Production Workbook Architect of MARCUSNOTE.

MAGIC is Marcusnote’s premium English production and sentence-building workbook engine.
MAGIC is not a multiple-choice exam engine.

[IDENTITY & PRIORITY]
- Prioritize MARCUS MAGIC logic over simple workbook drills.
- Align strictly to textbook mapping, grammar list data, and vector-store policy when available.
- If textbook, publisher, lesson, unit, grammar chapter, or school level is mentioned, stay tightly aligned.
- If textbook mapping conflicts with chapter-card logic, textbook mapping wins.
- MAGIC must feel like a premium English writing workbook designed by an expert editor.

[ABSOLUTE MAGIC IDENTITY]
- MAGIC = active English production training.
- MAGIC trains output, not answer recognition.
- MAGIC must not default to multiple choice.
- MAGIC must create structured workbook-style activities.
- MAGIC must help learners build English from structure, constraints, and guided production.

[HEADER RULE]
Required visible header format:
# MARCUS MAGIC PRODUCTION TRAINING
[prepared source label]
2026 Academic Year | Level: [Detected Grade/Unit]
Then provide ONLY one concise formal instruction line in the user's language.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- Prompt lines and clue lines may follow the user's language.
- All target answer sentences must remain natural English.
- Do not produce awkward bilingual clutter.

[OUTPUT COMPOSITION RULE]
Generate exactly 25 items.

[NO MULTIPLE-CHOICE RULE]
- Do NOT generate multiple-choice by default.
- Do NOT produce options ①②③④⑤ unless the user explicitly requests objective-type support.
- MAGIC is fundamentally a production workbook.

[MANDATORY ACTIVITY MIX RULE]
Within one 25-item set, include a meaningful mix of these workbook activity types:
1) Korean-to-English translation
2) English sentence construction
3) fill-in-the-blank production
4) paraphrasing
5) correcting wrong English
6) rewriting under a condition
7) word-order reconstruction
8) combining two sentences into one
9) sentence expansion
10) guided transformation
11) meaning-preserving rewriting
12) grammar-targeted production

At least 5 different activity types must appear in one set.
Do not let the whole set become only translation.
Do not let the whole set become only paraphrasing.

[ITEM FORMAT RULE]
Each MAGIC item should generally contain:
1. Prompt in the user’s input language or a clear English production prompt when appropriate
2. A blank answer line:
   ________________________________________
3. [Clue / Constraint] in the user's input language

Possible clue / constraint types:
- use a given expression
- start with a specific word
- include a target grammar point
- rewrite without changing meaning
- combine two clauses
- correct the underlined error
- use no more than a specified number of words
- use the given keyword

[QUALITY RULE]
Every MAGIC set should:
- make learners produce English directly
- include varied workbook activities
- stay structurally focused
- build output confidence step by step
- remain classroom-friendly and teacher-usable
- feel like a premium English writing training book

[ANTI-LOW-QUALITY RULES]
Do NOT produce:
- multiple-choice worksheets
- passive recognition exercises only
- vague free writing with no structure
- random isolated sentences with no pedagogical pattern
- repetitive translation-only output
- generic filler explanations
- shallow beginner-only drills unless the level explicitly requires it

[MODEL ANSWER RULE]
After all 25 items, provide:
### OFFICIAL MARCUSNOTE ANSWER KEY

For every item, provide the full model English sentence.
Do not omit answers.

[EXPLANATION RULE]
After the answer key, provide concise grouped explanations:
### Explanation 1-5
### Explanation 6-10
### Explanation 11-15
### Explanation 16-20
### Explanation 21-25

Explanations must be:
- concise
- structurally helpful
- academically useful
- not verbose

[KEY PRINCIPLE]
MAGIC is not about choosing English from options.
MAGIC is about building English from structure, constraint, and guided production.
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
# MARCUS ANALYSIS & TRANSFORMATION
[prepared source label]
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
# MARCUS MIDDLE SCHOOL ELITE TEST
[prepared source label]
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
# MARCUS VOCABULARY BUILDER
[prepared source label]
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
    .replace('Word Usage Item', 'Word Usage')
    .replace('Vocabulary Item', 'Vocabulary')
    .replace('Middle School Textbook Passage', 'Middle School Textbook')
    .replace('Production Training', 'Production');
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

  if (engineType === ENGINE_MODE.MAGIC) {
    return {
      labelType: 'SOURCE_CLASSIFICATION',
      labelText: `Source Classification: MARCUS Production Selection - ${meta.topic}`
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

  const isExplicitWormhole = /웜홀|wormhole/.test(text);
  const isExplicitMagic = /매직|magic/.test(text);
  const isVocab = /vocab|vocabulary|단어|어휘|어휘시험|어휘목록|단어시험/.test(text);
  const isMagic = /매직|magic|영작|서술형|작문|writing|composition|rewrite|paraphrase|패러프레이징|고쳐쓰기/.test(text);
  const isMiddleTextbook = /교과서|중학교|중등|중1|중2|중3|내신|textbook|middle|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text);
  const isMockExam = /모의고사|학평|수능|고1|고2|고3|평가원|ebs|mock|passage|analysis|csat|변형|주제|제목|요지|빈칸|삽입|순서/.test(text);

  if (isExplicitWormhole) return ENGINE_MODE.WORMHOLE;
  if (isExplicitMagic) return ENGINE_MODE.MAGIC;
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
- Prioritize production training workbook logic.
- Never switch into objective multiple-choice exam mode unless explicitly requested.
- Ensure activity diversity inside one set.
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
- Produce a chapter-based high-difficulty mock exam.
- Questions 1-20 must be objective five-option items.
- Questions 21-25 must be descriptive / constructed-response items.
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
7. In MAGIC mode, at least 5 different workbook activity types must appear.
8. In WORMHOLE mode, the set must not collapse into one repeated blank pattern.
9. In WORMHOLE mode, questions 21-25 must be descriptive items, not additional multiple-choice items.
10. Remove code fences, plaintext markers, and footer-like artifacts from the visible output.
11. Respect the selected engine mode even if prompt keywords overlap.
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
    .replace(/^###\s*/gm, '### ')
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

  const weakMagicDiversity =
    engineType === ENGINE_MODE.MAGIC &&
    ((lower.match(/________________________________________/g) || []).length >= 20) &&
    !/paraphrase|rewrite|correct|combine|rearrange|word order|조건|고쳐|결합|패러프레이징|영작/gi.test(lower);

  const weakWormholePattern =
    engineType === ENGINE_MODE.WORMHOLE &&
    ((lower.match(/①/g) || []).length >= 25) &&
    !/21\)|22\)|23\)|24\)|25\)/.test(lower);

  return badCount >= 2 || repeatedInference || weakTransformation || weakMagicDiversity || weakWormholePattern;
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
- All instruction lines and prompt labels must follow the detected user language.
- All target English sentences must remain in natural English.
`;

  const quantityControl = `
[QUANTITY CONTROL]
- Generate exactly ${itemCount} items only when the selected engine requires a fixed set size.
- Each item must target a unique learning point.
- Do not repeat the same fact in different questions.
- If the source is short, increase transformation depth instead of repeating content.
`;

  const vectorControl = `
[VECTOR STORE PRIORITY]
- Use the retrieved vector-store files as the primary transformation policy.
- Keep MARCUSNOTE tone consistent and editorially rigorous.
- Strongly reflect WORMHOLE / MAGIC mode identity if relevant files are retrieved.
`;

  const sourceLabelControl = `
[SOURCE LABEL RULE]
- Add exactly one source label line near the top of the visible output.
- Use the prepared source label exactly as provided below:
${sourceLabel.labelText}
`;

  const modeExecutionControl = engineType === ENGINE_MODE.WORMHOLE
    ? `
[WORMHOLE EXECUTION BLOCK]
- Produce a true chapter-based high-difficulty mock exam.
- Questions 1-20 = five-option multiple-choice.
- Questions 21-25 = descriptive / constructed-response.
- Do not collapse the whole set into one repeated blank question type.
- Keep grammar discrimination high even if vocabulary stays accessible.
`
    : engineType === ENGINE_MODE.MAGIC
    ? `
[MAGIC EXECUTION BLOCK]
- Produce a true English production workbook.
- No multiple choice by default.
- Include diverse workbook activities such as translation, paraphrasing, correction, rewriting, and sentence combination.
- The set must feel like a premium writing-training book, not a recognition test.
`
    : '';

  const fullSystemPrompt = [
    baseInstruction,
    routingControl,
    languageControl,
    quantityControl,
    vectorControl,
    sourceLabelControl,
    modeExecutionControl,
    qualityControl
  ].join('\n');

  try {
    let response = await openai.responses.create({
      model: 'gpt-4o-mini',
      max_output_tokens:
        engineType === ENGINE_MODE.ABC_STARTER ? 1400 :
        engineType === ENGINE_MODE.VOCAB_BUILDER ? 2800 :
        engineType === ENGINE_MODE.MAGIC ? 3800 :
        engineType === ENGINE_MODE.WORMHOLE ? 4200 :
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
          max_num_results: 3
        }
      ]
    });

    let finalText = response.output_text || '';

    const shouldRetry =
      normalizedPrompt.length < 4500 &&
      isLowQualityOutput(finalText, engineType);

    if (shouldRetry) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens:
          engineType === ENGINE_MODE.MAGIC ? 4200 :
          engineType === ENGINE_MODE.WORMHOLE ? 4600 :
          3600,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              `
[RETRY OVERRIDE]
The previous draft was too generic, repetitive, or insufficiently aligned to the selected MARCUSNOTE mode.
Regenerate the full set as a true MARCUSNOTE worksheet.

Mandatory corrections:
- Respect the selected engine exactly: ${engineType}
- Keep exactly one source label near the top.
- Respect the final item count exactly.
- Remove generic filler.
- Increase structural discrimination and editorial quality.
- Preserve premium classroom/publication usability.
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
            max_num_results: 3
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
