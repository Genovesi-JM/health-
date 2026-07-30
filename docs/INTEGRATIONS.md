# KAYA integration guide

This document separates what is executable today from adapters that still need
provider onboarding and real credentials. Example values in `.env.example` are
deliberately rejected as credentials and can never confirm a payment.

## RENPHO Health

### Test now: semi-automatic CSV import

1. Pair the scale in the RENPHO Health mobile app and take a measurement.
2. In RENPHO Health, open **History**, choose **Export data**, and save the CSV.
3. In KAYA, open **Measurements** and choose **Import RENPHO Health CSV**.
4. Select the exported file. KAYA imports weight and available body-composition
   values, while ignoring rows that were imported previously.

The API endpoint is `POST /api/v1/readings/import`. It accepts an authenticated
patient CSV upload, validates plausible values, limits files to 2 MB and 2,000
rows, and records the source as `renpho_csv`.

### Automatic sync path

RENPHO's consumer documentation describes syncing into Apple Health and Google
health platforms, but does not publish a general partner API. The production
path should therefore be:

- iOS: RENPHO Health → Apple Health → KAYA through HealthKit.
- Android: RENPHO Health/compatible source → Health Connect → KAYA.

Both require explicit patient consent and a native mobile build. KAYA now
contains the HealthKit and Health Connect bridges:

- iOS reads weight, body-fat percentage, BMI, lean body mass, height and waist
  circumference. HealthKit anchors and source sample UUIDs make retries
  incremental and idempotent.
- Android reads Weight, BodyFat, LeanBodyMass, Height, BodyWaterMass, BoneMass
  and BasalMetabolicRate records from Health Connect. It re-reads a small overlap
  window and deduplicates records by their Health Connect identifiers.
- The app synchronizes when it opens, whenever it returns to the foreground,
  when HealthKit emits an observer update, every 15 minutes while running, and
  through an OS-scheduled background task. iOS and Android ultimately control
  when background work runs, so it is intentionally not described as instant.
- Server synchronization uses `POST /api/v1/readings/sync`, physiological range
  validation and a unique patient/source/external-ID index.

The native authorization flow cannot run inside Expo Go.

### Physical-device build and RENPHO test

1. Set `EXPO_PUBLIC_API_BASE_URL` to a TLS KAYA backend reachable by the phone.
2. Apply the backend migrations, including
   `add_health_sync_external_ids_v1`.
3. Create a development client:

   ```bash
   cd mobile
   npx eas build --profile development --platform ios
   # or
   npx eas build --profile development --platform android
   ```

4. Install the signed build. In RENPHO Health, enable all supported sharing to
   Apple Health. On Android, enable RENPHO's supported health-platform sharing
   and verify the new measurement is visible in Health Connect.
5. In KAYA, open **Measurements**, tap **Connect Apple Health** or
   **Connect Health Connect**, grant the requested read permissions, then weigh
   once with bare feet.
6. Confirm the measurement appears in KAYA with its platform source. Repeating
   synchronization must not create a duplicate.

RENPHO's current Android consumer documentation explicitly guarantees Google
Fit weight synchronization, not every body-composition field in Health Connect.
If a specific RENPHO model does not expose a metric to Health Connect, KAYA
keeps the CSV importer as the supported fallback for that field.

## Payment discovery API

`GET /api/v1/billing/payment-methods` accepts:

- `country`: two-letter ISO country, default `AO`
- `currency`: optional three-letter ISO currency; inferred from the country
- `include_planned`: include adapters that are designed but not executable

Each returned method reports its provider, markets, currencies, channels,
integration status, and whether it is in test mode.

### Coverage

| Market | Methods represented |
| --- | --- |
| Angola | Multicaixa Express, international cards, IBAN/bank transfer |
| Portugal | Multibanco, international cards, SEPA/IBAN, PayPal |
| Spain | Bizum preview, international cards, SEPA/IBAN, PayPal |
| Paystack markets | Nigeria, Ghana, Kenya, South Africa |
| Mobile Money | Cameroon, Côte d'Ivoire, Ethiopia, Ghana, Kenya, Rwanda, Senegal, Tanzania, Uganda, Zambia |
| SADC | DPO adapter contract for regional cards, bank transfer, and mobile money |

Multicaixa Express, cards, bank transfer and PayPal use the existing checkout
contract. Multibanco, Bizum, Paystack, Flutterwave and DPO are discovery-ready
contracts; their provider-specific checkout and webhook adapters must be
completed after commercial onboarding.

### Safe configuration

Copy `backend/.env.example` to a local environment file and replace only the
providers being tested. Values containing `REPLACE_WITH` or `EXAMPLE` are
treated as unconfigured. In development, simulated checkout remains pending.
Only a valid signed webhook, a successful provider status response, or an
explicit admin reconciliation can mark a consultation paid.

Before enabling a provider in production:

1. Load credentials through the deployment secret manager.
2. Configure the exact webhook URL and signing secret.
3. Test success, decline, cancellation, timeout, duplicate webhook, and refund.
4. Confirm settlement currency, fees, tax invoices, and market eligibility.
5. Run a low-value live transaction and reconcile it against the provider
   dashboard before exposing the method to patients.

## Translation

The web app and public website use the shared web translation context for
Portuguese, English, French, and Spanish. The mobile app now has a persistent
language context and translated navigation, home, and settings surfaces. New
features should add the same semantic key in all four locales instead of
embedding visible text directly in a component.

## KPI contract

Patient, nurse, and doctor dashboards use the shared `KpiGrid` visual component.
Displayed values come from authenticated application data:

- Patient: appointments, unread messages, prescriptions, and readings.
- Nurse: queue, urgent patients, active attendances, and completed work.
- Doctor: today's consultations, waiting and active patients, weekly completed
  consultations, pending prescriptions, and unique patients.

Do not substitute sample revenue, rating, or patient counts in production
dashboards. New KPIs should define a source query, role authorization, empty
state, time window, and audit/test case before being displayed.
