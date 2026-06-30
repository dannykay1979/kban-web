const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function query(method, path, body) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) { const err = await resp.text(); throw new Error(err); }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    if (req.method === 'GET') {
      const data = await query('GET', '/tasks?order=created_at.asc');
      return res.status(200).json(data || []);
    }
    if (req.method === 'POST') {
      const t = req.body;
      const data = await query('POST', '/tasks', {id:t.id,cat:t.cat,title:t.title,note:t.note||null,priority:t.priority||'normal',due:t.due||null,done:t.done||false,recur:t.recur||null,done_at:t.doneAt||null});
      return res.status(201).json(data);
    }
    if (req.method === 'PATCH') {
      const {id,...u} = req.body;
      const m={updated_at:new Date().toISOString()};
      if('done' in u) m.done=u.done;
      if('doneAt' in u) m.done_at=u.doneAt;
      if('title' in u) m.title=u.title;
      if('priority' in u) m.priority=u.priority;
      if('due' in u) m.due=u.due;
      if('recur' in u) m.recur=u.recur;
      if('cat' in u) m.cat=u.cat;
      if('note' in u) m.note=u.note;
      await query('PATCH', `/tasks?id=eq.${id}`, m);
      return res.status(200).json({ok:true});
    }
    if (req.method === 'DELETE') {
      const {id,clearDone} = req.body;
      if(clearDone) await query('DELETE', '/tasks?done=eq.true');
      else await query('DELETE', `/tasks?id=eq.${id}`);
      return res.status(200).json({ok:true});
    }
    return res.status(405).end();
  } catch(err) { return res.status(500).json({error:err.message}); }
}
