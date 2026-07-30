# Clinician credential verification

KAYA uses a layered process for doctors and nurses:

1. deterministic pre-checks validate profile completeness, supported file
   signatures, licence dates, required evidence, and country consistency;
2. Azure Document Intelligence can extract structured fields from the evidence;
3. Persona can perform identity and document-fraud checks;
4. DataFlow can perform contracted primary-source verification;
5. an authorised KAYA reviewer compares the evidence with the relevant official
   authority and makes the final decision.

The system never auto-approves or auto-rejects a clinician. Failed automated
checks move a dossier to `needs_info`. Only a human reviewer can set `verified`,
`rejected`, or `suspended`.

## Access rules

- Patients can use patient features immediately after registration.
- Doctors and nurses receive a restricted account and a private credential
  dossier.
- Doctor and nurse clinical endpoints return
  `credential_verification_required` until the dossier is verified.
- The legacy doctor approval endpoint cannot bypass the credential queue.
- Evidence is served through authenticated endpoints and is never exposed as a
  public storage URL.

## Evidence rules

Every clinician submits:

- professional card/licence;
- diploma or training certificate.

If the diploma country differs from the intended practice country, recognition
or equivalence evidence is also required. If the licence country differs from
the practice country, local professional registration is required.

For Angola this implements the published ORDENFA requirement that foreign
nursing qualifications receive official equivalence, and supports the
INAAREES process for recognition of higher education completed abroad.

## Country coverage

Priority configuration is included for Angola, Cuba, Russia, Spain, Portugal,
the United Kingdom, and the United States. All 27 EU member states are included.
Brazil, Cabo Verde, Mozambique, the Democratic Republic of Congo,
São Tomé and Príncipe, and Zimbabwe are included because they are common or
regionally relevant qualification origins for Angola. Where no suitable public
registry/API is available, the reviewer is sent to the official authority and
the dossier remains manual.

### EU recognition is coordinated, not one universal licence

EU rules coordinate recognition and certain harmonised qualifications for
doctors and general-care nurses may qualify for automatic recognition. This
does not mean a clinician may practise everywhere with one EU licence. The
destination country's competent authority still processes recognition and may
require local professional registration, good standing, language competence,
insurance, or other evidence. Academic-diploma recognition is also distinct
from authorisation to practise.

KAYA therefore stores qualification origin, licence country, intended practice
country, and destination registration separately. The UK is treated separately
from the EU. US licences additionally require a state/jurisdiction because
medical and nursing regulation is state-based.

Official review references:

- Angola doctors: <https://ordemdosmedicos.ao/>
- Angola nurses: <https://ordenfa.org/a-ordem/faqs/>
- Angola foreign higher-education recognition:
  <https://sepe.gov.ao/inaarees-cursos>
- Portugal nurses: <https://www.ordemenfermeiros.pt/>
- Portugal doctors: <https://ordemdosmedicos.pt/>
- Spain doctors, electronic certificate verification:
  <https://certificados.cgcom.es/verificar>
- Spain nurses: <https://www.consejogeneralenfermeria.org/>
- Brazil doctors: <https://portal.cfm.org.br/busca-medicos/>
- Russia education-document register:
  <https://frdocabinet.obrnadzor.gov.ru/>
- Cuba Ministry of Public Health: <https://salud.msp.gob.cu/>
- EU regulated professions database:
  <https://ec.europa.eu/growth/tools-databases/regprof/>
- EU professional qualification recognition:
  <https://europa.eu/youreurope/citizens/work/professional-qualifications/index_en.htm>
- UK General Medical Council register:
  <https://www.gmc-uk.org/registration-and-licensing/our-registers>
- UK Nursing and Midwifery Council register:
  <https://www.nmc.org.uk/registration/search-the-register/>
- US state medical board directory:
  <https://www.fsmb.org/contact-a-state-medical-board/>
- US nursing licence service: <https://www.nursys.com/>

No registry is scraped and CAPTCHA-protected workflows are not automated.
Authoritative APIs can later be added behind the same country configuration
when a regulator supplies credentials and terms of access.

## API surface

- `GET /api/v1/credentials/requirements`
- `GET|PUT /api/v1/credentials/me`
- `POST /api/v1/credentials/me/evidence/{kind}`
- `POST /api/v1/credentials/me/submit`
- `POST /api/v1/credentials/me/providers/start`
- `POST /api/v1/credentials/me/providers/refresh`
- `POST /api/v1/credentials/webhooks/persona`
- `POST /api/v1/credentials/webhooks/dataflow`
- `GET /api/v1/credentials/admin`
- `POST /api/v1/credentials/admin/{id}/decision`
- `GET /api/v1/credentials/evidence/{id}/download`

Uploads accept genuine PDF, JPEG, or PNG signatures up to 10 MB. Production
deployments should configure private S3-compatible storage using the existing
`DO_SPACES_*` settings and add malware scanning/quarantine before opening
documents in reviewer devices.

## Provider configuration

No fake credential is accepted as a live integration. When configuration is
missing or begins with `FAKE`, `CHANGE_ME`, or `YOUR_`, KAYA creates an
auditable `not_configured` check without making a network request.

```dotenv
# Azure Document Intelligence REST v4
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://YOUR_RESOURCE.cognitiveservices.azure.com
AZURE_DOCUMENT_INTELLIGENCE_KEY=YOUR_AZURE_KEY
AZURE_DOCUMENT_MODEL_ID=kaya-credential-v1
AZURE_DOCUMENT_API_VERSION=2024-11-30

# Persona
PERSONA_API_KEY=YOUR_PERSONA_API_KEY
PERSONA_INQUIRY_TEMPLATE_ID=itmpl_YOUR_TEMPLATE
PERSONA_WEBHOOK_SECRET=YOUR_PERSONA_WEBHOOK_SECRET

# DataFlow enterprise contract (endpoint and mapping supplied at onboarding)
DATAFLOW_SUBMIT_URL=https://YOUR_CONTRACTED_DATAFLOW_ENDPOINT
DATAFLOW_API_KEY=YOUR_DATAFLOW_API_KEY
DATAFLOW_WEBHOOK_SECRET=YOUR_SHARED_WEBHOOK_SECRET
```

Azure calls the documented asynchronous analyze endpoint and polls the returned
operation URL. Persona creates an Inquiry and verifies the
`Persona-Signature` HMAC over the untouched request body. DataFlow does not
publish one universal healthcare partner API contract, so its adapter activates
only when the contracted endpoint is explicitly configured. The KAYA callback
contract uses `X-DataFlow-Signature: sha256=<HMAC>`.

All three providers are idempotent at dossier/evidence level. Applicant consent
is timestamped before any document leaves KAYA. Provider results remain
decision support; they cannot set the dossier to `verified`.
