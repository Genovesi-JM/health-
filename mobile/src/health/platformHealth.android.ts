import { Linking, Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { HealthCursors, HealthReading, PlatformHealthAdapter } from './types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const STANDARD_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Weight' as const },
  { accessType: 'read' as const, recordType: 'BodyFat' as const },
  { accessType: 'read' as const, recordType: 'LeanBodyMass' as const },
  { accessType: 'read' as const, recordType: 'Height' as const },
  { accessType: 'read' as const, recordType: 'BodyWaterMass' as const },
  { accessType: 'read' as const, recordType: 'BoneMass' as const },
  { accessType: 'read' as const, recordType: 'BasalMetabolicRate' as const },
];

type Converter = (record: any) => { value: number; unit: string };
const TYPES: Array<{
  recordType: typeof STANDARD_PERMISSIONS[number]['recordType'];
  readingType: HealthReading['reading_type'];
  convert: Converter;
}> = [
  { recordType: 'Weight', readingType: 'weight', convert: r => ({ value: r.weight.inKilograms, unit: 'kg' }) },
  { recordType: 'BodyFat', readingType: 'body_fat', convert: r => ({ value: r.percentage, unit: '%' }) },
  { recordType: 'LeanBodyMass', readingType: 'lean_body_mass', convert: r => ({ value: r.mass.inKilograms, unit: 'kg' }) },
  { recordType: 'Height', readingType: 'height', convert: r => ({ value: r.height.inMeters, unit: 'm' }) },
  { recordType: 'BodyWaterMass', readingType: 'body_water_mass', convert: r => ({ value: r.mass.inKilograms, unit: 'kg' }) },
  { recordType: 'BoneMass', readingType: 'bone_mass', convert: r => ({ value: r.mass.inKilograms, unit: 'kg' }) },
  { recordType: 'BasalMetabolicRate', readingType: 'basal_metabolic_rate', convert: r => ({ value: r.basalMetabolicRate.inKilocaloriesPerDay, unit: 'kcal/day' }) },
];

async function readAllPages(type: typeof TYPES[number], startTime: string) {
  const records: HealthReading[] = [];
  let pageToken: string | undefined;
  let page = 0;
  do {
    const response = await readRecords(type.recordType, {
      timeRangeFilter: { operator: 'after', startTime },
      ascendingOrder: true,
      pageSize: 500,
      pageToken,
    });
    for (const record of response.records as any[]) {
      const converted = type.convert(record);
      const origin = record.metadata?.dataOrigin;
      const stableId = record.metadata?.id
        ?? `${type.recordType}:${record.time}:${converted.value}:${origin ?? 'unknown'}`;
      records.push({
        external_id: stableId,
        reading_type: type.readingType,
        value: converted.value,
        unit: converted.unit,
        measured_at: record.time,
        source: 'health_connect',
        source_app: origin,
        device_brand: record.metadata?.device?.manufacturer,
        device_model: record.metadata?.device?.model,
      });
    }
    pageToken = response.pageToken;
    page += 1;
  } while (pageToken && page < 4);
  return records;
}

const healthConnect: PlatformHealthAdapter = {
  displayName: 'Health Connect',

  async isAvailable() {
    return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE;
  },

  async requestAuthorization() {
    if (!(await initialize())) return false;
    const granted = await requestPermission(STANDARD_PERMISSIONS);
    const hasStandardAccess = STANDARD_PERMISSIONS.every(permission =>
      granted.some(item =>
        item.accessType === permission.accessType
        && item.recordType === permission.recordType,
      ),
    );
    if (typeof Platform.Version === 'number' && Platform.Version >= 34) {
      await requestPermission([
        { accessType: 'read', recordType: 'BackgroundAccessPermission' },
      ]).catch(() => []);
    }
    return hasStandardAccess;
  },

  async readChanges(cursors: HealthCursors) {
    if (!(await initialize())) return { records: [], cursors };
    const previous = Number(cursors.last_sync_ms || 0);
    const earliest = Date.now() - THIRTY_DAYS_MS;
    const startTime = new Date(Math.max(earliest, previous - 24 * 60 * 60 * 1000)).toISOString();
    const pages = await Promise.all(TYPES.map(type => readAllPages(type, startTime)));
    return {
      records: pages.flat(),
      cursors: { ...cursors, last_sync_ms: String(Date.now()) },
    };
  },

  async subscribe() {
    // Health Connect has no push notification for new records. KAYA syncs on
    // app foreground and on a periodic in-process timer.
    return () => {};
  },

  openSettings() {
    void Linking.openSettings();
  },
};

export default healthConnect;
