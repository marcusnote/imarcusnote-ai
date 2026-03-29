import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ENGINE_MODE = {
  JUNIOR_STARTER: 'JUNIOR_STARTER',
  MOCK_EXAM: 'MOCK_EXAM',
  MIDDLE_TEXTBOOK: 'MIDDLE_TEXTBOOK',
  WORMHOLE: 'WORMHOLE',
  MAGIC: 'MAGIC',
  VOCAB_BUILDER: 'VOCAB_BUILDER',
};

const MODE_LABEL = {
  [ENGINE_MODE.JUNIOR_STARTER]: 'Junior Starter',
  [ENGINE_MODE.MOCK_EXAM]: 'Mocks Exam',
  [ENGINE_MODE.MIDDLE_TEXTBOOK]: 'Middle Exam',
  [ENGINE_MODE.WORMHOLE]: 'Wormhole',
  [ENGINE_MODE.MAGIC]: 'Magic Lab',
  [ENGINE_MODE.VOCAB_BUILDER]: 'Vocab Builder',
};

const ITEM_COUNT = {
  [ENGINE_MODE.JUNIOR_STARTER]: 20,
  [ENGINE_MODE.MOCK_EXAM]: 15,
  [ENGINE_MODE.MIDDLE_TEXTBOOK]: 25,
  [ENGINE_MODE.WORMHOLE]: 25,
  [ENGINE_MODE.MAGIC]: 25,
  [ENGINE_MODE.VOCAB_BUILDER]: 30,
};

function normalizeText(value = '') {
  return String(value).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function compactMultiline(value = '') {
  return String(value)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectKorean(text = '') {
  return /[가-힣]/.test(text);
}

function detectEnglish(text = '') {
  return /[A-Za-z]/.test(text);
}

function sanitizeFileName(name = '') {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstSentence(text = '', maxLen = 80) {
  const cleaned = normalizeText(text);
  if (!cleaned) return '';
  const split = cleaned.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const first = split[0] || '';
  return first.length > maxLen ? `${first.slice(0, maxLen).trim()}...` : first;
}

function extractQuotedOrFirstLine(text = '', maxLen = 72) {
  const lines = String(text)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.length >= 8 && line.length <= maxLen) return line;
  }

  return extractFirstSentence(text, maxLen);
}

function inferWorksheetTitle({
  title = '',
  mode = ENGINE_MODE.MOCK_EXAM,
  input = '',
}) {
  const explicitTitle = normalizeText(title);
  if (explicitTitle) return explicitTitle;

  const cleanInput = compactMultiline(input);
  const firstLine = extractQuotedOrFirstLine(cleanInput, 72);

  const gradeMatch =
    cleanInput.match(/(중[123]|고[123]|초[3456])/i) ||
    cleanInput.match(/\b(G[1-3]|M[1-3])\b/i);

  const monthMockMatch =
    cleanInput.match(/(\d{2,4}년?\s*\d{1,2}월\s*고\d\s*\d+번)/) ||
    cleanInput.match(/(\d{2,4}\s*Academic Year.*?Level:\s*\d)/i);

  const chapterMatch =
    cleanInput.match(/(\d+과)/) ||
    cleanInput.match(/(Chapter\s*\d+)/i);

  const grammarWhat = /관계대명사\s*what|relative pronoun\s*what/i.test(cleanInput);
  const grammarPastPerfect = /과거완료|past perfect/i.test(cleanInput);
  const grammarPerception = /지각동사|perception verb/i.test(cleanInput);
  const grammarWhether = /whether|if/.test(cleanInput);

  if (mode === ENGINE_MODE.MOCK_EXAM) {
    if (monthMockMatch) return `${monthMockMatch[1]} 지문 변형문제`;
    if (firstLine) return `${firstLine} 기반 변형문제`;
    return detectKorean(cleanInput)
      ? '모의고사 지문 변형문제'
      : 'Mock Passage Transformation Worksheet';
  }

  if (mode === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    const parts = [];
    if (gradeMatch) parts.push(gradeMatch[1]);
    if (chapterMatch) parts.push(chapterMatch[1]);
    if (grammarWhat) parts.push('관계대명사 what');
    if (grammarPerception) parts.push('지각동사');
    if (grammarPastPerfect) parts.push('과거완료');
    if (grammarWhether) parts.push('whether / if');

    if (parts.length) return `${parts.join(' ')} 내신형 문제`;
    if (firstLine) return `${firstLine} 중등 내신형 문제`;
    return detectKorean(cleanInput)
      ? '중등 내신형 문제'
      : 'Middle School Exam Worksheet';
  }

  if (mode === ENGINE_MODE.WORMHOLE) {
    const parts = [];
    if (gradeMatch) parts.push(gradeMatch[1]);
    if (grammarWhat) parts.push('관계대명사 what');
    if (grammarPastPerfect) parts.push('과거완료');
    if (grammarPerception) parts.push('지각동사');

    if (parts.length) return `${parts.join(' ')} 마커스웜홀 25문항`;
    if (firstLine) return `${firstLine} 마커스웜홀 25문항`;
    return detectKorean(cleanInput)
      ? '마커스웜홀 실전 문제 25문항'
      : 'MARCUS WORMHOLE Elite Test';
  }

  if (mode === ENGINE_MODE.MAGIC) {
    const parts = [];
    if (gradeMatch) parts.push(gradeMatch[1]);
    if (grammarWhat) parts.push('관계대명사 what');
    if (grammarPastPerfect) parts.push('과거완료');
    if (grammarPerception) parts.push('지각동사');

    if (parts.length) return `${parts.join(' ')} 마커스매직 영작훈련 25문항`;
    if (firstLine) return `${firstLine} 영작훈련 25문항`;
    return detectKorean(cleanInput)
      ? '마커스매직 영작훈련 25문항'
      : 'MARCUS MAGIC Production Training';
  }

  if (mode === ENGINE_MODE.VOCAB_BUILDER) {
    if (firstLine) return `${firstLine} 어휘 훈련`;
    return detectKorean(cleanInput)
      ? '어휘 훈련 자료'
      : 'Vocabulary Builder Worksheet';
  }

  if (mode === ENGINE_MODE.JUNIOR_STARTER) {
    if (firstLine) return `${firstLine} 기초 훈련 자료`;
    return detectKorean(cleanInput)
      ? '기초 훈련 자료'
      : 'Junior Starter Training Worksheet';
  }

  return detectKorean(cleanInput)
    ? 'MARCUSNOTE 학습자료'
    : 'MARCUSNOTE Worksheet';
}

function extractPassageFromInput(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const passagePatterns = [
    /(?:\*\*Passage:\*\*|Passage:|Original Passage:|원문 지문:?)\s*([\s\S]+)/i,
    /---\s*([\s\S]{180,})/i,
  ];

  for (const pattern of passagePatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return compactMultiline(match[1]);
    }
  }

  const lines = raw
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  const longEnglishParagraphs = lines.filter(
    (line) =>
      line.length > 120 &&
      /[A-Za-z]/.test(line) &&
      !/^\d+\./.test(line) &&
      !/^①|^②|^③|^④|^⑤/.test(line)
  );

  if (longEnglishParagraphs.length) {
    return compactMultiline(longEnglishParagraphs.join('\n'));
  }

  return '';
}

function inferSourceLabel(mode, prompt, title = '') {
  const merged = `${title}\n${prompt}`;

  if (mode === ENGINE_MODE.MOCK_EXAM) {
    if (/고\d|모의고사|수능|passage|purpose|gist/i.test(merged)) {
      return 'Estimated Source: G2 Mock Passage | Purpose/Gist';
    }
    return 'Estimated Source: Mock Passage';
  }

  if (mode === ENGINE_MODE.MIDDLE_TEXTBOOK) {
    return 'Estimated Source: Middle School Textbook | Middle School';
  }

  if (mode === ENGINE_MODE.WORMHOLE) {
    return 'Source Classification: MARCUS Academic Selection - General English';
  }

  if (mode === ENGINE_MODE.MAGIC) {
    return 'Source Classification: MARCUS Production Selection - General English';
  }

  if (mode === ENGINE_MODE.VOCAB_BUILDER) {
    return 'Source Classification: MARCUS Vocabulary Selection';
  }

  return 'Estimated Source: General English Worksheet';
}

function stabilizeNumbers(text = '') {
  return String(text)
    .replace(/(\d{4})\s+Academic\s+Year/g, '$1 Academic Year')
    .replace(/(\d{1,2})\s+items/gi, '$1 items')
    .replace(/age\s+(\d{1,2})/gi, 'age $1');
}

function cleanOutputArtifacts(text = '') {
  return String(text)
    .replace(/\[object Object\]/g, '')
    .replace(/^\s*```(?:markdown|text)?/gim, '')
    .replace(/```\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureSectionOrder({
  text = '',
  title = '',
  sourceLabel = '',
  mode = ENGINE_MODE.MOCK_EXAM,
  originalPassage = '',
}) {
  let body = cleanOutputArtifacts(text);

  if (!body.startsWith(title)) {
    body = `${title}\n\n${body}`;
  }

  if (!body.includes(sourceLabel)) {
    body = body.replace(title, `${title}\n${sourceLabel}`);
  }

  if (mode === ENGINE_MODE.MOCK_EXAM && originalPassage) {
    const hasPassageSection = /Original Passage|Passage:|\*\*Passage:\*\*|원문 지문/i.test(body);
    if (!hasPassageSection) {
      body = [
        title,
        sourceLabel,
        '',
        'Original Passage',
        originalPassage,
        '',
        body.replace(title, '').replace(sourceLabel, '').trim(),
      ]
        .join('\n')
        .trim();
    }
  }

  return compactMultiline(body);
}

function detectRequestedMode(prompt = '', selectedMode = ENGINE_MODE.MOCK_EXAM) {
  const text = String(prompt || '').toLowerCase();

  const mentionsMagic =
    /magic|매직|영작|작문|rewrite|combine|paraphrase|translation training/.test(text);

  const mentionsWormhole =
    /wormhole|웜홀|고난도|최고난도|킬러|변형문제\s*25문항|실전모의고사/.test(text);

  const mentionsMiddle =
    /중등|내신|교과서|천재|비상|동아|중[123]|문법/.test(text);

  const mentionsMock =
    /모의고사|수능|고[123]|passage|gist|purpose|summary|inference|빈칸|삽입|순서/.test(text);

  if (selectedMode === ENGINE_MODE.MAGIC && mentionsWormhole && !mentionsMagic) {
    return ENGINE_MODE.WORMHOLE;
  }

  if (selectedMode === ENGINE_MODE.MOCK_EXAM && mentionsMagic && !mentionsMock) {
    return ENGINE_MODE.MAGIC;
  }

  if (selectedMode === ENGINE_MODE.MOCK_EXAM && mentionsMiddle && !mentionsMock) {
    return ENGINE_MODE.MIDDLE_TEXTBOOK;
  }

  if (selectedMode === ENGINE_MODE.MIDDLE_TEXTBOOK && mentionsMock) {
    return ENGINE_MODE.MOCK_EXAM;
  }

  if (selectedMode === ENGINE_MODE.WORMHOLE && mentionsMagic && !mentionsWormhole) {
    return ENGINE_MODE.MAGIC;
  }

  return selectedMode;
}

function getLanguageInstruction(prompt = '') {
  return detectKorean(prompt)
    ? '출력은 자연스럽고 전문적인 한국어 안내문과 영어 문항 형식을 적절히 혼합하되, 실제 시험지/워크북처럼 보여야 한다.'
    : 'Output should feel like a polished professional worksheet in natural English.';
}

function getGlobalRules({
  finalTitle,
  sourceLabel,
  originalPassage,
  engineType,
  itemCount,
}) {
  return `
[ABSOLUTE OUTPUT RULES]
- The document title must be exactly:
${finalTitle}

- The user title is the real identity of the worksheet. Never replace it with only a generic brand heading.
- Keep exactly one source line near the top:
${sourceLabel}

- The output must be publication-ready and immediately identifiable after PDF download.
- Never make the worksheet generic, vague, or source-ambiguous.
- Do not use code fences.
- Do not add meta commentary such as "Here is your worksheet."
- Keep formatting clean, stable, and premium.
- Respect the exact engine type: ${engineType}
- Respect the exact item count: ${itemCount}

[TOP FORMAT]
1. Title
2. Source line
3. Academic year / level line if appropriate
4. One concise instruction line
5. Main worksheet body

${
  engineType === ENGINE_MODE.MOCK_EXAM && originalPassage
    ? `
[MOCK EXAM MANDATORY PASSAGE RULE]
- You MUST print the original passage before the questions.
- Use this exact heading:
Original Passage
- Use the original passage as-is without summarizing, shortening, or replacing it.

Original Passage:
${originalPassage}
`
    : ''
}
`;
}

function getJuniorInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Junior Starter Engine.

[IDENTITY]
- Create a beginner-friendly but high-quality structured worksheet.
- Focus on foundational grammar, sentence building, and simple pattern recognition.

[COUNT]
- Produce exactly ${itemCount} items.

[OUTPUT RULE]
- Clear, teacher-friendly, publication-ready.
- Difficulty must be easier than Middle Exam and Wormhole.
- Keep answers in a distinct answer key section.
`;
}

function getMockExamInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Mock Exam Transformation Engine.

[IDENTITY]
- This engine is ONLY for high-school mock exams, school exams, and CSAT-style transformation.
- Output must feel like a real Korean exam-style transformation worksheet, not a reading-comprehension workbook.

[COUNT]
- Produce exactly ${itemCount} items.

[QUESTION FORMAT - MANDATORY]
- Every item must be 5-option multiple choice only.
- Use only this option format:
①
②
③
④
⑤

- Never output:
  - essay-style questions
  - descriptive prompts
  - open-ended questions
  - short-answer tasks
  - direct free-writing tasks

[MANDATORY DISTRIBUTION]
For ${itemCount} items:
- meaning / title / gist / purpose
- grammar / structure / bracket
- blank / implication / summary
- flow / insertion / sequence
- hybrid killer items

[QUALITY RULE]
- Every item must test a unique point.
- Wrong answers must be plausible and exam-style.
- Meaning distractors must contain partial-truth traps.
- No repeated solving path.
- No shallow comprehension workbook tone.

[VISIBLE HEADER RULE]
- After the title and source line, use one formal instruction line in the user's language.
- Then present the original passage.
- Then present the question set.

[ANSWER KEY RULE]
- Include:
OFFICIAL MARCUSNOTE ANSWER KEY

[EXPLANATION RULE]
- Add:
Structural Logic 1-5
Structural Logic 6-10
Structural Logic 11-15
- Each block must explain why the set is defensible and exam-like.
`;
}

function getMiddleInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Middle School Elite Test Engine.

[IDENTITY]
- This engine is for middle-school textbook-linked grammar and school exam practice.
- Output must feel like a premium Korean middle-school internal exam worksheet.

[COUNT]
- Produce exactly ${itemCount} items.

[FORMAT]
- 5-option multiple choice is allowed and preferred for this mode.
- Test grammar, sentence correction, transformation, and textbook-linked understanding.
- Keep quality higher than ordinary workbook level.

[QUALITY RULE]
- No vague filler items.
- No duplicated patterns.
- Each item must test a distinct grammar point or closely related school-exam skill.

[ANSWER KEY RULE]
- Include:
OFFICIAL MARCUSNOTE ANSWER KEY

[EXPLANATION RULE]
- Add grouped structural explanations.
`;
}

function getWormholeInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Wormhole Engine.

[IDENTITY]
- This engine is for high-difficulty, selective, premium-grade grammar and transformation work.
- Output must feel sharper, tighter, and harder than regular middle-school exam worksheets.

[COUNT]
- Produce exactly ${itemCount} items.

[FORMAT]
- Items 1-20: 5-option multiple choice
- Items 21-25: descriptive / rewrite / transform / complete tasks
- Maintain high discrimination and premium editorial tension.

[QUALITY RULE]
- Use advanced distractor logic.
- Use error-type comparison, awkwardness judgment, structure preservation, and high-precision correction.
- No soft beginner items.
- No generic explanation tone.

[ANSWER KEY RULE]
- Include exact answers for all 25 items.

[EXPLANATION RULE]
- Add grouped Structural Logic sections.
`;
}

function getMagicInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Magic Engine.

[IDENTITY]
- This engine is for production training, writing transformation, sentence synthesis, and English composition drills.
- It must feel like a premium training workbook, not a test-prep multiple-choice sheet.

[COUNT]
- Produce exactly ${itemCount} items.

[STRICT RULES]
- NO multiple choice.
- NO options ①②③④⑤.
- NO answers in the question section.
- Only writing, transformation, completion, combination, rewrite, or translation-training tasks.
- This engine must not collapse into a Wormhole or textbook MCQ sheet.

[ANSWER KEY RULE]
- Include:
OFFICIAL MARCUSNOTE ANSWER KEY
- Provide full model responses or answer guides.

[EXPLANATION RULE]
- Add:
Explanation 1-5
Explanation 6-10
Explanation 11-15
Explanation 16-20
Explanation 21-25
`;
}

function getVocabInstruction(itemCount) {
  return `
You are the I•MARCUSNOTE Vocabulary Builder Engine.

[IDENTITY]
- Create a premium vocabulary worksheet.
- Focus on usage, meaning discrimination, collocations, word family, and contextual application.

[COUNT]
- Produce exactly ${itemCount} items.

[QUALITY RULE]
- Avoid shallow word-list dumping.
- Make items usable in real classroom practice.
- Keep answer key separate and polished.
`;
}

function getInstructionByMode(mode, itemCount) {
  switch (mode) {
    case ENGINE_MODE.JUNIOR_STARTER:
      return getJuniorInstruction(itemCount);
    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return getMiddleInstruction(itemCount);
    case ENGINE_MODE.WORMHOLE:
      return getWormholeInstruction(itemCount);
    case ENGINE_MODE.MAGIC:
      return getMagicInstruction(itemCount);
    case ENGINE_MODE.VOCAB_BUILDER:
      return getVocabInstruction(itemCount);
    case ENGINE_MODE.MOCK_EXAM:
    default:
      return getMockExamInstruction(itemCount);
  }
}

function buildSystemPrompt({
  engineType,
  finalTitle,
  sourceLabel,
  originalPassage,
  itemCount,
  userPrompt,
}) {
  return `
You are the premium worksheet engine of I•marcusnote.

${getGlobalRules({
  finalTitle,
  sourceLabel,
  originalPassage,
  engineType,
  itemCount,
})}

${getInstructionByMode(engineType, itemCount)}

[LANGUAGE]
${getLanguageInstruction(userPrompt)}

[CRITICAL ANTI-GENERIC RULE]
- Do not produce a bland generic worksheet.
- The worksheet must visibly reflect the user's actual request.
- If the selected engine and request conflict, obey the corrected effective engine.
- Never hide the identifying title.
- Never omit the original passage in MOCK_EXAM when one exists.
`;
}

async function runResponsesApi({
  systemPrompt,
  userPrompt,
  vectorStoreId,
  maxOutputTokens = 4200,
}) {
  const input = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  const payload = {
    model: process.env.OPENAI_MODEL || 'gpt-5',
    input,
    max_output_tokens: maxOutputTokens,
  };

  if (vectorStoreId) {
    payload.tools = [
      {
        type: 'file_search',
        vector_store_ids: [vectorStoreId],
        max_num_results: 3,
      },
    ];
  }

  const response = await client.responses.create(payload);
  return response.output_text || '';
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'I•marcusnote API is working. Use POST to send a prompt.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    const body = req.body || {};
    const rawPrompt = compactMultiline(body.prompt || '');
    const rawTitle = normalizeText(body.title || '');
    const selectedMode = body.mode || ENGINE_MODE.MOCK_EXAM;

    if (!rawPrompt) {
      return res.status(400).json({
        ok: false,
        error: 'Prompt is required',
      });
    }

    const effectiveMode = detectRequestedMode(rawPrompt, selectedMode);
    const itemCount = ITEM_COUNT[effectiveMode] || 25;
    const originalPassage =
      effectiveMode === ENGINE_MODE.MOCK_EXAM ? extractPassageFromInput(rawPrompt) : '';

    const finalTitle = inferWorksheetTitle({
      title: rawTitle,
      mode: effectiveMode,
      input: rawPrompt,
    });

    const sourceLabel = inferSourceLabel(effectiveMode, rawPrompt, finalTitle);

    const systemPrompt = buildSystemPrompt({
      engineType: effectiveMode,
      finalTitle,
      sourceLabel,
      originalPassage,
      itemCount,
      userPrompt: rawPrompt,
    });

    let finalText = await runResponsesApi({
      systemPrompt,
      userPrompt: rawPrompt,
      vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID,
      maxOutputTokens:
        effectiveMode === ENGINE_MODE.MOCK_EXAM
          ? 4600
          : effectiveMode === ENGINE_MODE.WORMHOLE
          ? 4800
          : effectiveMode === ENGINE_MODE.MAGIC
          ? 4400
          : 4000,
    });

    if (!finalText || finalText.length < 200) {
      finalText = await runResponsesApi({
        systemPrompt:
          systemPrompt +
          `
[RETRY OVERRIDE]
The previous draft was too generic, too short, or insufficiently aligned.
Regenerate the entire worksheet.

Mandatory corrections:
- Respect the effective engine exactly: ${effectiveMode}
- Respect the exact title: ${finalTitle}
- Keep exactly one source line near the top.
- Respect the exact item count: ${itemCount}
- Preserve premium classroom/publication usability.
- Do not omit required sections.
`,
        userPrompt: rawPrompt,
        vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID,
        maxOutputTokens:
          effectiveMode === ENGINE_MODE.MOCK_EXAM
            ? 5000
            : effectiveMode === ENGINE_MODE.WORMHOLE
            ? 5200
            : 4400,
      });
    }

    finalText = stabilizeNumbers(finalText);
    finalText = cleanOutputArtifacts(finalText);
    finalText = ensureSectionOrder({
      text: finalText,
      title: finalTitle,
      sourceLabel,
      mode: effectiveMode,
      originalPassage,
    });

    const safeFileName = `${sanitizeFileName(finalTitle) || 'MARCUSNOTE_Worksheet'}.pdf`;

    return res.status(200).json({
      ok: true,
      mode: selectedMode,
      effectiveMode,
      modeLabel: MODE_LABEL[effectiveMode] || effectiveMode,
      itemCount,
      title: finalTitle,
      sourceLabel,
      originalPassage,
      fileName: safeFileName,
      response: finalText,
    });
  } catch (error) {
    console.error('MARCUS Engine Error:', error);

    return res.status(500).json({
      ok: false,
      error: 'API Execution Failed',
      detail: error?.message || 'Unknown error',
    });
  }
}
