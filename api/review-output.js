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
  if (v === "vocab_workbook" || v === "vocab_csat") return "vocab";
  if (["wormhole", "magic", "mocks", "mock_exam", "vocab", "vocab_workbook", "vocab_csat"].includes(v)) {
    return v === "mock_exam" ? "mocks" : v;
  }
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
    .join("\n");
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
    extractSection(rawText, "[[ANSWERS]]", "")
  );
  if (!title && !instructions && !questions && !answers) {
    const fallback = buildFallbackSplit(rawText);
    return [
      fallbackTitle || "",
      fallback.instructions,
      normalizeQuestionNumbering(fallback.questions),
      fallback.answers ? normalizeAnswerNumbering(fallback.answers) : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return [
    title || fallbackTitle || "",
    instructions,
    questions ? normalizeQuestionNumbering(questions) : "",
    answers ? normalizeAnswerNumbering(answers) : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function detectMagicIntent(text = "") {
  const t = String(text || "").toLowerCase();
  const conceptKeywords = [
    "개념", "개념설명", "설명", "정리", "예문", "문법 설명",
    "grammar explanation", "concept", "examples", "example sentences",
  ];
  const trainingKeywords = [
    "영작", "영작훈련", "쓰기", "writing", "composition", "rearrange",
    "재배열", "문장 완성", "워크북",
  ];
  const isConcept = conceptKeywords.some((k) => t.includes(k));
  const isTraining = trainingKeywords.some((k) => t.includes(k));

  if (isConcept && isTraining) return "concept+training";
  if (isConcept) return "concept";
  return "training";
}


function detectGrammarFocus(text = "") {
  const t = String(text || "").toLowerCase();
  return {
    isRelativePronoun: /관계대명사|relative pronoun/.test(t),
    isNonRestrictive: /계속적\s*용법|계속적인\s*용법|non[- ]?restrictive|nonrestrictive/.test(t),
    isRestrictive: /제한적\s*용법|restrictive/.test(t),
    isObjectiveRelative: /목적격\s*관계대명사|objective relative|object relative/.test(t),
    isParticipleModifier: /분사의\s*한정적\s*용법|현재분사\s*한정적\s*용법|과거분사\s*한정적\s*용법|participle modifier|participial adjective|participial phrase/.test(t),
    isCausative: /사역동사|causative/.test(t),
    isSoThatPurpose: /so that\s*구문|so that \(목적\)|so that/.test(t),
    isToInfinitive: /to부정사|to-infinitive|infinitive/.test(t),
    isGerund: /동명사|gerund/.test(t),
    isPassive: /수동태|passive/.test(t),
    isPresentPerfect: /현재완료|present perfect/.test(t),
    isComparative: /비교급|comparative/.test(t),
    isSuperlative: /최상급|superlative/.test(t),
  };
}

function buildRuleCardForReview(grammarFocus, language = "ko") {
  const isKo = language === "ko";
  if (grammarFocus.isParticipleModifier) {
    return isKo ? `
[Rule Card]
- 분사의 한정적 용법 챕터에서는 명사를 직접 수식하는 분사 구조를 우선한다.
- 관계절로만 바꾸지 않는다.
- 어색한 분사 배치는 자연스럽게 고친다.` : `
[Rule Card]
- In participle-modifier chapters, prefer participles directly modifying nouns.
- Do not rewrite everything into relative clauses.
- Repair awkward participle placement naturally.`;
  }
  if (grammarFocus.isCausative) {
    return isKo ? `
[Rule Card]
- 사역동사 챕터에서는 make / let / have / help / get 구조를 실제 정답에 드러낸다.
- 일반 평서문으로 바꾸지 않는다.` : `
[Rule Card]
- In causative chapters, keep real make / let / have / help / get structures in final answers.
- Do not rewrite into ordinary non-causative sentences.`;
  }
  if (grammarFocus.isSoThatPurpose) {
    return isKo ? `
[Rule Card]
- so that 구문 챕터에서는 완전한 so that + 주어 + can/could/will/would 구조를 유지한다.
- so that 뒤를 미완성으로 두지 않는다.` : `
[Rule Card]
- In so-that chapters, keep complete so that + subject + can/could/will/would structures.
- Never leave the clause unfinished.`;
  }
  if (grammarFocus.isNonRestrictive) {
    return isKo ? `
[Rule Card]
- 계속적 용법 챕터에서는 쉼표와 who/which를 유지하고 that을 쓰지 않는다.` : `
[Rule Card]
- In non-restrictive relative-clause chapters, keep commas and who/which, and do not use that.`;
  }
  return "";
}

function buildGrammarValidationBlock(grammarFocus, language = "ko") {
  const isKo = language === "ko";
  const rules = [];

  if (grammarFocus.isRelativePronoun) {
    rules.push(isKo
      ? "- 관계대명사 챕터이면 관계절이 실제 문장 안에 분명히 드러나야 한다."
      : "- In a relative-pronoun chapter, the relative clause must be clearly visible in the final sentence.");
  }
  if (grammarFocus.isNonRestrictive) {
    rules.push(isKo
      ? "- 계속적 용법이면 쉼표를 사용하고 who/which를 우선 사용하라. that은 사용하지 말라."
      : "- For non-restrictive relative clauses, use commas and prefer who/which. Do not use that.");
  }
  if (grammarFocus.isRestrictive) {
    rules.push(isKo
      ? "- 제한적 용법이면 쉼표 없이 필수 정보 관계절로 유지하라."
      : "- For restrictive relative clauses, keep the clause essential and do not use commas.");
  }
  if (grammarFocus.isObjectiveRelative) {
    rules.push(isKo
      ? "- 목적격 관계대명사 챕터이면 목적격 관계절이 드러나야 하며, 주격 관계절만 반복하지 말라."
      : "- In an objective-relative chapter, visibly use object relative clauses rather than repeating only subject relative clauses.");
  }
  if (grammarFocus.isParticipleModifier) {
    rules.push(isKo
      ? "- 분사의 한정적 용법 챕터이면 문항과 정답의 다수가 명사를 직접 수식하는 분사 구조(-ing / p.p.)를 보여야 한다. 관계절로 대체하지 말라."
      : "- In a participle-modifier chapter, most items and answers must show participles directly modifying nouns (-ing / past participle). Do not replace them with relative clauses.");
  }
  if (grammarFocus.isCausative) {
    rules.push(isKo
      ? "- 사역동사 챕터이면 make / let / have / get 등의 사역 구조가 실제 정답에 드러나야 한다. 일반 문장으로 바꾸지 말라."
      : "- In a causative-verb chapter, real causative structures such as make / let / have / get must appear in the answers. Do not rewrite into ordinary sentences.");
  }
  if (grammarFocus.isSoThatPurpose) {
    rules.push(isKo
      ? "- so that 구문(목적) 챕터이면 so that + 주어 + can/could 구조를 분명히 유지하고 문장을 미완성으로 끝내지 말라."
      : "- In a so-that purpose chapter, clearly keep so that + subject + can/could and never leave the sentence incomplete.");
  }
  if (grammarFocus.isToInfinitive) {
    rules.push(isKo
      ? "- to부정사 챕터이면 to + 동사원형 구조가 목표 문법으로 분명히 드러나야 한다."
      : "- In a to-infinitive chapter, the target to + base verb structure must be clearly visible.");
  }
  if (grammarFocus.isGerund) {
    rules.push(isKo
      ? "- 동명사 챕터이면 동명사(-ing)가 명사 역할로 쓰이는 구조가 실제 정답에 드러나야 한다."
      : "- In a gerund chapter, the -ing form used as a noun must be clearly visible in the final answers.");
  }
  if (grammarFocus.isPassive) {
    rules.push(isKo
      ? "- 수동태 챕터이면 be + p.p. 구조를 실제 정답에 유지하라."
      : "- In a passive chapter, keep real be + past participle structures in the final answers.");
  }
  if (grammarFocus.isPresentPerfect) {
    rules.push(isKo
      ? "- 현재완료 챕터이면 have/has + p.p.를 유지하고 finished past-time expression과 충돌시키지 말라."
      : "- In a present-perfect chapter, preserve have/has + past participle and avoid conflicts with finished past-time expressions.");
  }
  if (grammarFocus.isComparative) {
    rules.push(isKo
      ? "- 비교급 챕터이면 비교급 구조가 눈에 보이게 유지되어야 한다."
      : "- In a comparative chapter, visibly preserve comparative structures.");
  }
  if (grammarFocus.isSuperlative) {
    rules.push(isKo
      ? "- 최상급 챕터이면 최상급 구조가 분명히 보여야 하며 비교급이나 막연한 일반문장으로 흐르지 말라."
      : "- In a superlative chapter, visibly preserve superlative structures and do not drift into comparative or vague generic sentences.");
  }

  if (!rules.length) {
    return isKo
      ? "- 원래 문법 타깃이 정답과 문항에 실제로 드러나도록 유지하라."
      : "- Keep the original grammar target visibly present in both items and answers.";
  }

  return rules.join("\n");
}

function buildMagicReviewControlBlock({ intentMode, grammarFocus, language }) {
  const isKo = language === "ko";
  const focusRules = buildGrammarValidationBlock(grammarFocus, language);
  const ruleCard = buildRuleCardForReview(grammarFocus, language);

  if (intentMode === "concept" || intentMode === "concept+training") {
    return isKo
      ? `
추가 안정화 규칙:
- 개념설명 자료는 과도하게 재창작하지 말고, 잘못된 문장이나 구조만 바로잡아라.
- 개념설명 흐름이 무너지지 않도록 교정하되, 명백히 틀린 설명/예문은 수정하라.
- 문법 포커스 규칙:
${focusRules}
${ruleCard}`.trim()
      : `
Additional stability rules:
- Do not over-rewrite concept sheets; correct only what is wrong or broken.
- Preserve the explanation flow, but fix clearly wrong examples or structures.
- Grammar focus rules:
${focusRules}
${ruleCard}`.trim();
  }

  return isKo
    ? `
추가 안정화 규칙:
- 과도하게 조이지 말고, 좋은 문항은 유지하라.
- 그러나 비문, 미완성 문장, 목표 문법 이탈, 챕터 불일치 문장은 반드시 고쳐라.
- 동일 문항 수를 가능한 한 유지하라.
- clue는 최대한 유지하되, 오답을 유도할 만큼 잘못된 clue는 최소한으로 보정하라.
- 문항과 정답의 최소 70% 이상에서 목표 문법이 실제로 드러나게 하라.
- 분명히 잘못된 문장은 '보존'하지 말고 자연스럽고 교재용으로 다시 써라.
- 문법 포커스 규칙:
${focusRules}
${ruleCard}`.trim()
    : `
Additional stability rules:
- Do not over-tighten; keep good items intact.
- But always fix broken sentences, incomplete sentences, off-target grammar, and chapter mismatch.
- Preserve the original item count as closely as possible.
- Preserve clues where possible, but minimally repair clues that would clearly mislead students.
- Make the target grammar visibly appear in at least about 70% of items and answers.
- Do not preserve clearly wrong sentences; rewrite them into natural classroom-ready English.
- Grammar focus rules:
${focusRules}
${ruleCard}`.trim();
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

function buildSystemPrompt({ engine, language, difficulty, intentMode, grammarFocus }) {
  const isKo = language === "ko";
  
  if (engine === "magic" && (intentMode === "concept" || intentMode === "concept+training")) {
    return isKo
      ? `
당신은 MARCUSNOTE Magic 개념설명 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 이것은 영작훈련지가 아니라, 개념 설명 + 예문 + 간단 확인문항 자료이다.
- 절대로 개념설명 자료를 영작훈련 워크북으로 바꾸지 말 것.
- 반드시 "개념 설명 -> 핵심 구조 정리 -> 예문 -> Mini Check -> 정답" 흐름을 유지할 것.
- 만약 워크북 문항이 너무 많다면, 이를 Mini Check 섹션으로 압축하여 3~5문항으로 줄일 것.
- "짧은 설명 1문단 + 많은 문제" 형태의 구조가 되는 것을 절대 허용하지 말 것.
- NEVER convert concept explanation into writing exercises
- Do not add unnecessary problem sets

반드시 지킬 규칙:
1. 원래 문법 주제와 학습 의도를 유지할 것.
2. 개념 설명이 있으면 보존하고 최소 4~6개 bullet 수준으로 상세히 다듬을 것.
3. 핵심 구조 정리를 반드시 별도 섹션으로 보존할 것.
4. 예문은 6~10개 사이로 유지하며, 문제형이 아닌 완전한 문장으로 고칠 것.
5. Mini Check는 3~5문항 수준으로만 유지할 것.
6. 정답은 완전한 문장으로 고칠 것.
7. 미완성 문장, 끊긴 문장, 어색한 정답을 반드시 수정할 것.
8. 형식, 번호, 줄바꿈, 간격만 정돈하고 과도한 재창작은 하지 말 것.
9. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
10. 마크다운 설명문, 부가 코멘트, 편집자 메모를 넣지 말 것.
${buildMagicReviewControlBlock({ intentMode, grammarFocus, language })}
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Magic concept sheet.

Core rules:
- This is a concept explanation + examples + mini check sheet.
- Do NOT convert a concept sheet into a writing-only workbook.
- If the worksheet contains too many practice items, compress them into a small mini check section (3-5 items).
- Never allow the structure to become "one short explanation + many workbook items".
- Ensure the output contains: 1. concept explanation, 2. pattern summary, 3. example sentences, 4. mini check, 5. answers.
- NEVER convert concept explanation into writing exercises
- Do not add unnecessary problem sets

Must do:
1. Preserve the original grammar target and learning intention.
2. Keep concept explanation and refine it (at least 4-6 bullet points).
3. Keep pattern summary section if present.
4. Fix example sentences into complete natural sentences (6-10 examples).
5. Keep mini check within 3-5 items.
6. Fix answer lines into complete natural sentences.
7. Repair incomplete or broken sentences.
8. Clean formatting, numbering, spacing only.
9. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
10. Output worksheet only with no commentary.
${buildMagicReviewControlBlock({ intentMode, grammarFocus, language })}
`.trim();
  }

  if (engine === "magic") {
    return isKo
      ? `
당신은 MARCUSNOTE Magic 영작훈련 워크북을 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 영작훈련 정체성을 반드시 유지할 것.
- 시험지나 개념설명지로 바꾸지 말 것.

반드시 지킬 규칙:
1. 원래 문법 주제와 영작훈련 의도를 유지할 것.
2. 각 문항이 실제 문장 작성을 요구하도록 유지할 것.
3. clue 구조를 불필요하게 삭제하지 말 것.
4. 정답은 모두 완전한 문장으로 고칠 것.
5. 미완성 답안이나 문법 목표에서 벗어난 답안을 수정할 것.
6. 형식, 번호, 줄바꿈, 간격을 정돈할 것.
7. 과도한 재창작은 하지 말 것.
8. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
9. 설명문 추가, 코멘트 추가, 시험형 변환을 하지 말 것.
${buildMagicReviewControlBlock({ intentMode, grammarFocus, language })}
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Magic writing workbook.
Core rules:
- Preserve writing-training identity.
- Do NOT convert it into a test sheet or concept sheet.
Must do:
1. Preserve the original grammar target and writing-training intention.
2. Keep each item as real sentence-construction practice.
3. Preserve useful clue structure.
4. Fix all answers into complete natural sentences.
5. Repair incomplete or off-target answers.
6. Clean numbering, spacing, and formatting.
7. Avoid excessive rewriting.
8. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
9. Do not add commentary or concept explanation.
10. If an item clearly fails the target grammar, rewrite that item and its answer instead of preserving it.
11. Keep good items intact, but do not preserve off-target items.
${buildMagicReviewControlBlock({ intentMode, grammarFocus, language })}
`.trim();
  }

  if (engine === "wormhole") {
    return isKo
      ? `
당신은 MARCUSNOTE Wormhole 고난도 문법/시험형 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 시험형 정체성과 고난도 성격을 유지할 것.
- 매직형 영작훈련지로 바꾸지 말 것.

반드시 지킬 규칙:
1. 원래 시험 의도와 문법 포인트를 유지할 것.
2. 문제-정답 논리 충돌을 바로잡을 것.
3. 번호, 형식, 보기 배열, 정답 영역을 정돈할 것.
4. 어색하거나 자기모순적인 해설은 최소 수정할 것.
5. 과도한 재창작은 하지 말 것.
6. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Wormhole high-difficulty exam sheet.
Core rules:
- Preserve exam identity and high-difficulty character.
- Do NOT convert it into a writing workbook.
Must do:
1. Preserve the original exam intention and grammar focus.
2. Repair logic conflicts between items and answers.
3. Clean numbering, options, answer section, and spacing.
4. Fix awkward or self-contradictory explanations minimally.
5. Avoid excessive rewriting.
6. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  if (engine === "mocks") {
    return isKo
      ? `
당신은 MARCUSNOTE Reading Mocks 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙:
- 모의고사/독해형 정체성을 유지할 것.
- 워크북형으로 바꾸지 말 것.
반드시 지킬 규칙:
1. 문제 구조와 독해 의도를 유지할 것.
2. 형식과 번호를 정돈할 것.
3. 정답과 해설이 있으면 최소 수정으로 정리할 것.
4. 출력은 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Reading Mocks sheet.
Core rules:
- Preserve mock-exam / reading identity.
- Do NOT convert it into a workbook.
Must do:
1. Preserve problem structure and reading intention.
2. Clean numbering and formatting.
3. Lightly repair answers/explanations if present.
4. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  if (engine === "vocab") {
    return isKo
      ? `
당신은 MARCUSNOTE Vocab 어휘 학습 자료를 검수하는 엄격한 교육 편집자이다.

핵심 원칙 (반드시 준수):
For vocabulary worksheets:
- Preserve round structure (Round 1, Round 2, etc.)
- Each round must restart numbering from 1
- Ensure each vocabulary item includes English + Korean meaning
- Do not collapse multiple rounds into one

반드시 지킬 규칙:
1. 어휘 학습지의 라운드(Round) 기반 구조를 보존할 것.
2. 각 라운드는 반드시 번호를 1번부터 시작할 것.
3. 번호 누락 없이 연속적으로 작성할 것.
4. "Vocabulary List -> Vocabulary Test -> Answers" 구조를 유지할 것.
5. Vocabulary List에서는 반드시 영어 + 한국어 뜻 쌍을 보존할 것.
6. 형식, 번호, 간격만 정돈하고 원문 어휘 리스트를 보존할 것.
7. 출력은 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
      : `
You are a strict educational editor reviewing a MARCUSNOTE Vocab worksheet.

Core rules:
For vocabulary worksheets:
- Preserve round structure (Round 1, Round 2, etc.)
- Each round must restart numbering from 1
- Ensure each vocabulary item includes English + Korean meaning
- Do not collapse multiple rounds into one

Must do:
1. Keep "Vocabulary List -> Vocabulary Test -> Answers" structure.
2. Preserve English + Korean meaning pairs in vocabulary list.
3. Clean formatting, numbering, and spacing only.
4. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
  }

  return isKo
    ? `
당신은 엄격한 교육 자료 편집자이다.
반드시 지킬 규칙:
1. 원래 의도를 유지할 것.
2. 형식, 번호, 간격만 정리할 것.
3. 출력은 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 구조를 유지할 것.
`.trim()
    : `
You are a strict educational worksheet editor.
Must do:
1. Preserve original intent.
2. Clean formatting, numbering, and spacing only.
3. Preserve [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
`.trim();
}

function buildUserPrompt({
  engine,
  difficulty,
  count,
  worksheetTitle,
  prompt,
  rawOutput,
  intentMode,
  language,
  grammarFocus,
}) {
  const isKo = language === "ko";
  return isKo
    ? `
[입력 정보]
엔진: ${engine}
난이도: ${difficulty}
문항 수 목표: ${count}
매직 의도 모드: ${intentMode}
제목: ${worksheetTitle || ""}
사용자 요청:
${prompt || ""}

[원본 생성 결과]
${rawOutput || ""}

[검수 작업]
- 구조를 유지하면서 다듬으시오.
- 아래 문법 포커스를 실제로 살려야 한다.
${buildGrammarValidationBlock(grammarFocus, language)}
- 반드시 [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]] 4개 섹션으로 반환하시오.
- 제목은 자연스럽게 정리하되 주제를 바꾸지 마시오.
- instructions는 1개 단락으로 정리하시오.
- questions에는 본문/문항만 넣으시오.
- answers에는 정답/해설만 넣으시오.
- 매직 concept 모드면 개념설명과 예문 흐름을 보존하시오. (문제 수를 늘리지 마시오)
- 매직 training 모드면 영작훈련 구조를 보존하시오.
- 그러나 목표 문법이 보이지 않거나 문장이 비문이면 반드시 자연스럽게 고치시오.
- 어휘 자료면 라운드 구조와 1번부터 시작하는 번호 체계를 보존하시오.
- 미완성 문장을 반드시 완성하시오.
- 불필요한 잡문, 마크다운, 코드펜스는 넣지 마시오.
`.trim()
    : `
[Input]
Engine: ${engine}
Difficulty: ${difficulty}
Target item count: ${count}
Magic intent mode: ${intentMode}
Title: ${worksheetTitle || ""}
User prompt:
${prompt || ""}

[Raw generated output]
${rawOutput || ""}

[Review task]
- Refine while preserving structure.
- Keep the following grammar focus truly visible.
${buildGrammarValidationBlock(grammarFocus, language)}
- Return exactly 4 sections: [[TITLE]], [[INSTRUCTIONS]], [[QUESTIONS]], [[ANSWERS]].
- Keep the title natural without changing the topic.
- Keep instructions as one paragraph.
- Put only body/items in questions.
- Put only answer/explanation content in answers.
- If magic concept mode, preserve explanation + examples flow and do NOT increase question count.
- If magic training mode, preserve writing-training flow.
- But if the target grammar is not visible or the sentence is broken, rewrite it naturally.
- If vocab mode, preserve round structure and numbering starting from 1.
- Repair incomplete sentences.
- If a line clearly fails the chapter grammar, rewrite it into a chapter-aligned sentence.
- Do not add markdown or commentary.
`.trim();
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const engine = sanitizeEngine(req.body?.engine);
    const difficulty = sanitizeDifficulty(req.body?.difficulty);
    const rawCount = sanitizeCount(req.body?.count, 25);
    const worksheetTitle = sanitizeString(req.body?.worksheetTitle);
    const prompt = sanitizeString(req.body?.prompt);
    const rawOutput = sanitizeString(req.body?.rawOutput);
    const language =
      sanitizeString(req.body?.language) || inferLanguage(`${worksheetTitle}\n${prompt}\n${rawOutput}`);

    if (!rawOutput) {
      return json(res, 400, { error: "No output to review" });
    }

    const intentMode =
      engine === "magic"
        ? detectMagicIntent(`${worksheetTitle}\n${prompt}\n${rawOutput}`)
        : "default";

    // Concept 모드일 때 count 강제 축소
    const count = (intentMode === "concept" || intentMode === "concept+training")
      ? 5
      : rawCount;

    const grammarFocus = detectGrammarFocus(`${worksheetTitle}
${prompt}
${rawOutput}`);

    const systemPrompt = buildSystemPrompt({
      engine,
      language,
      difficulty,
      intentMode,
      grammarFocus,
    });

    const userPrompt = buildUserPrompt({
      engine,
      difficulty,
      count,
      worksheetTitle,
      prompt,
      rawOutput,
      intentMode,
      language,
      grammarFocus,
    });

    const reviewedRaw = await callOpenAI(systemPrompt, userPrompt);
    const formatted = formatReviewedOutput(reviewedRaw, worksheetTitle);

    if (!formatted) {
      return json(res, 500, { error: "Empty review output" });
    }

    return json(res, 200, {
      result: formatted,
      fullText: formatted,
      content: formatted,
      meta: {
        engine,
        difficulty,
        count,
        language,
        intentMode,
        grammarFocus,
      },
    });
  } catch (error) {
    return json(res, 500, {
      error: error?.message || "Internal server error",
    });
  }
}
