export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { email, adminKey } = req.body || {};

  if (adminKey !== process.env.ADMIN_APPROVAL_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Email required' });
  }

  try {
    const encodedEmail = encodeURIComponent(email.trim());

    const response = await fetch(`https://admin.memberstack.com/members/${encodedEmail}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error || 'Lookup failed',
        raw: data
      });
    }

    return res.status(200).json({
      ok: true,
      member: data
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'Lookup failed',
      detail: e.message
    });
  }
}
