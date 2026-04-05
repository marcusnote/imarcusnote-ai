import fs from "fs";
import path from "path";

export const config = {
  runtime: "nodejs",
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
const DEFAULT_TRIAL_MP = Number(process.env.MEMBERSTACK_TRIAL_MP || 15);

function addCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "https://imarcusnote.com");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
}

function sanitizeMp(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

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

  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    return null;
  }

  const units = [];
  for (let i = start; i <= end; i += 1) {
    units.push(i);
  }
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
  const levelMap = {
    middle1: "data/vocab/middle1_core_vocab_400.json",
    middle2: "data/vocab/middle2_core_vocab_400.json",
    middle3: "data/vocab/middle3_core_vocab_400.json",
  };

  const selectedPath = levelMap[level];
  if (!selectedPath) {
    throw new Error("Invalid level. Use middle1, middle2, or middle3.");
  }

  const db = readJson(selectedPath);
  const units = db.units || {};

  if (range) {
    const rangeUnits = parseRange(range);
    if (!rangeUnits || rangeUnits.length === 0) {
      throw new Error("Invalid range. Example: 1-5");
    }

    const collected = [];
    for (const u of rangeUnits) {
      if (!units[String(u)]) {
        throw new Error(`Unit ${u} does not exist in ${level}.`);
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
    throw new Error(`Unit ${unitNumber} does not exist in ${level}.`);
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
  3. B. Answer Key

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
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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
    data.output
      ?.map((item) => {
        if (!item.content) return "";
        return item.content.map((c) => c.text || "").join("");
      })
      .join("\n") ||
    "";

  if (!text.trim()) {
    throw new Error("Empty response from OpenAI.");
  }

  return text.trim();
}

function getMemberstackHeaders() {
  if (!MEMBERSTACK_SECRET_KEY) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  return {
    "x-api-key": MEMBERSTACK_SECRET_KEY,
    "Content-Type": "application/json",
  };
}

async function memberstackRequest(pathname, options = {}) {
  const response = await fetch(`${MEMBERSTACK_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      ...getMemberstackHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Memberstack request failed: ${response.status} ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data;
}

function extractBearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function resolveMemberId(req, reqBody = {}) {
  const headerMemberId =
    req?.headers?.["x-member-id"] ||
    req?.headers?.["X-Member-Id"] ||
    reqBody?.memberId ||
    "";

  if (headerMemberId) {
    return String(headerMemberId).trim();
  }

  const bearer = extractBearerToken(req);
  if (!bearer) {
    return "";
  }

  if (!MEMBERSTACK_APP_ID) {
    throw new Error("Missing MEMBERSTACK_APP_ID");
  }

  const lookup = await fetch("https://api.memberstack.com/members/v1/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "x-app-id": MEMBERSTACK_APP_ID,
    },
  });

  if (!lookup.ok) {
    return "";
  }

  const data = await lookup.json();
  return data?.id || data?.data?.id || "";
}

function getCustomFields(memberData) {
  return (
    memberData?.customFields ||
    memberData?.custom_fields ||
    memberData?.data?.customFields ||
    memberData?.data?.custom_fields ||
    {}
  );
}

function getCurrentMp(memberData) {
  const fields = getCustomFields(memberData);
  const raw = fields?.[MEMBERSTACK_MP_FIELD];

  if (raw === undefined || raw === null || raw === "") {
    return sanitizeMp(DEFAULT_TRIAL_MP, 15);
  }

  return sanitizeMp(raw, sanitizeMp(DEFAULT_TRIAL_MP, 15));
}

async function getMemberById(memberId) {
  const data = await memberstackRequest(`/${memberId}`, { method: "GET" });
  return data?.data || data;
}

async function updateMemberMp(memberId, nextMp) {
  const payload = {
    customFields: {
      [MEMBERSTACK_MP_FIELD]: sanitizeMp(nextMp, 0),
    },
  };

  const data = await memberstackRequest(`/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return data?.data || data;
}

function getRequiredMp(reqBody = {}) {
  if (reqBody?.mpCost !== undefined && reqBody?.mpCost !== null && reqBody?.mpCost !== "") {
    return sanitizeMp(reqBody.mpCost, 3);
  }

  const mode = String(reqBody?.mode || "list+test").trim().toLowerCase();
  if (mode === "review") return 4;
  return 3;
}

async function chargeMemberMp(memberId, requiredMp) {
  const member = await getMemberById(memberId);
  const currentMp = getCurrentMp(member);

  if (currentMp < requiredMp) {
    return {
      ok: false,
      currentMp,
      remainingMp: currentMp,
      requiredMp,
      message: `Not enough MP. Required ${requiredMp}, current ${currentMp}.`,
    };
  }

  const remainingMp = currentMp - requiredMp;
  await updateMemberMp(memberId, remainingMp);

  return {
    ok: true,
    currentMp,
    remainingMp,
    requiredMp,
  };
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "Method not allowed",
    });
  }

  let memberId = "";
  let chargeResult = null;

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
      return json(res, 400, {
        success: false,
        error: "Invalid mode.",
      });
    }

    memberId = await resolveMemberId(req, req.body || {});
    if (!memberId) {
      return json(res, 401, {
        success: false,
        error: "Missing member session.",
      });
    }

    const requiredMp = getRequiredMp(req.body || {});
    chargeResult = await chargeMemberMp(memberId, requiredMp);

    if (!chargeResult.ok) {
      return json(res, 402, {
        success: false,
        error: chargeResult.message,
        remainingMp: chargeResult.remainingMp,
        mp: {
          remainingMp: chargeResult.remainingMp,
          requiredMp: chargeResult.requiredMp,
        },
      });
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

    return json(res, 200, {
      success: true,
      ok: true,
      engine: "vocab_workbook",
      level,
      mode: normalizedMode,
      unitLabel: vocabPack.unitLabel,
      wordCount: vocabPack.words.length,
      vocabWords: vocabPack.words,
      output,
      remainingMp: chargeResult.remainingMp,
      mp: {
        remainingMp: chargeResult.remainingMp,
        usedMp: chargeResult.requiredMp,
      },
    });
  } catch (error) {
    console.error("VOCAB API ERROR:", error);

    return json(res, 500, {
      success: false,
      error: "Failed to generate vocabulary workbook.",
      detail: error.message || "Unknown error",
      remainingMp: chargeResult?.remainingMp ?? null,
      mp: chargeResult
        ? {
            remainingMp: chargeResult.remainingMp,
            usedMp: chargeResult.requiredMp,
          }
        : null,
    });
  }
}
