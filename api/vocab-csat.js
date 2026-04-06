export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { round = 1, size = 20 } = req.body;

    // 🔥 DB (여기 나중에 JSON 파일로 분리 가능)
    const vocabDB = require("./vocab_csat_db.json");

    // 👉 round 계산
    const startIndex = (round - 1) * size;
    const endIndex = startIndex + size;

    const selected = vocabDB.slice(startIndex, endIndex);

    if (!selected.length) {
      return res.status(400).json({ error: "No data for this round" });
    }

    // 👉 출력 포맷 (Magic / Workbook 최적화)
    const result = selected.map((item, idx) => {
      return `${idx + 1}. ${item.word}
- 의미: ${item.meaning}
- 유의/관련: ${item.synonyms}
- 반의어: ${item.antonyms}
- 표현: ${item.phrase}`;
    }).join("\n\n");

    return res.status(200).json({
      success: true,
      round,
      size,
      count: selected.length,
      data: result
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server Error",
      detail: err.message
    });
  }
}
