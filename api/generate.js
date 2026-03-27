import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
// 3) MOCK EXAM ENGINE (High School) - STRONG MARCUS PATCH
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

[ORIGINAL ITEM PRESERVATION]
- If the source resembles a title / main idea / purpose / gist item, preserve that original category in at least 2 transformed items.
- If the source resembles a blank / summary / grammar item, preserve that category in at least 2 transformed items.
- Do not ignore the original exam identity of the source passage.

[ANTI-COMPREHENSION-WORKSHEET RULE]
- Do not generate more than 3 direct content-retrieval questions.
- Do not ask multiple questions that can be answered by the same single sentence in the passage.
- If an item only checks surface recall, replace it with a transformed logic, grammar, summary, or partial-truth item.
- Never let the set feel like a simple reading worksheet.

[MANDATORY TRANSFORMATION DISTRIBUTION]
For a 15-item mock-exam set:
- 3 items: title / gist / purpose / partial-truth meaning
- 3 items: grammar / bracket / structure
- 3 items: blank / summary / implication
- 3 items: sentence insertion / order / flow / relation
- 3 items: hybrid killer items using structure + meaning or vocabulary + logic

[STEP-BY-STEP ITEM ROUTING]
For a 15-item mock-exam set, assign item roles strictly by number:

Items 1-3 = Meaning Layer
- title / gist / purpose / partial-truth meaning

Items 4-6 = Structure Layer
- bracket grammar / error detection / word usage in context

Items 7-9 = Deep Inference Layer
- blank inference / summary completion / implication

Items 10-12 = Flow Logic Layer
- sentence insertion / order / relation / logic flow

Items 13-15 = Marcus Killer Layer
- hybrid transformation items combining meaning + structure,
  or vocabulary + logic, or structure + inference

Do not repeat the same item type in adjacent layers unless the passage absolutely requires it.

[QUALITY RULE]
- Every item must test a unique point.
- No duplicate-answering path.
- Grammar items must be based on actual passage language or valid transformed sentences derived from it.
- Error-detection items must contain a real and defensible structural issue.
- Never ask to identify a grammatical error in a fully correct sentence.
- Avoid shallow factual retrieval unless it is transformed into a real exam trap.

[PARTIAL TRUTH DISTRACTOR RULE]
- Meaning-based distractors must include partial-truth traps.
- Wrong options must sound plausible but fail due to scope, degree, causality, implication, logical focus, or distorted emphasis.

[STRUCTURE ITEM RULE]
- At least 4 items must require structural judgment.
- Acceptable structure item types:
  - bracket grammar
  - error detection
  - transformed sentence judgment
  - word usage in context
  - connector / logic flow judgment

[DEEP ITEM RULE]
- At least 3 items must require inference beyond sentence-level recall.
- Acceptable deep item types:
  - blank inference
  - summary completion
  - sentence insertion
  - sequence / flow
  - implication

[VISIBLE OUTPUT RULE]
- Never expose internal labels such as:
  - Phase 1
  - Phase 2
  - Phase 3
  - Meaning Layer
  - Structure Layer
  - Deep Dive
- No teacher-facing notes.
- No markdown emphasis like **question text**.
- No code fences.

[HEADER RULE]
Required header:
MARCUS ANALYSIS & TRANSFORMATION

Then provide only one concise formal instruction line in the user's language.

[QUANTITY]
- Follow the final quantity control later in the system prompt.
- Do not mention this override.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ③
2) ①
3) ⑤

[EXPLANATION DEPTH RULE]
- Each Structural Logic explanation must contain:
  1) why the correct answer is correct
  2) why at least one major distractor fails
- Avoid one-line memo style explanations.

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
   - Prioritize Tense, Subject-Verb Agreement, Gerund/Infinitive, Conjunctions, Word Order, and basic relative clauses.
2. Sentence Transformation (Mandatory)
   - Include Active ↔ Passive
   - Include Direct ↔ Indirect Speech
   - Include Simple ↔ Complex Sentence transformation
3. Magic Training Link
   - Allocate at least 30% of items to controlled English production or conditional writing prompts.

[SET RULE]
- Even for a short passage, generate at least 5 meaningful item patterns internally.
- Final output must still contain a full textbook transformation set.
- Target distribution:
  - Vocabulary / Meaning: 10%
  - Grammar Selection: 40%
  - Sentence Transformation: 30%
  - Controlled Writing: 20%
- Follow the final quantity control later in the system prompt.

[DIFFICULTY TAGGING]
- Use <span class="high-difficulty">[High Difficulty]</span> for items involving:
  - advanced relative clauses
  - subjunctive mood
  - mixed transformation logic
  - layered grammar judgment

[FORMAT]
- You may mix multiple-choice and production items only if the user's request clearly permits it.
- Otherwise, prioritize school-exam-friendly grammar multiple choice plus sentence transformation.

[HEADER RULE]
Required header:
MARCUS MIDDLE SCHOOL ELITE TEST

Then provide one concise formal instruction line in the user's language.

[QUANTITY]
- Follow the final quantity control later in the system prompt.
- Do not mention this override in the output.

[STRICT RULES]
- Never generate trivial textbook-level items without transformation pressure.
- Never rely only on title/main idea if the passage is short.
- Always create grammar value and school-exam discrimination.

[ANSWER KEY RULE]
Required answer key format:
### OFFICIAL MARCUSNOTE ANSWER KEY
1) ②
2) ④
3) [model answer]

[EXPLANATION RULE]
After the answer key, provide grouped explanations:
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
`;

// =========================
// 5) HELPER: LANGUAGE
// =========================
function detectPromptLanguage(prompt) {
  if (/[가-힣]/.test(prompt)) return 'Korean';
  if (/[\u3040-\u30ff]/.test(prompt)) return 'Japanese';
  return 'English';
}

// =========================
// 5-1) HELPER: SOURCE LABEL SYSTEM
// =========================
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
    if (match) {
      return (match[2] || match[1] || '').trim();
    }
  }

  return '';
}

function estimatePassageMeta(prompt = '', engineType = 'WORMHOLE') {
  const text = prompt.toLowerCase();

  let topic = 'General English';
  let level = 'Advanced';
  let itemType = '';

  if (/habit|gym|exercise|bundling|motivation|behavior|psychology|peer|emotion/.test(text)) {
    topic = 'Psychology / Behavior';
  } else if (/business|market|consumer|economics|productivity/.test(text)) {
    topic = 'Business / Economics';
  } else if (/environment|nature|climate|animal|ecology/.test(text)) {
    topic = 'Environment / Nature';
  } else if (/science|technology|brain|research|experiment/.test(text)) {
    topic = 'Science / Research';
  } else if (/education|school|student|teacher|learning/.test(text)) {
    topic = 'Education';
  } else if (/society|culture|history|social/.test(text)) {
    topic = 'Society / Culture';
  }

  if (/중1|중2|중3|middle school|lesson|unit|교과서/.test(text)) {
    level = 'Middle School';
  } else if (/고1|grade 1/.test(text)) {
    level = 'High School Grade 1';
  } else if (/고2|grade 2/.test(text)) {
    level = 'High School Grade 2';
  } else if (/고3|grade 3|수능|csat/.test(text)) {
    level = 'High School Grade 3';
  } else if (engineType === 'MIDDLE_TEXTBOOK') {
    level = 'Middle School';
  } else if (engineType === 'MOCK_EXAM') {
    level = 'High School';
  }

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
    .replace('High School Mock Exam Passage', 'G1 Mock Passage')
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
    return {
      labelType: 'SOURCE',
      labelText: shortenSourceLabel(`Source: ${userSource}`)
    };
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

// =========================
// 6) HELPER: ENGINE ROUTER
// =========================
function detectEngineType(prompt) {
  const text = prompt.toLowerCase();

  const isMagic =
    /매직|magic|영작|서술형|작문|writing|composition/.test(text);

  const isMiddleTextbook =
    /교과서|중학교|중등|중1|중2|중3|내신|textbook|middle|lesson|unit|천재|동아|비상|능률|미래엔|ybm/.test(text);

  const isMockExam =
    /모의고사|학평|수능|고1|고2|고3|평가원|ebs|mock|passage|analysis|csat|변형|주제|제목|요지|빈칸|어휘|삽입|순서|24번|23번|30번|31번/.test(text);

  if (isMiddleTextbook) return 'MIDDLE_TEXTBOOK';
  if (isMockExam) return 'MOCK_EXAM';
  if (isMagic) return 'MAGIC';
  return 'WORMHOLE';
}

function getBaseInstructionByEngine(engineType) {
  switch (engineType) {
    case 'MIDDLE_TEXTBOOK':
      return middleTextbookInstruction;
    case 'MOCK_EXAM':
      return mockExamInstruction;
    case 'MAGIC':
      return magicInstruction;
    default:
      return wormholeInstruction;
  }
}

function buildRoutingControl(engineType) {
  if (engineType === 'MIDDLE_TEXTBOOK') {
    return `
[ENGINE ROUTING]
- Selected Engine: MIDDLE_TEXTBOOK
- Prioritize textbook transformation logic from the vector store.
- Apply Short-to-Rich expansion when the source passage is short or structurally simple.
- Focus on grammar-centric and sentence-transformation output.
- Ensure at least 30% production / controlled writing pressure.
`;
  }

  if (engineType === 'MOCK_EXAM') {
    return `
[ENGINE ROUTING]
- Selected Engine: MOCK_EXAM
- Prioritize high-school mock-exam transformation logic from the vector store.
- Follow the Marcus Path internally:
  Meaning -> Structure -> Summary / Blank / Inference
- Decompose one passage into multiple related item types.
- Preserve the original source item identity where relevant.
- Never expose internal phase labels in the visible output.
- Avoid turning the passage into a simple reading-comprehension worksheet.
- Enforce Marcus-style transformation density over content-retrieval density.
`;
  }

  if (engineType === 'MAGIC') {
    return `
[ENGINE ROUTING]
- Selected Engine: MAGIC
- Prioritize production training.
- If textbook / lesson mapping is detected in retrieved files, textbook-aligned production logic overrides card-style drills.
`;
  }

  return `
[ENGINE ROUTING]
- Selected Engine: WORMHOLE
- Prioritize elite grammar assessment logic.
- Keep 5-option multiple-choice structure and subtle structural traps.
`;
}

// =========================
// 6-1) HELPER: ITEM COUNT CONTROL
// =========================
function getItemCountByEngine(engineType) {
  switch (engineType) {
    case 'MOCK_EXAM':
      return 15;
    case 'MIDDLE_TEXTBOOK':
      return 15;
    case 'MAGIC':
      return 15;
    case 'WORMHOLE':
      return 25;
    default:
      return 15;
  }
}

// =========================
// 7) QUALITY CONTROL
// =========================
const qualityControl = `
[FINAL QUALITY GATE]
Before finalizing the worksheet, silently verify all of the following:
1. No internal headings such as "Phase 1", "Phase 2", "Phase 3", "Meaning Layer", or "Structure Layer".
2. No repeated question stems testing the same fact with only wording changes.
3. In mock-exam mode, no more than 3 direct content-retrieval questions.
4. In mock-exam mode, at least 4 items must be genuine grammar/structure items.
5. In mock-exam mode, at least 3 items must involve blank / summary / inference / flow logic.
6. In mock-exam mode, at least 3 items must involve sentence insertion, order, relation, connector, or logic flow.
7. Never create an error-detection question unless there is a real defensible error.
8. Keep all numeric expressions such as "age 14" and "16 or 17" on one line if possible.
9. If the set feels like an analysis worksheet or simple reading workbook instead of an exam, revise it before output.
10. Avoid markdown bold such as **question text** in the visible output.
11. If the requested set size is 15, do not artificially stretch the same passage fact into repeated questions.
12. Remove code fences, plaintext markers, and footer-like artifacts from the visible output.
13. The final set must feel like MARCUSNOTE transformation material, not generic AI worksheet output.
14. The final visible output must contain exactly one source label line near the top.
15. If the exact source is unknown, use either "Estimated Source:" or "Source Classification:" instead of pretending certainty.
16. Each Structural Logic explanation must be at least 2 sentences in substance, not a one-line memo.
17. In mock-exam mode, items 1-3 / 4-6 / 7-9 / 10-12 / 13-15 must clearly belong to different testing layers.
18. In mock-exam mode, items 7-9 must include at least one implication item.
19. Do not recycle the same sentence insertion, same blank logic, same implication trap, or same irrelevant-detail trap more than once.
20. If items 10-15 resemble repeated variants of items 1-9, revise the set before output.
`;

// =========================
// 8) HELPER: NUMBER STABILIZER
// =========================
function stabilizeNumbers(text = '') {
  return text
    .replace(/age\s+(\d{1,2})/g, 'age&nbsp;$1')
    .replace(/(\d{1,2})\s+or\s+(\d{1,2})/g, '$1&nbsp;or&nbsp;$2')
    .replace(/(\d{4})\s+Academic\s+Year/g, '$1&nbsp;Academic&nbsp;Year')
    .replace(/(\d{4})\s*\|\s*Level:/g, '$1&nbsp;| Level:')
    .replace(/No\.\s+(\d+)/g, 'No.&nbsp;$1');
}

// =========================
// 8-1) HELPER: CLEAN OUTPUT ARTIFACTS
// =========================
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

function ensureSourceLabel(text = '', sourceLabelText = '') {
  if (!sourceLabelText) return text;

  const alreadyHasLabel =
    /^(Source:|Estimated Source:|Source Classification:)/mi.test(text);

  if (alreadyHasLabel) return text;

  const lines = text.split('\n');
  const insertAt = Math.min(3, lines.length);

  lines.splice(insertAt, 0, sourceLabelText, '');
  return lines.join('\n');
}

// =========================
// 9) HELPER: LOW QUALITY DETECTION
// =========================
function isLowQualityOutput(text = '') {
  const lower = text.toLowerCase();

  const badSignals = [
    '### phase 1',
    '### phase 2',
    '### phase 3',
    'phase 1:',
    'phase 2:',
    'phase 3:',
    'meaning layer',
    'structure layer',
    'deep dive',
    '**what',
    '```plaintext',
    '```',
    'all rights reserved'
  ];

  const badCount = badSignals.reduce((acc, signal) => {
    return acc + (lower.split(signal).length - 1);
  }, 0);

  const repeatedInference =
    (lower.match(/what does the passage suggest/gi) || []).length >= 3 ||
    (lower.match(/what can be inferred/gi) || []).length >= 3 ||
    (lower.match(/what is the main idea of the passage/gi) || []).length >= 2;

  const tooGeneric =
    (lower.match(/according to the passage/gi) || []).length >= 3 ||
    (lower.match(/which of the following is mentioned/gi) || []).length >= 2 ||
    (lower.match(/what is the purpose of the passage/gi) || []).length >= 2 ||
    (lower.match(/what is the main idea of the passage/gi) || []).length >= 2;

  const weakTransformation =
    (lower.match(/sentence insertion/gi) || []).length === 0 &&
    (lower.match(/summary/gi) || []).length === 0 &&
    (lower.match(/blank/gi) || []).length === 0;

  const repeatedTemplates =
    (lower.match(/which sentence is most awkward/gi) || []).length >= 2 ||
    (lower.match(/where does the sentence best fit/gi) || []).length >= 2 ||
    (lower.match(/what is implied by the passage/gi) || []).length >= 2 ||
    (lower.match(/what can be inferred from the passage/gi) || []).length >= 2;

  return badCount >= 2 || repeatedInference || tooGeneric || weakTransformation || repeatedTemplates;
  
  return badCount >= 2 || repeatedInference || tooGeneric || weakTransformation;
}

// =========================
// 10) API HANDLER (FINAL)
// =========================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt required' });
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
- Never mix multiple languages in one instruction block unless the user explicitly requests it.
- Instruction: "지문은 하나지만, 학생이 느끼는 학습 효과는 5배가 되어야 합니다."
`;

  const quantityControl = `
[QUANTITY CONTROL]
- Generate exactly ${itemCount} items only.
- Each item must target a unique learning point.
- Do not repeat the same fact in different questions.
- If the passage is short, increase transformation depth instead of repeating content.
- Quality and variety are prioritized over quantity.
- Do not mention this override in the output.
`;

  const vectorControl = `
[VECTOR STORE PRIORITY]
- Use the retrieved vector store files as the primary transformation policy.
- If textbook logic is retrieved, follow textbook transformation rules.
- If mock-exam logic is retrieved, follow passage decomposition rules.
- Do not blend textbook logic and mock-exam logic carelessly.
- Keep MARCUSNOTE tone consistent and editorially rigorous.
`;

  const sourceLabelControl = `
[SOURCE LABEL RULE]
- Add exactly one source label line near the top of the visible output.
- If the user explicitly provided source information, use it as:
  ${sourceLabel.labelText}
- If the exact source is not certain, do NOT fake certainty.
- Use the prepared source label exactly as provided below:
  ${sourceLabel.labelText}
- Place this line immediately below the main header block.
- Keep it concise and professional.
`;

  const fullSystemPrompt =
    baseInstruction +
    '\n' +
    routingControl +
    '\n' +
    languageControl +
    '\n' +
    quantityControl +
    '\n' +
    vectorControl +
    '\n' +
    sourceLabelControl +
    '\n' +
    qualityControl;

  try {
    let response = await openai.responses.create({
      model: 'gpt-4o',
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
          max_num_results: 10
        }
      ],
      include: ['file_search_call.results'],
      temperature: 0.3
    });

    let finalText = response.output_text || '';

    if (isLowQualityOutput(finalText)) {
      response = await openai.responses.create({
        model: 'gpt-4o',
        input: [
          {
            role: 'system',
            content:
              fullSystemPrompt +
              '\n' +
              `
[RETRY OVERRIDE]
The previous draft was too generic, too workbook-like, or insufficiently transformed.
Regenerate the full set as a true MARCUSNOTE mock-exam transformation worksheet.

Mandatory corrections:
- Reduce direct content-retrieval questions.
- Increase structure-based discrimination.
- Increase blank / summary / inference logic.
- Increase insertion / order / relation / flow items.
- Preserve the original source item identity when relevant.
- Make items feel like authentic Korean school-exam transformations.
- Never output markdown bold.
- Never output code fences or plaintext markers.
- Remove footer-like artifacts.
- Respect the final item count exactly.
- Keep exactly one source label line near the top.
- Each explanation must state why the correct answer works and why at least one distractor fails.
- Enforce layer-by-layer routing:
  1-3 meaning, 4-6 structure, 7-9 blank/summary/implication, 10-12 flow, 13-15 hybrid killer.
- Do not repeat the same transformation template across multiple number bands.
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
            max_num_results: 10
          }
        ],
        include: ['file_search_call.results'],
        temperature: 0.25
      });

      finalText = response.output_text || '';
    }

    finalText = stabilizeNumbers(finalText);
    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSourceLabel(finalText, sourceLabel.labelText);

    return res.status(200).json({
      response: finalText
      // debug: {
      //   engineType,
      //   detectedLanguage,
      //   itemCount,
      //   sourceLabel
      // }
    });
  } catch (error) {
    console.error('MARCUS Engine Error:', error);
    return res.status(500).json({
      error: 'API Execution Failed',
      detail: error.message
    });
  }
}
