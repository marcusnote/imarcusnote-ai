const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // 🛡️ [CORS 설정] 프레이머 접속 허용
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 1. 브라우저 사전 점검 대응
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 주소창 직접 접속(GET) 시 생존 확인용 응답
  if (req.method === 'GET') {
    return res.status(200).json({
      status: "Ready",
      message: "I-MARCUSNOTE AI Engine is Online. Connection Successful!"
    });
  }

  // 3. 실제 AI 실행 (POST)
  try {
    const { prompt } = req.body;
    const assistantId = process.env.ASSISTANT_ID;

    if (!assistantId) throw new Error("ASSISTANT_ID missing in Vercel.");

    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      if (['failed', 'cancelled'].includes(runStatus.status)) {
        throw new Error("AI Run failed: " + runStatus.last_error?.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data.filter(m => m.role === 'assistant').pop();

    res.status(200).json({ response: lastMessage.content[0].text.value });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
