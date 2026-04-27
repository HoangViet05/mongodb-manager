import { getClient } from '../connections/connectionManager';

export async function listDatabases(connId: string): Promise<string[]> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const adminDb = client.db().admin();
  const result = await adminDb.listDatabases();
  return result.databases.map((db: { name: string }) => db.name);
}

export async function listCollections(connId: string, dbName: string): Promise<string[]> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collections = await db.listCollections().toArray();
  return collections.map((col) => col.name);
}

export interface CollectionStats {
  name: string;
  count: number;
}

export async function getCollectionStats(
  connId: string,
  dbName: string,
  collectionName: string
): Promise<CollectionStats> {
  const client = getClient(connId);
  if (!client) {
    throw new Error('Connection not established');
  }

  const db = client.db(dbName);
  const collection = db.collection(collectionName);
  const count = await collection.countDocuments();

  return {
    name: collectionName,
    count,
  };
}
