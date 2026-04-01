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
  if (["wormhole", "magic", "mocks", "vocab"].includes(v)) return v;
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
    extractSection(rawText, "[[ANSWERS]]", null)
  );

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
반드시 아래 구조만 출력
[[TITLE]]
...
[[INSTRUCTIONS]]
...
[[QUESTIONS]]
1. ...
2. ...
[[ANSWERS]]
1. ...
2. ...
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

Output only this structure:
[[TITLE]]
...
[[INSTRUCTIONS]]
...
[[QUESTIONS]]
1. ...
2. ...
[[ANSWERS]]
1. ...
2. ...
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
      max_tokens: 3200,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
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

    if (engine !== "wormhole") {
      return json(res, 400, {
        success: false,
        error: "UNSUPPORTED_ENGINE",
        message: "이 리뷰 필터는 wormhole 전용입니다.",
      });
    }

    if (!needsWormholeReview(rawOutput) && looksStructuredEnough(rawOutput)) {
      const passthrough = formatReviewedOutput(rawOutput, worksheetTitle);

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

    const systemPrompt = buildWormholeReviewSystemPrompt(language);
    const userPrompt = buildWormholeReviewUserPrompt({
      prompt,
      rawOutput,
      difficulty,
      requestedCount,
      worksheetTitle,
      language,
    });

    const reviewedRaw = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatReviewedOutput(reviewedRaw, worksheetTitle);

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
      reviewMode: "wormhole-count-answer-review-v2",
    });
  } catch (error) {
    console.error("review-output error:", error);

    return json(res, 500, {
      success: false,
      error: "REVIEW_FAILED",
      message: "웜홀 출력 검수에 실패했습니다.",
      detail: error?.message || "Unknown error",
    });
  }
}
