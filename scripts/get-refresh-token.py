#!/usr/bin/env python3
"""
MS Graph Device Code Auth — run this once to get a refresh token for the calendar.
It will print a code and URL; visit the URL, sign in as Danny, and enter the code.
The refresh token will be output at the end — copy it into Vercel as MS_REFRESH_TOKEN.
"""

import json, time, urllib.request, urllib.parse, sys

CLIENT_ID = "7bff0e67-3a16-4170-b50d-6b3fbb8fc7f2"
TENANT_ID = "1bd43144-c334-44ab-a055-a9dcccafc82b"
SCOPE     = "https://graph.microsoft.com/Calendars.Read offline_access"

def post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req  = urllib.request.Request(url, data=body, method="POST",
                                  headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Step 1: request device code
print("=== KBAN MS Graph Auth ===\n")
dc = post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/devicecode",
    {"client_id": CLIENT_ID, "scope": SCOPE}
)

print(f"1. Open this URL in your browser:\n   {dc['verification_uri']}\n")
print(f"2. Enter this code when prompted:\n\n   >>> {dc['user_code']} <<<\n")
print(f"3. Sign in as danny@kbanlogistics.co.uk\n")
print("Waiting for you to complete sign-in", end="", flush=True)

interval = int(dc.get("interval", 5))
expires  = time.time() + int(dc.get("expires_in", 900))

while time.time() < expires:
    time.sleep(interval)
    print(".", end="", flush=True)
    try:
        token = post(
            f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
            {
                "client_id":   CLIENT_ID,
                "grant_type":  "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": dc["device_code"]
            }
        )
        if "refresh_token" in token:
            print("\n\n=== SUCCESS ===")
            print("\nRefresh token (copy this into Vercel as MS_REFRESH_TOKEN):\n")
            print(token["refresh_token"])
            print("\nAccess token (for testing, expires in 1 hour):")
            print(token["access_token"][:80] + "...")
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
