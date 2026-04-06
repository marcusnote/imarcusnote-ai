export default async function handler(req, res) {
  try {
    addCors(res);
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

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

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
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

// 2-1. chooseQuestionType 교체
function chooseQuestionType(idx) {
  const pattern = [
    "meaning",
    "meaning",
    "synonym",
    "phrase",
    "meaning",
    "antonym",
    "meaning",
    "phrase"
  ];
  return pattern[idx % pattern.length];
}

// 2-2. Helper 블록 추가
function uniqueTrimmed(arr = []) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const v = String(item || "").trim();
    const key = normalize(v);
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function getPosBucket(word = "") {
  const w = String(word || "").trim().toLowerCase();
  if (/ly$/.test(w)) return "adverb";
  if (/(tion|sion|ment|ness|ity|ance|ence|ism|ship)$/.test(w)) return "noun";
  if (/(able|ible|al|ous|ful|less|ive|ic|ary|ish)$/.test(w)) return "adjective";
  if (/(ate|fy|ise|ize|ing|ed)$/.test(w)) return "verb";
  return "general";
}

function getLengthBucket(word = "") {
  const len = String(word || "").trim().length;
  if (len <= 4) return "short";
  if (len <= 7) return "mid";
  return "long";
}

function getSemanticBucket(item = {}) {
  const meaning = normalize(item.meaning || "");
  const phrase = normalize(item.phrase || "");

  if (/(increase|grow|rise|expand|boost)/.test(meaning + " " + phrase)) return "increase";
  if (/(decrease|reduce|decline|drop|lower)/.test(meaning + " " + phrase)) return "decrease";
  if (/(important|essential|significant|major|critical)/.test(meaning + " " + phrase)) return "importance";
  if (/(difficult|hard|complex|challenging)/.test(meaning + " " + phrase)) return "difficulty";
  if (/(happy|pleased|glad|delighted)/.test(meaning + " " + phrase)) return "positive-emotion";
  if (/(sad|upset|depressed|sorrow)/.test(meaning + " " + phrase)) return "negative-emotion";
  if (/(law|rule|policy|standard)/.test(meaning + " " + phrase)) return "rule";
  if (/(money|cost|price|finance|economic)/.test(meaning + " " + phrase)) return "money";
  if (/(think|know|understand|recognize|consider)/.test(meaning + " " + phrase)) return "cognition";
  if (/(say|tell|speak|argue|claim)/.test(meaning + " " + phrase)) return "communication";
  return "general";
}

function pickDistractorWords(pool = [], answerWord = "", count = 3) {
  const out = [];
  const seen = new Set([normalize(answerWord)]);
  for (const item of shuffle(pool)) {
    const w = String(item.word || "").trim();
    const key = normalize(w);
    if (!w || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= count) break;
  }
  return out;
}

function buildMeaningDistractors(db, item, answerWord) {
  const answerPos = getPosBucket(answerWord);
  const answerLen = getLengthBucket(answerWord);
  const answerSem = getSemanticBucket(item);

  let pool = db.filter(x =>
    normalize(x.word) !== normalize(answerWord) &&
    getPosBucket(x.word) === answerPos &&
    getLengthBucket(x.word) === answerLen &&
    getSemanticBucket(x) !== answerSem
  );

  if (pool.length < 3) {
    pool = db.filter(x =>
      normalize(x.word) !== normalize(answerWord) &&
      getPosBucket(x.word) === answerPos
    );
  }

  if (pool.length < 3) {
    pool = db.filter(x => normalize(x.word) !== normalize(answerWord));
  }

  return pickDistractorWords(pool, answerWord, 3);
}

function buildSynonymDistractors(db, item, targetSyn) {
  const answerSem = getSemanticBucket(item);
  const pool = uniqueTrimmed(
    db.flatMap(x => splitField(x.synonyms || ""))
  ).filter(x =>
    normalize(x) !== normalize(targetSyn) &&
    getLengthBucket(x) === getLengthBucket(targetSyn) &&
    getSemanticBucket({ meaning: x, phrase: "" }) !== answerSem
  );

  return shuffle(pool).slice(0, 3);
}

function buildAntonymDistractors(db, item, targetAnt) {
  const answerSem = getSemanticBucket(item);
  const pool = uniqueTrimmed(
    db.flatMap(x => splitField(x.antonyms || ""))
  ).filter(x =>
    normalize(x) !== normalize(targetAnt) &&
    getLengthBucket(x) === getLengthBucket(targetAnt) &&
    getSemanticBucket({ meaning: x, phrase: "" }) !== answerSem
  );

  return shuffle(pool).slice(0, 3);
}

function buildPhraseDistractors(db, item, answerWord) {
  const answerPos = getPosBucket(answerWord);
  let pool = db.filter(x =>
    normalize(x.word) !== normalize(answerWord) &&
    getPosBucket(x.word) === answerPos
  );

  if (pool.length < 3) {
    pool = db.filter(x => normalize(x.word) !== normalize(answerWord));
  }

  return pickDistractorWords(pool, answerWord, 3);
}

// 2-3. buildQuestion(...) 전체 교체
function buildQuestion({ item, idx, db, usedWords, type }) {
  const word = String(item.word || "").trim();
  const meaning = String(item.meaning || "").trim();
  const synonyms = splitField(item.synonyms || "");
  const antonyms = splitField(item.antonyms || "");
  const phrase = String(item.phrase || "").trim();

  if (type === "meaning") {
    const distractors = buildMeaningDistractors(db, item, word);
    const options = shuffle(uniqueTrimmed([word, ...distractors])).slice(0, 4);
    const answer = options.findIndex(opt => normalize(opt) === normalize(word)) + 1;

    return {
      no: idx + 1,
      type: "meaning",
      prompt: `다음 의미에 해당하는 단어로 가장 적절한 것은?`,
      stem: meaning,
      options,
      answer,
      answerText: word,
      explanation: `${meaning} → ${word}`
    };
  }

  if (type === "synonym" && synonyms.length) {
    const targetSyn = synonyms[0];
    let distractors = buildSynonymDistractors(db, item, targetSyn);

    if (distractors.length < 3) {
      distractors = uniqueTrimmed([
        ...distractors,
        ...buildPhraseDistractors(db, item, word)
      ]).slice(0, 3);
    }

    const options = shuffle(uniqueTrimmed([targetSyn, ...distractors])).slice(0, 4);
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
    let distractors = buildAntonymDistractors(db, item, targetAnt);

    if (distractors.length < 3) {
      distractors = uniqueTrimmed([
        ...distractors,
        ...buildPhraseDistractors(db, item, word)
      ]).slice(0, 3);
    }

    const options = shuffle(uniqueTrimmed([targetAnt, ...distractors])).slice(0, 4);
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
  const distractors = buildPhraseDistractors(db, item, word);
  const options = shuffle(uniqueTrimmed([word, ...distractors])).slice(0, 4);
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
