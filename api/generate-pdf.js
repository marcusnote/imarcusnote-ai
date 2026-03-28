const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(content = "", academyName = "MARCUSNOTE") {
  const safeBrand = escapeHtml(academyName);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      @page {
        size: A4;
        margin: 16mm;
      }

      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #111;
      }

      .brand {
        font-weight: bold;
        margin-bottom: 12px;
      }

      .footer {
        position: fixed;
        bottom: 10px;
        right: 20px;
        font-size: 10px;
        color: #999;
      }
    </style>
  </head>

  <body>
    <div class="brand">${safeBrand}</div>
    ${content}
    <div class="footer">${safeBrand} x MARCUSNOTE</div>
  </body>
  </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  let browser = null;

  try {
    const { content, academyName } = req.body;

    if (!content) {
      return res.status(400).json({
        ok: false,
        message: "No content",
      });
    }

    console.log("Launching Puppeteer...");

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    const html = buildHtml(content, academyName);

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    console.log("PDF created");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=marcusnote.pdf");

    return res.send(pdf);

  } catch (error) {
    console.error("PDF ERROR:", error);

    return res.status(500).json({
      ok: false,
      message: "PDF generation failed",
      detail: error.message,
    });

  } finally {
    if (browser) await browser.close();
  }
}
