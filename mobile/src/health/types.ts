export type HealthSource = 'apple_health' | 'health_connect';

export interface HealthReading {
  external_id: string;
  reading_type:
    | 'weight'
    | 'body_fat'
    | 'bmi'
    | 'lean_body_mass'
    | 'body_water_mass'
    | 'bone_mass'
    | 'height'
    | 'waist_circumference'
    | 'basal_metabolic_rate';
  value: number;
  unit: string;
  measured_at: string;
  source: HealthSource;
  source_app?: string;
  device_brand?: string;
  device_model?: string;
}

export type HealthCursors = Record<string, string>;

export interface HealthReadResult {
  records: HealthReading[];
  cursors: HealthCursors;
}

export interface PlatformHealthAdapter {
  displayName: string;
  isAvailable(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  readChanges(cursors: HealthCursors): Promise<HealthReadResult>;
  subscribe(onChange: () => void): Promise<() => void>;
  openSettings(): void;
}
