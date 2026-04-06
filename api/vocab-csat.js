export default async function handler(req, res) {
  try {
    const { round = 1, size = 20 } = req.body || {};

    const vocabDB = require("../data/vocab/vocab_csat_db_800.json");

    const r = Number(round);
    const s = Number(size);

    const start = (r - 1) * s;
    const selected = vocabDB.slice(start, start + s);

    if (!selected.length) {
      return res.status(400).json({
        error: "No data available for this round/size"
      });
    }

    return res.status(200).json({
      success: true,
      round: r,
      size: s,
      total: vocabDB.length,
      items: selected
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
