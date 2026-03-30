const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

const ENGINE_MODE = {
  ABC_STARTER: "ABC_STARTER",
  MOCK_EXAM: "MOCK_EXAM",
  MIDDLE_TEXTBOOK: "MIDDLE_TEXTBOOK",
  WORMHOLE: "WORMHOLE",
  MAGIC: "MAGIC",
  VOCAB_BUILDER: "VOCAB_BUILDER",
};

const ENGINE_LABELS = {
  [ENGINE_MODE.ABC_STARTER]: "Junior Starter",
  [ENGINE_MODE.MOCK_EXAM]: "Mocks Exam",
  [ENGINE_MODE.MIDDLE_TEXTBOOK]: "Middle Exam",
  [ENGINE_MODE.WORMHOLE]: "Wormhole",
  [ENGINE_MODE.MAGIC]: "Magic Lab",
  [ENGINE_MODE.VOCAB_BUILDER]: "Vocab Builder",
};

const MAX_MODEL_ATTEMPTS = 2;

/* -----------------------------------------------------------
 * Utility
 * --------------------------------------------------------- */

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isKoreanText(text = "") {
  return /[가-힣]/.test(text);
}

function normalizeWhitespace(text = "") {
  return String(text)
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function ensureString(value, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function dedupeStrings(arr = []) {
  return [...new Set(arr.map((x) => ensureString(x)).filter(Boolean))];
}

function pickFirstNonEmpty(...values) {
  for (const v of values) {
    const s = ensureString(v);
    if (s) return s;
  }
  return "";
}

function extractJsonObject(rawText = "") {
  const text = ensureString(rawText);

  if (!text) {
    throw new Error("Empty model output.");
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = safeJsonParse(fenced[1]);
    if (parsed) return parsed;
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    const parsed = safeJsonParse(candidate);
    if (parsed) return parsed;
  }

  throw new Error("Failed to extract JSON object from model output.");
}

function makeErrorResponse(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra,
  });
}

/* -----------------------------------------------------------
 * Input normalization
 * --------------------------------------------------------- */

function normalizeRequestBody(body = {}) {
  const selectedEngine = pickFirstNonEmpty(
    body.selectedEngine,
    body.engine,
    body.engineMode,
    body.mode
  );

  const worksheetTitle = pickFirstNonEmpty(
    body.worksheetTitle,
    body.title,
    body.filename,
    "Marcusnote Worksheet"
  );

  const prompt = pickFirstNonEmpty(
    body.prompt,
    body.userInput,
    body.input,
    body.sourceContent,
    body.content
  );

  const publishingBrand = pickFirstNonEmpty(
    body.publishingBrand,
    body.brand,
    "I•MARCUSNOTE"
  );

  const academyName = pickFirstNonEmpty(
    body.academyName,
    body.instituteName,
    publishingBrand
  );

  return {
    selectedEngine,
    worksheetTitle,
    prompt,
    publishingBrand,
    academyName,
    raw: body,
  };
}

/* -----------------------------------------------------------
 * Engine resolution
 * --------------------------------------------------------- */

function normalizeEngineName(value = "") {
  const v = ensureString(value).toUpperCase();

  if (!v) return "";

  if (
    v.includes("ABC") ||
    v.includes("STARTER") ||
    v.includes("JUNIOR")
  ) {
    return ENGINE_MODE.ABC_STARTER;
  }

  if (
    v.includes("MOCK") ||
    v.includes("수능") ||
    v.includes("모의")
  ) {
    return ENGINE_MODE.MOCK_EXAM;
  }

  if (
    v.includes("MIDDLE") ||
    v.includes("TEXTBOOK") ||
    v.includes("내신") ||
    v.includes("교과서")
  ) {
    return ENGINE_MODE.MIDDLE_TEXTBOOK;
  }

  if (v.includes("WORMHOLE") || v.includes("웜홀")) {
    return ENGINE_MODE.WORMHOLE;
  }

  if (v.includes("MAGIC") || v.includes("매직")) {
    return ENGINE_MODE.MAGIC;
  }

  if (v.includes("VOCAB") || v.includes("단어")) {
    return ENGINE_MODE.VOCAB_BUILDER;
  }

  return "";
}

function inferEngineFromPrompt(prompt = "") {
  const text = ensureString(prompt).toLowerCase();

  if (!text) return "";

  const hasWormholeSignal =
    /웜홀|wormhole|고난도|어법|grammar judgment|elite distractor|변형문제|최고난도/.test(text);

  const hasMagicSignal =
    /매직|magic|영작|rewrite|paraphrase|combine|translate into english|composition|서술형|영어로 쓰기/.test(text);

  const hasVocabSignal =
    /단어장|어휘|vocab|vocabulary|뜻 쓰기|synonym|antonym/.test(text);

  const hasMockSignal =
    /모의고사|mock|수능|킬러|빈칸|순서|삽입/.test(text);

  const hasMiddleSignal =
    /교과서|중간고사|기말고사|내신|출판사|중\d|고\d/.test(text);

  if (hasWormholeSignal) return ENGINE_MODE.WORMHOLE;
  if (hasMagicSignal) return ENGINE_MODE.MAGIC;
  if (hasVocabSignal) return ENGINE_MODE.VOCAB_BUILDER;
  if (hasMockSignal) return ENGINE_MODE.MOCK_EXAM;
  if (hasMiddleSignal) return ENGINE_MODE.MIDDLE_TEXTBOOK;

  return "";
}

function resolveEngineMode(selectedEngine, prompt = "") {
  const normalizedSelected = normalizeEngineName(selectedEngine);
  const inferred = inferEngineFromPrompt(prompt);

  if (!normalizedSelected && inferred) return inferred;
  if (normalizedSelected && !inferred) return normalizedSelected;
  if (!normalizedSelected && !inferred) return ENGINE_MODE.WORMHOLE;

  const hardConflictPairs = [
    [ENGINE_MODE.MOCK_EXAM, ENGINE_MODE.WORMHOLE],
    [ENGINE_MODE.WORMHOLE, ENGINE_MODE.MAGIC],
    [ENGINE_MODE.MAGIC, ENGINE_MODE.VOCAB_BUILDER],
  ];

  const conflict = hardConflictPairs.some(
    ([a, b]) =>
      (normalizedSelected === a && inferred === b) ||
      (normalizedSelected === b && inferred === a)
  );

  return conflict ? inferred : normalizedSelected;
}

/* -----------------------------------------------------------
 * Prompt policy
 * --------------------------------------------------------- */

function buildGlobalSystemPolicy({ locale, selectedEngine, resolvedEngine }) {
  const isKo = locale === "ko";

  return `
You are the core generation engine for I•MARCUSNOTE.
You create teacher-ready educational worksheets, never generic chat output.

CRITICAL BRAND DEFINITIONS:
- "마커스매직" = "마커스매직카드"
- "마커스웜홀" = "마커스웜홀카드"
- The grammar basis is chapter-based grammar.
- In practice, the two textbook lines share about 90% of the same content.
- Preserve this internal alignment when generating materials.

ENGINE RESOLUTION RULE:
- The user's selected engine is: ${selectedEngine || "UNKNOWN"}
- The resolved engine you MUST follow is: ${resolvedEngine}
- If the user input and selected button conflict, obey the RESOLVED engine.

GLOBAL QUALITY RULES:
1. Output must feel like a premium teacher worksheet.
2. Do not produce vague or generic practice.
3. Keep all questions internally consistent.
4. Make only one best answer for each multiple-choice item.
5. Avoid answer-key contradictions.
6. Avoid tense-time collisions such as "have/has + p.p. + yesterday/last year/ago".
7. Avoid malformed verb chains such as:
   - has wrote
   - have saw
   - has went
   - have did
   - has ate
   unless they are intentionally wrong distractors and NOT the correct answer.
8. Distractors must be plausible but clearly inferior to the correct answer.
9. Preserve academic polish and print-ready formatting.
10. Never include meta-apologies or model commentary.

JSON OUTPUT RULE:
Return ONLY valid JSON.
Do not wrap it in markdown unless absolutely necessary.
No extra commentary before or after JSON.

JSON SCHEMA:
{
  "worksheetTitle": "string",
  "mainTitle": "string",
  "subtitle": "string",
  "direction": "string",
  "teacherNote": "string",
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice|short_answer|rewrite|transform|combine|completion|vocab",
      "stem": "string",
      "options": ["string"],
      "answer": "string",
      "explanation": "string"
    }
  ],
  "structuralLogic": [
    {
      "range": "1-5",
      "points": ["string", "string"]
    }
  ]
}

LOCALE RULE:
- Primary locale: ${locale}
- If locale is ko, directions and teacher-facing framing should naturally fit Korean school contexts.
- Core item stems may remain in English where academically appropriate.
- Avoid over-translating formal question stems if English stems are more test-authentic.

${
  isKo
    ? "Tone target: premium Korean academy / school exam support."
    : "Tone target: premium international classroom / assessment support."
}
`.trim();
}

function buildEngineSpecificInstruction({
  resolvedEngine,
  worksheetTitle,
  prompt,
  locale,
}) {
  const commonFooter = `
Use the user's title exactly if it is already meaningful.
Requested worksheet title: ${worksheetTitle}
User request:
${prompt}
`.trim();

  switch (resolvedEngine) {
    case ENGINE_MODE.WORMHOLE:
      return `
ENGINE: WORMHOLE

WORMHOLE CORE:
- High-difficulty grammar judgment
- Elite distractors
- Premium sentence transformation
- Teacher-ready academic worksheet
- 25 items fixed

WORMHOLE FORMAT:
- Items 1-20: mainly 5-choice high-difficulty items
- Items 21-25: short answer / correction / transformation / combination / completion
- Provide a complete answer key
- Provide a concise explanation for each item
- Provide 5 structural-logic groups: 1-5, 6-10, 11-15, 16-20, 21-25

QUALITY FILTERS:
- Make exactly one best answer per multiple-choice item
- Wrong options should be plausible but not ambiguous
- Avoid accidental duplicate-correct options
- If a tense unit is present, ensure answer key is logically valid
- If the topic is present perfect, never allow time-adverb clashes in the correct answer
- If the topic is relative pronouns / infinitives / grammar structures, enforce real grammar distinctions
- Keep the difficulty premium, not random

DIRECTION STYLE:
${locale === "ko" ? "Use a polished Korean teacher-facing intro, but test stems may stay in English." : "Use a polished teacher-facing intro in English."}

${commonFooter}
`.trim();

    case ENGINE_MODE.MAGIC:
      return `
ENGINE: MAGIC

MAGIC CORE:
- Marcus Magic = Marcus Magic Card
- Textbook grammar and chapter-based grammar are closely aligned
- About 90% of the core content overlaps across the lines
- English composition / rewrite / combine / guided transformation focus
- NO multiple-choice questions

MAGIC FORMAT:
- 25 items fixed
- Every item must be productive output:
  rewrite / combine / translate / paraphrase / guided composition / error correction
- No options like ①②③④⑤
- Each item should provide space-compatible, workbook-style prompts
- Provide answer key / model answers
- Provide concise teacher explanation

If the user's input is Korean and school-context writing practice, produce Korean Magic style.
If the user's input is English and asks for paraphrase/combine/rewrite, produce Global Magic style.

${commonFooter}
`.trim();

    case ENGINE_MODE.VOCAB_BUILDER:
      return `
ENGINE: VOCAB_BUILDER

VOCAB FORMAT:
- Up to 30 items
- Focus on level-appropriate vocabulary training
- Can include meaning match, fill-in, collocation, synonym, antonym, context usage
- Keep answer key clear
- Avoid generic low-value vocabulary

${commonFooter}
`.trim();

    case ENGINE_MODE.MOCK_EXAM:
      return `
ENGINE: MOCK_EXAM

MOCK EXAM FORMAT:
- 25 exam-style items
- Test-authentic style
- Emphasize inferencing, grammar, transformation, or passage-based assessment depending on prompt
- Maintain premium academic rigor
- Provide answer key and concise rationale

${commonFooter}
`.trim();

    case ENGINE_MODE.MIDDLE_TEXTBOOK:
      return `
ENGINE: MIDDLE_TEXTBOOK

MIDDLE TEXTBOOK FORMAT:
- School-test-aligned internal exam practice
- Reflect Korean middle school textbook / exam style when relevant
- Mix grammar, sentence judgment, rewrite, and application items as appropriate
- 25 items fixed
- Provide answer key and concise rationale

${commonFooter}
`.trim();

    case ENGINE_MODE.ABC_STARTER:
      return `
ENGINE: ABC_STARTER

ABC STARTER FORMAT:
- Beginner-friendly but still teacher-ready
- Simpler vocabulary and sentence structures
- 20 to 25 items allowed
- Clear correct answer logic
- Provide concise answer key

${commonFooter}
`.trim();

    default:
      return `
ENGINE: DEFAULT
Produce a premium worksheet matching the user's request.

${commonFooter}
`.trim();
  }
}

/* -----------------------------------------------------------
 * OpenAI call
 * --------------------------------------------------------- */

async function callModelForJson({ systemPolicy, engineInstruction }) {
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: systemPolicy,
    input: engineInstruction,
  });

  const text = ensureString(response.output_text);

  if (!text) {
    throw new Error("Model returned empty output_text.");
  }

  return extractJsonObject(text);
}

/* -----------------------------------------------------------
 * Validation / repair
 * --------------------------------------------------------- */

function normalizeQuestion(q, index) {
  const number = Number(q?.number) || index + 1;
  const type = pickFirstNonEmpty(q?.type, "multiple_choice");
  const stem = ensureString(q?.stem);
  const options = ensureArray(q?.options).map((x) => ensureString(x)).filter(Boolean);
  const answer = ensureString(q?.answer);
  const explanation = ensureString(q?.explanation);

  return { number, type, stem, options, answer, explanation };
}

function normalizePacket(packet, fallbackTitle = "Marcusnote Worksheet") {
  const questions = ensureArray(packet?.questions).map(normalizeQuestion);

  const structuralLogic = ensureArray(packet?.structuralLogic).map((group) => ({
    range: ensureString(group?.range),
    points: ensureArray(group?.points).map((x) => ensureString(x)).filter(Boolean),
  }));

  return {
    worksheetTitle: pickFirstNonEmpty(packet?.worksheetTitle, fallbackTitle),
    mainTitle: pickFirstNonEmpty(packet?.mainTitle, "MARCUSNOTE WORKSHEET"),
    subtitle: ensureString(packet?.subtitle),
    direction: ensureString(packet?.direction),
    teacherNote: ensureString(packet?.teacherNote),
    questions,
    structuralLogic,
  };
}

function containsSuspiciousPresentPerfectCollision(text = "") {
  const t = text.toLowerCase();

  const timeMarkers = [
    "yesterday",
    "last year",
    "last night",
    "last weekend",
    "two days ago",
    "ago",
    "in 2023",
    "in 2024",
    "this morning",
  ];

  const hasPerfect = /\b(has|have)\s+\w+/.test(t);
  const hasTimeMarker = timeMarkers.some((marker) => t.includes(marker));

  return hasPerfect && hasTimeMarker;
}

function containsMalformedPerfectAsCorrect(text = "") {
  const t = text.toLowerCase();

  return [
    /\bhas wrote\b/,
    /\bhave wrote\b/,
    /\bhas went\b/,
    /\bhave went\b/,
    /\bhas saw\b/,
    /\bhave saw\b/,
    /\bhas did\b/,
    /\bhave did\b/,
    /\bhas ate\b/,
    /\bhave ate\b/,
    /\bhas seen yesterday\b/,
    /\bhave seen yesterday\b/,
  ].some((re) => re.test(t));
}

function validatePacket(packet, resolvedEngine) {
  const issues = [];
  const questions = packet.questions || [];

  if (!packet.worksheetTitle) issues.push("worksheetTitle is missing.");
  if (!packet.mainTitle) issues.push("mainTitle is missing.");
  if (!packet.direction) issues.push("direction is missing.");
  if (questions.length < 20) issues.push("Too few questions.");
  if (
    resolvedEngine === ENGINE_MODE.WORMHOLE ||
    resolvedEngine === ENGINE_MODE.MAGIC ||
    resolvedEngine === ENGINE_MODE.MIDDLE_TEXTBOOK ||
    resolvedEngine === ENGINE_MODE.MOCK_EXAM
  ) {
    if (questions.length !== 25) {
      issues.push(`Question count must be exactly 25, got ${questions.length}.`);
    }
  }

  for (const q of questions) {
    if (!q.stem) {
      issues.push(`Question ${q.number} has empty stem.`);
    }

    const isMultipleChoice =
      q.type === "multiple_choice" ||
      (Array.isArray(q.options) && q.options.length > 0);

    if (isMultipleChoice) {
      if (q.options.length !== 5) {
        issues.push(`Question ${q.number} must have exactly 5 options.`);
      }
      if (!q.answer) {
        issues.push(`Question ${q.number} missing answer.`);
      }
    } else if (!q.answer) {
      issues.push(`Question ${q.number} missing answer.`);
    }

    const correctText = `${q.stem}\n${q.answer}\n${q.explanation}`;

    if (containsSuspiciousPresentPerfectCollision(correctText)) {
      issues.push(`Question ${q.number} contains suspicious tense-time collision.`);
    }

    if (containsMalformedPerfectAsCorrect(correctText)) {
      issues.push(`Question ${q.number} contains malformed present perfect in answer/explanation.`);
    }
  }

  if (resolvedEngine === ENGINE_MODE.WORMHOLE) {
    const first20 = questions.slice(0, 20);
    const shortTail = questions.slice(20, 25);

    if (first20.some((q) => q.options.length !== 5)) {
      issues.push("WORMHOLE items 1-20 must be 5-choice format.");
    }

    if (shortTail.some((q) => q.options.length > 0 && q.type !== "multiple_choice")) {
      issues.push("WORMHOLE items 21-25 should be short-answer style without unnecessary options.");
    }

    if (packet.structuralLogic.length < 5) {
      issues.push("WORMHOLE requires 5 structural logic groups.");
    }
  }

  if (resolvedEngine === ENGINE_MODE.MAGIC) {
    const hasMC = questions.some((q) => q.options.length > 0);
    if (hasMC) {
      issues.push("MAGIC must not include multiple-choice options.");
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

async function repairPacket({
  originalPacket,
  validationIssues,
  systemPolicy,
  resolvedEngine,
  worksheetTitle,
  prompt,
}) {
  const repairInstruction = `
Repair the worksheet JSON.
Keep the same resolved engine: ${resolvedEngine}
Keep question count valid.
Fix ALL issues below.

VALIDATION ISSUES:
${validationIssues.map((x, i) => `${i + 1}. ${x}`).join("\n")}

ORIGINAL USER REQUEST:
${prompt}

CURRENT JSON TO REPAIR:
${JSON.stringify(originalPacket, null, 2)}

Return ONLY valid JSON in the original schema.
Use worksheetTitle: ${worksheetTitle}
`.trim();

  const repaired = await callModelForJson({
    systemPolicy,
    engineInstruction: repairInstruction,
  });

  return repaired;
}

/* -----------------------------------------------------------
 * Output formatter
 * --------------------------------------------------------- */

function formatWorksheetText(packet) {
  const lines = [];

  lines.push(packet.mainTitle || "MARCUSNOTE WORKSHEET");

  if (packet.subtitle) lines.push(packet.subtitle);
  lines.push("");

  if (packet.worksheetTitle) {
    lines.push(packet.worksheetTitle);
    lines.push("");
  }

  if (packet.direction) {
    lines.push(packet.direction);
    lines.push("");
  }

  if (packet.teacherNote) {
    lines.push(packet.teacherNote);
    lines.push("");
  }

  for (const q of packet.questions) {
    lines.push(`${q.number}. ${q.stem}`);

    if (q.options?.length) {
      q.options.forEach((opt, idx) => {
        const marks = ["①", "②", "③", "④", "⑤"];
        lines.push(`${marks[idx] || `${idx + 1}.`} ${opt}`);
      });
    }

    lines.push("");
  }

  lines.push("OFFICIAL MARCUSNOTE ANSWER KEY");
  lines.push("");

  for (const q of packet.questions) {
    lines.push(`${q.number}) ${q.answer}`);
    if (q.explanation) {
      lines.push(`- ${q.explanation}`);
    }
  }

  if (packet.structuralLogic?.length) {
    lines.push("");
    lines.push("Structural Logic");
    lines.push("");

    for (const group of packet.structuralLogic) {
      lines.push(`Structural Logic ${group.range}`);
      for (const point of group.points) {
        lines.push(`- ${point}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

function buildFrontResponse({
  packet,
  resolvedEngine,
  selectedEngine,
  prompt,
}) {
  const outputText = formatWorksheetText(packet);

  return {
    ok: true,

    output: outputText,
    result: outputText,
    content: outputText,
    worksheet: outputText,
    text: outputText,

    worksheetTitle: packet.worksheetTitle,
    title: packet.worksheetTitle,
    mainTitle: packet.mainTitle,
    subtitle: packet.subtitle,
    direction: packet.direction,

    selectedEngine: selectedEngine || "",
    resolvedEngine,
    selectedEngineLabel: ENGINE_LABELS[normalizeEngineName(selectedEngine)] || selectedEngine || "",
    resolvedEngineLabel: ENGINE_LABELS[resolvedEngine] || resolvedEngine,

    questions: packet.questions,
    structuralLogic: packet.structuralLogic,

    meta: {
      prompt,
      model: OPENAI_MODEL,
      questionCount: packet.questions.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/* -----------------------------------------------------------
 * Main handler
 * --------------------------------------------------------- */

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "I•MARCUSNOTE generate endpoint is working. Use POST.",
      model: OPENAI_MODEL,
    });
  }

  if (req.method !== "POST") {
    return makeErrorResponse(res, 405, "Method not allowed.");
  }

  try {
    const body = normalizeRequestBody(req.body || {});
    const locale = isKoreanText(`${body.worksheetTitle}\n${body.prompt}`) ? "ko" : "en";
    const resolvedEngine = resolveEngineMode(body.selectedEngine, body.prompt);

    if (!body.prompt) {
      return makeErrorResponse(res, 400, "Prompt is required.");
    }

    const systemPolicy = buildGlobalSystemPolicy({
      locale,
      selectedEngine: body.selectedEngine,
      resolvedEngine,
    });

    const engineInstruction = buildEngineSpecificInstruction({
      resolvedEngine,
      worksheetTitle: body.worksheetTitle,
      prompt: body.prompt,
      locale,
    });

    let packet = null;
    let lastValidation = null;
    let attempt = 0;

    while (attempt < MAX_MODEL_ATTEMPTS) {
      attempt += 1;

      const rawPacket = await callModelForJson({
        systemPolicy,
        engineInstruction,
      });

      packet = normalizePacket(rawPacket, body.worksheetTitle);
      lastValidation = validatePacket(packet, resolvedEngine);

      if (lastValidation.ok) break;

      if (attempt < MAX_MODEL_ATTEMPTS) {
        const repaired = await repairPacket({
          originalPacket: packet,
          validationIssues: lastValidation.issues,
          systemPolicy,
          resolvedEngine,
          worksheetTitle: body.worksheetTitle,
          prompt: body.prompt,
        });

        packet = normalizePacket(repaired, body.worksheetTitle);
        lastValidation = validatePacket(packet, resolvedEngine);

        if (lastValidation.ok) break;
      }
    }

    if (!packet) {
      return makeErrorResponse(res, 500, "Worksheet generation failed.");
    }

    if (!lastValidation?.ok) {
      return makeErrorResponse(
        res,
        500,
        "Worksheet generated but failed validation.",
        {
          validationIssues: lastValidation?.issues || [],
          selectedEngine: body.selectedEngine,
          resolvedEngine,
        }
      );
    }

    const responsePayload = buildFrontResponse({
      packet,
      resolvedEngine,
      selectedEngine: body.selectedEngine,
      prompt: body.prompt,
    });

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("[generate.js] error:", error);

    return makeErrorResponse(res, 500, "Internal server error.", {
      detail: error?.message || "Unknown error",
    });
  }
};
