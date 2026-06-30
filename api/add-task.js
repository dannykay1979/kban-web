const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CATS = ['finance','operations','fleet','insurance','people','drivers','systems','commercial'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  const parseResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},
    body: JSON.stringify({model:'claude-sonnet-4-6',max_tokens:200,messages:[{role:'user',content:`Extract task details from this text and return ONLY a JSON object with no other text:\nText: "${text}"\nCategories: ${CATS.join(', ')}\nReturn JSON: {"title":"task title","cat":"category","priority":"high or normal","due":"YYYY-MM-DD or null","note":"brief note or null"}\nToday is ${new Date().toISOString().split('T')[0]}`}]})
  });
  const parseData = await parseResp.json();
  let task;
  try { task = JSON.parse(parseData.content[0].text.replace(/```json|```/g,'').trim()); }
  catch(e) { return res.status(400).json({ error: 'Could not parse task' }); }
  const newTask = {id:'t'+Date.now(),cat:CATS.includes(task.cat)?task.cat:'systems',title:task.title,note:task.note||null,priority:task.priority||'normal',due:task.due||null,done:false,recur:null,done_at:null};
  const dbResp = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers: {'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=representation'},
    body: JSON.stringify(newTask)
  });
  if (!dbResp.ok) { const err = await dbResp.text(); return res.status(500).json({ error: err }); }
  return res.status(201).json({ task: newTask });
}
