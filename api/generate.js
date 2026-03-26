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
   
2. WORMHOLE MODE (CRITICAL): 
   - Act as a 'Trap Master'. Create distractors that seem correct but have subtle structural flaws.
   - Use 'Multi-Sentence Evaluation': "How many of the following sentences are grammatically correct?"
   - Target "Structural Blind Spots": Focus on 'transitive vs intransitive in passive', 'word order in indirect questions', and 'perfect tense with specific past time markers'.
   
3. MAGIC MODE (If requested '매직'): 
   - Focus on sentence construction and paraphrasing. 
   - Provide [Clue] for English writing tasks.

4. OUTPUT STRUCTURE:
   - ### Answer Key: Strictly horizontal (1) 3, 2) 5, 3) 2...) to preserve space for quality content.
   - ### Expert Explanation: For each item, explicitly state the 'Structural Logic' or 'Trap Type'. Use professional terminology (e.g., 'dangling participle', 'object-complement agreement').

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
