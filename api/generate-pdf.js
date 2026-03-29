const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeIncomingContent(content = '') {
  const raw = String(content || '').trim();

  if (!raw) return '';

  // If HTML already came in, keep it usable.
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) {
    return raw;
  }

  const escaped = escapeHtml(raw);

  return escaped
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\[High Difficulty\]/g, '<span class="high-difficulty">[High Difficulty]</span>')
    .replace(/\n/g, '<br>');
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

  let browser;

  try {
    const {
      content,
      academyName = 'Imarcusnote',
      title = 'Marcusnote_Worksheet'
    } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'content is required'
      });
    }

    const printableContent = normalizeIncomingContent(content);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: {
        width: 1400,
        height: 2000
      }
    });

    const page = await browser.newPage();

    const html = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: A4;
            margin: 18mm 15mm 18mm 15mm;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .sheet {
            width: 100%;
          }

          .top-rule {
            border-top: 4px solid #1f2b46;
            border-bottom: 2px solid #22c55e;
            margin-bottom: 14px;
            padding-top: 10px;
          }

          .brand-title {
            font-size: 23px;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin: 0 0 4px;
          }

          .brand-sub {
            font-size: 12px;
            color: #4b5563;
            margin: 0 0 8px;
          }

          .content {
            font-size: 14px;
            line-height: 1.72;
            word-break: keep-all;
            overflow-wrap: break-word;
          }

          .content h1 {
            font-size: 22px;
            margin: 18px 0 10px;
            line-height: 1.25;
            letter-spacing: -0.02em;
          }

          .content h2 {
            font-size: 18px;
            margin: 18px 0 10px;
            line-height: 1.3;
            letter-spacing: -0.01em;
          }

          .content h3 {
            font-size: 16px;
            margin: 20px 0 10px;
            padding-top: 8px;
            border-top: 1px solid #d1d5db;
            line-height: 1.35;
          }

          .content p {
            margin: 0 0 10px;
          }

          .content div,
          .content p,
          .content h1,
          .content h2,
          .content h3 {
            break-inside: avoid;
          }

          .high-difficulty {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            color: #166534;
            border: 1px solid #a7f3d0;
            background: #ecfdf5;
            border-radius: 999px;
            padding: 2px 6px;
            vertical-align: middle;
          }

          .footer {
            margin-top: 26px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="top-rule">
            <div class="brand-title">${escapeHtml(title)}</div>
            <div class="brand-sub">${escapeHtml(academyName)} × MARCUSNOTE</div>
          </div>

          <div class="content">
            ${printableContent}
          </div>

          <div class="footer">
            ${escapeHtml(academyName)} × MARCUSNOTE
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();
    browser = null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(title).replace(/[^a-z0-9_-]/gi, '_')}.pdf"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);

    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    return res.status(500).json({
      ok: false,
      error: 'PDF Generation Failed',
      detail: error?.message || 'Unknown error'
    });
  }
};
