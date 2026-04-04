const MEMBERSTACK_BASE = "https://admin.memberstack.com";

function getHeaders(extra = {}) {
  const apiKey = process.env.MEMBERSTACK_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Missing MEMBERSTACK_SECRET_KEY");
  }

  return {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey,
    ...extra,
  };
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${MEMBERSTACK_BASE}${path}`, {
    ...options,
    headers: getHeaders(options.headers || {}),
  });

  const data = await safeJson(response);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Memberstack request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function verifyMemberToken(token) {
  if (!token) {
    throw new Error("Missing member token");
  }

  const data = await request("/members/verify-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  return data;
}

export async function getMemberById(memberId) {
  if (!memberId) {
    throw new Error("Missing memberId");
  }

  return await request(`/members/${encodeURIComponent(memberId)}`, {
    method: "GET",
  });
}

export async function getMemberByEmail(email) {
  if (!email) {
    throw new Error("Missing email");
  }

  return await request(`/members/${encodeURIComponent(email)}`, {
    method: "GET",
  });
}

export async function updateMember(memberId, payload) {
  if (!memberId) {
    throw new Error("Missing memberId");
  }

  return await request(`/members/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  });
}

export async function addFreePlan(memberId, planId) {
  if (!memberId || !planId) return null;

  return await request(`/members/${encodeURIComponent(memberId)}/add-plan`, {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

export async function removeFreePlan(memberId, planId) {
  if (!memberId || !planId) return null;

  return await request(`/members/${encodeURIComponent(memberId)}/remove-plan`, {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}
