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

    const reviewPrompt = `
You are a strict educational content reviewer for I•marcusnote.

Your role is NOT to rewrite everything.
Your role is to FIX and STANDARDIZE the given content.

[INPUT]
Engine: ${engine || "unknown"}
Difficulty: ${difficulty || "standard"}
User Prompt: ${prompt || ""}

[CONTENT]
${rawOutput}

[STRICT RULES]
1. MUST preserve the original topic and educational intention.
2. MUST improve formatting consistency, clarity, and worksheet quality.
3. For Wormhole and Magic-style outputs:
   - remove multiple-choice options such as (A)(B)(C), ①②③④⑤, a/b/c/d/e
   - convert them into premium subjective worksheet style whenever needed
4. MUST remove obvious duplication, broken numbering, malformed spacing, and noisy symbols.
5. If the content is already strong, do only light correction.
6. DO NOT add explanations, commentary, or notes.
7. Output CLEAN final worksheet text only.

[OUTPUT STYLE]
Return only the polished final worksheet.
No markdown fences.
No extra explanation.
`;

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
