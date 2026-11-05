"""No cloud access: managed schema imports, migration graph and HOLD regression."""
import os
import subprocess
import sys
from pathlib import Path
from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]


def clean_env():
    return {'PATH': os.environ['PATH'], 'ENV': 'test', 'KAYA_MANAGED_SCHEMA': 'true',
            'DATABASE_URL': 'sqlite://', 'ACCOUNTS_DATABASE_URL': 'sqlite://',
            'SECRET_KEY': 'synthetic-schema-regression-not-production'}


def test_managed_import_and_engine_never_create_or_repair_tables():
    source = '''
from unittest.mock import patch
from app import database
with patch.object(database.Base.metadata, 'create_all', side_effect=AssertionError('DDL')):
    database.init_db_engine('sqlite://')
    database.ensure_legacy_schema()
    database.ensure_user_role_column()
from sqlalchemy import inspect
assert inspect(database.engine).get_table_names() == []
'''
    subprocess.run([sys.executable, '-c', source], cwd=ROOT, env=clean_env(), check=True)


def test_history_has_one_head_and_preserves_both_branches():
    cfg = Config(str(ROOT / 'alembic.ini'))
    cfg.set_main_option('script_location', str(ROOT / 'alembic'))
    graph = ScriptDirectory.from_config(cfg)
    assert graph.get_heads() == ['contact_messages_v1']
    history = {r.revision for r in graph.walk_revisions()}
    assert {'reconcile_model_columns_v1', 'reconcile_db_extra_cols_v1',
            'clinical_document_requests_v1', 'appointment_slots_v1'} <= history


def test_default_still_holds_clinical_routes():
    source = '''
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
for path in ('/health', '/ready', '/docs', '/openapi.json', '/auth/register', '/api/v1/consultations'):
    assert client.get(path).status_code == 503
    assert client.post(path).status_code == 503
assert client.get('/api/v1/public/pilot-scope').status_code == 200
'''
    subprocess.run([sys.executable, '-c', source], cwd=ROOT, env=clean_env(), check=True)


def test_password_redaction_does_not_replace_an_initialized_engine():
    source = '''
from app import database
url = 'postgresql://synthetic:unused-test-password@127.0.0.1:1/kaya_test_never_connect'
database.init_db_engine(url)
original = database.engine
database.init_db_engine(url)
assert database.engine is original
'''
    subprocess.run([sys.executable, '-c', source], cwd=ROOT, env=clean_env(), check=True)


def test_deployment_guard_rejects_external_ingress_and_entrypoint_overrides():
    import importlib.util
    import copy
    import pytest
    spec = importlib.util.spec_from_file_location('hold_guard', ROOT.parent / 'infra/azure/check_staging_hold.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    app = {'name':'ca-kaya-staging-api','properties':{
        'configuration':{'ingress':{'external':False,'targetPort':8000}},
        'template':{'containers':[{'command':[], 'args':[], 'env':[],
                                  'probes':[{'tcpSocket':{'port':8000}}]}]}}}
    assert module.validate(app)
    external=copy.deepcopy(app);external['properties']['configuration']['ingress']['external']=True
    command=copy.deepcopy(app);command['properties']['template']['containers'][0]['command']=['gunicorn','app.operational:app']
    mode=copy.deepcopy(app);mode['properties']['template']['containers'][0]['env']=[{'name':'KAYA_EXECUTION_MODE','value':'synthetic'}]
    for unsafe in (external,command,mode):
        with pytest.raises(ValueError): module.validate(unsafe)
