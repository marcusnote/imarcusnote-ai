export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "https://imarcusnote.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Method guard
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { engine, prompt, rawOutput, difficulty } = req.body || {};

    if (!rawOutput || !String(rawOutput).trim()) {
      return res.status(400).json({ error: "No output to review" });
    }

    const normalizedEngine = String(engine || "unknown").toLowerCase();
    const normalizedDifficulty = String(difficulty || "standard").toLowerCase();

    function buildReviewPrompt() {
      if (normalizedEngine === "wormhole") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content while PRESERVING Wormhole identity.

[INPUT]
Engine: wormhole
Difficulty: ${normalizedDifficulty}
User Prompt: ${prompt || ""}

[CONTENT]
${rawOutput}

[WORMHOLE CORE IDENTITY]
- Wormhole is a premium grammar exam engine.
- It may include objective test-style items.
- It must preserve grammar-testing identity.
- It must NOT be converted into a generic workbook or casual practice sheet.

[STRICT RULES]
1. MUST preserve the original grammar topic and educational intention.
2. MUST improve formatting consistency, clarity, numbering, and worksheet quality.
3. MUST preserve exam-style structure if the content is already exam-oriented.
4. MUST NOT remove multiple-choice format if the original output is clearly exam-style and valid.
5. MUST remove obvious duplication, broken numbering, malformed spacing, noisy symbols, and accidental corruption.
6. MUST keep title / instruction / questions / answers structurally aligned.
7. If the content is already strong, do only light correction.
8. DO NOT add explanations, commentary, or notes outside the worksheet itself.
9. Output CLEAN final worksheet text only.

[OUTPUT STYLE]
Return only the polished final worksheet.
No markdown fences.
No extra explanation.
`.trim();
      }

      if (normalizedEngine === "magic") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content while PRESERVING Magic identity.

[INPUT]
Engine: magic
Difficulty: ${normalizedDifficulty}
User Prompt: ${prompt || ""}

[CONTENT]
${rawOutput}

[MAGIC CORE IDENTITY]
- Magic is a workbook-style English writing / transformation engine.
- It should feel like guided training, not a trap-based exam.
- It should prioritize learner output and structured practice.

[STRICT RULES]
1. MUST preserve the original topic and educational intention.
2. MUST improve formatting consistency, clarity, numbering, and worksheet quality.
3. MUST preserve workbook-style training identity.
4. SHOULD remove accidental multiple-choice remnants such as ①②③④⑤ or a/b/c/d/e when they appear by mistake.
5. MUST remove obvious duplication, broken numbering, malformed spacing, and noisy symbols.
6. MUST keep title / instruction / questions / answers aligned.
7. If the content is already strong, do only light correction.
8. DO NOT add explanations, commentary, or notes outside the worksheet itself.
9. Output CLEAN final worksheet text only.

[OUTPUT STYLE]
Return only the polished final worksheet.
No markdown fences.
No extra explanation.
`.trim();
      }

      if (normalizedEngine === "mocks") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content while PRESERVING Mocks identity.

[INPUT]
Engine: mocks
Difficulty: ${normalizedDifficulty}
User Prompt: ${prompt || ""}

[CONTENT]
${rawOutput}

[MOCKS CORE IDENTITY]
- Mocks is a premium high-school exam and passage-transformation engine.
- It may include objective test-style items.
- It must remain test-oriented and editorially polished.

[STRICT RULES]
1. MUST preserve the original topic and exam intention.
2. MUST improve formatting consistency, clarity, numbering, and worksheet quality.
3. MUST preserve objective / exam-style structure when appropriate.
4. MUST NOT convert valid exam content into a casual workbook.
5. MUST remove obvious duplication, broken numbering, malformed spacing, and noisy symbols.
6. MUST keep title / instruction / questions / answers structurally aligned.
7. If the content is already strong, do only light correction.
8. DO NOT add explanations, commentary, or notes outside the worksheet itself.
9. Output CLEAN final worksheet text only.

[OUTPUT STYLE]
Return only the polished final worksheet.
No markdown fences.
No extra explanation.
`.trim();
      }

      return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content.

[INPUT]
Engine: ${normalizedEngine}
Difficulty: ${normalizedDifficulty}
User Prompt: ${prompt || ""}

[CONTENT]
${rawOutput}

[STRICT RULES]
1. MUST preserve the original topic and educational intention.
2. MUST improve formatting consistency, clarity, numbering, and worksheet quality.
3. MUST remove obvious duplication, broken numbering, malformed spacing, and noisy symbols.
4. If the content is already strong, do only light correction.
5. DO NOT add explanations, commentary, or notes.
6. Output CLEAN final worksheet text only.

[OUTPUT STYLE]
Return only the polished final worksheet.
No markdown fences.
No extra explanation.
`.trim();
    }

    const reviewPrompt = buildReviewPrompt();

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: reviewPrompt,
        max_output_tokens: 3000
      })
    });

    const data = await openaiRes.json().catch(() => ({}));

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: data?.error?.message || "OpenAI review request failed"
      });
    }

    const reviewedText =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    if (!reviewedText || !String(reviewedText).trim()) {
      return res.status(500).json({ error: "Empty review output" });
    }

    return res.status(200).json({
      result: reviewedText.trim()
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Internal server error"
    });
  }
}
