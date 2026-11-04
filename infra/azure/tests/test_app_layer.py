"""Offline compiled-template checks for the runtime app layer (app.bicep).

No application imports or cloud calls. Verifies the Container App runs the real
operational entry, pulls DATABASE_URL from Key Vault (no secret literal), uses the
managed identity, and is health-probed — the deployable counterpart to the
foundation, kept in a separate template.
"""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def _bicep_executable() -> str:
    bundled = Path.home() / ".azure/bin/bicep"
    return shutil.which("bicep") or (str(bundled) if bundled.is_file() else "")


class AppLayerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        exe = _bicep_executable()
        if not exe:
            raise RuntimeError("Install Bicep to run compiled infrastructure checks; no cloud login is required")
        result = subprocess.run(
            [exe, "build", str(ROOT / "app.bicep"), "--stdout"],
            check=True, capture_output=True, text=True, timeout=60,
        )
        cls.template = json.loads(result.stdout)
        resources = cls.template["resources"]
        cls.resources = list(resources.values()) if isinstance(resources, dict) else resources
        cls.raw = (ROOT / "app.bicep").read_text(encoding="utf-8")

    def _container_app(self) -> dict:
        apps = [r for r in self.resources if r["type"] == "Microsoft.App/containerApps"]
        self.assertEqual(len(apps), 1, "exactly one container app")
        return apps[0]

    def test_runs_operational_entry_not_the_hold(self):
        app = self._container_app()
        container = app["properties"]["template"]["containers"][0]
        args = container["args"]
        self.assertIn("app.operational:app", args)
        self.assertNotIn("app.main:app", args)
        self.assertEqual(container["command"], ["gunicorn"])

    def test_database_url_from_key_vault_no_secret_literal(self):
        app = self._container_app()
        secrets = app["properties"]["configuration"]["secrets"]
        db = next(s for s in secrets if s["name"] == "database-url")
        # Sourced from Key Vault via the managed identity, never an inline value.
        self.assertIn("keyVaultUrl", db)
        self.assertNotIn("value", db)
        container = app["properties"]["template"]["containers"][0]
        db_env = next(e for e in container["env"] if e["name"] == "DATABASE_URL")
        self.assertEqual(db_env.get("secretRef"), "database-url")
        # No committed secret material anywhere in the source template.
        for marker in ["password=", "AccountKey=", "-----BEGIN", "sk_live_"]:
            self.assertNotIn(marker, self.raw)

    def test_uses_user_assigned_identity_and_acr_via_identity(self):
        app = self._container_app()
        self.assertEqual(app["identity"]["type"], "UserAssigned")
        registries = app["properties"]["configuration"]["registries"]
        self.assertTrue(all("identity" in r for r in registries))
        self.assertTrue(all("username" not in r and "passwordSecretRef" not in r for r in registries))

    def test_ingress_and_probes(self):
        app = self._container_app()
        ingress = app["properties"]["configuration"]["ingress"]
        self.assertEqual(ingress["targetPort"], 8000)
        self.assertFalse(ingress["allowInsecure"])
        container = app["properties"]["template"]["containers"][0]
        probe_paths = {p["httpGet"]["path"] for p in container["probes"]}
        self.assertEqual(probe_paths, {"/health"})

    def test_production_env_and_no_demo_seed(self):
        app = self._container_app()
        env = {e["name"]: e.get("value") for e in app["properties"]["template"]["containers"][0]["env"]}
        self.assertEqual(env.get("ENV"), "production")
        self.assertEqual(env.get("SEED_DEMO_DATA"), "false")

    def test_declares_runtime_created(self):
        self.assertTrue(self.template["outputs"]["runtimeCreated"]["value"])


if __name__ == "__main__":
    unittest.main()
