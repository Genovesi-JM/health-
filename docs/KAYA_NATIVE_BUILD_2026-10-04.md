# Native SDK and build validation — 4 October 2026

Kaya remains a standalone React Native application. Customers do not need Expo
Go. Expo supplies build/runtime libraries; the installed application uses Kaya's
name, identifiers and branding. The current packaged entry is informational and
clinical activation remains HOLD.

## SDK upgrade and compatibility

The migration was verified incrementally from Expo SDK52 through53,54,55,56 and57,
following [Expo's upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
The final graph uses Expo57.0.26, React Native0.86.3 and React19.2.3 on Node24.21.0.
React Navigation7 aligns with react-native-screens4.26. The deprecated background
fetch API was replaced by BackgroundTask, retaining explicit owner checks and a
15-minute minimum interval in the correct units. The OS determines actual run
times. Clinical background work remains disabled at the informational boundary.

HealthKit8.3.0 and HealthConnect3.5 remain at the existing bridge versions. An
Android compile and JS exports are evidence of build compatibility; they do not
verify health-data access on a real device or the iOS native bridge.

The xcode dependency's UUID dependency is narrowly overridden to11.1.1 to remove
a patchable advisory. Committed regressions exercise real project parsing,
writing and unique project identifiers. No global dependency-major override or
unsafe automatic Expo downgrade was applied.

## Native configuration and branding

The previous 1-pixel placeholder PNGs were replaced with rendered assets from the
existing Kaya vector logo. Source SVGs are retained beside the generated icons
and splash. The application title remains KAYA, with the existing Android/iOS
identifiers.

Actual resolved Expo plugins initially added camera, microphone, photo, biometric
and background permissions despite the informational configuration. Explicit
plugin options and a final iOS configuration plugin now strip those capabilities.
A test resolves every plugin and checks the generated native configuration. The
packaged Android manifest was separately inspected and contains none of the
blocked clinical/media/background permissions. Android uses target/compile36 and
minimum26.

## Local validation and artifacts

- 101 mobile helper/API/configuration tests pass; TypeScript, Expo dependency
  compatibility and Expo Doctor21/21 pass against the CNG source project.
- iOS and Android Hermes exports pass for both the informational entry and the
  preserved operational navigator. The temporary operational export entry was
  never adopted as the application's main entry.
- An arm64 Android debug build passed (373 tasks). A separate release-mode local
  test build passed (624 tasks), includes the Hermes bundle and starts without
  Metro or Expo Go. It uses the generated local test key, not production signing.
- The standalone informational APK is kept in ignored
  `artifacts/native/kaya-sdk57-informational-test-arm64.apk`. It is not a store
  release. It was not installed onto a user's phone.
- iOS native compilation is blocked by the host's unaccepted Xcode license.
  No license agreement was accepted. JavaScript export/prebuild success does not
  establish iOS native compilation or device behavior.

The SDK checkpoint's [evidence manifest](evidence/mobile-sdk57-2026-10-04/manifest.json)
links package audits, CycloneDX inventories, generated-configuration/native-build
checks and source hashes. The audit used npm11.18.0 with Node24.21.0; this is
recorded explicitly rather than assuming the audit CLI was Node's bundled npm.

## Remaining dependency findings

The production dependency audit falls from68 affected package nodes
(1critical,43high,24moderate) to16high nodes. Those16 nodes trace to two underlying
advisories with no published fixed version at the check date:

- braces3.0.3: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  reached through Metro file matching.
- node-forge1.4.0: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
  reached through Expo CLI certificate/signature tooling.

The package-graph scans are not an inventory of APK contents or a conclusion
about native exploitability. No risk acceptance was granted. Named security-owner
triage or an upstream remediation remains required by the existing release gate.

The npm `--omit=dev` SBOM initially omitted direct Expo/ReactNative components and
was rejected as incomplete. The stored production SBOM uses a temporary lockfile
projection that removes only root development edges; an independent traversal of
the original lock verifies all528 unique reachable components (570 installed
nodes), with no missing or additional components. Some root development tools
are independently reachable through Expo/RN dependency and peer paths. The
production and all-dependency inventories are therefore equal at this checkpoint.
