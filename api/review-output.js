// api/review-output.js

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function json(res, status, payload) {
  return res.status(status).json(payload);
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

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

function inferLanguage(text = "") {
  const t = String(text || "");
  const koreanMatches = t.match(/[가-힣]/g) || [];
  return koreanMatches.length > 0 ? "ko" : "en";
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
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

function countQuestions(text = "") {
  const matches = text.match(/^\s*\d+\./gm) || [];
  return matches.length;
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

// ------------------------------
// UPDATED REVIEW SIGNALS ( 보수적 감지 패턴 적용 )
// ------------------------------
function needsWormholeReview(rawOutput = "") {
  const text = String(rawOutput || "");

  const reviewSignals = [
    /how many of the following/i,
    /select all/i,
    /all the sentences/i,
    /which choice includes only/i,
    /옳은 것의 개수/,
    /어색한 것의 개수/,
    /오류가 있는 문장의 개수/,
    /모두 고른 것은/,
    /복수판단/,
    /A\)\s.+\nB\)\s.+\nC\)\s.+/s,
    /a\.\s.+\nb\.\s.+\nc\.\s.+/s,
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
      temperature: 0.1,
      max_tokens: 4500,
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

function buildWormholeReviewSystemPrompt(language = "ko") {
  const isKo = language === "ko";

  return isKo
    ? `
당신은 MARCUSNOTE의 Wormhole 전용 초경량 검수 필터이다.

당신의 임무는 전체 결과물을 다시 쓰는 것이 아니다.
오직 아래 4가지만 점검하고, 필요한 최소 수정만 수행하라.

[검수 우선순위]
1. 정답 번호가 실제 문항과 일치하는가
2. 개수형 문제의 실제 개수가 맞는가
3. 복수판단형 문제의 조합 정답이 맞는가
4. 해설이 정답과 정확히 일치하는가

[반드시 지킬 규칙]
- 전체 재작성 금지
- 이미 정상인 문항 수정 금지
- 문항 수 변경 금지
- 문항 번호 변경 금지
- 섹션 마커 유지
- 5지선다 유지
- 제목/안내문/전체 흐름 최대한 유지
- 영어 문장은 꼭 필요한 경우에만 최소 수정

[특별 규칙]
- 개수형 문제는 각 항목을 하나씩 검토해 실제 개수를 다시 계산하라.
- 복수판단형 문제는 각 보기 문장을 따로 판단한 뒤 정답 조합을 맞춰라.
- 해설은 길게 쓰지 말고 핵심만 유지하라.
- 너무 쉬운 문항을 새로 만드는 것은 금지한다.
- 오직 오류와 불일치만 고쳐라.

[출력 형식 - 반드시 유지]
[[TITLE]]
(제목 한 줄)

[[INSTRUCTIONS]]
(안내문 한 단락)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. 정답 번호 - 해설
2. 정답 번호 - 해설
...
`.trim()
    : `
You are the ultra-lightweight Wormhole review filter for MARCUSNOTE.
Your job is NOT to rewrite the worksheet.
Only check and minimally fix these four things:

1. whether the keyed answer is correct
2. whether count-type questions have the correct count
3. whether multi-judgment combination answers are correct
4. whether the explanation matches the answer key

[Strict rules]
- no full rewrite
- do not change good questions
- do not change question count
- do not change numbering
- preserve section markers
- preserve 5-option multiple choice
- preserve title, instructions, and overall structure
- only make minimal edits when absolutely necessary

[Special rules]
- Recalculate every count-type question carefully.
- Validate every sentence in multi-judgment questions before confirming the combination.
- Keep explanations short.
- Do not invent a new worksheet.
- Fix only real errors or inconsistencies.

[Required output format]
[[TITLE]]
(one-line title)

[[INSTRUCTIONS]]
(one paragraph)

[[QUESTIONS]]
1. ...
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. correct option - explanation
2. correct option - explanation
...
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
  if (language === "en") {
    return `
Review this Wormhole worksheet only if correction is truly necessary.
Focus only on:
- answer-key mismatch
- wrong counts
- wrong combination answers
- explanation mismatch

Keep everything else unchanged.
Requested question count: ${requestedCount}
Difficulty: ${difficulty}
Worksheet title: ${worksheetTitle || "(none)"}

Original user prompt:
${prompt || "(none)"}

Original worksheet output:
${rawOutput}
`.trim();
  }

  return `
다음 Wormhole 결과물을 정말 필요한 경우에만 최소 수정 검수하시오.
오직 아래만 점검하라:
- 정답 번호 불일치
- 개수형 실제 개수 오류
- 복수판단형 조합 정답 오류
- 해설과 정답 불일치

그 외는 유지하라.
요청 문항 수: ${requestedCount}
난이도: ${difficulty}
워크시트 제목: ${worksheetTitle || "(없음)"}

원래 사용자 요청:
${prompt || "(없음)"}

원본 결과물:
${rawOutput}
`.trim();
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
        reviewMode: "wormhole-skip-light-pass",
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
      reviewMode: "wormhole-ultra-light-filter-v2",
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
