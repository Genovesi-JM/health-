import type { PlatformHealthAdapter } from './types';

const unavailableAdapter: PlatformHealthAdapter = {
  displayName: 'Health service',
  async isAvailable() { return false; },
  async requestAuthorization() { return false; },
  async readChanges(cursors) { return { records: [], cursors }; },
  async subscribe() { return () => {}; },
  openSettings() {},
};

export default unavailableAdapter;
