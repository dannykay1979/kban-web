const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      depot,
      date,
      submittedBy,
      drivers = [],
      bayAvailable,
      sortationComplete,
      notes,
    } = req.body;

    const driverRows = drivers.length
      ? drivers
          .map(
            (d) =>
              `<tr>
                <td style="padding:4px 8px;border:1px solid #ddd;">${d.name || ''}</td>
                <td style="padding:4px 8px;border:1px solid #ddd;">${d.status || 'Worked'}</td>
                <td style="padding:4px 8px;border:1px solid #ddd;">${d.notes || ''}</td>
              </tr>`
          )
          .join('')
      : '<tr><td colspan="3" style="padding:4px 8px;border:1px solid #ddd;color:#888;">No drivers recorded</td></tr>';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#1a3a5c;padding:16px 24px;border-radius:6px 6px 0 0;">
          <h2 style="color:#fff;margin:0;font-size:18px;">KBAN Daily Ops Sheet</h2>
          <p style="color:#adc8e8;margin:4px 0 0;">${depot} &mdash; ${date}</p>
        </div>
        <div style="border:1px solid #ddd;border-top:none;padding:20px 24px;border-radius:0 0 6px 6px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:6px 0;color:#555;width:180px;"><strong>Submitted by</strong></td>
              <td style="padding:6px 0;">${submittedBy || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555;"><strong>Bay available on arrival</strong></td>
              <td style="padding:6px 0;">${bayAvailable || 'Not recorded'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555;"><strong>Sortation before dispatch</strong></td>
              <td style="padding:6px 0;">${sortationComplete || 'Not recorded'}</td>
            </tr>
          </table>
          <h3 style="font-size:14px;color:#1a3a5c;border-bottom:1px solid #eee;padding-bottom:6px;">Drivers</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Name</th>
                <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Status</th>
                <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Notes</th>
              </tr>
            </thead>
            <tbody>${driverRows}</tbody>
          </table>
          ${notes ? `<h3 style="font-size:14px;color:#1a3a5c;border-bottom:1px solid #eee;padding-bottom:6px;">Other Notes</h3><p style="white-space:pre-wrap;font-size:13px;color:#333;">${notes}</p>` : ''}
          <p style="font-size:11px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">
            Submitted via KBAN Daily Ops Dashboard &mdash; kban-web.vercel.app
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: 'KBAN Ops <ops@send.kbanlogistics.co.uk>',
      to: [
        'daniel@kbanlogistics.co.uk',
        process.env.WAYNE_EMAIL || 'wayne@kbanlogistics.co.uk',
      ],
      subject: `Daily Ops: ${depot} — ${date}`,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notify error:', error);
    return res.status(500).json({ error: 'Failed to send notification', detail: error.message });
  }
};
