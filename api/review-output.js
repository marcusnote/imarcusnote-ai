export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "https://imarcusnote.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

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

    // 너무 긴 경우 방어
    if (String(rawOutput).length > 45000) {
      return res.status(400).json({ error: "Review content too long" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const normalizedEngine = String(engine || "unknown").toLowerCase().trim();
    const normalizedDifficulty = String(difficulty || "standard").toLowerCase().trim();

    function wrapUserPrompt(value) {
      return [
        "<<<USER_PROMPT_START>>>",
        String(value || "").trim(),
        "<<<USER_PROMPT_END>>>"
      ].join("\n");
    }

    function wrapContent(value) {
      return [
        "<<<CONTENT_START>>>",
        String(value || "").trim(),
        "<<<CONTENT_END>>>"
      ].join("\n");
    }

    function buildReviewPrompt() {
      if (normalizedEngine === "wormhole") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content while PRESERVING Wormhole identity.

[INPUT]
Engine: wormhole
Difficulty: ${normalizedDifficulty}

User Prompt:
${wrapUserPrompt(prompt)}

Content to Review:
${wrapContent(rawOutput)}

[WORMHOLE CORE IDENTITY]
- Wormhole is a premium grammar exam engine.
- It must preserve grammar-testing identity.

[STRICT RULES]
1. MUST preserve original topic and intention.
2. MUST preserve exam-style structure.
3. MUST NOT remove valid multiple-choice format.
4. MUST fix formatting, numbering, spacing.
5. MUST remove duplication and corruption.
6. MUST NOT invent new items.
7. DO NOT add commentary.
8. Output CLEAN final worksheet only.

[OUTPUT STYLE]
Final worksheet only.
No markdown.
`.trim();
      }

      if (normalizedEngine === "magic") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX, STANDARDIZE, and ENFORCE Magic identity.

[INPUT]
Engine: magic
Difficulty: ${normalizedDifficulty}

User Prompt:
${wrapUserPrompt(prompt)}

Content to Review:
${wrapContent(rawOutput)}

[MAGIC CORE IDENTITY]
- Magic is a guided English writing-training workbook.
- It prioritizes learner production, not exam traps.

[STRICT RULES]
1. MUST preserve writing-training identity.
2. MUST preserve input-language prompts.
3. MUST preserve generous clue structure.
4. MUST NOT remove useful clue words.
5. MUST preserve rearrangement tasks including extra-word format.
6. MUST remove accidental multiple-choice remnants.
7. MUST convert exam-style drift into workbook style.
8. MUST NOT invent large amounts of new clue content.
9. MUST NOT invent new items.
10. MUST fix formatting, numbering, spacing.
11. MUST preserve item count.
12. DO NOT add commentary.
13. If already strong, do minimal correction only.

[HARD FILTERS]
- No exam-style conversion
- No explanations
- No markdown
- No extra sections

[OUTPUT STYLE]
Final worksheet only.
`.trim();
      }

      if (normalizedEngine === "mocks") {
        return `
You are a strict educational content reviewer for I•marcusnote.

Your role is to FIX and STANDARDIZE while preserving exam identity.

[INPUT]
Engine: mocks
Difficulty: ${normalizedDifficulty}

User Prompt:
${wrapUserPrompt(prompt)}

Content:
${wrapContent(rawOutput)}

[STRICT RULES]
1. MUST preserve exam structure.
2. MUST fix formatting.
3. MUST remove corruption.
4. MUST NOT convert into workbook.
5. MUST NOT invent new items.
6. Output clean final worksheet only.
`.trim();
      }

      return `
You are a strict educational content reviewer.

Fix formatting and clean content only.

User Prompt:
${wrapUserPrompt(prompt)}

Content:
${wrapContent(rawOutput)}

Return clean worksheet only.
`.trim();
    }

    const reviewPrompt = buildReviewPrompt();

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a strict educational content reviewer. Preserve structure and return only cleaned worksheet."
          },
          {
            role: "user",
            content: reviewPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    const data = await openaiRes.json().catch(() => ({}));

    if (!openaiRes.ok) {
      return res.status(openaiRes.status).json({
        error: data?.error?.message || "OpenAI review request failed"
      });
    }

    const reviewedText = String(
      data?.choices?.[0]?.message?.content || ""
    ).trim();

    if (!reviewedText) {
      return res.status(500).json({ error: "Empty review output" });
    }

    return res.status(200).json({
      result: reviewedText
    });

  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Internal server error"
    });
  }
}
