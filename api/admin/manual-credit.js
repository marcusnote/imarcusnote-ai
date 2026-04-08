export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }

  const { email, addMp = 0, setPlan = '', adminKey } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  const planMap = {
    basic: process.env.MS_PLAN_BASIC,
    standard: process.env.MS_PLAN_STANDARD,
    premium: process.env.MS_PLAN_PREMIUM,
    elite: process.env.MS_PLAN_ELITE
  };

  try {
    const encodedEmail = encodeURIComponent(email);

    // 1. 회원 조회
    const lookupRes = await fetch(`https://admin.memberstack.com/members/${encodedEmail}`, {
      headers: {
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      }
    });

    const lookupData = await lookupRes.json();
    const member = lookupData.data;
    const memberId = member.id;

    // 2. MP 계산
    const currentMp = Number(member.customFields?.mp || 0);
    const newMp = currentMp + Number(addMp || 0);

    // 3. MP 지급
    if (addMp > 0) {
      await fetch(`https://admin.memberstack.com/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
        },
        body: JSON.stringify({
          customFields: {
            ...member.customFields,
            mp: newMp
          }
        })
      });
    }

    // 4. 플랜 변경
    if (setPlan) {
      const targetPlanId = planMap[setPlan];

      // 기존 플랜 제거
      const plans = [
        process.env.MS_PLAN_BASIC,
        process.env.MS_PLAN_STANDARD,
        process.env.MS_PLAN_PREMIUM,
        process.env.MS_PLAN_ELITE
      ];

      for (const planId of plans) {
        if (planId && planId !== targetPlanId) {
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

      // 새 플랜 추가
      await fetch(`https://admin.memberstack.com/members/${memberId}/add-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
        },
        body: JSON.stringify({ planId: targetPlanId })
      });
    }

    return res.status(200).json({
      ok: true,
      email,
      addedMp: addMp,
      newMp,
      plan: setPlan || null
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
