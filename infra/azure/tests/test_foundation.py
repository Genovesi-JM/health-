"""Offline compiled-template checks. No application imports or cloud calls."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("kaya_foundation_parameters", ROOT / "parameters.py")
PARAMETERS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARAMETERS)


class ParameterTests(unittest.TestCase):
    def test_defaults_are_nonsecret_and_region_explicit(self):
        params = PARAMETERS.parameters()["parameters"]
        self.assertEqual(params, {
            "location": {"value": "spaincentral"},
            "postgresAdministratorLogin": {"value": "kayaowner"},
        })

    def test_unreviewed_region_rejected(self):
        for location in ["westeurope", "eastus", "", "Spain Central"]:
            with self.subTest(location=location), self.assertRaises(ValueError):
                PARAMETERS.parameters(location=location)

    def test_reserved_or_malformed_administrator_rejected(self):
        for name in ["postgres", "admin", "root", "azure_superuser", "x", "name@host", "abc def", "1name"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                PARAMETERS.parameters(administrator=name)


class CompiledFoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        bundled = Path.home() / ".azure/bin/bicep"
        executable = shutil.which("bicep") or (str(bundled) if bundled.is_file() else None)
        if not executable:
            raise RuntimeError("Install Bicep to run compiled infrastructure checks; no cloud login is required")
        result = subprocess.run(
            [executable, "build", str(ROOT / "main.bicep"), "--stdout"],
            check=True, capture_output=True, text=True, timeout=60,
        )
        cls.template = json.loads(result.stdout)
        cls.resources = cls.template["resources"]
        if isinstance(cls.resources, dict):
            cls.resources = list(cls.resources.values())

    def one(self, resource_type):
        matches = self.all(resource_type)
        self.assertEqual(len(matches), 1, resource_type)
        return matches[0]

    def all(self, resource_type):
        return [r for r in self.resources if r["type"] == resource_type]

    def test_group_scope_and_no_runtime_or_paid_extras(self):
        self.assertIn("deploymentTemplate.json", self.template["$schema"])
        types = {r["type"] for r in self.resources}
        self.assertFalse(types & {
            "Microsoft.Resources/resourceGroups", "Microsoft.Resources/deployments",
            "Microsoft.App/containerApps", "Microsoft.App/jobs", "Microsoft.AppConfiguration/configurationStores",
            "Microsoft.ServiceBus/namespaces", "Microsoft.Cache/Redis", "Microsoft.KeyVault/vaults/secrets",
            "Microsoft.DBforPostgreSQL/flexibleServers/firewallRules",
        })
        self.assertFalse(self.template["outputs"]["runtimeCreated"]["value"])

    def test_region_and_password_have_no_unsafe_defaults(self):
        params = self.template["parameters"]
        self.assertEqual(params["location"]["defaultValue"], "spaincentral")
        self.assertEqual(params["location"]["allowedValues"], ["spaincentral"])
        password = params["postgresAdministratorPassword"]
        self.assertEqual(password["type"].lower(), "securestring")
        self.assertNotIn("defaultValue", password)
        outputs = json.dumps(self.template["outputs"]).lower()
        for forbidden in ["password", "listkeys", "sharedkey", "connectionstring"]:
            self.assertNotIn(forbidden, outputs)

    def test_single_small_private_postgres_and_two_databases(self):
        server = self.one("Microsoft.DBforPostgreSQL/flexibleServers")
        self.assertEqual(server["sku"], {"name": "Standard_B1ms", "tier": "Burstable"})
        props = server["properties"]
        self.assertEqual(props["version"], "16")
        self.assertEqual(props["storage"], {"autoGrow": "Disabled", "storageSizeGB": 32, "tier": "P4"})
        self.assertEqual(props["backup"], {"backupRetentionDays": 7, "geoRedundantBackup": "Disabled"})
        self.assertEqual(props["highAvailability"]["mode"], "Disabled")
        self.assertEqual(props["network"]["publicNetworkAccess"], "Disabled")
        self.assertIn("delegatedSubnetResourceId", props["network"])
        self.assertIn("privateDnsZoneArmResourceId", props["network"])
        self.assertEqual(len(self.all("Microsoft.DBforPostgreSQL/flexibleServers/databases")), 2)
        self.assertEqual(self.template["variables"]["databaseName"], "kaya")
        self.assertEqual(self.template["variables"]["accountsDatabaseName"], "kaya_accounts")
        tls = self.one("Microsoft.DBforPostgreSQL/flexibleServers/configurations")
        self.assertIn("require_secure_transport", tls["name"])
        self.assertEqual(tls["properties"]["value"], "on")

    def test_network_delegations_and_postgres_restriction(self):
        vnet = self.one("Microsoft.Network/virtualNetworks")
        subnets = vnet["properties"]["subnets"]
        self.assertEqual(len(subnets), 2)
        delegations = {s["properties"]["delegations"][0]["properties"]["serviceName"] for s in subnets}
        self.assertEqual(delegations, {"Microsoft.App/environments", "Microsoft.DBforPostgreSQL/flexibleServers"})
        rules = self.one("Microsoft.Network/networkSecurityGroups")["properties"]["securityRules"]
        self.assertEqual(sum(r["properties"]["access"] == "Allow" for r in rules), 2)
        self.assertTrue(all(r["properties"]["destinationPortRange"] == "5432" for r in rules if r["properties"]["access"] == "Allow"))
        self.assertEqual(rules[-1]["properties"]["access"], "Deny")

    def test_storage_disallows_anonymous_and_shared_key(self):
        storage = self.one("Microsoft.Storage/storageAccounts")
        self.assertEqual(storage["sku"]["name"], "Standard_LRS")
        props = storage["properties"]
        self.assertFalse(props["allowBlobPublicAccess"])
        self.assertFalse(props["allowSharedKeyAccess"])
        self.assertFalse(props["allowCrossTenantReplication"])
        self.assertTrue(props["supportsHttpsTrafficOnly"])
        self.assertEqual(props["minimumTlsVersion"], "TLS1_2")
        container = self.one("Microsoft.Storage/storageAccounts/blobServices/containers")
        self.assertEqual(container["properties"]["publicAccess"], "None")
        self.assertIn("health-private", container["name"])

    def test_own_vault_registry_and_identity(self):
        vault = self.one("Microsoft.KeyVault/vaults")["properties"]
        for flag in ["enableRbacAuthorization", "enableSoftDelete", "enablePurgeProtection"]:
            self.assertTrue(vault[flag])
        self.assertEqual(vault["accessPolicies"], [])
        registry = self.one("Microsoft.ContainerRegistry/registries")
        self.assertEqual(registry["sku"]["name"], "Basic")
        self.assertFalse(registry["properties"]["adminUserEnabled"])
        self.assertFalse(registry["properties"]["anonymousPullEnabled"])
        self.one("Microsoft.ManagedIdentity/userAssignedIdentities")

    def test_only_four_narrow_identity_grants(self):
        roles = self.all("Microsoft.Authorization/roleAssignments")
        self.assertEqual(len(roles), 4)
        by_role = {r["properties"]["roleDefinitionId"]: r for r in roles}
        expected = {
            "[variables('acrPullRole')]": "Microsoft.ContainerRegistry/registries",
            "[variables('secretsUserRole')]": "Microsoft.KeyVault/vaults",
            "[variables('blobContributorRole')]": "Microsoft.Storage/storageAccounts/blobServices/containers",
            "[variables('blobDelegatorRole')]": "Microsoft.Storage/storageAccounts",
        }
        self.assertEqual(set(by_role), set(expected))
        for role, scope_type in expected.items():
            self.assertIn(scope_type, by_role[role]["scope"])
            self.assertEqual(by_role[role]["properties"]["principalType"], "ServicePrincipal")

    def test_logs_capped_and_empty_consumption_environment(self):
        logs = self.one("Microsoft.OperationalInsights/workspaces")["properties"]
        self.assertEqual(logs["workspaceCapping"]["dailyQuotaGb"], "[json('0.1')]")
        self.assertEqual(logs["retentionInDays"], 30)
        env = self.one("Microsoft.App/managedEnvironments")["properties"]
        self.assertEqual(env["workloadProfiles"], [{"name": "Consumption", "workloadProfileType": "Consumption"}])
        self.assertIn("infrastructureSubnetId", env["vnetConfiguration"])
        self.assertFalse(env["zoneRedundant"])


if __name__ == "__main__":
    unittest.main()
