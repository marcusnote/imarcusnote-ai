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

function hasFiveChoicePattern(text = "") {
  const source = String(text || "");
  return /①[\s\S]*②[\s\S]*③[\s\S]*④[\s\S]*⑤/.test(source);
}

function looksNonWormholeType(text = "") {
  return /변형하세요|빈칸|채우세요|수정하세요|rewrite|fill in the blank|correct the sentence/i.test(
    String(text || "")
  );
}

function formatReviewedOutput(rawText, fallbackTitle = "") {
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
    wormholeFormatOk: hasFiveChoicePattern(finalQuestions),
  };
}

function needsWormholeReview(rawOutput = "") {
  const text = String(rawOutput || "");

  if (!hasFiveChoicePattern(text)) return true;
  if (looksNonWormholeType(text)) return true;

  const reviewSignals = [
    /how many of the following/i,
    /select all/i,
    /all the sentences/i,
    /which choice includes only/i,
    /옳은 것의 개수/,
    /옳지 않은 것의 개수/,
    /어색한 것의 개수/,
    /오류가 있는 문장의 개수/,
    /모두 고른 것은/,
    /복수판단/,
    /①[\s\S]*②[\s\S]*③[\s\S]*④[\s\S]*⑤/,
  ];

  return reviewSignals.some((pattern) => pattern.test(text));
}

function buildWormholeReviewSystemPrompt(language = "ko") {
  if (language === "ko") {
    return `
당신은 I•marcusnote의 WORMHOLE 전용 검수 필터 v3이다.

역할:
- 이미 생성된 웜홀 결과물을 웜홀 정체성에 맞게 교정한다.
- 특히 형식이 잘못되었으면 반드시 5지선다형 판별 문제로 재구성한다.
- 개수, 정답, 번호, 선택지 구조를 엄격하게 검수한다.

웜홀 형식 절대 규칙:
1. 모든 문항은 반드시 5지선다형이다.
2. 모든 문항은 반드시 아래 구조를 가진다:
   1. 문제문
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
3. 웜홀은 반드시 판별형/선택형/개수형이어야 한다.
4. 금지:
   - 문장을 변형하세요
   - 빈칸을 채우세요
   - 오류를 직접 고쳐 쓰세요
   - 서술형 주관식
5. 개수형 문항은 실제 개수를 다시 계산한다.
6. 정답은 문항별로 하나씩 존재해야 한다.
7. 답 형식은 반드시:
   1. ③ - 짧은 근거
   2. ① - 짧은 근거
8. 구조가 약하면 전체를 웜홀형 객관식으로 재작성해도 된다.

출력 형식:
[[TITLE]]
...

[[INSTRUCTIONS]]
...

[[QUESTIONS]]
1. 문제문
① ...
② ...
③ ...
④ ...
⑤ ...

2. 문제문
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - 근거
2. ① - 근거
...
`.trim();
  }

  return `
You are the WORMHOLE review filter v3 for I•marcusnote.

Role:
- Repair the generated wormhole output so it fully matches wormhole identity.
- If the format is wrong, convert it into 5-choice judgment-based multiple-choice.
- Strictly verify count, answers, numbering, and options.

Absolute wormhole rules:
1. Every item must be 5-choice multiple-choice.
2. Every item must follow:
   1. Question
   ① ...
   ② ...
   ③ ...
   ④ ...
   ⑤ ...
3. Wormhole must be judgment-based, choice-based, or count-based.
4. Forbidden:
   - Rewrite the sentence
   - Fill in the blank
   - Correct it in writing
   - Subjective/open-ended items
5. Recalculate count-based questions.
6. Exactly one answer line per item.
7. Answer format must be:
   1. ③ - brief reason
   2. ① - brief reason
8. If needed, rewrite the whole set into wormhole-style multiple-choice.

Output format:
[[TITLE]]
...

[[INSTRUCTIONS]]
...

[[QUESTIONS]]
1. Question
① ...
② ...
③ ...
④ ...
⑤ ...

2. Question
① ...
② ...
③ ...
④ ...
⑤ ...

[[ANSWERS]]
1. ③ - brief reason
2. ① - brief reason
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
- 웜홀은 반드시 5지선다형으로 교정
- 비객관식이면 객관식으로 재구성
- 개수형 문제는 실제 개수 재검산
- 정답/번호/선택지 수 정렬
- 선택지는 학생이 실제로 헷갈릴 만한 문법 포인트 반영
- 최종적으로 모든 문항에 ① ② ③ ④ ⑤가 있어야 함

반드시 최종 출력만 작성하라.
`.trim();
  }

  return `
Target engine: wormhole
Difficulty: ${difficulty}
Requested item count: ${requestedCount}
Worksheet title: ${worksheetTitle || "(none)"}

Original request:
${prompt || "(none)"}

Original output:
${rawOutput}

Review focus:
- convert wormhole into strict 5-choice multiple-choice if needed
- rebuild non-multiple-choice items into wormhole style
- recalculate count-based questions
- align numbering, answer count, and option structure
- every item must contain ① ② ③ ④ ⑤

Return only the final reviewed worksheet.
`.trim();
}

async function callOpenAI(systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 3600,
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

  if (req.method === "OPTIONS") return res.status(200).end();

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

    const mustReview = needsWormholeReview(rawOutput);

    if (!mustReview) {
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
        reviewMode: "wormhole-pass-v3",
        wormholeFormatOk: passthrough.wormholeFormatOk,
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
      reviewMode: "wormhole-format-enforced-v3",
      wormholeFormatOk: formatted.wormholeFormatOk,
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
