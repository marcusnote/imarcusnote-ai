import {
  settleExpiredMonthlyMp,
  readCarryoverMp,
  readMonthlyMp,
  readMpResetAt,
} from "../lib/mp.js";

export default async function handler(req, res) {
  const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY;
  const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
  const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
  const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
  const DEFAULT_TRIAL_MP = 15;

  const ASSOCIATE_PLAN_ID =
    process.env.MEMBERSTACK_PLAN_ID_ASSOCIATE ||
    process.env.MEMBERSTACK_ASSOCIATE_PLAN_ID ||
    "";

  const PLAN_VERIFY_RETRY_COUNT = 5;
  const PLAN_VERIFY_DELAY_MS = 900;

  function addCors() {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Member-Id"
    );
  }

  function sanitizeString(value) {
    return String(value || "").trim();
  }

  function sanitizeMp(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getHeaders() {
    if (!MEMBERSTACK_SECRET_KEY) return null;
    return {
      "x-api-key": MEMBERSTACK_SECRET_KEY,
      "Content-Type": "application/json",
    };
  }

  async function memberstackRequest(path, options = {}) {
    const headers = getHeaders();
    if (!headers) throw new Error("Missing MEMBERSTACK_SECRET_KEY");

    const response = await fetch(`${MEMBERSTACK_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
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
        req.query?.memberId ||
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
      member?.customFields?.remaining_mp,
      member?.metaData?.remaining_mp,
      member?.customFields?.monthly_mp,
      member?.metaData?.monthly_mp,
    ];

    for (const value of candidates) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return sanitizeMp(parsed, 0);
    }

    return null;
  }

  async function patchMember(memberId, payload) {
    if (!memberId) throw new Error("Missing member id");

    const data = await memberstackRequest(`/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return data?.data || null;
  }

  async function updateMemberState(member, nextState = {}) {
    if (!member?.id) throw new Error("Missing member id");

    const safeMp =
      nextState.mp === undefined || nextState.mp === null
        ? readMpFromMember(member)
        : sanitizeMp(nextState.mp, 0);

    const safeCurrentPlan = sanitizeString(nextState.currentPlan).toLowerCase();

    const currentCustomFields =
      member?.customFields && typeof member.customFields === "object"
        ? member.customFields
        : {};
    const currentMetaData =
      member?.metaData && typeof member.metaData === "object"
        ? member.metaData
        : {};

    const customFields = { ...currentCustomFields };
    const metaData = { ...currentMetaData };

    if (safeMp !== null) {
      customFields[MEMBERSTACK_MP_FIELD] = safeMp;
      customFields.mp = safeMp;
      customFields.MP = safeMp;
      customFields.remaining_mp = safeMp;
      customFields.monthly_mp = customFields.monthly_mp ?? safeMp;

      metaData[MEMBERSTACK_MP_FIELD] = safeMp;
      metaData.mp = safeMp;
      metaData.MP = safeMp;
      metaData.remaining_mp = safeMp;
      metaData.monthly_mp = metaData.monthly_mp ?? safeMp;
    }

    if (safeCurrentPlan) {
      customFields.current_plan = safeCurrentPlan;
      metaData.current_plan = safeCurrentPlan;
    }

    const payload = { customFields, metaData };
    return (await patchMember(member.id, payload)) || member;
  }

  function memberHasPlan(member, planId) {
    if (!member || !planId) return false;

    const connections = Array.isArray(member.planConnections)
      ? member.planConnections
      : [];
    const subscriptions = Array.isArray(member.subscriptions)
      ? member.subscriptions
      : [];

    const inConnections = connections.some((item) => {
      const connectedPlanId = item?.planId || item?.plan?.id || item?.id || "";
      return connectedPlanId === planId;
    });

    const inSubscriptions = subscriptions.some((item) => {
      const connectedPlanId = item?.planId || item?.plan?.id || item?.id || "";
      return connectedPlanId === planId;
    });

    return inConnections || inSubscriptions;
  }

  async function addFreePlanToMember(memberId, planId) {
    if (!memberId) throw new Error("Missing member id");
    if (!planId) throw new Error("Missing ASSOCIATE_PLAN_ID");

    await memberstackRequest(`/${encodeURIComponent(memberId)}/add-plan`, {
      method: "POST",
      body: JSON.stringify({ planId }),
    });

    return true;
  }

  async function waitForPlan(memberId, planId) {
    let latestMember = null;

    for (let i = 0; i < PLAN_VERIFY_RETRY_COUNT; i += 1) {
      latestMember = await getMemberById(memberId);
      if (memberHasPlan(latestMember, planId)) {
        return latestMember;
      }
      await sleep(PLAN_VERIFY_DELAY_MS);
    }

    return latestMember;
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
        "";

      const name = String(raw).toLowerCase();

      if (name.includes("elite")) return "elite";
      if (name.includes("premium")) return "premium";
      if (name.includes("standard")) return "standard";
      if (name.includes("basic")) return "basic";
      if (name.includes("associate")) return "associate";
    }

    const fallbackPlan =
      member?.customFields?.current_plan ||
      member?.metaData?.current_plan ||
      "";

    return sanitizeString(fallbackPlan).toLowerCase() || "associate";
  }

  function isPaidPlan(planName) {
    return ["basic", "standard", "premium", "elite"].includes(
      String(planName || "").toLowerCase()
    );
  }

  try {
    addCors();

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method === "GET") {
      const explicitMemberId = extractMemberId(req);
      const bearerToken = extractBearerToken(req);

      if (!explicitMemberId && !bearerToken) {
        return res.status(200).json({
          success: true,
          route: "member-bootstrap",
          healthy: true,
          message: "member-bootstrap is alive",
          requiresAuthForBootstrap: true,
          associatePlanConfigured: !!ASSOCIATE_PLAN_ID,
          hasSecretKey: !!MEMBERSTACK_SECRET_KEY,
          appIdConfigured: !!MEMBERSTACK_APP_ID,
          mpField: MEMBERSTACK_MP_FIELD,
          defaultTrialMp: DEFAULT_TRIAL_MP,
        });
      }
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "method-not-allowed",
      });
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

    let currentPlan = extractPlanName(member);
    let currentMp = readMpFromMember(member);

    let initialized = false;
    let associatePlanAssigned = false;
    let associatePlanAlreadyPresent = false;
    let associatePlanSkipped = false;
    let paidPlanProtected = false;

    if (isPaidPlan(currentPlan)) {
      paidPlanProtected = true;

      member = (await settleExpiredMonthlyMp(member.id, member)) || member;

      currentPlan = extractPlanName(member);
      currentMp = readMpFromMember(member);

      if (currentMp === null) {
        currentMp = 0;
      }

      member =
        (await updateMemberState(member, {
          mp: currentMp,
          currentPlan,
        })) || member;

      const finalMpPaid = readMpFromMember(member) ?? currentMp;
      const finalPlanPaid = extractPlanName(member);
      const finalMonthlyMp =
        sanitizeMp(
          member?.customFields?.monthly_mp ??
            member?.metaData?.monthly_mp,
          0
        ) || readMonthlyMp(member);
      const finalCarryoverMp = readCarryoverMp(member);
      const finalResetAt = readMpResetAt(member);

      return res.status(200).json({
        success: true,
        memberId: member.id,
        email: member.email || "",
        mp: finalMpPaid,
        remaining_mp: finalMpPaid,
        monthly_mp: finalMonthlyMp,
        carryover_mp: finalCarryoverMp,
        mp_reset_at: finalResetAt,
        plan: finalPlanPaid,
        current_plan: finalPlanPaid,
        initialized: false,
        associatePlanAssigned: false,
        associatePlanAlreadyPresent: false,
        associatePlanSkipped: true,
        associatePlanConfigured: !!ASSOCIATE_PLAN_ID,
        paidPlanProtected: true,
      });
    }

    if (currentMp === null) {
      currentMp = DEFAULT_TRIAL_MP;
      member = (await updateMemberState(member, { mp: currentMp })) || member;
      initialized = true;
    }

    if (ASSOCIATE_PLAN_ID) {
      associatePlanAlreadyPresent = memberHasPlan(member, ASSOCIATE_PLAN_ID);

      if (!associatePlanAlreadyPresent) {
        await addFreePlanToMember(member.id, ASSOCIATE_PLAN_ID);

        const updatedMember =
          (await waitForPlan(member.id, ASSOCIATE_PLAN_ID)) || member;
        const hasPlanNow = memberHasPlan(updatedMember, ASSOCIATE_PLAN_ID);

        if (!hasPlanNow) {
          return res.status(500).json({
            success: false,
            error: "associate-plan-not-applied",
            message: "Associate plan assignment failed",
            memberId: member.id,
            associatePlanConfigured: !!ASSOCIATE_PLAN_ID,
          });
        }

        member = updatedMember;
        associatePlanAssigned = true;
        associatePlanAlreadyPresent = true;
      } else {
        member = (await getMemberById(member.id)) || member;
        associatePlanAlreadyPresent = memberHasPlan(member, ASSOCIATE_PLAN_ID);
      }
    } else {
      associatePlanSkipped = true;
    }

    currentPlan = extractPlanName(member);
    currentMp = readMpFromMember(member);
    if (currentMp === null) currentMp = DEFAULT_TRIAL_MP;

    member =
      (await updateMemberState(member, {
        mp: currentMp,
        currentPlan: currentPlan || "associate",
      })) || member;

    const refreshedMp = readMpFromMember(member);
    const finalMp = refreshedMp === null ? currentMp : refreshedMp;
    const finalPlan = extractPlanName(member);

    return res.status(200).json({
      success: true,
      memberId: member.id,
      email: member.email || "",
      mp: finalMp,
      remaining_mp: finalMp,
      plan: finalPlan,
      current_plan: finalPlan,
      initialized,
      associatePlanAssigned,
      associatePlanAlreadyPresent,
      associatePlanSkipped,
      associatePlanConfigured: !!ASSOCIATE_PLAN_ID,
      paidPlanProtected,
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
