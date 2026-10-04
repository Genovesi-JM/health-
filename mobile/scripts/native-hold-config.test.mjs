import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
const { compileModsAsync } = require('expo/config-plugins');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('all resolved native plugins preserve the informational HOLD permissions', async () => {
  const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['ios', 'android'] });
  const resolved = await compileModsAsync(exp, {
    projectRoot, platforms: ['ios', 'android'], introspect: true, ignoreExistingNativeFiles: true,
  });
  const native = resolved._internal.modResults;
  for (const key of [
    'NSCameraUsageDescription', 'NSMicrophoneUsageDescription',
    'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription',
    'NSFaceIDUsageDescription', 'NSHealthShareUsageDescription',
    'NSHealthUpdateUsageDescription', 'UIBackgroundModes', 'BGTaskSchedulerPermittedIdentifiers',
  ]) assert.equal(native.ios.infoPlist[key], undefined, `${key} must remain absent`);
  assert.equal(Object.keys(native.ios.entitlements).some((key) => key.startsWith('com.apple.developer.healthkit')), false);

  const permissions = native.android.manifest.manifest['uses-permission'].map((entry) => entry.$);
  for (const name of [
    'CAMERA', 'RECORD_AUDIO', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO',
    'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK',
    'health.READ_WEIGHT', 'health.READ_BODY_FAT', 'health.READ_LEAN_BODY_MASS',
    'health.READ_HEIGHT', 'health.READ_BODY_WATER_MASS', 'health.READ_BONE_MASS',
    'health.READ_BASAL_METABOLIC_RATE', 'health.READ_HEALTH_DATA_IN_BACKGROUND',
  ]) {
    const entry = permissions.find((item) => item['android:name'] === `android.permission.${name}`);
    assert.equal(entry?.['tools:node'], 'remove', `${name} must be denied during manifest merging`);
  }
});
