"""Run an isolated, synthetic accounts-schema migration check."""
import sys,types,tempfile,pathlib,json
from unittest.mock import patch
from sqlalchemy import create_engine,inspect,text
from alembic.config import Config
from alembic import command
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
with tempfile.TemporaryDirectory(prefix='kaya-accounts-test-') as temp:
 path=pathlib.Path(temp).resolve()/'accounts.sqlite';config_module=types.ModuleType('app.config');config_module.settings=types.SimpleNamespace(accounts_database_url='sqlite:///'+str(path))
 with patch.dict(sys.modules,{'app.config':config_module}):
  from app.accounts.database import AccountsBase
  from app.accounts import models
  config=Config(str(root/'accounts_alembic.ini'));config.set_main_option('script_location',str(root/'accounts_alembic'))
  command.upgrade(config,'head');command.upgrade(config,'head')
  engine=create_engine('sqlite:///'+str(path))
  with engine.connect() as connection:
   actual=inspect(connection);tables=set(actual.get_table_names());assert tables=={'customer_accounts','employees','alembic_version'}
   for name,table in AccountsBase.metadata.tables.items():assert set(table.columns.keys())=={c['name'] for c in actual.get_columns(name)}
   head=connection.execute(text('SELECT version_num FROM alembic_version')).scalar();assert head=='kaya_accounts_20261104_v1'
   assert connection.execute(text('SELECT COUNT(*) FROM customer_accounts')).scalar()==0
   assert connection.execute(text('SELECT COUNT(*) FROM employees')).scalar()==0
   result={'tests':['clean upgrade','idempotent second upgrade','all model columns present','no seeded records'],'passed':True,'tables':sorted(tables),'head':head}
  engine.dispose()
print(json.dumps(result))
