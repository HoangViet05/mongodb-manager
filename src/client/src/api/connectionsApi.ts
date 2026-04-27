import apiClient from './apiClient';
import { ConnectionProfile, ConnectionState } from '../store/appStore';

export async function createConnection(
  data: Omit<ConnectionProfile, 'id' | 'createdAt'>
): Promise<ConnectionProfile> {
  const response = await apiClient.post('/connections', data);
  return response.data.data;
}

export async function listConnections(): Promise<ConnectionProfile[]> {
  const response = await apiClient.get('/connections');
  return response.data.data;
}

export async function connectToMongo(id: string): Promise<ConnectionState> {
  const response = await apiClient.post(`/connections/${id}/connect`);
  return { id, ...response.data.data };
}

export async function disconnectFromMongo(id: string): Promise<void> {
  await apiClient.post(`/connections/${id}/disconnect`);
}

export async function getConnectionStatus(id: string): Promise<ConnectionState> {
  const response = await apiClient.get(`/connections/${id}/status`);
  return { id, ...response.data.data };
}

export async function deleteConnection(id: string): Promise<void> {
  await apiClient.delete(`/connections/${id}`);
}
