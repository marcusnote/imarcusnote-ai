export default async function handler(req, res) {
  const MEMBERSTACK_SECRET_KEY = process.env.MEMBERSTACK_SECRET_KEY;
  const MEMBERSTACK_APP_ID = process.env.MEMBERSTACK_APP_ID || "";
  const MEMBERSTACK_BASE_URL = "https://admin.memberstack.com/members";
  const MEMBERSTACK_MP_FIELD = process.env.MEMBERSTACK_MP_FIELD || "mp";
  const DEFAULT_TRIAL_MP = 15;
  // 준회원(associate member) 무료 플랜 ID
  // 예: pln_xxxxxxxx
  const ASSOCIATE_PLAN_ID = process.env.MEMBERSTACK_ASSOCIATE_PLAN_ID || "";

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

    const safeCurrentPlan = sanitizeString(nextState.currentPlan);
    const currentCustomFields =
      member?.customFields && typeof member.customFields === "object"
        ? member.customFields
        : {};
    const currentMetaData =
      member?.metaData && typeof member.metaData === "object"
        ? member.metaData
        : {};

    const customFields = {
      ...currentCustomFields,
    };
    const metaData = {
      ...currentMetaData,
    };

    if (safeMp !== null) {
      customFields[MEMBERSTACK_MP_FIELD] = safeMp;
      customFields.mp = safeMp;
      customFields.MP = safeMp;
      customFields.remaining_mp = safeMp;

      metaData[MEMBERSTACK_MP_FIELD] = safeMp;
      metaData.mp = safeMp;
      metaData.MP = safeMp;
      metaData.remaining_mp = safeMp;
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

      if (name.includes("elite")) return "Elite";
      if (name.includes("premium")) return "Premium";
      if (name.includes("standard")) return "Standard";
      if (name.includes("basic")) return "Basic";
      if (name.includes("associate")) return "Associate";
    }

    const fallbackPlan =
      member?.customFields?.current_plan ||
      member?.metaData?.current_plan ||
      "";

    return sanitizeString(fallbackPlan) || "Associate";
  }

  try {
    addCors();

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
    let associatePlanAssigned = false;
    let associatePlanAlreadyPresent = false;
    let associatePlanSkipped = false;

    // 1) MP 최초 지급
    if (currentMp === null) {
      currentMp = DEFAULT_TRIAL_MP;
      member = (await updateMemberState(member, { mp: currentMp })) || member;
      initialized = true;
    }

    // 2) 준회원 무료 플랜 자동 부여 + 실제 반영 검증
    if (ASSOCIATE_PLAN_ID) {
      associatePlanAlreadyPresent = memberHasPlan(member, ASSOCIATE_PLAN_ID);

      if (!associatePlanAlreadyPresent) {
        await addFreePlanToMember(member.id, ASSOCIATE_PLAN_ID);

        // add-plan 호출 후 실제로 플랜이 붙었는지 재조회하여 검증
        const updatedMember = (await getMemberById(member.id)) || member;
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

    // 3) current_plan / remaining_mp / mp 동기화
    const plan = extractPlanName(member);
    currentMp = readMpFromMember(member);
    if (currentMp === null) currentMp = DEFAULT_TRIAL_MP;

    member =
      (await updateMemberState(member, {
        mp: currentMp,
        currentPlan: plan || "Associate",
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
