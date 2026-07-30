import HealthKit, {
  HKQuantityTypeIdentifier,
  HKUnits,
  HKUpdateFrequency,
} from '@kingstinct/react-native-healthkit';
import type { HealthCursors, HealthReading, PlatformHealthAdapter } from './types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const TYPES = [
  { id: HKQuantityTypeIdentifier.bodyMass, key: 'weight', unit: 'kg' },
  // HealthKit percentages are fractions (0.20), while KAYA and Health
  // Connect use display percentages (20).
  {
    id: HKQuantityTypeIdentifier.bodyFatPercentage,
    key: 'body_fat',
    unit: HKUnits.Percent,
    multiplier: 100,
  },
  { id: HKQuantityTypeIdentifier.bodyMassIndex, key: 'bmi', unit: 'count' },
  { id: HKQuantityTypeIdentifier.leanBodyMass, key: 'lean_body_mass', unit: 'kg' },
  { id: HKQuantityTypeIdentifier.height, key: 'height', unit: 'm' },
  { id: HKQuantityTypeIdentifier.waistCircumference, key: 'waist_circumference', unit: 'cm' },
] as const;

async function readType(
  type: typeof TYPES[number],
  anchor?: string,
): Promise<{ records: HealthReading[]; anchor: string }> {
  const records: HealthReading[] = [];
  let currentAnchor = anchor;
  let nextAnchor = anchor ?? '';
  let page = 0;

  do {
    const result = await HealthKit.queryQuantitySamplesWithAnchor(type.id, {
      anchor: currentAnchor,
      from: anchor ? undefined : new Date(Date.now() - THIRTY_DAYS_MS),
      limit: 500,
      unit: type.unit as never,
    });
    nextAnchor = result.newAnchor;
    for (const sample of result.samples) {
      records.push({
        external_id: sample.uuid,
        reading_type: type.key,
        value: sample.quantity * ('multiplier' in type ? type.multiplier : 1),
        unit: type.unit,
        measured_at: sample.startDate.toISOString(),
        source: 'apple_health',
        source_app: sample.sourceRevision?.source.bundleIdentifier,
        device_brand: sample.device?.manufacturer || undefined,
        device_model: sample.device?.model || sample.sourceRevision?.source.name,
      });
    }
    currentAnchor = result.newAnchor;
    page += 1;
    if (result.samples.length < 500) break;
  } while (page < 4);

  return { records, anchor: nextAnchor };
}

const appleHealth: PlatformHealthAdapter = {
  displayName: 'Apple Health',

  async isAvailable() {
    return HealthKit.isHealthDataAvailable();
  },

  async requestAuthorization() {
    const identifiers = TYPES.map(type => type.id);
    const granted = await HealthKit.requestAuthorization(identifiers);
    if (!granted) return false;
    await Promise.all(
      identifiers.map(identifier =>
        HealthKit.enableBackgroundDelivery(identifier, HKUpdateFrequency.immediate)
          .catch(() => false),
      ),
    );
    return true;
  },

  async readChanges(cursors: HealthCursors) {
    const records: HealthReading[] = [];
    const nextCursors = { ...cursors };
    for (const type of TYPES) {
      const result = await readType(type, cursors[type.key]);
      records.push(...result.records);
      nextCursors[type.key] = result.anchor;
    }
    return { records, cursors: nextCursors };
  },

  async subscribe(onChange) {
    const unsubscribe = await Promise.all(
      TYPES.map(type => HealthKit.subscribeToChanges(type.id, onChange)),
    );
    return () => { void Promise.all(unsubscribe.map(stop => stop())); };
  },

  openSettings() {
    // Apple does not provide a HealthKit-specific settings deep link.
    // Permissions can be changed in Health > profile > Apps > KAYA.
  },
};

export default appleHealth;
