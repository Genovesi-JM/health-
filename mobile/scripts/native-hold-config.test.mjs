import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
const { compileModsAsync } = require('expo/config-plugins');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const { applyReleasePermissionPolicy } = require('../plugins/withInformationalHold.cjs');

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

test('release HOLD removes optional biometric, overlay and foreground permissions without changing debug tooling', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kaya-hold-manifest-'));
  const debug = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" /></manifest>';
  const main = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET" /></manifest>';
  try {
    for (const [variant, content] of [['debug', debug], ['main', main]]) {
      await mkdir(path.join(root, `app/src/${variant}`), { recursive: true });
      await writeFile(path.join(root, `app/src/${variant}/AndroidManifest.xml`), content);
    }
    await applyReleasePermissionPolicy(root);
    const release = path.join(root, 'app/src/release/AndroidManifest.xml');
    const first = await readFile(release, 'utf8');
    await applyReleasePermissionPolicy(root);
    assert.equal(await readFile(release, 'utf8'), first);
    const { AndroidConfig } = require('expo/config-plugins');
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(release);
    assert.equal(manifest.manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
    for (const name of ['USE_BIOMETRIC', 'USE_FINGERPRINT', 'SYSTEM_ALERT_WINDOW', 'FOREGROUND_SERVICE']) {
      assert.equal(manifest.manifest['uses-permission'].find(entry => entry.$['android:name'] === `android.permission.${name}`)?.$['tools:node'], 'remove');
    }
    manifest.manifest.application = [{ $: { 'android:usesCleartextTraffic': 'false' } }];
    await AndroidConfig.Manifest.writeAndroidManifestAsync(release, manifest);
    await applyReleasePermissionPolicy(root);
    assert.equal((await AndroidConfig.Manifest.readAndroidManifestAsync(release)).manifest.application[0].$['android:usesCleartextTraffic'], 'false');
    assert.equal(await readFile(path.join(root, 'app/src/debug/AndroidManifest.xml'), 'utf8'), debug);
    assert.equal(await readFile(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8'), main);
  } finally { await rm(root, { recursive: true, force: true }); }
});
