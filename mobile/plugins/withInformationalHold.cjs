const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

// The shipped entry is informational. Dependencies kept for the future clinical
// client must not silently add permissions or background execution capabilities.
module.exports = function withInformationalHold(config) {
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
