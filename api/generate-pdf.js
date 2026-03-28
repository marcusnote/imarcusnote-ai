const chromiumBin = require('@sparticuz/chromium');
const { chromium } = require('playwright-core');

function sanitizeText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripDangerousMarkup(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, (match) => match) // keep internal styles if present
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function normalizePdfHtml(html = '') {
  return String(html)
    .replace(/<div class="iaw-empty-state">[\s\S]*?<\/div>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildPdfHtml(content = '', academyName = 'MARCUSNOTE ELITE') {
  const safeBrand = sanitizeText(academyName);
  const safeContent = normalizePdfHtml(stripDangerousMarkup(content));

  return `<!DOCTYPE html>
<html lang="ko">
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
      background: #fff;
      color: #111;
      font-family: Inter, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 13px;
      line-height: 1.62;
      word-break: keep-all;
      overflow-wrap: break-word;
    }

    .pdf-page {
      width: 100%;
    }

    .pdf-page .high-difficulty {
      color: #d92d20;
      font-weight: 800;
      background: #fef3f2;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.8em;
      display: inline-block;
    }

    .pdf-page h1,
    .pdf-page h2,
    .pdf-page h3,
    .pdf-page h4,
    .pdf-page p,
    .pdf-page div,
    .pdf-page li {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-page img {
      max-width: 100%;
      height: auto;
    }

    .pdf-page .answer-key-box {
      page-break-before: always;
      break-before: page;
    }

    .footer {
      text-align: center;
      font-size: 10px;
      color: #888;
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="pdf-page">
    ${safeContent}
    <div class="footer">${safeBrand} × MARCUSNOTE ELITE</div>
  </div>
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

  let browser;

  try {
    const executablePath = await chromiumBin.executablePath();

    browser = await chromium.launch({
      executablePath,
      args: [
        ...chromiumBin.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none'
      ],
      headless: true
    });

    const page = await browser.newPage();

    await page.setContent(buildPdfHtml(content, academyName), {
      waitUntil: 'domcontentloaded'
    });

    await page.emulateMedia({ media: 'screen' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error('Invalid PDF buffer generated');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Marcusnote_Elite_Exam.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));

    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PLAYWRIGHT PDF ENGINE ERROR:', error);

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
