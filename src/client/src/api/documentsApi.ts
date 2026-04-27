import apiClient from './apiClient';
import { DocumentResult } from '../store/appStore';

export interface DocumentQuery {
  filter?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function listDocuments(
  connId: string,
  dbName: string,
  collectionName: string,
  query: DocumentQuery
): Promise<DocumentResult> {
  const params = new URLSearchParams();
  if (query.filter) params.append('filter', query.filter);
  if (query.sort) params.append('sort', query.sort);
  if (query.page) params.append('page', query.page.toString());
  if (query.pageSize) params.append('pageSize', query.pageSize.toString());

  const response = await apiClient.get(
    `/connections/${connId}/databases/${dbName}/collections/${collectionName}/documents?${params}`
  );
  return response.data.data;
}

export async function insertDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  document: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await apiClient.post(
    `/connections/${connId}/databases/${dbName}/collections/${collectionName}/documents`,
    document
  );
  return response.data.data;
}

export async function updateDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  docId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await apiClient.put(
    `/connections/${connId}/databases/${dbName}/collections/${collectionName}/documents/${docId}`,
    updates
  );
  return response.data.data;
}

export async function deleteDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  docId: string
): Promise<void> {
  await apiClient.delete(
    `/connections/${connId}/databases/${dbName}/collections/${collectionName}/documents/${docId}`
  );
}
