# KBAN Dashboard

Morning brief dashboard with automated daily email.

## Setup — takes about 20 minutes

### 1. Anthropic API key
- Go to platform.anthropic.com
- Sign in, go to API Keys, create a key called "KBAN Dashboard"
- Copy it — you only see it once

### 2. Resend account (free email service)
- Go to resend.com and sign up
- Go to API Keys and create a key called "KBAN"
- Copy it

### 3. Deploy to Vercel
- Go to vercel.com, sign in with Microsoft
- Click "Add New Project"
- Choose "Upload" and drag this entire kban-web folder in
- Vercel will detect it automatically and deploy

### 4. Add environment variables in Vercel
In your Vercel project, go to Settings > Environment Variables and add:

| Variable | Value |
|---|---|
| ANTHROPIC_API_KEY | your Anthropic key |
| RESEND_API_KEY | your Resend key |
| CRON_SECRET | any random string e.g. kban2026secure |
| BRIEF_TO_EMAIL | daniel@kbanlogistics.co.uk |
| DASHBOARD_URL | your Vercel URL e.g. https://kban-dashboard.vercel.app |

### 5. Done
- Your dashboard is live at your Vercel URL
- The email goes out every morning at 6:30am BST automatically
- It contains a button that links directly to your dashboard with the brief pre-loaded
- Works on Mac, PC, iPhone — any browser

## Stage 2 additions
- Microsoft Graph integration (live Outlook emails and calendar in the brief)
- Team logins (Wayne and Jack get their own dashboards)
- Director view (Danny sees all team task statuses)
