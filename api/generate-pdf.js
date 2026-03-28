const chromium = require('@sparticuz/chromium');
const { chromium: playwright } = require('playwright-core');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPdfHtml(content = '', academyName = 'MARCUSNOTE ELITE') {
  const safeBrand = escapeHtml(academyName || 'MARCUSNOTE ELITE');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Marcusnote PDF</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm 16mm 12mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 12.2px;
      line-height: 1.68;
      word-break: keep-all;
    }

    .pdf-wrap {
      width: 100%;
    }

    .pdf-topbar {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1.6px solid #111;
      padding-bottom: 6px;
      margin-bottom: 14px;
      font-size: 10.5px;
      font-weight: 700;
    }

    .pdf-topbar span {
      display: inline-block;
    }

    .pdf-body {
      width: 100%;
    }

    .pdf-body h1,
    .pdf-body h2,
    .pdf-body h3,
    .pdf-body h4,
    .pdf-body h5 {
      page-break-after: avoid;
      break-after: avoid;
    }

    .pdf-body p,
    .pdf-body li,
    .pdf-body div,
    .pdf-body table,
    .pdf-body blockquote {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-body .pdf-main-title {
      font-size: 24px;
      font-weight: 900;
      text-align: center;
      margin: 10px 0 18px;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }

    .pdf-body .pdf-instruction {
      font-size: 12px;
      color: #333;
      margin: 0 0 18px;
      padding-left: 10px;
      border-left: 3px solid #111;
    }

    .pdf-body .answer-key-box {
      page-break-before: always;
      margin-top: 28px;
      padding-top: 18px;
      border-top: 2px solid #111;
    }

    .pdf-body .high-difficulty {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #fef2f2;
      color: #b42318;
      font-size: 10px;
      font-weight: 800;
      border: 1px solid #fecdca;
    }

    .pdf-footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #8a8a8a;
    }

    .pdf-muted {
      color: #666;
    }

    br {
      line-height: 1.65;
    }
  </style>
</head>
<body>
  <div class="pdf-wrap">
    <div class="pdf-topbar">
      <span>MARCUS Intelligence Professional Set</span>
      <span>Brand: ${safeBrand}</span>
      <span>Date: ${new Date().toLocaleDateString('ko-KR')}</span>
    </div>

    <div class="pdf-body">
      ${content}
    </div>

    <div class="pdf-footer">${safeBrand} × MARCUSNOTE ELITE</div>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
  let context;
  let page;

  try {
    const executablePath = await chromium.executablePath();

    browser = await playwright.launch({
      executablePath,
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      headless: true
    });

    context = await browser.newContext({
      viewport: { width: 1240, height: 1754 },
      deviceScaleFactor: 1
    });

    page = await context.newPage();

    const finalHtml = buildPdfHtml(content, academyName);

    await page.setContent(finalHtml, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.emulateMedia({ media: 'screen' });

    await page.waitForTimeout(700);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Marcusnote_Elite_Exam.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).end(pdfBuffer);
  } catch (error) {
    console.error('PDF Engine Error:', error);

    return res.status(500).json({
      ok: false,
      message: 'PDF generation failed',
      detail: error?.message || 'Unknown error'
    });
  } finally {
    try {
      if (page) await page.close();
    } catch (_) {}

    try {
      if (context) await context.close();
    } catch (_) {}

    try {
      if (browser) await browser.close();
    } catch (_) {}
  }
};
