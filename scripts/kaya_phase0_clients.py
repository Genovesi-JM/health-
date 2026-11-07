#!/usr/bin/env python3
"""Measure untouched client sources using fresh locked installs in disposable copies.

This intentionally returns zero when measurement completed, even if application
checks fail. Read client-summary.json for every check's exit code. It never fixes
dependencies, starts an API/browser, or writes into frontend/ or mobile/.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import time


EXTRA_TESTS = [
    "frontend/src/components/DocumentUpload.test.tsx",
    "frontend/src/components/OnboardingShell.test.tsx",
    "frontend/src/pages/AdminExpiryPage.test.tsx",
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    work = args.work.resolve()
    evidence = args.evidence.resolve()
    if work.exists() and any(work.iterdir()):
        parser.error("--work must name a new or empty disposable directory")
    if evidence.exists() and list(evidence.glob("client-*")):
        parser.error("Evidence directory already contains client-* artifacts")
    work.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        parser.error("node and npm must be available")
    clean_path = ":".join(dict.fromkeys([
        str(Path(node).parent), str(Path(npm).parent),
        "/usr/bin", "/bin", "/usr/sbin", "/sbin",
    ]))
    base_env = {"PATH": clean_path, "LANG": "en_US.UTF-8", "CI": "1", "TZ": "UTC"}
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z", "--", "frontend", "mobile"], cwd=repo
    ).decode().split("\0")
    copied = []
    omitted = []
    for name in sorted(set(filter(None, tracked + EXTRA_TESTS))):
        rel = Path(name)
        src = repo / rel
        if any(part.startswith(".env") or part in {
            "node_modules", "dist", ".expo", ".npmrc", ".git"
        } for part in rel.parts) or rel.suffix in {".db", ".sqlite", ".sqlite3", ".log"}:
            omitted.append(name)
            continue
        if not src.is_file() or src.is_symlink():
            raise RuntimeError("Required source is missing or a symlink: " + name)
        dest = work / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied.append({"path": name, "sha256": digest(src), "copied_sha256": digest(dest),
                       "tracked": name in tracked, "extra_user_test": name in EXTRA_TESTS})
    (evidence / "client-source-manifest.json").write_text(json.dumps({
        "files": copied, "omitted_paths": omitted,
        "method": "Tracked working-tree files plus three explicitly named existing user tests; no dotenv, installed dependencies, cache, or generated build copied.",
    }, indent=2) + "\n")
    guard = work / "client-no-network.cjs"
    guard.write_text("""'use strict';
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const dgram = require('node:dgram');
function denied() { throw new Error('PHASE0_CLIENT_NETWORK_DENIED'); }
net.Socket.prototype.connect = denied;
net.connect = denied;
net.createConnection = denied;
http.request = denied; http.get = denied;
https.request = denied; https.get = denied;
dgram.createSocket = denied;
globalThis.fetch = denied;
""")
    checks = {}

    def run(name, command, surface, limit, no_network=True):
        home = work / (surface + "-home")
        tmp = work / (surface + "-tmp")
        home.mkdir(exist_ok=True)
        tmp.mkdir(exist_ok=True)
        userconfig = home / "empty-user-npmrc"
        globalconfig = home / "empty-global-npmrc"
        userconfig.touch()
        globalconfig.touch()
        env = dict(base_env, HOME=str(home), TMPDIR=str(tmp),
                   NPM_CONFIG_USERCONFIG=str(userconfig),
                   NPM_CONFIG_GLOBALCONFIG=str(globalconfig),
                   NPM_CONFIG_CACHE=str(work / (surface + "-npm-cache")),
                   NPM_CONFIG_UPDATE_NOTIFIER="false")
        if no_network:
            env["NODE_OPTIONS"] = "--require=" + str(guard)
        log = evidence / ("client-" + name + ".log")
        started = time.time()
        timeout = False
        with log.open("wb") as stream:
            proc = subprocess.Popen(command, cwd=work / surface, env=env,
                                    stdout=stream, stderr=subprocess.STDOUT,
                                    start_new_session=True)
            try:
                code = proc.wait(timeout=limit)
            except subprocess.TimeoutExpired:
                timeout = True
                os.killpg(proc.pid, signal.SIGTERM)
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait()
                code = 124
        checks[name] = {
            "command": command, "cwd": str(work / surface), "timeout_seconds": limit,
            "started_unix": started, "duration_seconds": round(time.time() - started, 3),
            "exit_code": code, "timed_out": timeout, "log": log.name,
            "log_sha256": digest(log), "log_bytes": log.stat().st_size,
            "node_network_guard": no_network,
        }
        print(name + ": exit " + str(code), flush=True)
        return code

    version_env = dict(base_env, HOME=str(work))
    summary = {
        "scope": "Clean locked installation and baseline measurement only; existing source/tests remain untouched.",
        "repository": str(repo), "isolated_work": str(work),
        "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo).decode().strip(),
        "node": {"executable": node, "version": subprocess.check_output([node, "--version"], env=version_env).decode().strip()},
        "npm": {"executable": npm, "version": subprocess.check_output([npm, "--version"], env=version_env).decode().strip()},
        "host": {"system": platform.system(), "machine": platform.machine(), "release": platform.release()},
        "clean_environment": {"inherited_keys": [], "base": base_env,
            "per_surface": ["isolated HOME", "isolated TMPDIR", "empty npm user/global configs", "fresh isolated npm cache", "NPM_CONFIG_UPDATE_NOTIFIER=false"],
            "network": "npm ci/audit may access public registry; Node outbound networking blocked during application tests, build, lint and typecheck; no API/server/browser started"},
        "lockfiles": {surface: digest(repo / surface / "package-lock.json") for surface in ["frontend", "mobile"]},
        "extra_user_tests": EXTRA_TESTS,
        "guard_sha256": digest(guard),
        "checks": checks,
    }

    def surface_checks(surface):
        installed = run(surface + "-npm-ci", [npm, "ci", "--no-audit", "--no-fund",
            "--registry=https://registry.npmjs.org/", "--fetch-retries=1", "--fetch-timeout=60000"],
            surface, 600, no_network=False) == 0
        if installed:
            if surface == "frontend":
                tracked_tests = [row["path"].removeprefix("frontend/") if hasattr(str, "removeprefix")
                                 else row["path"][len("frontend/"):]
                                 for row in copied if row["tracked"] and ".test." in row["path"]]
                extras = [name[len("frontend/"):] for name in EXTRA_TESTS]
                for label, tests in [("tracked", tracked_tests), ("user-tests", extras)]:
                    report = evidence / ("client-frontend-tests-" + label + ".json")
                    run("frontend-tests-" + label, [npm, "test", "--"] + tests + [
                        "--maxWorkers=2", "--minWorkers=1", "--testTimeout=10000", "--hookTimeout=10000",
                        "--reporter=default", "--reporter=json", "--outputFile=" + str(report)], surface, 180)
                run("frontend-build", [npm, "run", "build"], surface, 180)
                run("frontend-lint", [npm, "run", "lint", "--", "--format=json",
                    "--output-file=" + str(evidence / "client-frontend-lint.json")], surface, 120)
            else:
                run("mobile-typecheck", [npm, "run", "typecheck"], surface, 120)
        run(surface + "-audit", [npm, "audit", "--json", "--ignore-scripts",
            "--registry=https://registry.npmjs.org/", "--fetch-retries=1", "--fetch-timeout=60000"],
            surface, 120, no_network=False)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(surface_checks, ["frontend", "mobile"]))
    summary["original_source_preserved"] = all(digest(repo / row["path"]) == row["sha256"] for row in copied)
    summary["isolated_locks_preserved"] = all(digest(work / surface / "package-lock.json") == value
                                              for surface, value in summary["lockfiles"].items())
    summary["dotenv_copied"] = any(p.name.startswith(".env") for surface in ["frontend", "mobile"]
                                   for p in (work / surface).rglob("*") if "node_modules" not in p.parts)
    for name, result in checks.items():
        if "tests-" in name:
            report = evidence / ("client-" + name + ".json")
            if report.exists():
                data = json.loads(report.read_text())
                result["counts"] = {key: data.get(key) for key in ["numTotalTests", "numPassedTests", "numFailedTests", "numPendingTests", "numTotalTestSuites", "numPassedTestSuites", "numFailedTestSuites"]}
                result["failures"] = [{"file": suite["name"], "test": assertion["fullName"], "failure_messages": assertion.get("failureMessages", [])}
                    for suite in data.get("testResults", []) for assertion in suite.get("assertionResults", []) if assertion["status"] == "failed"]
        if name == "frontend-lint" and (evidence / "client-frontend-lint.json").exists():
            data = json.loads((evidence / "client-frontend-lint.json").read_text())
            result["counts"] = {key: sum(row[key] for row in data) for key in ["errorCount", "warningCount", "fatalErrorCount"]}
            result["files_with_findings"] = sum(bool(row["messages"]) for row in data)
            result["extra_user_test_findings"] = [row for row in data if any(row["filePath"].endswith(extra) for extra in EXTRA_TESTS)]
        if name.endswith("-audit"):
            try:
                data = json.loads((evidence / result["log"]).read_text())
                result["counts"] = data.get("metadata", {}).get("vulnerabilities")
                result["audit_error"] = data.get("error")
            except ValueError:
                result["audit_error"] = "Audit did not return JSON; inspect full log"
    (evidence / "client-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    hashes = {p.name: {"sha256": digest(p), "bytes": p.stat().st_size}
              for p in sorted(evidence.glob("client-*")) if p.is_file()}
    (evidence / "client-digests.json").write_text(json.dumps(hashes, indent=2) + "\n")
    print(json.dumps({key: {field: value for field, value in result.items() if field in {"exit_code", "counts", "audit_error", "duration_seconds"}}
                      for key, result in checks.items()}, indent=2), flush=True)


if __name__ == "__main__":
    main()
