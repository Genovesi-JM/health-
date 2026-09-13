"""Build a clean pinned Phase 0 environment and measure the synthetic baseline.

Requires Python 3.12. No live runtime or operator dotenv/database is imported.
The output directory must be new and outside the repository.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
SNAPSHOT_PATHS = ['backend', 'infra', 'docker-compose.yml', 'docker-compose.prod.yml', 'render.yaml', '.github/workflows/deploy.yml', 'deploy']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_source(name):
    p = Path(name)
    reviewed_type = p.suffix in {'.py', '.mako', '.md', '.json', '.ini', '.bicep', '.yaml', '.yml', '.sh', '.in', '.lock'} or p.name in {'Dockerfile', '.dockerignore', 'README'} or (p.name.startswith('requirements') and p.suffix == '.txt')
    return (reviewed_type and not p.name.startswith('.env') and p.suffix not in {'.db', '.sqlite', '.sqlite3', '.log', '.pyc'}
            and p.name != 'email_log.txt' and not {'uploads', '__pycache__', 'node_modules'} & set(p.parts))


def run(name, command, cwd, env, output, seconds):
    started = time.monotonic()
    log = output / (name + '.log')
    timed_out = False
    with log.open('w') as handle:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            code = 124
    result = {'command': command, 'cwd': str(cwd), 'timeout_seconds': seconds,
              'exit_code': code, 'timed_out': timed_out, 'elapsed_seconds': round(time.monotonic() - started, 2),
              'log_sha256': digest(log)}
    junit = output / (name + '.xml')
    if junit.exists():
        suites = ET.parse(junit).getroot()
        records = list(suites.iter('testsuite'))
        result['junit'] = {k: sum(int(x.attrib.get(k, 0)) for x in records) for k in ['tests', 'failures', 'errors', 'skipped']}
        result['failed_cases'] = [x.attrib.get('classname', '') + '::' + x.attrib.get('name', '')
                                  for x in suites.iter('testcase') if x.find('failure') is not None or x.find('error') is not None]
    print(name + ': ' + json.dumps(result.get('junit', {'exit_code': code})), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--source-revision', help='Optional existing git ref for a before-change comparison')
    parser.add_argument('--venv', type=Path, help='Reuse only a Phase 0 environment with the identical lock digest')
    parser.add_argument('--checks', nargs='+', default=['backend-full', 'backend-focused', 'launch-hold', 'migration-heads', 'infrastructure'])
    args = parser.parse_args()
    if args.source_revision:
        args.source_revision = subprocess.check_output(['git', 'rev-parse', args.source_revision + '^{commit}'], cwd=REPO, text=True).strip()
    if sys.version_info[:2] != (3, 12):
        raise SystemExit('Run with Python 3.12; this baseline lock is measured on Python 3.12')
    output = args.output.resolve()
    if output == REPO or REPO in output.parents or (output.exists() and any(output.iterdir())):
        raise SystemExit('Use a new empty output directory outside the repository')
    output.mkdir(parents=True, exist_ok=True)
    source = output / 'source'
    source.mkdir()
    results_dir = output / 'results'
    results_dir.mkdir()
    for part in ['home', 'tmp', 'state']:
        (output / part).mkdir()
    if args.source_revision:
        names = subprocess.check_output(['git', 'ls-tree', '-rz', '--name-only', args.source_revision, '--', *SNAPSHOT_PATHS], cwd=REPO).decode().split('\0')
    else:
        names = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', *SNAPSHOT_PATHS], cwd=REPO).decode().split('\0')
    copied = {}
    for name in sorted(set(names)):
        if not name or not safe_source(name):
            continue
        target = source / name
        if not args.source_revision and ((REPO / name).is_symlink() or any(parent.is_symlink() for parent in (REPO / name).parents if parent != REPO)):
            raise SystemExit('Refusing symlink in source snapshot: ' + name)
        if not args.source_revision and not (REPO / name).is_file():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if args.source_revision:
            target.write_bytes(subprocess.check_output(['git', 'show', args.source_revision + ':' + name], cwd=REPO))
        else:
            shutil.copy2(REPO / name, target)
        copied[name] = digest(target)
    # Use the exact same locked dependency set for current and original source.
    lock = REPO / 'backend' / 'requirements.phase0.lock'
    shutil.copy2(lock, output / lock.name)
    lock = output / lock.name
    lock_hash = digest(lock)
    env = {'PATH': os.environ['PATH'], 'HOME': str(output / 'home'), 'TMPDIR': str(output / 'tmp'),
           'LANG': 'en_US.UTF-8', 'PYTHONNOUSERSITE': '1', 'PYTHONDONTWRITEBYTECODE': '1',
           'PYTEST_DISABLE_PLUGIN_AUTOLOAD': '1', 'ENV': 'test', 'KAYA_EXECUTION_MODE': 'synthetic',
           'KAYA_PHASE0_WORKSPACE': str(output), 'KAYA_DISABLE_RATE_LIMIT': '1',
           'SECRET_KEY': 'phase0-synthetic-signing-key-not-for-production',
           'DATABASE_URL': 'sqlite:///' + str(output / 'state' / 'main.db'),
           'ACCOUNTS_DATABASE_URL': 'sqlite:///' + str(output / 'state' / 'accounts.db')}
    venv = args.venv.resolve() if args.venv else output / 'venv'
    python = venv / 'bin' / 'python'
    marker = venv / 'phase0-lock.sha256'
    results = {}
    if args.venv:
        if not marker.exists() or marker.read_text().strip() != lock_hash:
            raise SystemExit('Reusable environment was not created with this Phase 0 lock')
    else:
        subprocess.run([sys.executable, '-m', 'venv', str(venv)], check=True, env=env, timeout=60)
        results['clean-install'] = run('clean-install', [str(python), '-m', 'pip', '--isolated', 'install', '--index-url', 'https://pypi.org/simple', '--require-hashes', '-r', str(lock), '--report', str(results_dir / 'install-report.json')], source, env, results_dir, 240)
        if results['clean-install']['exit_code']:
            (results_dir / 'summary.json').write_text(json.dumps(results, indent=2) + '\n')
            return 1
        marker.write_text(lock_hash + '\n')
    installed = json.loads(subprocess.check_output([str(python), '-c', 'import importlib.metadata as m,json; print(json.dumps({d.metadata["Name"]:d.version for d in m.distributions()}))'], env=env, text=True))
    normalized = {re.sub(r'[-_.]+', '-', key).lower(): value for key, value in installed.items()}
    expected = {re.sub(r'[-_.]+', '-', key).lower(): value for key, value in re.findall(r'^([A-Za-z0-9_.-]+)==([^\s;]+)', lock.read_text(), re.M)}
    mismatch = {key: {'expected': value, 'installed': normalized.get(key)} for key, value in expected.items() if normalized.get(key) != value}
    extra = sorted(set(normalized) - set(expected) - {'pip', 'setuptools'})
    (results_dir / 'installed-packages.json').write_text(json.dumps(installed, indent=2) + '\n')
    if mismatch or extra:
        raise SystemExit('Environment differs from lock: ' + json.dumps({'mismatch': mismatch, 'extra': extra}))
    results['dependency-consistency'] = run('dependency-consistency', [str(python), '-m', 'pip', 'check'], source, env, results_dir, 30)
    wrapper = source / 'backend' / 'phase0_pytest.py'
    shutil.copy2(REPO / 'scripts' / 'kaya_phase0_pytest.py', wrapper)
    for name in args.checks:
        localenv = env.copy()
        cwd = source / 'backend'
        if name in {'backend-full', 'backend-focused', 'launch-hold'}:
            path = {'backend-full': 'tests', 'backend-focused': 'security_tests', 'launch-hold': 'phase0_tests'}[name]
            if not (cwd / path).exists():
                results[name] = {'status': 'NOT_APPLICABLE', 'reason': 'Surface absent at selected source revision'}
                continue
            if name == 'launch-hold':
                localenv.pop('KAYA_EXECUTION_MODE', None)
            command = [str(python), str(wrapper), path, '-q', '--tb=short', '-p', 'pytest_timeout', '--timeout=45', '--junitxml=' + str(results_dir / (name + '.xml'))]
            seconds = 900 if name == 'backend-full' else 240
        elif name == 'migration-heads':
            command, seconds = [str(python), '-m', 'alembic', 'heads'], 30
        elif name == 'infrastructure':
            command, seconds, cwd = [str(python), '-m', 'unittest', 'discover', '-s', 'infra/azure/tests', '-v'], 90, source
            localenv['PATH'] = str(Path.home() / '.azure/bin') + ':' + env['PATH']
        else:
            raise SystemExit('Unknown check: ' + name)
        results[name] = run(name, command, cwd, localenv, results_dir, seconds)
        (results_dir / 'summary.json').write_text(json.dumps(results, indent=2) + '\n')
    metadata = {'date_utc': datetime.now(timezone.utc).isoformat(), 'source_revision': args.source_revision or 'working tree',
                'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
                'python': sys.version, 'lock_sha256': lock_hash, 'wrapper_sha256': digest(wrapper),
                'source_sha256': [{'path': name, 'sha256': value} for name, value in copied.items()],
                'environment': 'allowlisted environment; fresh reviewed source types; excludes dotenv, database and log files, uploads and symlinks; Python TCP/UDP/DNS calls blocked in pytest; no OS sandbox or subprocess-network isolation claimed'}
    (results_dir / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
