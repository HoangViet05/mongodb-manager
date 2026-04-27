import apiClient from './apiClient';

export interface EnvConfig {
  MONGO_URI?: string;
  MONGO_HOST?: string;
  MONGO_PORT?: string;
  MONGO_USER?: string;
  MONGO_PASSWORD?: string;
  MONGO_DB?: string;
}

export async function getEnvConfig(): Promise<EnvConfig> {
  const response = await apiClient.get('/env');
  return response.data.data;
}

export async function updateEnvConfig(config: Partial<EnvConfig>): Promise<void> {
  await apiClient.put('/env', config);
}
