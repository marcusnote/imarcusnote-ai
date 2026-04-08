export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { email, adminKey } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email required' });
  }

  try {
    const response = await fetch(`https://api.memberstack.com/v1/members/${email}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      }
    });

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      member: data
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Lookup failed' });
  }
}
