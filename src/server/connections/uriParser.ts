import { ConnectionProfile } from './connectionManager';

/**
 * Parses a mongodb:// or mongodb+srv:// URI into ConnectionProfile fields.
 * Uses the Node.js URL API for parsing.
 */
export function parseMongoUri(uri: string): Partial<ConnectionProfile> {
  const url = new URL(uri);

  const result: Partial<ConnectionProfile> = {};

  if (url.hostname) {
    result.host = url.hostname;
  }

  if (url.port) {
    result.port = parseInt(url.port, 10);
  }

  if (url.username) {
    result.username = decodeURIComponent(url.username);
  }

  if (url.password) {
    result.password = decodeURIComponent(url.password);
  }

  // Database is the first path segment (strip leading slash)
  const dbPath = url.pathname?.replace(/^\//, '');
  if (dbPath) {
    result.database = dbPath;
  }

  return result;
}
