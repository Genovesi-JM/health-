const { withInfoPlist, withEntitlementsPlist, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const RELEASE_ONLY_BLOCKED_PERMISSIONS = [
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
];

async function applyReleasePermissionPolicy(androidProjectRoot) {
  const manifestPath = path.join(androidProjectRoot, 'app/src/release/AndroidManifest.xml');
  let manifest;
  try {
    await fs.access(manifestPath);
    manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    manifest = { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' } } };
  }
  AndroidConfig.Manifest.ensureToolsAvailable(manifest);
  const permissions = manifest.manifest['uses-permission'] || [];
  manifest.manifest['uses-permission'] = [
    ...permissions.filter(entry => !RELEASE_ONLY_BLOCKED_PERMISSIONS.includes(entry.$?.['android:name'])),
    ...RELEASE_ONLY_BLOCKED_PERMISSIONS.map(name => ({ $: { 'android:name': name, 'tools:node': 'remove' } })),
  ];
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
}

// The shipped entry is informational. Dependencies kept for the future clinical
// client must not silently add permissions or background execution capabilities.
module.exports = function withInformationalHold(config) {
  // Development overlays may still need these permissions. Only the standalone
  // release variant is informational, so leave debug/dev-client manifests intact.
  config = withDangerousMod(config, ['android', async (result) => {
    await applyReleasePermissionPolicy(result.modRequest.platformProjectRoot);
    return result;
  }]);
  config = withInfoPlist(config, (result) => {
    for (const key of [
      'NSCameraUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSPhotoLibraryAddUsageDescription',
      'NSFaceIDUsageDescription',
      'NSHealthShareUsageDescription',
      'NSHealthUpdateUsageDescription',
      'UIBackgroundModes',
      'BGTaskSchedulerPermittedIdentifiers',
    ]) delete result.modResults[key];
    return result;
  });
  return withEntitlementsPlist(config, (result) => {
    for (const key of Object.keys(result.modResults)) {
      if (key.startsWith('com.apple.developer.healthkit')) delete result.modResults[key];
    }
    return result;
  });
};

module.exports.applyReleasePermissionPolicy = applyReleasePermissionPolicy;
