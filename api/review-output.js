// api/review-output.js

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

function sanitizeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function sanitizeEngine(value) {
  const v = sanitizeString(value).toLowerCase();
  if (v === "vocab_workbook" || v === "vocab_csat") return "vocab";
  if (["wormhole", "magic", "mocks", "mock_exam", "vocab", "vocab_workbook", "vocab_csat"].includes(v)) {
    return v === "mock_exam" ? "mocks" : v;
  }
  return "wormhole";
}

function sanitizeDifficulty(value) {
  const v = sanitizeString(value).toLowerCase();
  if (["basic", "standard", "high", "extreme"].includes(v)) return v;
  return "high";
}

function sanitizeCount(value, fallback = 25) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, Math.round(n)));
}

function inferLanguage(text = "") {
  return /[가-힣]/.test(String(text || "")) ? "ko" : "en";
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";
  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;
  if (end === -1) return rawText.slice(from).trim();
  return rawText.slice(from, end).trim();
}

function countQuestions(text = "") {
  return (String(text || "").match(/^\s*\d+\.\s+/gm) || []).length;
}

function normalizeQuestionNumbering(text = "") {
  const blocks = cleanupText(text)
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);
  if (!blocks.length) return cleanupText(text);

  return blocks
    .map((block, idx) => block.replace(/^\s*\d+\.\s*/, `${idx + 1}. `))
    .join("\n\n")
    .trim();
}

function normalizeAnswerNumbering(text = "") {
  const lines = cleanupText(text)
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
  const numbered = lines.filter((line) => /^\d+\.\s+/.test(line));
  if (!numbered.length) return cleanupText(text);
  return numbered
    .map((line, idx) => line.replace(/^\d+\.\s*/, `${idx + 1}. `))
    .join("\n");
}

function buildFallbackSplit(rawText) {
  const cleaned = cleanupText(rawText);
  const answerMatch = cleaned.search(/\n\s*(정답|해설|answers?)\s*[:\-]?\s*\n?/i);
  if (answerMatch === -1) {
    return {
      title: "",
      instructions: "",
      questions: cleaned,
      answers: "",
    };
  }

  return {
    title: "",
    instructions: "",
    questions: cleaned.slice(0, answerMatch).trim(),
    answers: cleaned.slice(answerMatch).trim(),
  };
}

function formatReviewedOutput(rawText, fallbackTitle = "") {
  const title = cleanupText(
    extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]")
  );
  const instructions = cleanupText(
    extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]")
  );
  const questions = cleanupText(
    extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]")
  );
  const answers = cleanupText(
    extractSection(rawText, "[[ANSWERS]]", "")
  );
  if (!title && !instructions && !questions && !answers) {
    const fallback = buildFallbackSplit(rawText);
    return [
      fallbackTitle || "",
      fallback.instructions,
      normalizeQuestionNumbering(fallback.questions),
      fallback.answers ? normalizeAnswerNumbering(fallback.answers) : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return [
    title || fallbackTitle || "",
    instructions,
    questions ? normalizeQuestionNumbering(questions) : "",
    answers ? normalizeAnswerNumbering(answers) : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function detectMagicIntent(text = "") {
  const t = String(text || "").toLowerCase();
  const conceptKeywords = [
    "개념", "개념설명", "설명", "정리", "예문", "문법 설명",
    "grammar explanation", "concept", "examples", "example sentences",
  ];
  const trainingKeywords = [
    "영작", "영작훈련", "쓰기", "writing", "composition", "rearrange",
    "재배열", "문장 완성", "워크북",
  ];
  const isConcept = conceptKeywords.some((k) => t.includes(k));
  const isTraining = trainingKeywords.some((k) => t.includes(k));

  if (isConcept && isTraining) return "concept+training";
  if (isConcept) return "concept";
  return "training";
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 7000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("Empty model response");
  }

  return text.trim();
}

function buildSystemPrompt({ engine, language, difficulty, intentMode }) {
  const isKo = language === "ko";
  
  if (engine === "magic" && (intentMode === "concept" || intentMode === "concept+training")) {
    return isKo
      ? `
당신은 MARCUSNOTE Magic 개념설명 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 이것은 영작훈련지가 아니라, 개념 설명 + 예문 + 간단 확인문항 자료이다.
- 절대로 개념설명 자료를 영작훈련 워크북으로 바꾸지 말 것.
- 반드시 "개념 설명 -> 핵심 구조 정리 -> 예문 -> Mini Check -> 정답" 흐름을 유지할 것.
- 만약 워크북 문항이 너무 많다면, 이를 Mini Check 섹션으로 압축하여 3~5문항으로 줄일 것.
- "짧은 설명 1문단 + 많은 문제" 형태의 구조가 되는 것을 절대 허용하지 말 것.
- NEVER convert concept explanation into writing exercises
- Do not add unnecessary problem sets

반드시 지킬 규칙:
1. 원래 문법 주제와 학습 의도를 유지할 것.
2. 개념 설명이 있으면 보존하고 최소 4~6개 bullet 수준으로 상세히 다듬을 것.
3. 핵심 구조 정리를 반드시 별도 섹션으로 보존할 것.
4. 예문은 6~10개 사이로 유지하며, 문제형이 아닌 완전한 문장으로 고칠 것.
5. Mini Check는 3~5문항 수준으로만 유지할 것.
6. 정답은 완전한 문장으로 고칠 것.
7. 미완성 문장, 끊긴 문장, 어색한 정답을 반드시 수정할 것.
8. 형식, 번호, 줄바꿈, 간격만 정돈하고 과도한 재창작은 하지 말 것.
9. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
10. 마크다운 설명문, 부가 코멘트, 편집자 메모를 넣지 말 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Magic concept sheet.

Core rules:
- This is a concept explanation + examples + mini check sheet.
- Do NOT convert a concept sheet into a writing-only workbook.
- If the worksheet contains too many practice items, compress them into a small mini check section (3-5 items).
- Never allow the structure to become "one short explanation + many workbook items".
- Ensure the output contains: 1. concept explanation, 2. pattern summary, 3. example sentences, 4. mini check, 5. answers.
- NEVER convert concept explanation into writing exercises
- Do not add unnecessary problem sets

Must do:
1. Preserve the original grammar target and learning intention.
2. Keep concept explanation and refine it (at least 4-6 bullet points).
3. Keep pattern summary section if present.
4. Fix example sentences into complete natural sentences (6-10 examples).
5. Keep mini check within 3-5 items.
6. Fix answer lines into complete natural sentences.
7. Repair incomplete or broken sentences.
8. Clean formatting, numbering, spacing only.
9. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
10. Output worksheet only with no commentary.
`.trim();
  }

  if (engine === "magic") {
    return isKo
      ? `
당신은 MARCUSNOTE Magic 영작훈련 워크북을 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 영작훈련 정체성을 반드시 유지할 것.
- 시험지나 개념설명지로 바꾸지 말 것.

반드시 지킬 규칙:
1. 원래 문법 주제와 영작훈련 의도를 유지할 것.
2. 각 문항이 실제 문장 작성을 요구하도록 유지할 것.
3. clue 구조를 불필요하게 삭제하지 말 것.
4. 정답은 모두 완전한 문장으로 고칠 것.
5. 미완성 답안이나 문법 목표에서 벗어난 답안을 수정할 것.
6. 형식, 번호, 줄바꿈, 간격을 정돈할 것.
7. 과도한 재창작은 하지 말 것.
8. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
9. 설명문 추가, 코멘트 추가, 시험형 변환을 하지 말 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Magic writing workbook.
Core rules:
- Preserve writing-training identity.
- Do NOT convert it into a test sheet or concept sheet.
Must do:
1. Preserve the original grammar target and writing-training intention.
2. Keep each item as real sentence-construction practice.
3. Preserve useful clue structure.
4. Fix all answers into complete natural sentences.
5. Repair incomplete or off-target answers.
6. Clean numbering, spacing, and formatting.
7. Avoid excessive rewriting.
8. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
9. Do not add commentary or concept explanation.
`.trim();
  }

  if (engine === "wormhole") {
    return isKo
      ? `
당신은 MARCUSNOTE Wormhole 고난도 문법/시험형 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 시험형 정체성과 고난도 성격을 유지할 것.
- 매직형 영작훈련지로 바꾸지 말 것.

반드시 지킬 규칙:
1. 원래 시험 의도와 문법 포인트를 유지할 것.
2. 문제-정답 논리 충돌을 바로잡을 것.
3. 번호, 형식, 보기 배열, 정답 영역을 정돈할 것.
4. 어색하거나 자기모순적인 해설은 최소 수정할 것.
5. 과도한 재창작은 하지 말 것.
6. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Wormhole high-difficulty exam sheet.
Core rules:
- Preserve exam identity and high-difficulty character.
- Do NOT convert it into a writing workbook.
Must do:
1. Preserve the original exam intention and grammar focus.
2. Repair logic conflicts between items and answers.
3. Clean numbering, options, answer section, and spacing.
4. Fix awkward or self-contradictory explanations minimally.
5. Avoid excessive rewriting.
6. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  if (engine === "mocks") {
    return isKo
      ? `
당신은 MARCUSNOTE Reading Mocks 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 모의고사/독해형 정체성을 유지할 것.
- 워크북형으로 바꾸지 말 것.
반드시 지킬 규칙:
1. 문제 구조와 독해 의도를 유지할 것.
2. 형식과 번호를 정돈할 것.
3. 정답과 해설이 있으면 최소 수정으로 정리할 것.
4. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Reading Mocks sheet.
Core rules:
- Preserve mock-exam / reading identity.
- Do NOT convert it into a workbook.
Must do:
1. Preserve problem structure and reading intention.
2. Clean numbering and formatting.
3. Lightly repair answers/explanations if present.
4. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  if (engine === "vocab") {
    return isKo
      ? `
당신은 MARCUSNOTE Vocab 어휘 학습 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙 (반드시 준수):
For vocabulary worksheets:
- Preserve round structure (Round 1, Round 2, etc.)
- Each round must restart numbering from 1
- Ensure each vocabulary item includes English + Korean meaning
- Do not collapse multiple rounds into one

반드시 지킬 규칙:
1. 어휘 학습지의 라운드(Round) 기반 구조를 보존할 것.
2. 각 라운드는 반드시 번호를 1번부터 시작할 것.
3. 번호 누락 없이 연속적으로 작성할 것.
4. "Vocabulary List -> Vocabulary Test -> Answers" 구조를 유지할 것.
5. Vocabulary List에서는 반드시 영어 + 한국어 뜻 쌍을 보존할 것.
6. 형식, 번호, 간격만 정돈하고 원문 어휘 리스트를 보존할 것.
7. 출력은 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Vocab worksheet.

Core rules:
For vocabulary worksheets:
- Preserve round structure (Round 1, Round 2, etc.)
- Each round must restart numbering from 1
- Ensure each vocabulary item includes English + Korean meaning
- Do not collapse multiple rounds into one

Must do:
1. Keep "Vocabulary List -> Vocabulary Test -> Answers" structure.
2. Preserve English + Korean meaning pairs in vocabulary list.
3. Clean formatting, numbering, and spacing only.
4. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  return isKo
    ? `
당신은 엄격한 교육 자료 편집자이다.
반드시 지킬 규칙:
1. 원래 의도를 유지할 것.
2. 형식, 번호, 간격만 정리할 것.
3. 출력은 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
    : `
You are a strict educational worksheet editor.
Must do:
1. Preserve original intent.
2. Clean formatting, numbering, and spacing only.
3. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
}

function buildUserPrompt({
  engine,
  difficulty,
  count,
  worksheetTitle,
  prompt,
  rawOutput,
  intentMode,
  language,
}) {
  const isKo = language === "ko";
  return isKo
    ? `
[입력 정보]
엔진: ${engine}
난이도: ${difficulty}
문항 수 목표: ${count}
매직 의도 모드: ${intentMode}
제목: ${worksheetTitle || ""}
사용자 요청:
${prompt || ""}

[원본 생성 결과]
${rawOutput || ""}

[검수 작업]
- 구조를 유지하면서 다듬으시오.
- 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 4개 섹션으로 반환하시오.
- 제목은 자연스럽게 정리하되 주제를 바꾸지 마시오.
- instructions는 1개 단락으로 정리하시오.
- questions에는 본문/문항만 넣으시오.
- answers에는 정답/해설만 넣으시오.
- 매직 concept 모드면 개념설명과 예문 흐름을 보존하시오. (문제 수를 늘리지 마시오)
- 매직 training 모드면 영작훈련 구조를 보존하시오.
- 어휘 자료면 라운드 구조와 1번부터 시작하는 번호 체계를 보존하시오.
- 미완성 문장을 반드시 완성하시오.
- 불필요한 잡문, 마크다운, 코드펜스는 넣지 마시오.
`.trim()
    : `
[Input]
Engine: ${engine}
Difficulty: ${difficulty}
Target item count: ${count}
Magic intent mode: ${intentMode}
Title: ${worksheetTitle || ""}
User prompt:
${prompt || ""}

[Raw generated output]
${rawOutput || ""}

[Review task]
- Refine while preserving structure.
- Return exactly 4 sections: [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
- Keep the title natural without changing the topic.
- Keep instructions as one paragraph.
- Put only body/items in questions.
- Put only answer/explanation content in answers.
- If magic concept mode, preserve explanation + examples flow and do NOT increase question count.
- If magic training mode, preserve writing-training flow.
- If vocab mode, preserve round structure and numbering starting from 1.
- Repair incomplete sentences.
- Do not add markdown or commentary.
`.trim();
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const engine = sanitizeEngine(req.body?.engine);
    const difficulty = sanitizeDifficulty(req.body?.difficulty);
    const rawCount = sanitizeCount(req.body?.count, 25);
    const worksheetTitle = sanitizeString(req.body?.worksheetTitle);
    const prompt = sanitizeString(req.body?.prompt);
    const rawOutput = sanitizeString(req.body?.rawOutput);
    const language =
      sanitizeString(req.body?.language) || inferLanguage(`${worksheetTitle}\n${prompt}\n${rawOutput}`);

    if (!rawOutput) {
      return json(res, 400, { error: "No output to review" });
    }

    const intentMode =
      engine === "magic"
        ? detectMagicIntent(`${worksheetTitle}\n${prompt}\n${rawOutput}`)
        : "default";

    // Concept 모드일 때 count 강제 축소
    const count = (intentMode === "concept" || intentMode === "concept+training")
      ? 5
      : rawCount;

    const systemPrompt = buildSystemPrompt({
      engine,
      language,
      difficulty,
      intentMode,
    });

    const userPrompt = buildUserPrompt({
      engine,
      difficulty,
      count,
      worksheetTitle,
      prompt,
      rawOutput,
      intentMode,
      language,
    });

    const reviewedRaw = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatReviewedOutput(reviewedRaw, worksheetTitle);

    if (!formatted) {
      return json(res, 500, { error: "Empty review output" });
    }

    return json(res, 200, {
      result: formatted,
      fullText: formatted,
      content: formatted,
      meta: {
        engine,
        difficulty,
        count,
        language,
        intentMode,
      },
    });
  } catch (error) {
    return json(res, 500, {
      error: error?.message || "Internal server error",
    });
  }
}
