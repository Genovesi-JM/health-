import os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['KAYA_MANAGED_SCHEMA']='true'
try:
    from app.azure_release import migrate
    migrate()
except Exception as exc:
    print('KAYA_MIGRATION_FAILED '+type(exc).__name__+'; no runtime release permitted.',flush=True)
    raise SystemExit(1)
