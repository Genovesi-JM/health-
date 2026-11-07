"""Audit every pinned dependency in the Phase 0 lock; no application imports.

Run with an isolated Python environment containing pip-audit 2.10.0 or newer.
Uses the public Python package advisory service, sending package metadata only.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
lock = repo / 'backend/requirements.phase0.lock'
command = [sys.executable, '-m', 'pip_audit', '-r', str(lock), '--no-deps', '--disable-pip', '--format', 'json']
result = subprocess.run(command, capture_output=True, text=True, timeout=180)
try:
    report = json.loads(result.stdout)
except json.JSONDecodeError:
    raise SystemExit('Dependency audit did not produce JSON: ' + result.stderr[-800:])
args.output.mkdir(parents=True, exist_ok=True)
(args.output / 'backend-audit.json').write_text(json.dumps(report, indent=2) + '\n')
packages = report.get('dependencies', [])
summary = {
    'command': command, 'exit_code': result.returncode, 'lock_sha256': hashlib.sha256(lock.read_bytes()).hexdigest(),
    'scope': 'Complete resolved Phase 0 lock, including deployment requirements, test packages, and transitive dependencies; not a built production image audit',
    'package_count': len(packages), 'affected_packages': sum(bool(x.get('vulns')) for x in packages),
    'advisory_entries': sum(len(x.get('vulns', [])) for x in packages),
    'skipped_packages': [x.get('name') for x in packages if x.get('skip_reason')],
    'audit_version': subprocess.check_output([sys.executable, '-m', 'pip_audit', '--version'], text=True).strip(),
}
(args.output / 'backend-audit-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
# Findings are evidence; errors or skipped packages make measurement incomplete.
raise SystemExit(0 if result.returncode in (0, 1) and not summary['skipped_packages'] else 1)
