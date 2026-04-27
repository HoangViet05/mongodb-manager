import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export interface ConnectionProfile {
  id: string;
  name: string;
  uri?: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  createdAt: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  profile: ConnectionProfile;
  status: ConnectionStatus;
  error?: string;
  client?: MongoClient;
}

const connections = new Map<string, ConnectionState>();

export function createProfile(
  data: Omit<ConnectionProfile, 'id' | 'createdAt'>
): ConnectionProfile {
  const profile: ConnectionProfile = {
    id: uuidv4(),
    name: data.name,
    uri: data.uri,
    host: data.host || 'localhost',
    port: data.port || 27017,
    username: data.username,
    password: data.password,
    database: data.database,
    createdAt: new Date().toISOString(),
  };

  connections.set(profile.id, {
    profile,
    status: 'disconnected',
  });

  return profile;
}

export function listProfiles(): (ConnectionProfile & { status: ConnectionStatus })[] {
  return Array.from(connections.values()).map((state) => {
    const { password, ...rest } = state.profile;
    return { ...rest as ConnectionProfile, status: state.status };
  });
}

export function getProfile(id: string): ConnectionProfile | undefined {
  const state = connections.get(id);
  if (!state) return undefined;
  const { password, ...rest } = state.profile;
  return rest as ConnectionProfile;
}

export function deleteProfile(id: string): void {
  const state = connections.get(id);
  if (state?.client) {
    state.client.close().catch(console.error);
  }
  connections.delete(id);
}

function buildUri(profile: ConnectionProfile): string {
  if (profile.uri) return profile.uri;

  let uri = 'mongodb://';
  if (profile.username && profile.password) {
    uri += `${encodeURIComponent(profile.username)}:${encodeURIComponent(profile.password)}@`;
  }
  uri += `${profile.host}:${profile.port}`;
  if (profile.database) {
    uri += `/${profile.database}`;
  }
  return uri;
}

export async function connect(id: string): Promise<ConnectionState> {
  const state = connections.get(id);
  if (!state) {
    throw new Error('Profile not found');
  }

  try {
    const uri = buildUri(state.profile);
    const client = new MongoClient(uri);
    await client.connect();

    state.client = client;
    state.status = 'connected';
    state.error = undefined;

    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.status = 'error';
    state.error = message;
    state.client = undefined;
    return state;
  }
}

export async function disconnect(id: string): Promise<void> {
  const state = connections.get(id);
  if (!state) {
    throw new Error('Profile not found');
  }

  if (state.client) {
    await state.client.close();
    state.client = undefined;
  }
  state.status = 'disconnected';
  state.error = undefined;
}

export function getStatus(id: string): { status: ConnectionStatus; error?: string } {
  const state = connections.get(id);
  if (!state) {
    throw new Error('Profile not found');
  }
  return {
    status: state.status,
    error: state.error,
  };
}

export function parseUri(uri: string): Partial<ConnectionProfile> {
  try {
    const url = new URL(uri);
    const result: Partial<ConnectionProfile> = {};

    if (url.hostname) result.host = url.hostname;
    if (url.port) result.port = parseInt(url.port, 10);
    if (url.username) result.username = decodeURIComponent(url.username);
    if (url.password) result.password = decodeURIComponent(url.password);
    if (url.pathname && url.pathname !== '/') {
      result.database = url.pathname.slice(1);
    }

    return result;
  } catch (err) {
    throw new Error('Invalid MongoDB URI');
  }
}

export function getClient(id: string): MongoClient | undefined {
  const state = connections.get(id);
  return state?.client;
}
