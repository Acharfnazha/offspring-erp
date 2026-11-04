/**
 * IoT sensor integration interface (future use).
 * No live sensor data is fabricated: readings enter the system either manually (UI) or through
 * POST /api/integrations/sensor-readings, which is disabled unless SENSOR_API_KEY is configured.
 */
export interface SensorReading {
  sensorId: string;
  temperatureC: number;
  humidity?: number | null;
  recordedAt?: string; // ISO timestamp
}

export interface SensorProvider {
  name: string;
  /** Pull latest readings from an external platform (e.g. MQTT bridge, vendor cloud API). */
  fetchLatest(): Promise<SensorReading[]>;
}

/** Placeholder provider — returns nothing until a real integration is implemented. */
export const NullSensorProvider: SensorProvider = { name: "none", fetchLatest: async () => [] };
