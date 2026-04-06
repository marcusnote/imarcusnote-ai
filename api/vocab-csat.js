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

    // 1) 요청값 파싱 블록 교체
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

    // 2) 출력 타입 분기 규칙 추가
    const normalizedOutputType = String(outputType || 'list+test').trim().toLowerCase();
    const includeList = normalizedOutputType === 'list+test' || normalizedOutputType === 'list-only';
    const includeTest = normalizedOutputType === 'list+test' || normalizedOutputType === 'test-only';

    // 4) 문제 데이터 조립 규칙 (내부 빌더)
    const testItems = selectedEntries.map((item, idx) => {
      // 퀴즈 유형 결정 로직 (기존 api.vocab-csat.js의 로직 유지 및 구조화)
      const type = (idx % 4); 
      let question = "";
      let typeLabel = "";
      let prompt = "";
      let choices = [];
      let answerNumber = 1;
      let answerWord = item.word;
      let answerNote = item.meaning;

      if (type === 0) {
        question = "다음 의미에 해당하는 단어로 가장 적절한 것은?";
        typeLabel = "[의미 파악]";
        prompt = item.meaning;
        const distractors = getDistractors(vocabDB, item.word, 4);
        const all = shuffleArray([item.word, ...distractors]);
        choices = all.map((c, i) => {
          if (c === item.word) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
      } else if (type === 1) {
        question = "다음 단어의 유의어로 가장 적절한 것은?";
        typeLabel = "[유의어 찾기]";
        prompt = item.word;
        const distractors = getDistractors(vocabDB, item.synonym || "important", 4);
        const correct = item.synonym || distractors[0];
        const all = shuffleArray([correct, ...distractors.slice(1)]);
        choices = all.map((c, i) => {
          if (c === correct) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = correct;
      } else if (type === 2) {
        question = "다음 단어의 반의어로 가장 적절한 것은?";
        typeLabel = "[반의어 찾기]";
        prompt = item.word;
        const distractors = getDistractors(vocabDB, item.antonym || "increase", 4);
        const correct = item.antonym || distractors[0];
        const all = shuffleArray([correct, ...distractors.slice(1)]);
        choices = all.map((c, i) => {
          if (c === correct) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
        answerWord = correct;
      } else {
        question = "다음 표현의 빈칸에 들어갈 말로 가장 적절한 것은?";
        typeLabel = "[문맥 추론]";
        const blanked = (item.example || "").replace(new RegExp(item.word, 'gi'), "__________");
        prompt = blanked || `Expression: ${item.word}`;
        const distractors = getDistractors(vocabDB, item.word, 4);
        const all = shuffleArray([item.word, ...distractors]);
        choices = all.map((c, i) => {
          if (c === item.word) answerNumber = i + 1;
          return `(${i + 1}) ${c}`;
        });
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
    const finalTitle =
      String(worksheetTitle || '').trim() ||
      `수능핵심 단어 & 테스트 ${r}`;

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

    const answerHtml = renderAnswerHtml({
      title: finalTitle,
      round: r,
      answerItems: testItems.map(item => ({
        answerNumber: item.answerNumber,
        answerWord: item.answerWord,
        answerNote: item.answerNote
      }))
    });

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

// 3) 구조형 HTML 렌더 유틸 추가
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

// 헬퍼 함수들
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[array[j]]] = [array[array[j]], array[i]];
  }
  return array;
}

function getDistractors(db, correctWord, count) {
  return db
    .filter(item => item.word !== correctWord)
    .sort(() => 0.5 - Math.random())
    .slice(0, count)
    .map(item => item.word);
}
