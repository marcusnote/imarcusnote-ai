// /lib/mp.js
import {
  addFreePlan,
  removeFreePlan,
  updateMember,
} from "./memberstack-admin.js";
import {
  PLAN_CONFIG,
  getPlanByKey,
  getAllRemovablePlanIds,
} from "./plans.js";

const PLAN_MP = {
  associate: 15,
  basic: 160,
  standard: 400,
  premium: 1000,
  elite: 2400,
};

const MP_ROLLOVER_RATE = 0.3;
const MP_POLICY_VERSION = "2026-04-rollover-v1";

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sanitizeMp(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function pickField(member, key, fallback = "") {
  return member?.customFields?.[key] ?? member?.metaData?.[key] ?? fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function computeNextMpResetAt(baseDate = new Date()) {
  // 월 유효기간 구조: 결제/갱신 시점부터 30일
  return addDays(baseDate, 30).toISOString();
}

export function normalizeMember(memberResponse) {
  return memberResponse?.data || memberResponse || null;
}

export function readRemainingMp(member) {
  const raw =
    member?.customFields?.remaining_mp ??
    member?.metaData?.remaining_mp ??
    member?.customFields?.mp ??
    member?.metaData?.mp ??
    0;

  return sanitizeMp(raw, 0);
}

export function readCurrentPlanKey(member) {
  const raw =
    member?.customFields?.current_plan ??
    member?.metaData?.current_plan ??
    "";
  return String(raw || "").trim().toLowerCase();
}

export function readMonthlyMp(member) {
  const raw =
    member?.customFields?.monthly_mp ??
    member?.metaData?.monthly_mp;

  const parsed = sanitizeMp(raw, -1);
  if (parsed >= 0) return parsed;

  const currentPlanKey = readCurrentPlanKey(member);
  const plan = getPlanByKey(currentPlanKey);
  return PLAN_MP[plan?.key] ?? plan?.monthlyMp ?? 0;
}

export function readCarryoverMp(member) {
  const raw =
    member?.customFields?.carryover_mp ??
    member?.metaData?.carryover_mp ??
    0;

  return sanitizeMp(raw, 0);
}

export function readMpResetAt(member) {
  return (
    member?.customFields?.mp_reset_at ??
    member?.metaData?.mp_reset_at ??
    ""
  );
}

export function isMpExpired(member) {
  const raw = readMpResetAt(member);
  if (!raw) return false;

  const resetAt = new Date(raw);
  if (Number.isNaN(resetAt.getTime())) return false;

  return Date.now() > resetAt.getTime();
}

export function computeCarryoverMp(member, rate = MP_ROLLOVER_RATE) {
  const monthlyMp = readMonthlyMp(member);
  const remainingMp = readRemainingMp(member);
  const priorCarryover = readCarryoverMp(member);

  if (monthlyMp <= 0 || remainingMp <= 0) {
    return 0;
  }

  // 재이월 금지:
  // 지난달 carryover_mp가 포함되어 remaining_mp가 남아 있어도
  // 이번 달 새로 이월 계산할 때는 제외
  const baseUnusedMp = Math.max(0, remainingMp - priorCarryover);
  const carryCap = Math.max(0, Math.floor(monthlyMp * rate));
  const carryByUsage = Math.max(0, Math.floor(baseUnusedMp * rate));

  return Math.min(carryByUsage, carryCap);
}

function buildMpPatch(member, nextState = {}) {
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
    ...nextState,
  };

  const metaData = {
    ...currentMetaData,
    ...nextState,
  };

  return { customFields, metaData };
}

export async function zeroOutExpiredMp(memberId, member) {
  if (!isMpExpired(member)) return member;

  const patch = buildMpPatch(member, {
    remaining_mp: 0,
    mp: 0,
    carryover_mp: 0,
    carryover_expires_at: "",
    last_mp_settlement_at: nowIso(),
    mp_policy_version: MP_POLICY_VERSION,
    mp_reset_at: readMpResetAt(member) || "",
  });

  await updateMember(memberId, patch);

  return {
    ...member,
    customFields: {
      ...(member?.customFields || {}),
      ...patch.customFields,
    },
    metaData: {
      ...(member?.metaData || {}),
      ...patch.metaData,
    },
  };
}

export async function settleExpiredMonthlyMp(memberId, member) {
  if (!isMpExpired(member)) return member;

  const currentPlanKey = readCurrentPlanKey(member);
  const monthlyMp = PLAN_MP[currentPlanKey] ?? readMonthlyMp(member);

  if (monthlyMp <= 0) {
    return await zeroOutExpiredMp(memberId, member);
  }

  let nextRemainingMp = monthlyMp;
  if (nextRemainingMp < 0) {
    nextRemainingMp = 0;
  }
  const nextResetAt = computeNextMpResetAt(new Date());

  const patch = buildMpPatch(member, {
    monthly_mp: monthlyMp,
    remaining_mp: nextRemainingMp,
    mp: nextRemainingMp,
    carryover_mp: 0,
    carryover_expires_at: "",
    mp_reset_at: nextResetAt,
    last_mp_settlement_at: nowIso(),
    mp_policy_version: MP_POLICY_VERSION,
  });

  await updateMember(memberId, patch);

  return {
    ...member,
    customFields: {
      ...(member?.customFields || {}),
      ...patch.customFields,
    },
    metaData: {
      ...(member?.metaData || {}),
      ...patch.metaData,
    },
  };
}

export async function setMemberPlanAndMp(memberId, planKey, extras = {}) {
  const plan = getPlanByKey(planKey);
  if (!plan) {
    throw new Error(`Unknown plan: ${planKey}`);
  }

  const removablePlanIds = getAllRemovablePlanIds();
  for (const planId of removablePlanIds) {
    if (planId) {
      try {
        await removeFreePlan(memberId, planId);
      } catch (error) {
        // plan이 없을 수 있으므로 remove 실패는 치명 오류로 보지 않음
      }
    }
  }

  if (plan.freePlanId) {
    await addFreePlan(memberId, plan.freePlanId);
  }

  const mpResetAt = computeNextMpResetAt(new Date());
  const member = extras.member || null;
  const firstPaidAt =
    member?.customFields?.first_paid_at ??
    member?.metaData?.first_paid_at ??
    null;
  const isFirstPayment = member && !firstPaidAt;
  let baseMp = PLAN_MP[plan.key] ?? plan.monthlyMp;
  let mp = isFirstPayment ? baseMp * 2 : baseMp;
  if (mp < 0) {
    mp = 0;
  }

  const patch = {
    current_plan: plan.key,
    monthly_mp: mp,
    remaining_mp: mp,
    mp: mp,
    mp_reset_at: mpResetAt,
    carryover_mp: 0,
    carryover_expires_at: "",
    last_mp_settlement_at: nowIso(),
    mp_policy_version: MP_POLICY_VERSION,
    trial_used: true,
    first_paid_at: isFirstPayment ? nowIso() : firstPaidAt,
    lemonsqueezy_customer_id: extras.customerId || "",
    lemonsqueezy_subscription_id: extras.subscriptionId || "",
    lemonsqueezy_variant_id: extras.variantId || "",
  };

  await updateMember(memberId, buildMpPatch({}, patch));

  return {
    planKey: plan.key,
    monthlyMp: mp,
    remainingMp: mp,
    carryoverMp: 0,
    mpResetAt,
  };
}

export async function downgradeToAssociate(memberId) {
  const associate = PLAN_CONFIG.associate;
  const removablePlanIds = getAllRemovablePlanIds();

  for (const planId of removablePlanIds) {
    if (planId) {
      try {
        await removeFreePlan(memberId, planId);
      } catch (error) {}
    }
  }

  if (associate.freePlanId) {
    await addFreePlan(memberId, associate.freePlanId);
  }

  const patch = {
    current_plan: associate.key,
    monthly_mp: PLAN_MP.associate,
    remaining_mp: PLAN_MP.associate,
    mp: PLAN_MP.associate,
    carryover_mp: 0,
    carryover_expires_at: "",
    last_mp_settlement_at: nowIso(),
    mp_policy_version: MP_POLICY_VERSION,
  };

  await updateMember(memberId, buildMpPatch({}, patch));

  return { planKey: associate.key, remainingMp: PLAN_MP.associate };
}

export async function deductMp(memberId, member, requiredMp) {
  const current = readRemainingMp(member);
  const needed = Number.isFinite(Number(requiredMp))
    ? Math.max(0, Math.floor(requiredMp))
    : 0;

  if (needed <= 0) {
    return { success: true, remainingMp: current };
  }

  if (current < needed) {
    return {
      success: false,
      insufficient_mp: true,
      remainingMp: current,
      requiredMp: needed,
    };
  }

  let next = current - needed;
  if (next < 0) {
    next = 0;
  }

  const patch = buildMpPatch(member, {
    remaining_mp: next,
    mp: next,
  });

  await updateMember(memberId, patch);

  return {
    success: true,
    remainingMp: next,
    deductedMp: needed,
  };
}
