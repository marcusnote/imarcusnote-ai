// /api/lemonsqueezy-webhook.js
// Lemon Squeezy webhook → Vercel → Memberstack free plan 부여/제거 + 관리자 이메일 알림
// 공식 문서 기준 X-Signature 헤더로 HMAC SHA256 검증
// 기존 로직은 유지하고, 관리자 이메일 알림만 최소 추가한 버전입니다.

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

  const orderId =
    attributes?.order_id ||
    payload?.meta?.event_name === "order_created"
      ? data?.id || ""
      : "";

  return {
    variantId: String(variantId || ""),
    subscriptionId: String(subscriptionId || ""),
    customerId: String(customerId || ""),
    email: String(email || "").trim().toLowerCase(),
    memberId: String(memberId || ""),
    orderId: String(orderId || ""),
    status: String(attributes?.status || "").toLowerCase(),
    cancelUrl: attributes?.urls?.customer_portal || "",
    productName: String(attributes?.product_name || ""),
    variantName: String(attributes?.variant_name || ""),
  };
}

async function resolveMember(payloadFields) {
  if (payloadFields.email) {
    const found = await getMemberByEmail(payloadFields.email);
    return normalizeMember(found);
  }

  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendAdminEmail({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_ALERT_EMAIL || "kwangcheon9@gmail.com";
  const from =
    process.env.ADMIN_FROM_EMAIL ||
    "Marcusnote Alerts <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY missing - admin email skipped");
    return { skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Resend request failed (${response.status})`
    );
  }

  return data;
}

async function notifyAdmin({
  stage,
  eventName,
  info = {},
  member = null,
  planKey = "",
  action = "",
  result = null,
  note = "",
}) {
  const memberId = member?.id || "";
  const remainingMp = result?.remainingMp ?? result?.mp ?? "";
  const mpResetAt = result?.mpResetAt || "";
  const now = new Date().toISOString();

  const subject = `[Marcusnote][Lemon] ${stage} · ${eventName || "unknown_event"} · ${info.email || "no-email"}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">
      <h2 style="margin:0 0 12px;">Marcusnote Lemon Squeezy Alert</h2>
      <p style="margin:0 0 16px;"><strong>Stage:</strong> ${escapeHtml(stage)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;">
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Time</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(now)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Event</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(eventName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.email)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Product</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.productName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Variant</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.variantName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Variant ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.variantId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Order ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.orderId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Subscription ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.subscriptionId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Customer ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.customerId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Status</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(info.status)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Matched Member ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(memberId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Plan</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(planKey)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Action</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(action)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>MP to check</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(remainingMp)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>MP reset at</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(mpResetAt)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Note</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(note)}</td></tr>
      </table>
    </div>
  `.trim();

  const text = [
    "Marcusnote Lemon Squeezy Alert",
    `Stage: ${stage}`,
    `Time: ${now}`,
    `Event: ${eventName}`,
    `Email: ${info.email || ""}`,
    `Product: ${info.productName || ""}`,
    `Variant: ${info.variantName || ""}`,
    `Variant ID: ${info.variantId || ""}`,
    `Order ID: ${info.orderId || ""}`,
    `Subscription ID: ${info.subscriptionId || ""}`,
    `Customer ID: ${info.customerId || ""}`,
    `Status: ${info.status || ""}`,
    `Matched Member ID: ${memberId}`,
    `Plan: ${planKey || ""}`,
    `Action: ${action || ""}`,
    `MP to check: ${remainingMp}`,
    `MP reset at: ${mpResetAt}`,
    `Note: ${note || ""}`,
  ].join("\n");

  try {
    await sendAdminEmail({ subject, html, text });
  } catch (emailError) {
    console.error("Admin email send failed:", emailError?.message || emailError);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let eventName = "";
  let info = {
    variantId: "",
    subscriptionId: "",
    customerId: "",
    email: "",
    memberId: "",
    orderId: "",
    status: "",
    cancelUrl: "",
    productName: "",
    variantName: "",
  };

  try {
    const rawBody = await readRawBody(req);
    const signature = getSignature(req);

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    eventName = getEventName(req);
    info = extractUsefulFields(payload);
    const plan = getPlanByVariantId(info.variantId);

    const member = await resolveMember(info);

    if (!member?.id) {
      await notifyAdmin({
        stage: "MEMBER_NOT_FOUND",
        eventName,
        info,
        planKey: plan?.key || "",
        action: "manual_check_required",
        note: "Member not found by email. Check Lemon email or custom_data mapping.",
      });

      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Member not found by email. Check Lemon custom_data / email mapping.",
      });
    }

    // 신규/갱신/재개 → 유료 플랜 부여 + 현재 기존 MP 지급 로직 유지
    if (
      eventName === "order_created" ||
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_resumed"
    ) {
      if (!plan) {
        await notifyAdmin({
          stage: "PLAN_NOT_MATCHED",
          eventName,
          info,
          member,
          action: "manual_check_required",
          note: "No plan matched this Lemon variant id.",
        });

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

      await notifyAdmin({
        stage: "PLAN_SET",
        eventName,
        info,
        member,
        planKey: result.planKey,
        action: "memberstack_plan_updated",
        result,
        note: "결제 감지 및 플랜 반영 완료. 필요 시 MP를 수동 확인/조정하세요.",
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

      await notifyAdmin({
        stage: "DOWNGRADED",
        eventName,
        info,
        member,
        planKey: result.planKey,
        action: "downgraded_to_associate",
        result,
        note: "결제 상태 변경으로 Associate로 다운그레이드되었습니다.",
      });

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

      await notifyAdmin({
        stage: "REFUNDED",
        eventName,
        info,
        member,
        planKey: result.planKey,
        action: "refunded_downgraded",
        result,
        note: "환불 감지로 Associate로 다운그레이드되었습니다.",
      });

      return res.status(200).json({
        ok: true,
        eventName,
        action: "refunded_downgraded",
        memberId: member.id,
        plan: result.planKey,
      });
    }

    await notifyAdmin({
      stage: "IGNORED_EVENT",
      eventName,
      info,
      member,
      action: "ignored",
      note: "Webhook는 정상 수신되었으나 현재 처리 대상 이벤트는 아닙니다.",
    });

    return res.status(200).json({
      ok: true,
      ignored: true,
      eventName,
    });
  } catch (error) {
    await notifyAdmin({
      stage: "WEBHOOK_ERROR",
      eventName,
      info,
      action: "error",
      note: error?.message || "Webhook handler failed",
    });

    return res.status(500).json({
      ok: false,
      error: error?.message || "Webhook handler failed",
    });
  }
}
