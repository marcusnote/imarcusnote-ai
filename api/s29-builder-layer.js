// S29 BUILDER (초간단 안전버전)

export function applyS29Builder(input, questionLines = [], answerLines = []) {

  try {

    const text = [
      input.userPrompt,
      input.topic,
      input.worksheetTitle
    ].join(" ");

    // 👉 중1 + 1과 → 일반동사 강제 해결
    if (/중1/.test(text) && /1과/.test(text)) {

      const questions = [
        "1. 너는 매일 운동하니? (clue: Do, you, exercise, every, day)",
        "2. 그는 학교에 가니? (clue: Does, he, go, to, school)",
        "3. 그녀는 책을 읽니? (clue: Does, she, read, books)",
        "4. 그들은 축구를 하니? (clue: Do, they, play, soccer)"
      ];

      const answers = [
        "1. Do you exercise every day? / Yes, I do. / No, I do not.",
        "2. Does he go to school? / Yes, he does. / No, he does not.",
        "3. Does she read books? / Yes, she does. / No, she does not.",
        "4. Do they play soccer? / Yes, they do. / No, they do not."
      ];

      return {
        questionLines: questions,
        answerLines: answers
      };
    }

    // 👉 아니면 기존 그대로
    return { questionLines, answerLines };

  } catch (e) {
    return { questionLines, answerLines };
  }
}
