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
    const roll = !!b.rollout;
    const idWords = [...new Set(logins.map(l => idWordFor(l.depot)))];
    const idLine = logins.length > 1
      ? 'Enter your ' + idWords.join(' or ') + ' (depending on the depot you are working at) when the app asks for it.'
      : 'Enter your ' + idWords[0] + ' when the app asks for it.';

    const loginLis = logins.length === 1
      ? '<li>Depot: ' + esc(logins[0].depot) + '</li><li>Your personal PIN: <strong style="font-size:16px;letter-spacing:1px;">' + esc(logins[0].pin) + '</strong></li>'
      : '<li>You work at more than one depot. Choose the depot you are working at that day.</li>' +
        logins.map(l => '<li>' + esc(l.depot) + ' PIN: <strong style="font-size:16px;letter-spacing:1px;">' + esc(l.pin) + '</strong></li>').join('');

    let n = 0;
    const sec = t => '<p style="margin:16px 0 4px;"><strong>' + (++n) + '. ' + t + '</strong></p>';
    const ul = lis => '<ul style="margin:0 0 8px 18px;padding:0;">' + lis.map(i => '<li style="margin:3px 0;">' + i + '</li>').join('') + '</ul>';

    let body = '';
    body += '<p>Hi ' + esc(first) + ',</p>';
    body += roll
      ? '<p>From Monday 02/11/2026 we are moving all start of day, vehicle check and end of day reporting into the new KBAN driver app. This email is an early heads up with everything you need to get set up. Please read it all the way through.</p>'
      : '<p>We are moving all start of day, vehicle check and end of day reporting into the new KBAN driver app. This email has everything you need to get set up. Please read it all the way through.</p>';
    body += sec('Your login') + '<ul style="margin:0 0 8px 18px;padding:0;"><li style="margin:3px 0;">Start guide and video: <a href="https://kban-web.vercel.app/driver-start.html">https://kban-web.vercel.app/driver-start.html</a></li>' +
      loginLis.replace(/<li>/g, '<li style="margin:3px 0;">') + '<li style="margin:3px 0;">Please do not share your PIN with anyone.</li></ul>';
    body += sec('Save it to your phone') + ul(['The start guide shows how to add the app to your home screen on iPhone and Android.', 'It takes under a minute.']);
    body += sec('Get set up now') + ul([
      'Watch the video on the start guide page. It is under 2 minutes.',
      'Log in once to check your PIN works.',
      esc(idLine)
    ]);
    body += sec(roll ? 'From Monday 02/11/2026' : 'Every working day') + ul([
      'Complete your start of day, vehicle check and end of day in the app every working day.',
      'While the app is in its early stages, please also keep sending your start and end of day updates to your depot group as you do now.',
      'Please do both until we confirm that the group updates can stop.'
    ]);
    body += sec('Vehicle check photos') + ul([
      '6 photos are required on every check, no exceptions.',
      'All photos must be clear.',
      'A compliance check is carried out on these.',
      'They protect you against any claim for new damage.'
    ]);
    body += sec('Complete every step in full') + ul([
      'The systems we are adding link into our payroll process to make it more efficient and accurate.',
      'Missing information affects the timing and accuracy of your payments.'
    ]);
    body += sec('Any issues') + ul([
      'This mailbox does not receive replies, so please do not reply to this email.',
      'Speak to your lead driver, Paul Roberts, Wayne Bannister or Wayne Bannister Jnr to log any issue and we will get it resolved.'
    ]);
    body += '<p style="margin-top:16px;">Thanks for your support.</p>';
    body += '<p>Kind regards,<br>KBAN Ops<br>KBAN Logistics</p>';

    const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2430;max-width:600px;">' +
      '<img src="https://kban-web.vercel.app/kban-logo.jpg" alt="KBAN Logistics" height="48" style="display:block;margin-bottom:12px;">' +
      body + '</div>';

    // Default: copy the manager. Optional override: a list of KBAN addresses (an empty list means no copy).
    let ccList = (b.noCc && /^daniel@/i.test(String(user.email))) ? [] : [mgr.email];
    if (Array.isArray(b.cc)) ccList = b.cc.map(String).filter(a => /^[^\s@]+@kbanlogistics\.co\.uk$/i.test(a)).slice(0, 5);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KBAN Ops <ops@send.kbanlogistics.co.uk>',
        to: [email],
        cc: ccList,
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
