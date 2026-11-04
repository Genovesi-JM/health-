// KAYA runtime app layer — the Container App that runs the operational backend.
//
// This is deliberately SEPARATE from main.bicep (which stays foundation-only and
// runtime-free per its offline tests). Deploy the foundation first, push the
// image to ACR, create the `database-url` Key Vault secret, then deploy this with
// the foundation's outputs as parameters:
//
//   az deployment group create -g <rg> -f app.bicep \
//     -p managedEnvironmentId=<out> identityResourceId=<out> \
//        registryLoginServer=<out> imageTag=<sha>
//
// The container runs `gunicorn app.operational:app` — the real API — not the
// Phase-0 hold. DATABASE_URL is pulled from Key Vault via the managed identity,
// so no secret is ever written into this template.

@description('Deployment region. Must match the reviewed foundation region.')
@allowed(['spaincentral'])
param location string = 'spaincentral'

@description('Resource id of the foundation Container Apps managed environment (main.bicep output managedEnvironmentId).')
param managedEnvironmentId string

@description('Resource id of the foundation user-assigned managed identity (main.bicep output identityResourceId).')
param identityResourceId string

@description('Login server of the foundation container registry (main.bicep output registryLoginServer).')
param registryLoginServer string

@description('Foundation Key Vault URI (main.bicep output keyVaultUri). Must hold a "database-url" secret.')
param keyVaultUri string

@description('Container image repository name in the registry.')
param imageRepository string = 'kaya-backend'

@description('Immutable image tag to deploy (a commit SHA — never "latest" in real use).')
param imageTag string

@description('Allowed browser origins for CORS (comma-separated).')
param corsOrigins string = 'https://genovesi-jm.github.io'

@description('Public base URL of the web client.')
param frontendBase string = 'https://genovesi-jm.github.io/health-'

var appName = 'ca-kaya-backend'
var image = '${registryLoginServer}/${imageRepository}:${imageTag}'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registryLoginServer
          identity: identityResourceId
        }
      ]
      // DATABASE_URL is resolved from Key Vault at runtime via the managed
      // identity; the secret value is never present in this template.
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: '${keyVaultUri}secrets/database-url'
          identity: identityResourceId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'kaya-backend'
          image: image
          command: ['gunicorn']
          args: [
            'app.operational:app'
            '--worker-class'
            'uvicorn.workers.UvicornWorker'
            '--bind'
            '0.0.0.0:8000'
            '--workers'
            '2'
            '--timeout'
            '120'
            '--access-logfile'
            '-'
            '--error-logfile'
            '-'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'ENV', value: 'production' }
            { name: 'KAYA_EXECUTION_MODE', value: 'operational' }
            { name: 'SEED_DEMO_DATA', value: 'false' }
            { name: 'CORS_ORIGINS', value: corsOrigins }
            { name: 'FRONTEND_BASE', value: frontendBase }
            { name: 'AZURE_CLIENT_ID', value: reference(identityResourceId, '2023-01-31').clientId }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8000 }
              initialDelaySeconds: 20
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: 8000 }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output runtimeCreated bool = true
