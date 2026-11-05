"""Run only by an explicit, one-off private staging job execution."""
import argparse
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['KAYA_MANAGED_SCHEMA'] = 'true'
parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=('check', 'rehearse', 'apply'))
args = parser.parse_args()
try:
    from app.staging_schema import run
    print('KAYA_SCHEMA_RESULT=' + json.dumps(run(args.mode), sort_keys=True), flush=True)
except Exception as exc:
    # Do not let SQLAlchemy tracebacks print URLs, SQL parameters or credentials.
    print('KAYA_SCHEMA_FAILURE=' + type(exc).__name__, flush=True)
    raise SystemExit(1)
