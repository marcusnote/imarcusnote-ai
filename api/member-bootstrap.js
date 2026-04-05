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

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
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

    let verifiedMemberId = "";

    // 1) 토큰이 있으면 정상 검증
    if (token) {
      const verified = await verifyMemberToken(token);
      const verifiedMember = normalizeMember(verified);
      verifiedMemberId = verifiedMember?.id || verifiedMember?.memberId || "";

      if (!verifiedMemberId) {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      if (requestedMemberId && requestedMemberId !== verifiedMemberId) {
        return res.status(403).json({
          success: false,
          error: "Member mismatch",
        });
      }
    }

    // 2) 토큰이 없으면 memberId fallback 허용
    const resolvedMemberId = verifiedMemberId || requestedMemberId;

    if (!resolvedMemberId) {
      return res.status(401).json({
        success: false,
        error: "Missing token and memberId",
      });
    }

    let member = await getMemberById(resolvedMemberId);
    member = normalizeMember(member);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    const currentPlan =
      member?.customFields?.current_plan ||
      member?.metaData?.current_plan ||
      "associate";

    const hasAnyMpField =
      member?.customFields?.remaining_mp != null ||
      member?.metaData?.remaining_mp != null ||
      member?.customFields?.mp != null ||
      member?.metaData?.mp != null;

    // 신규 associate면 15 MP 지급
    if (!hasAnyMpField && currentPlan === "associate") {
      const trialMp = PLAN_CONFIG.associate?.monthlyMp || 15;
      const mpResetAt = computeNextMpResetAt();

      await updateMember(resolvedMemberId, {
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
        memberId: resolvedMemberId,
        plan: "associate",
        mp: trialMp,
        trialGranted: true,
        authMode: token ? "token" : "memberId-fallback",
      });
    }

    if (isMpExpired(member)) {
      member = await zeroOutExpiredMp(resolvedMemberId, member);
    }

    const remainingMp = readRemainingMp(member);

    return res.status(200).json({
      success: true,
      memberId: resolvedMemberId,
      plan:
        member?.customFields?.current_plan ||
        member?.metaData?.current_plan ||
        "associate",
      mp: remainingMp,
      authMode: token ? "token" : "memberId-fallback",
    });
  } catch (error) {
    console.error("Bootstrap Error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Bootstrap failed",
    });
  }
}
