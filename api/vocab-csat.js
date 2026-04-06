export default async function handler(req, res) {
  try {
    // CORS 처리
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Member-Id'
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 1) 요청값 파싱 블록
    const {
      round = 1,
      size = 20,
      outputType = 'list+test',
      userNote = '',
      worksheetTitle = '',
      academyName = 'Imarcusnote',
      memberId = '',
      mpCost = 3
    } = req.body || {};

    const vocabDB = require("../data/vocab/vocab_csat_db_800.json");

    const r = Math.max(1, parseInt(round, 10) || 1);
    const s = Math.max(5, Math.min(50, parseInt(size, 10) || 20));

    const startIndex = (r - 1) * s;
    const selectedEntries = vocabDB.slice(startIndex, startIndex + s);

    if (!selectedEntries.length) {
      return res.status(400).json({
        error: "No data available for this round"
      });
    }

    // 2) 출력 타입 분기 규칙
    const normalizedOutputType = String(outputType || 'list+test').trim().toLowerCase();
    const includeList = normalizedOutputType === 'list+test' || normalizedOutputType === 'list-only';
    const includeTest = normalizedOutputType === 'list+test' || normalizedOutputType === 'test-only';

    // 4) 문제 데이터 조립 규칙 (내부 빌더) - 요청사항 2번 교체 적용
    const testItems = selectedEntries.map((item, idx) => {
      const type = idx % 4;
      let question = "";
      let typeLabel = "";
      let prompt = "";
      let choices = [];
      let answerNumber = 1;
      let answerWord = String(item.word || "").trim();
      let answerNote = String(item.meaning || "").trim();

      const primarySynonym = getPrimarySynonym(item);
      const primaryAntonym = getPrimaryAntonym(item);

      if (type === 0) {
        question = "다음 의미에 해당하는 단어로 가장 적절한 것은?";
        typeLabel = "[의미 파악]";
        prompt = item.meaning || "";
        const distractors = buildMeaningDistractors(vocabDB, item, item.word);
        const all = shuffleArray(uniqueTrimmed([item.word, ...distractors])).slice(0, 4);
        choices = all.map((c, i) => {
          if (normalize(c) === normalize(item.word)) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = item.word;
        answerNote = `${item.meaning || ""} → ${item.word || ""}`;
      } else if (type === 1 && primarySynonym) {
        question = "다음 단어의 유의어로 가장 적절한 것은?";
        typeLabel = "[유의어 찾기]";
        prompt = item.word || "";
        const distractors = buildSynonymDistractors(vocabDB, item, primarySynonym);
        const all = shuffleArray(uniqueTrimmed([primarySynonym, ...distractors])).slice(0, 4);
        choices = all.map((c, i) => {
          if (normalize(c) === normalize(primarySynonym)) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = primarySynonym;
        answerNote = `${item.word || ""} → synonym: ${primarySynonym}`;
      } else if (type === 2 && primaryAntonym) {
        question = "다음 단어의 반의어로 가장 적절한 것은?";
        typeLabel = "[반의어 찾기]";
        prompt = item.word || "";
        const distractors = buildAntonymDistractors(vocabDB, item, primaryAntonym);
        const all = shuffleArray(uniqueTrimmed([primaryAntonym, ...distractors])).slice(0, 4);
        choices = all.map((c, i) => {
          if (normalize(c) === normalize(primaryAntonym)) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = primaryAntonym;
        answerNote = `${item.word || ""} → antonym: ${primaryAntonym}`;
      } else {
        question = "다음 표현의 빈칸에 들어갈 말로 가장 적절한 것은?";
        typeLabel = "[문맥 추론]";
        const sourceExample = String(item.example || item.phrase || "").trim();
        const escapedWord = String(item.word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const blanked = sourceExample
          ? sourceExample.replace(new RegExp(escapedWord, "gi"), "__________")
          : "";
        prompt = blanked || `Expression: ${item.word || ""}`;
        const distractors = buildPhraseDistractors(vocabDB, item, item.word);
        const all = shuffleArray(uniqueTrimmed([item.word, ...distractors])).slice(0, 4);
        choices = all.map((c, i) => {
          if (normalize(c) === normalize(item.word)) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = item.word;
        answerNote = `${sourceExample || item.meaning || ""} → ${item.word || ""}`;
      }

      return buildTestItem({
        question,
        typeLabel,
        prompt,
        choices,
        answerNumber,
        answerWord,
        answerNote
      });
    });

    // 5) 최종 응답 반환 블록
    const finalTitle = String(worksheetTitle || '').trim() || `수능핵심 단어 & 테스트 ${r}`;

    const listItems = selectedEntries.map(entry => ({
      word: entry.word,
      meaning: entry.meaning,
      example: entry.example || ''
    }));

    const worksheetHtml = renderWorksheetHtml({
      title: finalTitle,
      round: r,
      count: s,
      includeList,
      includeTest,
      listItems,
      testItems
    });

    const answerHtml = includeTest
      ? renderAnswerHtml({
          title: finalTitle,
          round: r,
          answerItems: testItems.map(item => ({
            answerNumber: item.answerNumber,
            answerWord: item.answerWord,
            answerNote: item.answerNote
          }))
        })
      : "";

    return res.status(200).json({
      ok: true,
      round: r,
      count: s,
      title: finalTitle,
      outputType: normalizedOutputType,
      worksheetHtml,
      answerHtml
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error", detail: error.message });
  }
}

// 3) 구조형 HTML 렌더 유틸
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCsatQuestionBlock(item, index) {
  const q = index + 1;
  const choicesHtml = (item.choices || [])
    .map(choice => `<div class="choice-line">${escapeHtml(choice)}</div>`)
    .join('');

  const stemLines = [];
  if (item.typeLabel) stemLines.push(`<div class="stem-line" style="font-weight:700; color:#16a34a;">${escapeHtml(item.typeLabel)}</div>`);
  if (item.prompt) stemLines.push(`<div class="stem-line">${escapeHtml(item.prompt)}</div>`);
  if (item.korean) stemLines.push(`<div class="stem-line">${escapeHtml(item.korean)}</div>`);
  if (item.expression) stemLines.push(`<div class="stem-line">${escapeHtml(item.expression)}</div>`);
  if (item.hint) stemLines.push(`<div class="tail-line">${escapeHtml(item.hint)}</div>`);

  return `
    <div class="question-block">
      <div class="question-line">${q}. ${escapeHtml(item.question)}</div>
      ${stemLines.join('')}
      <div class="choices-wrap">
        ${choicesHtml}
      </div>
    </div>
  `;
}

function renderCsatListBlock(words, roundLabel) {
  const rows = words.map((item, index) => {
    const parts = [
      `${index + 1}. <strong>${escapeHtml(item.word || '')}</strong>`,
      item.meaning ? `/ ${escapeHtml(item.meaning)}` : '',
      item.example ? `<br/><small style="color:#64748b;">Example: ${escapeHtml(item.example)}</small>` : ''
    ].filter(Boolean).join(' ');

    return `<div class="stem-line" style="margin-bottom:12px; border-bottom:1px dashed #eee; padding-bottom:4px;">${parts}</div>`;
  }).join('');

  return `
    <div class="question-block" style="margin-bottom:40px; background:#f8fafc; padding:20px; border-radius:12px;">
      <div class="question-line" style="border-bottom:2px solid #1e293b; padding-bottom:8px;">A. Vocabulary List</div>
      <div class="tail-line" style="margin-bottom:15px;">${escapeHtml(roundLabel)}</div>
      <div class="choices-wrap">
        ${rows}
      </div>
    </div>
  `;
}

function renderWorksheetHtml({ title, round, count, includeList, includeTest, listItems, testItems }) {
  const roundLabel = `Round ${round}`;
  let bodyHtml = '';

  if (includeList) {
    bodyHtml += renderCsatListBlock(listItems, roundLabel);
  }

  if (includeTest) {
    if (includeList) bodyHtml += `<h2 style="margin-top:40px; margin-bottom:20px; padding-left:10px; border-left:4px solid #22c55e;">B. Practice Test</h2>`;
    bodyHtml += testItems.map((item, index) => renderCsatQuestionBlock(item, index)).join('');
  }

  return `
    <div class="iaw-csat-render">
      <div class="iaw-csat-head">
        <div class="iaw-csat-title">${escapeHtml(title)}</div>
        <div class="iaw-csat-sub">CSAT Vocabulary · ${escapeHtml(roundLabel)} · ${escapeHtml(String(count))} Items</div>
      </div>
      <div class="iaw-csat-body">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderAnswerHtml({ title, round, answerItems }) {
  const answerRows = answerItems.map((item, index) => {
    return `
      <div class="question-block" style="margin-bottom:10px; display:flex; gap:15px; align-items:baseline; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
        <div class="question-line" style="min-width:30px; margin-bottom:0;">${index + 1}.</div>
        <div class="question-line" style="color:#16a34a; margin-bottom:0;">(${escapeHtml(String(item.answerNumber))})</div>
        <div class="stem-line" style="font-weight:700; margin-bottom:0;">${escapeHtml(item.answerWord || '')}</div>
        <div class="tail-line" style="margin-top:0; color:#64748b;">${escapeHtml(item.answerNote || '')}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="iaw-csat-render">
      <div class="iaw-csat-head">
        <div class="iaw-csat-title">${escapeHtml(title)} - Answer Key</div>
        <div class="iaw-csat-sub">Round ${escapeHtml(String(round))} · Answer Sheet</div>
      </div>
      <div class="iaw-csat-body">
        <div style="display:grid; grid-template-columns: 1fr; gap:2px;">
          ${answerRows}
        </div>
      </div>
    </div>
  `;
}

// 1) 헬퍼 블록 추가/교체 - 요청사항 1번 적용
function buildTestItem(entry) {
  return {
    question: entry.question || '다음 의미에 해당하는 단어로 가장 적절한 것은?',
    typeLabel: entry.typeLabel || '',
    prompt: entry.prompt || '',
    korean: entry.korean || '',
    expression: entry.expression || '',
    hint: entry.hint || '',
    choices: entry.choices || [],
    answerNumber: entry.answerNumber || 1,
    answerWord: entry.answerWord || '',
    answerNote: entry.answerNote || ''
  };
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

function getPrimarySynonym(item = {}) {
  if (item.synonym) return String(item.synonym).trim();
  const arr = splitField(item.synonyms || "");
  return arr[0] || "";
}

function getPrimaryAntonym(item = {}) {
  if (item.antonym) return String(item.antonym).trim();
  const arr = splitField(item.antonyms || "");
  return arr[0] || "";
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
  const example = normalize(item.example || "");
  const phrase = normalize(item.phrase || "");
  const source = `${meaning} ${example} ${phrase}`;

  if (/(increase|grow|rise|expand|boost)/.test(source)) return "increase";
  if (/(decrease|reduce|decline|drop|lower)/.test(source)) return "decrease";
  if (/(important|essential|significant|major|critical)/.test(source)) return "importance";
  if (/(difficult|hard|complex|challenging)/.test(source)) return "difficulty";
  if (/(happy|pleased|glad|delighted)/.test(source)) return "positive-emotion";
  if (/(sad|upset|depressed|sorrow)/.test(source)) return "negative-emotion";
  if (/(law|rule|policy|standard)/.test(source)) return "rule";
  if (/(money|cost|price|finance|economic)/.test(source)) return "money";
  if (/(think|know|understand|recognize|consider)/.test(source)) return "cognition";
  if (/(say|tell|speak|argue|claim)/.test(source)) return "communication";
  return "general";
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractorWords(pool = [], answerWord = "", count = 3) {
  const out = [];
  const seen = new Set([normalize(answerWord)]);
  for (const item of shuffleArray(pool)) {
    const w = String(item.word || item || "").trim();
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
    db.flatMap(x => splitField(x.synonyms || x.synonym || ""))
  ).filter(x =>
    normalize(x) !== normalize(targetSyn) &&
    getLengthBucket(x) === getLengthBucket(targetSyn) &&
    getSemanticBucket({ meaning: x, phrase: "" }) !== answerSem
  );

  return shuffleArray(pool).slice(0, 3);
}

function buildAntonymDistractors(db, item, targetAnt) {
  const answerSem = getSemanticBucket(item);
  const pool = uniqueTrimmed(
    db.flatMap(x => splitField(x.antonyms || x.antonym || ""))
  ).filter(x =>
    normalize(x) !== normalize(targetAnt) &&
    getLengthBucket(x) === getLengthBucket(targetAnt) &&
    getSemanticBucket({ meaning: x, phrase: "" }) !== answerSem
  );

  return shuffleArray(pool).slice(0, 3);
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

function getDistractors(db, correctWord, count = 4) {
  return pickDistractorWords(
    db.filter(item => normalize(item.word) !== normalize(correctWord)),
    correctWord,
    count
  );
}
