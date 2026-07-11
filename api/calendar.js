module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;

  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Calendar not configured' });
  }

  try {
    // Client credentials flow — app-only, reads daniel@kbanlogistics.co.uk calendar
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          scope:         'https://graph.microsoft.com/.default',
          grant_type:    'client_credentials'
        })
      }
    );
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token error ${tokenRes.status}: ${err}`);
    }
    const { access_token } = await tokenRes.json();

    const now = new Date();
    const pad = (d) => d.toISOString();
    const todayStart    = pad(new Date(now.getFullYear(), now.getMonth(), now.getDate(),  0,  0,  0));
    const todayEnd      = pad(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
    const tomorrowStart = pad(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1,  0,  0,  0));
    const tomorrowEnd   = pad(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59));

    async function getEvents(start, end) {
      const url = `https://graph.microsoft.com/v1.0/users/daniel@kbanlogistics.co.uk/calendarView` +
        `?startDateTime=${start}&endDateTime=${end}` +
        `&$select=subject,start,end,location&$orderby=start/dateTime&$top=10`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
      });
      if (!r.ok) {
        const errText = await r.text();
        throw new Error(`Graph API error: ${r.status} ${errText}`);
      }
      const d = await r.json();
      return (d.value || []).map(ev => ({
        subject:  ev.subject || '(No title)',
        start:    ev.start?.dateTime || ev.start?.date || '',
        end:      ev.end?.dateTime   || ev.end?.date   || '',
        location: ev.location?.displayName || ''
      }));
    }

    const [today, tomorrow] = await Promise.all([
      getEvents(todayStart, todayEnd),
      getEvents(tomorrowStart, tomorrowEnd)
    ]);

    return res.status(200).json({ today, tomorrow });
  } catch (err) {
    console.error('Calendar error:', err.message);
    return res.status(500).json({ error: 'Calendar unavailable', detail: err.message });
  }
};
