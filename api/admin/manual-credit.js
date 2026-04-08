export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    email,
    addMp = 0,
    setPlan = '',
    adminKey
  } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Email required' });
  }

  const mpField = process.env.MEMBERSTACK_MP_FIELD || 'mp';
  const addMpSafe = Math.max(0, Math.floor(Number(addMp || 0)));

  const allowedPlans = ['', 'basic', 'standard', 'premium', 'elite'];
  if (!allowedPlans.includes(String(setPlan || '').toLowerCase())) {
    return res.status(400).json({ ok: false, error: 'Invalid plan value' });
  }

  const planMap = {
    basic: process.env.MS_PLAN_BASIC || '',
    standard: process.env.MS_PLAN_STANDARD || '',
    premium: process.env.MS_PLAN_PREMIUM || '',
    elite: process.env.MS_PLAN_ELITE || ''
  };

  const targetPlanKey = String(setPlan || '').toLowerCase();
  const targetPlanId = targetPlanKey ? planMap[targetPlanKey] : '';

  try {
    const encodedEmail = encodeURIComponent(email.trim());

    // 1) member lookup
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

    const currentCustomFields = member?.customFields || {};
    const currentMp = Number(currentCustomFields?.[mpField] || 0);
    const newMp = currentMp + addMpSafe;

    // 2) MP patch if needed
    if (addMpSafe > 0) {
      const patchRes = await fetch(`https://admin.memberstack.com/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
        },
        body: JSON.stringify({
          customFields: {
            ...currentCustomFields,
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
    }

    // 3) Plan change if needed
    if (targetPlanKey) {
      if (!targetPlanId) {
        return res.status(400).json({
          ok: false,
          error: `Missing plan ID for ${targetPlanKey}`
        });
      }

      const existingConnections = Array.isArray(member?.planConnections) ? member.planConnections : [];
      const activePlanIds = existingConnections
        .filter((p) => p && p.active)
        .map((p) => p.planId || p.id)
        .filter(Boolean);

      const removablePlanIds = [
        process.env.MS_PLAN_BASIC,
        process.env.MS_PLAN_STANDARD,
        process.env.MS_PLAN_PREMIUM,
        process.env.MS_PLAN_ELITE
      ].filter(Boolean);

      for (const planId of removablePlanIds) {
        if (planId !== targetPlanId && activePlanIds.includes(planId)) {
          await fetch(`https://admin.memberstack.com/members/${memberId}/remove-plan`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
            },
            body: JSON.stringify({ planId })
          });
        }
      }

      if (!activePlanIds.includes(targetPlanId)) {
        const addPlanRes = await fetch(`https://admin.memberstack.com/members/${memberId}/add-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
          },
          body: JSON.stringify({ planId: targetPlanId })
        });

        const addPlanData = await addPlanRes.json();

        if (!addPlanRes.ok) {
          return res.status(addPlanRes.status).json({
            ok: false,
            error: addPlanData?.error || 'Plan update failed',
            raw: addPlanData
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      email: email.trim(),
      memberId,
      previousMp: currentMp,
      addedMp: addMpSafe,
      newMp,
      appliedPlan: targetPlanKey || null
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'Manual update failed',
      detail: e.message
    });
  }
}
