import * as fs from 'fs';
import * as path from 'path';

export interface EnvConfig {
  MONGO_URI?: string;
  MONGO_HOST?: string;
  MONGO_PORT?: string;
  MONGO_USER?: string;
  MONGO_PASSWORD?: string;
  MONGO_DB?: string;
}

const ENV_KEYS: (keyof EnvConfig)[] = [
  'MONGO_URI',
  'MONGO_HOST',
  'MONGO_PORT',
  'MONGO_USER',
  'MONGO_PASSWORD',
  'MONGO_DB',
];

// Resolves to mongo-db-manager/.env (4 levels up from src/server/env/)
const DEFAULT_ENV_PATH = path.resolve(__dirname, '../../../../.env');

function getEnvPath(envPath?: string): string {
  return envPath ?? DEFAULT_ENV_PATH;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

export function readEnvRaw(envPath?: string): EnvConfig {
  const filePath = getEnvPath(envPath);
  const parsed = parseEnvFile(filePath);
  const config: EnvConfig = {};
  for (const key of ENV_KEYS) {
    if (parsed[key] !== undefined) {
      config[key] = parsed[key];
    }
  }
  return config;
}

export function readEnv(envPath?: string): EnvConfig {
  const config = readEnvRaw(envPath);
  if (config.MONGO_PASSWORD !== undefined && config.MONGO_PASSWORD !== '') {
    config.MONGO_PASSWORD = '***';
  }
  return config;
}

export function writeEnv(config: Partial<EnvConfig>, envPath?: string): void {
  const filePath = getEnvPath(envPath);

  // Read existing file content to preserve all lines (including comments)
  let lines: string[] = [];
  if (fs.existsSync(filePath)) {
    lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  }

  const updatedKeys = new Set<string>();

  // Update existing key lines
  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return line;
    const key = trimmed.slice(0, eqIdx).trim() as keyof EnvConfig;
    if (key in config && config[key] !== undefined) {
      updatedKeys.add(key);
      return `${key}=${config[key]}`;
    }
    return line;
  });

  // Append any new keys not already in the file
  for (const key of ENV_KEYS) {
    if (key in config && config[key] !== undefined && !updatedKeys.has(key)) {
      lines.push(`${key}=${config[key]}`);
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
