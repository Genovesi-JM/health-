"""Run clean backend and client Phase 0 measurements in a new output directory.

Python 3.12 and Node/npm are required. Application check failures are recorded;
this runner does not imply clinical readiness or authorize phase progression.
Use kaya_phase0_audit.py and kaya_phase0_gitleaks.py for separate security scans.
"""
import argparse
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
args = parser.parse_args()
root = args.output.resolve()
repo = Path(__file__).resolve().parents[1]
if root == repo or repo in root.parents or (root.exists() and any(root.iterdir())):
    parser.error('Use a new empty directory outside the repository')
root.mkdir(parents=True, exist_ok=True)
subprocess.run([sys.executable, str(repo / 'scripts/kaya_phase0_backend.py'), str(root / 'backend')], check=True, timeout=1500)
subprocess.run([sys.executable, str(repo / 'scripts/kaya_phase0_clients.py'), '--work', str(root / 'clients'), '--evidence', str(root / 'client-evidence')], check=True, timeout=1500)
print('Measurement complete. Inspect every check result; this is not a release approval.')
