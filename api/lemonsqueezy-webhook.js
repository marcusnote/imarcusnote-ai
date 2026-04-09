// /api/lemonsqueezy-webhook.js
// Lemon Squeezy webhook → Vercel → Memberstack 플랜 반영/다운그레이드 + 관리자 이메일 알림 + Google Sheets 기록
// X-Signature 헤더로 HMAC SHA256 검증
// 기존 로직 유지 + 운영자 알림/로그만 추가한 완성본

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
  return String(req.headers["x-event-name"] || "");
}

function getSignature(req) {
  return String(req.headers["x-signature"] || "");
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
    (payload?.meta?.event_name === "order_created" ? data?.id || "" : "");

  return {
    variantId: String(variantId || ""),
    subscriptionId: String(subscriptionId || ""),
    customerId: String(customerId || ""),
    email: String(email || "").trim().toLowerCase(),
    memberId: String(memberId || ""),
    orderId: String(orderId || ""),
    status: String(attributes?.status || "").toLowerCase(),
    cancelUrl: String(attributes?.urls?.customer_portal || ""),
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

async function sendToGoogleSheets(rowData) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;https://script.google.com/macros/s/AKfycbx-8svjk-v4dSnx00uJHQfpfDBrZyoQEAX1GZks8Odz6gycA9v-5kw1u7PaYISLEq_F/exec

  if (!url) {
    console.warn("GOOGLE_SHEETS_WEBHOOK_URL missing - sheets logging skipped");
    return { skipped: true, reason: "Missing GOOGLE_SHEETS_WEBHOOK_URL" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rowData),
  });

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(
      `Google Sheets webhook failed (${response.status}): ${text || "No response body"}`
    );
  }

  return { ok: true, text };
}

function buildLogPayload({
  stage,
  eventName,
  info = {},
  member = null,
  planKey = "",
  action = "",
  result = null,
  note = "",
}) {
  return {
    timestamp: new Date().toISOString(),
    stage: stage || "",
    eventName: eventName || "",
    email: info.email || "",
    productName: info.productName || "",
    variantName: info.variantName || "",
    variantId: info.variantId || "",
    orderId: info.orderId || "",
    subscriptionId: info.subscriptionId || "",
    customerId: info.customerId || "",
    status: info.status || "",
    memberId: member?.id || "",
    planKey: planKey || "",
    action: action || "",
    mp: result?.remainingMp ?? result?.mp ?? "",
    mpResetAt: result?.mpResetAt || "",
    cancelUrl: info.cancelUrl || "",
    note: note || "",
    source: "lemonsqueezy-webhook",
  };
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
  const payload = buildLogPayload({
    stage,
    eventName,
    info,
    member,
    planKey,
    action,
    result,
    note,
  });

  const subject = `[Marcusnote][Lemon] ${payload.stage} · ${payload.eventName || "unknown_event"} · ${payload.email || "no-email"}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">
      <h2 style="margin:0 0 12px;">Marcusnote Lemon Squeezy Alert</h2>
      <p style="margin:0 0 16px;"><strong>Stage:</strong> ${escapeHtml(payload.stage)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;">
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Time</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.timestamp)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Event</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.eventName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Email</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Product</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.productName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Variant</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.variantName)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Variant ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.variantId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Order ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.orderId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Subscription ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.subscriptionId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Customer ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.customerId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Status</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.status)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Matched Member ID</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.memberId)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Plan</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.planKey)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Action</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.action)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>MP to check</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.mp)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>MP reset at</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.mpResetAt)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Cancel URL</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.cancelUrl)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;"><strong>Note</strong></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.note)}</td></tr>
      </table>
    </div>
  `.trim();

  const text = [
    "Marcusnote Lemon Squeezy Alert",
    `Stage: ${payload.stage}`,
    `Time: ${payload.timestamp}`,
    `Event: ${payload.eventName}`,
    `Email: ${payload.email}`,
    `Product: ${payload.productName}`,
    `Variant: ${payload.variantName}`,
    `Variant ID: ${payload.variantId}`,
    `Order ID: ${payload.orderId}`,
    `Subscription ID: ${payload.subscriptionId}`,
    `Customer ID: ${payload.customerId}`,
    `Status: ${payload.status}`,
    `Matched Member ID: ${payload.memberId}`,
    `Plan: ${payload.planKey}`,
    `Action: ${payload.action}`,
    `MP to check: ${payload.mp}`,
    `MP reset at: ${payload.mpResetAt}`,
    `Cancel URL: ${payload.cancelUrl}`,
    `Note: ${payload.note}`,
  ].join("\n");

  try {
    await sendAdminEmail({ subject, html, text });
  } catch (emailError) {
    console.error("Admin email send failed:", emailError?.message || emailError);
  }

  try {
    await sendToGoogleSheets(payload);
  } catch (sheetsError) {
    console.error("Google Sheets send failed:", sheetsError?.message || sheetsError);
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
