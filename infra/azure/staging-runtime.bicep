targetScope = 'resourceGroup'
param image string
param deployRuntime bool = false
var location = 'spaincentral'
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = { name: 'cae-kaya-pilot' }
resource runtimeId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: 'id-kaya-staging' }
resource migrationId 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: 'id-kaya-staging-migrate' }
var vault = 'https://kv-kaya-stage-iloie6${az.environment().suffixes.keyvaultDns}/secrets/'
var commonEnv = [
 { name: 'ENV', value: 'production' }
 { name: 'KAYA_MANAGED_SCHEMA', value: 'true' }
 { name: 'SEED_DEMO_DATA', value: 'false' }
 { name: 'DATABASE_URL', secretRef: 'database-url' }
 { name: 'ACCOUNTS_DATABASE_URL', secretRef: 'accounts-database-url' }
 { name: 'SECRET_KEY', secretRef: 'signing-key' }
 { name: 'ENCRYPTION_KEY', secretRef: 'encryption-key' }
 { name: 'FRONTEND_BASE', value: 'https://kaya-staging.invalid' }
 { name: 'CORS_ORIGINS', value: 'https://kaya-staging.invalid' }
 { name: 'HEALTH_STORAGE_PROVIDER', value: 'azure_blob' }
 { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: 'stkayiloie6xix66qg' }
 { name: 'AZURE_STORAGE_CONTAINER', value: 'kaya-staging-private' }
 { name: 'AZURE_STORAGE_MANAGED_IDENTITY_CLIENT_ID', value: runtimeId.properties.clientId }
]
var secretNames = ['database-url','accounts-database-url','signing-key','encryption-key']
var migrationBaseSecrets = [for name in secretNames: { name: name, keyVaultUrl: '${vault}${name}', identity: migrationId.id }]
resource job 'Microsoft.App/jobs@2024-03-01' = {
 name: 'kaya-staging-migrate'
 location: location
 tags: { project: 'Kaya', environment: 'staging', dataClassification: 'synthetic-only' }
 identity: { type: 'UserAssigned', userAssignedIdentities: { '${migrationId.id}': {} } }
 properties: {
  environmentId: environment.id
  configuration: {
   triggerType: 'Manual'
   replicaTimeout: 1800
   replicaRetryLimit: 0
   manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
   registries: [{ server: 'acrkaypilotiloie6xix66qg.azurecr.io', identity: migrationId.id }]
   secrets: concat(migrationBaseSecrets,[{ name: 'admin-database-url', keyVaultUrl: '${vault}admin-database-url', identity: migrationId.id },{ name: 'app-password', keyVaultUrl: '${vault}app-password', identity: migrationId.id }])
  }
  template: { containers: [{ name: 'migrate', image: image, command: ['python'], args: ['scripts/azure_migrate.py'], resources: { cpu: json('0.5'), memory: '1Gi' }, env: concat(commonEnv,[{ name: 'KAYA_ADMIN_DATABASE_URL', secretRef: 'admin-database-url' },{ name: 'KAYA_APP_PASSWORD', secretRef: 'app-password' }]) }] }
 }
}
resource app 'Microsoft.App/containerApps@2024-03-01' = if (deployRuntime) {
 name: 'ca-kaya-staging-api'
 location: location
 tags: { project: 'Kaya', environment: 'staging', dataClassification: 'synthetic-only', productionReady: 'false' }
 identity: { type: 'UserAssigned', userAssignedIdentities: { '${runtimeId.id}': {} } }
 properties: {
  managedEnvironmentId: environment.id
  workloadProfileName: 'Consumption'
  configuration: {
   activeRevisionsMode: 'Single'
   ingress: { external: false, targetPort: 8000, transport: 'http', allowInsecure: false }
   registries: [{ server: 'acrkaypilotiloie6xix66qg.azurecr.io', identity: runtimeId.id }]
   secrets: [for name in secretNames: { name: name, keyVaultUrl: '${vault}${name}', identity: runtimeId.id }]
  }
  template: {
   scale: { minReplicas: 0, maxReplicas: 1 }
   containers: [{ name: 'api', image: image, resources: { cpu: json('0.5'), memory: '1Gi' }, env: commonEnv, probes: [
    { type: 'Startup', httpGet: { path: '/health', port: 8000 }, initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 30 }
    { type: 'Liveness', httpGet: { path: '/health', port: 8000 }, periodSeconds: 30 }
    { type: 'Readiness', httpGet: { path: '/ready', port: 8000 }, periodSeconds: 10, failureThreshold: 3 }
   ] }]
  }
 }
}
output apiName string = deployRuntime ? app.name : ''
output apiUrl string = deployRuntime ? 'https://${app!.properties.configuration.ingress.fqdn}' : ''
output migrationJob string = job.name
