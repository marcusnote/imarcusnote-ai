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

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function nowIso() {
  return new Date().toISOString();
}

export function computeNextMpResetAt() {
  // 월 유효기간 구조: 결제/갱신 시점부터 30일
  return addDays(new Date(), 30).toISOString();
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

  const parsed = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function isMpExpired(member) {
  const raw =
    member?.customFields?.mp_reset_at ??
    member?.metaData?.mp_reset_at ??
    "";
  if (!raw) return false;

  const resetAt = new Date(raw);
  if (Number.isNaN(resetAt.getTime())) return false;

  return Date.now() > resetAt.getTime();
}

export async function zeroOutExpiredMp(memberId, member) {
  if (!isMpExpired(member)) return member;

  await updateMember(memberId, {
    customFields: {
      remaining_mp: 0,
      mp: 0,
    },
    metaData: {
      remaining_mp: 0,
      mp: 0,
      mp_reset_at: member?.metaData?.mp_reset_at || member?.customFields?.mp_reset_at || "",
    },
  });

  return {
    ...member,
    customFields: {
      ...(member?.customFields || {}),
      remaining_mp: 0,
      mp: 0,
    },
    metaData: {
      ...(member?.metaData || {}),
      remaining_mp: 0,
      mp: 0,
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

  const mpResetAt = computeNextMpResetAt();

  await updateMember(memberId, {
    customFields: {
      current_plan: plan.key,
      monthly_mp: plan.monthlyMp,
      remaining_mp: plan.monthlyMp,
      mp: plan.monthlyMp,
      mp_reset_at: mpResetAt,
      trial_used: true,
      lemonsqueezy_customer_id: extras.customerId || "",
      lemonsqueezy_subscription_id: extras.subscriptionId || "",
      lemonsqueezy_variant_id: extras.variantId || "",
    },
    metaData: {
      current_plan: plan.key,
      monthly_mp: plan.monthlyMp,
      remaining_mp: plan.monthlyMp,
      mp: plan.monthlyMp,
      mp_reset_at: mpResetAt,
      trial_used: true,
      lemonsqueezy_customer_id: extras.customerId || "",
      lemonsqueezy_subscription_id: extras.subscriptionId || "",
      lemonsqueezy_variant_id: extras.variantId || "",
    },
  });

  return {
    planKey: plan.key,
    monthlyMp: plan.monthlyMp,
    remainingMp: plan.monthlyMp,
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

  await updateMember(memberId, {
    customFields: {
      current_plan: associate.key,
      monthly_mp: 0,
      remaining_mp: 0,
      mp: 0,
    },
    metaData: {
      current_plan: associate.key,
      monthly_mp: 0,
      remaining_mp: 0,
      mp: 0,
    },
  });

  return { planKey: associate.key, remainingMp: 0 };
}

export async function deductMp(memberId, member, requiredMp) {
  const current = readRemainingMp(member);
  const needed = Number.isFinite(Number(requiredMp)) ? Math.max(0, Math.floor(requiredMp)) : 0;

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

  const next = current - needed;

  await updateMember(memberId, {
    customFields: {
      remaining_mp: next,
      mp: next,
    },
    metaData: {
      remaining_mp: next,
      mp: next,
    },
  });

  return {
    success: true,
    remainingMp: next,
    deductedMp: needed,
  };
}
