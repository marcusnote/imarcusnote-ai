import fs from "fs";
import path from "path";

/**
 * MARCUSNOTE VOCAB API
 * - Uses fixed vocabulary DB (NOT random generation)
 * - Middle 3: 20 units × 20 words = 400 words
 * - Returns workbook/test output using ONLY the supplied vocabulary list
 */

function readJson(relativePath) {
  const filePath = path.join(process.cwd(), relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function parseRange(rangeText) {
  if (!rangeText) return null;
  const cleaned = String(rangeText).trim();
  const match = cleaned.match(/^(\d+)\s*[-~]\s*(\d+)$/);
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;

  const units = [];
  for (let i = start; i <= end; i += 1) units.push(i);
  return units;
}

function uniqueWords(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.word}__${item.pos}__${item.meaning_ko}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function getVocabularyPayload({ level = "middle3", unit, range }) {
  if (level !== "middle3") {
    throw new Error("Currently only 'middle3' is supported in this version.");
  }

  const db = readJson("data/vocab/middle3_core_vocab_400.json");
  const units = db.units || {};

  if (range) {
    const rangeUnits = parseRange(range);
    if (!rangeUnits || rangeUnits.length === 0) {
      throw new Error("Invalid range. Example: 1-5");
    }

    const collected = [];
    for (const u of rangeUnits) {
      if (!units[String(u)]) {
        throw new Error(`Unit ${u} does not exist.`);
      }
      collected.push(...units[String(u)]);
    }

    return {
      title: db.title,
      level: db.level,
      unitLabel: `Unit ${rangeUnits[0]}-${rangeUnits[rangeUnits.length - 1]} Review`,
      words: uniqueWords(collected),
    };
  }

  const unitNumber = Number(unit);
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 20) {
    throw new Error("Unit must be an integer from 1 to 20.");
  }

  const selected = units[String(unitNumber)];
  if (!selected) {
    throw new Error(`Unit ${unitNumber} does not exist.`);
  }

  return {
    title: db.title,
    level: db.level,
    unitLabel: `Unit ${unitNumber}`,
    words: selected,
  };
}

function buildPrompt({
  mode = "list+test",
  level = "middle3",
  unit,
  range,
  userNote = "",
  vocabPack,
}) {
  const wordLines = vocabPack.words
    .map((item, index) => `${index + 1}. ${item.word} / ${item.pos} / ${item.meaning_ko}`)
    .join("\n");

  return `
You are a professional vocabulary workbook designer for Marcusnote.

You are NOT allowed to generate random vocabulary.
You MUST use ONLY the provided vocabulary list.

[MARCUSNOTE SYSTEM RULE]
- This is a structured vocabulary workbook.
- Each unit is fixed in advance.
- No duplicate words.
- No new words outside the given list.
- Difficulty target: advanced middle school / special-purpose high-performing learners.

[REQUEST]
- Level: ${level}
- Unit: ${unit ? `Unit ${unit}` : "N/A"}
- Range: ${range || "N/A"}
- Mode: ${mode}
- User note: ${userNote || "None"}

[PROVIDED VOCABULARY LIST]
${wordLines}

[OUTPUT STYLE]
Write in clean educational English.
Korean meanings must be included where required.
The worksheet must look like a premium school workbook.

[STRICT OUTPUT RULES]
1. MUST include the title: "Marcusnote Core Vocabulary System"
2. MUST include unit information clearly
3. MUST restart numbering from 1 in EACH section
4. MUST NOT continue numbering across sections
5. MUST use ONLY the given vocabulary list
6. MUST include Korean meanings in the Vocabulary List
7. MUST include example sentences in the Vocabulary List
8. MUST separate the Answer Key at the end
9. MUST NOT skip sections required by the selected mode
10. MUST NOT add any markdown code block fences

[MODE RULES]
A) If mode is "list+test":
- Include all sections below.

B) If mode is "list-only":
- Include:
  1. Title / Unit Information
  2. A. Vocabulary List
  3. B. Answer Key (example sentence answer check not needed)

C) If mode is "test-only":
- Do NOT print the full vocabulary list first.
- Include:
  1. Title / Unit Information
  2. A. Meaning Check
  3. B. Application
  4. C. Review Test
  5. D. Answer Key

D) If mode is "review":
- Treat the provided words as cumulative review vocabulary.
- Include all sections below.

[REQUIRED SECTIONS for list+test or review]

Marcusnote Core Vocabulary System

Unit Information
- Level:
- Unit:

A. Vocabulary List
- exactly one entry for each provided word
- format:
  1. word / part of speech / Korean meaning / example sentence

B. Meaning Check
- 5 to 10 questions
- mix English → Korean and Korean → English

C. Application
- 5 to 10 questions
- fill in the blank / sentence completion
- answer choices may be used when appropriate

D. Review Test
- 5 to 10 mixed questions
- meaning / usage / context

E. Answer Key
- restart numbering from 1
- concise and clean

[IMPORTANT]
- The workbook must feel structured, premium, and teacher-ready.
- Maintain consistent formatting.
- No random numbering mistakes.
- No missing numbers.
`.trim();
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();

  const text =
    data.output_text ||
    data.output?.map((item) => {
      if (!item.content) return "";
      return item.content.map((c) => c.text || "").join("");
    }).join("\n") ||
    "";

  if (!text.trim()) {
    throw new Error("Empty response from OpenAI.");
  }

  return text.trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://imarcusnote.com");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      level = "middle3",
      unit = 1,
      range = "",
      mode = "list+test",
      userNote = "",
    } = req.body || {};

    const normalizedMode = String(mode).trim().toLowerCase();
    const allowedModes = ["list+test", "list-only", "test-only", "review"];
    if (!allowedModes.includes(normalizedMode)) {
      return res.status(400).json({ error: "Invalid mode." });
    }

    const vocabPack = getVocabularyPayload({
      level,
      unit: range ? undefined : unit,
      range: range || undefined,
    });

    const prompt = buildPrompt({
      mode: normalizedMode,
      level,
      unit: range ? undefined : unit,
      range: range || undefined,
      userNote,
      vocabPack,
    });

    const output = await callOpenAI(prompt);

    return res.status(200).json({
      ok: true,
      engine: "vocab_workbook",
      level,
      mode: normalizedMode,
      unitLabel: vocabPack.unitLabel,
      wordCount: vocabPack.words.length,
      vocabWords: vocabPack.words,
      output,
    });
  } catch (error) {
    console.error("VOCAB API ERROR:", error);
    return res.status(500).json({
      error: "Failed to generate vocabulary workbook.",
      detail: error.message || "Unknown error",
    });
  }
}
