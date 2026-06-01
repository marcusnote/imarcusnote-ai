// /lib/plans.js
// 중앙 플랜 설정 파일입니다.
// MP 지급량을 변경할 때는 이 파일의 monthlyMp 값만 수정하세요.
// Memberstack plan ID, LemonSqueezy variant mapping, webhook 로직은 여기서 변경하지 않습니다.

export const PLAN_CONFIG = {
  associate: {
    key: "associate",
    label: "Associate",
    monthlyMp: 15,
    freePlanId: process.env.MEMBERSTACK_PLAN_ID_ASSOCIATE || "",
    removeOnUpgrade: false,
  },
  basic: {
    key: "basic",
    label: "Basic",
    monthlyMp: 80,
    freePlanId: process.env.MEMBERSTACK_PLAN_ID_BASIC || "",
    removeOnUpgrade: true,
  },
  standard: {
    key: "standard",
    label: "Standard",
    monthlyMp: 500,
    freePlanId: process.env.MEMBERSTACK_PLAN_ID_STANDARD || "",
    removeOnUpgrade: true,
  },
  premium: {
    key: "premium",
    label: "Premium",
    monthlyMp: 1500,
    freePlanId: process.env.MEMBERSTACK_PLAN_ID_PREMIUM || "",
    removeOnUpgrade: true,
  },
  elite: {
    key: "elite",
    label: "Elite",
    monthlyMp: 5000,
    freePlanId: process.env.MEMBERSTACK_PLAN_ID_ELITE || "",
    removeOnUpgrade: true,
  },
};

export const LEMON_VARIANT_TO_PLAN = {
  [process.env.LS_VARIANT_ID_BASIC || ""]: "basic",
  [process.env.LS_VARIANT_ID_STANDARD || ""]: "standard",
  [process.env.LS_VARIANT_ID_PREMIUM || ""]: "premium",
  [process.env.LS_VARIANT_ID_ELITE || ""]: "elite",
};

export function getPlanByKey(planKey) {
  if (!planKey) return null;
  return PLAN_CONFIG[String(planKey).toLowerCase()] || null;
}

export function getPlanByVariantId(variantId) {
  const planKey = LEMON_VARIANT_TO_PLAN[String(variantId || "")];
  return planKey ? getPlanByKey(planKey) : null;
}

export function getPaidPlanKeys() {
  return ["basic", "standard", "premium", "elite"];
}

export function getAllRemovablePlanIds() {
  return getPaidPlanKeys()
    .map((key) => PLAN_CONFIG[key]?.freePlanId)
    .concat(PLAN_CONFIG.associate?.freePlanId || "")
    .filter(Boolean);
}
