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

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const userId = normalizeString(req.query?.userId);
    const limitRaw = Number(req.query?.limit || 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.round(limitRaw))) : 20;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("worksheets")
      .select("id, user_id, title, content, engine_mode, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[get-worksheets] supabase select error:", error);
      return res.status(500).json({
        ok: false,
        error: "Failed to load worksheets",
        detail: error.message || "unknown_select_error",
      });
    }

    return res.status(200).json({
      ok: true,
      worksheets: data || [],
    });
  } catch (err) {
    console.error("[get-worksheets] fatal:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err.message || "unknown_server_error",
    });
  }
};
