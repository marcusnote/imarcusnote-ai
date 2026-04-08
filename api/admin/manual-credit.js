export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { email, addMp = 0, adminKey } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Email required' });
  }

  const mpField = process.env.MEMBERSTACK_MP_FIELD || 'mp';
  const addMpSafe = Math.max(0, Math.floor(Number(addMp || 0)));

  if (!Number.isFinite(addMpSafe)) {
    return res.status(400).json({ ok: false, error: 'Invalid MP value' });
  }

  try {
    const encodedEmail = encodeURIComponent(email.trim());

    // 1) Find member by email
    const lookupRes = await fetch(`https://admin.memberstack.com/members/${encodedEmail}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      }
    });

    const lookupData = await lookupRes.json();

    if (!lookupRes.ok) {
      return res.status(lookupRes.status).json({
        ok: false,
        error: lookupData?.error || 'Lookup failed',
        raw: lookupData
      });
    }

    const member = lookupData?.data;
    const memberId = member?.id;

    if (!memberId) {
      return res.status(404).json({ ok: false, error: 'Member ID not found' });
    }

    const currentMp = Number(member?.customFields?.[mpField] || 0);
    const newMp = currentMp + addMpSafe;

    // 2) Update custom field by member ID
    const patchRes = await fetch(`https://admin.memberstack.com/members/${memberId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      },
      body: JSON.stringify({
        customFields: {
          ...(member?.customFields || {}),
          [mpField]: newMp
        }
      })
    });

    const patchData = await patchRes.json();

    if (!patchRes.ok) {
      return res.status(patchRes.status).json({
        ok: false,
        error: patchData?.error || 'MP update failed',
        raw: patchData
      });
    }

    return res.status(200).json({
      ok: true,
      email: email.trim(),
      memberId,
      previousMp: currentMp,
      addedMp: addMpSafe,
      newMp
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'MP update failed',
      detail: e.message
    });
  }
}
