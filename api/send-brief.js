export default async function handler(req, res) {
  // Vercel cron jobs send a GET request. Verify the secret to prevent abuse.
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.BRIEF_TO_EMAIL || 'daniel@kbanlogistics.co.uk';
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://kban-dashboard.vercel.app';

  if (!apiKey || !resendKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  // Build a basic task summary (tasks stored server-side in Stage 2 via DB)
  // For now, generate a general KBAN morning prompt
  const today = new Date().toISOString().split('T')[0];
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });

  const prompt = `You are the morning brief assistant for KBAN Logistics Ltd, a UK last-mile parcel delivery company. Generate a concise morning brief for the director, Danny Kay.

Today is ${dayName} ${today}.

KBAN operates across DHL eCommerce Middleton, DHL eCommerce Runcorn, DPD Aberdeen, DPD Edinburgh, and FedEx Preston. The business has approximately 54 leased vehicles and 104 driver records.

Generate a brief morning summary covering:
1. A professional good morning greeting with the date
2. A reminder that their full task tracker and detailed brief is available on the dashboard
3. Key operational reminders relevant to a last-mile delivery business on a ${dayName} (payroll, driver compliance, route coverage, client SLAs)
4. A prompt to check in on any overdue items

Keep it under 200 words. Friendly, direct, UK English. End with a link prompt: "Open your dashboard for your full task list and brief."`;

  try {
    // Generate brief via Claude
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeResp.ok) throw new Error('Claude API error');
    const claudeData = await claudeResp.json();
    const briefText = claudeData.content?.[0]?.text || 'Good morning. Your dashboard is ready.';

    // Send email via Resend
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'KBAN Brief <brief@kbanlogistics.co.uk>',
        to: toEmail,
        subject: `KBAN Morning Brief — ${today}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <div style="background:#0B2E4E;padding:16px 24px;border-radius:8px 8px 0 0;">
              <span style="font-family:Arial,sans-serif;font-weight:700;font-size:20px;color:#fff;letter-spacing:-0.02em;">KBAN<span style="color:#2E83F0;">.</span></span>
              <span style="font-size:12px;color:rgba(255,255,255,0.4);margin-left:12px;font-family:monospace;">${today}</span>
            </div>
            <div style="background:#fff;border:1px solid #e8edf2;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <p style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#0B2E4E;">${briefText}</p>
              <div style="margin-top:24px;text-align:center;">
                <a href="${dashboardUrl}?autobrief=1" style="display:inline-block;background:#2E83F0;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">Open dashboard</a>
              </div>
              <p style="margin-top:20px;font-size:11px;color:#9ab0c4;text-align:center;">KBAN Logistics Ltd · Radcliffe, Manchester</p>
            </div>
          </div>`,
      }),
    });

    if (!emailResp.ok) {
      const emailErr = await emailResp.json();
      throw new Error(`Email error: ${emailErr.message}`);
    }

    return res.status(200).json({ success: true, date: today });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
