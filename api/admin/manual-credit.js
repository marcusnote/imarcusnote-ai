export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }

  const { email, addMp = 0, adminKey } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false });
  }

  try {
    await fetch(`https://api.memberstack.com/v1/members/${email}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      },
      body: JSON.stringify({
        customFields: {
          mp: Number(addMp || 0)
        }
      })
    });

    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
