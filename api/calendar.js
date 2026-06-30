export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();
    const msToken = process.env.MS_GRAPH_TOKEN;
    async function getEvents(start, end) {
      const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$select=subject,start,end,location&$orderby=start/dateTime&$top=10`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${msToken}`, 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error(`Graph API error: ${r.status}`);
cd ~/Downloads/kban-web && vercel --prod
cd ~/Downloads/kban-web && vercel --prod
