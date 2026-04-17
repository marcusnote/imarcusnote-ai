module.exports.config = { runtime: "nodejs" };

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Member-Id");
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function sanitizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function buildSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_ENV_MISSING");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    const userId = sanitizeString(req.body?.userId || req.body?.user_id || "");
    const title = sanitizeString(req.body?.title || "Untitled Worksheet");
    const content = sanitizeString(req.body?.content || "");
    const engineMode = sanitizeString(req.body?.engineMode || req.body?.engine_mode || "unknown");
    const worksheetHtml = sanitizeString(req.body?.worksheetHtml || req.body?.worksheet_html || "");
    const answerHtml = sanitizeString(req.body?.answerHtml || req.body?.answer_html || "");

    if (!userId) return json(res, 400, { ok: false, error: "Missing userId" });
    if (!content) return json(res, 400, { ok: false, error: "Missing content" });

    const supabase = buildSupabase();

    const richRow = {
      user_id: userId,
      title,
      content,
      engine_mode: engineMode,
      worksheet_html: worksheetHtml || null,
      answer_html: answerHtml || null
    };

    const safeRow = {
      user_id: userId,
      title,
      content,
      engine_mode: engineMode
    };

    let result = await supabase
      .from("worksheets")
      .insert(richRow)
      .select("*")
      .single();

    if (result.error) {
      result = await supabase
        .from("worksheets")
        .insert(safeRow)
        .select("*")
        .single();
    }

    if (result.error) {
      return json(res, 500, {
        ok: false,
        error: result.error.message || "Failed to save worksheet"
      });
    }

    return json(res, 200, {
      ok: true,
      worksheet: result.data
    });
  } catch (error) {
    const message = error && error.message ? error.message : "unknown_error";
    return json(res, 500, { ok: false, error: message });
  }
};
