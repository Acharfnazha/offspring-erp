import type { FieldDef } from "@/components/forms/entity-form";
export const roomFields = (warehouses: { value: string; label: string }[]): FieldDef[] => [
  { name: "code", label: "Room ID" },
  { name: "name", label: "Room name" },
  { name: "warehouseId", label: "Warehouse", type: "select", options: warehouses },
  { name: "capacityKg", label: "Maximum capacity (kg)", type: "number" },
  { name: "targetTempC", label: "Target temperature (°C)", type: "number", step: "0.1" },
  { name: "tempToleranceC", label: "Alarm tolerance (± °C)", type: "number", step: "0.1" },
  { name: "targetHumidity", label: "Target humidity (%)", type: "number", step: "0.1" },
  { name: "status", label: "Operational status", type: "select", options: [{ value: "OPERATIONAL", label: "Operational" }, { value: "MAINTENANCE", label: "Maintenance" }, { value: "OFFLINE", label: "Offline" }] },
  { name: "sensorId", label: "IoT sensor ID (optional)", help: "For future automated readings" },
  { name: "maintenanceNotes", label: "Maintenance notes", type: "textarea", span: 2 },
];
