/**
 * Optional external shipment-tracking integration interface.
 * The application never fabricates tracking data: until a provider is configured, the timeline
 * shows only events recorded by staff.
 */
export interface TrackingEvent { occurredAt: string; location?: string; description: string }
export interface TrackingProvider {
  name: string;
  track(containerOrRef: string): Promise<TrackingEvent[]>;
}

export const TRACKING_PROVIDERS: Record<string, TrackingProvider> = {};

export function getTrackingProvider(name?: string | null): TrackingProvider | null {
  return name ? TRACKING_PROVIDERS[name] ?? null : null;
}
