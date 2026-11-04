"""Explicit synthetic request-expiry worker; no scheduler/provider activation.

Run from an isolated reviewed snapshot with:
python -m app.expire_consultation_requests --limit 100
"""
import argparse
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error('limit must be between 1 and 1000')
    if (os.environ.get('ENV') != 'test' or os.environ.get('KAYA_EXECUTION_MODE') != 'synthetic'
            or (Path(__file__).resolve().parents[1] / '.env').exists()):
        parser.error('Clinical launch is on HOLD. Use an isolated synthetic workspace with ENV=test and no backend/.env.')
    from app import database
    from app.services.request_expiry import sweep
    database.init_db_engine()
    with database.SessionLocal() as db:
        result = sweep(db, limit=args.limit)
    print(json.dumps(result, sort_keys=True))
    return 1 if result['failed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
