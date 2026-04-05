// /api/member-bootstrap.js
// 현재 Framer AI Workspace가 호출하는 엔드포인트
// 프론트 코드에서는 Authorization Bearer 토큰과 X-Member-Id를 함께 보냅니다.

import {
  getMemberById,
  updateMember,
  verifyMemberToken,
} from "../lib/memberstack-admin.js";
import {
  normalizeMember,
  readRemainingMp,
  isMpExpired,
  zeroOutExpiredMp,
  computeNextMpResetAt,
} from "../lib/mp.js";
import { PLAN_CONFIG } from "../lib/plans.js";

// 2️⃣ addCors 함수 추가
function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

export default async function handler(req, res) {
  // 3️⃣ handler 안에 CORS 로직 추가
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    const requestedMemberId =
      req.headers["x-member-id"] ||
      req.body?.memberId ||
      "";

    if (!token) {
      return res.status(401).json({ success: false, error: "Missing token" });
    }

    const verified = await verifyMemberToken(token);
    const verifiedMember = normalizeMember(verified);
    const verifiedMemberId = verifiedMember?.id || verifiedMember?.memberId || "";

    // 1) member mismatch 체크 복구
    if (requestedMemberId && requestedMemberId !== verifiedMemberId) {
      return res.status(403).json({ success: false, error: "Member mismatch" });
    }

    if (!verifiedMemberId) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    let member = await getMemberById(verifiedMemberId);
    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    // 2) currentPlan 읽기 보강
    const currentPlan =
      member?.customFields?.current_plan ||
      member?.metaData?.current_plan ||
      "associate";

    const hasAnyMpField =
      member?.customFields?.remaining_mp != null ||
      member?.metaData?.remaining_mp != null ||
      member?.customFields?.mp != null ||
      member?.metaData?.mp != null;

    if (!hasAnyMpField && currentPlan === "associate") {
      const trialMp = PLAN_CONFIG.associate.monthlyMp || 15;
      const mpResetAt = computeNextMpResetAt();

      await updateMember(verifiedMemberId, {
        customFields: {
          current_plan: "associate",
          monthly_mp: trialMp,
          remaining_mp: trialMp,
          mp: trialMp,
          mp_reset_at: mpResetAt,
        },
        metaData: {
          current_plan: "associate",
          monthly_mp: trialMp,
          remaining_mp: trialMp,
          mp: trialMp,
          mp_reset_at: mpResetAt,
        },
      });

      return res.status(200).json({
        success: true,
        memberId: verifiedMemberId,
        plan: "associate",
        mp: trialMp,
        trialGranted: true,
      });
    }

    if (isMpExpired(member)) {
      member = await zeroOutExpiredMp(verifiedMemberId, member);
    }

    const remainingMp = readRemainingMp(member);

    return res.status(200).json({
      success: true,
      memberId: verifiedMemberId,
      plan: currentPlan,
      mp: remainingMp,
    });
  } catch (error) {
    console.error("Bootstrap Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
