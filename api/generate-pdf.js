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
      margin: 16mm 14mm 18mm 14mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }
    body {
      font-size: 13px;
      line-height: 1.62;
    }
    .pdf-root { width: 100%; }
    .pdf-exam-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      border-bottom: 1.5px solid #000;
      padding-bottom: 8px;
      margin-bottom: 18px;
    }
    .pdf-main-title {
      font-size: 24px;
      font-weight: 900;
      text-align: center;
      margin: 8px 0 12px;
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
      margin-top: 28px;
      border-top: 2px solid #000;
      padding-top: 18px;
    }
    .high-difficulty {
      color: #d92d20;
      font-weight: 800;
      background: #fef3f2;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.75em;
      display: inline-block;
    }
    .footer-watermark {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="pdf-root">
    ${content}
    <div class="footer-watermark">${safeBrand} × MARCUSNOTE ELITE</div>
  </div>
</body>
</html>
`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const { content, academyName } = req.body || {};

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ ok: false, message: 'HTML content required' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    await page.setContent(buildPdfHtml(content, academyName), {
      waitUntil: ['domcontentloaded', 'networkidle0']
    });

    await page.emulateMediaType('screen');

    const safeBrand = sanitizeText(academyName || 'MARCUSNOTE ELITE');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%; font-size:9px; color:#999; padding:0 12mm; display:flex; justify-content:space-between;">
          <span>${safeBrand} × MARCUSNOTE ELITE</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '16mm',
        right: '14mm',
        bottom: '18mm',
        left: '14mm'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Marcusnote_Elite_Exam.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);

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
