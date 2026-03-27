const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, academyName, fileName } = req.body || {};

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ message: 'PDF content is required' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    const safeAcademyName =
      typeof academyName === 'string' && academyName.trim()
        ? academyName.trim()
        : 'MARCUSNOTE';

    const safeFileName =
      typeof fileName === 'string' && fileName.trim()
        ? fileName.trim()
        : 'Marcusnote_Master_Exam.pdf';

    const html = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Marcusnote PDF</title>
        <style>
          @page {
            size: A4;
            margin: 18mm 14mm 22mm 14mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            word-break: keep-all;
            overflow-wrap: break-word;
            line-height: 1.7;
            font-size: 14px;
          }

          .pdf-exam-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            font-size: 11px;
            border-bottom: 1.5px solid #000;
            padding-bottom: 8px;
            margin-bottom: 20px;
            color: #000;
            font-weight: 700;
          }

          .pdf-main-title {
            font-size: 24px;
            font-weight: 900;
            text-align: center;
            margin-bottom: 10px;
            color: #000;
          }

          .pdf-instruction {
            font-size: 13px;
            font-style: italic;
            color: #444;
            border-left: 3px solid #111;
            padding-left: 10px;
            margin-bottom: 25px;
          }

          .question-block {
            margin-bottom: 24px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .answer-key-box {
            page-break-before: always;
            break-before: page;
            margin-top: 40px;
            border-top: 2px solid #000;
            padding-top: 20px;
          }

          .high-difficulty {
            color: #d92d20 !important;
            font-weight: 800 !important;
            background: #fef3f2;
            border: 1px solid #fecdca;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.75em;
            display: inline-block;
          }

          .footer-watermark {
            font-size: 11px;
            color: #bbb;
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }

          h1, h2, h3, h4, p, div {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;

    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0']
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%; font-size:10px; text-align:center; color:#666; padding:0 20px;">
          ${safeAcademyName} x MARCUSNOTE
        </div>
      `,
      margin: {
        top: '18mm',
        right: '14mm',
        bottom: '22mm',
        left: '14mm'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(safeFileName)}"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('PDF API Error:', error);

    return res.status(500).json({
      error: 'PDF Generation Failed',
      detail: error?.message || 'Unknown PDF error'
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
