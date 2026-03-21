const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  // 🛡️ [CORS 헤더 강화] 모든 도메인과 OPTIONS 요청을 허용합니다.
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // 1. 브라우저의 사전 점검(OPTIONS) 요청 즉시 응답
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. 오직 POST 요청만 본문을 처리합니다.
  if (req.method !== 'POST') {
    return res.status(200).json({ 
      status: "Ready", 
      message: "MARCUSNOTE AI Engine is Online. Please use POST method." 
    });
  }

  try {
    const { prompt } = req.body;
    const assistantId = process.env.ASSISTANT_ID;

    if (!assistantId) {
      throw new Error("ASSISTANT_ID is missing in Vercel settings.");
    }

    // OpenAI Assistant 로직 실행
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // 응답 대기 (Polling)
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
        throw new Error("AI Run failed: " + (runStatus.last_error?.message || "Unknown error"));
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data.filter(m => m.role === 'assistant').pop();

    // 3. 성공 응답
    res.status(200).json({ response: lastMessage.content[0].text.value });

  } catch (error) {
    console.error("Engine Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};
