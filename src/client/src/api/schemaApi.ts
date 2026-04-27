import apiClient from './apiClient';

export interface CollectionStats {
  name: string;
  count: number;
}

export async function listDatabases(connId: string): Promise<string[]> {
  const response = await apiClient.get(`/connections/${connId}/databases`);
  return response.data.data;
}

export async function listCollections(connId: string, dbName: string): Promise<string[]> {
  const response = await apiClient.get(`/connections/${connId}/databases/${dbName}/collections`);
  return response.data.data;
}

export async function getCollectionStats(
  connId: string,
  dbName: string,
  collectionName: string
): Promise<CollectionStats> {
  const response = await apiClient.get(
    `/connections/${connId}/databases/${dbName}/collections/${collectionName}/stats`
  );
  return response.data.data;
}
