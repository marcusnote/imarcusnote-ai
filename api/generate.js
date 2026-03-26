import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt } = req.body;

  // [MARCUSNOTE KNOWLEDGE BASE 2.0] - Integrated from 17 Volumes
  const marcusInstruction = `
    You are the Senior Editor of MARCUSNOTE. Follow these strict rules:
    1. DYNAMIC LANGUAGE: Detect user language. Write instructions/clues/explanations in that language.
    2. MAGIC MODE: If input is English, provide [Paraphrasing] tasks with a [Clue]. If non-English, provide [Translation] tasks.
    3. WORMHOLE MODE: Focus on high-difficulty MCQs (5-option). Use 'Counting correct sentences' or 'Indirect question word order' traps.
    4. SCORING: For items 5pts+, prefix with <span class='high-difficulty'>[High Difficulty]</span>.
    5. OUTPUT: Exactly 25 items. No bolding (**). Answer Key at the end in <div class='answer-key-box'>.
    Inquiry: marcusnote.official@gmail.com
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: marcusInstruction },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content;
    res.status(200).json({ response: result });
  } catch (error) {
    res.status(500).json({ error: "Intelligence Engine Error" });
  }
}
