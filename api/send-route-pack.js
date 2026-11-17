// Sends one FedEx Preston driver pack email from "KBAN Ops <ops@send.kbanlogistics.co.uk>" via Resend.
// Staff only (signed in KBAN user). Driver details come from route_confirmations, never from the request.
const SUPABASE_URL = 'https://eacaudjkppyhpsjzoakv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhY2F1ZGprcHB5aHBzanpvYWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDYwNzYsImV4cCI6MjA5ODEyMjA3Nn0.oxPp4xwKyt7MjeefQiC8zKApzwydlqst_GY1WyLVmxU';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const departBy = w => { const m = /^(\d{1,2}):(\d{2})/.exec(String(w || '')); if (!m) return ''; const t = (+m[1]) * 60 + (+m[2]) + 60; return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const ur = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token } });
    if (!ur.ok) return res.status(401).json({ error: 'Not signed in' });
    const user = await ur.json();
    const userEmail = String(user.email || '');
    if (!/@kbanlogistics\.co\.uk$/i.test(userEmail)) return res.status(403).json({ error: 'Not allowed' });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY is not set' });

    const b = req.body || {};
    const route = parseInt(b.route, 10);
    if (!(route >= 470 && route <= 482)) return res.status(400).json({ error: 'Invalid route' });
    const pdf = String(b.pdf || '');
    if (!pdf || pdf.length < 1000 || pdf.length > 3000000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return res.status(400).json({ error: 'Missing or invalid PDF' });

    // Read the driver row with the signed in user's own session (staff policy applies).
    const dr = await fetch(SUPABASE_URL + '/rest/v1/route_confirmations?route=eq.' + route + '&select=token,route,driver_name,email,wave', {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token },
    });
    const rows = dr.ok ? await dr.json() : [];
    if (!rows.length) return res.status(404).json({ error: 'Driver not found for route ' + route });
    const d = rows[0];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email || ''))) return res.status(400).json({ error: 'No valid email for route ' + route });

    // Test mode: send to the signed in user only, never to the driver.
    const override = String(b.email || '').trim();
    const okMail = x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
    if (override && !okMail(override)) return res.status(400).json({ error: 'Invalid email address' });
    const to = b.test ? userEmail : (override || d.email);
    const first = String(d.driver_name || '').trim().split(/\s+/)[0] || 'there';
    const link = 'https://kban-web.vercel.app/route-confirm.html?t=' + encodeURIComponent(d.token);
    const wave = String(d.wave || '').slice(0, 5);
    const dep = departBy(wave);
    const li = t => '<li style="margin:3px 0;">' + t + '</li>';
    const ul = a => '<ul style="margin:0 0 8px 18px;padding:0;">' + a.map(li).join('') + '</ul>';
    const sec = t => '<p style="margin:16px 0 4px;"><strong>' + t + '</strong></p>';

    const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1c2733;line-height:1.45;">'
      + '<p>Hi ' + esc(first) + ',</p>'
      + '<p>Please find attached your driver pack for the new FedEx Preston route structure. Please read it in full, then complete your confirmation online using your personal link below.</p>'
      + sec('1. Your route')
      + ul(['Route number ' + route + '. On bay by ' + esc(wave) + ', depart by ' + esc(dep) + ' (no more than 60 minutes after your wave).',
            'Your area and postcodes are on page 1.',
            'This is a route change only. Your pay and vehicle arrangements stay as they are now.'])
      + sec('2. What we need from you by 16/11/2026')
      + ul(['Open your personal link: <a href="' + link + '">' + link + '</a>',
            'Choose your load position for each postcode sector.',
            'Tick the three confirmations and type your name to sign.',
            'The link is for your route only. Please do not share it.'])
      + sec('3. Collections')
      + ul(['You are responsible for the whole route and area, including all daily, scheduled and ad hoc collections.',
            'Collect inside the window only. Windows can change, so always check the window on your scanner on the day.',
            'Cut off times are in section 3 of your pack.'])
      + '<p>Please complete the form by 16/11/2026. Junior will speak to you on site to confirm you have it. If you have any queries, Paul and Wayne Jnr will be on site tomorrow.</p>'
      + '<p>Kind regards,<br>KBAN Logistics Operations</p></div>';

    const filename = 'Route_' + route + '_' + String(d.driver_name || 'Driver').trim().replace(/[^A-Za-z0-9]+/g, '_') + '_Driver_Pack.pdf';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KBAN Ops <ops@send.kbanlogistics.co.uk>',
        to: [to],
        reply_to: ['WayneJnr@kbanlogistics.co.uk', 'paul@kbanlogistics.co.uk'],
        subject: (b.test ? '[TEST] ' : '') + 'Your FedEx Preston route from 23/11/2026 and action required',
        html,
        attachments: [{ filename, content: pdf }],
      }),
    });
    if (!r.ok) { console.error('Resend error', r.status, await r.text()); return res.status(502).json({ error: 'Email service refused the message' }); }
    return res.status(200).json({ success: true, route, to: b.test ? 'you (test)' : d.driver_name });
  } catch (e) {
    console.error('send-route-pack error', e);
    return res.status(500).json({ error: 'Failed to send' });
  }
};
