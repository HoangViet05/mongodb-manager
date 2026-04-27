import { ObjectId } from 'mongodb';
import { getClient } from '../connections/connectionManager';

export interface DocumentQuery {
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  page?: number;
  pageSize?: number;
}

export interface DocumentResult {
  documents: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

function serializeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value instanceof ObjectId) {
      serialized[key] = value.toString();
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

export async function listDocuments(
  connId: string,
  dbName: string,
  collectionName: string,
  query: DocumentQuery
): Promise<DocumentResult> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  const filter = query.filter || {};
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const skip = (page - 1) * pageSize;

  let cursor = collection.find(filter);

  if (query.projection) {
    cursor = cursor.project(query.projection);
  }

  if (query.sort) {
    cursor = cursor.sort(query.sort);
  }

  cursor = cursor.skip(skip).limit(pageSize);

  const documents = await cursor.toArray();
  const total = await collection.countDocuments(filter);

  return {
    documents: documents.map(serializeDocument),
    total,
    page,
    pageSize,
  };
}

export function validateFilter(filterString: string): Record<string, unknown> {
  try {
    const filter = JSON.parse(filterString);
    if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) {
      throw new Error('Filter must be a JSON object');
    }
    return filter;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid filter syntax: ${err.message}`);
    }
    throw err;
  }
}

export async function insertDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  document: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  const result = await collection.insertOne(document);
  const inserted = await collection.findOne({ _id: result.insertedId });

  if (!inserted) {
    throw new Error('Failed to retrieve inserted document');
  }

  return serializeDocument(inserted);
}

export async function updateDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  docId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  const objectId = new ObjectId(docId);
  await collection.updateOne({ _id: objectId }, { $set: updates });

  const updated = await collection.findOne({ _id: objectId });
  if (!updated) {
    throw new Error('Document not found after update');
  }

  return serializeDocument(updated);
}

export async function deleteDocument(
  connId: string,
  dbName: string,
  collectionName: string,
  docId: string
): Promise<void> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  const objectId = new ObjectId(docId);
  const result = await collection.deleteOne({ _id: objectId });

  if (result.deletedCount === 0) {
    throw new Error('Document not found');
  }
}
