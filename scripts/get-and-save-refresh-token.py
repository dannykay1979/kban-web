#!/usr/bin/env python3
"""
MS Graph Device Code Auth — gets refresh token AND adds it to Vercel automatically.
Run this once. Visit microsoft.com/devicelogin, enter the code, sign in as Danny.
"""

import json, time, urllib.request, urllib.parse, sys, subprocess, os

CLIENT_ID   = "7bff0e67-3a16-4170-b50d-6b3fbb8fc7f2"
TENANT_ID   = "1bd43144-c334-44ab-a055-a9dcccafc82b"
SCOPE       = "https://graph.microsoft.com/Calendars.Read offline_access"
VERCEL_AUTH = os.path.expanduser("~/Library/Application Support/com.vercel.cli/auth.json")

def post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req  = urllib.request.Request(url, data=body, method="POST",
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def add_vercel_env(key, value):
    with open(VERCEL_AUTH) as f:
        auth = json.load(f)
    token = auth["token"]

    # Get team ID
    req = urllib.request.Request(
        "https://api.vercel.com/v2/teams?slug=kban",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        teams = json.loads(r.read())
    team_id = (teams.get("teams") or [{}])[0].get("id", "")
    team_param = f"?teamId={team_id}" if team_id else ""

    body = json.dumps({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": ["production", "preview", "development"]
    }).encode()
    req2 = urllib.request.Request(
        f"https://api.vercel.com/v10/projects/kban-web/env{team_param}",
        data=body, method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req2) as r:
            result = json.loads(r.read())
        return result.get("key") == key
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        # If already exists, update it
        if err.get("error") == "ENV_ALREADY_EXISTS":
            env_id = err.get("id") or ""
            # Delete and recreate
            req3 = urllib.request.Request(
                f"https://api.vercel.com/v10/projects/kban-web/env/{env_id}{team_param}",
                method="DELETE",
                headers={"Authorization": f"Bearer {token}"}
            )
            try:
                urllib.request.urlopen(req3)
            except:
                pass
            # Recreate
            req4 = urllib.request.Request(
                f"https://api.vercel.com/v10/projects/kban-web/env{team_param}",
                data=body, method="POST",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req4) as r:
                result = json.loads(r.read())
            return result.get("key") == key
        return False

# Step 1: request device code
print("=== KBAN MS Graph Auth — Get & Save Refresh Token ===\n")
dc = post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/devicecode",
    {"client_id": CLIENT_ID, "scope": SCOPE}
)

print(f"1. Open this URL in your browser:\n   {dc['verification_uri']}\n")
print(f"2. Enter this code when prompted:\n\n   >>> {dc['user_code']} <<<\n")
print(f"3. Sign in as danny@kbanlogistics.co.uk\n")
print("Waiting for sign-in", end="", flush=True)

interval = int(dc.get("interval", 5))
expires  = time.time() + int(dc.get("expires_in", 900))

while time.time() < expires:
    time.sleep(interval)
    print(".", end="", flush=True)
    try:
        token_resp = post(
            f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
            {
                "client_id":   CLIENT_ID,
                "grant_type":  "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": dc["device_code"]
            }
        )
        if "refresh_token" in token_resp:
            refresh_token = token_resp["refresh_token"]
            print("\n\n=== Sign-in complete! Saving to Vercel... ===\n")

            # Save to local file as backup
            backup_path = os.path.expanduser("~/Downloads/ms_refresh_token_backup.txt")
            with open(backup_path, "w") as f:
                f.write(refresh_token)
            print(f"Backup saved to: {backup_path}")

            # Add to Vercel
            ok = add_vercel_env("MS_REFRESH_TOKEN", refresh_token)
            if ok:
                print("MS_REFRESH_TOKEN added to Vercel successfully!")
            else:
                print("WARNING: Could not add to Vercel automatically.")
                print("Refresh token saved to backup file above — add it manually.")

            print("\n=== DONE. Calendar panel is ready. ===")
            sys.exit(0)
    except urllib.error.HTTPError as e:
        body = json.loads(e.read())
        err  = body.get("error", "")
        if err == "authorization_pending":
            continue
        elif err == "slow_down":
            interval += 5
            continue
        else:
            print(f"\nError: {body}")
            sys.exit(1)

print("\nTimed out. Please run the script again.")
sys.exit(1)
