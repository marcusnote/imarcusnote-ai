// /api/member-bootstrap.js
// 무료 가입 직후 / AI Workspace 진입 시
// Memberstack 회원 상태를 점검하고,
// 신규 무료회원이면 Associate 플랜 + 15MP를 실제로 부여합니다.

import {
  getMemberById,
  verifyMemberToken,
} from "../lib/memberstack-admin.js";
import {
  normalizeMember,
  readRemainingMp,
  isMpExpired,
  zeroOutExpiredMp,
  setMemberPlanAndMp,
} from "../lib/mp.js";

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Member-Id"
  );
}

function getCurrentPlan(member) {
  return String(
    member?.customFields?.current_plan ||
    member?.metaData?.current_plan ||
    ""
  ).trim().toLowerCase();
}

function hasAnyMpField(member) {
  return (
    member?.customFields?.remaining_mp != null ||
    member?.metaData?.remaining_mp != null ||
    member?.customFields?.mp != null ||
    member?.metaData?.mp != null ||
    member?.customFields?.monthly_mp != null ||
    member?.metaData?.monthly_mp != null
  );
}

function isPaidPlan(planKey) {
  return ["basic", "standard", "premium", "elite"].includes(
    String(planKey || "").toLowerCase()
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

    // 1) 토큰이 있으면 검증
    if (token) {
      const verified = await verifyMemberToken(token);
      const verifiedMember = normalizeMember(verified);
      verifiedMemberId =
        verifiedMember?.id || verifiedMember?.memberId || "";

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

    // 2) 토큰 없으면 memberId fallback
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

    const currentPlan = getCurrentPlan(member);
    const mpFieldExists = hasAnyMpField(member);

    // A) 유료 플랜 회원이면 Associate로 덮어쓰지 않음
    if (isPaidPlan(currentPlan)) {
      if (isMpExpired(member)) {
        member = await zeroOutExpiredMp(resolvedMemberId, member);
      }

      return res.status(200).json({
        success: true,
        memberId: resolvedMemberId,
        plan: getCurrentPlan(member) || currentPlan,
        mp: readRemainingMp(member),
        trialGranted: false,
        authMode: token ? "token" : "memberId-fallback",
      });
    }

    // B) 신규 무료회원이거나, 무료 초기화가 아직 안 된 경우
    // Associate 실제 플랜 + 15MP를 공용 엔진으로 부여
    if (!mpFieldExists || !currentPlan || currentPlan === "associate") {
      const result = await setMemberPlanAndMp(resolvedMemberId, "associate");

      return res.status(200).json({
        success: true,
        memberId: resolvedMemberId,
        plan: result.planKey,
        mp: result.remainingMp,
        trialGranted: true,
        authMode: token ? "token" : "memberId-fallback",
      });
    }

    // C) 기타 예외 상태: 현재 값 그대로 반환
    if (isMpExpired(member)) {
      member = await zeroOutExpiredMp(resolvedMemberId, member);
    }

    return res.status(200).json({
      success: true,
      memberId: resolvedMemberId,
      plan: getCurrentPlan(member) || "associate",
      mp: readRemainingMp(member),
      trialGranted: false,
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
