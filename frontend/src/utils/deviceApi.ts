/**
 * Device integration boundary for KAYA.
 *
 * Bluetooth uses standard Bluetooth SIG health profiles. Wi-Fi devices are
 * intentionally routed through a configured vendor gateway so the browser
 * never proxies arbitrary local addresses or pretends a device is connected.
 */

export type VitalSource = 'manual' | 'bluetooth' | 'wifi';

export interface VitalReadings {
  systolic?: number;
  diastolic?: number;
  spo2?: number;
  temperature?: number;
  glucose?: number;
  heartRate?: number;
  readAt: string;
  source?: VitalSource;
  deviceName?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'bluetooth' | 'wifi';
  status: 'connected' | 'disconnected' | 'error';
}

interface BluetoothRemoteGATTCharacteristicLike {
  readValue(): Promise<DataView>;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServerLike>;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
}

interface BluetoothNavigatorLike {
  requestDevice(options: {
    filters: Array<{ services: Array<string | number> }>;
    optionalServices: Array<string | number>;
  }): Promise<BluetoothDeviceLike>;
}

const HEALTH_SERVICES = [
  'blood_pressure',
  'heart_rate',
  'health_thermometer',
  'pulse_oximeter',
  'glucose',
] as const;

const bluetoothDevices = new Map<string, BluetoothDeviceLike>();
const bluetoothServers = new Map<string, BluetoothRemoteGATTServerLike>();

export class DeviceIntegrationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DeviceIntegrationError';
    this.code = code;
  }
}

export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Opens the browser's secure device chooser. Web Bluetooth does not expose a
 * passive scan list; each call returns the device explicitly approved by the
 * patient.
 */
export async function scanBluetooth(): Promise<DeviceInfo[]> {
  if (!isBluetoothAvailable()) {
    throw new DeviceIntegrationError(
      'Bluetooth health devices require Chrome or Edge on a compatible device.',
      'bluetooth_not_supported',
    );
  }

  try {
    const bluetooth = (navigator as Navigator & { bluetooth: BluetoothNavigatorLike }).bluetooth;
    const device = await bluetooth.requestDevice({
      filters: HEALTH_SERVICES.map(service => ({ services: [service] })),
      optionalServices: [...HEALTH_SERVICES],
    });
    bluetoothDevices.set(device.id, device);
    return [{
      id: device.id,
      name: device.name || 'Bluetooth health device',
      type: 'bluetooth',
      status: device.gatt?.connected ? 'connected' : 'disconnected',
    }];
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return [];
    throw new DeviceIntegrationError(
      error instanceof Error ? error.message : 'Unable to open the Bluetooth device chooser.',
      'bluetooth_scan_failed',
    );
  }
}

export async function connectBluetooth(deviceId: string): Promise<DeviceInfo> {
  const device = bluetoothDevices.get(deviceId);
  if (!device?.gatt) {
    throw new DeviceIntegrationError('Choose the Bluetooth device again.', 'bluetooth_device_missing');
  }

  try {
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    bluetoothServers.set(deviceId, server);
    return {
      id: device.id,
      name: device.name || 'Bluetooth health device',
      type: 'bluetooth',
      status: 'connected',
    };
  } catch (error) {
    throw new DeviceIntegrationError(
      error instanceof Error ? error.message : 'Could not connect to the Bluetooth device.',
      'bluetooth_connection_failed',
    );
  }
}

function ieee11073SFloat(raw: number): number {
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x0008) exponent -= 0x0010;
  return mantissa * (10 ** exponent);
}

async function readCharacteristic(
  server: BluetoothRemoteGATTServerLike,
  serviceId: string,
  characteristicId: string,
): Promise<DataView | null> {
  try {
    const service = await server.getPrimaryService(serviceId);
    return await (await service.getCharacteristic(characteristicId)).readValue();
  } catch {
    return null;
  }
}

/** Reads every supported standard characteristic exposed by the device. */
export async function readBluetoothVitals(deviceId: string): Promise<VitalReadings> {
  const server = bluetoothServers.get(deviceId);
  const device = bluetoothDevices.get(deviceId);
  if (!server?.connected) {
    throw new DeviceIntegrationError('The Bluetooth device is not connected.', 'bluetooth_not_connected');
  }

  const readings: VitalReadings = {
    readAt: new Date().toISOString(),
    source: 'bluetooth',
    deviceName: device?.name,
  };

  const [bp, heartRate, temperature, oxygen, glucose] = await Promise.all([
    readCharacteristic(server, 'blood_pressure', 'blood_pressure_measurement'),
    readCharacteristic(server, 'heart_rate', 'heart_rate_measurement'),
    readCharacteristic(server, 'health_thermometer', 'temperature_measurement'),
    readCharacteristic(server, 'pulse_oximeter', 'plx_continuous_measurement'),
    readCharacteristic(server, 'glucose', 'glucose_measurement'),
  ]);

  if (bp && bp.byteLength >= 7) {
    const flags = bp.getUint8(0);
    const kPa = Boolean(flags & 0x01);
    const multiplier = kPa ? 7.50062 : 1;
    readings.systolic = Math.round(ieee11073SFloat(bp.getUint16(1, true)) * multiplier);
    readings.diastolic = Math.round(ieee11073SFloat(bp.getUint16(3, true)) * multiplier);
    if (flags & 0x04) {
      let offset = 7;
      if (flags & 0x02) offset += 7;
      if (bp.byteLength >= offset + 2) readings.heartRate = Math.round(ieee11073SFloat(bp.getUint16(offset, true)));
    }
  }

  if (heartRate && heartRate.byteLength >= 2) {
    readings.heartRate = heartRate.getUint8(0) & 0x01
      ? heartRate.getUint16(1, true)
      : heartRate.getUint8(1);
  }

  if (temperature && temperature.byteLength >= 5) {
    const raw = temperature.getUint32(1, true);
    let mantissa = raw & 0x00ffffff;
    let exponent = raw >> 24;
    if (mantissa >= 0x00800000) mantissa -= 0x01000000;
    if (exponent >= 0x80) exponent -= 0x100;
    const value = mantissa * (10 ** exponent);
    readings.temperature = Number(((temperature.getUint8(0) & 0x01) ? (value - 32) * 5 / 9 : value).toFixed(1));
  }

  if (oxygen && oxygen.byteLength >= 5) {
    readings.spo2 = Number(ieee11073SFloat(oxygen.getUint16(1, true)).toFixed(1));
    readings.heartRate = Math.round(ieee11073SFloat(oxygen.getUint16(3, true)));
  }

  if (glucose && glucose.byteLength >= 10 && (glucose.getUint8(0) & 0x02)) {
    const flags = glucose.getUint8(0);
    let offset = 10;
    if (flags & 0x01) offset += 2;
    if (glucose.byteLength >= offset + 3) {
      // Bluetooth glucose concentration is kg/L unless the unit flag says mol/L.
      const concentration = ieee11073SFloat(glucose.getUint16(offset, true));
      readings.glucose = Number(((flags & 0x04) ? concentration * 18015.59 : concentration * 100000).toFixed(1));
    }
  }

  if (!Object.keys(readings).some(key => !['readAt', 'source', 'deviceName'].includes(key))) {
    throw new DeviceIntegrationError(
      'Connected successfully, but this device does not expose a readable standard health measurement yet.',
      'bluetooth_no_measurement',
    );
  }
  return readings;
}

const WIFI_GATEWAY_URL = (import.meta.env.VITE_DEVICE_GATEWAY_URL as string | undefined)?.replace(/\/+$/, '');
const wifiDevices = new Map<string, DeviceInfo>();

function requireWifiGateway(): string {
  if (!WIFI_GATEWAY_URL) {
    throw new DeviceIntegrationError(
      'Wi-Fi device import is not configured for this environment. Use manual entry or Bluetooth.',
      'wifi_gateway_not_configured',
    );
  }
  return WIFI_GATEWAY_URL;
}

async function gatewayRequest(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${requireWifiGateway()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    throw new DeviceIntegrationError(`Device gateway returned ${response.status}.`, 'wifi_gateway_error');
  }
  return response.json();
}

export async function connectWifi(address: string): Promise<DeviceInfo> {
  const payload = await gatewayRequest('/v1/devices/connect', {
    method: 'POST',
    body: JSON.stringify({ address }),
  }) as { id: string; name?: string };
  const device: DeviceInfo = {
    id: payload.id,
    name: payload.name || 'Wi-Fi health device',
    type: 'wifi',
    status: 'connected',
  };
  wifiDevices.set(address, device);
  return device;
}

export async function readWifiVitals(address: string): Promise<VitalReadings> {
  const device = wifiDevices.get(address);
  if (!device) throw new DeviceIntegrationError('Connect the Wi-Fi device first.', 'wifi_not_connected');
  const payload = await gatewayRequest(`/v1/devices/${encodeURIComponent(device.id)}/vitals`, {
    method: 'GET',
  }) as Partial<VitalReadings>;
  return {
    ...payload,
    readAt: payload.readAt || new Date().toISOString(),
    source: 'wifi',
    deviceName: device.name,
  };
}
