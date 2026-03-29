import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_ORIGINS = [
  "https://imarcusnote.com",
  "https://www.imarcusnote.com",
  "https://imarcusnote-ai.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

function getCorsHeaders(origin = "") {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://imarcusnote.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res, statusCode, payload, origin = "") {
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).json(payload);
}

function sanitizeInput(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function detectLanguage(text) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text) ? "ko" : "en";
}

function isLikelyWorkbookTitle(text) {
  const t = sanitizeInput(text).toLowerCase();
  if (!t) return false;
  return (
    t.includes("워크북") ||
    t.includes("문제") ||
    t.includes("모의고사") ||
    t.includes("worksheet") ||
    t.includes("exam") ||
    t.includes("set")
  );
}

const COMMON_SYSTEM_RULES = `
You are the I•marcusnote premium educational content engine.

Core identity:
- Produce polished, classroom-ready, printable educational materials.
- Output only the final educational material, not meta commentary.
- Never explain your process.
- Never include filler introductions, apologies, or AI-style disclaimers.

Universal output rules:
- Keep the output structured and publication-ready.
- Prefer this structure when appropriate:
  # Title
  ## Target Level
  ## Format
  ## Questions
  ## Answer Key
  ## Expert Explanation
- Maintain clean numbering and consistent formatting.
- Make the output usable for teachers, academies, and premium worksheets.
- Do not use markdown code fences.
- Do not produce sloppy or generic question sets.
- Keep the tone professional, precise, and teacher-facing.

Language behavior:
- If the user's request is mainly in Korean or clearly tied to Korean school contexts, respond in Korean unless English output is explicitly required.
- If the task itself requires English-only items, keep the task content in English but headings/explanations may follow the user's context.
- Respect local educational context automatically.

Brand behavior:
- I•marcusnote output must feel refined, selective, high-value, and academically intentional.
- Avoid random variety for its own sake; every item must feel designed.
`;

const MODE_RESOLUTION_RULES = `
Mode resolution rules:
- If the selected mode and the user's request conflict, prioritize the user's actual academic intent.
- Reinterpret the task intelligently rather than blindly following the button.
- Preserve the selected mode as the primary signal, but correct obvious mismatches when educational intent is clear.

Examples:
- If the user selects Mocks Exam but asks for translation-based English composition training, shift toward Magic Lab behavior.
- If the user selects Wormhole but asks for a beginner worksheet, lower difficulty appropriately.
- If the user selects Magic Lab but asks for a multiple-choice grammar exam, shift toward Mocks Exam or Middle Exam logic.
`;

const KOREAN_CONTEXT_RULES = `
Korean educational context rules:
- Reflect Korean middle/high school assessment culture when relevant.
- Use wording and formatting familiar to Korean teachers and academies.
- When the request is for 내신, 모의고사, 변형문제, 서술형, 영작훈련, or 워크북, force the output into that exact educational frame.
- Do not produce loose Western-style activity sheets when a Korean school format is implied.
- Maintain seriousness, density, and exam-worthiness.
`;

const WORMHOLE_PROMPT = `
Mode: Wormhole

Purpose:
- Elite grammar difficulty
- High-discrimination school exam materials
- Transformation-heavy, trap-sensitive, premium-level questions

Difficulty:
- Target top-performing students
- Prioritize discriminative items over basic drills
- Avoid making the entire set a simple tense-identification exercise

Mandatory design rules:
- Prefer 25 items unless the user explicitly requests another number.
- Build a real test set, not a generic practice page.
- Use varied item types when appropriate:
  1) grammaticality judgment
  2) sentence completion
  3) context-based tense/meaning choice
  4) transformation items
  5) subtle usage distinction
  6) trap-based multiple-choice questions
  7) mixed grammar interpretation items
- Include plausible distractors.
- Do not make all answers the same choice position.
- Make wrong choices feel temptingly close to correct.
- Reflect Korean school test rigor when the request is school-oriented.

Grammar handling rules:
- Distinguish present perfect vs simple past carefully.
- Use contrastive triggers such as:
  since / for / already / yet / just / ever / never / so far / recently
- Use meaning distinctions such as:
  completed experience vs continuing state
  have been to vs have gone to
  finished past event vs present relevance
- Include context where students can fail by applying a memorized rule mechanically.

Output rules:
- If multiple-choice fits the request, use multiple choice.
- If transformation is requested, prioritize transformation quality.
- Always include Answer Key.
- Include concise expert explanations or key rationales.
- The result must feel like a branded premium exam, not a worksheet generated from a textbook exercise bank.
`;

const MAGIC_PROMPT = `
Mode: Magic Lab

Purpose:
- English composition
- sentence reconstruction
- guided writing
- translation-to-English drills
- productive grammar training

Core identity:
- This mode is not a generic grammar quiz mode.
- It is a training mode for output production.

Mandatory design rules:
- Prefer translation, sentence-building, rewriting, combining, and reconstruction tasks.
- Do not default to multiple choice unless the user explicitly asks for it.
- Design items so learners actively produce language.
- Keep the sequence trainable and pedagogically staged.
- Use hints, word banks, or structural cues when appropriate.
- Build workbook-style progression from manageable to challenging.

When the user is Korean-speaking and requests school-style English writing:
- Use Korean prompts leading into English output tasks.
- Make the items feel like serious composition training, not casual translation.

Output rules:
- Prefer 20 to 25 items unless the user requests otherwise.
- Include clean answer models.
- Add brief teacher-facing notes or expert tips when useful.
- Ensure answers are natural English, not awkward literal renderings.
`;

const MOCKS_EXAM_PROMPT = `
Mode: Mocks Exam

Purpose:
- Realistic exam simulation
- School-test or mock-test style output
- Timed-assessment feel

Mandatory design rules:
- Prefer a 25-item exam set unless otherwise requested.
- Build a coherent exam, not a pile of disconnected questions.
- Maintain test-paper tone and density.
- If passage-based transformation is requested, generate high-quality variants from the source text.
- If grammar is requested, ensure the set resembles a true assessment, not a warm-up worksheet.
- If multiple-choice is appropriate, use five options when suitable.
- Vary answer positions and avoid obvious patterns.
- Prioritize authenticity and exam realism.

Output rules:
- Include Title, Target Level, Format, Questions, Answer Key.
- Add short explanation notes only if requested or clearly helpful.
- Keep presentation sharp and printable.
`;

const MIDDLE_EXAM_PROMPT = `
Mode: Middle Exam

Purpose:
- Korean middle-school textbook-linked assessment
- Internal school exam preparation
- Grammar, passage, and 서술형 adaptation for middle school

Mandatory design rules:
- Reflect middle-school textbook logic and school assessment style.
- Suitable for chapter grammar, reading passage checks, 서술형, and 변형문제.
- Keep the difficulty appropriate to middle-school students, but do not make it shallow.
- If the request is based on a textbook grammar point, stay tightly anchored to that point.
- If the request is passage-based, preserve the educational focus rather than becoming too creative.

Output rules:
- Clean school-facing structure
- Practical teacher usability
- Answer key included
- Brief explanation included when helpful
`;

const JUNIOR_STARTER_PROMPT = `
Mode: Junior Starter

Purpose:
- entry-level students
- lower-intermediate beginners
- gentle academic onboarding

Mandatory design rules:
- Keep wording clear and approachable.
- Reduce cognitive overload.
- Avoid trick-heavy distractors unless the user explicitly wants challenge.
- Prioritize confidence-building and concept clarity.
- Short items and manageable sentence length are preferred.
- Use examples or patterned repetition when useful.

Output rules:
- Make the set feel supportive, not watered down.
- Include answers and very short explanations when useful.
- Keep the presentation neat and friendly.
`;

const VOCAB_BUILDER_PROMPT = `
Mode: Vocab Builder

Purpose:
- vocabulary acquisition
- meaning inference
- retention and use
- derivatives, collocations, and sentence application

Mandatory design rules:
- Organize vocabulary study meaningfully.
- Prefer sets that combine:
  1) meaning
  2) usage
  3) collocation
  4) derivative awareness
  5) sentence application
- Avoid random dictionary-style dumping.
- Make it efficient for memorization and actual use.
- If the request is school-oriented, match the school vocabulary level.

Output rules:
- Can include tables, grouped lists, exercises, or mini-check items.
- Include answer key when exercises are present.
- Keep the result highly usable for study and review.
`;

function resolveMode(selectedMode, promptText) {
  const text = sanitizeInput(promptText).toLowerCase();
  const mode = sanitizeInput(selectedMode || "GENERAL").toUpperCase();

  const wantsWriting =
    text.includes("영작") ||
    text.includes("rewrite") ||
    text.includes("paraphrase") ||
    text.includes("재구성") ||
    text.includes("combine") ||
    text.includes("영어로") ||
    text.includes("translation") ||
    text.includes("translate");

  const wantsVocab =
    text.includes("단어") ||
    text.includes("어휘") ||
    text.includes("vocab") ||
    text.includes("vocabulary") ||
    text.includes("collocation");

  const wantsMock =
    text.includes("모의고사") ||
    text.includes("실전") ||
    text.includes("mock") ||
    text.includes("exam") ||
    text.includes("5지선다");

  const wantsMiddle =
    text.includes("중등") ||
    text.includes("중1") ||
    text.includes("중2") ||
    text.includes("중3") ||
    text.includes("교과서") ||
    text.includes("내신");

  const wantsWormhole =
    text.includes("웜홀") ||
    text.includes("wormhole") ||
    text.includes("고난도") ||
    text.includes("최고난도") ||
    text.includes("변형문제");

  const wantsBeginner =
    text.includes("기초") ||
    text.includes("입문") ||
    text.includes("초급") ||
    text.includes("starter") ||
    text.includes("beginner");

  if (mode === "MAGIC" && (wantsMock || wantsWormhole) && !wantsWriting) {
    return wantsWormhole ? "WORMHOLE" : "MOCK_EXAM";
  }

  if ((mode === "MOCK_EXAM" || mode === "WORMHOLE") && wantsWriting && !wantsMock) {
    return "MAGIC";
  }

  if (mode === "WORMHOLE" && wantsBeginner) {
    return "ABC_STARTER";
  }

  if (mode === "GENERAL") {
    if (wantsVocab) return "VOCAB_BUILDER";
    if (wantsWriting) return "MAGIC";
    if (wantsWormhole) return "WORMHOLE";
    if (wantsMiddle) return "MIDDLE_TEXTBOOK";
    if (wantsMock) return "MOCK_EXAM";
    if (wantsBeginner) return "ABC_STARTER";
    return "MOCK_EXAM";
  }

  return mode;
}

function buildSystemPrompt(mode, userPrompt) {
  const isKorean = detectLanguage(userPrompt) === "ko";
  let modePrompt = "";

  switch (mode) {
    case "WORMHOLE":
      modePrompt = WORMHOLE_PROMPT;
      break;
    case "MAGIC":
      modePrompt = MAGIC_PROMPT;
      break;
    case "MOCK_EXAM":
      modePrompt = MOCKS_EXAM_PROMPT;
      break;
    case "MIDDLE_TEXTBOOK":
      modePrompt = MIDDLE_EXAM_PROMPT;
      break;
    case "ABC_STARTER":
      modePrompt = JUNIOR_STARTER_PROMPT;
      break;
    case "VOCAB_BUILDER":
      modePrompt = VOCAB_BUILDER_PROMPT;
      break;
    default:
      modePrompt = MOCKS_EXAM_PROMPT;
      break;
  }

  return [
    COMMON_SYSTEM_RULES,
    MODE_RESOLUTION_RULES,
    modePrompt,
    isKorean ? KOREAN_CONTEXT_RULES : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildUserPrompt({ prompt, selectedMode, resolvedMode, title }) {
  const safePrompt = sanitizeInput(prompt);
  const safeTitle = sanitizeInput(title);

  return `
[SELECTED MODE]
${selectedMode || "GENERAL"}

[RESOLVED MODE]
${resolvedMode}

${safeTitle ? `[WORKSHEET TITLE]\n${safeTitle}\n` : ""}

[USER REQUEST]
${safePrompt}

[IMPORTANT OUTPUT RULES]
- Return the final educational material directly.
- Use the worksheet title naturally if a title is provided.
- Make the output publication-ready.
- Keep the result aligned to the resolved mode.
`;
}

function getMaxTokensByMode(mode) {
  switch (mode) {
    case "WORMHOLE":
    case "MOCK_EXAM":
      return 4200;
    case "MAGIC":
      return 3800;
    case "VOCAB_BUILDER":
      return 3200;
    case "ABC_STARTER":
      return 2800;
    case "MIDDLE_TEXTBOOK":
      return 3600;
    default:
      return 3500;
  }
}

function getTemperatureByMode(mode) {
  switch (mode) {
    case "WORMHOLE":
      return 0.75;
    case "MOCK_EXAM":
      return 0.7;
    case "MAGIC":
      return 0.7;
    case "VOCAB_BUILDER":
      return 0.55;
    case "ABC_STARTER":
      return 0.5;
    case "MIDDLE_TEXTBOOK":
      return 0.65;
    default:
      return 0.65;
  }
}

function cleanModelOutput(text, title) {
  let result = sanitizeInput(text);

  result = result.replace(/^```[\s\S]*?\n/, "").replace(/```$/g, "").trim();

  if (title && isLikelyWorkbookTitle(title) && !result.toLowerCase().includes(title.toLowerCase())) {
    result = `# ${title}\n\n${result}`;
  }

  return result;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return sendJson(
      res,
      405,
      { ok: false, error: "Method not allowed. Use POST." },
      origin
    );
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return sendJson(
        res,
        500,
        { ok: false, error: "Missing OPENAI_API_KEY." },
        origin
      );
    }

    const body = req.body || {};
    const prompt = sanitizeInput(body.prompt || body.input || body.content);
    const selectedMode = sanitizeInput(body.mode || "GENERAL").toUpperCase();
    const title = sanitizeInput(body.title || body.worksheetTitle || "");

    if (!prompt) {
      return sendJson(
        res,
        400,
        { ok: false, error: "Prompt is required." },
        origin
      );
    }

    const resolvedMode = resolveMode(selectedMode, prompt);
    const systemPrompt = buildSystemPrompt(resolvedMode, prompt);
    const userPrompt = buildUserPrompt({
      prompt,
      selectedMode,
      resolvedMode,
      title,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: getTemperatureByMode(resolvedMode),
      max_tokens: getMaxTokensByMode(resolvedMode),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    const responseText = cleanModelOutput(rawText, title);

    if (!responseText) {
      return sendJson(
        res,
        500,
        { ok: false, error: "Model returned an empty response." },
        origin
      );
    }

    return sendJson(
      res,
      200,
      {
        ok: true,
        response: responseText,
        selectedMode,
        resolvedMode,
        title: title || null,
      },
      origin
    );
  } catch (error) {
    console.error("api/generate error:", error);

    const statusCode =
      error?.status && Number.isInteger(error.status) ? error.status : 500;

    return sendJson(
      res,
      statusCode,
      {
        ok: false,
        error:
          error?.message ||
          "An unexpected error occurred while generating the worksheet.",
      },
      origin
    );
  }
}
