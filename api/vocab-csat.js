export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const {
      round = 1,
      size = 20,
      worksheetTitle = "",
      academyName = "Imarcusnote"
    } = req.body || {};

    const vocabDB = require("../data/vocab/vocab_csat_db_800.json");

    const r = Math.max(1, parseInt(round, 10) || 1);
    const s = Math.max(5, Math.min(50, parseInt(size, 10) || 20));

    const startIndex = (r - 1) * s;
    const selected = vocabDB.slice(startIndex, startIndex + s);

    if (!selected.length) {
      return res.status(400).json({
        error: "No data available for this round"
      });
    }

    const usedWords = new Set(selected.map(item => normalize(item.word)));

    const questions = selected.map((item, idx) => {
      const type = chooseQuestionType(idx);
      return buildQuestion({
        item,
        idx,
        db: vocabDB,
        usedWords,
        type
      });
    });

    const finalTitle =
      worksheetTitle?.trim() || `CSAT Vocabulary Test Round ${r}`;

    const worksheetHtml = renderWorksheetHtml({
      title: finalTitle,
      academyName,
      round: r,
      size: s,
      questions
    });

    const answerHtml = renderAnswerHtml({
      title: finalTitle,
      round: r,
      questions
    });

    return res.status(200).json({
      success: true,
      engine: "VOCAB_CSAT",
      round: r,
      size: s,
      total: vocabDB.length,
      count: questions.length,
      title: finalTitle,
      questions,
      worksheetHtml,
      answerHtml
    });
  } catch (err) {
    console.error("VOCAB_CSAT error:", err);
    return res.status(500).json({
      error: "Server Error",
      detail: err.message
    });
  }
}

function normalize(text = "") {
  return String(text).trim().toLowerCase();
}

function splitField(text = "") {
  return String(text)
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chooseQuestionType(idx) {
  const types = ["meaning", "synonym", "antonym", "phrase"];
  return types[idx % types.length];
}

function randomPick(arr, count = 1, excludeSet = new Set()) {
  const pool = arr.filter(x => !excludeSet.has(normalize(x.word || x)));
  return shuffle(pool).slice(0, count);
}

function getDistractors({ db, answerWord, count = 3, predicate }) {
  const filtered = db.filter(item => {
    if (normalize(item.word) === normalize(answerWord)) return false;
    if (predicate && !predicate(item)) return false;
    return true;
  });

  const picks = shuffle(filtered).slice(0, count).map(item => item.word);

  if (picks.length < count) {
    const fallback = shuffle(
      db.filter(item => normalize(item.word) !== normalize(answerWord))
    )
      .map(item => item.word)
      .filter(word => !picks.includes(word))
      .slice(0, count - picks.length);

    picks.push(...fallback);
  }

  return picks;
}

function buildQuestion({ item, idx, db, usedWords, type }) {
  const word = item.word;
  const meaning = item.meaning || "";
  const synonyms = splitField(item.synonyms || "");
  const antonyms = splitField(item.antonyms || "");
  const phrase = item.phrase || "";

  if (type === "meaning") {
    const distractors = getDistractors({
      db,
      answerWord: word,
      count: 3
    });

    const options = shuffle([word, ...distractors]);
    const answer = options.findIndex(opt => normalize(opt) === normalize(word)) + 1;

    return {
      no: idx + 1,
      type: "meaning",
      prompt: `다음 의미에 해당하는 단어로 가장 적절한 것은?`,
      stem: meaning,
      options,
      answer,
      answerText: word,
      explanation: `${word} = ${meaning}`
    };
  }

  if (type === "synonym" && synonyms.length) {
    const targetSyn = synonyms[0];

    const distractors = shuffle(
      db.flatMap(x => splitField(x.synonyms || ""))
        .filter(x => normalize(x) !== normalize(targetSyn))
    ).slice(0, 3);

    while (distractors.length < 3) {
      distractors.push("irrelevant choice");
    }

    const options = shuffle([targetSyn, ...distractors]);
    const answer = options.findIndex(opt => normalize(opt) === normalize(targetSyn)) + 1;

    return {
      no: idx + 1,
      type: "synonym",
      prompt: `다음 단어의 유의어로 가장 적절한 것은?`,
      stem: word,
      options,
      answer,
      answerText: targetSyn,
      explanation: `${word} → synonym: ${targetSyn}`
    };
  }

  if (type === "antonym" && antonyms.length) {
    const targetAnt = antonyms[0];

    const distractors = shuffle(
      db.flatMap(x => splitField(x.antonyms || ""))
        .filter(x => normalize(x) !== normalize(targetAnt))
    ).slice(0, 3);

    while (distractors.length < 3) {
      distractors.push("unrelated opposite");
    }

    const options = shuffle([targetAnt, ...distractors]);
    const answer = options.findIndex(opt => normalize(opt) === normalize(targetAnt)) + 1;

    return {
      no: idx + 1,
      type: "antonym",
      prompt: `다음 단어의 반의어로 가장 적절한 것은?`,
      stem: word,
      options,
      answer,
      answerText: targetAnt,
      explanation: `${word} → antonym: ${targetAnt}`
    };
  }

  const blankedPhrase = makeBlankPhrase(phrase, word);
  const distractors = getDistractors({
    db,
    answerWord: word,
    count: 3
  });

  const options = shuffle([word, ...distractors]);
  const answer = options.findIndex(opt => normalize(opt) === normalize(word)) + 1;

  return {
    no: idx + 1,
    type: "phrase",
    prompt: `다음 표현의 빈칸에 들어갈 말로 가장 적절한 것은?`,
    stem: blankedPhrase || `(${meaning})의 의미를 가진 단어를 고르시오.`,
    options,
    answer,
    answerText: word,
    explanation: `${phrase} → ${word}`
  };
}

function makeBlankPhrase(phrase = "", word = "") {
  if (!phrase || !word) return "";
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");
  if (regex.test(phrase)) {
    return phrase.replace(regex, "______");
  }
  return `${phrase} (관련 단어 선택)`;
}

function renderWorksheetHtml({ title, academyName, round, size, questions }) {
  return `
    <div class="iaw-csat-render">
      <div class="iaw-csat-head">
        <div class="iaw-csat-title">${escapeHtml(title)}</div>
        <div class="iaw-csat-sub">
          CSAT Vocabulary Test · Round ${round} · ${size} Questions
        </div>
      </div>

      <div class="iaw-csat-body">
        ${questions.map(q => `
          <div class="csat-q" style="margin-bottom:24px;">
            <div style="font-weight:800; margin-bottom:8px;">${q.no}. ${escapeHtml(q.prompt)}</div>
            <div style="margin-bottom:10px;">${escapeHtml(q.stem)}</div>
            <div>
              ${q.options.map((opt, i) => `
                <div style="margin:4px 0;">${i + 1}) ${escapeHtml(opt)}</div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAnswerHtml({ title, round, questions }) {
  return `
    <div class="iaw-csat-render">
      <div class="iaw-csat-head">
        <div class="iaw-csat-title">${escapeHtml(title)} - Answer Key</div>
        <div class="iaw-csat-sub">Round ${round} · Answer Sheet</div>
      </div>

      <div class="iaw-csat-body">
        ${questions.map(q => `
          <div style="margin-bottom:16px;">
            <div style="font-weight:800;">${q.no}. ${q.answer}</div>
            <div>${escapeHtml(q.answerText)}</div>
            <div style="color:#6b7280;">${escapeHtml(q.explanation)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
