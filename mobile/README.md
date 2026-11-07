# Kaya mobile application

Kaya uses React Native, Expo and TypeScript to produce standalone iOS and Android applications. Patients install Kaya itself. Expo Go is not part of the customer journey. Angola is the first target market; Portugal is prepared alongside it through the shared market policy.

## Current implementation

The default `App.tsx` renders planning information. Existing account, patient and clinician screens are preserved, including the recovered consultation list, but are not mounted by that entry point. API requests remain restricted by the current application policy. A successful build or API URL configuration does not enable clinical services.

The dependency lock currently uses Expo SDK 52 and React Native 0.76.9. Review the upgrade path and native integration compatibility before release. App icons under `assets/` are still placeholder images, and native device/store validation remains outstanding.

## Local development

Use Node 22.18 or newer and install from the lockfile:

```bash
cd mobile
npm ci
npm run typecheck
npm test
```

Create a development build on the target platform:

```bash
npm run ios
# or
npm run android
```

These commands compile the native project with Expo. iOS requires a configured Xcode installation on macOS; Android requires the Android SDK and an emulator or connected device. Once the development build is installed, `npm start` connects it to the JavaScript development server. No physical-device build is claimed by TypeScript or unit-test success.

## API configuration

Use `EXPO_PUBLIC_API_URL` for the intended backend. `EXPO_PUBLIC_API_BASE_URL` remains a legacy alias. Expo public variables are included in the app bundle; never place credentials in them.

For local development, choose an address reachable by the test device: iOS Simulator can use the Mac's localhost, the standard Android emulator uses `10.0.2.2`, and physical devices need a reachable development-server address. Local HTTP is allowed only in development mode. Release API initialization requires an explicit HTTPS endpoint and rejects localhost, emulator addresses, embedded credentials and query parameters. Configure the value in the build environment, not just the developer's shell.

The informational entry does not import the operational API client. This means building the informational app does not prove an endpoint is configured, reachable or ready for patient use.

## Standalone build profiles

| Profile | Output and purpose |
| --- | --- |
| `development` | Development client with developer tooling; requires a development server |
| `preview` | Internal standalone build; Android APK, with no development client |
| `production` | Store distribution build with version incrementing |

EAS profiles are defined in `eas.json`. The project account, platform signing and distribution credentials must be configured before producing distributable builds. EAS cloud services are optional; native builds can also be produced locally. The `com.kayahealth.app` identifiers are configured values, not evidence of store registration or ownership verification.

Before the first standalone preview, replace the placeholder icons, confirm native module/plugin compatibility and test the intended screens on devices. Before clinical release, complete account access, consent, verification, consultation and country-specific service readiness. Test video, uploads, notifications and interrupted connections using synthetic records first. Payments remain in the final implementation phase.

## Code and checks

- `src/phase1/policy.ts` reads the generated shared market/capability policy.
- `src/config/apiUrl.ts` validates development and distribution API addresses.
- `src/services/api.ts` handles authentication tokens and API access.
- `src/navigation/` and `src/screens/` contain the preserved application flows.
- `scripts/api-url.test.mjs` checks endpoint handling with Node and the URL implementation used by the installed Expo SDK.
- The repository's technical-checks workflow runs mobile type checking and configuration tests.

See the [Expo development-build guide](https://docs.expo.dev/develop/development-builds/introduction/) and [EAS build profiles](https://docs.expo.dev/build/eas-json/) for the build mechanisms. The [product plan](../PRODUCT_AND_LAUNCH_PLAN.md) defines Kaya's rollout and implementation priorities.
