#!/usr/bin/env python3
"""Run scheduling and inbox races in a new Unix-socket-only PostgreSQL cluster.

Requires local PostgreSQL binaries and backend dependencies plus psycopg2.
Never reads dotenv or connects to an existing database. The report and stopped
cluster stay in a new temporary directory for inspection. No launch approval
or multi-replica deployment evidence is implied by this local check.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--postgres-bin", type=Path, required=True,
                        help="Directory containing initdb, pg_ctl and createdb")
    parser.add_argument("--git", default="git", help="Git executable")
    parser.add_argument("--staged", action="store_true", help="Validate the index snapshot")
    args = parser.parse_args()
    pg = args.postgres_bin.resolve()
    for name in ("initdb", "pg_ctl", "createdb"):
        if not (pg / name).is_file():
            parser.error(f"Missing PostgreSQL executable: {pg / name}")
    if os.geteuid() == 0:
        parser.error("PostgreSQL must run as an unprivileged user")
    repo = Path(__file__).resolve().parents[1]
    work = Path(tempfile.mkdtemp(prefix="kaya-pg-scheduling-"))
    # PostgreSQL's Unix socket path has a small platform-specific length limit.
    if len(str(work / "socket")) > 80:
        parser.error("Set TMPDIR to a short path, for example /tmp")
    for directory in ("source", "socket", "tmp"):
        (work / directory).mkdir()
    listing = [args.git, "ls-files", "-z", "--cached"]
    if not args.staged:
        listing += ["--others", "--exclude-standard"]
    names = subprocess.check_output(listing + ["--", "backend", "policy"], cwd=repo).decode().split("\0")
    manifest = {}
    for name in sorted(set(filter(None, names))):
        relative = Path(name)
        if (any(part.startswith(".env") for part in relative.parts)
                or relative.suffix not in {".py", ".json", ".ini", ".mako", ".txt"}
                or relative.name == "email_log.txt"):
            continue
        source = repo / relative
        if source.is_symlink() or not source.is_file():
            continue
        data = (subprocess.check_output([args.git, "show", ":" + name], cwd=repo)
                if args.staged else source.read_bytes())
        destination = work / "source" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        manifest[name] = hashlib.sha256(data).hexdigest()
    harness = repo / "scripts/validation/pg_scheduling_harness.py"
    shutil.copy2(harness, work / "source/backend/pg_scheduling_harness.py")
    env = {
        "PATH": f"{pg}:{Path(sys.executable).parent}:/usr/bin:/bin",
        "LANG": "C", "TMPDIR": str(work / "tmp"), "PYTHONNOUSERSITE": "1",
        "PYTHONDONTWRITEBYTECODE": "1", "ENV": "test",
        "KAYA_EXECUTION_MODE": "synthetic", "KAYA_DISABLE_RATE_LIMIT": "1",
        "SECRET_KEY": "synthetic-pg-validation-key-not-for-production",
        "KAYA_PG_VALIDATION": str(work),
        "DATABASE_URL": f"postgresql+psycopg2://kaya_synthetic@/kaya_schedule_synthetic?host={work}/socket&port=55439",
        "ACCOUNTS_DATABASE_URL": "sqlite:///" + str(work / "unused-accounts.db"),
    }
    print(f"Disposable workspace: {work}", flush=True)
    started = False
    code = 1
    try:
        with (work / "initdb.log").open("w") as log:
            subprocess.run([str(pg / "initdb"), "-D", str(work / "cluster"),
                            "--username=kaya_synthetic", "--auth-local=trust", "--auth-host=reject",
                            "--encoding=UTF8", "--locale=C"], env=env, check=True,
                           stdout=log, stderr=subprocess.STDOUT, timeout=60)
        options = (f"-c listen_addresses='' -c unix_socket_directories='{work}/socket' "
                   "-c port=55439 -c statement_timeout=15000 -c lock_timeout=10000")
        subprocess.run([str(pg / "pg_ctl"), "-D", str(work / "cluster"), "-l",
                        str(work / "postgres.log"), "-o", options, "-w", "start"],
                       env=env, check=True, timeout=60)
        started = True
        subprocess.run([str(pg / "createdb"), "-h", str(work / "socket"), "-p", "55439",
                        "-U", "kaya_synthetic", "kaya_schedule_synthetic"],
                       env=env, check=True, timeout=30)
        with (work / "validation.log").open("w") as log:
            result = subprocess.run([sys.executable, "pg_scheduling_harness.py"],
                                    cwd=work / "source/backend", env=env, stdout=log,
                                    stderr=subprocess.STDOUT, timeout=180)
        code = result.returncode
    finally:
        if started or (work / "cluster/postmaster.pid").exists():
            subprocess.run([str(pg / "pg_ctl"), "-D", str(work / "cluster"), "-m", "fast", "-w", "stop"],
                           env=env, check=True, timeout=60)
        stopped = not (work / "cluster/postmaster.pid").exists()
        report_path = work / "report.json"
        if report_path.exists():
            report = json.loads(report_path.read_text())
            from importlib.metadata import version
            report.update(cluster_stopped=stopped, source_sha256=manifest,
                          snapshot="index" if args.staged else "working_tree",
                          driver="psycopg2-binary==" + version("psycopg2-binary"),
                          harness_sha256=hashlib.sha256(harness.read_bytes()).hexdigest())
            report_path.write_text(json.dumps(report, indent=2) + "\n")
            print(f"Scenarios: {report['passed']}/{report['total']}; forced races: {report['forced_races']}")
        print(f"Cluster stopped: {stopped}; evidence: {report_path}", flush=True)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
