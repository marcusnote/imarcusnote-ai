const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

function sanitizeText(value = '') {
  return String(value).replace(/[<>]/g, '');
}

function buildPdfHtml(content = '', academyName = 'MARCUSNOTE ELITE') {
  const safeBrand = sanitizeText(academyName);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Arial', sans-serif;
      line-height: 1.6;
      color: #111;
      font-size: 13px;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-exam-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1.5px solid #000;
      padding-bottom: 5px;
      font-size: 11px;
      font-weight: 700;
    }
    .pdf-main-title {
      font-size: 24px;
      font-weight: 900;
      text-align: center;
      margin: 15px 0;
      text-transform: uppercase;
    }
    .answer-key-box {
      page-break-before: always;
      margin-top: 30px;
      border-top: 2px solid #000;
      padding-top: 20px;
    }
    .high-difficulty {
      color: #d92d20;
      font-weight: 800;
      background: #fef3f2;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.8em;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #888;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="pdf-exam-header">
    <span>MARCUS Intelligence Professional Set</span>
    <span>Brand: ${safeBrand}</span>
    <span>Date: ${new Date().toLocaleDateString()}</span>
  </div>
  <div class="pdf-main-title">MARCUSNOTE ASSESSMENT</div>
  ${content}
  <div class="footer">© 2026 MARCUSNOTE. All rights reserved.</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const { content, academyName } = req.body || {};

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ ok: false, message: 'HTML content required' });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    await page.setContent(buildPdfHtml(content, academyName), {
      waitUntil: ['domcontentloaded', 'networkidle0']
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Marcusnote_Elite_Exam.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('PDF Engine Error:', error);
    return res.status(500).json({
      ok: false,
      message: 'PDF generation failed',
      detail: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
};
