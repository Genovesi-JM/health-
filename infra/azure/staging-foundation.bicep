targetScope = 'resourceGroup'
param location string = 'spaincentral'
@secure()
param adminPassword string
@secure()
param appPassword string
@secure()
param signingKey string
@secure()
param encryptionKey string
var serverName = 'pg-kaya-stage-iloie6'
var vaultName = 'kv-kaya-stage-iloie6'
var adminLogin = 'stageowner'
var appLogin = 'kaya_stage_app'
var host = '${serverName}.postgres.database.azure.com'
var subnet = resourceId('Microsoft.Network/virtualNetworks/subnets','vnet-kaya-pilot','snet-postgres')
var vnet = resourceId('Microsoft.Network/virtualNetworks','vnet-kaya-pilot')
var tags = { project: 'Kaya', environment: 'staging', dataClassification: 'synthetic-only', managedBy: 'bicep' }
resource dns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
 name: 'kaya-staging.private.postgres.database.azure.com'
 location: 'global'
 tags: tags
}
resource link 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
 parent: dns
 name: 'kaya-stage-vnet'
 location: 'global'
 properties: { registrationEnabled: false, virtualNetwork: { id: vnet } }
}
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
 name: serverName
 location: location
 tags: tags
 sku: { name: 'Standard_B1ms', tier: 'Burstable' }
 properties: {
  version: '16'
  administratorLogin: adminLogin
  administratorLoginPassword: adminPassword
  storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
  backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
  highAvailability: { mode: 'Disabled' }
  network: { delegatedSubnetResourceId: subnet, privateDnsZoneArmResourceId: dns.id, publicNetworkAccess: 'Disabled' }
 }
 dependsOn: [link]
}
resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
 parent: pg
 name: 'kaya'
 properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}
resource accounts 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
 parent: pg
 name: 'kaya_accounts'
 properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
 name: 'id-kaya-staging'
 location: location
 tags: tags
}
resource migrationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
 name: 'id-kaya-staging-migrate'
 location: location
 tags: tags
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
 name: vaultName
 location: location
 tags: tags
 properties: {
  tenantId: subscription().tenantId
  sku: { name: 'standard', family: 'A' }
  accessPolicies: []
  enableRbacAuthorization: true
  enableSoftDelete: true
  softDeleteRetentionInDays: 7
  enablePurgeProtection: true
 }
}
var primaryUrl = 'postgresql+psycopg2://${appLogin}:${uriComponent(appPassword)}@${host}:5432/kaya?sslmode=require'
var accountsUrl = 'postgresql+psycopg2://${appLogin}:${uriComponent(appPassword)}@${host}:5432/kaya_accounts?sslmode=require'
var adminUrl = 'postgresql+psycopg2://${adminLogin}:${uriComponent(adminPassword)}@${host}:5432/kaya?sslmode=require'
resource secrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for item in [
 { name: 'database-url', value: primaryUrl }
 { name: 'accounts-database-url', value: accountsUrl }
 { name: 'admin-database-url', value: adminUrl }
 { name: 'app-password', value: appPassword }
 { name: 'signing-key', value: signingKey }
 { name: 'encryption-key', value: encryptionKey }
]: {
 parent: vault
 name: item.name
 properties: { value: item.value }
}]
resource registry 'Microsoft.ContainerRegistry/registries@2025-04-01' existing = { name: 'acrkaypilotiloie6xix66qg' }
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = { name: 'stkayiloie6xix66qg' }
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = { parent: storage, name: 'default' }
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
 parent: blobService
 name: 'kaya-staging-private'
 properties: { publicAccess: 'None', metadata: { classification: 'synthetic-only' } }
}
var pull = subscriptionResourceId('Microsoft.Authorization/roleDefinitions','7f951dda-4ed3-4680-a7ca-43fe172d538d')
var secretUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions','4633458b-17de-408a-b874-0445c86b69e6')
resource runtimePull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
 scope: registry
 name: guid(registry.id,identity.id,pull)
 properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: pull }
}
resource migrationPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
 scope: registry
 name: guid(registry.id,migrationIdentity.id,pull)
 properties: { principalId: migrationIdentity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: pull }
}
resource migrationSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
 scope: vault
 name: guid(vault.id,migrationIdentity.id,secretUser)
 properties: { principalId: migrationIdentity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: secretUser }
}
resource runtimeSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for i in [0,1,4,5]: {
 scope: secrets[i]
 name: guid(secrets[i].id,identity.id,secretUser)
 properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: secretUser }
}]
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
 scope: container
 name: guid(container.id,identity.id,'blob')
 properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions','ba92f5b4-2d11-453d-a403-e96b0029c9fe') }
}
resource delegation 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
 scope: storage
 name: guid(storage.id,identity.id,'delegation')
 properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions','db58b8e5-c6ad-4a2a-8342-4190687cbf4a') }
}
output serverName string = pg.name
output postgresHost string = host
output runtimeIdentity string = identity.id
output runtimeClientId string = identity.properties.clientId
output migrationIdentity string = migrationIdentity.id
output vaultName string = vault.name
