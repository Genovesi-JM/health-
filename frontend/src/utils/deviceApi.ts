/**
 * deviceApi.ts — CareFast+ Device Integration Layer
 *
 * Stubs for Bluetooth (Web Bluetooth API) and WiFi device connectivity.
 * Replace each TODO section with real SDK / API calls when hardware is available.
 *
 * Supported devices (planned):
 *   - BLE blood pressure monitors (e.g. A&D UA-651BLE, Beurer BM57)
 *   - BLE pulse oximeters (e.g. Nonin 3230)
 *   - BLE glucometers
 *   - WiFi-enabled scales / thermometers
 */

export interface VitalReadings {
  systolic?: number;    // mmHg
  diastolic?: number;   // mmHg
  spo2?: number;        // %
  temperature?: number; // °C
  glucose?: number;     // mg/dL
  heartRate?: number;   // bpm
  readAt: string;       // ISO timestamp
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'bluetooth' | 'wifi';
  status: 'connected' | 'disconnected' | 'error';
}

// ─────────────────────────────────────────────────────────────
// BLUETOOTH (Web Bluetooth API)
// ─────────────────────────────────────────────────────────────

/**
 * Check if Web Bluetooth is available in this browser/OS.
 */
export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Scan for nearby BLE health devices.
 * TODO: Replace with real requestDevice() call using service UUIDs.
 *   navigator.bluetooth.requestDevice({
 *     filters: [{ services: ['blood_pressure', 'pulse_oximeter', 'health_thermometer'] }]
 *   })
 */
export async function scanBluetooth(): Promise<DeviceInfo[]> {
  if (!isBluetoothAvailable()) {
    throw new Error('Web Bluetooth API not supported in this browser.');
  }

  // TODO: implement real BLE device discovery
  // Example:
  // const device = await navigator.bluetooth.requestDevice({
  //   acceptAllDevices: true,
  //   optionalServices: ['blood_pressure', '00001810-0000-1000-8000-00805f9b34fb']
  // });
  // return [{ id: device.id, name: device.name ?? 'Unknown', type: 'bluetooth', status: 'disconnected' }];

  // Stub: simulate a 1.5s scan and return mock devices
  await new Promise(res => setTimeout(res, 1500));
  return [
    { id: 'bt-mock-001', name: 'CareFast BP Monitor', type: 'bluetooth', status: 'disconnected' },
    { id: 'bt-mock-002', name: 'CareFast SpO₂ Sensor', type: 'bluetooth', status: 'disconnected' },
  ];
}

/**
 * Connect to a BLE device by ID.
 * TODO: Use real GATT server connection.
 */
export async function connectBluetooth(deviceId: string): Promise<DeviceInfo> {
  // TODO: const server = await device.gatt?.connect();
  await new Promise(res => setTimeout(res, 800));
  return { id: deviceId, name: 'CareFast Device', type: 'bluetooth', status: 'connected' };
}

/**
 * Read vitals from a connected BLE device.
 * TODO: Subscribe to GATT characteristic notifications.
 */
export async function readBluetoothVitals(_deviceId: string): Promise<VitalReadings> {
  // TODO: Read from GATT characteristics:
  //   Blood Pressure: service 0x1810, char 0x2A35
  //   SpO2:           service 0x1822, char 0x2A5F
  //   Temperature:    service 0x1809, char 0x2A1C
  await new Promise(res => setTimeout(res, 1000));
  return {
    systolic: 118,
    diastolic: 76,
    spo2: 98,
    temperature: 36.8,
    heartRate: 72,
    readAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// WiFi / LAN DEVICES
// ─────────────────────────────────────────────────────────────

/**
 * Connect to a WiFi health device by local IP address.
 * TODO: Replace with real HTTP/REST call to device API endpoint.
 */
export async function connectWifi(ipAddress: string): Promise<DeviceInfo> {
  // TODO: const res = await fetch(`http://${ipAddress}/api/info`);
  await new Promise(res => setTimeout(res, 1200));
  return { id: `wifi-${ipAddress}`, name: `WiFi Device @ ${ipAddress}`, type: 'wifi', status: 'connected' };
}

/**
 * Read vitals from a WiFi-connected device.
 * TODO: Call device REST endpoint, e.g. GET http://{ip}/api/vitals
 */
export async function readWifiVitals(ipAddress: string): Promise<VitalReadings> {
  // TODO: const res = await fetch(`http://${ipAddress}/api/vitals`);
  //       const data = await res.json();
  //       return { systolic: data.sbp, diastolic: data.dbp, ... };
  void ipAddress;
  await new Promise(res => setTimeout(res, 800));
  return {
    glucose: 95,
    temperature: 36.6,
    readAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// BACKEND UPLOAD
// ─────────────────────────────────────────────────────────────

/**
 * Upload device vitals to CareFast+ backend for a given triage session.
 * TODO: Wire to POST /api/v1/triage/{sessionId}/vitals once endpoint is ready.
 */
export async function uploadVitalsToSession(
  _apiInstance: unknown,
  _sessionId: string,
  vitals: VitalReadings,
): Promise<void> {
  // TODO:
  // await api.post(`/api/v1/triage/${sessionId}/vitals`, vitals);
  console.debug('[deviceApi] Vitals ready for upload:', vitals);
}
