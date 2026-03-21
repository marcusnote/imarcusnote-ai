// GitHub 파일 경로: /api/index.js
// MARCUSNOTE Intellectual Output Dashboard - Engine Core v1.0

import OpenAI from 'openai';

// 🚀 [점검] Vercel 환경 변수에 이 두 키가 등록되어 있어야 합니다.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ASSISTANT_ID = process.env.ASSISTANT_ID;

export default async function handler(req, res) {
    // 🛡️ [CORS 설정] - 프레이머(외부 도메인)의 접속을 허용합니다.
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // 글로벌 서비스용 설정
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // OPTIONS 요청(사전 점검)에 대한 빠른 응답
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // POST 요청만 처리
    if (req.method !== 'POST') {
        return res.status(405).json({ response: 'Method Not Allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ response: 'Prompt is required.' });
    }

    try {
        // [점검] Assistant ID가 환경 변수에 없는 경우
        if (!ASSISTANT_ID) {
            throw new Error('Server Config Error: ASSISTANT_ID is not defined in environment variables.');
        }

        // 💡 1. Thread 생성 (각 대화별 독립된 컨텍스트)
        const thread = await openai.beta.threads.create();

        // 💡 2. 사용자의 질문을 Thread에 추가
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: prompt
        });

        // 💡 3. Assistant 실행 (Run)
        // [CORS 이슈 방지용 기술] - Markdown을 HTML로 변환하는 프롬프트를 추가하면 더 좋습니다.
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: ASSISTANT_ID,
            // instructions: "Please output the grammar questions with proper HTML formatting for professional appearance."
        });

        // 💡 4. 실행 완료 대기 (Polling - 어시스턴트는 답변 생성 시간이 걸립니다.)
        let runStatus;
        let retryCount = 0;
        const maxRetries = 20; // 최대 20초 대기

        while (retryCount < maxRetries) {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            if (runStatus.status === 'completed') break;
            if (runStatus.status === 'failed') throw new Error('Run failed: ' + runStatus.last_error?.message);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            retryCount++;
        }

        if (runStatus.status !== 'completed') {
            throw new Error('Run timed out.');
        }

        // 💡 5. Assistant의 최종 답변 가져오기
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data
            .filter(message => message.role === 'assistant')
            .pop();

        if (!lastMessage || !lastMessage.content[0]) {
            throw new Error('No content returned from assistant.');
        }

        // 💡 6. [성공] 진짜 답변 전송
        res.status(200).json({ response: lastMessage.content[0].text.value });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({ response: 'Engine Error: ' + error.message });
    }
}
