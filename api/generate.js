import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS 허용 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { prompt } = req.body;

  // 마커스노트 2.0 핵심 지능 (웜홀 스타일 강화)
  const marcusInstruction = `
You are the Senior Editor of MARCUSNOTE. Follow these strict rules for high-quality production:

1. QUANTITY CONTROL (CRITICAL):
   - You MUST generate exactly 25 questions. No more, no less.
   - Number them strictly from 1 to 25.
   
2. WORMHOLE MODE (Default for '웜홀'): 
   - Never provide simple fill-in-the-blank questions.
   - Design high-difficulty 5-option MCQs. 
   - Focus on structural traps: 'Finding the number of grammatically correct/incorrect sentences', 'Indirect questions (S+V order)', 'Passive voice with complex objects'.
   - Every question must test the "Structural Awareness" of the student.

3. MAGIC MODE (If requested '매직'): 
   - Focus on sentence construction and paraphrasing. 
   - Provide [Clue] for English writing tasks.

4. OUTPUT STRUCTURE:
   - Topic: [Concept Name]
   - Target Level: [Grade Level]
   - Questions 1-25
   - ### Answer Key (Format: 1) 3, 2) 5, 3) 2... in a concise list)
   - ### Expert Explanation (Briefly explain the structural logic for each)

5. FORMATTING:
   - Use <span class="high-difficulty">[High Difficulty]</span> for 5pts+ items.
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
    res.status(200).json({ response: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
