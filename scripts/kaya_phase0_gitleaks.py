"""Offline, redacted Gitleaks evidence for source and locally reachable history.

Supply a separately obtained Gitleaks executable and its pinned default config.
Source-controlled dotenv files enter the scanner because they can contain leaks.
Local/untracked dotenv files, logs, data stores, generated files, symlinks, and
non-source/binary assets are excluded before content reads.
No matched text, credential value, author email, or commit message is retained.
This does not establish that credentials are inactive or authorize release.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import tempfile
import time


SOURCE_SUFFIXES = {
    '.py', '.pyi', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json',
    '.md', '.rst', '.txt', '.html', '.css', '.scss', '.svg', '.yaml', '.yml',
    '.toml', '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.sql',
    '.bicep', '.tf', '.tfvars', '.swift', '.plist', '.pbxproj', '.xcworkspacedata',
    '.xcsettings', '.xcscheme', '.xml', '.gradle', '.properties', '.kt', '.java',
    '.rb', '.lock', '.example', '.sample', '.template', '.mako', '.in', '.webmanifest',
}
SOURCE_NAMES = {'Dockerfile', 'Makefile', 'Procfile', 'LICENSE', 'README', '.gitignore',
                '.dockerignore', '.npmrc', '.nvmrc', '.python-version'}
EXCLUDED_DIRS = {'.git', '.venv', 'venv', 'node_modules', '__pycache__',
                 '.pytest_cache', '.mypy_cache', 'dist', 'build', 'coverage',
                 'logs', 'uploads', 'backups', 'data'}
GENERATED_EVIDENCE = PurePosixPath('docs/evidence/phase0-completion-2026-09-14')


def exclusion(name, tracked_dotenv=False):
    path = PurePosixPath(name)
    lower = path.name.lower()
    if path.is_absolute() or '..' in path.parts:
        return 'unsafe path'
    if any(part in EXCLUDED_DIRS for part in path.parts):
        return 'data or generated directory'
    if lower.startswith('.env') and not lower.endswith(('.example', '.sample', '.template')):
        return None if tracked_dotenv else 'local/untracked dotenv secret file (not read)'
    if path.parent == GENERATED_EVIDENCE and path.suffix == '.log':
        return None  # Reviewed synthetic check logs, never operational/health logs.
    if lower.endswith(('.db', '.db-wal', '.db-shm', '.sqlite', '.sqlite3', '.log')) or re.search(r'(^|_)log\.(txt|json|jsonl|csv)$', lower):
        return 'database or log (not read)'
    if path.suffix.lower() not in SOURCE_SUFFIXES and path.name not in SOURCE_NAMES:
        return 'non-source/binary asset (not read)'
    if re.search(r'\s', name):
        # Gitleaks v8.30.1 splits --log-opts on spaces rather than using shlex.
        return 'whitespace path unsupported by pinned history CLI'
    return None


def clean_environment():
    env = {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LC_ALL': 'C',
           'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
           'GIT_TERMINAL_PROMPT': '0', 'GIT_OPTIONAL_LOCKS': '0',
           'GIT_CONFIG_COUNT': '2', 'GIT_CONFIG_KEY_0': 'core.fsmonitor',
           'GIT_CONFIG_VALUE_0': 'false', 'GIT_CONFIG_KEY_1': 'core.hooksPath',
           'GIT_CONFIG_VALUE_1': '/dev/null'}
    return env


def run(command, cwd, env, timeout):
    started = time.monotonic()
    process = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        timed_out = False
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
        timed_out = True
    return {'exit_code': process.returncode, 'timed_out': timed_out,
            'duration_seconds': round(time.monotonic() - started, 3),
            'stdout': stdout, 'stderr': stderr}


def git(root, env, *args):
    result = run(['git', *args], root, env, 60)
    if result['exit_code'] or result['timed_out']:
        raise RuntimeError('Git metadata command failed; output withheld')
    return result['stdout']


def names(raw):
    return sorted({item.decode('utf-8').strip('\n') for item in raw.split(b'\0') if item.strip(b'\n')})


def scan(binary, config, root, env, scratch, mode, source, log_opts, timeout):
    # A private temporary report is redacted by Gitleaks, then reduced to an
    # explicit safe field allowlist. Never persist raw stdout/stderr/reports.
    report = scratch / (mode + '-redacted.json')
    command = [str(binary), mode, str(source), '--config', str(config),
               '--redact=100', '--no-banner', '--no-color', '--log-level=error',
               '--ignore-gitleaks-allow', '--gitleaks-ignore-path', str(scratch),
               '--max-decode-depth=5', '--max-archive-depth=0',
               '--timeout', str(timeout), '--report-format=json',
               '--report-path', str(report)]
    if log_opts:
        command += ['--log-opts', log_opts]
    result = run(command, scratch, env, timeout + 10)
    findings = []
    report_valid = False
    if report.exists():
        try:
            raw_findings = json.loads(report.read_text())
            if isinstance(raw_findings, list):
                for finding in raw_findings:
                    path = str(finding.get('File', ''))
                    if mode == 'dir':
                        prefix = str(source) + '/'
                        if path.startswith(prefix):
                            path = path[len(prefix):]
                    findings.append({'path': path, 'line': finding.get('StartLine'),
                                     'end_line': finding.get('EndLine'),
                                     'rule': finding.get('RuleID'),
                                     'commit': finding.get('Commit', '')})
                report_valid = True
        finally:
            report.unlink()
    findings.sort(key=lambda x: (x['path'], x['line'] or 0, x['rule'] or '', x['commit']))
    successful = result['exit_code'] in (0, 1) and not result['timed_out'] and report_valid
    return {'mode': mode, 'completed': successful, 'exit_code': result['exit_code'],
            'timed_out': result['timed_out'], 'duration_seconds': result['duration_seconds'],
            'stderr_bytes_withheld': len(result['stderr']),
            'finding_count': len(findings), 'by_rule': dict(Counter(x['rule'] for x in findings)),
            'findings': findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gitleaks', type=Path, required=True)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--scratch', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--timeout', type=int, default=180)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    binary, config = args.gitleaks.resolve(), args.config.resolve()
    env = clean_environment()
    version = run([str(binary), 'version'], root, env, 15)
    if version['exit_code']:
        raise RuntimeError('Gitleaks version command failed; output withheld')
    version_text = version['stdout'].decode().strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+', version_text):
        raise RuntimeError('Unexpected scanner version output; withheld')
    working_names = names(git(root, env, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'))
    # These known generated artifacts can be gitignored before checkpoint staging;
    # include them explicitly so retained evidence is not a scanner blind spot.
    evidence_dir = root / str(GENERATED_EVIDENCE)
    if evidence_dir.is_dir():
        working_names = sorted(set(working_names) | {
            str(path.relative_to(root)) for path in evidence_dir.iterdir() if path.is_file()
        })
    tracked_names = set(names(git(root, env, 'ls-files', '--cached', '-z')))
    historical_names = names(git(root, env, 'log', '--all', '--format=', '--name-only', '-z'))
    excluded_current, excluded_history, source_current, source_history = [], [], [], []
    for name in working_names:
        reason = exclusion(name, tracked_dotenv=name in tracked_names)
        path = root / name
        if not reason and (path.is_symlink() or any(parent.is_symlink() for parent in path.parents if parent != root)):
            reason = 'symlink (not followed)'
        if not reason and not path.is_file():
            reason = 'missing/non-file working-tree entry'
        if reason:
            excluded_current.append({'path': name, 'reason': reason})
        else:
            source_current.append(name)
    for name in historical_names:
        reason = exclusion(name, tracked_dotenv=True)
        if reason:
            excluded_history.append({'path': name, 'reason': reason})
        else:
            source_history.append(name)
    if not source_current or not source_history:
        raise RuntimeError('Refusing an empty scan scope')
    args.scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='kaya-secret-scan-', dir=args.scratch) as directory:
        scratch = Path(directory)
        stage = scratch / 'source'
        stage.mkdir()
        manifest = hashlib.sha256()
        source_bytes = 0
        for name in source_current:
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            data = (root / name).read_bytes()
            target.write_bytes(data)
            source_bytes += len(data)
            manifest.update(name.encode() + b'\0' + hashlib.sha256(data).digest())
        log_opts = '--all --full-history -m --no-ext-diff --no-textconv --no-renames -- ' + ' '.join(':(top,literal)' + name for name in source_history)
        current = scan(binary, config, root, env, scratch, 'dir', stage, None, args.timeout)
        history = scan(binary, config, root, env, scratch, 'git', root, log_opts, args.timeout)
    evidence = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'root': str(root), 'head': git(root, env, 'rev-parse', 'HEAD').decode().strip(),
        'scanner': {'name': 'Gitleaks', 'version': version_text,
                    'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
                    'config_sha256': hashlib.sha256(config.read_bytes()).hexdigest(),
                    'default_rule_count': len(re.findall(r'^\[\[rules\]\]$', config.read_text(), re.M)),
                    'decode_depth': 5, 'redaction_percent': 100,
                    'inline_allow_comments_ignored': True,
                    'repository_ignore_file_used': False},
        'scope': {'current_candidate_paths': len(working_names),
                  'current_source_files': len(source_current), 'current_source_bytes': source_bytes,
                  'current_source_manifest_sha256': manifest.hexdigest(),
                  'generated_evidence_logs_included': [name for name in source_current if PurePosixPath(name).parent == GENERATED_EVIDENCE and PurePosixPath(name).suffix == '.log'],
                  'tracked_dotenv_included': [name for name in source_current if PurePosixPath(name).name.lower().startswith('.env')],
                  'historical_candidate_paths': len(historical_names),
                  'historical_source_paths': len(source_history),
                  'locally_reachable_commits': int(git(root, env, 'rev-list', '--all', '--count')),
                  'shallow_repository': git(root, env, 'rev-parse', '--is-shallow-repository').decode().strip() == 'true',
                  'history_options': '--all --full-history -m --no-ext-diff --no-textconv --no-renames -- <literal source paths>',
                  'excluded_current': excluded_current, 'excluded_history': excluded_history},
        'current_source': current, 'local_git_history': history,
        'limitations': [
            'Regex/entropy heuristics and built-in default allowlists cannot prove absence of secrets.',
            'Source-controlled dotenv files were scanned locally with redaction; local/untracked or ignored dotenv stores were not read.',
            'Operational/health log contents, database contents, data directories, ignored files outside the explicit generated evidence directory, and non-source/binary assets were not read or scanned.',
            'No archives, external submodules, Git LFS object content, unreachable/dangling commits, reflog-only history, or remote-only refs were scanned.',
            'No fetch, provider credential validation, application imports, database reads, or deployment occurred.',
            'Potential credentials are reported for review; scanner findings alone do not establish active credentials.',
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps({'output': str(args.output), 'version': version_text,
                      'current_completed': current['completed'], 'current_findings': current['finding_count'],
                      'history_completed': history['completed'], 'history_findings': history['finding_count']}))
    return 2 if not (current['completed'] and history['completed']) else int(bool(current['findings'] or history['findings']))


if __name__ == '__main__':
    raise SystemExit(main())
