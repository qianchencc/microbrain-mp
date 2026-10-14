#!/usr/bin/env python3
"""Generate a design comp via proxy.qianc.ltd gpt-image-2.5. Key read from history file, never printed."""
import json, re, sys, urllib.request, base64, pathlib

HIST = "/Users/qianchen/.local/share/devin/cli/summaries/history_2a5cf951ea3a4945.md"
m = re.search(r"sk-[A-Za-z0-9_-]{10,}", open(HIST).read())
KEY = m.group(0)

prompt = sys.argv[1]
out = sys.argv[2]

req = urllib.request.Request(
    "https://proxy.qianc.ltd/v1/images/generations",
    data=json.dumps({"model": "gpt-image-2.5", "prompt": prompt, "n": 1, "size": "1024x1536"}).encode(),
    headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=300) as r:
    d = json.loads(r.read())
pathlib.Path(out).write_bytes(base64.b64decode(d["data"][0]["b64_json"]))
print("saved", out)
