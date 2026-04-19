const fs = require("fs");
const path = require("path");

function loadSentenceBank(grade, chapterKey) {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "sentence_bank",
      grade,
      `${chapterKey}.json`
    );

    if (!fs.existsSync(filePath)) {
      console.warn("⚠️ DB 없음:", filePath);
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);

  } catch (err) {
    console.error("❌ DB 로딩 실패:", err);
    return [];
  }
}

module.exports = { loadSentenceBank };
