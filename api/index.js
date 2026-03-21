const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;
    const assistantId = process.env.ASSISTANT_ID;

    if (!assistantId) {
      throw new Error("ASSISTANT_ID is missing in Vercel Environment Variables");
    }

    // 1. Thread 생성
    const thread = await openai.beta.threads.create();

    // 2. 메시지 생성
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt,
    });

    // 3. 실행 (Run)
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // 4. 대기 (Polling)
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error("Assistant run failed: " + runStatus.last_error?.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // 5. 답변 추출
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data.filter(m => m.role === 'assistant').pop();

    res.status(200).json({ response: lastMessage.content[0].text.value });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
