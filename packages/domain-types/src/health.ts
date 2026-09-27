export interface HealthComponentStatus {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  latencyMs?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  services: {
    database: HealthComponentStatus;
    redis: HealthComponentStatus;
    signaling: HealthComponentStatus;
  };
}
