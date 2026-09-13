"""Run existing Kaya tests only inside a disposable source snapshot."""
from __future__ import annotations

import os
from pathlib import Path
import socket
import sys
import types

workspace = Path(os.environ['KAYA_PHASE0_WORKSPACE']).resolve()
backend = workspace / 'source' / 'backend'
if Path.cwd().resolve() != backend or (backend / '.env').exists():
    raise SystemExit('Phase 0 pytest requires its disposable source snapshot without dotenv')
if os.environ.get('ENV') != 'test':
    raise SystemExit('Phase 0 pytest requires ENV=test')


def blocked(*args, **kwargs):
    raise RuntimeError('PHASE0_NETWORK_DENIED')


# Apply before application/settings imports. Never load operator configuration.
socket.create_connection = blocked
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.getaddrinfo = blocked
socket.gethostbyname = blocked
socket.gethostbyname_ex = blocked
socket.gethostbyaddr = blocked
socket.socket.sendto = blocked
if hasattr(socket.socket, 'sendmsg'):
    socket.socket.sendmsg = blocked
sys.path.insert(0, str(backend))
# Some installed packages also use the top-level name "tests". Bind the local
# test namespace explicitly without editing the existing test files.
namespace = types.ModuleType('tests')
namespace.__path__ = [str(backend / 'tests')]
sys.modules['tests'] = namespace

import pytest  # noqa: E402

class SyntheticSeedFixture:
    def pytest_sessionstart(self, session):
        # Only the legacy full suite repeatedly seeds demo accounts. Cache its
        # identical seed password hash to bound fixture cost, retaining real
        # bcrypt for the first hash and all application authentication paths.
        # This is not a test of per-account seed salts or startup performance.
        if sys.argv[1:2] == ['tests']:
            from functools import lru_cache
            from app import seed_data
            seed_data.hash_password = lru_cache(maxsize=4)(seed_data.hash_password)


raise SystemExit(pytest.main(sys.argv[1:], plugins=[SyntheticSeedFixture()]))
