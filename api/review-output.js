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

function extractSection(rawText, startMarker, endMarker) {
  const start = rawText.indexOf(startMarker);
  if (start === -1) return "";

  const from = start + startMarker.length;
  const end = endMarker ? rawText.indexOf(endMarker, from) : -1;

  if (end === -1) return rawText.slice(from).trim();
  return rawText.slice(from, end).trim();
}

function cleanupText(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function buildWormholeReviewSystemPrompt(language = "ko") {
  const isKo = language === "ko";

  return isKo
    ? `
당신은 MARCUSNOTE의 Wormhole 전용 검수 필터이다.

당신의 역할은 "전체를 새로 쓰는 것"이 아니다.
당신의 역할은 기존 결과물을 유지하면서,
오류, 불일치, 저품질 요소만 정밀하게 수정하는 것이다.

[핵심 목표]
- 문제 수 유지
- 5지선다 유지
- 문제/정답 섹션 유지
- 기존 자료의 구조와 흐름 최대한 유지
- 개수형 문제와 복수판단형 문제의 정답 정확도 보정
- 해설과 정답의 불일치 제거
- 너무 쉬운 문항 또는 허술한 오답만 최소한으로 수정

[절대 원칙]
1. 전체를 새로 다시 만들지 마라.
2. 이미 괜찮은 문항은 손대지 마라.
3. 오직 틀린 문항, 애매한 문항, 어색한 해설만 수정하라.
4. 반드시 기존 문항 번호를 유지하라.
5. 반드시 기존 문항 수를 유지하라.
6. 반드시 출력 섹션 형식을 유지하라.

[특별 검수 규칙: Wormhole]
1. 모든 문항은 5지선다인지 확인하라.
2. 정답 번호가 실제 문항과 일치하는지 확인하라.
3. 해설이 정답 근거와 정확히 맞는지 확인하라.
4. 개수형 문제는 반드시 각 문장을 하나씩 검토한 후 실제 개수를 다시 계산하라.
5. 복수판단형 문제는 각 보기 문장을 개별 검토하고 조합 정답이 맞는지 확인하라.
6. "옳은 것의 개수", "어색한 것의 개수", "오류가 있는 문장의 개수" 유형은 특히 엄격하게 검수하라.
7. 너무 쉬운 문항이 있으면, 문항 구조를 완전히 갈아엎지 않는 선에서 보기나 문장을 조금만 조정하라.
8. 문항과 해설 사이에 불일치가 있으면 반드시 바로잡아라.
9. 밑줄형/구조판단형/복수판단형/개수형 문제의 판단 논리가 명확해야 한다.
10. 어색한 영어 문장이 있으면 최소 수정으로 자연스럽게 고쳐라.

[특히 금지]
- 전체 재작성
- 문항 수 변경
- 문제 유형 대량 변경
- 해설 삭제
- 제목/구조 무시
- 섹션 마커 누락

[출력 형식 - 반드시 그대로]
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
You are the dedicated MARCUSNOTE Wormhole review filter.

Your role is NOT to rewrite the whole worksheet.
Your role is to preserve the original structure while fixing only:
- wrong answer keys
- mismatched explanations
- weak or ambiguous logic
- count-type and multi-judgment inconsistencies
- obviously weak distractors

[Core goals]
- preserve question count
- preserve 5-option multiple choice
- preserve section structure
- preserve numbering
- correct only what is actually weak or wrong

[Strict rules]
1. Do NOT rewrite the entire worksheet.
2. Keep all good questions unchanged.
3. Fix only incorrect, ambiguous, awkward, or weak parts.
4. Keep the original question numbering.
5. Keep the original number of questions.
6. Keep the exact section-marker structure.

[Wormhole review checks]
1. Every question must still have exactly 5 answer choices.
2. Every answer key must match the actual correct answer.
3. Every explanation must match the keyed answer.
4. For count-type questions, check each sentence one by one and recalculate the actual count.
5. For multi-judgment questions, validate every sentence and the final combination choice.
6. Be especially strict with:
- how many are correct
- how many are awkward
- how many contain an error
7. If a question is too easy, improve it only minimally.
8. Fix awkward English only with minimal edits.
9. Preserve the overall worksheet identity and structure.

[Strictly forbidden]
- full rewrite
- changing question count
- removing explanations
- removing section markers
- changing the worksheet into a different style

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
Review the following Wormhole worksheet output.

Review focus:
- Fix wrong answer keys
- Fix wrong counts in count-type questions
- Fix mismatched explanations
- Fix ambiguous or grammatically awkward items only when necessary
- Preserve the original structure as much as possible

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
다음 Wormhole 결과물을 검수하시오.

검수 초점:
- 정답 번호 오류 수정
- 개수형 문제의 실제 개수 재검산
- 해설과 정답 불일치 수정
- 필요한 경우에만 영어 문장 또는 보기의 어색함 최소 수정
- 전체 구조와 문항 흐름은 최대한 유지

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
    const requestedCount = sanitizeCount(req.body?.count || req.body?.requestedCount || 25, 25);
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
      reviewMode: "wormhole-lightweight-filter",
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
