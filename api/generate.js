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

1. WORMHOLE MODE (Default for '웜홀'): 
   - Never provide simple fill-in-the-blank questions.
   - Design high-difficulty 5-option MCQs. 
   - Focus on structural traps: 'Finding the number of grammatically correct/incorrect sentences', 'Indirect questions (S+V order)', 'Passive voice with complex objects'.
   - Every question must test the "Structural Awareness" of the student.

2. MAGIC MODE (If requested '매직'): 
   - Focus on sentence construction and paraphrasing. 
   - Provide [Clue] for English writing tasks.

3. MANDATORY OUTPUT STRUCTURE:
   - Always include an 'Answer Key' at the end of the worksheet.
   - Always provide an 'Expert Explanation' for each answer, explaining the structural logic (not just translation).

4. FORMATTING:
   - Topic: [Grade/Level and Concept Name]
   - Target Level: [e.g., Middle School Grade 2]
   - Items with 5pts+ or high difficulty must be prefixed with: <span class="high-difficulty">[High Difficulty]</span>
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
