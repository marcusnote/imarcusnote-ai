const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

function sanitizeText(value = '') {
  return String(value).replace(/[<>]/g, '');
}

function buildPdfHtml(content = '', academyName = 'MARCUSNOTE ELITE') {
  const safeBrand = sanitizeText(academyName);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, Arial, sans-serif;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 13px;
      line-height: 1.62;
    }

    .pdf-exam-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 6px;
      margin-bottom: 18px;
      font-size: 11px;
      font-weight: 700;
    }

    .pdf-main-title {
      font-size: 24px;
      font-weight: 900;
      text-align: center;
      margin: 15px 0 18px;
      text-transform: uppercase;
    }

    .pdf-instruction {
      font-size: 13px;
      font-style: italic;
      color: #444;
      border-left: 3px solid #111;
      padding-left: 10px;
      margin-bottom: 24px;
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
      display: inline-block;
    }

    .footer {
      text-align: center;
      font-size: 10px;
      color: #888;
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
    }

    p, div, li {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${content}
  <div class="footer">${safeBrand} × MARCUSNOTE ELITE</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      message: 'Method Not Allowed'
    });
  }

  const { content, academyName } = req.body || {};

  if (!content || typeof content !== 'string') {
    return res.status(400).json({
      ok: false,
      message: 'HTML content required'
    });
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

    await page.emulateMediaType('screen');

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
      detail: error?.message || 'Unknown error'
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
