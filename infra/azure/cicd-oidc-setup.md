# Kaya CI/CD — GitHub → Azure via OIDC (one-time setup)

Sets up passwordless GitHub Actions → Azure deploys using a **user-assigned managed
identity + federated credentials** (no app registration, no long-lived secrets).
Run these once as a subscription Owner / User Access Administrator.

## Fixed values (this environment)
```
SUBSCRIPTION=50874a30-a81d-4c8a-aac7-13564bd1641d
TENANT=69f1c4f2-ab5f-4267-b68b-10c033e56613
RG=rg-kaya-pilot-weu
ACR=acrkaypilotiloie6xix66qg
APP=ca-kaya-staging-api
STORAGE=stkayainfo4319
REPO=Genovesi-JM/health-
IDENTITY=id-kaya-cicd
```

## 1. Create the deploy identity
```bash
az identity create -n "$IDENTITY" -g "$RG" -l spaincentral
CLIENT_ID=$(az identity show -n "$IDENTITY" -g "$RG" --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show -n "$IDENTITY" -g "$RG" --query principalId -o tsv)
```

## 2. Federate it to the GitHub repo (branch + environment subjects)
```bash
az identity federated-credential create -n gh-main -g "$RG" --identity-name "$IDENTITY" \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:ref:refs/heads/main" \
  --audiences api://AzureADTokenExchange

az identity federated-credential create -n gh-env-staging -g "$RG" --identity-name "$IDENTITY" \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:${REPO}:environment:staging" \
  --audiences api://AzureADTokenExchange
```

## 3. Least-privilege RBAC (scoped to staging resources only)
```bash
ACR_ID=$(az acr show -n "$ACR" -g "$RG" --query id -o tsv)
APP_ID=$(az containerapp show -n "$APP" -g "$RG" --query id -o tsv)
ST_ID=$(az storage account show -n "$STORAGE" -g "$RG" --query id -o tsv)

# Build + push the backend hold image (az acr build queues a task → needs Contributor on the ACR)
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Contributor" --scope "$ACR_ID"

# Roll the staging Container App to a new image
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Contributor" --scope "$APP_ID"

# Publish the frontend to the static-site $web container (keyless, data-plane)
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$ST_ID"
```

## 4. Tell GitHub Actions who to log in as (variables, not secrets — OIDC)
```bash
gh variable set AZURE_CLIENT_ID       -R "$REPO" -b "$CLIENT_ID"
gh variable set AZURE_TENANT_ID       -R "$REPO" -b "$TENANT"
gh variable set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$SUBSCRIPTION"
```
(Or set them in GitHub → Settings → Secrets and variables → Actions → Variables.)

## 5. Create the `staging` environment (optional approval gate)
GitHub → Settings → Environments → **New environment** `staging`. Add required
reviewers to force a manual approval before each deploy.

## 6. Done
Push to `main` touching `frontend/**` or `backend/**`, or run the workflows via
"Run workflow" (workflow_dispatch). The backend job **fails closed** if staging
ingress is ever external, keeping the clinical API internal under the launch HOLD.

## Notes
- Pin `azure/login@v2` to a commit SHA before merging (repo supply-chain policy).
- The identity cannot touch production or other projects — scopes are staging-only.
- Rollback: delete the identity (`az identity delete`) and the role assignments; the
  workflows become inert without the repo variables.
