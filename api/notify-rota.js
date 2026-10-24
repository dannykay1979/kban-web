const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uk = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s).split('-').reverse().join('/') : esc(s));
const list = a => (Array.isArray(a) ? a : []);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const b = req.body || {};
    const depot = String(b.depot || '').slice(0, 60);
    const weekStart = String(b.weekStart || '');
    if (!depot || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ error: 'Missing depot or week' });
    }
    const by = String(b.submittedBy || 'Unknown').slice(0, 80);
    const starters = list(b.starters).slice(0, 30);
    const leavers = list(b.leavers).slice(0, 30);
    const added = list(b.added).slice(0, 50);
    const removed = list(b.removed).slice(0, 50);

    const ul = items => '<ul style="margin:4px 0 12px 18px;padding:0;">' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
    let body = '';
    body += '<p><strong>' + esc(depot) + '</strong>, week commencing <strong>' + uk(weekStart) + '</strong>.</p>';
    body += '<p>' + (b.resubmit ? 'Resubmitted' : 'Submitted') + ' by ' + esc(by) + '. ' + esc(b.total) + ' drivers on the rota. It is live now.</p>';

    if (starters.length) {
      body += '<p><strong>Starters</strong></p>' + ul(starters.map(s =>
        esc(s.name) + ', first day ' + uk(s.date) + (s.onRegister ? ' (already on the driver register)' : '. <strong>Action: add to the driver register with a PIN before their first day.</strong>')));
    }
    if (leavers.length) {
      body += '<p><strong>Leavers</strong></p>' + ul(leavers.map(l =>
        esc(l.name) + ', last day ' + uk(l.date) + '. Action: set their register entry to inactive after their last day.'));
    }
    if (added.length || removed.length) {
      body += '<p><strong>Changes compared with ' + esc(b.comparedTo || 'the earlier rota') + '</strong></p>';
      if (added.length) body += '<p style="margin:0;">Added:</p>' + ul(added.map(esc));
      if (removed.length) body += '<p style="margin:0;">Removed:</p>' + ul(removed.map(esc));
    }
    if (!starters.length && !leavers.length && !added.length && !removed.length) {
      body += '<p>No starters, leavers or driver changes.</p>';
    }

    const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2430;">' + body +
      '<p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">Sent by the KBAN Weekly Rota page, kban-web.vercel.app</p></div>';

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY is not set' });
    }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KBAN Ops <ops@send.kbanlogistics.co.uk>',
        to: ['daniel@kbanlogistics.co.uk'],
        subject: 'Rota ' + (b.resubmit ? 'updated' : 'submitted') + ': ' + depot + ' w/c ' + uk(weekStart),
        html,
      }),
    });
    if (!r.ok) {
      console.error('Resend error:', r.status, await r.text());
      return res.status(502).json({ error: 'Email service refused the message' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Rota notify error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
};
