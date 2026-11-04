// POST /api/send-mi
// Sends KBAN MI reports (e.g. the evening FedEx disputes exception report)
// from "KBAN MI <mi@send.kbanlogistics.co.uk>" via Resend.
//
// Auth: header  x-mi-secret: <MI_SEND_SECRET>   (set MI_SEND_SECRET in Vercel env vars)
// Body: { "to": ["a@x"], "cc": ["b@x"], "subject": "...", "html": "..." }
// Recipients are restricted to an allowlist so the endpoint cannot be used to email outsiders.

const ALLOWED = new Set([
  'daniel@kbanlogistics.co.uk',
  'wayne@kbanlogistics.co.uk',
  'waynejnr@kbanlogistics.co.uk',
  'paul@kbanlogistics.co.uk',
]);

const FROM = 'KBAN MI <mi@send.kbanlogistics.co.uk>';
const REPLY_TO = 'daniel@kbanlogistics.co.uk';

function clean(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map((a) => String(a).trim().toLowerCase()).filter(Boolean);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = process.env.MI_SEND_SECRET;
  if (!secret) return res.status(500).json({ error: 'MI_SEND_SECRET is not set' });
  if (req.headers['x-mi-secret'] !== secret) return res.status(401).json({ error: 'Unauthorised' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY is not set' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const to = clean(body.to);
  const cc = clean(body.cc);
  const subject = String(body.subject || '').slice(0, 255);
  const html = String(body.html || '');

  if (!to.length || !subject || !html) {
    return res.status(400).json({ error: 'to, subject and html are required' });
  }
  const blocked = [...to, ...cc].filter((a) => !ALLOWED.has(a));
  if (blocked.length) {
    return res.status(400).json({ error: 'Recipient not on allowlist', blocked });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        reply_to: REPLY_TO,
        to,
        cc: cc.length ? cc : undefined,
        subject,
        html: '<div style="font-family:Arial,sans-serif;font-size:13px;color:#0B2E4E;">' + html + '</div>',
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.message || 'Resend error', detail: data });
    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
