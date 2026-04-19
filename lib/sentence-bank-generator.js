const fs = require("fs");
const path = require("path");

function generateDoQuestionBank(size = 100) {
  const subjects = ["you", "they", "we", "I"];
  const subjects3 = ["he", "she"];
  const verbs = ["play soccer", "like music", "eat breakfast", "watch TV", "read books", "study English"];

  const results = [];

  let id = 1;

  for (let i = 0; i < size; i++) {

    const isThird = Math.random() > 0.5;

    const subject = isThird
      ? subjects3[Math.floor(Math.random() * subjects3.length)]
      : subjects[Math.floor(Math.random() * subjects.length)];

    const verb = verbs[Math.floor(Math.random() * verbs.length)];

    const aux = isThird ? "Does" : "Do";

    const en = `${aux} ${subject} ${verb}?`;

    results.push({
      id: `auto_do_${id++}`,
      chapterKey: "do_question",
      koPrompt: "자동 생성 문장",
      enAnswer: en,
      clue: en.replace("?", "").split(" "),
      wordCount: en.replace("?", "").split(" ").length,
      answerShape: "do_question",
      similarGroup: verb
    });
  }

  return results;
}

function saveBank(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { generateDoQuestionBank, saveBank };
