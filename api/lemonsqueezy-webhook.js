import crypto from "crypto";
import { getMemberByEmail } from "../lib/memberstack-admin.js";
import {
  downgradeToAssociate,
  normalizeMember,
  setMemberPlanAndMp,
} from "../lib/mp.js";
import { getPlanByVariantId } from "../lib/plans.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(rawBody, signature) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing LEMONSQUEEZY_WEBHOOK_SECRET");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return digest === signature;
}

function getEventName(req) {
  return req.headers["x-event-name"] || "";
}

function getSignature(req) {
  return req.headers["x-signature"] || "";
}

function extractUsefulFields(payload) {
  const data = payload?.data || {};
  const attributes = data?.attributes || {};
  const meta = payload?.meta || {};
  const customData = meta?.custom_data || attributes?.custom_data || {};

  const variantId =
    attributes?.variant_id ||
    attributes?.first_subscription_item?.variant_id ||
    attributes?.product_variant_id ||
    "";

  const subscriptionId =
    data?.id ||
    attributes?.subscription_id ||
    "";

  const customerId =
    attributes?.customer_id ||
    "";

  const email =
    attributes?.user_email ||
    attributes?.customer_email ||
    attributes?.email ||
    customData?.email ||
    "";

  const memberId =
    customData?.memberstack_member_id ||
    customData?.memberId ||
    customData?.member_id ||
    "";

  return {
    variantId: String(variantId || ""),
    subscriptionId: String(subscriptionId || ""),
    customerId: String(customerId || ""),
    email: String(email || "").trim().toLowerCase(),
    memberId: String(memberId || ""),
    status: String(attributes?.status || "").toLowerCase(),
    cancelUrl: attributes?.urls?.customer_portal || "",
  };
}

async function resolveMember(payloadFields) {
  if (payloadFields.email) {
    const found = await getMemberByEmail(payloadFields.email);
    return normalizeMember(found);
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = getSignature(req);

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const eventName = getEventName(req);
    const info = extractUsefulFields(payload);
    const plan = getPlanByVariantId(info.variantId);

    const member = await resolveMember(info);

    if (!member?.id) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Member not found by email. Check Lemon custom_data / email mapping.",
      });
    }

    // 신규/갱신/재개 → 유료 플랜 부여 + 월 MP 재지급
    if (
      eventName === "order_created" ||
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_resumed"
    ) {
      if (!plan) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "No plan matched this Lemon variant id",
          variantId: info.variantId,
        });
      }

      const result = await setMemberPlanAndMp(member.id, plan.key, {
        customerId: info.customerId,
        subscriptionId: info.subscriptionId,
        variantId: info.variantId,
      });

      return res.status(200).json({
        ok: true,
        eventName,
        action: "plan_set",
        memberId: member.id,
        plan: result.planKey,
        mp: result.remainingMp,
      });
    }

    // 취소/만료/실패 → associate 로 다운그레이드
    if (
      eventName === "subscription_cancelled" ||
      eventName === "subscription_expired" ||
      eventName === "subscription_paused" ||
      eventName === "subscription_payment_failed"
    ) {
      const result = await downgradeToAssociate(member.id);

      return res.status(200).json({
        ok: true,
        eventName,
        action: "downgraded",
        memberId: member.id,
        plan: result.planKey,
        mp: result.remainingMp,
      });
    }

    // 환불 정책은 운영 판단에 따라 조정 가능
    if (eventName === "order_refunded") {
      const result = await downgradeToAssociate(member.id);

      return res.status(200).json({
        ok: true,
        eventName,
        action: "refunded_downgraded",
        memberId: member.id,
        plan: result.planKey,
      });
    }

    return res.status(200).json({
      ok: true,
      ignored: true,
      eventName,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Webhook handler failed",
    });
  }
}
