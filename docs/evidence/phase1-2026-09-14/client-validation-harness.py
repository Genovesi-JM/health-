import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

repo = Path('/Users/genovesimaria/Documents/kaya-web')
work = Path('/Users/genovesimaria/Documents/Codex/2026-09-14/l/work/phase1-clients-review')
evidence = repo / 'docs/evidence/phase1-2026-09-14'
for name in ['home', 'tmp']:
    (work / name).mkdir(exist_ok=True)
env = {'PATH': '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'HOME': str(work / 'home'),
       'TMPDIR': str(work / 'tmp'), 'LANG': 'en_US.UTF-8', 'TZ': 'UTC', 'CI': '1',
       'NPM_CONFIG_USERCONFIG': '/dev/null', 'NPM_CONFIG_UPDATE_NOTIFIER': 'false',
       'NODE_OPTIONS': '--require=' + str(work / 'client-no-network.cjs')}
node, npm = '/opt/homebrew/bin/node', '/opt/homebrew/bin/npm'
checks = [
    ('tests', [npm, 'test', '--', '--maxWorkers=2', '--minWorkers=1', '--testTimeout=10000', '--hookTimeout=10000',
               '--reporter=default', '--reporter=json', '--outputFile=' + str(evidence / 'client-tests.json')], 'frontend', 240),
    ('build', [npm, 'run', 'build'], 'frontend', 180),
    ('new-code-lint', [node, 'node_modules/eslint/bin/eslint.js', 'src/App.tsx', 'src/main.tsx', 'src/phase1',
                        'src/App.phase1.test.tsx', '--format=json', '--output-file=' + str(evidence / 'client-new-code-lint.json')], 'frontend', 120),
    ('mobile-typecheck', [npm, 'run', 'typecheck'], 'mobile', 120),
]

def run(item):
    name, cmd, surface, limit = item
    started = time.time()
    log = evidence / ('client-' + name + '.log')
    timeout = False
    with log.open('wb') as stream:
        proc = subprocess.Popen(cmd, cwd=work / surface, env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = proc.wait(timeout=limit)
        except subprocess.TimeoutExpired:
            timeout = True
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
            code = 124
    result = {'command': cmd, 'cwd': str(work / surface), 'timeout_seconds': limit, 'exit_code': code,
              'timed_out': timeout, 'duration_seconds': round(time.time() - started, 3), 'log': log.name,
              'log_sha256': hashlib.sha256(log.read_bytes()).hexdigest()}
    print(name, 'exit', code, flush=True)
    return name, result

# Frontend checks share build cache; keep them sequential. Mobile typecheck is independent.
def frontend():
    return [run(item) for item in checks[:3]]

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    front = pool.submit(frontend)
    mobile = pool.submit(run, checks[3])
    results = dict(front.result() + [mobile.result()])
summary = {'node': subprocess.check_output([node, '--version'], env=env).decode().strip(),
           'npm': subprocess.check_output([npm, '--version'], env=env).decode().strip(),
           'environment': env, 'checks': results,
           'test_scope': 'All four previously tracked test files plus three new Phase 1 test files. The three original untracked user tests are excluded and preserved by hash in the source manifest.',
           'dependency_provenance': 'Exact Phase 0 clean npm-ci installations reused with matching unchanged lockfiles; no new dependency installation or audit.'}
report = evidence / 'client-tests.json'
if report.exists():
    data = json.loads(report.read_text())
    summary['test_counts'] = {key: data.get(key) for key in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests']}
    summary['test_files'] = [{'name': row['name'], 'status': row['status']} for row in data.get('testResults', [])]
lint = evidence / 'client-new-code-lint.json'
if lint.exists():
    summary['new_code_lint_counts'] = {key: sum(row[key] for row in json.loads(lint.read_text())) for key in ['errorCount', 'warningCount']}
(evidence / 'client-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2), flush=True)
