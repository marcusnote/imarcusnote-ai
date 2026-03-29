const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatWorksheetToHtml(content = '') {
  const escaped = escapeHtml(content);

  const html = escaped
    .replace(/\n/g, '<br>')
    .replace(/###\s*(.+?)<br>/g, '<h3>$1</h3>')
    .replace(/#\s*(.+?)<br>/g, '<h1>$1</h1>')
    .replace(/<br><br>/g, '</p><p>');

  return `<p>${html}</p>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://imarcusnote.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      message: 'Method Not Allowed'
    });
  }

  try {
    const { content, academyName = 'Imarcusnote', title = 'Marcusnote Worksheet' } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'content is required'
      });
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: 1400,
        height: 2000
      },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    const printableHtml = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: A4;
            margin: 22mm 16mm 20mm 16mm;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
            line-height: 1.72;
            font-size: 14px;
            margin: 0;
            padding: 0;
            background: #fff;
          }

          .sheet {
            width: 100%;
          }

          .topbar {
            border-top: 4px solid #1c2b4a;
            border-bottom: 2px solid #34d17a;
            padding-top: 10px;
            margin-bottom: 18px;
          }

          .title {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin: 0 0 6px 0;
          }

          .sub {
            font-size: 12px;
            color: #555;
            margin: 0 0 12px 0;
          }

          h1 {
            font-size: 22px;
            margin: 18px 0 10px;
            line-height: 1.3;
          }

          h3 {
            font-size: 17px;
            margin: 20px 0 10px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
          }

          p {
            margin: 0 0 12px 0;
          }

          .content {
            word-break: keep-all;
            overflow-wrap: break-word;
          }

          .content p,
          .content div,
          .content h1,
          .content h2,
          .content h3 {
            break-inside: avoid;
          }

          .footer-note {
            margin-top: 28px;
            font-size: 11px;
            color: #666;
            text-align: center;
          }

          .high-difficulty {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            color: #0b7a3d;
            border: 1px solid #8fd9b0;
            padding: 2px 6px;
            border-radius: 999px;
            margin-right: 6px;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="topbar">
            <div class="title">${escapeHtml(title)}</div>
            <div class="sub">${escapeHtml(academyName)} × MARCUSNOTE</div>
          </div>

          <div class="content">
            ${formatWorksheetToHtml(content)}
          </div>

          <div class="footer-note">
            ${escapeHtml(academyName)} × MARCUSNOTE
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(printableHtml, {
      waitUntil: 'networkidle0'
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${title.replace(/[^a-z0-9-_]/gi, '_')}.pdf"`
    );

    return res.status(200).send(pdf);
  } catch (error) {
    console.error('PDF Generation Error:', error);

    return res.status(500).json({
      ok: false,
      error: 'PDF Generation Failed',
      detail: error?.message || 'Unknown error'
    });
  }
};
