module.exports.config = { runtime: "nodejs" };

const { createClient } = require("@supabase/supabase-js");

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeContent(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function normalizeEngineMode(value) {
  const v = normalizeString(value).toLowerCase();
  if (!v) return "unknown";
  return v.slice(0, 50);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const userId = normalizeString(body.userId);
    const title = normalizeString(body.title, "Untitled Worksheet");
    const content = normalizeContent(body.content);
    const engineMode = normalizeEngineMode(body.engine_mode || body.engineMode || "");

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    if (!content) {
      return res.status(400).json({ ok: false, error: "Missing content" });
    }

    const supabase = getSupabaseAdmin();

    const payload = {
      user_id: userId,
      title: title.slice(0, 200),
      content,
      engine_mode: engineMode,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("worksheets")
      .insert(payload)
      .select("id, user_id, title, engine_mode, created_at")
      .single();

    if (error) {
      console.error("[save-worksheet] supabase insert error:", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to save worksheet",
        detail: error.message || "unknown_insert_error",
      });
    }

    return res.status(200).json({
      ok: true,
      worksheet: data,
    });
  } catch (err) {
    console.error("[save-worksheet] fatal:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err.message || "unknown_server_error",
    });
  }
};
