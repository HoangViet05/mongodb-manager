import apiClient from './apiClient';

export interface QueryRequest {
  operation:
    | 'find'
    | 'aggregate'
    | 'insertOne'
    | 'insertMany'
    | 'updateOne'
    | 'updateMany'
    | 'deleteOne'
    | 'deleteMany';
  collection: string;
  pipeline?: unknown[];
  filter?: Record<string, unknown>;
  update?: Record<string, unknown>;
  document?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  options?: Record<string, unknown>;
}

export interface QueryResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
}

export async function executeQuery(
  connId: string,
  dbName: string,
  query: QueryRequest
): Promise<QueryResult> {
  const response = await apiClient.post(`/connections/${connId}/databases/${dbName}/query`, query);
  return response.data;
}
