const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
  1) Multi-layered/Mixed Grammar (e.g., Present Perfect + Passive): +3 pts
  2) Counting Trap format: +2 pts
  3) Complex structural traps (Inversion, subtle tense shifts): +2 pts
  4) Long sentences (15+ words): +1 pt
- If total score ≥ 5, you MUST:
  A) Start the question with '<span class="high-difficulty">[High Difficulty]</span>'.
  B) Explain the score in Structural Logic (e.g., "7) [Level: 5pts] (Reason: Mixed Grammar + Counting Trap)").
- FORMAT RULE: Keep years and numbers (e.g., 2010, 2015) on the SAME LINE as the sentence. Never break lines for dates.

[REASONING OUTPUT]
- For every [High Difficulty] item, include the specific scoring reason in the 'Structural Logic' section.
- Example: "Item 7 [High Difficulty] (Reason: Combined Past Perfect + Counting Trap format)"

[TEXTBOOK PRIORITY]
- Align output strictly to textbook mapping and grammar list data in the vector store.
- If textbook mapping conflicts with chapter card data, textbook mapping wins.

[QUANTITY]
- Generate a full elite grammar assessment set.
- Follow the final quantity control later in the system prompt.
- Never apologize.
- Never refuse.
- Never provide a sample set instead of the full worksheet.

[HEADER RULE]
- Do NOT generate numbered instructions.
- Do NOT generate long explanatory paragraphs before the test.
- Start with a clean exam-style header only.

Required header format:
MARCUS WORMHOLE ELITE TEST
2026 Academic Year | Level: [Detected Grade/Unit]

Then provide ONLY one concise formal instruction line in the user's language.
Examples:
- 다음 문항을 읽고 어법상 옳은 것을 고르시오.
- Read the following items and choose the grammatically appropriate answer.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- Never mix multiple languages in one instruction block.
- All test sentences and options must remain natural English.
- Never translate the English sentences into another language inside the question section.

[QUESTION FORMAT]
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...

- Never output:
  - simple fill-in-the-blank
  - direct sentence transformation drills
  - descriptive tasks such as “find and explain”
  - answer hints inside the question section

[MANDATORY DISTRIBUTION]
You must follow this exact distribution:
1. Counting Trap (minimum 8 items)
   - Example style: 다음 중 어법상 옳은 것의 개수를 고르시오.
   - Must require counting across multiple sentences

2. Error Detection (minimum 8 items)
   - Example style: 다음 중 어법상 옳지 않은 것은?
   - Options must be structurally similar and deceptive

3. Mixed Killer Trap (minimum 9 items)
   - Must combine at least 2 grammar concepts in one item
   - At least 60% of sentences overall must be 10+ words long

[DIFFICULTY ENFORCEMENT]
- All distractors must be plausible.
- Errors must be subtle and structural, not obvious spelling or vocabulary mistakes.
- At least 2 options in each item should be confusing even for strong students.

[STRICT RULES]
- Every item must be 5-option multiple choice (①-⑤).
- Never include answers or hints in the question section.
- Put answers ONLY in ### OFFICIAL MARCUSNOTE ANSWER KEY.

[ANSWER KEY RULE]
- Put all answers ONLY in the final answer section.
- Do NOT include any extra text after the last answer.
- Do NOT include:
  - Verified by...
  - footer text
  - stray numbering
  - commentary after the answer list

Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ③
2) ①
3) ⑤

[STRUCTURAL LOGIC RULE]
- After the answer key, provide grouped structural logic in this format:
### Structural Logic 1-5
...
### Structural Logic 6-10
...
### Structural Logic 11-15
...
### Structural Logic 16-20
...
### Structural Logic 21-25
...
- Each block must explain the trap types and why wrong options fail.
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

[QUANTITY]
- Generate a full elite production-training set.
- Follow the final quantity control later in the system prompt.
- Never apologize.
- Never refuse.
- Never provide a sample set instead of the full worksheet.

[HEADER RULE]
- Do NOT generate numbered instructions.
- Do NOT generate long explanatory paragraphs before the worksheet.
- Start with a clean production-training header only.

Required header format:
MARCUS MAGIC PRODUCTION TRAINING
2026 Academic Year | Level: [Detected Grade/Unit]

Then provide ONLY one concise formal instruction line in the user's language.
Examples:
- 다음 문장을 영어로 쓰시오.
- Write each sentence in natural English.

[LANGUAGE RULE]
- The instruction language must match the user's input language.
- Never mix multiple languages in one instruction block.
- All target answer sentences must remain natural English.
- Never translate the final English answers into another language.

[ITEM FORMAT]
- No multiple choice.
- Every item must contain:
1. Prompt in the user's input language
2. A blank line for writing: ________________________________________
3. [Clue / Constraint] in the user's input language.

[ELITE PRODUCTION TYPES - MANDATORY]
You must distribute the set using these two high-difficulty types:

Type A: Selection-Based Clue (4~8 words)
- Provide a 10+ word target sentence.
- Give 4~8 essential words as clues.
- Student must construct the full sentence using these and adding necessary elements.

Type B: Exclusion-Based Clue (11 words, 1 extra)
- Provide 11 words as clues.
- One word is a "Distractor" that MUST be excluded.
- Student must identify the unnecessary word and write the correct 10-word sentence.

[ITEM FORMAT]
1. Prompt (User Language)
2. A blank line (________________________________________)
3. [Clue: word1, word2, ... / Constraint: Use only 10 words, exclude 1 irrelevant word]

[DIFFICULTY TAGGING]
- Use <span class="high-difficulty">[High Difficulty]</span> for layered structure items.

[PRODUCTION RULE]
- Focus on sentence production, transformation, paraphrasing, and layered structure control.
- At least 30% of items must involve combined or layered grammar.
- Difficulty should gradually rise across the set.
- ELITE PRODUCTION RULE: At least 50% of items must be complex sentences (12+ words). Do not just translate simple S+V+O; include modifiers like relative clauses or adverbs.

[ANSWER KEY RULE]
- You MUST provide the FULL model English sentence for every item.
- Never leave the answer key blank.
- Do NOT include any text after the final model answer.

[STRICT RULES]
- NO multiple choice.
- NO answers in the question section (Never show [Answer] or model sentences here).
- Answers ONLY in ### OFFICIAL MARCUSNOTE ANSWER KEY (Full model sentences).

Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1. [full model sentence]
2. [full model sentence]
3. [full model sentence]

[EXPLANATION RULE]
- After the answer key, provide grouped explanations:
### Explanation 1-5
...
### Explanation 6-10
...
### Explanation 11-15
...
### Explanation 16-20
...
### Explanation 21-25
...
- Each block must explain key structures and common learner mistakes.
`;

// =========================
// 3) MOCK EXAM ENGINE
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

[QUESTION FORMAT - MANDATORY]
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...

- Never output:
  - essay-style questions
  - descriptive prompts
  - open-ended questions
  - "설명하시오"
  - "분석하시오"
  - "제시하시오"
  - "만들어 보시오"
  - direct short-answer tasks

[MANDATORY TRANSFORMATION DISTRIBUTION]
For a 15-item mock-exam set:
- 3 items: title / gist / purpose / partial-truth meaning
- 3 items: grammar / bracket / structure
- 3 items: blank / summary / implication
- 3 items: sentence insertion / order / flow / relation
- 3 items: hybrid killer items using structure + meaning or vocabulary + logic

[STEP-BY-STEP ITEM ROUTING]
Items 1-3 = Meaning Layer
Items 4-6 = Structure Layer
Items 7-9 = Deep Inference Layer
Items 10-12 = Flow Logic Layer
Items 13-15 = Marcus Killer Layer

[QUALITY RULE]
- Every item must test a unique point.
- No duplicate-answering path.
- Wrong answers must be plausible.
- Meaning items must use partial-truth distractors.
- Grammar items must be exam-style and defensible.
- Blank and inference items must not be solved by one superficial sentence.
- Output must feel like a Korean school exam, not a workbook.

[VISIBLE OUTPUT RULE]
- Never expose internal labels such as Phase 1, Phase 2, Meaning Layer, Structure Layer, Deep Dive.
- No teacher-facing notes.
- No markdown bold.
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
After the answer key, provide grouped explanations:
### Structural Logic 1-5
...
### Structural Logic 6-10
...
### Structural Logic 11-15
...
`;

// =========================
// 4) MIDDLE SCHOOL TEXTBOOK ENGINE
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
2. Sentence Transformation (Mandatory)
3. Magic Training Link

[SET RULE]
- Final output must still contain a full textbook transformation set.
- Follow the final quantity control later in the system prompt.

[DIFFICULTY TAGGING]
- Use <span class="high-difficulty">[High Difficulty]</span> for items involving layered grammar judgment.

[QUESTION FORMAT - MANDATORY]
- Every item must be 5-option multiple choice only.
- Use only this option format:
① ...
② ...
③ ...
④ ...
⑤ ...

- Never output:
  - essay-style questions
  - descriptive prompts
  - open-ended questions
  - "설명하시오"
  - "분석하시오"
  - "제시하시오"
  - "만들어 보시오"
  - direct short-answer tasks
  - sentence-writing tasks in the visible question section

[HEADER RULE]
Required header:
MARCUS MIDDLE SCHOOL ELITE TEST

Then provide one concise formal instruction line in the user's language.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ②
2) ④
3) ①

[EXPLANATION RULE]
After the answer key, provide grouped explanations:
### Structural Logic 1-5
...
### Structural Logic 6-10
...
### Structural Logic 11-15
...
`;
  
// =========================
// HELPERS
// =========================
function detectPromptLanguage(prompt) {
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

function estimatePassageMeta(prompt = '', engineType = 'WORMHOLE') {
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
  else if (engineType === 'MIDDLE_TEXTBOOK') level = 'Middle School';
  else if (engineType === 'MOCK_EXAM') level = 'High School';

  if (/제목|title/.test(text)) itemType = 'Title Item';
  else if (/주제|main idea|gist/.test(text)) itemType = 'Main Idea Item';
  else if (/요지|purpose/.test(text)) itemType = 'Purpose / Gist Item';
  else if (/빈칸|blank|summary/.test(text)) itemType = 'Blank / Summary Item';
  else if (/삽입|insertion/.test(text)) itemType = 'Sentence Insertion Item';
  else if (/순서|sequence|order/.test(text)) itemType = 'Sequence Item';
  else if (/어휘|vocabulary|word/.test(text)) itemType = 'Word Usage Item';
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
    .replace('Middle School Textbook Passage', 'Middle School Textbook');
}

function buildSourceLabel(prompt = '', engineType = 'WORMHOLE') {
  const userSource = extractUserProvidedSource(prompt);
  if (userSource) {
    return { labelType: 'SOURCE', labelText: shortenSourceLabel(`Source: ${userSource}`) };
  }

  const meta = estimatePassageMeta(prompt, engineType);

  if (engineType === 'MOCK_EXAM') {
    const parts = ['High School Mock Exam Passage', meta.level];
    if (meta.itemType) parts.push(meta.itemType);
    return {
      labelType: 'ESTIMATED_SOURCE',
      labelText: shortenSourceLabel(`Estimated Source: ${parts.join(' | ')}`)
    };
  }

  if (engineType === 'MIDDLE_TEXTBOOK') {
    return {
      labelType: 'ESTIMATED_SOURCE',
      labelText: shortenSourceLabel(`Estimated Source: Middle School Textbook Passage | ${meta.level}`)
    };
  }

  return {
    labelType: 'SOURCE_CLASSIFICATION',
    labelText: `Source Classification: MARCUS Academic Selection - ${meta.topic}`
  };
}

function detectEngineType(prompt) {
  const text = prompt.toLowerCase();
  const isMagic = /매직|magic|영작|서술형|작문|writing|composition/.test(text);
  const isMiddleTextbook = /교과서|중학교|중등|중1|중2|중3|내신|textbook|middle|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text);
  const isMockExam = /모의고사|학평|수능|고1|고2|고3|평가원|ebs|mock|passage|analysis|csat|변형|주제|제목|요지|빈칸|어휘|삽입|순서|24번|23번|30번|31번/.test(text);

  if (isMockExam) return 'MOCK_EXAM';
  if (isMiddleTextbook) return 'MIDDLE_TEXTBOOK';
  if (isMagic) return 'MAGIC';
  return 'WORMHOLE';
}

function getBaseInstructionByEngine(engineType) {
  switch (engineType) {
    case 'MIDDLE_TEXTBOOK': return middleTextbookInstruction;
    case 'MOCK_EXAM': return mockExamInstruction;
    case 'MAGIC': return magicInstruction;
    default: return wormholeInstruction;
  }
}

function buildRoutingControl(engineType) {
  if (engineType === 'MIDDLE_TEXTBOOK') {
    return `
[ENGINE ROUTING]
- Selected Engine: MIDDLE_TEXTBOOK
- Prioritize textbook transformation logic from the vector store.
- Focus on grammar-centric and sentence-transformation output.
`;
  }

  if (engineType === 'MOCK_EXAM') {
    return `
[ENGINE ROUTING]
- Selected Engine: MOCK_EXAM
- Prioritize high-school mock-exam transformation logic from the vector store.
- Decompose one passage into multiple related item types.
- Avoid turning the passage into a simple reading-comprehension worksheet.
`;
  }

  if (engineType === 'MAGIC') {
    return `
[ENGINE ROUTING]
- Selected Engine: MAGIC
- Prioritize production training.
`;
  }

  return `
[ENGINE ROUTING]
- Selected Engine: WORMHOLE
- Prioritize elite grammar assessment logic.
`;
}

function getItemCountByEngine(engineType) {
  switch (engineType) {
    case 'MOCK_EXAM': return 15;
    case 'MIDDLE_TEXTBOOK': return 15;
    case 'MAGIC': return 15;
    case 'WORMHOLE': return 25;
    default: return 15;
  }
}

const qualityControl = `
[FINAL QUALITY GATE]
Before finalizing the worksheet, silently verify all of the following:
1. No internal headings such as "Phase 1", "Phase 2", "Phase 3", "Meaning Layer", or "Structure Layer".
2. No repeated question stems testing the same fact with only wording changes.
3. In mock-exam mode, no more than 3 direct content-retrieval questions.
4. In mock-exam mode, at least 4 items must be genuine grammar/structure items.
5. In mock-exam mode, at least 3 items must involve blank / summary / inference / flow logic.
6. Remove code fences, plaintext markers, and footer-like artifacts from the visible output.
7. Never leave the answer key incomplete.
8. Never stop before finishing all required Structural Logic sections.
`;

function stabilizeNumbers(text = '') {
  return text
    .replace(/age\s+(\d{1,2})/g, 'age&nbsp;$1')
    .replace(/(\d{1,2})\s+or\s+(\d{1,2})/g, '$1&nbsp;or&nbsp;$2')
    .replace(/(\d{4})\s+Academic\s+Year/g, '$1&nbsp;Academic&nbsp;Year')
    .replace(/(\d{4})\s*\|\s*Level:/g, '$1&nbsp;| Level:')
    .replace(/No\.\s+(\d+)/g, 'No.&nbsp;$1');
}

function cleanOutputArtifacts(text = '') {
  return text
    .replace(/```plaintext/gi, '')
    .replace(/```/g, '')
    .replace(/©\s*2026\s*MARCUSNOTE\.\s*All rights reserved\./gi, '')
    .replace(/^\s*Source:\s*$/gim, '')
    .replace(/^\s*Estimated Source:\s*$/gim, '')
    .replace(/^\s*Source Classification:\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegex(text = '') {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureSourceLabel(text = '', labelText = '') {
  const cleaned = (text || '').trim();
  const label = (labelText || '').trim();
  if (!label) return cleaned;
  if (!cleaned) return label;

  const alreadyExists = new RegExp(`^${escapeRegex(label)}$`, 'm').test(cleaned);
  if (alreadyExists) return cleaned;

  const lines = cleaned.split('\n').map(line => line.trimEnd());
  if (lines.length >= 2) return `${lines[0]}\n${label}\n${lines.slice(1).join('\n')}`.trim();
  return `${label}\n${cleaned}`.trim();
}

function countQuestionItems(text = '') {
  const matches = text.match(/(?:^|\n)\s*(?:\d+[\)\.]|①|1\))/g);
  return matches ? matches.length : 0;
}

function countAnswerKeyItems(text = '') {
  const answerKeySection = text.split('### OFFICIAL MARCUSNOTE ANSWER KEY')[1] || '';
  const matches = answerKeySection.match(/\b\d+\)\s*[①②③④⑤1-5]/g);
  return matches ? matches.length : 0;
}

function hasMarkdownHeaderArtifacts(text = '') {
  return /(^|\n)###\s+/m.test(text);
}

function isLowQualityOutput(text = '', engineType = '') {
  const lower = text.toLowerCase();
  const badSignals = [
    '### phase 1',
    '### phase 2',
    '### phase 3',
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
    engineType === 'MOCK_EXAM' &&
    !/빈칸|요약|함축|삽입|순서|흐름|blank|summary|implication|insertion|sequence|flow/gi.test(lower);

  const expectedCount = engineType === 'WORMHOLE' ? 25 : 15;
  const questionCount = countQuestionItems(text);
  const answerKeyCount = countAnswerKeyItems(text);

  const incompleteSet =
    questionCount < Math.max(10, expectedCount - 2) ||
    answerKeyCount < Math.max(5, expectedCount - 3);

  const brokenFormat =
    hasMarkdownHeaderArtifacts(text) ||
    !text.includes('### OFFICIAL MARCUSNOTE ANSWER KEY');

  return badCount >= 2 || repeatedInference || weakTransformation || incompleteSet || brokenFormat;
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
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ message: 'Missing OPENAI_API_KEY' });
  }

  if (!process.env.OPENAI_VECTOR_STORE_ID) {
    return res.status(500).json({ message: 'Missing OPENAI_VECTOR_STORE_ID' });
  }

  const normalizedPrompt = prompt.trim();
  const engineType = detectEngineType(normalizedPrompt);
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
- Generate exactly ${itemCount} items only.
- Complete all ${itemCount} questions, the full official answer key, and all required Structural Logic sections in one response.
- Do not stop early.
- Do not omit the answer key.
- Do not omit any Structural Logic section required by the selected engine.
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
      max_output_tokens: 5200,
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
          max_num_results: 6
        }
      ]
    });

    let finalText = response.output_text || '';

    const shouldRetry =
      (engineType === 'MOCK_EXAM' || engineType === 'MIDDLE_TEXTBOOK' || engineType === 'WORMHOLE') &&
      isLowQualityOutput(finalText, engineType);

    if (shouldRetry) {
      response = await openai.responses.create({
        model: 'gpt-4o-mini',
        max_output_tokens: 5200,
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              '\n' +
              `
[RETRY OVERRIDE]
The previous draft was incomplete, weakly formatted, or insufficiently transformed.
Regenerate the full set as a complete MARCUSNOTE exam worksheet.

Mandatory corrections:
- Finish all required questions.
- Finish the full official answer key.
- Finish all required Structural Logic sections.
- Keep exactly one source label line near the top.
- Respect the final item count exactly.
- Keep 5-option multiple-choice format where required.
- Remove markdown header artifacts in the visible output.
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
            max_num_results: 6
          }
        ]
      });

      finalText = response.output_text || '';
    }

    finalText = stabilizeNumbers(finalText);
    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSourceLabel(finalText, sourceLabel.labelText);

    return res.status(200).json({
      response: finalText
    });
  } catch (error) {
    console.error('MARCUS Engine Error:', error);
    return res.status(500).json({
      error: 'API Execution Failed',
      detail: error?.message || 'Unknown error'
    });
  }
};
