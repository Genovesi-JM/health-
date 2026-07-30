# Clinician credential verification

KAYA uses a two-stage process for doctors and nurses:

1. deterministic pre-checks validate profile completeness, supported file
   signatures, licence dates, required evidence, and country consistency;
2. an authorised KAYA reviewer compares the evidence with the relevant official
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

Priority configuration is included for Angola, Cuba, Russia, Spain, and
Portugal. Brazil, Cabo Verde, Mozambique, the Democratic Republic of Congo,
São Tomé and Príncipe, and Zimbabwe are included because they are common or
regionally relevant qualification origins for Angola. Where no suitable public
registry/API is available, the reviewer is sent to the official authority and
the dossier remains manual.

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

No registry is scraped and CAPTCHA-protected workflows are not automated.
Authoritative APIs can later be added behind the same country configuration
when a regulator supplies credentials and terms of access.

## API surface

- `GET /api/v1/credentials/requirements`
- `GET|PUT /api/v1/credentials/me`
- `POST /api/v1/credentials/me/evidence/{kind}`
- `POST /api/v1/credentials/me/submit`
- `GET /api/v1/credentials/admin`
- `POST /api/v1/credentials/admin/{id}/decision`
- `GET /api/v1/credentials/evidence/{id}/download`

Uploads accept genuine PDF, JPEG, or PNG signatures up to 10 MB. Production
deployments should configure private S3-compatible storage using the existing
`DO_SPACES_*` settings and add malware scanning/quarantine before opening
documents in reviewer devices.
