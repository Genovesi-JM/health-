"""Limited working-tree pattern scan; emits locations, never matched values.

This is not a history, entropy, vendor validation, or comprehensive secret scan.
"""
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
patterns = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'github-token': re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
    'aws-access-key': re.compile(r'\bAKIA[A-Z0-9]{16}\b'),
    'stripe-live-key': re.compile(r'\bsk_live_[A-Za-z0-9]{16,}\b'),
    'openai-key-shape': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b'),
}
findings = []
scanned = 0
for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0'):
    path = root / name
    if not name or not path.is_file() or path.suffix in {'.db', '.sqlite', '.sqlite3'} or name == 'backend/email_log.txt':
        continue
    try:
        data = path.read_text()
    except UnicodeError:
        continue
    scanned += 1
    for line, value in enumerate(data.splitlines(), 1):
        for kind, pattern in patterns.items():
            if pattern.search(value):
                findings.append({'path': name, 'line': line, 'pattern': kind})
print(json.dumps({'scope': 'tracked working-tree text excluding data/logs; no history; five patterns only', 'scanned_files': scanned, 'findings': findings}, indent=2))
raise SystemExit(bool(findings))
