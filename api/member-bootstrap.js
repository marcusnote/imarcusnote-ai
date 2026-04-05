// api/member-bootstrap.js

export const config = {
  runtime: "nodejs",
};

const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY || "";
const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
const DEFAULT_TRIAL_MP = Number(process.env.MEMBERSTACK_TRIAL_MP || 15);

function sanitizeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function sanitizeMp(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(999999, Math.round(num)));
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

async function memberstackRequest(path, options = {}) {
  if (!MEMBERSTACK_SECRET_KEY) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MEMBERSTACK_SECRET_KEY}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Memberstack request failed: ${response.status} ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }

  return data;
}

function extractBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || "";
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function extractMemberId(req) {
  return sanitizeString(
    req.body?.memberId ||
      req.headers["x-member-id"] ||
      req.headers["X-Member-Id"] ||
      ""
  );
}

async function verifyMemberToken(token) {
  if (!token) return null;

  const payload = { token };
  if (MEMBERSTACK_APP_ID) payload.audience = MEMBERSTACK_APP_ID;

  const data = await memberstackRequest("/verify-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data?.data || null;
}

async function getMemberById(memberId) {
  if (!memberId) return null;

  const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return data?.data || null;
}

function readMpFromMember(member) {
  if (!member) return null;

  const candidates = [
    member?.customFields?.[MEMBERSTACK_MP_FIELD],
    member?.metaData?.[MEMBERSTACK_MP_FIELD],
    member?.customFields?.mp,
    member?.metaData?.mp,
    member?.customFields?.MP,
    member?.metaData?.MP,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return sanitizeMp(parsed, 0);
  }

  return null;
}

async function updateMemberMp(member, nextMp) {
  if (!member?.id) throw new Error("Missing member id");

  const safeNextMp = sanitizeMp(nextMp, 0);

  const currentCustomFields =
    member?.customFields && typeof member.customFields === "object"
      ? member.customFields
      : {};

  const currentMetaData =
    member?.metaData && typeof member.metaData === "object"
      ? member.metaData
      : {};

  const body = {
    customFields: {
      ...currentCustomFields,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
    },
    metaData: {
      ...currentMetaData,
      [MEMBERSTACK_MP_FIELD]: safeNextMp,
      mp: safeNextMp,
      MP: safeNextMp,
    },
  };

  const data = await memberstackRequest(`/${encodeURIComponent(member.id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return data?.data || null;
}

function extractPlanName(member) {
  const connections = Array.isArray(member?.planConnections)
    ? member.planConnections
    : [];

  const subscriptions = Array.isArray(member?.subscriptions)
    ? member.subscriptions
    : [];

  const allPlans = [...connections, ...subscriptions];

  for (const item of allPlans) {
    const raw =
      item?.planName ||
      item?.name ||
      item?.plan?.name ||
      item?.plan?.slug ||
      item?.slug ||
      "";

    const name = String(raw).trim().toLowerCase();

    if (name.includes("elite")) return "Elite";
    if (name.includes("premium")) return "Premium";
    if (name.includes("standard")) return "Standard";
    if (name.includes("basic")) return "Basic";
    if (name.includes("associate")) return "Associate";
    if (name.includes("free")) return "Free";
  }

  return "Free";
}

export default async function handler(req, res) {
  try {
    addCors(res);

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, error: "Method not allowed" });
    }

    const bearerToken = extractBearerToken(req);
    const explicitMemberId = extractMemberId(req);

    let verified = null;
    if (bearerToken) {
      verified = await verifyMemberToken(bearerToken);
    }

    const resolvedMemberId = sanitizeString(
      verified?.id || verified?.memberId || explicitMemberId
    );

    if (!resolvedMemberId) {
      return res.status(401).json({
        success: false,
        error: "member-not-resolved",
      });
    }

    let member = await getMemberById(resolvedMemberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "member-not-found",
      });
    }

    let currentMp = readMpFromMember(member);
    let initialized = false;

    // MP 최초 1회 지급만 수행
    if (currentMp === null) {
      currentMp = DEFAULT_TRIAL_MP;
      member = (await updateMemberMp(member, currentMp)) || member;
      initialized = true;
    }

    const refreshedMp = readMpFromMember(member);
    if (refreshedMp !== null) {
      currentMp = refreshedMp;
    }

    const plan = extractPlanName(member);

    return res.status(200).json({
      success: true,
      memberId: member.id,
      email: member.email || "",
      mp: currentMp,
      plan,
      initialized,
    });
  } catch (error) {
    console.error("member-bootstrap error:", error);

    return res.status(500).json({
      success: false,
      error: "bootstrap-failed",
      message: error.message || "Unknown error",
    });
  }
}
