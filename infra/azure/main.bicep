targetScope = 'resourceGroup'

@description('Foundation only. This does not move or recreate the existing resource group.')
@allowed(['spaincentral'])
param location string = 'spaincentral'

@description('Supply securely at deployment; never put the password in a parameter file or command history.')
@secure()
@minLength(16)
@maxLength(128)
param postgresAdministratorPassword string

@description('Administrative bootstrap identity only; create least-privilege application roles before any runtime release.')
param postgresAdministratorLogin string = 'kayaowner'

var suffix = uniqueString(resourceGroup().id)
var postgresName = 'pg-kaya-pilot-${suffix}'
var databaseName = 'kaya'
var accountsDatabaseName = 'kaya_accounts'
var vnetPrefix = '10.42.0.0/21'
var appSubnetPrefix = '10.42.0.0/23'
var postgresSubnetPrefix = '10.42.2.0/28'
var tags = {
  brand: 'Valle Baobab'
  project: 'Kaya'
  environment: 'pilot'
  dataClassification: 'synthetic-only'
  productionReady: 'false'
}

resource postgresNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-kaya-pilot-postgres'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-Kaya-ContainerApps-PostgreSQL'
        properties: {
          access: 'Allow'
          direction: 'Inbound'
          priority: 100
          protocol: 'Tcp'
          sourceAddressPrefix: appSubnetPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: postgresSubnetPrefix
          destinationPortRange: '5432'
        }
      }
      {
        name: 'Allow-PostgreSQL-Self'
        properties: {
          access: 'Allow'
          direction: 'Inbound'
          priority: 110
          protocol: 'Tcp'
          sourceAddressPrefix: postgresSubnetPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: postgresSubnetPrefix
          destinationPortRange: '5432'
        }
      }
      {
        name: 'Deny-Other-VNet-Inbound'
        properties: {
          access: 'Deny'
          direction: 'Inbound'
          priority: 200
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-kaya-pilot'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [vnetPrefix] }
    enableDdosProtection: false
    subnets: [
      {
        name: 'snet-container-apps'
        properties: {
          addressPrefix: appSubnetPrefix
          delegations: [
            {
              name: 'container-apps'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-postgres'
        properties: {
          addressPrefix: postgresSubnetPrefix
          delegations: [
            {
              name: 'postgres'
              properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
            }
          ]
          networkSecurityGroup: { id: postgresNsg.id }
          serviceEndpoints: [{ service: 'Microsoft.Storage' }]
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${postgresName}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresDns
  name: 'link-kaya-pilot'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    administratorLogin: postgresAdministratorLogin
    administratorLoginPassword: postgresAdministratorPassword
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-postgres')
      privateDnsZoneArmResourceId: postgresDns.id
      publicNetworkAccess: 'Disabled'
    }
    // Fixed low-cost pilot capacity; alert and review before any expansion.
    storage: { autoGrow: 'Disabled', storageSizeGB: 32, tier: 'P4' }
    version: '16'
  }
  dependsOn: [postgresDnsLink]
}

resource primaryDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
  // PostgreSQL child writes are serialized to avoid transient ServerIsBusy.
  dependsOn: [requireTls]
}

resource accountsDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: accountsDatabaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
  dependsOn: [primaryDatabase]
}

resource requireTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'require_secure_transport'
  properties: { source: 'user-override', value: 'on' }
  // Keep the complete server -> TLS -> primary -> accounts chain explicit.
  #disable-next-line no-unnecessary-dependson
  dependsOn: [postgres]
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: 'acrkaypilot${suffix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-kaya-pilot'
  location: location
  tags: tags
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stkay${suffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    encryption: {
      keySource: 'Microsoft.Storage'
      services: { blob: { enabled: true, keyType: 'Account' } }
    }
    // Authenticated endpoint is needed for short-lived browser delegation SAS.
    // No anonymous container or shared-key service/account SAS is allowed.
    publicNetworkAccess: 'Enabled'
    networkAcls: { bypass: 'AzureServices', defaultAction: 'Allow' }
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
    containerDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource healthContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'health-private'
  properties: {
    publicAccess: 'None'
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: true
    metadata: { application: 'kaya', classification: 'synthetic-only' }
  }
}

// Intentionally empty: no runtime secrets or administrator connection strings.
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-kay-${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    accessPolicies: []
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    publicNetworkAccess: 'Enabled'
    networkAcls: { bypass: 'AzureServices', defaultAction: 'Allow' }
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-kaya-pilot'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.1') }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-kaya-pilot'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-container-apps')
      // Empty environment only. There are no apps, ingress rules or public URLs.
      internal: false
    }
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
    zoneRedundant: false
  }
}

var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var secretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var blobContributorRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var blobDelegatorRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'db58b8e5-c6ad-4a2a-8342-4190687cbf4a')

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRole)
  scope: registry
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: acrPullRole }
}

resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, secretsUserRole)
  scope: vault
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: secretsUserRole }
}

resource blobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(healthContainer.id, identity.id, blobContributorRole)
  scope: healthContainer
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobContributorRole }
}

resource blobDelegator 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, blobDelegatorRole)
  scope: storage
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobDelegatorRole }
}

// Nonsecret resource references only. No passwords, tokens, URLs with credentials,
// log ingestion keys, runtime defaults or tenant-wide role assignments.
output location string = location
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output databaseName string = primaryDatabase.name
output accountsDatabaseName string = accountsDatabase.name
output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output keyVaultUri string = vault.properties.vaultUri
output identityResourceId string = identity.id
output identityClientId string = identity.properties.clientId
output storageAccountName string = storage.name
output storageContainerName string = healthContainer.name
output managedEnvironmentId string = environment.id
output logWorkspaceName string = logs.name
output runtimeCreated bool = false
