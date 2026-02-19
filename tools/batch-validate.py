#!/usr/bin/env python3
"""Batch validate DOCX files and print summary."""
import subprocess
import json
import sys
import os
import glob

output_dir = "output"
files = sorted(glob.glob(os.path.join(output_dir, "*_v1.0.docx")))

print(f"Found {len(files)} files to validate\n")
print(f"{'File':<45} {'Pages':>5} {'WARN':>5} {'INFO':>5}")
print("-" * 65)

for f in files:
    name = os.path.basename(f)
    try:
        result = subprocess.run(
            ["python", "-X", "utf8", "tools/validate-docx.py", f, "--json"],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "PYTHONUTF8": "1"}
        )
        # Find JSON in stdout
        stdout = result.stdout.strip()
        if not stdout:
            stdout = result.stderr.strip()

        # Try to find JSON start
        json_start = stdout.find('{')
        if json_start >= 0:
            data = json.loads(stdout[json_start:])
            pages = data.get('stats', {}).get('estimatedPages', '?')
            issues = data.get('issues', [])
            warns = sum(1 for i in issues if i.get('severity') == 'WARN')
            infos = sum(1 for i in issues if i.get('severity') == 'INFO')
            print(f"{name:<45} {pages:>5} {warns:>5} {infos:>5}")
        else:
            print(f"{name:<45} {'ERR':>5} {'?':>5} {'?':>5}")
    except Exception as e:
        print(f"{name:<45} {'ERR':>5} {str(e)[:20]}")
