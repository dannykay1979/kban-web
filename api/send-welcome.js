const SUPABASE_URL = 'https://eacaudjkppyhpsjzoakv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhY2F1ZGprcHB5aHBzanpvYWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDYwNzYsImV4cCI6MjA5ODEyMjA3Nn0.oxPp4xwKyt7MjeefQiC8zKApzwydlqst_GY1WyLVmxU';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DEPOTS = [
  'DPD Aberdeen', 'DPD Edinburgh', 'DPD Dundee', 'DPD Glasgow', 'DPD Eurocentral',
  'FedEx Preston', 'FedEx Warrington', 'FedEx Ramsbottom',
  'InPost Middleton', 'InPost Warrington', 'DHL Middleton', 'DHL Runcorn'
];

const idWordFor = depot => depot.startsWith('DPD') ? 'route ID' : (depot.startsWith('DHL') ? 'driver ID or temp ID' : 'route number');
const managerFor = depot => depot.startsWith('DPD')
  ? { name: 'Paul', email: 'paul@kbanlogistics.co.uk' }
  : { name: 'Wayne', email: 'WayneJnr@kbanlogistics.co.uk' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Only signed in KBAN management users may send. This stops the endpoint being used to email PINs to anyone.
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const ur = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token } });
    if (!ur.ok) return res.status(401).json({ error: 'Not signed in' });
    const user = await ur.json();
    if (!/@kbanlogistics\.co\.uk$/i.test(String(user.email || ''))) return res.status(403).json({ error: 'Not allowed' });

    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY is not set' });

    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 80);
    const email = String(b.email || '').trim();
    const logins = (Array.isArray(b.logins) ? b.logins : []).slice(0, 4)
      .map(l => ({ depot: String(l.depot || ''), pin: String(l.pin || '') }));
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (!logins.length || logins.some(l => !DEPOTS.includes(l.depot) || !/^\d{4}$/.test(l.pin))) return res.status(400).json({ error: 'Invalid depot or PIN' });

    const first = name.split(/\s+/)[0];
    const mgr = managerFor(logins[0].depot);
    const shift = b.isNew ? 'first shift' : 'next shift';
    const idWords = [...new Set(logins.map(l => idWordFor(l.depot)))];
    const idLine = logins.length > 1
      ? 'Enter your ' + idWords.join(' or ') + ' (depending on the depot you are working at) when the app asks for it.'
      : 'Enter your ' + idWords[0] + ' when the app asks for it.';

    const loginLis = logins.length === 1
      ? '<li>Depot: ' + esc(logins[0].depot) + '</li><li>Your personal PIN: <strong style="font-size:16px;letter-spacing:1px;">' + esc(logins[0].pin) + '</strong></li>'
      : '<li>You work at more than one depot. Choose the depot you are working at that day.</li>' +
        logins.map(l => '<li>' + esc(l.depot) + ' PIN: <strong style="font-size:16px;letter-spacing:1px;">' + esc(l.pin) + '</strong></li>').join('');

    const sec = (n, t) => '<p style="margin:16px 0 4px;"><strong>' + n + '. ' + t + '</strong></p>';
    const ul = lis => '<ul style="margin:0 0 8px 18px;padding:0;">' + lis.map(i => '<li style="margin:3px 0;">' + i + '</li>').join('') + '</ul>';

    let body = '';
    body += '<p>Hi ' + esc(first) + ',</p>';
    body += '<p>We are moving all start of day, vehicle check and end of day reporting into the KBAN driver app. Everything you need is below. Please read it through and get set up before your ' + shift + '.</p>';
    body += sec(1, 'Your login') + '<ul style="margin:0 0 8px 18px;padding:0;"><li style="margin:3px 0;">Start guide and video: <a href="https://kban-web.vercel.app/driver-start.html">https://kban-web.vercel.app/driver-start.html</a></li>' +
      loginLis.replace(/<li>/g, '<li style="margin:3px 0;">') + '<li style="margin:3px 0;">Please do not share your PIN with anyone.</li></ul>';
    body += sec(2, 'Save it to your phone') + ul(['The start guide shows how to add the app to your home screen on iPhone and Android.', 'It takes under a minute and means you can open it like any other app.']);
    body += sec(3, 'Before your ' + shift) + ul([
      'Watch the video on the start guide page. It is under 2 minutes.',
      'Log in and complete your start of day and vehicle check with photos before you leave the depot.',
      'Complete end of day when you return.',
      esc(idLine)
    ]);
    body += sec(4, 'Wise') + ul(['Please also check your Wise profile is complete and your documents are up to date.']);
    if (b.rollout) {
      body += sec(5, 'Dates') + ul(['Please start using the app from Tuesday 27/10/2026.', 'From Monday 02/11/2026 we expect everyone to be using it every working day.']);
    }
    body += '<p style="margin-top:16px;">If anything does not work, reply to this email or speak to ' + mgr.name + ' and we will sort it the same day. Please reply to confirm you have received this and can log in.</p>';
    body += '<p>Kind regards,<br>KBAN Ops<br>KBAN Logistics</p>';

    const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2430;max-width:600px;">' +
      '<img src="https://kban-web.vercel.app/kban-logo.jpg" alt="KBAN Logistics" height="48" style="display:block;margin-bottom:12px;">' +
      body + '</div>';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KBAN Ops <ops@send.kbanlogistics.co.uk>',
        to: [email],
        cc: (b.noCc && /^daniel@/i.test(String(user.email))) ? [] : [mgr.email],
        reply_to: mgr.email,
        subject: 'KBAN Driver App: your login and start guide',
        html,
      }),
    });
    if (!r.ok) {
      console.error('Resend error:', r.status, await r.text());
      return res.status(502).json({ error: 'Email service refused the message' });
    }
    return res.status(200).json({ success: true, cc: mgr.name });
  } catch (error) {
    console.error('Welcome email error:', error);
    return res.status(500).json({ error: 'Failed to send welcome email' });
  }
};
