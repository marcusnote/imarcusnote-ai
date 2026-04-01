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
  if (["wormhole", "magic", "mocks", "mock_exam", "vocab"].includes(v)) {
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
    .join("\n")
    .trim();
}

function buildFallbackSplit(rawText) {
  const cleaned = cleanupText(rawText);
  const answerMatch = cleaned.search(/\n\s*(정답\s*및\s*해설|정답과\s*해설|정답|해설|answers?)\s*[:\-]?\s*\n?/i);

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

function enforceHighDifficultyLabels(questionsText = "") {
  const blocks = cleanupText(questionsText)
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!blocks.length) return cleanupText(questionsText);

  const upgraded = blocks.map((block) => {
    const lines = block.split("\n");
    if (!lines.length) return block;

    const firstLine = lines[0];
    const hasFivePoint = /\((?:5|6|7|8|9|10)\s*(?:점|points?)\)/i.test(firstLine);
    const hasLabel = /\[High Difficulty\]/i.test(firstLine);

    if (hasFivePoint && !hasLabel) {
      lines[0] = firstLine.replace(/\s*\((?:5|6|7|8|9|10)\s*(?:점|points?)\)/i, (m) => ` [High Difficulty] ${m}`);
    }

    return lines.join("\n");
  });

  return upgraded.join("\n\n").trim();
}

function formatReviewedOutput(rawText, fallbackTitle = "", engine = "wormhole") {
  const title = cleanupText(extractSection(rawText, "[[TITLE]]", "[[INSTRUCTIONS]]"));
  const instructions = cleanupText(extractSection(rawText, "[[INSTRUCTIONS]]", "[[QUESTIONS]]"));
  const questions = cleanupText(extractSection(rawText, "[[QUESTIONS]]", "[[ANSWERS]]"));
  const answers = cleanupText(extractSection(rawText, "[[ANSWERS]]", null));

  let finalTitle = title || fallbackTitle;
  let finalInstructions = instructions;
  let finalQuestions = questions;
  let finalAnswers = answers;

  if (!finalQuestions) {
    const fallback = buildFallbackSplit(rawText);
    finalTitle = finalTitle || fallbackTitle;
    finalInstructions = fallback.instructions;
    finalQuestions = fallback.questions;
    finalAnswers = fallback.answers;
  }

  finalQuestions = normalizeQuestionNumbering(finalQuestions);
  if (engine === "mocks") {
    finalQuestions = enforceHighDifficultyLabels(finalQuestions);
  }
  finalAnswers = normalizeAnswerNumbering(finalAnswers);

  const contentParts = [];
  if (finalTitle) contentParts.push(finalTitle);
  if (finalInstructions) contentParts.push(finalInstructions);
  if (finalQuestions) contentParts.push(finalQuestions);

  const fullParts = [...contentParts];
  if (finalAnswers) fullParts.push("정답 및 해설\n" + finalAnswers);

  return {
    title: finalTitle,
    instructions: finalInstructions,
    content: cleanupText(contentParts.join("\n\n")),
    answerSheet: cleanupText(finalAnswers),
    fullText: cleanupText(fullParts.join("\n\n")),
    actualCount: countQuestions(finalQuestions),
  };
}

function needsWormholeReview(rawOutput = "") {
  const text = String(rawOutput || "");
  const reviewSignals = [
    /how many of the following/i,
    /select all/i,
    /all the sentences/i,
    /which of the following are correct/i,
    /옳은 것의 개수/,
    /옳지 않은 것의 개수/,
    /어색한 것의 개수/,
    /오류가 있는 문장의 개수/,
    /개수형/,
    /모두 고른 것은/,
    /복수판단/,
    /A\)\s.+\nB\)\s.+/s,
    /a\.\s.+\nb\.\s.+/s,
  ];
  return reviewSignals.some((pattern) => pattern.test(text));
}

function looksStructuredEnough(rawOutput = "") {
  const text = String(rawOutput || "");
  const hasTitle = text.includes("[[TITLE]]");
  const hasQuestions = text.includes("[[QUESTIONS]]");
  const hasAnswers = text.includes("[[ANSWERS]]");
  return hasTitle && hasQuestions && hasAnswers;
}

function buildMocksReviewSystemPrompt(language = "ko") {
  if (language === "en") {
    return `
You are the MOCKS PREMIUM review engine of I•marcusnote.
Your task is to validate and refine an already generated high-school transformed exam set.

[MOCKS PREMIUM VALIDATION RULES]
1. Confirm that the set matches a premium high-school transformed exam style.
2. Confirm that the following core types are meaningfully represented:
   - main idea
   - gist / key point
   - author’s claim
   - author’s attitude
   - title
3. Confirm that gist is clearly distinct from main idea and claim.
4. Confirm that synonym / equivalent / antonym items are context-based, not memorization-based.
5. Confirm that implication and inference items require genuine reasoning.
6. Confirm that distractors are plausible and not obviously weak.
7. If a question is worth 5 points or more, ensure [High Difficulty] is present.
8. If [High Difficulty] exists on an easy item, raise the item quality.
9. Preserve [High Difficulty] in the final visible output.
10. Upgrade shallow items into premium transformed items when necessary.
11. Preserve numbering and overall structure unless a correction is necessary.
12. Keep the requested count as closely as possible.

You must output only:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
`.trim();
  }

  return `
당신은 I•marcusnote의 MOCKS PREMIUM 전용 검수 엔진이다.
역할: 이미 생성된 Mocks 변형 문제 결과물이 프리미엄 고등 시험 수준에 부합하는지 검수하고 보정한다.

[MOCKS PREMIUM VALIDATION RULES]
1. 결과물이 상위권 고등 변형 문제 스타일인지 확인하라.
2. 다음 핵심 유형들이 의미 있게 포함되었는지 확인하라:
   - 주제
   - 요지
   - 주장
   - 글쓴이의 태도
   - 제목
3. 요지가 주제 및 주장과 명확히 구분되는지 확인하라.
4. 유의어/동의어/반의어 문항이 단순 암기식이 아닌 문맥 기반인지 확인하라.
5. 의미함축 및 추론 문항이 실제적인 논리 추론을 요구하는지 확인하라.
6. 선택지가 그럴듯하며 명백히 쉬운 오답이 아닌지 확인하라.
7. 5점 이상 문항에는 반드시 [High Difficulty] 표기가 있는지 확인하라.
8. 쉬운 문항에 [High Difficulty]가 붙어 있다면 문항 질을 상향하라.
9. [High Difficulty] 표기를 최종 출력에 반드시 유지하라.
10. 피상적인 문항은 필요시 프리미엄 변형 문항으로 업그레이드하라.
11. 번호와 전체 구조는 꼭 유지하되 필요한 부분만 정교하게 수정하라.
12. 요청 문항 수와 실제 문항 수가 크게 어긋나지 않게 보정하라.

[[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 마커를 반드시 사용하라.
`.trim();
}

function buildMocksReviewUserPrompt({
  prompt,
  rawOutput,
  requestedCount,
  difficulty,
  worksheetTitle,
  language,
}) {
  if (language === "en") {
    return `
Target engine: mocks
Requested count: ${requestedCount}
Difficulty: ${difficulty}
Worksheet title: ${worksheetTitle || "(none)"}

Original user request:
${prompt || "(none)"}

Original output to review:
${rawOutput}

Apply the MOCKS PREMIUM VALIDATION RULES.
Return only the final reviewed worksheet in the required marker structure.
`.trim();
  }

  return `
검수 대상 엔진: mocks
요청 문항 수: ${requestedCount}
난이도: ${difficulty}
워크시트 제목: ${worksheetTitle || "(없음)"}

원본 사용자 요청:
${prompt || "(없음)"}

검수할 원본 결과물:
${rawOutput}

위의 MOCKS PREMIUM VALIDATION RULES를 적용하여 최종 시험지를 완성하라.
구조는 유지하되 문제의 질, 논리, 선택지, 표기를 프리미엄 수준으로 보정하라.
반드시 최종 출력물만 작성하라.
`.trim();
}

function buildWormholeReviewSystemPrompt(language = "ko") {
  if (language === "ko") {
    return `
당신은 I•marcusnote의 WORMHOLE 전용 검수 필터 v2이다.
역할:
- 이미 생성된 웜홀 결과물을 전체 재작성하지 말고, 필요한 부분만 정교하게 수정한다.
- 특히 문항 개수, 번호, 정답, 개수형 판단 논리를 엄격하게 검수한다.

최우선 검수 포인트:
1. 문항 수가 요청 개수와 정확히 일치하는가
2. 문항 번호가 1번부터 순서대로 이어지는가
3. 정답/해설 줄 수가 문항 수와 정확히 일치하는가
4. 개수형 문제의 실제 개수가 정답과 일치하는가
5. 문항 본문과 정답이 서로 모순되지 않는가
6. 제목/지시문/문항/정답 구조가 깨지지 않았는가

행동 원칙:
- 구조를 최대한 유지한다.
- 문항 자체가 좋으면 최소 수정만 한다.
- 개수형/정답 불일치/번호 꼬임은 반드시 수정한다.
- 필요시 영어 문장 자체의 명백한 오류만 최소 수정한다.
- 불필요한 해설 확장 금지.
- 새 문항 대량 생성 금지.
- 요청 개수보다 많으면 뒤를 잘라라.
- 부족하면 기존 문항을 근거로 최소 보정하되, 가능하면 구조 파손 없이 맞춰라.

출력 형식:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
`.trim();
  }

  return `
You are the WORMHOLE review filter v2 for I•marcusnote.
Role:
- Do not fully rewrite the worksheet.
- Repair only what is necessary.
- Strictly verify item count, numbering, answers, and count-based logic.

Top review priorities:
1. Question count matches the requested count exactly.
2. Question numbering runs cleanly from 1 onward.
3. Answer lines match the question count exactly.
4. Count-based items are recalculated and corrected.
5. No contradiction between question body and answer sheet.
6. Title / instruction / questions / answers structure stays intact.

Behavior rules:
- Preserve structure whenever possible.
- Minimal edits if the worksheet is already strong.
- Fix count-logic, answer mismatch, and numbering errors.
- Only minimally fix obvious English issues if needed.
- Do not over-expand explanations.
- Do not generate large amounts of new content.
- Trim overflow items if there are too many.
- If there are too few, repair conservatively.

Output only:
[[TITLE]]
[[INSTRUCTIONS]]
[[QUESTIONS]]
[[ANSWERS]]
`.trim();
}

function buildWormholeReviewUserPrompt({
  prompt,
  rawOutput,
  difficulty,
  requestedCount,
  worksheetTitle,
  language,
}) {
  if (language === "ko") {
    return `
검수 대상 엔진: wormhole
난이도: ${difficulty}
요청 문항 수: ${requestedCount}
워크시트 제목: ${worksheetTitle || "(없음)"}

원래 사용자 요청:
${prompt || "(없음)"}

원본 결과물:
${rawOutput}

검수 초점:
- 정답 번호 오류 수정
- 개수형 문제의 실제 개수 재검산
- 정답/해설과 문항 본문 불일치 수정
- 문제 수와 정답 수를 정확히 맞추기
- 구조는 유지하고 필요한 부분만 최소 수정

반드시 최종 출력만 작성하라.
`.trim();
  }

  return `
Target engine: wormhole
Difficulty: ${difficulty}
Requested item count: ${requestedCount}
Worksheet title: ${worksheetTitle || "(none)"}

Original user request:
${prompt || "(none)"}

Original output:
${rawOutput}

Review focus:
- fix answer numbering errors
- recalculate count-based questions
- fix contradictions between questions and answers
- align question count and answer count exactly
- preserve structure and edit minimally

Return only the final reviewed worksheet.
`.trim();
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
      max_tokens: 5000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI review request failed");
  }

  return String(data?.choices?.[0]?.message?.content || "").trim();
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const engine = sanitizeEngine(req.body?.engine || "wormhole");
    const prompt = sanitizeString(req.body?.prompt || req.body?.userPrompt || "");
    const rawOutput = sanitizeString(req.body?.rawOutput || "");
    const difficulty = sanitizeDifficulty(req.body?.difficulty || "high");
    const requestedCount = sanitizeCount(
      req.body?.count || req.body?.requestedCount || 25,
      25
    );
    const worksheetTitle = sanitizeString(req.body?.worksheetTitle || "");
    const language = ["ko", "en"].includes(req.body?.language)
      ? req.body.language
      : inferLanguage(`${prompt}\n${rawOutput}\n${worksheetTitle}`);

    if (!rawOutput) {
      return json(res, 400, {
        success: false,
        error: "INVALID_REQUEST",
        message: "rawOutput이 필요합니다.",
      });
    }

    let systemPrompt;
    let userPrompt;
    let reviewMode = "unknown";

    if (engine === "mocks") {
      systemPrompt = buildMocksReviewSystemPrompt(language);
      userPrompt = buildMocksReviewUserPrompt({
        prompt,
        rawOutput,
        requestedCount,
        difficulty,
        worksheetTitle,
        language,
      });
      reviewMode = "mocks-premium-validation-v2";
    } else if (engine === "wormhole") {
      if (!needsWormholeReview(rawOutput) && looksStructuredEnough(rawOutput)) {
        const passthrough = formatReviewedOutput(rawOutput, worksheetTitle, engine);
        return json(res, 200, {
          success: true,
          engine,
          title: passthrough.title,
          difficulty,
          requestedCount,
          actualCount: passthrough.actualCount,
          instructions: passthrough.instructions,
          content: passthrough.content,
          answerSheet: passthrough.answerSheet,
          fullText: passthrough.fullText,
          reviewed: false,
          reviewMode: "wormhole-skip-light-pass-v2",
        });
      }

      systemPrompt = buildWormholeReviewSystemPrompt(language);
      userPrompt = buildWormholeReviewUserPrompt({
        prompt,
        rawOutput,
        difficulty,
        requestedCount,
        worksheetTitle,
        language,
      });
      reviewMode = "wormhole-count-answer-review-v2";
    } else {
      const passthrough = formatReviewedOutput(rawOutput, worksheetTitle, engine);
      return json(res, 200, {
        success: true,
        engine,
        title: passthrough.title,
        difficulty,
        requestedCount,
        actualCount: passthrough.actualCount,
        instructions: passthrough.instructions,
        content: passthrough.content,
        answerSheet: passthrough.answerSheet,
        fullText: passthrough.fullText,
        reviewed: false,
        reviewMode: "engine-passthrough",
      });
    }

    const reviewedRaw = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatReviewedOutput(reviewedRaw, worksheetTitle, engine);

    return json(res, 200, {
      success: true,
      engine,
      title: formatted.title,
      difficulty,
      requestedCount,
      actualCount: formatted.actualCount,
      instructions: formatted.instructions,
      content: formatted.content,
      answerSheet: formatted.answerSheet,
      fullText: formatted.fullText,
      reviewed: true,
      reviewMode,
    });
  } catch (error) {
    console.error("review-output error:", error);
    return json(res, 500, {
      success: false,
      error: "REVIEW_FAILED",
      message: "출력 검수에 실패했습니다.",
      detail: error?.message || "Unknown error",
    });
  }
}
