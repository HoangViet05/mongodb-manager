import { ObjectId, Document } from 'mongodb';
import { getClient } from '../connections/connectionManager';

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

function serializeValue(value: unknown): unknown {
  if (value instanceof ObjectId) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === 'object') {
    const serialized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      serialized[k] = serializeValue(v);
    }
    return serialized;
  }
  return value;
}

async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout after 30s')), timeoutMs)
    ),
  ]);
}

export async function executeQuery(
  connId: string,
  dbName: string,
  req: QueryRequest
): Promise<QueryResult> {
  const startTime = Date.now();

  try {
    const client = getClient(connId);
    if (!client) {
      throw new Error('Connection not established');
    }

    const db = client.db(dbName);
    const collection = db.collection(req.collection);

    let result: unknown;

    const operation = executeWithTimeout(
      (async () => {
        switch (req.operation) {
          case 'find':
            return await collection.find(req.filter || {}, req.options).toArray();

          case 'aggregate':
            if (!req.pipeline) {
              throw new Error('Pipeline is required for aggregate operation');
            }
            return await collection.aggregate(req.pipeline as Document[], req.options).toArray();

          case 'insertOne':
            if (!req.document) {
              throw new Error('Document is required for insertOne operation');
            }
            return await collection.insertOne(req.document, req.options);

          case 'insertMany':
            if (!req.documents) {
              throw new Error('Documents array is required for insertMany operation');
            }
            return await collection.insertMany(req.documents, req.options);

          case 'updateOne':
            if (!req.filter || !req.update) {
              throw new Error('Filter and update are required for updateOne operation');
            }
            return await collection.updateOne(req.filter, req.update, req.options);

          case 'updateMany':
            if (!req.filter || !req.update) {
              throw new Error('Filter and update are required for updateMany operation');
            }
            return await collection.updateMany(req.filter, req.update, req.options);

          case 'deleteOne':
            if (!req.filter) {
              throw new Error('Filter is required for deleteOne operation');
            }
            return await collection.deleteOne(req.filter, req.options);

          case 'deleteMany':
            if (!req.filter) {
              throw new Error('Filter is required for deleteMany operation');
            }
            return await collection.deleteMany(req.filter, req.options);

          default:
            throw new Error(`Unsupported operation: ${req.operation}`);
        }
      })(),
      30000
    );

    result = await operation;
    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: serializeValue(result),
      executionTimeMs,
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      error: message,
      executionTimeMs,
    };
  }
}
