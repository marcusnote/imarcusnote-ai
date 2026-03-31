export default async function handler(req, res) {
  // CORS
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

1. MUST have exactly 25 questions.
- If less → create similar ones.
- If more → remove extras.

2. NO multiple choice for magic/wormhole.
- Remove (A), (B), ①②③ etc.
- Convert to subjective format.

3. Enforce structure:

Instruction

1.
____________________
[Hint]

...

[Answers]
1.
2.
...

4. Keep original difficulty and style.

5. Remove duplicates.

6. DO NOT rewrite everything.
Only fix necessary parts.

7. Output CLEAN final version only.
No explanations.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI review request failed"
      });
    }

    const finalText =
      data?.output?.[0]?.content?.[0]?.text ||
      data?.output_text ||
      "No reviewed output";

    return res.status(200).json({ result: finalText });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Internal server error"
    });
  }
}
