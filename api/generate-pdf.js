const chromium = require("@sparticuz/chromium");
const { chromium: playwright } = require("playwright-core");

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

function buildPdfHtml(content = "", academyName = "MARCUSNOTE ELITE") {
  const safeBrand = escapeHtml(academyName);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
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

      h1 {
        font-size: 18px;
        margin-bottom: 10px;
      }

      .footer {
        position: fixed;
        bottom: 10px;
        right: 20px;
        font-size: 10px;
        color: #999;
      }

      .brand {
        font-weight: bold;
        margin-bottom: 10px;
      }
    </style>
  </head>

  <body>
    <div class="brand">${safeBrand}</div>
    <div>${content}</div>
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
        message: "No content provided",
      });
    }

    console.log("Launching browser...");

    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,

      // 🔥 핵심 안정화 옵션
      chromiumSandbox: false,
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 },
    });

    const page = await context.newPage();

    const html = buildPdfHtml(content, academyName);

    await page.setContent(html, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("Generating PDF...");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    console.log("PDF success");

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
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log("browser close error ignored");
      }
    }
  }
}
